/**
 * Judge eval: can we trust the judge? (Shaz, Phase 2, 2026-11-20)
 *
 * Every case is judged alone (one-draft mode), the same way the room judges a rewrite.
 *   - The approved samples in voice-guide.md must PASS (goodEnough true). Each one is judged
 *     with a guide that has THAT sample removed, so the judge can't pass it by recognising it.
 *   - Every script in judge-samples.json "mustFail" must FAIL (goodEnough false), judged with
 *     the full guide, exactly like a real morning.
 * A case only counts as right if every repeat got it right: a judge that flips is not trusted.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { judgeCallOptions, parseApprovedSamples, runJudge, voiceGuideWithoutSample } from "./script-room.mjs";

const STUDIO_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_JUDGE_SAMPLES_PATH = path.join(STUDIO_ROOT, "judge-samples.json");

export async function loadJudgeSamples(samplesPath = DEFAULT_JUDGE_SAMPLES_PATH) {
  const parsed = JSON.parse(await fs.readFile(samplesPath, "utf8"));
  const mustFail = Array.isArray(parsed?.mustFail) ? parsed.mustFail : [];
  const ids = new Set();
  for (const s of mustFail) {
    if (!s?.id || !String(s.text || "").trim()) throw new Error(`${samplesPath}: every mustFail entry needs "id" and "text"`);
    if (ids.has(s.id)) throw new Error(`${samplesPath}: duplicate id "${s.id}"`);
    ids.add(s.id);
  }
  return { mustFail };
}

/**
 * @returns {{ id: string, expect: "pass" | "fail", text: string, guide: string, source: string }[]}
 */
export function buildJudgeEvalCases({ voiceGuide, samples }) {
  const approved = parseApprovedSamples(voiceGuide);
  if (approved.length === 0) throw new Error("voice guide has no approved samples to test the judge with");
  const cases = approved.map((s) => ({
    id: `approved: ${s.title}`,
    expect: "pass",
    text: s.text,
    guide: voiceGuideWithoutSample(voiceGuide, s.title),
    source: "voice-guide.md approved sample (hidden from the judge's guide)",
  }));
  for (const s of samples.mustFail) {
    cases.push({ id: s.id, expect: "fail", text: s.text.trim(), guide: voiceGuide, source: s.source || "" });
  }
  return cases;
}

async function judgeOnce(c, { askAgentFn, judgeOpts }) {
  const t0 = Date.now();
  const { verdict } = await runJudge({
    // The angle is not shown: approved samples never had one, so no case gets a hint.
    drafts: [{ angle: "not given", text: c.text }],
    voiceGuide: c.guide,
    oneDraftMode: true,
    ask: async (prompt) => {
      try {
        return await askAgentFn(prompt, judgeOpts);
      } catch (err) {
        if (err?.name === "AgentUnavailableError") throw err;
        return { __agentError: err?.message || String(err) };
      }
    },
    randomFn: () => 0.5,
  });
  const s = verdict.scores.A;
  return {
    goodEnough: verdict.goodEnough,
    total: s.total,
    scores: s,
    notes: verdict.rewriteNotes || s.notes,
    durationMs: Date.now() - t0,
  };
}

/**
 * Runs every case `repeat` times with up to `parallel` judge calls at once.
 * Agent unavailable (not logged in, timeout) stops the whole eval loudly (Rule 12).
 */
export async function runJudgeEval({ cases, config, askAgentFn, repeat = 1, parallel = 3, onResult = () => {} }) {
  const judgeOpts = judgeCallOptions(config);
  const jobs = [];
  for (const c of cases) for (let r = 1; r <= repeat; r += 1) jobs.push({ c, r });
  const runs = new Map(cases.map((c) => [c.id, []]));

  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const { c, r } = jobs[next++];
      let run;
      try {
        run = await judgeOnce(c, { askAgentFn, judgeOpts });
      } catch (err) {
        if (err?.name === "AgentUnavailableError") throw err;
        run = { error: err?.message || String(err) };
      }
      run.repeat = r;
      runs.get(c.id).push(run);
      onResult(c, run);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallel, jobs.length)) }, worker));

  const results = cases.map((c) => {
    const rs = runs.get(c.id).sort((a, b) => a.repeat - b.repeat);
    const wanted = c.expect === "pass";
    const right = rs.length === repeat && rs.every((x) => !x.error && x.goodEnough === wanted);
    return { id: c.id, expect: c.expect, source: c.source, right, runs: rs };
  });
  const wrong = results.filter((x) => !x.right);
  return {
    judge: { agent: judgeOpts.agent, model: judgeOpts.model ?? null, effort: judgeOpts.effort ?? null },
    repeat,
    total: results.length,
    right: results.length - wrong.length,
    passCases: { total: results.filter((x) => x.expect === "pass").length, right: results.filter((x) => x.expect === "pass" && x.right).length },
    failCases: { total: results.filter((x) => x.expect === "fail").length, right: results.filter((x) => x.expect === "fail" && x.right).length },
    trusted: wrong.length === 0,
    results,
  };
}
