#!/usr/bin/env node
/**
 * Directs Otaku Explainer anime scenes, manga layouts, and callout badges
 * across all lesson scenes using Jev System One.
 *
 * Usage:
 *   node runtime/direct.mjs [scenes/naruto-lesson.json] [--dry-run] [--out <output.json>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { directOtakuScenes } from "./director-jev.mjs";

function parseArgs(args) {
  let dryRun = false;
  let outPath = null;
  let inputPath = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--out=")) {
      outPath = arg.slice(6);
    } else if (arg === "--out" && i + 1 < args.length) {
      outPath = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--plan=")) {
      inputPath = arg.slice(7);
    } else if (!arg.startsWith("--") && !inputPath) {
      inputPath = arg;
    }
  }

  return { dryRun, outPath, inputPath };
}

async function main() {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const { dryRun, outPath: explicitOut, inputPath: explicitInput } = parseArgs(process.argv.slice(2));

  const candidateInputs = [
    explicitInput ? path.resolve(process.cwd(), explicitInput) : null,
    path.join(rootDir, "fixtures", "naruto-lesson.json"),
  ].filter(Boolean);

  let inputFile = candidateInputs.find((c) => existsSync(c));
  let raw;
  if (inputFile) {
    raw = JSON.parse(readFileSync(inputFile, "utf8"));
  } else {
    // Generate default lesson structure if no file passed
    raw = {
      world: "naruto",
      topic: "How does Chakra work?",
      scenes: [
        { id: "scene-1", speakerRole: "learner", visibleRoles: ["learner", "guide"], dialogue: "Wait, so Chakra isn't just magic?! How does it actually work?!", estimatedDurationMs: 4000 },
        { id: "scene-2", speakerRole: "guide", visibleRoles: ["learner", "guide"], dialogue: "Chakra is the precise blend of physical stamina and spiritual energy.", estimatedDurationMs: 5000 },
        { id: "scene-3", speakerRole: "challenger", visibleRoles: ["learner", "guide", "challenger"], dialogue: "And if your ratio is off by even a fraction, the jutsu fails completely.", estimatedDurationMs: 4500 },
        { id: "scene-4", speakerRole: "guide", visibleRoles: ["learner", "guide"], dialogue: "Master control first, and even the simplest hand signs become lethal.", estimatedDurationMs: 4000 },
      ],
    };
  }

  console.log(`🎬 [Otaku Director] Directing Anime Explainer: "${raw.topic || raw.world}" (${raw.scenes?.length || 0} scenes)...`);
  if (dryRun) {
    console.log(`ℹ️ [Otaku Director] Running in --dry-run mode (deterministic variety planner).`);
  }

  const plan = await directOtakuScenes(raw, {
    mode: dryRun ? "deterministic" : "auto",
  });

  const outPath = explicitOut
    ? path.resolve(process.cwd(), explicitOut)
    : (inputFile ? path.join(path.dirname(inputFile), "directed-scenes.json") : path.join(rootDir, "inputs", "directed-scenes.json"));

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");

  console.log(`✅ [Otaku Director] Successfully directed ${plan.scenes.length} anime scenes.`);
  console.log(`   Saved choreography to: ${outPath}`);

  for (const [i, s] of plan.scenes.entries()) {
    console.log(`   - Scene ${i + 1} (${s.speakerRole}): layout=${s.layout}, badge=[${s.callout?.theme}] "${s.callout?.label}", energy=${s.directionMetadata?.actingEnergy}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
