import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { critiqueScript, formatCritiqueReport } from "../runtime/critique.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

test("critiqueScript fails empty or invalid input", () => {
  const res = critiqueScript(null);
  assert.equal(res.score, 0);
  assert.equal(res.verdict, "CRITICAL_FAIL");
  assert.equal(res.actionableFeedback.length, 1);
});

test("critiqueScript flags polite greetings and small talk in Turn 1", () => {
  const greetingScript = [
    { speaker: "Robin", text: "Hey Bruce, good evening! How are you doing tonight?" },
    { speaker: "Batman", text: "I am fine Tim. Gotham needs us." },
    { speaker: "Robin", text: "Should we go patrol Crime Alley?" },
    { speaker: "Batman", text: "Yes." }
  ];

  const result = critiqueScript(greetingScript);
  assert.equal(result.breakdown.hook.passed, false);
  assert.ok(result.breakdown.hook.score <= 10);
  assert.ok(result.actionableFeedback.some(f => f.includes("BANNED HOOK")));
});

test("critiqueScript detects zero forensic density and requires concrete metrics", () => {
  const melodramaticScript = [
    { speaker: "Joker", text: "Why so serious, Bats? You could have ended this years ago." },
    { speaker: "Batman", text: "I will never be like you, Joker. Never." },
    { speaker: "Joker", text: "Oh, but you are just like me! You cannot admit it." },
    { speaker: "Batman", text: "I protect Gotham. You only destroy it." },
    { speaker: "Joker", text: "And yet you keep me alive. See you in Arkham!" }
  ];

  const result = critiqueScript(melodramaticScript);
  assert.equal(result.breakdown.forensicDensity.score, 0);
  assert.equal(result.breakdown.forensicDensity.passed, false);
  assert.ok(result.actionableFeedback.some(f => f.includes("Forensic density is 0")));
  assert.ok(result.score < 50);
  assert.equal(result.verdict, "CRITICAL_FAIL");
});

test("critiqueScript approves golden benchmark: why-batman-wont-kill-joker", () => {
  const inputPath = path.join(repoRoot, "inputs/why-batman-wont-kill-joker.json");
  const result = critiqueScript(JSON.parse(readFileSync(inputPath, "utf8")));

  assert.ok(result.score >= 90, `Score must be >= 90, got ${result.score}`);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.breakdown.hook.passed, true);
  assert.equal(result.breakdown.forensicDensity.passed, true);
  assert.equal(result.breakdown.surrogateProgression.passed, true);
  assert.equal(result.breakdown.punchlinePayoff.passed, true);
});

test("critiqueScript approves golden benchmark: why-batman-subsidizes-red-hood", () => {
  const inputPath = path.join(repoRoot, "inputs/why-batman-subsidizes-red-hood.json");
  const result = critiqueScript(JSON.parse(readFileSync(inputPath, "utf8")));

  assert.ok(result.score >= 85, `Score must be >= 85, got ${result.score}`);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.breakdown.hook.passed, true);
  assert.equal(result.breakdown.forensicDensity.passed, true);
  assert.equal(result.breakdown.surrogateProgression.passed, true);
});

test("critiqueScript enforces hard clock and flags scripts exceeding 60s", () => {
  // Generate artificially long script (> 180 words)
  const longTurns = [
    { speaker: "Robin", text: "Bruce, serious question: why do you spend so much time and money running around Gotham with gadgets?" },
    { speaker: "Batman", text: "Because every tactical calculation demonstrates that municipal law enforcement lacks the rapid kinetic response required for high-threat supervillain incidents across Gotham." },
    { speaker: "Robin", text: "Wait, seriously? You are saying that city council budgets are insufficient to procure advanced ballistic ordnance and titanium body armor for precinct officers?" },
    { speaker: "Batman", text: "Precinct budgets allocate over 72% of capital to administrative overhead, legacy pension systems, and bureaucratic red tape, leaving less than 8% for operational tactical technology." },
    { speaker: "Robin", text: "So while the rest of Gotham City is arguing over municipal property taxes and school district funding, Wayne Enterprises is secretly manufacturing military-grade combat aircraft and deploying them under private operational discretion without any legislative oversight or judicial subpoena risk?!" },
    { speaker: "Batman", text: "Wayne Aerospace military contracts provide full operational indemnification under federal Title 10 defense procurement clauses, rendering municipal oversight constitutionally non-applicable across all sovereign operational theaters." },
    { speaker: "Robin", text: "You literally weaponized defense contract loopholes just so you could fly an eighty-five million dollar supersonic stealth jet down Crime Alley without getting a parking ticket!" },
    { speaker: "Batman", text: "Parking tickets are civil infractions, Tim. Wayne Enterprises pays all parking violations in advance under an escrow account established with the city comptroller." }
  ];

  const result = critiqueScript(longTurns);
  assert.ok(result.totalWords > 180, `Expected > 180 words, got ${result.totalWords}`);
  assert.ok(result.breakdown.pacingAndClock.score <= 10);
  assert.ok(result.actionableFeedback.some(f => f.includes("EXCEEDS SHORTS LIMIT") || f.includes("Trim")));
});

test("CLI execution passes for valid input and outputs JSON with --json flag", () => {
  const stdout = execFileSync("node", [
    "runtime/critique.mjs",
    "inputs/why-batman-wont-kill-joker.json",
    "--json"
  ], { cwd: repoRoot, encoding: "utf8" });

  const parsed = JSON.parse(stdout);
  assert.equal(parsed.verdict, "PASS");
  assert.ok(parsed.score >= 90);
  assert.ok(parsed.breakdown);
});
