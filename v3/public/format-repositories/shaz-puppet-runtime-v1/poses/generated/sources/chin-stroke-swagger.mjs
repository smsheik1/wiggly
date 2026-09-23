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
const FACE_DRAWINGS = new Set(["Left_Eye", "Right_Eye", "Left_Pupil", "Right_Pupil", "Mouth"]);

async function buildChinStrokeSwagger(manifest) {
  const think = JSON.parse(await fs.readFile(THINK_RECIPE_PATH, "utf8"));
  const controls = {};
  for (const [nodeName, keys] of Object.entries(think.controls)) {
    const initial = sourceControlState(manifest, nodeName, 1);
    controls[nodeName] = [
      controlKey(1, initial),
      ...keys.map((key) => controlKey(key.frame + THINK_OFFSET, key, key.interpolation)),
    ];
  }

  for (const nodeName of ["Left_Pupil", "Right_Pupil"]) {
    const neutral = sourceControlState(manifest, nodeName, 1);
    const focused = adjustedState(neutral, { positionDelta: [-0.025, -0.025, 0] });
    controls[nodeName] = [
      controlKey(1, neutral),
      controlKey(7, focused),
      controlKey(think.durationFrames + THINK_OFFSET, focused),
    ];
  }

  // Smooth arm entrance so relaxed right hand clears canvas bottom during standalone inspection
  for (const key of controls["Right_Arm_Pivot-P"] || []) {
    if (key.frame <= 6) {
      const blend = (7 - key.frame) / 6;
      key.rotation = (key.rotation ?? 0) + 15 * blend;
    }
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
    drawings[nodeName] = [{ frame: 1, drawing: sourceDrawing(manifest, nodeName, 1) }];
  }

  return {
    ...generatedRecipe(manifest, {
      id: "chin-stroke-swagger",
      durationFrames: think.durationFrames + THINK_OFFSET,
      learnedFrom: [
        "authored/think: hand-to-face, head drag, secondary hair, and settle mechanics",
        "authored library: neutral-to-pose anticipation and subtle smug eye direction",
        "authored/think overlay hand: native wrist-registered pointing contact without a screen-space hand substitute",
        "smooth arm entrance blend to clear canvas bounds on native rig",
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
    props: [],
  };
}

async function main() {
  const [manifestPath, outputPath] = process.argv.slice(2);
  if (!manifestPath || !outputPath) {
    throw new Error("usage: chin-stroke-swagger.mjs runtime.json output-recipe.json");
  }
  const manifest = await loadManifest(path.resolve(manifestPath));
  process.stdout.write(`${await writePoseRecipe(outputPath, await buildChinStrokeSwagger(manifest))}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildChinStrokeSwagger };
