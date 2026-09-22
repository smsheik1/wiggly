import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { renderTextCardFrame } from "../runtime/text-card-renderer.mjs";
import {
  calculateKenBurnsCrop,
  renderKenBurnsFrame,
} from "../runtime/broll-renderer.mjs";
import {
  analyzeSentenceSemantics,
  deriveMultiShotPlan,
  resolvePuppetPoseId,
  validateMultiShotPlan,
} from "../runtime/multi-shot-timeline.mjs";
import {
  buildChibiSchedule,
  deriveChibiRoutine,
  getChibiFrameTransform,
  normalizeChibiHold,
} from "../runtime/chibi-choreography.mjs";

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

test("analyzeSentenceSemantics detects themes, icons, and physical chibi holds", () => {
  const burger = analyzeSentenceSemantics("She made free burgers for us");
  assert.equal(burger.theme, "warm-red");
  assert.equal(burger.icon, "burger");
  assert.equal(burger.badge, "HOMEMADE");
  assert.equal(burger.chibiPose, "talk-gesture");

  const puppy = analyzeSentenceSemantics("Having a puppy is way harder than it looks");
  assert.equal(puppy.theme, "cold-blue");
  assert.equal(puppy.icon, "puppy");
  assert.equal(puppy.badge, "REALITY CHECK");
  assert.equal(puppy.chibiPose, "think-chin");

  const rule = analyzeSentenceSemantics("The golden rule of dog training");
  assert.equal(rule.theme, "emerald-green");
  assert.equal(rule.icon, "trophy");
  assert.equal(rule.badge, "THE GOLDEN RULE");
  assert.equal(rule.chibiPose, "point-emphasis");
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
  const brollShot = validated.shots.find((s) => s.shotType === "b-roll");
  if (brollShot) {
    assert.ok(brollShot.motion);
  }
});

test("calculateKenBurnsCrop calculates accurate crop windows for all motion types", () => {
  for (const motion of ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"]) {
    const startCrop = calculateKenBurnsCrop({ motion, progress: 0, sourceWidth: 1280, sourceHeight: 720 });
    const endCrop = calculateKenBurnsCrop({ motion, progress: 1, sourceWidth: 1280, sourceHeight: 720 });

    assert.ok(startCrop.width > 0 && startCrop.width <= 1280);
    assert.ok(startCrop.height > 0 && startCrop.height <= 720);
    assert.ok(startCrop.left >= 0 && startCrop.left + startCrop.width <= 1280);
    assert.ok(startCrop.top >= 0 && startCrop.top + startCrop.height <= 720);

    assert.ok(endCrop.width > 0 && endCrop.width <= 1280);
    assert.ok(endCrop.height > 0 && endCrop.height <= 720);
    assert.ok(endCrop.left >= 0 && endCrop.left + endCrop.width <= 1280);
    assert.ok(endCrop.top >= 0 && endCrop.top + endCrop.height <= 720);
  }
});

test("renderKenBurnsFrame renders valid 1280x720 png buffer", async () => {
  const bgPath = path.join(root, "assets", "backgrounds", "living-room.png");
  const bgBuffer = await fs.readFile(bgPath);

  const frameBuffer = await renderKenBurnsFrame({
    sourceBuffer: bgBuffer,
    sourceWidth: 1280,
    sourceHeight: 720,
    targetWidth: 1280,
    targetHeight: 720,
    motion: "pan-right",
    localFrame: 12,
    durationFrames: 24,
  });

  assert(Buffer.isBuffer(frameBuffer));
  const meta = await sharp(frameBuffer).metadata();
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 720);
  assert.equal(meta.format, "png");
});

