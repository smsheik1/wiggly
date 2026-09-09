import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import {
  scoutTopics,
  filterAndScoreQueries,
  synthesizeConcept,
  FALLBACK_TOPICS
} from "../runtime/scout.mjs";

test("filterAndScoreQueries strips noise and ranks high-friction queries", () => {
  const rawQueries = [
    "batman arkham knight download pc",
    "batman movie wallpaper 4k",
    "batman lego set 2024",
    "why does batman never kill joker",
    "how does batman survive without sleep",
    "can spiderman beat batman without prep time",
    "batman trailer hd",
    "short"
  ];

  const scored = filterAndScoreQueries(rawQueries);
  const scoredQueries = scored.map((s) => s.query);

  // Noise must be filtered out
  assert.ok(!scoredQueries.includes("batman arkham knight download pc"), "Must strip download queries");
  assert.ok(!scoredQueries.includes("batman movie wallpaper 4k"), "Must strip wallpaper queries");
  assert.ok(!scoredQueries.includes("batman lego set 2024"), "Must strip lego set queries");
  assert.ok(!scoredQueries.includes("batman trailer hd"), "Must strip trailer queries");
  assert.ok(!scoredQueries.includes("short"), "Must strip short stubs");

  // High-retention question queries must be retained
  assert.ok(scoredQueries.includes("why does batman never kill joker"), "Must retain Joker moral question");
  assert.ok(scoredQueries.includes("how does batman survive without sleep"), "Must retain sleep physiology question");
  assert.ok(scoredQueries.includes("can spiderman beat batman without prep time"), "Must retain Spider-Man matchup question");

  // Top scored query should have high friction
  assert.ok(scored[0].score >= 30, "Top query must receive high viral score");
});

test("synthesizeConcept formats Socratic Robin In-Media-Res hook line", () => {
  const concept = synthesizeConcept(
    { query: "why does batman never kill joker", score: 50 },
    0
  );

  assert.equal(concept.flavor, "Flavor B: Deep Lore & Moral Checkmate");
  assert.equal(concept.suggestedLayout, "The Classic Patrol");
  assert.match(concept.hookLine, /^Speaker 1 \(Robin\): "Bruce, serious question: /);
  assert.match(concept.hookLine, /kill the Joker\?"$/);
  assert.ok(concept.coreConflict.length > 20);
  assert.equal(concept.suggestedCast.speaker1.name, "Robin (Tim Drake)");
  assert.equal(concept.suggestedCast.speaker2.name, "Batman (Bruce Wayne)");
});

test("synthesizeConcept properly identifies crossover layout and flavor", () => {
  const crossoverConcept = synthesizeConcept(
    { query: "can spiderman beat batman without prep time", score: 50 },
    1
  );

  assert.equal(crossoverConcept.flavor, "Flavor B: Deep Lore & Moral Checkmate");
  assert.equal(crossoverConcept.suggestedLayout, "The Universe Breach");
  assert.match(crossoverConcept.hookLine, /Spider-Man/);
});

test("synthesizeConcept properly identifies mundane logistics flavor", () => {
  const logisticsConcept = synthesizeConcept(
    { query: "how much money does batman have", score: 45 },
    2
  );

  assert.equal(logisticsConcept.flavor, "Flavor A: Mythology Meets Mundane Reality");
  assert.equal(logisticsConcept.suggestedLayout, "The Classic Patrol");
  assert.match(logisticsConcept.hookLine, /how much money do you actually have\?"$/);
});

test("scoutTopics executes live and returns 3 diverse pre-validated concepts", async () => {
  const result = await scoutTopics();

  assert.equal(result.schemaVersion, 1);
  assert.ok(result.scoutedAt);
  assert.equal(result.theme, "all");
  assert.equal(result.proposals.length, 3, "Must propose exactly 3 concepts");

  for (const proposal of result.proposals) {
    assert.ok(proposal.id, "Proposal must have id");
    assert.ok(proposal.title, "Proposal must have title");
    assert.ok(proposal.flavor, "Proposal must have flavor");
    assert.ok(proposal.searchVelocityQuery, "Proposal must have search query");
    assert.ok(proposal.hookLine.startsWith('Speaker 1 (Robin): "Bruce, serious question: '));
    assert.ok(proposal.coreConflict, "Proposal must explain core conflict");
    assert.ok(["The Classic Patrol", "The Universe Breach"].includes(proposal.suggestedLayout));
  }
});

test("scoutTopics supports custom theme seed filtering", async () => {
  const result = await scoutTopics({ theme: "money" });
  assert.equal(result.theme, "money");
  assert.equal(result.proposals.length, 3);
  assert.ok(result.proposals.some((p) => /money|rich|cost|spend|make money/i.test(p.searchVelocityQuery)));
});

test("scoutTopics falls back to golden benchmarks if network returns empty", async () => {
  // Pass empty mockQueries to trigger graceful fallback
  const result = await scoutTopics({ mockQueries: [] });
  assert.equal(result.proposals.length, 3);
  assert.equal(result.proposals[0].id, FALLBACK_TOPICS[0].id);
  assert.equal(result.proposals[1].id, FALLBACK_TOPICS[1].id);
  assert.equal(result.proposals[2].id, FALLBACK_TOPICS[2].id);
});
