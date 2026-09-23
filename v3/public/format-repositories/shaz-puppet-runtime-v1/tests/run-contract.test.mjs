import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateInput } from "../runtime/run-common.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const pose = (id, durationFrames = 24) => ({ id, recipe: { durationFrames } });
const registry = { byId: new Map([
  ["think", pose("think")],
  ["aha", pose("aha", 30)],
]) };

test("sequence validation resolves registered poses and exact timeline frames", () => {
  const result = validateInput({
    schemaVersion: "shaz-sequence-input-v1",
    title: "Thought to realization",
    sequence: [
      { poseId: "think", holdFrames: 8, gapFrames: 3 },
      { poseId: "aha", holdFrames: 12, gapFrames: 0 },
    ],
  }, registry);
  assert.equal(result.totalFrames, 77);
  assert.equal(result.durationSeconds, 77 / 24);
});

test("sequence validation makes actions contiguous unless a separator is explicit", () => {
  const result = validateInput({
    schemaVersion: "shaz-sequence-input-v1",
    title: "Seamless sequence",
    sequence: [
      { poseId: "think", holdFrames: 0 },
      { poseId: "aha", holdFrames: 0 },
    ],
  }, registry);
  assert.deepEqual(result.entries.map(({ gapFrames }) => gapFrames), [0, 0]);
  assert.equal(result.totalFrames, 54);
});

test("sequence validation rejects unregistered pose paths", () => {
  assert.throws(() => validateInput({
    schemaVersion: "shaz-sequence-input-v1",
    title: "Bypass",
    sequence: [{ poseId: "../poses/private.json", gapFrames: 0 }],
  }, registry), /unknown pose/);
});

test("sequence validation rejects a trailing separator", () => {
  assert.throws(() => validateInput({
    schemaVersion: "shaz-sequence-input-v1",
    title: "Trailing gap",
    sequence: [{ poseId: "think", gapFrames: 3 }],
  }, registry), /final sequence entry/);
});

test("sequence validation rejects unsupported fields", () => {
  assert.throws(() => validateInput({
    schemaVersion: "shaz-sequence-input-v1",
    title: "Hidden fallback",
    sequence: [{ poseId: "think", gapFrames: 0, renderer: "fallback" }],
  }, registry), /unsupported key/);
});

test("packaged skill protects the one-action learning loop", async () => {
  const [skill, playbook] = await Promise.all([
    fs.readFile(path.join(root, "SKILL.md"), "utf8"),
    fs.readFile(path.join(root, "references", "rig-animation-playbook.md"), "utf8"),
  ]);
  const learningQuestion = "What did this teach us, and does the skill, runtime, or test suite need updating?";
  assert.match(skill, /Skill version: \*\*2\.0\*\*/);
  assert.match(skill, /Do not repair several unapproved actions at once/);
  assert.ok(skill.includes(learningQuestion));
  assert.match(skill, /references\/rig-animation-playbook\.md/);
  assert.match(skill, /normal speed[\s\S]*Slow motion is useful for diagnosis/);
  assert.match(skill, /stepped exposure/);
  assert.ok(playbook.includes(learningQuestion));
  assert.match(playbook, /Mechanical invariant/);
  assert.match(playbook, /animate multiple uncertified actions/);
  assert.match(playbook, /slow motion is diagnostic only/);
  assert.match(playbook, /exposure-change frames/);
  assert.match(playbook, /shoulder-to-finished-sleeve-to-hand/);
  assert.match(playbook, /three bounded native-rig candidates/);
  assert.match(playbook, /asset ID, path, bytes, normalized transform, opacity timing, and paint layer are exact-locked/);
  assert.match(playbook, /every corresponding native arm, forearm, and hand drawing becomes invisible/);
  assert.match(playbook, /cuff.*ownership|sleeve.*ownership/i);
  assert.match(skill, /one coherent part-specific drawing/);
  assert.match(skill, /never overlap visible native counterparts/);
  assert.match(skill, /sequencePreset: "talk-to-camera"/);
  assert.match(skill, /Do not invent a pose or calculate frames/);
  assert.match(skill, /Use Talk to Camera for unaccented speech/);
  assert.match(skill, /neutral-listening/);
  assert.match(skill, /sisters-room.*living-room.*map-photo-zone.*pure-white/);
  assert.match(skill, /reserved for future supporting media/);
  assert.match(skill, /Registered means runnable\. It does not mean creatively approved\./);
  assert.match(skill, /npm run transcribe/);
  assert.match(skill, /planningTranscriptSha256/);
  assert.match(skill, /wordId/);
  assert.match(skill, /never upload the audio to Deepgram/);
  assert.match(skill, /neutral-listening[\s\S]*present[\s\S]*think[\s\S]*aha[\s\S]*point[\s\S]*confident/);
  assert.match(skill, /shrug[\s\S]*key-point[\s\S]*excited-celebration[\s\S]*point-at-screen[\s\S]*facepalm-frustrated[\s\S]*arms-crossed-skeptical[\s\S]*chin-stroke-swagger/);
});

