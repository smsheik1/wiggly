import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { publish } from "../runtime/publish.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const goldenVideo = path.join(rootDir, "goldens/wiggly-format-explainer.mp4");
const distributionInput = path.join(rootDir, "inputs/distribution.json");

test("pipeline.json includes distribute stage with approvalRequired", () => {
  const pipeline = JSON.parse(readFileSync(path.join(rootDir, "pipeline.json"), "utf8"));
  if (Array.isArray(pipeline.stages)) {
    const distributeStage = pipeline.stages.find((s) => s.id === "distribute");
    assert.ok(distributeStage, "pipeline.json missing distribute stage");
    assert.equal(distributeStage.approvalRequired, true, "distribute stage must require explicit approval");
  } else if (Array.isArray(pipeline.steps)) {
    assert.ok(pipeline.steps.includes("distribute"), "pipeline.json missing distribute step");
  }
});

test("requirements.json declares social publisher provider without secrets", () => {
  const requirements = JSON.parse(readFileSync(path.join(rootDir, "requirements.json"), "utf8"));
  const publisher = requirements.providers?.find((p) => p.name?.includes("Social Publisher"));
  assert.ok(publisher, "requirements.json must declare Social Publisher");
  assert.ok(publisher.environmentVariables?.includes("BUFFER_API_KEY"), "Social Publisher must declare BUFFER_API_KEY");
  const rawText = readFileSync(path.join(rootDir, "requirements.json"), "utf8");
  assert.doesNotMatch(rawText, /buf_[a-zA-Z0-9]{20,}/, "No real API tokens in requirements.json");
});

test("publish.mjs validates inputs and executes cleanly in --dry-run mode", async () => {
  assert.ok(existsSync(goldenVideo), "Golden explainer video must exist");
  assert.ok(existsSync(distributionInput), "Distribution input config must exist");

  const receipt = await publish(["--dry-run", distributionInput, goldenVideo]);
  assert.equal(receipt.status, "dry_run_success");
  assert.equal(receipt.media.sha256, "2e978f8873a5ef32a30d1378fd3e9ccaeade9d39a3bb3d91d9a850725f4eebf2");
  assert.equal(receipt.media.width, 1080);
  assert.equal(receipt.media.height, 1920);
  assert.ok(receipt.media.durationSeconds > 24 && receipt.media.durationSeconds < 26);
  assert.equal(receipt.platforms.youtube?.status, "dry_run_validated");
  assert.equal(receipt.platforms.instagram?.status, "dry_run_validated");
  assert.equal(receipt.platforms.tiktok?.status, "dry_run_validated");
  assert.equal(receipt.platforms.twitter?.status, "dry_run_validated");

  const receiptPath = `${goldenVideo}.distribution.json`;
  assert.ok(existsSync(receiptPath), "Receipt file should be created");
  unlinkSync(receiptPath);
});

test("publish.mjs rejects missing media file", async () => {
  const missingMedia = path.join(rootDir, "goldens/non-existent.mp4");
  await assert.rejects(
    async () => {
      await publish(["--dry-run", distributionInput, missingMedia]);
    },
    /Media file not found/
  );
});

test("publish.mjs enforces platform character constraints", async () => {
  const invalidInput = {
    platforms: {
      twitter: {
        text: "x".repeat(281),
      },
    },
  };
  const tempConfig = path.join(rootDir, "inputs/.invalid-distribution.json");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(tempConfig, JSON.stringify(invalidInput));

  try {
    await assert.rejects(
      async () => {
        await publish(["--dry-run", tempConfig, goldenVideo]);
      },
      /Distribution validation failed/
    );
  } finally {
    if (existsSync(tempConfig)) {
      unlinkSync(tempConfig);
    }
  }
});

test("publish.mjs generates unconfigured_environment receipt without BUFFER_API_KEY", async () => {
  const originalKey = process.env.BUFFER_API_KEY;
  delete process.env.BUFFER_API_KEY;
  try {
    const receipt = await publish([distributionInput, goldenVideo]);
    assert.equal(receipt.platforms.youtube?.status, "unconfigured_environment");
    assert.match(receipt.platforms.youtube?.error, /BUFFER_API_KEY not configured/);
    const receiptPath = `${goldenVideo}.distribution.json`;
    if (existsSync(receiptPath)) {
      unlinkSync(receiptPath);
    }
  } finally {
    if (originalKey) {
      process.env.BUFFER_API_KEY = originalKey;
    }
  }
});
