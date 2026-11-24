/**
 * Script room: the daily studio's writing flow (Shaz decisions, 2026-11-20).
 *
 *   1. Draft    : the pinned writer agent writes 3 drafts, each with a different angle,
 *                 spoken words only (no cards / image queries / tags yet).
 *   2. Judge    : a fresh agent call sees only the voice guide and the drafts, blind
 *                 (shuffled, labelled A/B/C), scores them, picks a winner + runner-up.
 *   3. Rewrite  : if the judge says none is good enough, ONE rewrite with the judge's
 *                 notes, judged again. Still weak -> skip the story ("fine" never posts).
 *   4. Paperwork: a separate call adds headline, card text, image queries, room, tags,
 *                 without touching a single spoken word.
 *
 * No template fallback (Rule 13). Agent unavailable -> AgentUnavailableError (run stop).
 * Bad output / failed checks -> exact error fed back; exhausted -> ScriptAuthorError (skip).
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AgentUnavailableError } from "../../v3/lib/agent-bridge.ts";
import { countWords, validateScript } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/validate-script.mjs";
import { ScriptAuthorError } from "./errors.mjs";

const STUDIO_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VOICE_GUIDE_PATH = path.join(STUDIO_ROOT, "voice-guide.md");

export const SCRIPT_ROOM_DEFAULTS = Object.freeze({
  draftCount: 3,
  minWords: 70,
  maxWords: 85,
  hardMaxWords: 88,
  maxDraftRounds: 3,
  maxPaperworkAttempts: 2,
  maxJudgeAttempts: 2,
});

const HOOK_FORMULAS = ["uncomfortable-truth", "surprising-stat", "personal-confession", "setup-payoff-tease"];
const LANDING_TYPES = ["question", "reframe", "challenge", "twist"];
const JUDGE_CRITERIA = ["instantClarity", "ownAngle", "funny", "relatable", "endingQuestion", "soundsLikeShaz"];

export async function loadVoiceGuide(guidePath = DEFAULT_VOICE_GUIDE_PATH) {
  const text = await fs.readFile(guidePath, "utf8");
  if (!text.includes("## Approved samples")) {
    throw new Error(`Voice guide at ${guidePath} has no "## Approved samples" section.`);
  }
  return text;
}

function approvedSection(guide) {
  const start = guide.indexOf("## Approved samples");
  if (start < 0) throw new Error('voice guide has no "## Approved samples" section');
  const after = guide.indexOf("\n## ", start + 1);
  return { start, end: after < 0 ? guide.length : after + 1 };
}

/**
 * Lists the approved samples in the voice guide: one per "### <title>" heading.
 * @returns {{ title: string, text: string }[]}
 */
