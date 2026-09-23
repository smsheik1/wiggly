#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  adjustedState,
  controlKey,
  generatedRecipe,
  sourceControlState,
  sourceDrawing,
  writePoseRecipe,
} from "../../../runtime/pose-authoring.mjs";
import { loadManifest } from "../../../runtime/rig-v2-renderer.mjs";

const CONFIDENT_RECIPE_PATH = fileURLToPath(new URL("../../authored/confident.json", import.meta.url));
const CONFIDENT_RECIPE_SHA256 = "53496ec22e505fa44673260935ccaa4edc9ea87796b99a1c79031b825c804c1c";
const CROSSED_ARMS_ASSET_SHA256 = "73e73755a77822989fd466ab6fe79591b176bbe9ea68940a46359c999a84e311";
const OFFSET = 6;
const REPLACEMENT_FRAME = 10;
const REPLACEMENT_POSITION = [0.41796875, 0.621875];
const REPLACEMENT_WIDTH = 0.2578125;
const FACE_DRAWINGS = new Set([
  "Eyebrows",
  "Left_Eye",
  "Right_Eye",
  "Left_Pupil",
  "Right_Pupil",
  "Mouth",
]);

function adjustedKey(nodeName, key) {
  const progress = key.frame <= 1 ? 0.4 : 1.0;
  if (nodeName === "Shaz_Master-P") {
    return adjustedState(key, {
      positionDelta: [0, 0.1, 0],
      rotationDelta: progress * 2,
      scaleMultiply: [0.86, 0.86],
    });
  }
  if (nodeName === "Arms_Master-P") {
    return adjustedState(key, { positionDelta: [0, progress * -1.25, 0] });
  }
  if (nodeName === "Head_Movement-P") {
    return adjustedState(key, { rotationDelta: progress * 6 });
  }
  if (nodeName === "Left_Arm_Pivot-P") {
    return adjustedState(key, { rotationDelta: progress * 20 });
  }
  if (nodeName === "Left_Forearm_Pivot-P") {
    return adjustedState(key, { rotationDelta: progress * 110 });
  }
  if (nodeName === "Right_Arm_Pivot-P") {
    return adjustedState(key, { rotationDelta: progress * -20 });
  }
  if (nodeName === "Right_Forearm_Pivot-P") {
    return adjustedState(key, { rotationDelta: progress * -110 });
  }
  return key;
}

async function loadLockedConfident() {
  const bytes = await fs.readFile(CONFIDENT_RECIPE_PATH);
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== CONFIDENT_RECIPE_SHA256) {
    throw new Error(`locked source recipe changed: confident.json ${actual}`);
  }
  return JSON.parse(bytes.toString("utf8"));
}