test("Talk to Camera remains a preset alias over the one registered neutral body", async () => {
  const [fixture, poseIndex, readme, inputContract] = await Promise.all([
    fs.readFile(path.join(root, "fixtures", "talk-to-camera", "input.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(root, "poses", "index.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(root, "README.md"), "utf8"),
    fs.readFile(path.join(root, "input-contract.json"), "utf8").then(JSON.parse),
  ]);

  assert.equal(fixture.sequencePreset, "talk-to-camera");
  assert.equal(fixture.sequence, undefined);
  assert.equal(fixture.durationFrames, undefined);
  assert.equal(poseIndex.poses.length, 13);
  assert.ok(poseIndex.poses.some(({ id }) => id === "neutral-listening"));
  assert.ok(!poseIndex.poses.some(({ id }) => id === "talk-to-camera"));
  assert.match(readme, /## Talk to Camera/);
  assert.match(readme, /composition preset, not a new pose recipe|adds no body keys/);
  assert.match(readme, /Registered means runnable, not creatively approved\./);
  assert.equal(inputContract.properties.sequencePreset.const, "talk-to-camera");
  assert.equal(inputContract.properties.durationFrames.userSupplied, false);
});

test("build kit excludes runtime outputs and packages only registered prop assets", async () => {
  const [buildKit, manifest] = await Promise.all([
    fs.readFile(path.join(root, "build-kit.mjs"), "utf8"),
    fs.readFile(path.join(root, "KIT-MANIFEST.json"), "utf8").then(JSON.parse),
  ]);
  assert.match(buildKit, /if \(parts\[0\] === "downloads"\) return false;/);
  assert.doesNotMatch(buildKit, /parts\[0\] === "downloads"[^\n]*parts\.length/);
  assert.match(buildKit, /parts\[0\] === "goldens" \|\| relative === "goldens\.json"/);
  assert.match(buildKit, /excludedNames = new Set\(\["node_modules", "\.runtime-cache"/);
  assert.match(buildKit, /evidence\/local-transcription-sealed-receipt\.md/);
  assert.equal(
    (await fs.readFile(path.join(root, ".gitignore"), "utf8")).includes("/.runtime-cache/"),
    true,
  );
  assert.match(buildKit, /new Set\(\["phone\.svg", "crossed-arms-pose\.png"\]\)/);
  assert.match(buildKit, /!packagedPropFiles\.has/);
  assert.match(buildKit, /commands: \["check", "inspect:registry", "smoke", "transcribe"/);
  assert.ok(manifest.commands.includes("inspect:registry"));
  assert.ok(manifest.commands.includes("transcribe"));
});

test("packaged smoke uses only the reviewed gesture set", async () => {
  const smoke = JSON.parse(await fs.readFile(path.join(root, "fixtures", "smoke", "input.json"), "utf8"));
  const safePoseIds = new Set(["neutral-listening", "present", "think", "aha", "point", "confident"]);
  assert.ok(
    smoke.sequence.every(({ poseId }) => safePoseIds.has(poseId)),
    "the downloadable smoke must not showcase a pose that still needs creative review",
  );
});

test("full Point cancels demo-shot motion at the master and preserves artist exposure cadence", async () => {
  const point = JSON.parse(await fs.readFile(
    path.join(root, "poses", "authored", "point.json"),
    "utf8",
  ));
  const rigX = point.controls["Shaz_Rig-P"].map(({ position }) => position[0]);
  assert.ok(Math.max(...rigX) - Math.min(...rigX) > 0.8, "the torso branch must retain its authored motion");
  assert.equal(point.authoringCorrections[0].control, "Shaz_Master-P");
  assert.equal(point.authoringCorrections[0].operation, "inverse-linear-stage-registration");
  assert.match(point.authoringCorrections[0].reason, /torso, head, arms, and hands/);
  assert.equal(point.authoringCorrections[1].operation, "artist-authored-step-exposures");

  const changeFrames = [1, 3, 5, 7, 9, 11, 37, 39, 40, 42, 44, 46, 56, 58, 60, 62, 64, 68, 70, 72, 74, 76];
  assert.deepEqual(point.quality.sourceExposureChangeFrames, changeFrames);
  assert.equal(point.quality.maximumIdenticalFrames, 26);
  assert.deepEqual(
    point.quality.sourceApprovedHolds.map(({ startFrame, endFrame }) => [startFrame, endFrame]),
    [[11, 36], [46, 55]],
  );

  for (const [control, keys] of Object.entries(point.controls)) {
    assert.deepEqual(keys.map(({ frame }) => frame), changeFrames, `${control} must use the certified exposure changes`);
    assert.ok(keys.every(({ interpolation }) => interpolation === "hold"), `${control} must not invent in-betweens`);
  }

  let currentChange = 1;
  const expectedDeformationFrames = Array.from({ length: point.durationFrames }, (_, index) => {
    const frame = index + 1;
    if (changeFrames.includes(frame)) currentChange = frame;
    return 188 + currentChange;
  });
  assert.deepEqual(point.deformationFrames, expectedDeformationFrames);
});

test("Confident preserves its source-proven on-twos exposure cadence", async () => {
  const confident = JSON.parse(await fs.readFile(
    path.join(root, "poses", "authored", "confident.json"),
    "utf8",
  ));
  const changeFrames = [1, 3, 5, 7, 9, 11, 13];
  assert.deepEqual(confident.quality.sourceExposureChangeFrames, changeFrames);
  assert.equal(confident.quality.maximumIdenticalFrames, 2);
  assert.equal(
    confident.authoringCorrections[0].operation,
    "artist-authored-step-exposures",
  );

  for (const [control, keys] of Object.entries(confident.controls)) {
    assert.deepEqual(
      keys.map(({ frame }) => frame),
      changeFrames,
      `${control} must use only the certified exposure changes`,
    );
    assert.ok(
      keys.every(({ interpolation }) => interpolation === "hold"),
      `${control} must not invent in-betweens`,
    );
  }

  let currentChange = 1;
  const expectedDeformationFrames = Array.from(
    { length: confident.durationFrames },
    (_, index) => {
      const frame = index + 1;
      if (changeFrames.includes(frame)) currentChange = frame;
      return 286 + currentChange;
    },
  );
  assert.deepEqual(confident.deformationFrames, expectedDeformationFrames);
});
