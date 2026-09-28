#!/usr/bin/env node
/**
 * Directs Mugsy's acting performance, pose selection, and whiteboard staging
 * across all sentences of content.json using Jev System One.
 *
 * Usage:
 *   node runtime/direct.mjs [content.json] [--dry-run] [--out <output.json>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { directMugsyContent } from "./director-jev.mjs";

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

  const contentFile = explicitInput
    ? path.resolve(process.cwd(), explicitInput)
    : path.join(rootDir, "content.json");

  if (!existsSync(contentFile)) {
    console.error(`❌ Missing content file at: ${contentFile}`);
    process.exit(1);
  }

  const content = JSON.parse(readFileSync(contentFile, "utf8"));
  console.log(`🎬 [Jev Director] Directing Mugsy Explains (${content.lessons?.length || 0} lessons)...`);
  if (dryRun) {
    console.log(`ℹ️ [Jev Director] Running in --dry-run mode (deterministic variety planner).`);
  }

  const plan = await directMugsyContent(content, {
    dryRun,
    logger: (msg) => console.log(msg),
  });

  const targetOut = explicitOut
    ? path.resolve(process.cwd(), explicitOut)
    : path.join(rootDir, "run", "directed-plan.json");

  mkdirSync(path.dirname(targetOut), { recursive: true });
  writeFileSync(targetOut, JSON.stringify(plan, null, 2) + "\n");
  console.log(`✅ [Jev Director] Directed plan saved to: ${targetOut}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
