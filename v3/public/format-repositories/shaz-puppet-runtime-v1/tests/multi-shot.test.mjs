import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { renderTextCardFrame } from "../runtime/text-card-renderer.mjs";
import {
  analyzeSentenceSemantics,
  deriveMultiShotPlan,
  validateMultiShotPlan,
} from "../runtime/multi-shot-timeline.mjs";

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

test("analyzeSentenceSemantics detects themes, icons, and chibi reaction poses", () => {
  const burger = analyzeSentenceSemantics("She made free burgers for us");
  assert.equal(burger.theme, "warm-red");
  assert.equal(burger.icon, "burger");
  assert.equal(burger.badge, "HOMEMADE");
  assert.equal(burger.chibiPose, "talk-laugh");

  const puppy = analyzeSentenceSemantics("Having a puppy is way harder than it looks");
  assert.equal(puppy.theme, "cold-blue");
  assert.equal(puppy.icon, "puppy");
  assert.equal(puppy.badge, "REALITY CHECK");
  assert.equal(puppy.chibiPose, "think-down");

  const rule = analyzeSentenceSemantics("The golden rule of dog training");
  assert.equal(rule.theme, "emerald-green");
  assert.equal(rule.icon, "trophy");
  assert.equal(rule.badge, "THE GOLDEN RULE");
  assert.equal(rule.chibiPose, "celebrate");
});

test("deriveMultiShotPlan creates a complete, valid multi-shot plan from transcript", async () => {
  const assets = JSON.parse(await fs.readFile(path.join(root, "assets.json"), "utf8"));
  const sampleTranscript = {
    text: "Hey guys! Today I brought friends over for food. It turns out having a puppy is way harder than it looks. A dog is only as well trained as the least disciplined person.",
    words: [
      { id: "w0001", text: "Hey", startMs: 0, endMs: 400 },
      { id: "w0002", text: "guys!", startMs: 450, endMs: 900 },
      { id: "w0003", text: "Today", startMs: 1000, endMs: 1400 },
      { id: "w0004", text: "I", startMs: 1450, endMs: 1600 },
      { id: "w0005", text: "brought", startMs: 1650, endMs: 2000 },
      { id: "w0006", text: "friends", startMs: 2050, endMs: 2400 },
      { id: "w0007", text: "over", startMs: 2450, endMs: 2800 },
      { id: "w0008", text: "for", startMs: 2850, endMs: 3100 },
      { id: "w0009", text: "food.", startMs: 3150, endMs: 3800 },
      { id: "w0010", text: "It", startMs: 4200, endMs: 4400 },
      { id: "w0011", text: "turns", startMs: 4450, endMs: 4800 },
      { id: "w0012", text: "out", startMs: 4850, endMs: 5100 },
      { id: "w0013", text: "having", startMs: 5150, endMs: 5500 },
      { id: "w0014", text: "a", startMs: 5550, endMs: 5700 },
      { id: "w0015", text: "puppy", startMs: 5750, endMs: 6200 },
      { id: "w0016", text: "is", startMs: 6250, endMs: 6400 },
      { id: "w0017", text: "way", startMs: 6450, endMs: 6700 },
      { id: "w0018", text: "harder", startMs: 6750, endMs: 7200 },
      { id: "w0019", text: "than", startMs: 7250, endMs: 7500 },
      { id: "w0020", text: "it", startMs: 7550, endMs: 7700 },
      { id: "w0021", text: "looks.", startMs: 7750, endMs: 8200 },
      { id: "w0022", text: "A", startMs: 8500, endMs: 8700 },
      { id: "w0023", text: "dog", startMs: 8750, endMs: 9100 },
      { id: "w0024", text: "is", startMs: 9150, endMs: 9300 },
      { id: "w0025", text: "only", startMs: 9350, endMs: 9600 },
      { id: "w0026", text: "as", startMs: 9650, endMs: 9800 },
      { id: "w0027", text: "well", startMs: 9850, endMs: 10100 },
      { id: "w0028", text: "trained.", startMs: 10150, endMs: 10800 },
    ],
  };

  const audioDurationSeconds = 11.0; // 264 frames
  const plan = deriveMultiShotPlan({
    transcript: sampleTranscript,
    audioDurationSeconds,
    defaultBackgroundId: "sisters-room",
  });

  assert.equal(plan.schemaVersion, "shaz-multi-shot-v1");
  assert.equal(plan.totalDurationFrames, 264);
  assert.ok(plan.shots.length >= 2, "must generate at least 2 shots");

  // Validate that the derived plan passes official validateMultiShotPlan with zero errors!
  const validated = validateMultiShotPlan(plan, {
    audioDurationSeconds,
    defaultBackgroundId: "sisters-room",
    assets,
    transcript: sampleTranscript,
  });

  assert.equal(validated.totalFrames, 264);
  assert.equal(validated.shots.length, plan.shots.length);
  // Verify shot 1 is talk-to-camera
  assert.equal(validated.shots[0].shotType, "talk-to-camera");
  // Verify subsequent shots have chibi-commentary or text-card with valid cards/highlights
  const chibiShot = validated.shots.find((s) => s.shotType === "chibi-commentary");
  if (chibiShot) {
    assert.ok(chibiShot.card);
    assert.ok(chibiShot.card.badge);
    assert.ok(chibiShot.card.headline);
    assert.ok(chibiShot.card.theme);
    assert.ok(chibiShot.card.icon);
  }
});


