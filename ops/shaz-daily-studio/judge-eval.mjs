/**
 * Judge eval: can we trust the judge? (Shaz, Phase 2)
 *
 * The judge is a FILTER and a PICKER; Shaz is the final "love" gate in Telegram (decision 2026-11-23).
 * Filter cases are judged alone (one-draft mode), the same way the room judges a rewrite:
 *   - The approved samples in voice-guide.md must PASS the filter (goodEnough true). Each one is
 *     judged with a guide that has THAT sample removed, so the judge can't pass it by recognising it.
 *   - Every script in judge-samples.json "mustFail" must be BLOCKED (goodEnough false), judged with
 *     the full guide, exactly like a real morning.
 * Picker cases show the judge all of one story's drafts that Shaz graded blind; it must pick his
 * favorite. Approved samples built from those drafts are hidden from its guide.
 * A case only counts as right if every repeat got it right: a judge that flips is not trusted.
 * Trusted = every filter case right AND the picker right on at least PICKER_MIN_RIGHT_RATIO of stories.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { judgeCallOptions, parseApprovedSamples, runJudge, voiceGuideWithoutSample } from "./script-room.mjs";

const STUDIO_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const PICKER_MIN_RIGHT_RATIO = 0.75;
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
  const pickerSets = Array.isArray(parsed?.pickerSets) ? parsed.pickerSets : [];
  for (const set of pickerSets) {
    if (!set?.id || !Array.isArray(set.drafts) || set.drafts.length < 2) throw new Error(`${samplesPath}: picker set "${set?.id}" needs at least 2 drafts`);
    if (!set.drafts.some((d) => d.id === set.favorite)) throw new Error(`${samplesPath}: picker set "${set.id}" favorite "${set.favorite}" is not one of its drafts`);
    if (ids.has(set.id)) throw new Error(`${samplesPath}: duplicate id "${set.id}"`);
    ids.add(set.id);
  }
  return { mustFail, pickerSets };
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
  for (const set of samples.pickerSets || []) {
    const guide = (set.hideApproved || []).reduce((g, title) => voiceGuideWithoutSample(g, title), voiceGuide);
    cases.push({
      id: set.id,
      expect: "pick",
      favorite: set.favorite,
      drafts: set.drafts.map((d) => ({ id: d.id, angle: "not given", text: d.text.trim() })),
      guide,
      source: set.story || "",
    });
  }
  return cases;
}

async function judgeOnce(c, { askAgentFn, judgeOpts }) {
  const t0 = Date.now();
  const picking = c.expect === "pick";
  const { verdict, labelled } = await runJudge({
    // The angle is not shown: approved samples never had one, so no case gets a hint.
    drafts: picking ? c.drafts : [{ angle: "not given", text: c.text }],
    voiceGuide: c.guide,
    oneDraftMode: !picking,
    ask: async (prompt) => {
      try {
        return await askAgentFn(prompt, judgeOpts);
      } catch (err) {
        if (err?.name === "AgentUnavailableError") throw err;
        return { __agentError: err?.message || String(err) };
      }
    },
    // Picker sets are shuffled for real so the favorite isn't always in the same slot.
    randomFn: picking ? Math.random : () => 0.5,
  });
  if (picking) {
    const pickedId = labelled.find((d) => d.label === verdict.winner)?.id;
    return {
      pickedId,
      picked: pickedId === c.favorite,
      total: verdict.scores[verdict.winner].total,
      notes: verdict.scores[verdict.winner].notes,
      durationMs: Date.now() - t0,
    };
  }
  const s = verdict.scores.A;
  return {
    goodEnough: verdict.goodEnough,
    judgeGoodEnough: verdict.judgeGoodEnough,
    gate: verdict.gate,
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
    const ok = (x) => !x.error && (c.expect === "pick" ? x.picked === true : x.goodEnough === (c.expect === "pass"));
    const right = rs.length === repeat && rs.every(ok);
    return { id: c.id, expect: c.expect, source: c.source, right, runs: rs };
  });
  const filterWrong = results.filter((x) => x.expect !== "pick" && !x.right);
  const pick = results.filter((x) => x.expect === "pick");
  const pickRight = pick.filter((x) => x.right).length;
  const pickerOk = pick.length === 0 || pickRight >= Math.ceil(pick.length * PICKER_MIN_RIGHT_RATIO);
  const wrong = results.filter((x) => !x.right);
  return {
    judge: { agent: judgeOpts.agent, model: judgeOpts.model ?? null, effort: judgeOpts.effort ?? null },
    repeat,
    total: results.length,
    right: results.length - wrong.length,
    passCases: { total: results.filter((x) => x.expect === "pass").length, right: results.filter((x) => x.expect === "pass" && x.right).length },
    failCases: { total: results.filter((x) => x.expect === "fail").length, right: results.filter((x) => x.expect === "fail" && x.right).length },
    pickCases: { total: pick.length, right: pickRight, needed: Math.ceil(pick.length * PICKER_MIN_RIGHT_RATIO) },
    trusted: filterWrong.length === 0 && pickerOk,
    results,
  };
}
