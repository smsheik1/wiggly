#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const sha256 = (file) => createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex");

const requiredFiles = [
  "README.md", "SKILL.md", "KIT-MANIFEST.json", "PROOF-REPORT.md", "PROVENANCE.md",
  "format.json", "input-contract.json", "composition-contract.json", "output-contract.json",
  "requirements.json", "quality.json", "pipeline.json", "goldens.json", "assets.json",
  "release-files.json", "runner.mjs", "build-kit.mjs", "runtime/index.jsx", "runtime/root.jsx",
  "runtime/tutorial-video.jsx", "runtime/contract.mjs", "runtime/critique.mjs", "runtime/harvest.mjs", "runtime/voice.mjs", "fixtures/smoke/input.json",
  "fixtures/creative-review.example.json", "evidence/blind-agent-run.json",
  "media/fixed/grid-acid-lime-v1.png", "media/fixed/grid-electric-blue-v1.png",
  "media/fixed/grid-warm-cream-v1.png"
];
for (const file of requiredFiles) assert.ok(existsSync(path.join(root, file)), `missing ${file}`);

const manifest = readJson("KIT-MANIFEST.json");
const format = readJson("format.json");
const inputContract = readJson("input-contract.json");
assert.equal(manifest.formatVersion, "0.3.0");
assert.equal(format.version, "0.3.0");
assert.equal(format.slug, "tutorial-video");
assert.deepEqual(
  readJson("requirements.json").providers.map((p) => p.name),
  ["Social Publisher (Buffer MCP or API)"]
);
assert.equal(readJson("output-contract.json").video.aspectRatio, "16:9");
assert.ok(inputContract.forbidden.includes("sourceVideo"));
assert.match(readFileSync(path.join(root, "README.md"), "utf8"), /rejects `sourceVideo`/);

execFileSync(process.execPath, ["--test", "tests/distribution.test.mjs"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["--test", "tests/critique.test.mjs"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["--test", "tests/harvest.test.mjs"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["--test", "tests/voice.test.mjs"], { cwd: root, stdio: "inherit" });
execFileSync(process.execPath, ["runner.mjs", "doctor"], { cwd: root, stdio: "inherit" });
const inputs = [
  "examples/batman-arkham-first-run/input.json",
  "examples/animal-conversations-compositor/input.json"
];
for (const input of inputs) execFileSync(process.execPath, ["runner.mjs", "validate", `--input=${input}`], { cwd: root, stdio: "ignore" });

const temporary = mkdtempSync(path.join(os.tmpdir(), "wiggly-tutorial-invalid-"));
try {
  const invalid = { ...readJson(inputs[0]), sourceVideo: "finished-master.mp4" };
  const invalidPath = path.join(temporary, "input.json");
  writeFileSync(invalidPath, JSON.stringify(invalid));
  const rejected = spawnSync(process.execPath, ["runner.mjs", "validate", `--input=${invalidPath}`], { cwd: root, encoding: "utf8" });
  assert.notEqual(rejected.status, 0, "sourceVideo must be rejected");
  assert.match(`${rejected.stdout}${rejected.stderr}`, /sourceVideo is forbidden/);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const expectedFeatures = ["retro-grid", "macos-window-chrome", "numbered-step-badges", "neon-checkpoint-cards", "styled-subtitles", "progress-bar"];
let sharedRuntimeHash = null;
for (const input of inputs) {
  const directory = path.dirname(input);
  const output = `${directory}/final.mp4`;
  const receipt = readJson(`${output}.receipt.json`);
  const report = readJson(`${directory}/quality-report.json`);
  assert.ok(existsSync(path.join(root, output)), `missing produced proof ${output}`);
  assert.equal(receipt.inputSha256, sha256(input), `${input} receipt input drifted`);
  assert.equal(receipt.outputSha256, sha256(output), `${output} receipt output drifted`);
  assert.equal(report.inputSha256, sha256(output), `${output} inspection hash drifted`);
  assert.equal(receipt.providerCalls, 0);
  assert.deepEqual(receipt.signatureFeatures, expectedFeatures);
  assert.equal(report.passed, true);
  assert.equal(report.sampling.mode, "ingredient-step-midpoints");
  assert.deepEqual(report.sampling.stepIds, readJson(input).steps.map((step) => step.id));
  sharedRuntimeHash ??= receipt.runtimeSha256;
  assert.equal(receipt.runtimeSha256, sharedRuntimeHash, "both proofs must use the exact same runtime");
}
assert.equal(sharedRuntimeHash, sha256("runtime/tutorial-video.jsx"), "proof receipts must match the packaged runtime");
const blind = readJson("evidence/blind-agent-run.json");
assert.equal(blind.result, "passed");
assert.equal(blind.providerCalls, 0);
assert.equal(blind.outputSha256, "66196f9f005cba7b2ae973b5f07842425a371f00aff894d835ec0dd88c6819fd");

execFileSync(process.execPath, ["runner.mjs", "smoke"], { cwd: root, stdio: "inherit" });
console.log("Tutorial Video 0.3.0 verification passed: real compositor, source-master rejection, two inputs, zero providers, receipts, and end-to-end smoke.");
