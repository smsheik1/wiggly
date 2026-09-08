#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const downloads = path.join(root, "downloads");
const zipName = "wiggly-tutorial-video-format-kit-0.2.0.zip";
const zipPath = path.join(downloads, zipName);
const ignored = new Set([".DS_Store", ".git"]);
function files(dir, prefix = "") {
  return readdirSync(dir).flatMap((name) => {
    if (ignored.has(name) || name === "downloads") return [];
    const absolute = path.join(dir, name);
    const relative = path.join(prefix, name);
    return statSync(absolute).isDirectory() ? files(absolute, relative) : [relative];
  });
}
// Keep the permitted source masters and produced examples in the kit; downloads are release outputs.
const include = files(root).filter((file) => !file.startsWith("downloads/") && file !== "RELEASE-CONTENTS.json").sort();
const inventory = { schemaVersion: 1, kit: "wiggly-tutorial-video-format-kit", version: "0.2.0", files: include.map((file) => ({ file: file.split(path.sep).join("/"), sha256: createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex"), sizeBytes: statSync(path.join(root, file)).size })) };
writeFileSync(path.join(root, "RELEASE-CONTENTS.json"), JSON.stringify(inventory, null, 2) + "\n");
if (existsSync(zipPath)) unlinkSync(zipPath);
execFileSync("zip", ["-X", "-q", "-r", zipPath, ...include, "RELEASE-CONTENTS.json"], { cwd: root, stdio: "inherit" });
const digest = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
writeFileSync(`${zipPath}.sha256`, `${digest}  ${zipName}\n`);
writeFileSync(path.join(downloads, "latest-release.json"), JSON.stringify({ kit: inventory.kit, version: inventory.version, archive: zipName, sha256: digest, generatedAt: "2026-09-08" }, null, 2) + "\n");
console.log(`built ${zipName} (${statSync(zipPath).size} bytes) sha256=${digest}`);
