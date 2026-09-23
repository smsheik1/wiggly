import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { sampleControlKeys } from "../runtime/pose-recipe.mjs";
import { loadManifest } from "../runtime/rig-v2-renderer.mjs";
import { buildExcitedCelebration } from "../poses/generated/sources/excited-celebration.mjs";
import { buildChinStrokeSwagger } from "../poses/generated/sources/chin-stroke-swagger.mjs";
import { buildPointAtScreen } from "../poses/generated/sources/point-at-screen.mjs";

const load = async (name) => JSON.parse(await fs.readFile(
  new URL(`../poses/generated/${name}.json`, import.meta.url),
  "utf8",
));

const normalizedControlKeys = (keys) => keys.map(({
  frame,
  interpolation = "linear",
  ...state
}) => ({ frame, interpolation, state }));

test("chin-stroke-swagger generator exactly reproduces the registered recipe", async () => {
  const [manifest, checkedIn] = await Promise.all([
    loadManifest(new URL("../rig-v2/runtime.json", import.meta.url)),
    load("chin-stroke-swagger"),
  ]);
  assert.deepEqual(await buildChinStrokeSwagger(manifest), checkedIn);
});

test("chin-stroke-swagger preserves the prop-free swagger gesture on universal rig", async () => {
  const pose = await load("chin-stroke-swagger");
  assert.equal(pose.durationFrames, 55);
  assert.equal(pose.quality.armCompositeMode, "native-rig");
  assert.deepEqual(pose.props, [], "chin-stroke-swagger has no props");
  assert.ok(Math.abs(pose.controls["Shaz_Master-P"][0].scale[0] - 1.0) < 0.01, "Shaz_Master-P scale must be 1.0");
  assert.ok(Math.abs(pose.controls["Shaz_Master-P"][0].position[1]) < 0.01, "Shaz_Master-P position Y must be ~0.0");
});

test("point-at-screen points directly at stage-right OTS card zone", async () => {
  const pose = await load("point-at-screen");
  assert.equal(pose.durationFrames, 36);
  assert.deepEqual(pose.props ?? [], [], "the off-canvas target must not become a random screen prop");
  assert.equal(pose.controls["Shaz_Master-P"][0].flipHorizontal, false, "Shaz_Master-P must preserve universal unmirrored rig orientation");
  assert.equal(pose.drawings.Left_Hand.at(-1).drawing, "6", "Left_Hand must hold drawing 6 (native index point directed at OTS card)");
  assert.equal(pose.controls["Left_Arm_MOVE-P"].at(-1).frame, 36);
  assert.equal(pose.controls["Head_Movement-P"].at(-1).frame, 36);
});

test("point-at-screen generator exactly reproduces the registered recipe", async () => {
  const [manifest, checkedIn] = await Promise.all([
    loadManifest(new URL("../rig-v2/runtime.json", import.meta.url)),
    load("point-at-screen"),
  ]);
  assert.deepEqual(await buildPointAtScreen(manifest), checkedIn);
});

test("excited celebration preserves the full human-authored timing grammar once", async () => {
  const [pose, authoredShrug] = await Promise.all([
    load("excited-celebration"),
    JSON.parse(await fs.readFile(
      new URL("../poses/authored/shrug.json", import.meta.url),
      "utf8",
    )),
  ]);
  assert.equal(pose.durationFrames, 31);
  assert.equal(pose.quality.maximumIdenticalFrames, 3);
  assert.equal(pose.quality.armCompositeMode, "native-rig");
  assert.deepEqual(pose.props ?? [], []);
  assert.deepEqual(
    pose.deformationFrames,
    Array.from({ length: 31 }, (_, index) => 67 + index),
  );
  assert.deepEqual(
    pose.drawings.Left_Hand.map(({ frame }) => frame),
    [1, 3, 29, 30],
  );
  assert.deepEqual(
    pose.drawings.Left_Eye.map(({ frame }) => frame),
    [1, 3, 4, 25, 29],
  );

  const masterFrames = pose.controls["Shaz_Master-P"].map(({ frame }) => frame);
  assert.deepEqual(masterFrames, Array.from({ length: 31 }, (_, index) => index + 1));
  assert.equal(masterFrames.filter((frame) => frame === 4).length, 1);
  const retainedControls = Object.keys(pose.controls)
    .filter((name) => name !== "Left_Hand" && name !== "Right_Hand")
    .sort();
  assert.deepEqual(retainedControls, Object.keys(authoredShrug.controls).sort(),
    "the semantic variant must retain every secondary source control that keeps the hold alive");
  assert.equal(pose.drawings.Left_Hand.find(({ frame }) => frame === 3).drawing, "10");
  assert.equal(pose.drawings.Right_Hand.find(({ frame }) => frame === 3).drawing, "10");
  for (const nodeName of ["Left_Hand-P", "Right_Hand-P"]) {
    const authoredKeys = normalizedControlKeys(authoredShrug.controls[nodeName]);
    for (const { frame, interpolation, ...actualState } of pose.controls[nodeName]) {
      assert.deepEqual(actualState, sampleControlKeys(authoredKeys, frame),
        `${nodeName} frame ${frame} must keep the authored Shrug wrist state without fist enlargement`);
    }
  }
});

test("excited-celebration generator exactly reproduces the registered recipe", async () => {
  const [manifest, checkedIn] = await Promise.all([
    loadManifest(new URL("../rig-v2/runtime.json", import.meta.url)),
    load("excited-celebration"),
  ]);
  assert.deepEqual(buildExcitedCelebration(manifest), checkedIn);
});
