#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  controlKey,
  generatedRecipe,
  writePoseRecipe,
} from "../../../runtime/pose-authoring.mjs";
import { loadManifest } from "../../../runtime/rig-v2-renderer.mjs";

const PRESENT_RECIPE_PATH = fileURLToPath(new URL("../../authored/present.json", import.meta.url));
const PRESENT_RECIPE_SHA256 = "4577345e15985d0fe71159fa6ebca5dae1e991b9e82ee2b1905a80040c826715";
const DURATION_FRAMES = 36;

async function loadExactRecipe(recipePath, expectedSha256) {
  const bytes = await fs.readFile(recipePath);
  const actualSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedSha256) {
    throw new Error(`locked source recipe changed: ${path.basename(recipePath)} ${actualSha256}`);
  }
  return JSON.parse(bytes.toString("utf8"));
}

async function buildPointAtScreen(manifest) {
  const present = await loadExactRecipe(PRESENT_RECIPE_PATH, PRESENT_RECIPE_SHA256);

  const controls = {};
  for (const [nodeName, keys] of Object.entries(present.controls)) {
    const lastKey = keys.at(-1);
    const extendedKeys = [...keys];
    if (lastKey.frame < DURATION_FRAMES) {
      extendedKeys.push({
        ...lastKey,
        frame: DURATION_FRAMES,
      });
    }
    controls[nodeName] = extendedKeys;
  }

  const drawings = structuredClone(present.drawings);
  // Left_Hand switches to drawing 6 (native index finger pointing at stage-right OTS card)
  drawings.Left_Hand = [
    { frame: 1, drawing: "1" },
    { frame: 10, drawing: "6" },
    { frame: DURATION_FRAMES, drawing: "6" },
  ];

  return generatedRecipe(manifest, {
    id: "point-at-screen",
    durationFrames: DURATION_FRAMES,
    learnedFrom: [
      "authored/present@4577345e: arm sweep, head tilt, and secondary hair cadence toward OTS card zone",
      "registered Left_Hand drawing 6: native stage-right index point directed at OTS card",
      "normalized universal rig contract: Shaz_Master-P universal scale 1.0, zero coordinate offset, flipHorizontal: false",
    ],
    controls,
    drawings,
    quality: {
      maximumIdenticalFrames: 18,
      authoredOpenHandCuffs: structuredClone(present.quality?.authoredOpenHandCuffs ?? []),
      armGeometryLimits: structuredClone(present.quality?.armGeometryLimits ?? {}),
    },
  });
}

async function main() {
  const [manifestPath, outputPath] = process.argv.slice(2);
  if (!manifestPath || !outputPath) {
    throw new Error("usage: point-at-screen.mjs runtime.json output-recipe.json");
  }
  const manifest = await loadManifest(path.resolve(manifestPath));
  process.stdout.write(`${await writePoseRecipe(outputPath, await buildPointAtScreen(manifest))}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { buildPointAtScreen };
