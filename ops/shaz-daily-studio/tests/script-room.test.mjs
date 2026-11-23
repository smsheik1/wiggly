import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AgentUnavailableError } from "../../../v3/lib/agent-bridge.ts";
import { ScriptAuthorError } from "../errors.mjs";
import { buildJudgePrompt, loadVoiceGuide, runScriptRoom, stripStageMarks } from "../script-room.mjs";
import {
  appendScriptFeedback,
  buildRunnerUpMessage,
  getScriptFeedbackPath,
  parseFeedbackCallback,
  readScriptFeedback,
} from "../script-feedback.mjs";
import { authorShazScript, getScriptRoom } from "../studio-daily.mjs";
import { pollApprovalDecision, pollBatchDecision } from "../telegram-approval.mjs";
import { formatSummary, main as reviewMain, summarizeFeedback } from "../tools/review-script-feedback.mjs";

const NOW = new Date("2026-11-07T12:00:00Z");
const URL = "https://news.example.com/gta6-date";
const ARTICLE = {
  url: URL,
  text: [
    "Rockstar Games confirmed today that Grand Theft Auto VI launches on November 19, 2026 for PlayStation 5 and Xbox Series X consoles.",
    "The base digital edition will retail for $69.99 worldwide with a 120GB storage footprint according to storefront listings.",
    "Analysts expect pre-orders to open across participating retail stores next Monday morning with preload opening forty-eight hours early.",
  ].join(" "),
};
const TOPIC = { title: "Grand Theft Auto VI Confirmed for November 19, 2026", link: URL };
const CFG = { writerAgent: "agy", judgeAgent: "claude", judgeModel: "claude-opus-5-5", judgeEffort: "high", agentTimeoutMs: 60_000, maxScriptAttempts: 3, batchSize: 3, scriptFlow: "room" };
const GUIDE = "# Shaz voice guide\n\n## Approved samples\n\nSample one goes here.\n";

function draft(angle, { landing = "Are you paying $69.99 on day one or waiting until next month?", hook } = {}) {
  return {
    angle,
    title: "GTA 6 Launches November 19",
    sourceUrl: URL,
    primaryInsight: "Rockstar locked the November launch date and base retail pricing globally.",
    claims: [
      { target: "hook", says: "GTA VI launches November 19.", quote: "Rockstar Games confirmed today that Grand Theft Auto VI launches on November 19, 2026" },
      { target: "beat-01", says: "Base edition is $69.99 and 120GB.", quote: "base digital edition will retail for $69.99 worldwide with a 120GB storage footprint" },
    ],
    hook: {
      formula: "surprising-stat",
      text: hook || "Rockstar just confirmed GTA six launches in 12 days on console, and your home storage drive is officially cooked right now.",
    },
    beats: [
      { connector: "THEREFORE", text: "Clear out 120GB right now because the base digital edition alone costs $69.99 worldwide." },
      { connector: "BUT", text: "At least pre-orders open across retail stores Monday morning so you still have time to budget." },
      { connector: "THEREFORE", text: "Delete three bloated shooters tonight [pause] before everybody else starts downloading Vice City at launch." },
    ],
    landing: { type: "question", text: landing },
  };
}

const PAPERWORK = {
  headline: "GTA 6 NOVEMBER LAUNCH",
  hook: { cardHeadline: "GTA 6 IS DATED", cardBadge: "NOV 19" },
  beats: [
    { id: "beat-01", shotTypeSuggestion: "talk-to-camera", cardHeadline: "120GB DOWNLOAD", cardBadge: "$69.99" },
    { id: "beat-02", shotTypeSuggestion: "b-roll", cardHeadline: "PRE-ORDERS MONDAY", cardBadge: "RETAIL" },
    { id: "beat-03", shotTypeSuggestion: "chibi-commentary", cardHeadline: "DELETE SHOOTERS", cardBadge: "TONIGHT" },
  ],
  visualQueries: ["GTA VI key art", "PS5 console", "Xbox Series X console", "Vice City screenshot", "Rockstar Games logo", "SSD storage full", "GTA pre-order store"],
  backgroundId: "living-room",
  hashtags: ["#gta6", "#ps5"],
};

function verdict(labels, { winner = labels[0], runnerUp = labels[1] ?? null, goodEnough = true, rewriteNotes = "" } = {}) {
  const scores = {};
  for (const l of labels) {
    scores[l] = { instantClarity: 8, ownAngle: 8, funny: 7, relatable: 8, endingQuestion: 8, soundsLikeShaz: 7, notes: "ok" };
  }
  return { scores, winner, runnerUp, goodEnough, rewriteNotes };
}

