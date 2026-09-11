import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProgressHud, formatAsciiBar } from "../runtime/hud.mjs";

test("formatAsciiBar generates accurate progress bars", () => {
  assert.equal(formatAsciiBar(0, 10), "░░░░░░░░░░");
  assert.equal(formatAsciiBar(50, 10), "█████░░░░░");
  assert.equal(formatAsciiBar(100, 10), "██████████");
});

test("createProgressHud writes progress.json and progress.html synchronously", () => {
  const tmpDir = path.join(os.tmpdir(), `hud-test-${Date.now()}`);
  try {
    const hud = createProgressHud({
      title: "TEST WIGGLY",
      targetSlug: "test-slug",
      rootDir: tmpDir,
      totalStages: 5
    });

    hud.update({
      stageIndex: 2,
      totalStages: 5,
      stageName: "Synthesizing voiceover",
      percent: 40,
      currentFrame: 400,
      totalFrames: 1000,
      etaSeconds: 12
    });

    const jsonPath = path.join(tmpDir, "progress.json");
    const htmlPath = path.join(tmpDir, "progress.html");

    assert.ok(existsSync(jsonPath), "progress.json was created");
    assert.ok(existsSync(htmlPath), "progress.html was created");

    const json = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(json.percent, 40);
    assert.equal(json.stageIndex, 2);
    assert.equal(json.stageName, "Synthesizing voiceover");
    assert.equal(json.status, "rendering");

    const html = readFileSync(htmlPath, "utf8");
    assert.ok(html.includes("40%"));
    assert.ok(html.includes("TEST WIGGLY"));

    // Finish
    hud.finish({
      videoPath: "outputs/test.mp4",
      durationSeconds: 15.5
    });

    const finishedJson = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(finishedJson.status, "completed");
    assert.equal(finishedJson.percent, 100);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