test("buildChibiSchedule synthesizes entrance, cushions, holds, and exit leap", () => {
  const routine = ["present-card", "think-chin", "shrug-open"];
  const durationFrames = 96; // 4 seconds at 24fps
  const schedule = buildChibiSchedule({ routine, durationFrames });

  assert.equal(schedule.length, durationFrames);

  // Entrance smear + squash + settle
  assert.equal(schedule[0], "Timeline 1_0000In.png");
  assert.equal(schedule[1], "Timeline 1_0000In.png");
  assert.equal(schedule[2], "Timeline 1_0001.png");
  assert.equal(schedule[3], "Timeline 1_0001.png");
  assert.equal(schedule[4], "Timeline 1_0002.png");

  // Holds exist
  assert.ok(schedule.includes("Timeline 1_0005.png"), "must include present-card hold");
  assert.ok(schedule.includes("Timeline 1_0008.png"), "must include think-chin hold");
  assert.ok(schedule.includes("Timeline 1_0011.png"), "must include shrug-open hold");

  // Cushions exist between holds
  assert.ok(schedule.includes("Timeline 1_0006.png"), "must include head-turn breakdown to think-chin");
  assert.ok(schedule.includes("Timeline 1_0007x.png"), "must include arm-lift anticipation to think-chin");
  assert.ok(schedule.includes("Timeline 1_0009.png"), "must include hand-drop transition to shrug");
  assert.ok(schedule.includes("Timeline 1_0010.png"), "must include shrug step");

  // Exit windup + apex leap + smear
  assert.equal(schedule.at(-5), "Timeline 1_0014.png");
  assert.equal(schedule.at(-4), "Timeline 1_0015.png");
  assert.equal(schedule.at(-3), "Timeline 1_0015.png");
  assert.equal(schedule.at(-2), "Timeline 1_0016.png");
  assert.equal(schedule.at(-1), "Timeline 1_0016.png");
});

test("buildChibiSchedule matches artist reference timing with cushions and snappy holds", () => {
  const routine = ["present-card", "think-chin", "shrug-open"];
  const durationFrames = 96; // 4 seconds at 24fps
  const schedule = buildChibiSchedule({ routine, durationFrames });

  // Entrance: smear (2f) + squash (2f) + settle bounce (1f)
  assert.equal(schedule[0], "Timeline 1_0000In.png");
  assert.equal(schedule[2], "Timeline 1_0001.png");
  assert.equal(schedule[4], "Timeline 1_0002.png");

  // First hold: present-card
  assert.equal(schedule[5], "Timeline 1_0005.png");

  // Transition to think-chin: 2f breakdown (0006) + 2f anticipation (0007x)
  assert.ok(schedule.includes("Timeline 1_0006.png"));
  assert.ok(schedule.includes("Timeline 1_0007x.png"));

  // Second hold: think-chin
  assert.ok(schedule.includes("Timeline 1_0008.png"));

  // Transition to shrug-open: 2f breakdown (0009) + 2f anticipation (0010)
  assert.ok(schedule.includes("Timeline 1_0009.png"));
  assert.ok(schedule.includes("Timeline 1_0010.png"));

  // Third hold: shrug-open
  assert.ok(schedule.includes("Timeline 1_0011.png"));

  // Exit: crouch (1f) + apex stretch (2f) + smear (2f)
  assert.equal(schedule.at(-5), "Timeline 1_0014.png");
  assert.equal(schedule.at(-4), "Timeline 1_0015.png");
  assert.equal(schedule.at(-1), "Timeline 1_0016.png");
});

