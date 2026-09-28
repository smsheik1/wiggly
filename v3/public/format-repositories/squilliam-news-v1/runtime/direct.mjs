#!/usr/bin/env node
/**
 * Directs Squilliam News Network acting performance, camera motion, and broadcast ticker badges
 * across all 10 story slides using Jev System One.
 *
 * Usage:
 *   node runtime/direct.mjs [content.json] [--dry-run] [--out <output.json>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { directSquilliamNewsPresentation } from "./director-jev.mjs";

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
    } else if (arg.startsWith("--content=")) {
      inputPath = arg.slice(10);
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
    path.join(rootDir, "fixtures", "smoke", "content.json"),
  ].filter(Boolean);

  const inputFile = candidateInputs.find((c) => existsSync(c));
  if (!inputFile) {
    console.error(`❌ Missing input content.json file. Pass a content JSON or fixture.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputFile, "utf8"));
  console.log(`🎬 [Squilliam Director] Directing SNN presentation: "${raw.headline}" (${raw.slides?.length || 0} slides)...`);
  if (dryRun) {
    console.log(`ℹ️ [Squilliam Director] Running in --dry-run mode (deterministic variety planner).`);
  }

  const plan = await directSquilliamNewsPresentation(raw, {
    mode: dryRun ? "deterministic" : "auto",
  });

  const outPath = explicitOut
    ? path.resolve(process.cwd(), explicitOut)
    : path.join(path.dirname(inputFile), "direction.json");

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");

  console.log(`✅ [Squilliam Director] Successfully directed ${plan.directedSlides.length} slides.`);
  console.log(`   Character: ${plan.characterId}`);
  console.log(`   Saved choreography to: ${outPath}`);

  for (const s of plan.directedSlides) {
    console.log(`   - Slide ${s.slideIndex + 1} (${s.slideType}): pose=${s.direction.gesturePose}, cam=${s.direction.cameraMotion}, badge=${s.direction.tickerBadge}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
