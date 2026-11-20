import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { getDefaultStudioHome } from "./content-ledger.mjs";
import { RunStopError } from "./errors.mjs";

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err?.code === "EPERM") return true;
    return false;
  }
}

async function readLockFile(lockPath) {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Acquires the exclusive studio lockfile at `<studioHome>/studio.lock`.
 * Reclaims stale lockfiles whose owning PID is no longer alive; fails loudly
 * with `RunStopError` when an active run holds the lock.
 */
export async function acquireStudioLock({
  env = process.env,
  studioHome,
  mode = "studio",
  isPidAliveFn = isPidAlive,
} = {}) {
  const homeDir = studioHome || getDefaultStudioHome(env);
  await fs.mkdir(homeDir, { recursive: true });
  const lockPath = path.join(homeDir, "studio.lock");
  const token = crypto.randomBytes(12).toString("hex");
  const payload = {
    pid: process.pid,
    mode,
    token,
    host: os.hostname(),
    startedAt: new Date().toISOString(),
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const handle = await fs.open(lockPath, "wx");
      try {
        await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
      } finally {
        await handle.close();
      }

      let released = false;
      return {
        lockPath,
        payload,
        async release() {
          if (released) return;
          released = true;
          const current = await readLockFile(lockPath);
          if (current?.token === token) {
            await fs.unlink(lockPath).catch(() => {});
          }
        },
      };
    } catch (err) {
      if (err?.code !== "EEXIST") {
        throw err;
      }

      const existing = await readLockFile(lockPath);
      const existingPid = existing?.pid;
      if (attempt === 1 && existingPid !== process.pid && !isPidAliveFn(existingPid)) {
        // Stale lock from a crashed run: reclaim once and retry acquisition cleanly.
        await fs.unlink(lockPath).catch(() => {});
        continue;
      }

      throw new RunStopError(
        `Concurrent studio run already active (pid=${existingPid ?? "unknown"}, mode=${existing?.mode ?? "unknown"}, startedAt=${existing?.startedAt ?? "unknown"}, lock=${lockPath}). Wait for the active run to finish or inspect the lockfile before retrying.`,
        {
          code: "STUDIO_LOCKED",
          stage: "preflight",
          headline: "Concurrent Run Active",
          cause: err,
        },
      );
    }
  }

  throw new RunStopError(`Failed to acquire studio lock at ${lockPath}.`, {
    code: "STUDIO_LOCKED",
    stage: "preflight",
    headline: "Concurrent Run Active",
  });
}

/**
 * Verifies free disk space in `studioHome` (or `checkPath`) before paid API calls.
 */
export async function assertFreeDiskSpace({
  minFreeDiskMb = 1500,
  checkPath,
  env = process.env,
  statfsFn = fs.statfs,
} = {}) {
  const targetPath = checkPath || getDefaultStudioHome(env);
  if (statfsFn === fs.statfs) {
    await fs.mkdir(targetPath, { recursive: true });
  }
  const stats = await statfsFn(targetPath);
  const availBlocks = Number(stats?.bavail ?? stats?.bfree ?? 0);
  const blockSize = Number(stats?.bsize || stats?.frsize || 0);
  const freeMb = Math.floor((availBlocks * blockSize) / (1024 * 1024));

  if (!Number.isFinite(freeMb) || freeMb < minFreeDiskMb) {
    throw new RunStopError(
      `Insufficient free disk space at ${targetPath}: ${freeMb} MB free, requires at least ${minFreeDiskMb} MB (studio.config.json minFreeDiskMb). Prune old runs or free disk space before spending API credits.`,
      {
        code: "DISK_LOW",
        stage: "preflight",
        headline: "Low Disk Space",
      },
    );
  }

  return {
    path: targetPath,
    freeMb,
    minFreeDiskMb,
  };
}