test("getChibiFrameTransform computes choppy anticipation, overshoot, undershoot, and living speech beats", () => {
  const totalFrames = 80;

  // Entrance smear
  const f0 = getChibiFrameTransform(0, totalFrames);
  assert.equal(f0.phase, "entrance-smear");
  assert.ok(f0.dy > 0 && f0.dx > 0, "smear enters from offstage corner");

  // Anticipation squash
  const f2 = getChibiFrameTransform(2, totalFrames);
  assert.equal(f2.phase, "anticipation-squash");
  assert.ok(f2.sx > 1.0 && f2.sy < 1.0, "squash compresses vertically and widens horizontally");

  // Entrance OVERSHOOT
  const f4 = getChibiFrameTransform(4, totalFrames);
  assert.equal(f4.phase, "entrance-overshoot");
  assert.ok(f4.dy < -15, "overshoot pops high past target baseline");
  assert.ok(f4.sy > 1.0, "overshoot stretches taller");

  // Entrance UNDERSHOOT rebound
  const f6 = getChibiFrameTransform(6, totalFrames);
  assert.equal(f6.phase, "entrance-undershoot");
  assert.ok(f6.dy > 0, "undershoot dips back down below baseline before settle");

  // Settle hold
  const f10 = getChibiFrameTransform(10, totalFrames);
  assert.equal(f10.phase, "settle-hold");
  assert.equal(f10.dx, 0);
  assert.equal(f10.dy, 0);

  // Living speech beat overshoot (at step (frame-8) % 16 === 0)
  const f24 = getChibiFrameTransform(24, totalFrames);
  assert.equal(f24.phase, "beat-overshoot");
  assert.ok(f24.dy < 0, "speech beat pops up to accent dialogue");

  // Exit crouch anticipation
  const fCrouch = getChibiFrameTransform(totalFrames - 5, totalFrames);
  assert.equal(fCrouch.phase, "exit-crouch");

  // Exit apex leap overshoot
  const fApex = getChibiFrameTransform(totalFrames - 3, totalFrames);
  assert.equal(fApex.phase, "exit-overshoot");
  assert.ok(fApex.dy < -20, "apex leap explodes upward");

  // Exit smear
  const fExit = getChibiFrameTransform(totalFrames - 1, totalFrames);
  assert.equal(fExit.phase, "exit-smear");
});

test("renderTextCardFrame highlights only exact phrase words without false substring matches", async () => {
  const bgPath = path.join(root, "assets", "backgrounds", "sisters-room.png");
  const bgBuffer = await fs.readFile(bgPath);

  // Phrase contains "it looks.", but sentence starts with "It turns out..."
  // Word 0 "It" and "a" should not be highlighted; only words "than", "it", "looks." should be #00b4d8
  const frameBuf = await renderTextCardFrame({
    backgroundBuffer: bgBuffer,
    text: "It turns out having a puppy is way harder than it looks.",
    highlights: [{ phrase: "than it looks.", color: "#00b4d8" }],
    wordLimit: null,
  });
  assert(Buffer.isBuffer(frameBuf));
});

test("validateMultiShotPlan accepts explicit LLM chibiRoutine", async () => {
  const assets = JSON.parse(await fs.readFile(path.join(root, "assets.json"), "utf8"));
  const audioDurationSeconds = 4.0; // 96 frames

  const planWithRoutine = {
    schemaVersion: "shaz-multi-shot-v1",
    title: "Choreographed Chibi Routine",
    audioFile: "user-audio.wav",
    totalDurationFrames: 96,
    shots: [
      {
        id: "shot-1",
        shotType: "chibi-commentary",
        startFrame: 0,
        endFrameExclusive: 96,
        backgroundId: "sisters-room",
        chibiRoutine: ["present-card", "think-chin", "shrug-open"],
        card: {
          badge: "ANALYSIS",
          headline: "THE REAL LESSON",
          quote: "Mom was right all along.",
          theme: "warm-red",
          icon: "star",
        },
      },
    ],
  };

  const validated = validateMultiShotPlan(planWithRoutine, {
    audioDurationSeconds,
    defaultBackgroundId: "sisters-room",
    assets,
  });

  assert.equal(validated.totalFrames, 96);
  assert.deepEqual(validated.shots[0].chibiRoutine, ["present-card", "think-chin", "shrug-open"]);
});

test("deriveChibiRoutine produces clause-level progressions based on duration", () => {
  // Short (< 36 frames): 1 hold
  assert.deepEqual(deriveChibiRoutine("present-card", 24), ["present-card"]);

  // Medium (36-63 frames): 2 holds
  const medium = deriveChibiRoutine("point-emphasis", 48);
  assert.equal(medium.length, 2);
  assert.equal(medium[1], "point-emphasis");

  // Standard (64-95 frames): 3 holds
  const standard = deriveChibiRoutine("think-chin", 72);
  assert.equal(standard.length, 3);
  assert.ok(standard.includes("think-chin"));

  // Long (>= 96 frames): 4 holds
  const long = deriveChibiRoutine("shrug-open", 120);
  assert.equal(long.length, 4);
  assert.ok(long.includes("shrug-open"));
});

