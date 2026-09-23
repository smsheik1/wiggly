#!/usr/bin/env node

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
const THINK_OFFSET = 6;
const PHONE_SHA256 = "aadcadb428f4f63ad54ed9575e5120a8519a3520af3b2460714a337a1fd21975";
const FACE_DRAWINGS = new Set(["Left_Eye", "Right_Eye", "Left_Pupil", "Right_Pupil", "Mouth"]);

function framedState(state) {
  return adjustedState(state, {
    positionDelta: [0, 0.12, 0],
    scaleMultiply: [0.86, 0.86],
  });
}

async function buildLookAtPhone(manifest) {
  const think = JSON.parse(await fs.readFile(THINK_RECIPE_PATH, "utf8"));
  const controls = {};
  for (const [nodeName, keys] of Object.entries(think.controls)) {
    const initial = sourceControlState(manifest, nodeName, 1);
    controls[nodeName] = [
      controlKey(1, nodeName === "Shaz_Master-P" ? framedState(initial) : initial),
      ...keys.map((key) => controlKey(
        key.frame + THINK_OFFSET,
        nodeName === "Shaz_Master-P" ? framedState(key) : key,
        key.interpolation,
      )),
    ];
  }

  for (const nodeName of ["Left_Pupil", "Right_Pupil"]) {
    const neutral = sourceControlState(manifest, nodeName, 1);
    const focused = adjustedState(neutral, { positionDelta: [-0.1, -0.32, 0] });
    controls[nodeName] = [
      controlKey(1, neutral),
      controlKey(7, focused),
      controlKey(think.durationFrames + THINK_OFFSET, focused),
    ];
  }

  const drawings = Object.fromEntries(Object.entries(think.drawings)
    .filter(([nodeName]) => !FACE_DRAWINGS.has(nodeName))
    .map(([nodeName, keys]) => [
      nodeName,
      [
        { frame: 1, drawing: sourceDrawing(manifest, nodeName, 1) },
        ...keys.map((key) => ({ ...key, frame: key.frame + THINK_OFFSET })),
      ],
    ]));
  for (const nodeName of FACE_DRAWINGS) {
    if (nodeName === "Left_Eye" || nodeName === "Right_Eye") {
      drawings[nodeName] = [
        { frame: 1, drawing: sourceDrawing(manifest, nodeName, 1) },
        { frame: 7, drawing: "4" },
      ];
    } else {
      drawings[nodeName] = [{ frame: 1, drawing: sourceDrawing(manifest, nodeName, 1) }];
    }
  }

  return {
    ...generatedRecipe(manifest, {
      id: "look-at-phone",
      durationFrames: think.durationFrames + THINK_OFFSET,
      learnedFrom: [
        "authored/think: hand-to-face, head drag, secondary hair, and settle mechanics",
        "authored library: neutral-to-pose anticipation and focused eye direction",
        "authored/think overlay hand: native wrist-registered pointing contact without a screen-space hand substitute",
      ],
      controls,
      drawings,
      quality: {
        maximumIdenticalFrames: 3,
        armCompositeMode: "native-rig",
        overlayHandSleeveOwner: "Left",
        armGeometryLimits: {
          Left: {
            maximumHandToSleeveAreaRatio: 0.65,
          },
        },
      },
    }),
    props: [
      {
        id: "phone",
        asset: "phone.svg",
        sha256: PHONE_SHA256,
        layer: "body-front",
        keys: [
          { frame: 1, position: [0.355, 0.8], width: 0.055, rotation: 8, opacity: 100, interpolation: "hold" },
          { frame: 7, position: [0.355, 0.8], width: 0.055, rotation: 6, opacity: 100 },
          { frame: 10, position: [0.39, 0.7], width: 0.052, rotation: 3, opacity: 100 },
          { frame: 12, position: [0.42, 0.52], width: 0.05, rotation: 1, opacity: 100 },
          { frame: 13, position: [0.44, 0.44], width: 0.05, rotation: 4, opacity: 100 },
          { frame: think.durationFrames + THINK_OFFSET, position: [0.44, 0.44], width: 0.05, rotation: 4, opacity: 100 },
        ],
      },
    ],
  };
}

async function main() {
  const [manifestPath, outputPath] = process.argv.slice(2);
  if (!manifestPath || !outputPath) {
    throw new Error("usage: look-at-phone.mjs runtime.json output-recipe.json");
  }
  const manifest = await loadManifest(path.resolve(manifestPath));
  process.stdout.write(`${await writePoseRecipe(outputPath, await buildLookAtPhone(manifest))}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildLookAtPhone };
