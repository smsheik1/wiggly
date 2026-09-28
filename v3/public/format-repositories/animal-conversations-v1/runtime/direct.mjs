#!/usr/bin/env node
/**
 * Directs Animal Conversations acting performance, dynamic camera switching, and bounce timing
 * across all dialogue beats using Jev System One.
 *
 * Usage:
 *   node runtime/direct.mjs [inputs/episode.json] [--dry-run] [--out <output.json>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { directAnimalConversation } from "./director-jev.mjs";

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
    path.join(rootDir, "fixtures", "smoke", "input.json"),
  ].filter(Boolean);

  const inputFile = candidateInputs.find((c) => existsSync(c));
  if (!inputFile) {
    console.error(`❌ Missing input episode file. Pass an episode JSON or fixture.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputFile, "utf8"));
  console.log(`🎬 [Animal Director] Directing Animal Conversation: "${raw.title || raw.episodeLabel}" (${raw.timeline?.length || 0} beats)...`);
  if (dryRun) {
    console.log(`ℹ️ [Animal Director] Running in --dry-run mode (deterministic variety planner).`);
  }

  const plan = await directAnimalConversation(raw, {
    mode: dryRun ? "deterministic" : "auto",
  });

  const outPath = explicitOut
    ? path.resolve(process.cwd(), explicitOut)
    : path.join(path.dirname(inputFile), "directed-episode.json");

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");

  console.log(`✅ [Animal Director] Successfully directed ${plan.timeline.length} conversation beats.`);
  console.log(`   Saved choreography to: ${outPath}`);

  for (const [i, b] of plan.timeline.entries()) {
    console.log(`   - Beat ${i + 1} [${b.start.toFixed(2)}s - ${b.end.toFixed(2)}s] (${b.speaker}): cam=${b.camera}, bounce=${JSON.stringify(b.bounceAt || [])}, reaction=${b.directionMetadata?.reaction}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
