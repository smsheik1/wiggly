#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

export const BANNED_GREETINGS = /^(hey|hi|hello|good morning|good evening|what's up|greetings|yo)\b/i;

export const FORENSIC_PATTERNS = [
  /(\$|£|€)\s*\d+(\.\d+)?\s*(million|billion|k|m|b)?\b/i,
  /\b\d+(\.\d+)?\s*(million|billion|grand|thousand)\s*(dollars)?\b/i,
  /\b\d+%/i,
  /\b\d+\s*(bpm|beats per minute|hours|minutes|seconds|volts|amps|degrees|times|inmates|rounds|pellets|pounds|high-rises|skyscrapers|hertz|hz|blocks|grand)\b/i,
  /\b(penal code|penal law|indictment|chain of custody|subsidies|subsidize|subsidized|bureaucracy|municipal|injunction|bradycardia|rem sleep|neurological|synthetic polymer|solvent|conductive|electrostatic|mitigation|collateral|casualty rate|zoning laws|grappling points|resonance|biomass|membrane|purity|chemical|synthesis|manifest|suppressors|kinetic energy)\b/i
];

export const SURROGATE_DISBELIEF_PATTERNS = [
  /\b(wait|seriously|so you're telling me|you mean to tell me|let me get this straight|are you insane|you didn't|you actually|that's absurd|i don't know|you customized|you basically burn|acceptable loss|wait, so|you're telling me|so, while|right, but)\b/i
];

export const WEAK_CLOSER_PATTERNS = [
  /\b(we will see|to be continued|over my dead body|your show ends tonight|never come back|see you in arkham|i am the danger|you chose your code over me)\b/i
];

export function normalizeScriptInput(input) {
  if (!input) return [];

  // If input is an episode JSON object
  if (typeof input === "object" && !Array.isArray(input)) {
    const turnsArray = Array.isArray(input.turns) ? input.turns : (Array.isArray(input.dialogue) ? input.dialogue : null);
    if (turnsArray) {
      return turnsArray.map((t, idx) => ({
        index: idx + 1,
        speaker: t.speaker || t.speakerId || `speaker${(idx % 2) + 1}`,
        text: (t.text || "").trim()
      }));
    }
  }

  // If input is an array of turns
  if (Array.isArray(input)) {
    return input.map((t, idx) => ({
      index: idx + 1,
      speaker: t.speaker || t.speakerId || `speaker${(idx % 2) + 1}`,
      text: (t.text || "").trim()
    }));
  }

  // If input is a raw JSON string
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return normalizeScriptInput(parsed);
    } catch {
      // Fallback: parse plain lines of dialogue "Speaker: text"
      const lines = input.split(/\r?\n/).filter(l => l.trim().length > 0);
      return lines.map((line, idx) => {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          return { index: idx + 1, speaker: match[1].trim(), text: match[2].trim() };
        }
        return { index: idx + 1, speaker: `speaker${(idx % 2) + 1}`, text: line.trim() };
      });
    }
  }

  return [];
}

