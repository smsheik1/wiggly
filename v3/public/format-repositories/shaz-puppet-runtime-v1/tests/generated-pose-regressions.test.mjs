import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { sampleControlKeys } from "../runtime/pose-recipe.mjs";
import { loadManifest } from "../runtime/rig-v2-renderer.mjs";
import { buildArmsCrossedSkeptical } from "../poses/generated/sources/arms-crossed-skeptical.mjs";
import { buildFacepalmFrustrated } from "../poses/generated/sources/facepalm-frustrated.mjs";
import { buildExcitedCelebration } from "../poses/generated/sources/excited-celebration.mjs";
import { buildLookAtPhone } from "../poses/generated/sources/look-at-phone.mjs";
import { buildPointAtScreen } from "../poses/generated/sources/point-at-screen.mjs";
import { buildPhoneUseSequence } from "../poses/generated/sources/phone-use-sequence.mjs";

const load = async (name) => JSON.parse(await fs.readFile(
  new URL(`../poses/generated/${name}.json`, import.meta.url),
  "utf8",
));

const normalizedControlKeys = (keys) => keys.map(({
  frame,
  interpolation = "linear",
  ...state
}) => ({ frame, interpolation, state }));

test("handheld props are established instead of appearing randomly", async () => {
  const phonePose = await load("look-at-phone");
  const phone = phonePose.props.find(({ id }) => id === "phone");
  assert.deepEqual(phonePose.props.map(({ id }) => id), ["phone"]);
  assert.equal(phone.keys[0].opacity, 100);
  assert.equal(phone.keys[0].interpolation, "hold", "phone must remain with the lowered hand until the pickup beat");
  assert.deepEqual(phone.keys[0].position, phone.keys.find(({ frame }) => frame === 7).position,
    "phone must remain with the lowered native hand until the lift begins");
  assert.ok(phone.keys[0].position[1] > phone.keys.at(-1).position[1], "phone must rise with the hand");
  assert.deepEqual(phonePose.drawings.OL_Hand.at(-1), { frame: 13, drawing: "1" });
  assert.equal(phonePose.props.some(({ id }) => /hand|arm|sleeve|fist/i.test(id)), false,
    "screen-space limb substitutes are forbidden");
  const settledPhone = phone.keys.at(-1).position;
  assert.ok(settledPhone[0] >= 0.4 && settledPhone[0] <= 0.45,
    "settled phone must remain outside the face while touching the native overlay hand");
  assert.equal(phonePose.quality.armCompositeMode, "native-rig");
});

test("look-at-phone generator exactly reproduces the registered recipe", async () => {
  const [manifest, checkedIn] = await Promise.all([
    loadManifest(new URL("../rig-v2/runtime.json", import.meta.url)),
    load("look-at-phone"),
  ]);
  assert.deepEqual(await buildLookAtPhone(manifest), checkedIn);
});

test("phone-use sequence preserves the native gesture without a literal phone", async () => {
  const pose = await load("phone-use-sequence");
  const base = await load("look-at-phone");
  assert.equal(pose.durationFrames, base.durationFrames);
  assert.equal(pose.quality.armCompositeMode, "native-rig");
  assert.deepEqual(base.props.map(({ id }) => id), ["phone"],
    "removing the phone from the sequence must not alter the registered look-at-phone action");
  assert.deepEqual(pose.props, [],
    "the final storyboard gesture must not retain the literal phone or a screen-space hand");
  assert.deepEqual(pose.drawings, base.drawings);
  assert.ok(Math.abs(pose.controls["Shaz_Master-P"][0].scale[0] - 1.0) < 0.01, "Shaz_Master-P scale must be 1.0");
  assert.ok(Math.abs(pose.controls["Shaz_Master-P"][0].position[1]) < 0.01, "Shaz_Master-P position Y must be ~0.0");
});

test("phone-use sequence generator exactly reproduces the registered recipe", async () => {
  const [manifest, checkedIn] = await Promise.all([
    loadManifest(new URL("../rig-v2/runtime.json", import.meta.url)),
    load("phone-use-sequence"),
  ]);
  assert.deepEqual(await buildPhoneUseSequence(manifest), checkedIn);
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
