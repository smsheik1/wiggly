import assert from "node:assert/strict";
import test from "node:test";

import { AgentUnavailableError } from "../../../v3/lib/agent-bridge.ts";
import { buildJudgeEvalCases, loadJudgeSamples, runJudgeEval } from "../judge-eval.mjs";
import {
  judgeCallOptions,
  loadVoiceGuide,
  parseApprovedSamples,
  runScriptRoom,
  voiceGuideWithoutSample,
} from "../script-room.mjs";
import { loadStudioConfig } from "../studio-daily.mjs";

const CFG = { writerAgent: "agy", judgeAgent: "claude", judgeModel: "claude-opus-5-5", judgeEffort: "high", agentTimeoutMs: 60_000 };

function verdictJson(goodEnough) {
  const s = { instantClarity: 7, ownAngle: 7, funny: 7, relatable: 7, endingQuestion: 7, soundsLikeShaz: 7, notes: "n" };
  return { scores: { A: s }, winner: "A", runnerUp: null, goodEnough, rewriteNotes: goodEnough ? "" : "The middle line is flat; cut it." };
}

const draftText = (prompt) => prompt.split("THE DRAFT:\n")[1].split("\n\nScore each draft")[0].replace(/^DRAFT A \(angle: [^)]*\):\n/, "");

test("the real voice guide has the 6 approved samples Shaz loved", async () => {
  const samples = parseApprovedSamples(await loadVoiceGuide());
  assert.equal(samples.length, 6);
  assert.ok(samples.every((s) => s.text.split(/\s+/).length >= 60), "each sample is a full script");
  assert.match(samples[0].title, /Nier/);
});