export function critiqueScript(input, options = {}) {
  const turns = normalizeScriptInput(input);
  const feedback = [];

  if (turns.length === 0) {
    return {
      score: 0,
      verdict: "CRITICAL_FAIL",
      totalWords: 0,
      turnCount: 0,
      estimatedDurationSeconds: 0,
      breakdown: {
        hook: { score: 0, max: 25, passed: false, reason: "No dialogue turns provided" },
        forensicDensity: { score: 0, max: 20, passed: false, matches: [] },
        pacingAndClock: { score: 0, max: 20, passed: false, wordCount: 0 },
        surrogateProgression: { score: 0, max: 15, passed: false },
        punchlinePayoff: { score: 0, max: 20, passed: false }
      },
      actionableFeedback: ["Script contains no valid dialogue turns."]
    };
  }

  // --- Rule 1: The In-Media-Res Hook (0-3s / Turn 1) [25 pts] ---
  let hookScore = 0;
  const turn1 = turns[0];
  const turn1Text = turn1.text || "";
  let hookPassed = false;
  let hookReason = "";

  if (turn1Text.length < 15) {
    hookReason = "Turn 1 is too short or empty to establish a hook.";
    feedback.push("Turn 1 hook is too short. It must immediately establish the core conflict in the very first breath.");
  } else if (BANNED_GREETINGS.test(turn1Text)) {
    const match = turn1Text.match(BANNED_GREETINGS)[0];
    hookScore = 5; // Heavy penalty
    hookReason = `Turn 1 wastes attention on an idle greeting ('${match}').`;
    feedback.push(`BANNED HOOK: Turn 1 opens with '${match}'. Never open with small talk in short-form video. Jump immediately into the provocative premise (e.g. 'Bruce, serious question: ...').`);
  } else {
    // Check for direct address & friction
    let points = 10;
    let hasDirectAddress = /\b(bruce|batman|tim|robin|peter|spider-man|spiderman|clark|superman|joker|jason|walter|venom|patrick|spongebob)\b/i.test(turn1Text);
    if (!hasDirectAddress && input && typeof input === 'object') {
      const charList = Array.isArray(input.characters) ? input.characters : (Array.isArray(input.cast) ? input.cast.map(c => c.name || c.id) : []);
      for (const char of charList) {
        if (typeof char === 'string' && char.length > 2) {
          const clean = char.replace(/[^a-z0-9]/gi, '');
          if (new RegExp(`\\b${clean}\\b`, 'i').test(turn1Text.replace(/[^a-z0-9\s]/gi, ''))) {
            hasDirectAddress = true;
            break;
          }
        }
      }
    }
    const hasQuestionOrFriction = /\?|serious question|quick question|tell me|how|why|can|could|did you|explain|check/i.test(turn1Text);

    if (hasDirectAddress) points += 8;
    if (hasQuestionOrFriction) points += 7;

    hookScore = Math.min(25, points);
    hookPassed = hookScore >= 20;
    hookReason = hookPassed
      ? "Turn 1 delivers an authentic in-media-res hook with direct address and immediate conflict."
      : "Turn 1 lacks sufficient question friction or direct address.";
    if (!hookPassed) {
      feedback.push("Strengthen Turn 1: Pair a direct character address with an provocative question (e.g. 'Bruce, serious question: why do you never kill the Joker?').");
    }
  }

  // --- Rule 2: Forensic & Tactical Density [20 pts] ---
  const forensicMatches = new Set();
  for (const turn of turns) {
    for (const pattern of FORENSIC_PATTERNS) {
      const match = turn.text.match(pattern);
      if (match) {
        forensicMatches.add(match[0].toLowerCase());
      }
    }
  }

  const matchCount = forensicMatches.size;
  let forensicScore = 0;
  let forensicPassed = false;

  if (matchCount === 0) {
    forensicScore = 0;
    feedback.push("CRITICAL: Forensic density is 0. The dialogue is generic comic melodrama without concrete metrics. Add at least two hard tactical facts, dollar amounts, legal statutes, or biological constraints (e.g. '$85M Batwings', '40 bpm bradycardia', 'New Jersey penal code').");
  } else if (matchCount === 1) {
    forensicScore = 10;
    feedback.push("Forensic density is low (only 1 concrete metric found). Add at least one more specific number, statute, or scientific mechanism to deepen the realism.");
  } else if (matchCount >= 2) {
    forensicScore = 20;
    forensicPassed = true;
  }

  // --- Rule 3: Word Economy & 60s Hard Clock [20 pts] ---
  const totalWords = turns.reduce((acc, t) => acc + (t.text ? t.text.trim().split(/\s+/).length : 0), 0);
  const estimatedDurationSec = Math.round((totalWords / 2.6) * 10) / 10; // ~156 WPM standard TTS cadence
  let clockScore = 0;
  let clockPassed = false;

  if (totalWords >= 120 && totalWords <= 165) {
    clockScore = 20;
    clockPassed = true;
  } else if (totalWords >= 100 && totalWords < 120) {
    clockScore = 15;
    feedback.push(`Script is slightly brief (${totalWords} words, ~${estimatedDurationSec}s). Consider expanding middle turns to allow fuller Socratic tension.`);
  } else if (totalWords > 165 && totalWords <= 180) {
    clockScore = 12;
    feedback.push(`Script is long (${totalWords} words, ~${estimatedDurationSec}s). It is pushing close to the 60-second YouTube Shorts ceiling. Trim ~15 words to ensure comfortable pacing.`);
  } else if (totalWords < 100) {
    clockScore = Math.max(0, Math.round((totalWords / 100) * 10));
    feedback.push(`Script is too short (${totalWords} words, ~${estimatedDurationSec}s). Short-form debate retention requires 120–160 words to progress through all 4 Socratic beats.`);
  } else {
    clockScore = 5;
    feedback.push(`EXCEEDS SHORTS LIMIT: Script is ${totalWords} words (~${estimatedDurationSec}s). YouTube Shorts enforces a 60s hard ceiling. You must trim to under 165 words.`);
  }

  // --- Rule 4: Socratic Surrogate Progression [15 pts] ---
  // Turns 2 through turns.length - 2 should contain an exasperated surrogate reaction
  let surrogateMatches = 0;
  const middleTurns = turns.slice(1, Math.max(2, turns.length - 1));
  for (const turn of middleTurns) {
    for (const pattern of SURROGATE_DISBELIEF_PATTERNS) {
      if (pattern.test(turn.text)) {
        surrogateMatches++;
      }
    }
  }

  let surrogateScore = 0;
  let surrogatePassed = false;

  if (surrogateMatches >= 1) {
    surrogateScore = 15;
    surrogatePassed = true;
  } else {
    surrogateScore = 5;
    feedback.push("Missing surrogate escalation in middle turns. Robin (the audience surrogate) must vocalize the viewer's disbelief at Batman's absurdly clinical reasoning (e.g. 'Wait, so while the rest of the world is investing in stocks, you're...').");
  }

  // --- Rule 5: Checkmate Punchline Payoff [20 pts] ---
  const lastTurn = turns[turns.length - 1];
  const lastText = lastTurn.text || "";
  let punchlineScore = 0;
  let punchlinePassed = false;

  const isWeakCloser = WEAK_CLOSER_PATTERNS.some(p => p.test(lastText));
  const wordCountLast = lastText.split(/\s+/).length;

  if (isWeakCloser) {
    punchlineScore = 5;
    feedback.push(`BANNED CLOSER: Final line relies on a generic comic cliché. The closing line must deliver a deadpan tactical checkmate or comedic punchline that compels comments (e.g. 'Modern architecture is tactically inefficient, Tim. Someone had to fix it.').`);
  } else if (wordCountLast < 5) {
    punchlineScore = 8;
    feedback.push("Final line is too abrupt. Deliver a full, memorable checkmate sentence.");
  } else {
    // Check for punchy delivery
    let pts = 15;
    if (lastText.length >= 25 && lastText.length <= 110) pts += 5;
    punchlineScore = pts;
    punchlinePassed = punchlineScore >= 18;
  }

  const totalScore = hookScore + forensicScore + clockScore + surrogateScore + punchlineScore;
  let verdict = "CRITICAL_FAIL";
  if (totalScore >= 85) verdict = "PASS";
  else if (totalScore >= 65) verdict = "NEEDS_REVISION";

  return {
    score: totalScore,
    verdict,
    totalWords,
    turnCount: turns.length,
    estimatedDurationSeconds: estimatedDurationSec,
    breakdown: {
      hook: { score: hookScore, max: 25, passed: hookPassed, reason: hookReason },
      forensicDensity: { score: forensicScore, max: 20, passed: forensicPassed, matches: Array.from(forensicMatches) },
      pacingAndClock: { score: clockScore, max: 20, passed: clockPassed, wordCount: totalWords, estimatedDuration: `${estimatedDurationSec}s` },
      surrogateProgression: { score: surrogateScore, max: 15, passed: surrogatePassed, matchCount: surrogateMatches },
      punchlinePayoff: { score: punchlineScore, max: 20, passed: punchlinePassed, closerLine: lastText }
    },
    actionableFeedback: feedback
  };
}

