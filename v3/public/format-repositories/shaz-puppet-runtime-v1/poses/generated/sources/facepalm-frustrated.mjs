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

const THINK_RECIPE_PATH = fileURLToPath(new URL("../../authored/think.json", import.meta.url));
const THINK_RECIPE_SHA256 = "6fc21c25dd49a6bf18eae49886c6ebb95a41367461a792655d450377ddb16d12";
const OFFSET = 6;
const DURATION_FRAMES = 36;

async function loadLockedThink() {
  const bytes = await fs.readFile(THINK_RECIPE_PATH);
  const actual = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actual !== THINK_RECIPE_SHA256) {
    throw new Error(`locked source recipe changed: think.json ${actual}`);
  }
  return JSON.parse(bytes.toString("utf8"));
}

function adjustmentFor(nodeName, sourceKey) {
  const settled = sourceKey.frame >= 7;
  if (nodeName === "Shaz_Master-P") {
    return {
      positionDelta: [0, settled ? 0.04 : 0.1, 0],
      rotationDelta: settled ? -3 : 0,
      scaleMultiply: [0.88, 0.88],
    };
  }
  if (nodeName === "Head_Movement-P" && settled) return { rotationDelta: -5 };
  if (nodeName === "OL_Hand-P" && settled) return { positionDelta: [0.08, 0.06, 0] };
  if (nodeName === "Left_Forearm-P" && sourceKey.frame + OFFSET >= 16) {
    return { positionDelta: [0.45, -1.3, 0], rotationDelta: -22 };
  }
  if (nodeName === "Left_Arm-P" && sourceKey.frame + OFFSET >= 16) {
    return { positionDelta: [0, -0.4, 0], rotationDelta: 12 };
  }
  return {};
}

function frontPalmState(state, frame) {
  const approach = frame === 16;
  const overshoot = frame === 18 || frame === 19;
  return adjustedState(state, {
    positionDelta: approach
      ? [1.42, -7.47, 0]
      : overshoot
        ? [1.55, -7.36, 0]
        : [1.5, -7.4, 0],
    rotation: approach ? 98 : overshoot ? 108 : 105,
    scaleMultiply: approach ? [0.36, 0.36] : overshoot ? [0.42, 0.42] : [0.4, 0.4],
  });
}

async function buildFacepalmFrustrated(manifest) {
  const think = await loadLockedThink();
  const controls = {};
  for (const [nodeName, keys] of Object.entries(think.controls)) {
    const initial = sourceControlState(manifest, nodeName, 1);
    controls[nodeName] = [
      controlKey(1, adjustedState(initial, nodeName === "Shaz_Master-P"
        ? { positionDelta: [0, 0.1, 0], scaleMultiply: [0.88, 0.88] }
        : {})),
      ...keys
        .filter((key) => key.frame + OFFSET <= DURATION_FRAMES)
        .map((key) => controlKey(
          key.frame + OFFSET,
          adjustedState(key, adjustmentFor(nodeName, key)),
          key.interpolation,
        )),
    ];
  }

  const masterInitial = controls["Shaz_Master-P"][0];
  controls["Shaz_Master-P"].splice(1, 0,
    controlKey(3, adjustedState(masterInitial, {
      positionDelta: [0, 0.025, 0],
      rotationDelta: -0.35,
    })),
    controlKey(5, adjustedState(masterInitial, {
      positionDelta: [0, 0.01, 0],
      rotationDelta: 0.2,
    })),
  );

  controls["OL_Hand-P"] = controls["OL_Hand-P"].map((key) => (
    key.frame >= 16
      ? controlKey(key.frame, frontPalmState(key, key.frame), key.interpolation)
      : key
  ));

  const drawings = Object.fromEntries(Object.entries(think.drawings).map(([nodeName, keys]) => [
    nodeName,
    [
      { frame: 1, drawing: sourceDrawing(manifest, nodeName, 1) },
      ...keys
        .filter((key) => key.frame + OFFSET <= DURATION_FRAMES)
        .map((key) => ({ ...key, frame: key.frame + OFFSET })),
    ],
  ]));

  drawings.Left_Hand = [
    { frame: 1, drawing: sourceDrawing(manifest, "Left_Hand", 1) },
    { frame: 13, drawing: null },
  ];
  drawings.OL_Hand = [
    { frame: 1, drawing: null },
    { frame: 13, drawing: "1" },
    { frame: 16, drawing: "2" },
  ];
  drawings.Mouth = [
    { frame: 1, drawing: "3" },
    { frame: 7, drawing: "6" },
  ];

  return generatedRecipe(manifest, {
    id: "facepalm-frustrated",
    durationFrames: DURATION_FRAMES,
    learnedFrom: [
      "authored/think@6fc21c25: connected hand-to-face mechanics, facial substitutions, and living hold",
      "storyboard 93b6fd07: fingertip realization, palm-to-forehead contact, and full eye-covering facepalm",
    ],
    controls,
    drawings,
    quality: {
      maximumIdenticalFrames: 2,
      overlayHandSleeveOwner: "Left",
      armGeometryLimits: {
        Left: {
          maximumHandToSleeveAreaRatio: 0.65,
          maximumHandToHeadWidthRatio: 0.9,
        },
      },
    },
  });
}

async function main() {
  const [manifestPath, outputPath] = process.argv.slice(2);
  if (!manifestPath || !outputPath) {
    throw new Error("usage: facepalm-frustrated.mjs runtime.json output-recipe.json");
  }
  const manifest = await loadManifest(path.resolve(manifestPath));
  process.stdout.write(`${await writePoseRecipe(outputPath, await buildFacepalmFrustrated(manifest))}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildFacepalmFrustrated };
