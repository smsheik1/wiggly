#!/usr/bin/env node
/**
 * Directs Bikini Bottom Dance Off character choreography, taunt delivery, and battle intensity
 * across all 4 competitors using Jev System One.
 *
 * Usage:
 *   node runtime/direct.mjs [inputs/smoke.json] [--dry-run] [--out <output.json>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { directDanceOffEpisode } from "./director-jev.mjs";

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
    } else if (arg.startsWith("--input=")) {
      inputPath = arg.slice(8);
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
    path.join(rootDir, "fixtures", "smoke", "input.json"),
    path.join(rootDir, "inputs", "starter-dance-off.json"),
  ].filter(Boolean);

  const inputFile = candidateInputs.find((c) => existsSync(c));
  if (!inputFile) {
    console.error(`❌ Missing input dance-off file. Pass an input JSON or fixture.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputFile, "utf8"));
  console.log(`🎬 [Dance Off Director] Directing Dance Off: "${raw.title}" (${raw.characters?.length || 0} competitors)...`);
  if (dryRun) {
    console.log(`ℹ️ [Dance Off Director] Running in --dry-run mode (deterministic variety planner).`);
  }

  // Load starter motions catalog if available
  let catalogMotions = [];
  const motionsFile = path.join(rootDir, "assets", "starter-motions.json");
  if (existsSync(motionsFile)) {
    try {
      const parsed = JSON.parse(readFileSync(motionsFile, "utf8"));
      catalogMotions = parsed.motions || parsed || [];
    } catch {}
  }

  const plan = await directDanceOffEpisode(raw, {
    mode: dryRun ? "deterministic" : "auto",
    catalogMotions,
  });

  const outPath = explicitOut
    ? path.resolve(process.cwd(), explicitOut)
    : path.join(path.dirname(inputFile), "directed-dance-off.json");

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");

  console.log(`✅ [Dance Off Director] Successfully directed ${plan.characters.length} dancers.`);
  console.log(`   Saved choreography to: ${outPath}`);

  for (const [i, c] of plan.characters.entries()) {
    console.log(`   - Dancer ${i + 1} (${c.label}): solo=${c.motionId}, finale=${c.finaleMotionId}, reaction=${c.reactionMotionId}, intensity=${c.directionMetadata?.battleIntensity}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