export function formatCritiqueReport(result) {
  const lines = [];
  const symbol = result.verdict === "PASS" ? "✅" : result.verdict === "NEEDS_REVISION" ? "⚠️" : "❌";
  const badge = result.verdict === "PASS" ? "PASSED AIRLOCK" : result.verdict === "NEEDS_REVISION" ? "REVISION REQUIRED" : "FAILED RETENTION GATE";

  lines.push("========================================================");
  lines.push(`${symbol} SOCRATIC SCRIPT CRITIQUE REPORT: ${result.score}/100 [${badge}]`);
  lines.push("========================================================");
  lines.push(`Turns: ${result.turnCount} | Word Count: ${result.totalWords} words (~${result.estimatedDurationSeconds}s at 150 WPM)`);
  lines.push("");
  lines.push("Detailed Breakdown:");
  lines.push(`  [1] 0–3s In-Media-Res Hook:       ${result.breakdown.hook.score}/25 pts (${result.breakdown.hook.passed ? "PASS" : "FAIL"})`);
  lines.push(`      Details: ${result.breakdown.hook.reason}`);
  lines.push(`  [2] Forensic & Tactical Density:   ${result.breakdown.forensicDensity.score}/20 pts (${result.breakdown.forensicDensity.passed ? "PASS" : "FAIL"})`);
  lines.push(`      Matches: ${result.breakdown.forensicDensity.matches.length > 0 ? result.breakdown.forensicDensity.matches.join(", ") : "None"}`);
  lines.push(`  [3] Pacing & 60s Clock Enforcer:   ${result.breakdown.pacingAndClock.score}/20 pts (${result.breakdown.pacingAndClock.passed ? "PASS" : "FAIL"})`);
  lines.push(`      Duration: ${result.breakdown.pacingAndClock.estimatedDuration} (${result.totalWords} words)`);
  lines.push(`  [4] Socratic Surrogate Disbelief:  ${result.breakdown.surrogateProgression.score}/15 pts (${result.breakdown.surrogateProgression.passed ? "PASS" : "FAIL"})`);
  lines.push(`  [5] Checkmate Punchline Payoff:    ${result.breakdown.punchlinePayoff.score}/20 pts (${result.breakdown.punchlinePayoff.passed ? "PASS" : "FAIL"})`);
  lines.push("");

  if (result.actionableFeedback.length > 0) {
    lines.push("Actionable Feedback for 90+ Score:");
    for (const item of result.actionableFeedback) {
      lines.push(`  • ${item}`);
    }
    lines.push("");
  }

  if (result.verdict === "PASS") {
    lines.push("Result: APPROVED. Script meets viral retention criteria and is cleared for voice synthesis & video rendering.");
  } else {
    lines.push("Result: REJECTED. Script must be revised to meet the 85-point threshold before voice synthesis.");
  }
  lines.push("========================================================\n");

  return lines.join("\n");
}

export async function main() {
  const args = process.argv.slice(2);
  let targetFile = "";
  let jsonOutput = false;

  for (const arg of args) {
    if (arg === "--json") {
      jsonOutput = true;
    } else if (!arg.startsWith("--")) {
      targetFile = arg;
    }
  }

  if (!targetFile) {
    console.error("Usage: node runtime/critique.mjs <inputs/episode.json> [--json]");
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), targetFile);
  let content;
  try {
    content = readFileSync(resolved, "utf8");
  } catch (err) {
    console.error(`[critique] Could not read file "${targetFile}": ${err.message}`);
    process.exit(1);
  }

  let input;
  try {
    input = JSON.parse(content);
  } catch {
    input = content;
  }

  const result = critiqueScript(input);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatCritiqueReport(result));
  }

  process.exit(result.verdict === "PASS" ? 0 : 1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch(err => {
    console.error("[critique] Fatal error:", err.message);
    process.exit(1);
  });
}
