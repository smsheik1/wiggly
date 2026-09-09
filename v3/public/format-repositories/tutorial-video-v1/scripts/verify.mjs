#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const sha256 = (file) => createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex");

for (const file of ["README.md", "SKILL.md", "KIT-MANIFEST.json", "PROOF-REPORT.md", "PROVENANCE.md", "format.json", "input-contract.json", "output-contract.json", "requirements.json", "quality.json", "pipeline.json", "goldens.json", "assets.json", "release-files.json", "runner.mjs", "build-kit.mjs"]) assert.ok(existsSync(path.join(root, file)), `missing ${file}`);
const manifest = readJson("KIT-MANIFEST.json");
const format = readJson("format.json");
assert.equal(manifest.formatVersion, format.version);
assert.equal(format.slug, "tutorial-video");
assert.deepEqual(
  readJson("requirements.json").providers.map((p) => p.name),
  ["Social Publisher (Buffer MCP or API)"]
);
assert.equal(readJson("output-contract.json").video.aspectRatio, "16:9");

execFileSync(process.execPath, ["--test", "tests/distribution.test.mjs"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["runner.mjs", "doctor"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["runner.mjs", "check", "--input=examples/animal-conversations-first-run/input.json"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["runner.mjs", "check", "--input=examples/animal-conversations-variant/input.json"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["runner.mjs", "smoke"], { cwd: root, stdio: "inherit" });

const example = "examples/animal-conversations-first-run/final.mp4";
const report = readJson("examples/animal-conversations-first-run/quality-report.json");
assert.ok(existsSync(path.join(root, example)), "missing produced example video");
assert.equal(sha256(example), report.outputSha256, "example hash receipt drifted");
const verificationOutput = path.join(root, ".verify-output.mp4");
try {
  execFileSync(process.execPath, ["runner.mjs", "render", "--input=examples/animal-conversations-first-run/input.json", `--output=${verificationOutput}`], { cwd: root, stdio: "inherit" });
  const inspected = JSON.parse(execFileSync(process.execPath, ["runner.mjs", "inspect", `--input=${verificationOutput}`], { cwd: root, encoding: "utf8" }));
  assert.equal(inspected.video.width, 1920);
  assert.equal(inspected.video.height, 1080);
  assert.equal(inspected.video.codec_name, "h264");
  assert.equal(inspected.audio.codec_name, "aac");
  const source = JSON.parse(readFileSync(path.join(root, "examples/animal-conversations-first-run/input.json"), "utf8")).sourceVideo;
  const sourceMeta = JSON.parse(execFileSync(process.execPath, ["runner.mjs", "inspect", `--input=${path.join(root, "examples/animal-conversations-first-run", source)}`], { cwd: root, encoding: "utf8" }));
  assert.ok(Math.abs(inspected.durationSeconds - sourceMeta.durationSeconds) <= 0.15);
} finally {
  if (existsSync(verificationOutput)) await import("node:fs/promises").then(({ unlink }) => unlink(verificationOutput));
}
const variant = "examples/animal-conversations-variant/final.mp4";
const variantReport = readJson("examples/animal-conversations-variant/quality-report.json");
assert.ok(existsSync(path.join(root, variant)), "missing second produced example video");
assert.equal(sha256(variant), variantReport.outputSha256, "second example hash receipt drifted");
const variantVerificationOutput = path.join(root, ".verify-variant-output.mp4");
try {
  execFileSync(process.execPath, ["runner.mjs", "render", "--input=examples/animal-conversations-variant/input.json", `--output=${variantVerificationOutput}`], { cwd: root, stdio: "inherit" });
  const inspected = JSON.parse(execFileSync(process.execPath, ["runner.mjs", "inspect", `--input=${variantVerificationOutput}`], { cwd: root, encoding: "utf8" }));
  assert.equal(inspected.video.width, 1920);
  assert.equal(inspected.video.height, 1080);
  assert.equal(inspected.video.codec_name, "h264");
  assert.equal(inspected.audio.codec_name, "aac");
  const variantInput = JSON.parse(readFileSync(path.join(root, "examples/animal-conversations-variant/input.json"), "utf8"));
  const variantSourceMeta = JSON.parse(execFileSync(process.execPath, ["runner.mjs", "inspect", `--input=${path.join(root, "examples/animal-conversations-variant", variantInput.sourceVideo)}`], { cwd: root, encoding: "utf8" }));
  assert.ok(Math.abs(inspected.durationSeconds - variantSourceMeta.durationSeconds) <= 0.15);
} finally {
  if (existsSync(variantVerificationOutput)) await import("node:fs/promises").then(({ unlink }) => unlink(variantVerificationOutput));
}
console.log("Tutorial Video kit offline verification passed: contracts, zero-provider gate, smoke, produced evidence, and deterministic local render.");