export function parseApprovedSamples(guide) {
  const { start, end } = approvedSection(guide);
  const body = guide.slice(start, end);
  return [...body.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |^## |(?![\s\S]))/gm)]
    .map((m) => ({ title: m[1].trim(), text: m[2].trim() }))
    .filter((s) => s.text);
}

/**
 * The voice guide with one approved sample taken out, so the judge cannot pass that
 * sample just by recognising it (Shaz decision 2026-11-20, judge eval).
 */
export function voiceGuideWithoutSample(guide, title) {
  const { start, end } = approvedSection(guide);
  const section = guide.slice(start, end);
  const heading = `### ${title}\n`;
  const at = section.indexOf(heading);
  if (at < 0) throw new Error(`voice guide has no approved sample titled "${title}"`);
  const next = section.indexOf("\n### ", at + heading.length);
  const cut = section.slice(0, at) + (next < 0 ? "" : section.slice(next + 1));
  return guide.slice(0, start) + cut + guide.slice(end);
}

/** Judge defaults: a different model from the writer (Shaz decision 2026-11-20: Claude judges, agy writes). */
export const JUDGE_DEFAULTS = Object.freeze({ judgeAgent: "claude", judgeModel: "claude-opus-5-5", judgeEffort: "high" });

/**
 * Agent options for every judge call. Refuses a judge that is the same agent as the writer:
 * a writer grading its own drafts is the bias this whole step exists to remove.
 */
export function judgeCallOptions(cfg) {
  const judgeAgent = cfg?.judgeAgent;
  if (judgeAgent !== "agy" && judgeAgent !== "claude") {
    throw new Error(
      `studio.config.json "judgeAgent" is '${judgeAgent}', expected "claude" or "agy".\n` +
      `Fix: open ops/shaz-daily-studio/studio.config.json and add "judgeAgent": "claude".`,
    );
  }
  if (judgeAgent === cfg.writerAgent) {
    throw new Error(
      `studio.config.json uses '${judgeAgent}' as both writer and judge. The judge must be a different model.\n` +
      `Fix: open ops/shaz-daily-studio/studio.config.json and set "judgeAgent" to the agent that is NOT "${cfg.writerAgent}".`,
    );
  }
  return {
    agent: judgeAgent,
    ...(cfg.judgeModel ? { model: cfg.judgeModel } : {}),
    ...(cfg.judgeEffort ? { effort: cfg.judgeEffort } : {}),
    timeoutMs: cfg.agentTimeoutMs,
    requireJson: true,
    isolated: true,
  };
}

/**
 * Removes stage marks the voice step cannot speak yet. `[pause]` timing is a separate
 * feature; until it lands, marks are stripped before checks and voice so "pause" is
 * never read aloud. The original text is kept in the room record.
 */
export function stripStageMarks(text) {
  return String(text || "").replace(/\s*\[pause\]\s*/gi, " ").replace(/\s{2,}/g, " ").trim();
}

function spokenText(draft) {
  return [draft?.hook?.text, ...(draft?.beats || []).map((b) => b?.text), draft?.landing?.text]
    .filter(Boolean)
    .join(" ");
}

function sha256(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex");
}

/** Turns a raw draft from the agent into a shaz-script-v1 object (spoken parts only). */
export function normalizeDraft(raw, { topic, article, index }) {
  if (!raw || typeof raw !== "object") throw new Error(`draft ${index + 1} is not an object`);
  const angle = String(raw.angle || "").trim();
  if (angle.length < 10) throw new Error(`draft ${index + 1}: "angle" must say the take in a sentence`);
  const beatsIn = Array.isArray(raw.beats) ? raw.beats : [];
  if (beatsIn.length < 1 || beatsIn.length > 4) {
    throw new Error(`draft ${index + 1}: needs 1 to 4 beats (found ${beatsIn.length})`);
  }
  const originalSpoken = spokenText(raw);
  const script = {
    schemaVersion: "shaz-script-v1",
    sourceUrl: String(raw.sourceUrl || article?.url || topic?.link || "").trim(),
    title: String(raw.title || topic?.title || "").trim(),
    targetDurationSeconds: 30,
    research: {
      primaryInsight: String(raw.primaryInsight || angle).trim(),
      counterintuitiveAngle: angle,
      concreteFactOrStory: String(raw.concreteFact || raw.primaryInsight || angle).trim(),
    },
    claims: Array.isArray(raw.claims) ? raw.claims : [],
    hook: {
      formula: HOOK_FORMULAS.includes(raw?.hook?.formula) ? raw.hook.formula : String(raw?.hook?.formula || ""),
      text: stripStageMarks(raw?.hook?.text),
    },
    beats: beatsIn.map((b, i) => ({
      id: `beat-${String(i + 1).padStart(2, "0")}`,
      connector: i === 0 ? (["THEREFORE", "BUT", "NONE"].includes(b?.connector) ? b.connector : "NONE") : b?.connector,
      text: stripStageMarks(b?.text),
      impliedQuestion: String(b?.impliedQuestion || "What happens next?").trim(),
    })),
    landing: {
      type: LANDING_TYPES.includes(raw?.landing?.type) ? raw.landing.type : String(raw?.landing?.type || ""),
      text: stripStageMarks(raw?.landing?.text),
    },
  };
  return { script, angle, originalSpoken };
}

function validateSpoken(script, { topic, now, article, requireGroundedClaims, limits }) {
  validateScript(script, {
    topic,
    now,
    minWords: limits.minWords,
    maxWords: limits.hardMaxWords,
    articleText: article?.text ?? null,
    requireGroundedClaims,
  });
}

// ---------------------------------------------------------------- prompts

/**
 * Hard writer rules, learned from the judge's repeated notes on the first real trial (2026-11-20).
 * The judge rejected every story for the same few mistakes, so the writer gets them up front.
 */
export const WRITER_HARD_RULES = `HARD RULES (the judge rejects drafts that break these):
1. NO EXPLAINER LINES. Every sentence is a joke, a roast, or Shaz's reaction. Never summarize the news like a tech review ("New AI tech doubled the frames...", "The budget box runs the game but..."). State a fact only inside the joke that spins it.
2. THE ENDING QUESTION IS ANSWERABLE IN 1-3 WORDS: a pick between two things, a yes/no, a name, a number. It calls back to the joke. Good: "Buy it now or wait?" / "What did your parents play in the car?" Bad: anything that needs a story ("What's the most unhinged thing you've ever done...").
3. CASUAL-VIEWER WORDS ONLY. Use the name everyone knows, not the insider or code name. No tech terms (DLSS, frame generation, upscaling, latency) unless you instantly compare them to something everyday.
4. NO STOCK GAMER JOKES. "Pray to the PR gods", "crash before the road renders", "my wallet is crying" are what anyone would say. Shaz's angle must be specific to THIS story.
5. ESCALATE. Each beat is sharper or sillier than the last. The biggest laugh is near the end, and it gets [pause] right after it.
6. VIVID, EVERYDAY COMPARISONS beat abstract ones: "my landlord says the same thing about rent".
Before you output, reread every sentence of every draft and ask: "Is this a joke or a reaction?" If it's information, rewrite it.`;

const DRAFT_SHAPE = `{
  "drafts": [
    {
      "angle": "<Shaz's own take in one sentence>",
      "title": "<story title>",
      "sourceUrl": "<the source URL>",
      "primaryInsight": "<the one fact the take is built on>",
      "claims": [
        { "target": "hook", "says": "<what the hook claims>", "quote": "<exact 4-30 word quote copied from the article>" },
        { "target": "beat-01", "says": "<what beat-01 claims>", "quote": "<exact 4-30 word quote copied from the article>" }
      ],
      "hook": { "formula": "<uncomfortable-truth | surprising-stat | personal-confession | setup-payoff-tease>", "text": "<opening line(s)>" },
      "beats": [ { "connector": "<THEREFORE | BUT>", "text": "<spoken line(s)>" } ],
      "landing": { "type": "<question | reframe | challenge | twist>", "text": "<ending>" }
    }
  ]
}`;

export function buildDraftsPrompt({ storyContext, voiceGuide, draftCount, limits, avoidAngles = [] }) {
  return `You are the writer for Shaz, a cartoon gamer who roasts the games and tech industry on YouTube Shorts, Instagram Reels and TikTok.

THE VOICE GUIDE BELOW IS THE TARGET. Its approved samples are scripts Shaz loved. Match that voice. Follow every lesson.
<<<VOICE GUIDE
${voiceGuide}
VOICE GUIDE>>>

THE STORY:
${storyContext}

TASK: write ${draftCount} complete drafts of a ~30-second script about this story.
- Each draft MUST use a DIFFERENT angle (Shaz's own take). Not the same joke reworded.${avoidAngles.length ? `\n- Do NOT reuse these angles (already written): ${avoidAngles.map((a) => `"${a}"`).join("; ")}.` : ""}
- Spoken words only for now: hook, 1-4 beats, landing. No card text, image queries, tags or rooms yet.
- ${limits.minWords}-${limits.maxWords} spoken words per draft (hook + beats + landing). Count them.
- Every draft ends on a question the viewer already has an answer to (1-3 words), calling back to the joke. A draft that doesn't end on a question is rejected.
- Introduce anything unknown in a few words, and compare unknown products to famous ones.
- Every line must land instantly for a casual viewer. No niche jargon, no metaphors that need decoding.
- Facts only from the article. 2-5 claims, at least one targeting "hook", each with an exact quote from the article.
- You may put [pause] right after a punchline word that needs a beat of silence.

${WRITER_HARD_RULES}

Output ONLY valid JSON in this shape:
${DRAFT_SHAPE}`;
}

export function buildDraftRepairSuffix(failures) {
  return `\n\nSome drafts failed the automatic checks. Write ${failures.length} replacement draft(s), each with a NEW angle different from the ones that passed. Avoid these exact problems:\n${failures
    .map((f) => `- Angle "${f.angle || "(none)"}": ${f.error}`)
    .join("\n")}`;
}

export function buildJudgePrompt({ voiceGuide, labelled, oneDraftMode = false }) {
  const list = labelled.map((d) => `DRAFT ${d.label} (angle: ${d.angle}):\n${d.text}`).join("\n\n");
  return `You are the filter and picker for Shaz, a cartoon gamer who roasts the games and tech industry on short videos. You did not write these scripts.
Shaz makes the final call himself: he reviews every script you let through and only posts the ones he loves. You do two jobs (Shaz decision 2026-11-23):

1. PICK: "winner" is the draft Shaz is most likely to love${oneDraftMode ? "" : ', and "runnerUp" is the next best'}. Compare against the "Approved samples" in the voice guide: those are scripts Shaz loved.
2. FILTER: "goodEnough" says whether the winner is worth Shaz's time. Set it false ONLY for a clear problem a viewer would feel:
   - it reads like a news summary with a joke stapled on, or most lines are information, not jokes;
   - it has no take of its own (anyone could have written it);
   - a line would confuse a casual viewer;
   - it simply isn't funny;
   - the ending isn't a quick question the viewer can answer in a few words.
   Do NOT fail a draft for a nitpick, for something the approved samples themselves do, or for facts, names or numbers you can't check (you don't see the article; assume they're right). When it's close, pass it: Shaz decides.

THE VOICE GUIDE (Shaz's own taste, built from his reactions):
<<<VOICE GUIDE
${voiceGuide}
VOICE GUIDE>>>

${oneDraftMode ? "THE DRAFT:" : "THE DRAFTS:"}
${list}

Score each draft 1-10 on: instantClarity (every line lands for a casual viewer), ownAngle (Shaz has his own take, not a borrowed one), funny, relatable (relatable over clever), endingQuestion (easy to answer, calls back to the joke), soundsLikeShaz (matches the approved samples).
"goodEnough" is the filter call on the ${oneDraftMode ? "draft" : "winner"} (see job 2). If false, write concrete "rewriteNotes" naming the weak lines and what to do instead.

Output ONLY valid JSON:
{
  "scores": { ${labelled.map((d) => `"${d.label}": { ${JUDGE_CRITERIA.map((c) => `"${c}": <1-10>`).join(", ")}, "notes": "<one sentence>" }`).join(", ")} },
  "winner": "<${labelled.map((d) => d.label).join(" | ")}>",
  "runnerUp": ${oneDraftMode ? "null" : `"<a different label>"`},
  "goodEnough": <true | false>,
  "rewriteNotes": "<empty if goodEnough, else specific notes>"
}`;
}

export function buildRewritePrompt({ storyContext, voiceGuide, best, judgeNotes, limits }) {
  return `You are the writer for Shaz. A strict judge read your best draft and said it is not good enough yet.

<<<VOICE GUIDE
${voiceGuide}
VOICE GUIDE>>>

THE STORY:
${storyContext}

YOUR BEST DRAFT (angle: ${best.angle}):
${best.text}

JUDGE NOTES (fix every one):
${judgeNotes}

${WRITER_HARD_RULES}

Write ONE improved draft. Fix every judge note. You may keep the angle or sharpen it. ${limits.minWords}-${limits.maxWords} spoken words. Same rules as before: facts only from the article, exact quotes in claims, at least one claim on "hook".

Output ONLY valid JSON in this shape (exactly one draft):
${DRAFT_SHAPE}`;
}

export function buildPaperworkPrompt({ storyContext, script }) {
  const spoken = [
    `HOOK: ${script.hook.text}`,
    ...script.beats.map((b) => `${b.id.toUpperCase()}: ${b.text}`),
    `LANDING: ${script.landing.text}`,
  ].join("\n");
  return `The spoken script below is FINAL. Do not change, add or remove a single spoken word. Your job is only the on-screen and publishing details.

THE STORY:
${storyContext}

FINAL SPOKEN SCRIPT:
${spoken}

Output ONLY valid JSON:
{
  "headline": "<punchy 3-5 word UPPERCASE top card title, max 32 chars, never cut a word>",
  "hook": { "cardHeadline": "<3-5 words>", "cardBadge": "<1-2 words>" },
  "beats": [ ${script.beats.map((b) => `{ "id": "${b.id}", "shotTypeSuggestion": "<talk-to-camera | b-roll | chibi-commentary | text-card>", "cardHeadline": "<3-5 words>", "cardBadge": "<1-2 words>" }`).join(", ")} ],
  "visualQueries": ["<7 exact image searches for the named products, companies, people and moments in this script, in the order they are mentioned>"],
  "backgroundId": "<living-room | map-photo-zone | sisters-room>",
  "hashtags": ["#<3-5 lowercase topic tags>"]
}`;
}

// ---------------------------------------------------------------- flow

function shuffleLabels(drafts, randomFn) {
  const order = drafts.map((d, i) => ({ d, k: randomFn(), i })).sort((a, b) => a.k - b.k);
  return order.map((o, idx) => ({ ...o.d, label: String.fromCharCode(65 + idx) }));
}

function parseJudge(raw, labels, { oneDraftMode }) {
  if (!raw || typeof raw !== "object") throw new Error("judge output is not a JSON object");
  if (!labels.includes(raw.winner)) throw new Error(`judge "winner" must be one of ${labels.join(", ")}`);
  if (!oneDraftMode && labels.length > 1) {
    if (!labels.includes(raw.runnerUp) || raw.runnerUp === raw.winner) {
      throw new Error(`judge "runnerUp" must be a different label from ${labels.join(", ")}`);
    }
  }
  if (typeof raw.goodEnough !== "boolean") throw new Error('judge "goodEnough" must be true or false');
  const scores = {};
  for (const label of labels) {
    const s = raw.scores?.[label];
    if (!s || typeof s !== "object") throw new Error(`judge is missing scores for draft ${label}`);
    const entry = { notes: String(s.notes || "") };
    let total = 0;
    for (const c of JUDGE_CRITERIA) {
      const v = Number(s[c]);
      if (!Number.isFinite(v) || v < 1 || v > 10) throw new Error(`judge score ${label}.${c} must be 1-10`);
      entry[c] = v;
      total += v;
    }
    entry.total = total;
    scores[label] = entry;
  }
  if (!raw.goodEnough && String(raw.rewriteNotes || "").trim().length < 10) {
    throw new Error('judge said not goodEnough but gave no usable "rewriteNotes"');
  }
  return {
    winner: raw.winner,
    runnerUp: oneDraftMode ? null : raw.runnerUp,
    goodEnough: raw.goodEnough,
    rewriteNotes: String(raw.rewriteNotes || "").trim(),
    scores,
  };
}

/**
 * One blind judging: shuffles and labels the drafts, asks the judge, retries once on a
 * bad answer. Shared by the daily room and tools/judge-eval.mjs so both use the same judge.
 * `ask(prompt)` returns the parsed JSON, or `{ __agentError }` for bad output.
 * @returns {Promise<{ labelled: object[], verdict: object }>}
 */
export async function runJudge({ drafts, voiceGuide, oneDraftMode = false, ask, randomFn = Math.random, maxAttempts = SCRIPT_ROOM_DEFAULTS.maxJudgeAttempts }) {
  const labelled = shuffleLabels(drafts, randomFn);
  const labels = labelled.map((d) => d.label);
  let lastErr = null;
  for (let a = 1; a <= maxAttempts; a += 1) {
    const prompt = buildJudgePrompt({ voiceGuide, labelled, oneDraftMode })
      + (lastErr ? `\n\nYour previous answer was invalid: ${lastErr}. Answer again in the exact JSON shape.` : "");
    const out = await ask(prompt);
    if (out?.__agentError) { lastErr = out.__agentError; continue; }
    try {
      const verdict = parseJudge(out, labels, { oneDraftMode: oneDraftMode || labels.length === 1 });
      return { labelled, verdict: applyHardGates(verdict, labelled) };
    } catch (err) {
      lastErr = err.message;
    }
  }
  const err = new Error(`judge gave no valid verdict: ${lastErr}`);
  err.name = "JudgeVerdictError";
  throw err;
}

/** Shaz's rule: every script ends on a question. Trailing [pause] marks and quotes don't count. */
export function endsOnQuestion(text) {
  const t = String(text || "").replace(/\[[^\]]*\]/g, "").replace(/["'\u201d\u2019)\s]+$/u, "").trim();
  return t.endsWith("?");
}

export const NO_QUESTION_NOTE = "Hard rule: the script must end on a question the viewer can answer in 1-3 words, calling back to the joke. This one doesn't end on a question.";

/**
 * The hard gate on top of the judge: a winner that doesn't end on a question is never
 * goodEnough, whatever the judge said. The judge's own call is kept as judgeGoodEnough.
 */
export function applyHardGates(verdict, labelled) {
  const win = labelled.find((d) => d.label === verdict.winner);
  const judgeGoodEnough = verdict.goodEnough;
  if (win && !endsOnQuestion(win.text)) {
    return {
      ...verdict,
      goodEnough: false,
      judgeGoodEnough,
      gate: "no-ending-question",
      rewriteNotes: [NO_QUESTION_NOTE, verdict.rewriteNotes].filter(Boolean).join(" "),
    };
  }
  return { ...verdict, judgeGoodEnough, gate: null };
}

/**
 * Runs the full script room for one story.
 * @returns {Promise<{ script: object, receipt: object, room: object }>}
 */
export async function runScriptRoom(topic, {
  article = null,
  now = new Date(),
  config,
  askAgentFn,
  storyContext,
  voiceGuide,
  requireGroundedClaims = true,
  randomFn = Math.random,
  log = console,
} = {}) {
  const cfg = config;
  const limits = { ...SCRIPT_ROOM_DEFAULTS, ...(cfg?.scriptRoom || {}) };
  // Checked before any agent call: a bad judge setting stops the run loudly (Rule 12).
  const judgeOpts = judgeCallOptions(cfg);
  const writerOpts = { agent: cfg.writerAgent, timeoutMs: cfg.agentTimeoutMs, requireJson: true };
  const guide = voiceGuide ?? await loadVoiceGuide();
  const startedAt = Date.now();
  const calls = [];

  async function ask(stage, prompt) {
    const t0 = Date.now();
    const opts = stage.startsWith("judge") ? judgeOpts : writerOpts;
    try {
      const out = await askAgentFn(prompt, opts);
      calls.push({ stage, agent: opts.agent, ok: true, durationMs: Date.now() - t0, promptSha256: sha256(prompt) });
      return out;
    } catch (err) {
      calls.push({ stage, agent: opts.agent, ok: false, errorType: err?.name || "Error", error: err?.message || String(err), durationMs: Date.now() - t0, promptSha256: sha256(prompt) });
      if (err instanceof AgentUnavailableError) throw err;
      return { __agentError: err?.message || String(err) };
    }
  }

  // Partial record so a skipped story still shows what was written and why it lost.
  const partial = { drafts: [], rejectedDrafts: [], judge: null, rewrite: null };
  const fail = (msg) => {
    const err = new ScriptAuthorError(`Script room failed for "${topic?.title || "topic"}": ${msg}`, calls);
    err.room = { schemaVersion: 1, skipped: true, ...partial };
    throw err;
  };
  const vctx = { topic, now, article, requireGroundedClaims, limits };

  // 1. Drafts
  const valid = [];
  const rejected = [];
  partial.rejectedDrafts = rejected;
  let basePrompt = buildDraftsPrompt({ storyContext, voiceGuide: guide, draftCount: limits.draftCount, limits });
  let pendingFailures = [];
  for (let round = 1; round <= limits.maxDraftRounds && valid.length < limits.draftCount; round += 1) {
    const need = limits.draftCount - valid.length;
    const prompt = round === 1
      ? basePrompt
      : buildDraftsPrompt({ storyContext, voiceGuide: guide, draftCount: need, limits, avoidAngles: valid.map((v) => v.angle) })
        + (pendingFailures.length ? buildDraftRepairSuffix(pendingFailures) : "");
    const out = await ask(`draft-round-${round}`, prompt);
    pendingFailures = [];
    if (out?.__agentError) {
      pendingFailures.push({ angle: "(output)", error: out.__agentError });
      rejected.push({ round, angle: null, error: out.__agentError });
      continue;
    }
    const raws = Array.isArray(out?.drafts) ? out.drafts : [];
    if (raws.length === 0) {
      pendingFailures.push({ angle: "(output)", error: 'response had no "drafts" array' });
      rejected.push({ round, angle: null, error: 'no "drafts" array' });
      continue;
    }
    for (let i = 0; i < raws.length && valid.length < limits.draftCount; i += 1) {
      try {
        const nd = normalizeDraft(raws[i], { topic, article, index: i });
        if (valid.some((v) => v.angle.toLowerCase() === nd.angle.toLowerCase())) {
          throw new Error("same angle as another draft");
        }
        validateSpoken(nd.script, vctx);
        const text = spokenText(nd.script);
        valid.push({ ...nd, text, wordCount: countWords(text), round });
      } catch (err) {
        const angle = String(raws[i]?.angle || "").trim();
        pendingFailures.push({ angle, error: err?.message || String(err) });
        rejected.push({ round, angle, error: err?.message || String(err) });
      }
    }
  }
  if (valid.length === 0) fail(`no draft passed the checks after ${limits.maxDraftRounds} rounds. Last errors: ${rejected.slice(-3).map((r) => r.error).join(" | ")}`);
  if (valid.length < limits.draftCount) {
    log.warn?.(`  ⚠️ Script room: only ${valid.length}/${limits.draftCount} drafts passed; judging what passed.`);
  }

  // 2. Judge (blind)
  async function judge(drafts, oneDraftMode) {
    try {
      return await runJudge({
        drafts,
        voiceGuide: guide,
        oneDraftMode,
        ask: (prompt) => ask(oneDraftMode ? "judge-rewrite" : "judge", prompt),
        randomFn,
        maxAttempts: limits.maxJudgeAttempts,
      });
    } catch (err) {
      if (err?.name !== "JudgeVerdictError") throw err;
      fail(err.message);
    }
  }

  partial.drafts = valid.map((d) => ({ angle: d.angle, text: d.text, wordCount: d.wordCount, originalSpoken: d.originalSpoken, round: d.round }));
  const first = await judge(valid, false);
  partial.judge = { labels: first.labelled.map((d) => ({ label: d.label, angle: d.angle })), ...first.verdict };
  const byLabel = (j, label) => j.labelled.find((d) => d.label === label);
  let winner = byLabel(first, first.verdict.winner);
  const runnerUp = first.verdict.runnerUp ? byLabel(first, first.verdict.runnerUp) : null;
  let rewrite = null;
  let quality = "loved";
  let qualityNotes = "";

  // 3. One rewrite if nothing is good enough
  if (!first.verdict.goodEnough) {
    const out = await ask("rewrite", buildRewritePrompt({ storyContext, voiceGuide: guide, best: winner, judgeNotes: first.verdict.rewriteNotes, limits }));
    if (out?.__agentError) fail(`judge said no draft was good enough, and the rewrite failed: ${out.__agentError}`);
    let nd;
    try {
      nd = normalizeDraft((out?.drafts || [])[0], { topic, article, index: 0 });
      validateSpoken(nd.script, vctx);
    } catch (err) {
      fail(`judge said no draft was good enough, and the rewrite failed the checks: ${err.message}`);
    }
    const text = spokenText(nd.script);
    const re = await judge([{ ...nd, text, wordCount: countWords(text), round: "rewrite" }], true);
    rewrite = {
      notes: first.verdict.rewriteNotes,
      angle: nd.angle,
      text,
      verdict: re.verdict,
    };
    partial.rewrite = rewrite;
    if (!re.verdict.goodEnough) {
      // The judge is a filter (Shaz decision 2026-11-23): one rewrite, then skip. Shaz is the
      // final "love" gate in Telegram, and "fine" still never posts because he rejects it there.
      fail(`judge still filtered it out after one rewrite: ${re.verdict.rewriteNotes}`);
    }
    winner = { ...nd, text, wordCount: countWords(text), label: "R" };
  }

  // 4. Paperwork (spoken words locked)
  const spokenBefore = spokenText(winner.script);
  let finalScript = null;
  let paperErr = null;
  for (let a = 1; a <= limits.maxPaperworkAttempts && !finalScript; a += 1) {
    const prompt = buildPaperworkPrompt({ storyContext, script: winner.script })
      + (paperErr ? `\n\nYour previous answer failed: ${paperErr}. Fix it.` : "");
    const out = await ask("paperwork", prompt);
    if (out?.__agentError) { paperErr = out.__agentError; continue; }
    try {
      const merged = structuredClone(winner.script);
      merged.headline = String(out.headline || "").trim();
      merged.hook.cardHeadline = out?.hook?.cardHeadline;
      merged.hook.cardBadge = out?.hook?.cardBadge;
      for (const b of merged.beats) {
        const extra = (out.beats || []).find((x) => x?.id === b.id) || {};
        b.shotTypeSuggestion = extra.shotTypeSuggestion;
        b.cardHeadline = extra.cardHeadline;
        b.cardBadge = extra.cardBadge;
      }
      merged.visualQueries = out.visualQueries;
      merged.backgroundId = out.backgroundId;
      merged.hashtags = out.hashtags;
      if (!merged.headline || merged.headline.length > 32) throw new Error("headline must be 1-32 characters");
      if (!Array.isArray(merged.visualQueries) || merged.visualQueries.length < 5) {
        throw new Error("visualQueries must list at least 5 image searches (7 wanted)");
      }
      if (!merged.backgroundId) throw new Error("backgroundId is required");
      if (!Array.isArray(merged.hashtags) || merged.hashtags.length === 0) throw new Error("hashtags are required");
      for (const b of merged.beats) {
        if (!b.shotTypeSuggestion) throw new Error(`${b.id} needs a shotTypeSuggestion`);
      }
      if (spokenText(merged) !== spokenBefore) throw new Error("spoken words changed during paperwork");
      validateScript(merged, {
        topic, now, minWords: limits.minWords, maxWords: limits.hardMaxWords,
        articleText: article?.text ?? null, requireGroundedClaims,
      });
      finalScript = merged;
    } catch (err) {
      paperErr = err.message;
    }
  }
  if (!finalScript) fail(`paperwork step failed: ${paperErr}`);

  const dialogue = spokenText(finalScript);
  const receipt = {
    schemaVersion: 2,
    flow: "script-room",
    quality,
    agent: cfg.writerAgent,
    writerAgent: cfg.writerAgent,
    judgeAgent: judgeOpts.agent,
    judgeModel: judgeOpts.model ?? null,
    // The writing round that produced the shipped script (1 = first drafts; rewrite = last round + 1).
    finalAttempt: rewrite ? Math.max(...valid.map((d) => Number(d.round) || 1)) + 1 : Number(winner.round) || 1,
    finalWordCount: countWords(dialogue),
    authoredAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    promptSha256: calls[0]?.promptSha256 ?? null,
    attempts: calls.map((c, i) => ({ attempt: i + 1, ...c })),
    errors: calls.filter((c) => !c.ok).map((c) => ({ stage: c.stage, errorType: c.errorType, error: c.error })),
  };
  const room = {
    schemaVersion: 1,
    drafts: valid.map((d) => ({ angle: d.angle, text: d.text, wordCount: d.wordCount, originalSpoken: d.originalSpoken, round: d.round })),
    rejectedDrafts: rejected,
    judge: {
      labels: first.labelled.map((d) => ({ label: d.label, angle: d.angle })),
      ...first.verdict,
    },
    quality,
    qualityNotes,
    winner: { label: winner.label, angle: winner.angle, text: dialogue },
    runnerUp: runnerUp ? { label: runnerUp.label, angle: runnerUp.angle, text: runnerUp.text } : null,
    rewrite,
  };
  return { script: finalScript, receipt, room };
}
