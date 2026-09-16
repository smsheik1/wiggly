import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { renderTextCardFrame } from "../runtime/text-card-renderer.mjs";
import { validateMultiShotPlan } from "../runtime/multi-shot-timeline.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("renderTextCardFrame renders text overlay over background buffer", async () => {
  const bgPath = path.join(root, "assets", "backgrounds", "sisters-room.png");
  const bgBuffer = await fs.readFile(bgPath);

  const renderedBuffer = await renderTextCardFrame({
    backgroundBuffer: bgBuffer,
    text: "Without her\nconstant help and encouragement.",
    highlights: [
      { phrase: "constant help", color: "#00b4d8" },
      { phrase: "encouragement.", color: "#b5179e" },
    ],
    width: 1280,
    height: 720,
  });

  assert(Buffer.isBuffer(renderedBuffer));
  const metadata = await sharp(renderedBuffer).metadata();
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 720);
  assert.equal(metadata.format, "png");
});

test("validateMultiShotPlan validates valid shot timeline and rejects gaps", async () => {
  const assets = JSON.parse(await fs.readFile(path.join(root, "assets.json"), "utf8"));
  const audioDurationSeconds = 5.0; // 120 frames at 24fps

  const validPlan = {
    schemaVersion: "shaz-multi-shot-v1",
    title: "Test multi shot",
    audioFile: "user-audio.wav",
    totalDurationFrames: 120,
    shots: [
      {
        id: "shot-1",
        shotType: "talk-to-camera",
        startFrame: 0,
        endFrameExclusive: 48,
        backgroundId: "sisters-room",
      },
      {
        id: "shot-2",
        shotType: "text-card",
        startFrame: 48,
        endFrameExclusive: 120,
        backgroundId: "sisters-room",
        text: "Without her constant help.",
        highlights: [{ phrase: "constant help", color: "#00b4d8" }],
      },
    ],
  };

  const validated = validateMultiShotPlan(validPlan, {
    audioDurationSeconds,
    defaultBackgroundId: "sisters-room",
    assets,
  });

  assert.equal(validated.totalFrames, 120);
  assert.equal(validated.shots.length, 2);

  // Reject timeline with gap between shot 1 and 2
  const gappedPlan = {
    ...validPlan,
    shots: [
      validPlan.shots[0],
      {
        ...validPlan.shots[1],
        startFrame: 50, // gap of 2 frames!
      },
    ],
  };

  assert.throws(() => {
    validateMultiShotPlan(gappedPlan, {
      audioDurationSeconds,
      defaultBackgroundId: "sisters-room",
      assets,
    });
  }, /must equal preceding shot end frame/);
});

test("registered pop SFX asset exists and matches its asset registry sha256", async () => {
  const assets = JSON.parse(await fs.readFile(path.join(root, "assets.json"), "utf8"));
  const popAsset = (assets.sfx ?? []).find(({ id }) => id === "pop");
  assert.ok(popAsset, "pop sound effect must be registered in assets.json");
  const popPath = path.join(root, popAsset.path);
  const exists = await fs.stat(popPath).then(() => true).catch(() => false);
  assert.equal(exists, true, "pop.wav file must exist in assets/audio/sfx");
  const bytes = await fs.readFile(popPath);
  const sha = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha, popAsset.sha256, "pop.wav sha256 must match registered sha");
});