test("hiding a sample removes only that sample; lessons, other samples and rejects stay", async () => {
  const guide = await loadVoiceGuide();
  const samples = parseApprovedSamples(guide);
  for (const s of samples) {
    const hidden = voiceGuideWithoutSample(guide, s.title);
    assert.ok(!hidden.includes(s.text), `"${s.title}" text is gone`);
    assert.ok(!hidden.includes(`### ${s.title}`), `"${s.title}" heading is gone`);
    for (const other of samples.filter((o) => o !== s)) assert.ok(hidden.includes(other.text), `"${other.title}" stays`);
    assert.match(hidden, /## Lessons/);
    assert.match(hidden, /## Rejected/);
    assert.equal(parseApprovedSamples(hidden).length, samples.length - 1);
  }
  assert.throws(() => voiceGuideWithoutSample(guide, "No such sample"), /no approved sample titled/);
});

test("eval cases: approved samples must pass with themselves hidden; every graded script must fail", async () => {
  const guide = await loadVoiceGuide();
  const samples = await loadJudgeSamples();
  const cases = buildJudgeEvalCases({ voiceGuide: guide, samples });
  const pass = cases.filter((c) => c.expect === "pass");
  const fail = cases.filter((c) => c.expect === "fail");
  assert.equal(pass.length, 6);
  assert.ok(fail.length >= 13, "Shaz's 10 posted scripts + IShowSpeed + 2 early drafts");
  for (const c of pass) assert.ok(!c.guide.includes(c.text), `${c.id}: judge's guide must not contain the sample it grades`);
  for (const c of fail) assert.equal(c.guide, guide, `${c.id}: judged with the full guide, like a real morning`);
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length, "ids are unique");
});

test("judge must be a different agent from the writer, and fails loudly when unset", () => {
  assert.throws(() => judgeCallOptions({ ...CFG, judgeAgent: "agy" }), /both writer and judge/);
  assert.throws(() => judgeCallOptions({ ...CFG, judgeAgent: undefined }), /"judgeAgent"/);
  const opts = judgeCallOptions(CFG);
  assert.deepEqual(opts, { agent: "claude", model: "claude-opus-5-5", effort: "high", timeoutMs: 60_000, requireJson: true, isolated: true });
});

test("studio config: real file pins Claude as judge, agy as writer; same agent is rejected for the room", async () => {
  const cfg = await loadStudioConfig();
  assert.equal(cfg.writerAgent, "agy");
  assert.equal(cfg.judgeAgent, "claude");
  assert.equal(cfg.judgeModel, "claude-opus-5-5");
  assert.notEqual(cfg.judgeAgent, cfg.writerAgent);
});

test("room refuses to start (no agent call) when the judge is the writer", async () => {
  let called = 0;
  await assert.rejects(
    () => runScriptRoom({ title: "x" }, {
      config: { ...CFG, judgeAgent: "agy" },
      askAgentFn: async () => { called += 1; return {}; },
      storyContext: "x",
      voiceGuide: "## Approved samples\n\n### A\nok\n",
    }),
    /both writer and judge/,
  );
  assert.equal(called, 0);
});

test("eval: right answers are trusted; the judge sees only its prompt via isolated claude calls", async () => {
  const guide = await loadVoiceGuide();
  const cases = buildJudgeEvalCases({ voiceGuide: guide, samples: await loadJudgeSamples() });
  const byText = new Map(cases.map((c) => [c.text, c]));
  const seen = [];
  const summary = await runJudgeEval({
    cases,
    config: CFG,
    repeat: 1,
    parallel: 4,
    askAgentFn: async (prompt, opts) => {
      seen.push(opts);
      const c = byText.get(draftText(prompt));
      assert.ok(c, "prompt carries the case text as the one draft");
      assert.equal(prompt.split(c.text).length - 1, 1, `${c.id}: sample appears once (as the draft), never in the guide`);
      return verdictJson(c.expect === "pass");
    },
  });
  assert.equal(summary.trusted, true);
  assert.equal(summary.right, cases.length);
  assert.deepEqual(summary.judge, { agent: "claude", model: "claude-opus-5-5", effort: "high" });
  assert.ok(seen.every((o) => o.agent === "claude" && o.isolated === true && o.requireJson === true));
});

test("eval: one wrong verdict, or a judge that flips between repeats, is not trusted", async () => {
  const guide = await loadVoiceGuide();
  const cases = buildJudgeEvalCases({ voiceGuide: guide, samples: await loadJudgeSamples() });
  const lenient = cases.find((c) => c.expect === "fail");
  const flaky = cases.find((c) => c.expect === "pass");
  let flakyCalls = 0;
  const summary = await runJudgeEval({
    cases,
    config: CFG,
    repeat: 2,
    parallel: 1,
    askAgentFn: async (prompt) => {
      const text = draftText(prompt);
      if (text === lenient.text) return verdictJson(true); // too easy on a "don't post" script
      if (text === flaky.text) { flakyCalls += 1; return verdictJson(flakyCalls === 1); }
      const c = cases.find((x) => x.text === text);
      return verdictJson(c.expect === "pass");
    },
  });
  assert.equal(summary.trusted, false);
  const wrong = summary.results.filter((r) => !r.right).map((r) => r.id).sort();
  assert.deepEqual(wrong, [lenient.id, flaky.id].sort());
  assert.equal(summary.results.find((r) => r.id === flaky.id).runs.length, 2);
});

test("eval: an unreachable judge stops the whole eval loudly (Rule 12), it is never scored as a fail", async () => {
  const guide = await loadVoiceGuide();
  const cases = buildJudgeEvalCases({ voiceGuide: guide, samples: await loadJudgeSamples() });
  await assert.rejects(
    () => runJudgeEval({
      cases,
      config: CFG,
      askAgentFn: async () => { throw new AgentUnavailableError("Not logged in · Please run /login"); },
    }),
    (err) => err instanceof AgentUnavailableError,
  );
});

test("eval: a malformed judge answer is retried once, then counted as wrong (not silently passed)", async () => {
  const guide = await loadVoiceGuide();
  const cases = buildJudgeEvalCases({ voiceGuide: guide, samples: await loadJudgeSamples() }).slice(0, 1);
  let calls = 0;
  const summary = await runJudgeEval({
    cases,
    config: CFG,
    askAgentFn: async () => { calls += 1; return { nope: true }; },
  });
  assert.equal(calls, 2, "one retry");
  assert.equal(summary.trusted, false);
  assert.match(summary.results[0].runs[0].error, /judge gave no valid verdict/);
});
