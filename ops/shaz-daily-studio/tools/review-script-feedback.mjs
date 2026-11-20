#!/usr/bin/env node
/**
 * Weekly script feedback review (Shaz decision 2026-11-20: "Log it, review weekly").
 *
 *   node tools/review-script-feedback.mjs            # summary of the last 7 days
 *   node tools/review-script-feedback.mjs --days 14  # wider window
 *   node tools/review-script-feedback.mjs --propose  # also ask the pinned agent for voice-guide edits
 *
 * --propose writes a proposal file to <studio home>/voice-guide-proposals/<date>.md.
 * It NEVER edits voice-guide.md. Shaz reads the proposal and approves edits by hand.
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { askActiveAgent } from "../../../v3/lib/agent-bridge.ts";
import { getDefaultStudioHome } from "../content-ledger.mjs";
import { readScriptFeedback } from "../script-feedback.mjs";
import { loadVoiceGuide } from "../script-room.mjs";
import { loadStudioConfig } from "../studio-daily.mjs";

export function summarizeFeedback(entries) {
  const runnerUpBetter = entries.filter((e) => e.vote === "runner-up-better");
  const winnerRight = entries.filter((e) => e.vote === "winner-right");
  const total = entries.length;
  return {
    total,
    runnerUpBetter: runnerUpBetter.length,
    winnerRight: winnerRight.length,
    judgeAgreementRate: total ? winnerRight.length / total : null,
    misses: runnerUpBetter.map((e) => ({
      at: e.at,
      title: e.title,
      winnerAngle: e.winner?.angle ?? null,
      winnerText: e.winner?.text ?? null,
      runnerUpAngle: e.runnerUp?.angle ?? null,
      runnerUpText: e.runnerUp?.text ?? null,
    })),
  };
}

export function formatSummary(summary, days) {
  const lines = [`Script feedback, last ${days} days: ${summary.total} vote(s).`];
  if (!summary.total) {
    lines.push("No votes yet. Tap the buttons under the runner-up script in Telegram.");
    return lines.join("\n");
  }
  lines.push(`  Judge was right: ${summary.winnerRight}`);
  lines.push(`  Runner-up was better: ${summary.runnerUpBetter}`);
  lines.push(`  Judge agreement: ${Math.round(summary.judgeAgreementRate * 100)}%`);
  for (const m of summary.misses) {
    lines.push("", `• ${m.title || "(untitled)"} (${m.at})`);
    lines.push(`  Judge picked: ${m.winnerAngle}`);
    lines.push(`  You preferred: ${m.runnerUpAngle}`);
  }
  return lines.join("\n");
}

export function buildProposalPrompt({ voiceGuide, summary }) {
  const misses = summary.misses
    .map((m, i) => `MISS ${i + 1}: "${m.title}"\nJUDGE PICKED (angle: ${m.winnerAngle}):\n${m.winnerText}\n\nSHAZ PREFERRED (angle: ${m.runnerUpAngle}):\n${m.runnerUpText}`)
    .join("\n\n---\n\n");
  return `You help keep Shaz's voice guide accurate. This week the judge picked scripts Shaz liked less than the runner-up ${summary.runnerUpBetter} time(s) out of ${summary.total} votes.

CURRENT VOICE GUIDE:
<<<VOICE GUIDE
${voiceGuide}
VOICE GUIDE>>>

THE MISSES:
${misses}

Find the pattern in what Shaz preferred. Propose at most 3 small, specific edits to the voice guide (a new lesson, a reworded lesson, or a lesson to drop). Each edit must point to the misses that support it. Do not propose anything a single miss can't justify unless it repeats. Use simple words.

Output ONLY valid JSON:
{ "pattern": "<one or two sentences>", "edits": [ { "kind": "add | change | drop", "lesson": "<lesson number or 'new'>", "text": "<the proposed wording>", "why": "<which misses and why>" } ] }`;
}

export function formatProposal({ proposal, summary, days, date }) {
  const lines = [
    `# Voice guide proposal, ${date}`,
    "",
    `Last ${days} days: ${summary.total} vote(s), judge right ${summary.winnerRight}, runner-up better ${summary.runnerUpBetter}.`,
    "",
    "Nothing here is applied yet. Approve the edits you like and they get added to `ops/shaz-daily-studio/voice-guide.md`.",
    "",
    `**Pattern:** ${proposal.pattern || "(none)"}`,
    "",
  ];
  (proposal.edits || []).forEach((e, i) => {
    lines.push(`## Edit ${i + 1} (${e.kind}, lesson ${e.lesson})`, "", e.text, "", `_Why:_ ${e.why}`, "");
  });
  return lines.join("\n");
}

function parseArgs(argv) {
  const out = { days: 7, propose: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--propose") out.propose = true;
    else if (argv[i] === "--days") out.days = Number(argv[++i]);
    else throw new Error(`Unknown argument "${argv[i]}". Use --days N and/or --propose.`);
  }
  if (!Number.isFinite(out.days) || out.days < 1) throw new Error("--days must be a number >= 1");
  return out;
}

export async function main(argv = process.argv.slice(2), { env = process.env, askAgentFn = askActiveAgent, now = new Date() } = {}) {
  const args = parseArgs(argv);
  const since = new Date(now.getTime() - args.days * 86_400_000);
  const entries = await readScriptFeedback({ env, since });
  const summary = summarizeFeedback(entries);
  console.log(formatSummary(summary, args.days));
  if (!args.propose) return { summary };
  if (summary.runnerUpBetter === 0) {
    console.log("\nThe judge matched you every time. No voice-guide edits to propose.");
    return { summary };
  }
  const cfg = await loadStudioConfig();
  const proposal = await askAgentFn(buildProposalPrompt({ voiceGuide: await loadVoiceGuide(), summary }), {
    agent: cfg.writerAgent,
    timeoutMs: cfg.agentTimeoutMs,
    requireJson: true,
  });
  const date = now.toISOString().slice(0, 10);
  const dir = path.join(getDefaultStudioHome(env), "voice-guide-proposals");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${date}.md`);
  await fs.writeFile(file, `${formatProposal({ proposal, summary, days: args.days, date })}\n`, "utf8");
  console.log(`\nProposal written to ${file}`);
  return { summary, proposalPath: file };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`review-script-feedback failed: ${err.message}`);
    process.exit(1);
  });
}