function labelsIn(prompt) {
  return [...prompt.matchAll(/^DRAFT ([A-Z]) \(angle/gm)].map((m) => m[1]);
}

/** Routes the mock agent by which step's prompt it got. */
function makeAgent(handlers) {
  const calls = [];
  const fn = async (prompt, opts) => {
    calls.push({ prompt, opts });
    if (prompt.includes("You are the filter and picker")) return handlers.judge(prompt, labelsIn(prompt), calls);
    if (prompt.includes("A strict judge read")) return handlers.rewrite(prompt, calls);
    if (prompt.includes("spoken script below is FINAL")) return handlers.paperwork(prompt, calls);
    return handlers.drafts(prompt, calls);
  };
  fn.calls = calls;
  return fn;
}

const ROOM_OPTS = (askAgentFn, extra = {}) => ({
  article: ARTICLE,
  now: NOW,
  config: CFG,
  askAgentFn,
  storyContext: `Headline: "${TOPIC.title}"`,
  voiceGuide: GUIDE,
  randomFn: () => 0.5,
  log: { warn() {} },
  ...extra,
});

test("stripStageMarks removes [pause] without leaving double spaces", () => {
  assert.equal(stripStageMarks('first word is "delve". [pause] And every answer'), 'first word is "delve". And every answer');
  assert.equal(stripStageMarks("a [PAUSE] b"), "a b");
});

test("the real voice guide loads and has approved samples", async () => {
  const guide = await loadVoiceGuide();
  assert.match(guide, /## Approved samples/);
});

test("happy path: 3 drafts -> blind judge -> paperwork; spoken words are locked", async () => {
  const agent = makeAgent({
    drafts: () => ({ drafts: [draft("Storage is the real boss fight"), draft("The price is the scary part"), draft("Pre-order panic is the joke")] }),
    judge: (_p, labels) => verdict(labels, { winner: labels[1], runnerUp: labels[2] }),
    paperwork: () => PAPERWORK,
  });
  const { script, receipt, room } = await runScriptRoom(TOPIC, ROOM_OPTS(agent));

  assert.equal(agent.calls.length, 3, "drafts + judge + paperwork");
  assert.ok(agent.calls.every((c) => c.opts.requireJson === true));
  // Writer (drafts, paperwork) = agy; judge = a different model (Claude), isolated from project files.
  const [draftCall, judgeCall, paperCall] = agent.calls;
  assert.equal(draftCall.opts.agent, "agy");
  assert.equal(paperCall.opts.agent, "agy");
  assert.equal(judgeCall.opts.agent, "claude");
  assert.equal(judgeCall.opts.model, "claude-opus-5-5");
  assert.equal(judgeCall.opts.effort, "high");
  assert.equal(judgeCall.opts.isolated, true);
  assert.equal(draftCall.opts.isolated, undefined, "the writer call is unchanged");
  assert.equal(receipt.judgeAgent, "claude");
  assert.equal(receipt.judgeModel, "claude-opus-5-5");
  assert.deepEqual(receipt.attempts.map((a) => a.agent), ["agy", "claude", "agy"]);
  assert.equal(room.drafts.length, 3);
  assert.ok(room.winner.angle && room.runnerUp.angle && room.winner.angle !== room.runnerUp.angle);
  assert.equal(script.headline, "GTA 6 NOVEMBER LAUNCH");
  assert.equal(script.visualQueries.length, 7);
  assert.equal(script.beats[2].shotTypeSuggestion, "chibi-commentary");
  assert.doesNotMatch(JSON.stringify(script), /\[pause\]/i, "[pause] is stripped until pause timing ships");
  assert.match(room.drafts[0].originalSpoken, /\[pause\]/, "the original text is kept in the room record");
  assert.equal(receipt.flow, "script-room");
  assert.deepEqual(receipt.attempts.map((a) => a.stage), ["draft-round-1", "judge", "paperwork"]);
  assert.equal(room.rewrite, null);
});

test("the judge is blind: it gets only labels and angles, not the writer or draft order", async () => {
  const prompt = buildJudgePrompt({
    voiceGuide: GUIDE,
    labelled: [{ label: "A", angle: "one", text: "text one" }, { label: "B", angle: "two", text: "text two" }],
  });
  assert.doesNotMatch(prompt, /\bagy\b|\bclaude\b|first draft|^DRAFT \d/im);
  assert.match(prompt, /You did not write these scripts/);
});

test("a draft that fails the checks gets the exact error and a replacement round", async () => {
  let round = 0;
  const agent = makeAgent({
    drafts: (prompt) => {
      round += 1;
      if (round === 1) {
        return {
          drafts: [
            draft("Storage is the real boss fight"),
            draft("The price is the scary part"),
            draft("This one uses a banned tell", { landing: "Let that sink in. Are you paying $69.99 on day one?" }),
          ],
        };
      }
      assert.match(prompt, /let that sink in/i, "the exact failure is fed back");
      assert.match(prompt, /Do NOT reuse these angles/);
      return { drafts: [draft("Pre-order panic is the joke")] };
    },
    judge: (_p, labels) => verdict(labels),
    paperwork: () => PAPERWORK,
  });
  const { room } = await runScriptRoom(TOPIC, ROOM_OPTS(agent));
  assert.equal(room.drafts.length, 3);
  assert.equal(room.rejectedDrafts.length, 1);
  assert.equal(round, 2);
});

test("duplicate angles are rejected", async () => {
  let round = 0;
  const agent = makeAgent({
    drafts: () => {
      round += 1;
      return round === 1
        ? { drafts: [draft("Same angle here"), draft("same angle here"), draft("Another angle entirely")] }
        : { drafts: [draft("A third fresh angle")] };
    },
    judge: (_p, labels) => verdict(labels),
    paperwork: () => PAPERWORK,
  });
  const { room } = await runScriptRoom(TOPIC, ROOM_OPTS(agent));
  assert.equal(new Set(room.drafts.map((d) => d.angle.toLowerCase())).size, 3);
});

test("not good enough -> one rewrite with the judge's notes -> good -> ships the rewrite", async () => {
  let judged = 0;
  const agent = makeAgent({
    drafts: () => ({ drafts: [draft("Storage is the real boss fight"), draft("The price is the scary part"), draft("Pre-order panic is the joke")] }),
    judge: (_p, labels) => {
      judged += 1;
      return judged === 1
        ? verdict(labels, { goodEnough: false, rewriteNotes: "The hook is generic. Make the storage joke land in the first line." })
        : verdict(labels, { runnerUp: null });
    },
    rewrite: (prompt) => {
      assert.match(prompt, /Make the storage joke land/);
      return { drafts: [draft("Storage is the real boss fight, sharper", { hook: "GTA six is 120 gigs, so your PS5 is about to delete your whole childhood in 12 days." })] };
    },
    paperwork: () => PAPERWORK,
  });
  const { script, room } = await runScriptRoom(TOPIC, ROOM_OPTS(agent));
  assert.equal(room.winner.label, "R");
  assert.ok(room.rewrite);
  assert.match(script.hook.text, /delete your whole childhood/);
  assert.ok(room.runnerUp, "runner-up from the first judging is still shown to Shaz");
});

test("still not good after one rewrite -> skip the story; drafts are kept on the error", async () => {
  const agent = makeAgent({
    drafts: () => ({ drafts: [draft("Storage is the real boss fight"), draft("The price is the scary part"), draft("Pre-order panic is the joke")] }),
    judge: (_p, labels) => verdict(labels, { runnerUp: labels.length > 1 ? labels[1] : null, goodEnough: false, rewriteNotes: "Still not funny enough for Shaz." }),
    rewrite: () => ({ drafts: [draft("Storage is the real boss fight, again")] }),
    paperwork: () => PAPERWORK,
  });
  const err = await runScriptRoom(TOPIC, ROOM_OPTS(agent)).catch((e) => e);
  assert.ok(err instanceof ScriptAuthorError && /after one rewrite/.test(err.message));
  assert.equal(err.room.drafts.length, 3);
  assert.match(err.room.rewrite.text, /120GB/);
  assert.equal(agent.calls.filter((c) => c.prompt.includes("A strict judge read")).length, 1, "only one rewrite");
});

test("writer prompts carry the hard rules (no explainer lines, 1-3 word ending question)", async () => {
  const agent = makeAgent({
    drafts: () => ({ drafts: [draft("Storage is the real boss fight"), draft("The price is the scary part"), draft("Pre-order panic is the joke")] }),
    judge: (_p, labels) => verdict(labels),
    paperwork: () => PAPERWORK,
  });
  await runScriptRoom(TOPIC, ROOM_OPTS(agent));
  assert.match(agent.calls[0].prompt, /NO EXPLAINER LINES/);
  assert.match(agent.calls[0].prompt, /ANSWERABLE IN 1-3 WORDS/);
  assert.doesNotMatch(agent.calls[1].prompt, /HARD RULES/, "the judge keeps its own criteria");
});

test("paperwork missing image searches is retried with the error", async () => {
  let n = 0;
  const agent = makeAgent({
    drafts: () => ({ drafts: [draft("Storage is the real boss fight"), draft("The price is the scary part"), draft("Pre-order panic is the joke")] }),
    judge: (_p, labels) => verdict(labels),
    paperwork: (prompt) => {
      n += 1;
      if (n === 1) return { ...PAPERWORK, visualQueries: ["one"] };
      assert.match(prompt, /visualQueries must list at least 5/);
      return PAPERWORK;
    },
  });
  const { script } = await runScriptRoom(TOPIC, ROOM_OPTS(agent));
  assert.equal(script.visualQueries.length, 7);
});

test("AgentUnavailableError stops the run immediately (no fallback)", async () => {
  const agent = async () => {
    throw new AgentUnavailableError("agy is not installed");
  };
  await assert.rejects(() => runScriptRoom(TOPIC, ROOM_OPTS(agent)), (err) => err instanceof AgentUnavailableError);
});

test("authorShazScript uses the script room when scriptFlow is 'room' and attaches the room record", async () => {
  const agent = makeAgent({
    drafts: () => ({ drafts: [draft("Storage is the real boss fight"), draft("The price is the scary part"), draft("Pre-order panic is the joke")] }),
    judge: (_p, labels) => verdict(labels),
    paperwork: () => PAPERWORK,
  });
  const script = await authorShazScript(TOPIC, { now: NOW, article: ARTICLE, config: CFG, askAgentFn: agent });
  const room = getScriptRoom(script);
  assert.ok(room?.runnerUp);
  assert.equal(Object.keys(script).includes("room"), false, "room is not serialized into script.json");
  assert.match(agent.calls[0].prompt, /VOICE GUIDE/);
});

// ---------------------------------------------------------------- feedback

test("feedback callbacks parse only ru:/wr:", () => {
  assert.deepEqual(parseFeedbackCallback("ru:daily-1"), { vote: "runner-up-better", runId: "daily-1" });
  assert.deepEqual(parseFeedbackCallback("wr:daily-1"), { vote: "winner-right", runId: "daily-1" });
  assert.equal(parseFeedbackCallback("approve:daily-1"), null);
});

test("runner-up message escapes HTML, uses short callback data, and has no buttons in dry run", () => {
  const room = { winner: { angle: "A <b>" }, runnerUp: { angle: "B & C", text: "Script <with> & stuff" } };
  const live = buildRunnerUpMessage({ room, runId: "daily-2026-11-20-abcd1234", candidateNumber: 2 });
  assert.match(live.text, /Candidate 2/);
  assert.match(live.text, /Script &lt;with&gt; &amp; stuff/);
  const [ru, wr] = live.replyMarkup.inline_keyboard[0];
  assert.equal(ru.callback_data, "ru:daily-2026-11-20-abcd1234");
  assert.equal(wr.callback_data, "wr:daily-2026-11-20-abcd1234");
  assert.ok(Buffer.byteLength(ru.callback_data) <= 64, "Telegram limit");
  assert.equal(buildRunnerUpMessage({ room, runId: "x", dryRun: true }).replyMarkup, undefined);
  assert.equal(buildRunnerUpMessage({ room: { runnerUp: null }, runId: "x" }), null);
});

test("feedback is appended to <studio home>/script-feedback.jsonl with both scripts", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-fb-"));
  try {
    const env = { WIGGLY_STUDIO_HOME: home };
    const runDir = path.join(home, "run");
    await fs.mkdir(runDir);
    await fs.writeFile(path.join(runDir, "script-room.json"), JSON.stringify({
      winner: { angle: "w", text: "winner text" },
      runnerUp: { angle: "r", text: "runner text" },
      judge: { scores: { A: { total: 40 } } },
      rewrite: null,
    }));
    await appendScriptFeedback({ vote: "runner-up-better", runId: "r1", runDirectory: runDir, title: "T", env });
    await appendScriptFeedback({ vote: "winner-right", runId: "r2", env });
    assert.equal(getScriptFeedbackPath(env), path.join(home, "script-feedback.jsonl"));
    const entries = await readScriptFeedback({ env });
    assert.equal(entries.length, 2);
    assert.equal(entries[0].runnerUp.text, "runner text");
    assert.equal(entries[1].winner, null);
    await assert.rejects(() => appendScriptFeedback({ vote: "approve", runId: "x", env }), /Unknown script feedback vote/);

    const summary = summarizeFeedback(entries);
    assert.equal(summary.runnerUpBetter, 1);
    assert.equal(summary.winnerRight, 1);
    assert.match(formatSummary(summary, 7), /Judge agreement: 50%/);

    const logs = [];
    const origLog = console.log;
    console.log = (m) => logs.push(m);
    try {
      const { summary: s2 } = await reviewMain([], { env, now: new Date() });
      assert.equal(s2.total, 2);
    } finally {
      console.log = origLog;
    }
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
});

function telegramHarness(updatesByStep) {
  const answers = [];
  let step = 0;
  let nowMs = Date.parse("2026-11-20T15:00:00Z");
  return {
    answers,
    common: {
      token: "123456:TEST_BOT_TOKEN_SENTINEL",
      chatId: "999999",
      operatorUserId: "777777",
      env: {},
      secretsPath: null,
      deadline: new Date(nowMs + 60_000),
      nowFn: () => new Date(nowMs),
      sleepFn: async () => {
        nowMs += 1000;
      },
      fetchFn: async (url, init) => {
        const u = String(url);
        if (u.includes("/getUpdates")) {
          const result = updatesByStep[step] || [];
          step += 1;
          return { ok: true, status: 200, json: async () => ({ ok: true, result }) };
        }
        if (u.includes("/answerCallbackQuery")) answers.push(JSON.parse(init.body));
        return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
      },
    },
  };
}

const tap = (id, data) => ({
  update_id: id,
  callback_query: { id: `cb${id}`, from: { id: 777777 }, message: { chat: { id: 999999 }, message_id: 5 }, data },
});

test("pollBatchDecision logs feedback taps and keeps waiting; feedback never picks", async () => {
  const h = telegramHarness([[tap(1, "ru:r1"), tap(2, "wr:old-run")], [tap(3, "approve:r2")]]);
  const feedback = [];
  const decision = await pollBatchDecision({
    ...h.common,
    candidates: [{ runId: "r1", title: "One" }, { runId: "r2", title: "Two" }],
    onScriptFeedback: (e) => feedback.push(e),
  });
  assert.equal(decision.status, "approved");
  assert.equal(decision.runId, "r2");
  assert.deepEqual(feedback.map((f) => [f.vote, f.runId]), [["runner-up-better", "r1"]]);
  assert.match(h.answers[0].text, /runner-up was better/);
  assert.match(h.answers[1].text, /expired/, "feedback for an unknown run is treated as stale");
});

test("pollApprovalDecision logs feedback taps too", async () => {
  const h = telegramHarness([[tap(1, "wr:solo")], [tap(2, "approve:solo")]]);
  const feedback = [];
  const decision = await pollApprovalDecision({ ...h.common, runId: "solo", onScriptFeedback: (e) => feedback.push(e) });
  assert.equal(decision, "approved");
  assert.equal(feedback[0].vote, "winner-right");
});

test("a failed feedback save is reported to Shaz, not swallowed", async () => {
  const h = telegramHarness([[tap(1, "ru:r1")], [tap(2, "reject:r1")]]);
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    await pollBatchDecision({
      ...h.common,
      candidates: [{ runId: "r1", title: "One" }],
      onScriptFeedback: () => {
        throw new Error("disk full");
      },
    });
  } finally {
    console.warn = origWarn;
  }
  assert.match(h.answers[0].text, /Could not save/);
});

test("a skipped story (judge gives no valid verdict) keeps its drafts on the error", async () => {
  const agent = makeAgent({
    drafts: () => ({ drafts: [draft("Storage is the real boss fight"), draft("The price is the scary part"), draft("Pre-order panic is the joke")] }),
    judge: () => ({ nonsense: true }),
    paperwork: () => PAPERWORK,
  });
  const err = await runScriptRoom(TOPIC, ROOM_OPTS(agent)).catch((e) => e);
  assert.ok(err instanceof ScriptAuthorError);
  assert.equal(err.room.skipped, true);
  assert.equal(err.room.drafts.length, 3);
});
