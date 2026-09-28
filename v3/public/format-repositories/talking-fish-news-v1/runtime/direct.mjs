#!/usr/bin/env node
/**
 * Directs Talking Fish News acting performance, camera motion, and broadcast ticker badges
 * across all 4 beats using Jev System One.
 *
 * Usage:
 *   node runtime/direct.mjs [script.json or fixture.json] [--dry-run] [--out <output.json>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { directFishNewsStory } from "./director-jev.mjs";

function parseArgs(args) {
  let dryRun = false;
  let outPath = null;
  let inputPath = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--out" && i + 1 < args.length) {
      outPath = args[i + 1];
      i += 1;
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
    path.join(rootDir, "fixtures", "nasa-curiosity.json"),
  ].filter(Boolean);

  const inputFile = candidateInputs.find((c) => existsSync(c));
  if (!inputFile) {
    console.error(`❌ Missing input story file. Pass a script JSON or fixture.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputFile, "utf8"));
  console.log(`🎬 [Fish Director] Directing Talking Fish News (${raw.research?.topic || raw.topic || path.basename(inputFile)})...`);
  if (dryRun) {
    console.log(`ℹ️ [Fish Director] Running in --dry-run mode (deterministic variety planner).`);
  }

  const plan = await directFishNewsStory(raw, {
    dryRun,
    logger: (msg) => console.log(msg),
  });

  const targetOut = explicitOut
    ? path.resolve(process.cwd(), explicitOut)
    : path.join(rootDir, "directed-plan.json");

  mkdirSync(path.dirname(targetOut), { recursive: true });
  writeFileSync(targetOut, JSON.stringify(plan, null, 2) + "\n");
  console.log(`✅ [Fish Director] Directed broadcast plan saved to: ${targetOut}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
