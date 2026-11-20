/**
 * Script-room feedback (Shaz decision 2026-11-20: "Agent + you see runner-up", "Log it, review weekly").
 *
 * After each candidate video, Telegram gets the judge's runner-up script with two buttons:
 *   "Runner-up was better" (ru:<runId>)  /  "Winner was right" (wr:<runId>)
 * Taps are FEEDBACK ONLY. They never pick or publish anything. Each tap is appended to
 * <studio home>/script-feedback.jsonl, which tools/review-script-feedback.mjs reads weekly.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getDefaultStudioHome } from "./content-ledger.mjs";
import { escapeTelegramHtml } from "./telegram-approval.mjs";

export const FEEDBACK_ACTIONS = Object.freeze({ ru: "runner-up-better", wr: "winner-right" });

export function getScriptFeedbackPath(env = process.env) {
  return path.join(getDefaultStudioHome(env), "script-feedback.jsonl");
}

/** Parses "ru:<runId>" / "wr:<runId>". Returns null for anything else. */
export function parseFeedbackCallback(data) {
  const m = /^(ru|wr):(.+)$/.exec(String(data || ""));
  if (!m) return null;
  return { vote: FEEDBACK_ACTIONS[m[1]], runId: m[2] };
}

/** Builds the Telegram message that shows the runner-up. Returns null when there is no runner-up. */
export function buildRunnerUpMessage({ room, runId, candidateNumber = null, dryRun = false }) {
  const fine = room?.quality === "fine";
  if (!room?.runnerUp?.text && !fine) return null;
  const label = candidateNumber ? `Candidate ${candidateNumber}` : "This video";
  const rewritten = room.rewrite ? "\n<i>(The winner was rewritten once after the judge's notes.)</i>" : "";
  const warning = fine
    ? `⚠️ <b>Judge says: fine, not great.</b>\n<i>${escapeTelegramHtml(room.qualityNotes || "")}</i>\n\n`
    : "";
  if (!room?.runnerUp?.text) {
    return { text: `📝 <b>${label}</b>\n\n${warning}`.trim(), replyMarkup: undefined };
  }
  const text =
    `📝 <b>${label}: the judge's runner-up script</b>${rewritten}\n\n` +
    warning +
    `<b>Winner angle:</b> ${escapeTelegramHtml(room.winner?.angle || "")}\n` +
    `<b>Runner-up angle:</b> ${escapeTelegramHtml(room.runnerUp.angle || "")}\n\n` +
    `<blockquote>${escapeTelegramHtml(room.runnerUp.text)}</blockquote>\n\n` +
    (dryRun ? "<i>Dry run: no buttons.</i>" : "Was the judge right? (Feedback only. This never posts anything.)");
  const replyMarkup = dryRun
    ? undefined
    : {
        inline_keyboard: [[
          { text: "🔁 Runner-up was better", callback_data: `ru:${runId}` },
          { text: "✅ Winner was right", callback_data: `wr:${runId}` },
        ]],
      };
  return { text, replyMarkup };
}

async function readRoom(runDirectory) {
  if (!runDirectory) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(runDirectory, "script-room.json"), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Appends one feedback line. Carries both scripts so the weekly review works even after
 * old run folders are pruned.
 */
export async function appendScriptFeedback({ vote, runId, runDirectory = null, title = null, at = new Date().toISOString(), env = process.env, feedbackPath }) {
  if (!Object.values(FEEDBACK_ACTIONS).includes(vote)) throw new Error(`Unknown script feedback vote "${vote}"`);
  const room = await readRoom(runDirectory);
  const entry = {
    schemaVersion: 1,
    at,
    runId,
    title,
    vote,
    winner: room?.winner ?? null,
    runnerUp: room?.runnerUp ?? null,
    judgeScores: room?.judge?.scores ?? null,
    rewritten: Boolean(room?.rewrite),
  };
  const file = feedbackPath || getScriptFeedbackPath(env);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

export async function readScriptFeedback({ env = process.env, feedbackPath, since = null } = {}) {
  const file = feedbackPath || getScriptFeedbackPath(env);
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const out = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (since && new Date(e.at) < since) continue;
      out.push(e);
    } catch {
      // A broken line should not hide the rest of the week's feedback.
    }
  }
  return out;
}