async function buildArmsCrossedSkeptical(manifest) {
  const confident = await loadLockedConfident();
  const controls = {};
  for (const [nodeName, keys] of Object.entries(confident.controls)) {
    const initial = sourceControlState(manifest, nodeName, 1);
    controls[nodeName] = [
      controlKey(1, adjustedState(initial, nodeName === "Shaz_Master-P"
        ? { positionDelta: [0, 0.1, 0], scaleMultiply: [0.86, 0.86] }
        : {})),
      ...keys.map((key) => controlKey(
        key.frame + OFFSET,
        adjustedKey(nodeName, key),
        key.interpolation,
      )),
    ];
  }

  // The registered replacement is stage-locked, so the two root controls are
  // held at the final authored settle as soon as the drawing substitution
  // occurs. Facial controls keep settling independently after the switch.
  for (const nodeName of ["Shaz_Master-P", "Shaz_Rig-P"]) {
    const finalState = controls[nodeName].at(-1);
    controls[nodeName] = [
      ...controls[nodeName].filter(({ frame }) => frame < REPLACEMENT_FRAME),
      controlKey(REPLACEMENT_FRAME, finalState, "hold"),
      controlKey(confident.durationFrames + OFFSET, finalState, "hold"),
    ];
  }

  for (const nodeName of ["Left_Pupil", "Right_Pupil"]) {
    const neutral = sourceControlState(manifest, nodeName, 1);
    const sideEye = adjustedState(neutral, { positionDelta: [0.025, 0, 0] });
    controls[nodeName] = [
      controlKey(1, neutral),
      controlKey(11, sideEye),
      controlKey(confident.durationFrames + OFFSET, sideEye),
    ];
  }
  const drawings = Object.fromEntries(Object.entries(confident.drawings)
    .filter(([nodeName]) => !FACE_DRAWINGS.has(nodeName))
    .map(([nodeName, keys]) => [nodeName, [
      { frame: 1, drawing: sourceDrawing(manifest, nodeName, 1) },
      ...keys.map((key) => ({ ...key, frame: key.frame + OFFSET })),
    ]]));
  for (const nodeName of [
    "Left_Arm",
    "Left_Forearm",
    "Left_Hand",
    "Right_Arm",
    "Right_Forearm",
    "Right_Hand",
  ]) {
    drawings[nodeName] = [
      { frame: 1, drawing: sourceDrawing(manifest, nodeName, 1) },
      { frame: REPLACEMENT_FRAME, drawing: null },
    ];
  }
  drawings.Eyebrows = [
    { frame: 1, drawing: sourceDrawing(manifest, "Eyebrows", 1) },
    { frame: 11, drawing: sourceDrawing(manifest, "Eyebrows", 123) },
  ];
  for (const nodeName of ["Left_Eye", "Right_Eye", "Left_Pupil", "Right_Pupil"]) {
    drawings[nodeName] = [
      { frame: 1, drawing: sourceDrawing(manifest, nodeName, 1) },
      { frame: 11, drawing: nodeName.endsWith("Eye") ? "2" : "1" },
    ];
  }
  drawings.Mouth = [
    { frame: 1, drawing: sourceDrawing(manifest, "Mouth", 1) },
    { frame: 11, drawing: sourceDrawing(manifest, "Mouth", 121) },
  ];

  const recipe = generatedRecipe(manifest, {
    id: "arms-crossed-skeptical",
    durationFrames: confident.durationFrames + OFFSET,
    learnedFrom: [
      "authored/confident@53496ec2: bilateral elbow bend, planted stance, anticipation, and overshoot mechanics",
      "authored/think: skeptical brow, mouth, eye-direction, and head-drag vocabulary",
      "native rig arm chains create the anticipation through frame 9, then one provenance-locked folded-arms drawing replaces only the arm artwork",
      "the replacement preserves the runtime-rendered head, hair, face, torso, collar, strings, and pocket instead of replacing the character",
      "native chain experiments were rejected because the supplied cuffs and pivots could only form clasped hands, detached wrists, or stretched sleeves",
    ],
    controls,
    drawings,
    quality: {
      maximumIdenticalFrames: 2,
      armCompositeMode: "registered-pose-replacement",
    },
  });
  recipe.authorship.method = "semantic-rig-control-composition-with-registered-pose-drawing";
  recipe.props = [
    {
      id: "crossed-arms-pose",
      asset: "crossed-arms-pose.png",
      sha256: CROSSED_ARMS_ASSET_SHA256,
      layer: "body-front",
      keys: [
        {
          frame: 1,
          position: REPLACEMENT_POSITION,
          width: REPLACEMENT_WIDTH,
          rotation: 0,
          opacity: 0,
          interpolation: "hold",
        },
        {
          frame: REPLACEMENT_FRAME,
          position: REPLACEMENT_POSITION,
          width: REPLACEMENT_WIDTH,
          rotation: 0,
          opacity: 100,
          interpolation: "hold",
        },
        {
          frame: confident.durationFrames + OFFSET,
          position: REPLACEMENT_POSITION,
          width: REPLACEMENT_WIDTH,
          rotation: 0,
          opacity: 100,
          interpolation: "hold",
        },
      ],
    },
  ];
  return recipe;
}

async function main() {
  const [manifestPath, outputPath] = process.argv.slice(2);
  if (!manifestPath || !outputPath) {
    throw new Error("usage: arms-crossed-skeptical.mjs runtime.json output-recipe.json");
  }
  const manifest = await loadManifest(path.resolve(manifestPath));
  process.stdout.write(`${await writePoseRecipe(outputPath, await buildArmsCrossedSkeptical(manifest))}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildArmsCrossedSkeptical };
