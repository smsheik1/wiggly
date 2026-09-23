import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { sampleControlKeys } from "../runtime/pose-recipe.mjs";
import { loadManifest } from "../runtime/rig-v2-renderer.mjs";
import { buildArmsCrossedSkeptical } from "../poses/generated/sources/arms-crossed-skeptical.mjs";
import { buildFacepalmFrustrated } from "../poses/generated/sources/facepalm-frustrated.mjs";
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

test("facepalm uses the front hand channel for complete face coverage", async () => {
  const pose = await load("facepalm-frustrated");
  assert.equal(pose.durationFrames, 36);
  assert.deepEqual(pose.props ?? [], [], "face coverage must come from a rig hand, not a prop");
  assert.deepEqual(pose.drawings.Mouth, [
    { frame: 1, drawing: "3" },
    { frame: 7, drawing: "6" },
  ]);
  assert.deepEqual(pose.drawings.Left_Hand.at(-1), { frame: 13, drawing: null });
  assert.deepEqual(pose.drawings.OL_Hand, [
    { frame: 1, drawing: null },
    { frame: 13, drawing: "1" },
    { frame: 16, drawing: "2" },
  ]);
  assert.equal(pose.quality.overlayHandSleeveOwner, "Left",
    "the front-painted palm must remain visibly matted to the raised left sleeve");
  for (const key of pose.controls["OL_Hand-P"].filter(({ frame }) => frame >= 16)) {
    assert.ok(key.scale[0] <= 0.421 && key.scale[1] <= 0.421);
    assert.ok(key.rotation >= 98 && key.rotation <= 108);
  }
  assert.deepEqual(pose.drawings.Right_Hand, [{ frame: 1, drawing: "1" }],
    "off-hand must remain in drawing 1 throughout to prevent amputated sleeve tuck");
  assert.ok(Math.abs(pose.controls["Shaz_Master-P"][0].scale[0] - 1.0) < 0.01,
    "Shaz_Master-P scale must be 1.0 per Rule 11");
});

test("front facepalm palm is a provenance-locked alias of an existing rig drawing", async () => {
  const [manifest, receipt] = await Promise.all([
    loadManifest(new URL("../rig-v2/runtime.json", import.meta.url)),
    fs.readFile(new URL("../rig-v2/assets/receipt.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const overlayElement = manifest.elements.find(({ name }) => name === "OL_Hand");
  assert.deepEqual(overlayElement.drawings, ["1", "2"]);

  const byName = new Map(receipt.assets.map((asset) => [asset.filename, asset]));
  for (const suffix of ["", "--color"]) {
    const alias = byName.get(`ol-hand-02${suffix}.png`);
    const source = byName.get(`right-hand-11${suffix}.png`);
    assert.equal(alias.source, "elements/Right_Hand/Right_Hand-11.tvg");
    assert.equal(alias.sourceSha256, source.sourceSha256);
    assert.equal(alias.outputSha256, source.outputSha256);
    assert.deepEqual(alias.canvas, source.canvas);
    assert.deepEqual(alias.modelOrigin, source.modelOrigin);
  }
});

test("facepalm generator exactly reproduces the registered recipe", async () => {
  const [manifest, checkedIn] = await Promise.all([
    loadManifest(new URL("../rig-v2/runtime.json", import.meta.url)),
    load("facepalm-frustrated"),
  ]);
  assert.deepEqual(await buildFacepalmFrustrated(manifest), checkedIn);
});

test("crossed arms use one exact pose drawing only after native anticipation", async () => {
  const pose = await load("arms-crossed-skeptical");
  assert.equal(pose.quality.armCompositeMode, "registered-pose-replacement");
  assert.equal(pose.quality.armPaintOrder, undefined);
  assert.equal(pose.props.length, 1);
  assert.deepEqual(pose.props[0], {
    id: "crossed-arms-pose",
    asset: "crossed-arms-pose.png",
    sha256: "73e73755a77822989fd466ab6fe79591b176bbe9ea68940a46359c999a84e311",
    layer: "body-front",
    keys: [
      { frame: 1, position: [0.41796875, 0.621875], width: 0.2578125, rotation: 0, opacity: 0, interpolation: "hold" },
      { frame: 10, position: [0.41796875, 0.621875], width: 0.2578125, rotation: 0, opacity: 100, interpolation: "hold" },
      { frame: 19, position: [0.41796875, 0.621875], width: 0.2578125, rotation: 0, opacity: 100, interpolation: "hold" },
    ],
  });
  for (const nodeName of [
    "Left_Arm", "Left_Forearm", "Left_Hand",
    "Right_Arm", "Right_Forearm", "Right_Hand",
  ]) {
    assert.deepEqual(pose.drawings[nodeName].at(-1), { frame: 10, drawing: null },
      `${nodeName} must switch off on the exact replacement frame`);
  }
  assert.equal(pose.drawings.Left_Eye.at(-1).drawing, "2");
  assert.equal(pose.drawings.Right_Eye.at(-1).drawing, "2");
});

test("crossed arms cannot regress to the rejected full-canvas assembly", async () => {
  const pose = await load("arms-crossed-skeptical");
  assert.equal(pose.quality.armCompositeMode === "registered-crossed-rig-assembly", false);
  assert.equal((pose.props ?? []).some(({ id }) => id === "crossed-arms-assembly"), false);
  assert.equal(pose.props[0].asset, "crossed-arms-pose.png");
  assert.ok(pose.props[0].keys.every(({ width }) => width === 0.2578125),
    "the registered drawing must remain a tight arm-only asset, not a full-frame character replacement");
  assert.equal(JSON.stringify(pose).includes('"scale":[1.6,1.6]'), false,
    "the rejected 1.6x full-canvas assembly calibration must not return through recipe data");
});

test("arms-crossed generator exactly reproduces the registered recipe", async () => {
  const [manifest, checkedIn] = await Promise.all([
    loadManifest(new URL("../rig-v2/runtime.json", import.meta.url)),
    load("arms-crossed-skeptical"),
  ]);
  assert.deepEqual(await buildArmsCrossedSkeptical(manifest), checkedIn);
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
