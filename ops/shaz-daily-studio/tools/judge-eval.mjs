#!/usr/bin/env node
/**
 * Can we trust the judge? Grades Shaz's graded samples with the real judge.
 * Calls ONLY the judge agent (studio.config.json "judgeAgent"). No news, no writer,
 * no voice, no video, no Telegram, no Buffer.
 *
 *   node tools/judge-eval.mjs                 # every case once
 *   node tools/judge-eval.mjs --repeat 2      # every case twice; a case must be right both times
 *   node tools/judge-eval.mjs --parallel 3    # judge calls at once (default 3)
 *
 * Exit 0 = trusted (every approved sample passed the filter, every "don't post" script was blocked,
 * and the picker chose Shaz's favorite on enough stories).
 * Results are saved to <main wiggly checkout>/tmp/judge-evals/<timestamp>.json
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildJudgeEvalCases, loadJudgeSamples, runJudgeEval } from "../judge-eval.mjs";
import { loadVoiceGuide } from "../script-room.mjs";
import { loadStudioConfig } from "../studio-daily.mjs";
import { askActiveAgent } from "../../../v3/lib/agent-bridge.ts";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function short(text, n = 150) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

async function main() {
  const repeat = Number(arg("--repeat", 1));
  const parallel = Number(arg("--parallel", 3));
  if (!Number.isInteger(repeat) || repeat < 1) throw new Error("--repeat must be a whole number >= 1");
  if (!Number.isInteger(parallel) || parallel < 1) throw new Error("--parallel must be a whole number >= 1");

  const cfg = await loadStudioConfig();
  const cases = buildJudgeEvalCases({ voiceGuide: await loadVoiceGuide(), samples: await loadJudgeSamples() });
  console.log(`Judge: ${cfg.judgeAgent} (${cfg.judgeModel || "default model"}, effort ${cfg.judgeEffort}). Writer stays: ${cfg.writerAgent}.`);
  console.log(`${cases.length} cases x ${repeat} = ${cases.length * repeat} judge calls, ${parallel} at a time.\n`);

  const summary = await runJudgeEval({
    cases,
    config: cfg,
    askAgentFn: askActiveAgent,
    repeat,
    parallel,
    onResult: (c, run) => {
      const picking = c.expect === "pick";
      const got = run.error ? "ERROR" : picking ? (run.picked ? "favorite" : `picked ${run.pickedId}`) : run.goodEnough ? "pass" : "fail";
      const ok = !run.error && (picking ? run.picked : run.goodEnough === (c.expect === "pass"));
      const want = picking ? `Shaz's favorite ${c.favorite}` : c.expect;
      console.log(`${ok ? "✅" : "❌"} want ${want}, got ${got}${run.total ? ` (${run.total}/60)` : ""}  ${c.id}`);
      if (!ok) console.log(`     judge said: ${short(run.error || run.notes, 300)}`);
    },
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const mainRoot = path.basename(path.dirname(repoRoot)) === "tmp" ? path.resolve(repoRoot, "../..") : repoRoot;
  const dir = path.join(mainRoot, "tmp", "judge-evals");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await fs.writeFile(file, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`\nApproved samples passed: ${summary.passCases.right}/${summary.passCases.total}`);
  console.log(`"Don't post" scripts blocked: ${summary.failCases.right}/${summary.failCases.total}`);
  console.log(`Picked Shaz's favorite: ${summary.pickCases.right}/${summary.pickCases.total} stories (need ${summary.pickCases.needed})`);
  console.log(summary.trusted ? "\n✅ JUDGE TRUSTED on this set." : "\n❌ JUDGE NOT TRUSTED yet. See the ❌ lines above.");
  console.log(`Saved: ${file}`);
  process.exit(summary.trusted ? 0 : 1);
}

main().catch((err) => {
  console.error(`\n❌ Judge eval stopped: ${err?.message || err}`);
  process.exit(2);
});
