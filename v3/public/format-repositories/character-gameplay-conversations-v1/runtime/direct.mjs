#!/usr/bin/env node
/**
 * Directs Character Gameplay Conversations dialogue roles, delivery attitudes, and gameplay pacing
 * across all dialogue turns using Jev System One.
 *
 * Usage:
 *   node runtime/direct.mjs [inputs/why-batman-wont-kill-joker.json] [--dry-run] [--out <output.json>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { directGameplayConversation } from "./director-jev.mjs";

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
    path.join(rootDir, "inputs", "crossover.json"),
    path.join(rootDir, "inputs", "why-batman-wont-kill-joker.json"),
  ].filter(Boolean);

  const inputFile = candidateInputs.find((c) => existsSync(c));
  if (!inputFile) {
    console.error(`❌ Missing input episode file. Pass a conversation JSON.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(inputFile, "utf8"));
  console.log(`🎬 [Gameplay Director] Directing Conversation: "${raw.header?.title || raw.topic}" (${raw.turns?.length || 0} turns)...`);
  if (dryRun) {
    console.log(`ℹ️ [Gameplay Director] Running in --dry-run mode (deterministic variety planner).`);
  }

  const plan = await directGameplayConversation(raw, {
    mode: dryRun ? "deterministic" : "auto",
  });

  const outPath = explicitOut
    ? path.resolve(process.cwd(), explicitOut)
    : path.join(path.dirname(inputFile), "directed-conversation.json");

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(plan, null, 2) + "\n", "utf8");

  console.log(`✅ [Gameplay Director] Successfully directed ${plan.turns.length} dialogue turns.`);
  console.log(`   Saved choreography to: ${outPath}`);

  for (const [i, t] of plan.turns.entries()) {
    console.log(`   - Turn ${i + 1} (${t.speaker}): role=${t.direction?.turnRole}, attitude=${t.direction?.deliveryAttitude}, visual=${t.direction?.visualEmphasis}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
