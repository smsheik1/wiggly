import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STUDIO_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_RUNS_ROOT = path.resolve(
  STUDIO_DIR,
  "../../v3/public/format-repositories/shaz-puppet-runtime-v1/agent-runs",
);

const HEAVY_DIRS = new Set(["shots", "render", "frames", "tmp", "media"]);
const ALWAYS_PRUNE_EXTENSIONS = new Set([".wav", ".png", ".jpg", ".jpeg", ".webp"]);

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isPickedOrPublishedRun(runDir) {
  if (await exists(path.join(runDir, "publish-state.json"))) {
    return true;
  }
  const reviewPath = path.join(runDir, "human-review.json");
  try {
    const parsed = JSON.parse(await fs.readFile(reviewPath, "utf8"));
    return parsed?.status === "approved";
  } catch {
    return false;
  }
}

async function collectFilesRecursively(dir, relPrefix = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const results = [];
  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...(await collectFilesRecursively(absPath, relPath)));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      const stat = await fs.lstat(absPath).catch(() => null);
      results.push({
        absPath,
        relPath,
        name: entry.name,
        size: stat?.size || 0,
      });
    }
  }
  return results;
}

function shouldPruneRunFile({ relPath, name }, isPicked) {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".json")) {
    return false;
  }
  const ext = path.extname(lowerName);
  const topDir = relPath.includes("/") ? relPath.split("/")[0].toLowerCase() : "";

  if (HEAVY_DIRS.has(topDir)) {
    return true;
  }
  if (ALWAYS_PRUNE_EXTENSIONS.has(ext)) {
    return true;
  }
  if (ext === ".mp4") {
    // Raw master `final.mp4` is redundant once expired; keep picked `final-vertical.mp4`, prune unpicked MP4s.
    if (!isPicked) return true;
    return lowerName !== "final-vertical.mp4";
  }
  return false;
}

async function removeEmptyHeavyDirs(dir, { isRoot = false } = {}) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyHeavyDirs(path.join(dir, entry.name), { isRoot: false });
    }
  }
  if (!isRoot) {
    const remaining = await fs.readdir(dir).catch(() => ["keep"]);
    if (remaining.length === 0) {
      await fs.rmdir(dir).catch(() => {});
    }
  }
}

/**
 * Prunes heavy media/render artifacts (shots, render, media, WAV, PNG, old unpicked MP4s) from run
 * folders older than `retentionDays`, while preserving every `*.json` traceability receipt forever.
 *
 * @param {Object} [options]
 * @param {string} [options.runsDir] - Directory containing run folders
 * @param {number} [options.retentionDays=7] - Days before a run's heavy assets are pruned
 * @param {boolean} [options.dryRun=false] - Preview deletions without removing files
 * @param {Date} [options.now] - Current clock reference
 */
export async function pruneOldRuns({
  runsDir = DEFAULT_RUNS_ROOT,
  retentionDays = 7,
  dryRun = false,
  now = new Date(),
} = {}) {
  const safeDays = Number.isFinite(retentionDays) && retentionDays >= 0 ? retentionDays : 7;
  const cutoffMs = now.getTime() - safeDays * 86_400_000;

  let entries;
  try {
    entries = await fs.readdir(runsDir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") {
      return {
        dryRun,
        runsDir,
        retentionDays: safeDays,
        runsScanned: 0,
        runsPruned: 0,
        filesDeleted: 0,
        bytesFreed: 0,
        deletedPaths: [],
      };
    }
    throw err;
  }

  let runsScanned = 0;
  let runsPruned = 0;
  let filesDeleted = 0;
  let bytesFreed = 0;
  const deletedPaths = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    runsScanned += 1;

    const runDir = path.join(runsDir, entry.name);
    const stat = await fs.stat(runDir).catch(() => null);
    if (!stat || stat.mtimeMs >= cutoffMs) continue;

    const isPicked = await isPickedOrPublishedRun(runDir);
    const files = await collectFilesRecursively(runDir);
    let prunedInThisRun = 0;

    for (const file of files) {
      if (!shouldPruneRunFile(file, isPicked)) continue;
      if (!dryRun) {
        await fs.unlink(file.absPath);
      }
      filesDeleted += 1;
      bytesFreed += file.size;
      prunedInThisRun += 1;
      deletedPaths.push(file.absPath);
    }

    if (!dryRun && prunedInThisRun > 0) {
      for (const heavyDirName of HEAVY_DIRS) {
        const heavyPath = path.join(runDir, heavyDirName);
        if (await exists(heavyPath)) {
          await removeEmptyHeavyDirs(heavyPath, { isRoot: false });
        }
      }
    }

    if (prunedInThisRun > 0) {
      runsPruned += 1;
    }
  }

  return {
    dryRun,
    runsDir,
    retentionDays: safeDays,
    runsScanned,
    runsPruned,
    filesDeleted,
    bytesFreed,
    deletedPaths,
  };
}