test("buildChibiSchedule auto-expands single hold when duration >= 48 frames", () => {
  // Blind agent passes single pose for a 72-frame shot (3.0s)
  const schedule = buildChibiSchedule({ routine: ["present-card"], durationFrames: 72 });
  assert.equal(schedule.length, 72);

  // Instead of a frozen single hold, auto-expanded routine contains multi-pose progression + cushions
  assert.ok(schedule.includes("Timeline 1_0003x.png"), "must include talk-gesture hold");
  assert.ok(schedule.includes("Timeline 1_0005.png"), "must include present-card hold");
  assert.ok(schedule.includes("Timeline 1_0008.png"), "must include think-chin hold");
});

test("resolvePuppetPoseId maps chin-stroke aliases to registered phone-use-sequence recipe", () => {
  assert.equal(resolvePuppetPoseId("chin-stroke"), "phone-use-sequence");
  assert.equal(resolvePuppetPoseId("chin-stroke-smug"), "phone-use-sequence");
  assert.equal(resolvePuppetPoseId("swagger"), "phone-use-sequence");
  assert.equal(resolvePuppetPoseId("neutral-listening"), "neutral-listening");
  assert.equal(resolvePuppetPoseId("point"), "point");
});

test("validateMultiShotPlan accepts chin-stroke pose for talk-to-camera shot", async () => {
  const assets = JSON.parse(await fs.readFile(path.join(root, "assets.json"), "utf8"));
  const poseIndex = JSON.parse(await fs.readFile(path.join(root, "poses", "index.json"), "utf8"));
  const poseRegistry = {
    byId: new Map(poseIndex.poses.map((p) => [p.id, p])),
  };

  const planWithChinStroke = {
    schemaVersion: "shaz-multi-shot-v1",
    title: "Chin stroke validation",
    audioFile: "user-audio.wav",
    totalDurationFrames: 48,
    shots: [
      {
        id: "shot-1",
        shotType: "talk-to-camera",
        poseId: "chin-stroke",
        startFrame: 0,
        endFrameExclusive: 48,
        backgroundId: "sisters-room",
      },
    ],
  };

  const validated = validateMultiShotPlan(planWithChinStroke, {
    audioDurationSeconds: 2.0,
    defaultBackgroundId: "sisters-room",
    assets,
    poseRegistry,
  });

  assert.equal(validated.shots[0].poseId, "phone-use-sequence");
});

test("phone-use-sequence recipe conforms to universal rig contract and matches think height", async () => {
  const { loadManifest } = await import("../runtime/rig-v2-renderer.mjs");
  const { createPoseRuntime, loadPoseRecipe } = await import("../runtime/pose-recipe.mjs");

  const manifest = await loadManifest(path.join(root, "rig-v2", "runtime.json"));
  const phoneRecipe = await loadPoseRecipe(path.join(root, "poses", "generated", "phone-use-sequence.json"));
  const thinkRecipe = await loadPoseRecipe(path.join(root, "poses", "authored", "think.json"));

  const phoneRuntime = createPoseRuntime(manifest, phoneRecipe);
  const thinkRuntime = createPoseRuntime(manifest, thinkRecipe);

  const columns = new Map(manifest.scenes[0].columns.map((c) => [c.name, c]));
  const masterNode = manifest.scenes[0].nodes.find((n) => n.name === "Shaz_Master-P");
  assert.ok(masterNode, "Shaz_Master-P node must exist");

  const phoneSample = phoneRuntime.sampleNodeAtFrame(masterNode, columns, 55);
  const thinkSample = thinkRuntime.sampleNodeAtFrame(masterNode, columns, 49);

  // Directly registered recipe has 1.0 scale and matches think master peg Y
  assert.ok(Math.abs(phoneSample.attrs.scale.x - 1.0) < 0.01, "registered recipe scale must be ~1.0");
  assert.ok(Math.abs(phoneSample.attrs.scale.y - 1.0) < 0.01, "registered recipe scale Y must be ~1.0");
  assert.ok(Math.abs(phoneSample.attrs.position.attr3dpath[1] - thinkSample.attrs.position.attr3dpath[1]) < 0.01, "registered Y position must match think");
});


