#!/usr/bin/env node
/**
 * Directs Roast Me Conversations presenter avatar reactions, poses, and comedic choreography
 * across all message turns using Jev System One.
 *
 * Usage:
 *   node runtime/direct.mjs [inputs/specular-commentary-proof.json] [--dry-run] [--out <output.json>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { directRoastEpisode } from "./director-jev.mjs";

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
    } else if (arg.startsWith("--episode=")) {
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
    path.join(rootDir, "inputs", "specular-commentary-proof.json"),
    path.join(rootDir, "inputs", "smoke.json"),
  ].filter(Boolean);

  const inputFile = candidateInputs.find((c) => existsSync(c));
  if (!inputFile) {
    console.error(`❌ Missing input episode file. Pass a roast conversation JSON.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputFile, "utf8"));
  console.log(`🎬 [Roast Director] Directing Roast Episode: "${raw.topic || raw.hook?.text?.slice(0, 30)}"...`);
  if (dryRun) {
    console.log(`ℹ️ [Roast Director] Running in --dry-run mode (deterministic variety planner).`);
  }

  const plan = await directRoastEpisode(raw, {
    mode: dryRun ? "deterministic" : "auto",
  });

  const outPath = explicitOut
    ? path.resolve(process.cwd(), explicitOut)
    : path.join(path.dirname(inputFile), "directed-roast.json");

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");

  console.log(`✅ [Roast Director] Successfully directed ${plan.presenter?.cues?.length || 0} avatar cues.`);
  console.log(`   Saved choreography to: ${outPath}`);

  for (const [i, c] of (plan.presenter?.cues || []).entries()) {
    console.log(`   - Cue ${i + 1} [@ ${c.atSeconds}s]: pose=${c.pose}, flip=${c.flip}, attitude=${c.directionMetadata?.attitude}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
