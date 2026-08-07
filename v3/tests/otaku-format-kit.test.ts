import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  prepareMusicBed,
  probeDurationMs,
} from "../scripts/otaku-media";

const run = (command: string, args: string[], cwd = process.cwd()) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${command} failed:\n${result.stderr}`);
  return `${result.stdout}${result.stderr}`;
};

const readZipEntries = (archivePath: string) => {
  const archive = readFileSync(archivePath);
  const entries: string[] = [];
  for (let offset = 0; offset <= archive.length - 46;) {
    offset = archive.indexOf("PK\u0001\u0002", offset, "binary");
    if (offset < 0) break;
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    entries.push(archive.subarray(offset + 46, offset + 46 + nameLength).toString());
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.ok(entries.length > 0, "Format Kit ZIP must contain files.");
  return entries;
};

const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "wiggly-format-kit-"));
try {
  const sourceMusic = path.join(temporaryRoot, "source.wav");
  const preparedMusic = path.join(temporaryRoot, "prepared.mp3");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
    sourceMusic,
  ]);
  await prepareMusicBed({
    outputPath: preparedMusic,
    sourcePath: sourceMusic,
    targetDurationMs: 2_600,
  });
  assert.ok(Math.abs((await probeDurationMs(preparedMusic)) - 2_600) <= 80);
  const silenceReport = run("ffmpeg", [
    "-hide_banner", "-i", preparedMusic,
    "-af", "silencedetect=noise=-50dB:d=0.1",
    "-f", "null", "-",
  ]);
  assert.doesNotMatch(silenceReport, /silence_duration/, "Prepared music must not contain a silent loop seam.");

  const archive = path.resolve(
    "public",
    "format-repositories",
    "otaku-explainer-v1",
    "downloads",
    "wiggly-cartoon-explainer-format-kit.zip",
  );
  const entryList = readZipEntries(archive);
  const entries = entryList.join("\n");
  for (const required of [
    "wiggly-cartoon-explainer-format-kit/README.md",
    "v3/package.json",
    "v3/kit-smoke.mjs",
    "v3/scripts/otaku-format.ts",
    "v3/scripts/otaku-media.ts",
    "v3/scripts/render-otaku-proofs.ts",
    "v3/scripts/smoke-otaku-format.ts",
    "v3/tests/otaku-format-runtime.test.ts",
    "v3/features/experiments/otaku-format/OtakuProofVideo.tsx",
    "v3/public/format-repositories/otaku-explainer-v1/SKILL.md",
    "v3/public/format-repositories/otaku-explainer-v1/pipeline.json",
    "v3/public/format-repositories/otaku-explainer-v1/goldens.json",
    "v3/public/format-repositories/otaku-explainer-v1/goldens/naruto-apis-contact-sheet.jpg",
    "v3/public/format-repositories/otaku-explainer-v1/assets/reference/reference.mp4",
    "v3/public/format-repositories/otaku-explainer-v1/renderer/OtakuFormatRenderer.tsx",
  ]) {
    assert.match(entries, new RegExp(required.replaceAll(".", "\\.")), `${required} must be downloadable.`);
  }
  assert.equal(entryList.some((entry) => entry.includes("/outputs/") || entry.includes("/agent-runs/")), false);
  assert.equal(entryList.some((entry) => /\/assets\/audio\/[^/]+\//.test(entry)), false);

  assert.match(run("node", ["public/format-repositories/otaku-explainer-v1/kit-smoke.mjs"]), /Format Kit files are complete/);
  const packageJson = JSON.parse(readFileSync(
    "public/format-repositories/otaku-explainer-v1/kit.package.json",
    "utf8",
  )) as {
    scripts: Record<string, string>;
  };
  assert.match(packageJson.scripts["prototype:otaku"], /otaku-format\.ts/);
  assert.match(packageJson.scripts.smoke, /smoke-otaku-format\.ts/);
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true });
}

console.log("Otaku Format Kit tests passed.");
