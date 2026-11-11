import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthorPrompt,
  buildTargetedImageQueries,
  findTopStories,
  loadEditorialBacklog,
  sourceStoryMedia,
} from "../studio-daily.mjs";

test("buildAuthorPrompt includes current date, relative countdown, and temporal grounding instructions", () => {
  const topic = {
    title: "Grand Theft Auto VI Is Scheduled for November 19, 2026 Release",
    snippet: "Reports identify November 19, 2026, as the planned release date for Grand Theft Auto VI.",
    publishedAt: "2026-11-03T09:22:07",
  };
  const now = new Date("2026-11-07T12:00:00Z");

  const prompt = buildAuthorPrompt(topic, { now });

  assert.match(prompt, /TODAY IS: Saturday, November 7, 2026/);
  assert.match(prompt, /The current year is strictly 2026/);
  assert.match(prompt, /CRITICAL DATE MATH: The event \(November 19, 2026\) is in EXACTLY 12 days from today/);
  assert.match(prompt, /TEMPORAL ANCHORING \(CRITICAL — PREVENTS AI SLOP\)/);
  assert.match(prompt, /Under NO circumstance assume the current year is 2023, 2024, or 2025/);
  assert.match(prompt, /Story Published: 2026-11-03 \(4 days ago\)/);
  assert.match(prompt, /visualQueries/);
});

test("buildTargetedImageQueries prioritizes author-provided visualQueries", () => {
  const authoredScript = {
    title: "Polish guides highlight video game and Xbox shopping",
    visualQueries: [
      "Xbox Series X retail display Poland Black Friday",
      "Polish gaming deals website shopping guide",
      "Console discounts retail receipt high resolution",
    ],
  };

  const queries = buildTargetedImageQueries("Polish guides highlight video game and Xbox shopping", authoredScript);
  assert.deepEqual(queries, authoredScript.visualQueries);
});

test("buildTargetedImageQueries generates clean story-specific queries without hardcoded PS5/Spider-Man or Apple leaks", () => {
  const ps5Topic = "Back Market offers €40 off refurbished PlayStation 5 consoles";
  const ps5Queries = buildTargetedImageQueries(ps5Topic, {});

  // Must NOT contain hardcoded Spider-Man or disc drive IGN searches
  for (const q of ps5Queries) {
    assert.doesNotMatch(q, /Spider-Man/i);
    assert.doesNotMatch(q, /disc drive/i);
    assert.doesNotMatch(q, /IGN/i);
    assert.match(q, /Back Market/i);
  }

  const appleTopic = "Apple announces new iPad Air with M3 chip";
  const appleQueries = buildTargetedImageQueries(appleTopic, {});

  // Must NOT contain hardcoded John Ternus or Steve Jobs Theater searches
  for (const q of appleQueries) {
    assert.doesNotMatch(q, /Steve Jobs Theater/i);
    assert.doesNotMatch(q, /John Ternus/i);
    assert.match(q, /iPad Air/i);
  }
});

test("loadEditorialBacklog loads external JSON topics and findTopStories supports custom subreddits", async () => {
  const backlog = await loadEditorialBacklog();
  assert.ok(Array.isArray(backlog) && backlog.length >= 3);
  assert.ok(backlog.some((item) => item.title.includes("Steam Deck") || item.title.includes("Console")));

  // findTopStories accepts custom subreddits array
  const stories = await findTopStories({ count: 2, subreddits: ["NintendoSwitch"] });
  assert.equal(stories.length, 2);
});

test("sourceStoryMedia throws loud Rule 12 error on 0 results rather than silently falling back to PS5 images", async () => {
  const mockScript = {
    title: "Obscure Unsearchable Widget",
    visualQueries: [
      "unfindable query 1",
      "unfindable query 2",
      "unfindable query 3",
    ],
  };

  await assert.rejects(
    async () => {
      await sourceStoryMedia({
        topic: { title: "Obscure Unsearchable Widget" },
        script: mockScript,
        stageDir: "/tmp",
        searchFn: async () => [], // Simulates 0 results from image provider
      });
    },
    (err) => {
      // Must follow Rule 12: fail loudly with diagnostic info rather than silently copying ps5-pro-hero.jpg
      assert.match(err.message, /IMAGE SOURCING ERROR|0 CANDIDATES RETURNED/i);
      return true;
    }
  );
});
