import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { execute, sha256, writeJson } from "./runtime/run-common.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const archiveName = "wiggly-shaz-puppet-runtime-format-kit";
const downloads = path.join(root, "downloads");
const output = path.join(downloads, `${archiveName}.zip`);
const checksumOutput = `${output}.sha256`;
const excludedNames = new Set(["node_modules", ".runtime-cache", ".DS_Store", ".git"]);
const packagedPropFiles = new Set(["phone.svg", "crossed-arms-pose.png"]);
const packagedFontFiles = new Set(["GROBOLD.ttf"]);
const packagedBackgroundFiles = new Set([
  "living-room.png",
  "map-photo-zone.png",
  "pure-white.png",
  "sisters-room.png",
]);
const archiveTimestamp = new Date("2000-01-01T00:00:00.000Z");

async function listFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute)));
    } else if (entry.isFile()) {
      files.push(absolute);
    } else {
      throw new Error(`unsupported package entry: ${absolute}`);
    }
  }
  return files;
}

export function include(source) {
  const relative = path.relative(root, source);
  if (!relative) return true;
  const parts = relative.split(path.sep);
  if (parts.some((part) => excludedNames.has(part))) return false;
  if (parts[0] === "downloads") return false;
  if (parts[0] === "agent-runs" && parts.length > 1 && parts.at(-1) !== ".gitkeep") return false;
  if (parts[0] === "goldens" || relative === "goldens.json") return false;
  if (
    parts[0] === "assets" &&
    parts[1] === "props" &&
    parts.length > 2 &&
    !packagedPropFiles.has(parts.slice(2).join(path.sep))
  ) {
    return false;
  }
  if (
    parts[0] === "assets" &&
    parts[1] === "fonts" &&
    parts.length > 2 &&
    !packagedFontFiles.has(parts.slice(2).join(path.sep))
  ) {
    return false;
  }
  if (
    parts[0] === "assets" &&
    parts[1] === "backgrounds" &&
    parts.length > 2 &&
    !packagedBackgroundFiles.has(parts.slice(2).join(path.sep))
  ) {
    return false;
  }
  if (relative === "evidence/blind-kit-operation.md") return false;
  if (relative === "evidence/local-transcription-sealed-receipt.md") return false;
  if (relative === "runtime/build-crossed-arms-assembly.mjs") return false;
  if (relative === "runtime/compile-tvg-assets.mjs") return false;
  return true;
}

export async function buildKit() {
  await fs.mkdir(downloads, { recursive: true });
  await fs.rm(output, { force: true });
  await fs.rm(checksumOutput, { force: true });
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-format-kit-"));
  const staged = path.join(scratch, archiveName);
  try {
    await fs.cp(root, staged, { recursive: true, filter: include });
    await writeJson(path.join(staged, "KIT-MANIFEST.json"), {
      schemaVersion: 1,
      id: "shaz-puppet-runtime",
      version: (await import("./format.json", { with: { type: "json" } })).default.version,
      officialRuntime: "runner.mjs",
      commands: ["check", "inspect:registry", "smoke", "transcribe", "lipsync", "init", "validate", "render", "inspect", "finalize"],
      networkRequired: false,
      providerCost: "$0",
      artistRenderedFramesUsed: false,
    });
    const stagedFiles = (await listFiles(staged)).sort((left, right) => left.localeCompare(right));
    for (const file of stagedFiles) {
      await fs.utimes(file, archiveTimestamp, archiveTimestamp);
    }
    const archiveEntries = stagedFiles.map((file) => path.relative(scratch, file));
    execute("zip", ["-q", "-X", output, ...archiveEntries], { cwd: scratch });
    const digest = await sha256(output);
    await fs.writeFile(checksumOutput, `${digest}  ${path.basename(output)}\n`);
    console.log(JSON.stringify({ status: "built", output, sha256: digest }, null, 2));
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildKit();
}
