import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadLedger, recordTopic } from "../content-ledger.mjs";
import {
  buildAuthorPrompt,
  buildTargetedImageQueries,
  findTopStories,
  runDailyBatch,
  sourceStoryMedia,
} from "../studio-daily.mjs";
import { AgentUnavailableError } from "../../../v3/lib/agent-bridge.ts";

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

  for (const q of ps5Queries) {
    assert.doesNotMatch(q, /Spider-Man/i);
    assert.doesNotMatch(q, /disc drive/i);
    assert.doesNotMatch(q, /IGN/i);
    assert.match(q, /Back Market/i);
  }

  const appleTopic = "Apple announces new iPad Air with M3 chip";
  const appleQueries = buildTargetedImageQueries(appleTopic, {});

  for (const q of appleQueries) {
    assert.doesNotMatch(q, /Steve Jobs Theater/i);
    assert.doesNotMatch(q, /John Ternus/i);
    assert.match(q, /iPad Air/i);
  }
});

test("findTopStories uses NewsMCP only, applies v2 ledger filters, and delegates event deduplication to pinned agent", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-scout-test-"));
  const ledgerPath = path.join(tmpDir, "published-topics.json");
  try {
    await recordTopic(
      { eventId: "evt_old", link: "https://example.com/old", title: "Already Published Event" },
      { ledgerPath, runId: "run-0" },
    );

    let capturedAgentOpts = null;
    const picks = await findTopStories({
      count: 2,
      ledgerPath,
      deps: {
        newsMcpApiKey: "test-key",
        fetchFn: async () => ({
          ok: true,
          json: async () => ({
            events: [
              { event_id: "evt_old", headline: "Already Published Event", sources: ["https://example.com/old"], newsrooms: 3 },
              { event_id: "evt_new_a", headline: "Switch 2 Sales Milestone", sources: ["https://example.com/a"], newsrooms: 5 },
              { event_id: "evt_new_b", headline: "Valve Steam Frame Headset Pricing", sources: ["https://example.com/b"], newsrooms: 2 },
            ],
          }),
        }),
        askAgentFn: async (_prompt, opts) => {
          capturedAgentOpts = opts;
          return {
            picks: [
              { eventId: "evt_new_b", reason: "Hardware pricing drama" },
              { eventId: "evt_new_a", reason: "Sales milestone" },
            ],
          };
        },
      },
    });

    assert.equal(capturedAgentOpts.agent, "agy");
    assert.equal(capturedAgentOpts.requireJson, true);
    assert.deepEqual(picks.map((p) => p.topic.eventId), ["evt_new_b", "evt_new_a"]);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("runDailyBatch alerts Telegram & stops on 0 fresh stories or AgentUnavailableError, and skips ledger writes during dryRun", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-batch-guards-"));
  const ledgerPath = path.join(tmpDir, "published-topics.json");
  const testEnv = { ...process.env, WIGGLY_STUDIO_HOME: tmpDir };
  const telegramMessages = [];

  try {
    // Zero fresh stories -> Telegram alert + throw
    await assert.rejects(
      () =>
        runDailyBatch({
          count: 3,
          ledgerPath,
          env: testEnv,
          deps: {
            findTopStories: async () => [],
            sendTelegramMessage: async ({ text }) => {
              telegramMessages.push(text);
              return {};
            },
          },
        }),
      /No fresh stories available/,
    );
    assert.match(telegramMessages[0], /No Fresh Stories Today/);

    // AgentUnavailableError -> Telegram alert + rethrow
    telegramMessages.length = 0;
    await assert.rejects(
      () =>
        runDailyBatch({
          count: 3,
          ledgerPath,
          env: testEnv,
          deps: {
            findTopStories: async () => {
              throw new AgentUnavailableError("Pinned agent CLI 'agy' is unavailable");
            },
            sendTelegramMessage: async ({ text }) => {
              telegramMessages.push(text);
              return {};
            },
          },
        }),
      AgentUnavailableError,
    );
    assert.match(telegramMessages[0], /Agent Unavailable/);

    // dryRun must never write shown or published into ledger
    const res = await runDailyBatch({
      count: 3,
      dryRun: true,
      ledgerPath,
      env: testEnv,
      deps: {
        findTopStories: async () => [{ source: "mock", topic: { eventId: "evt_dry", title: "Dry Run Only" } }],
        fetchArticleForTopic: async () => ({
          url: "https://example.com/dry",
          fetchedAt: new Date().toISOString(),
          sha256: "drysha",
          title: "Dry Run Only",
          text: "Dry run article content ".repeat(40),
        }),
        authorShazScript: async () => ({ title: "Dry Run Only", backgroundId: "living-room" }),
        compileDialogueText: () => "Short dry run script.",
        sourceStoryMedia: async () => [],
        synthesizeShazVoice: async ({ outputPath }) => fs.writeFile(outputPath, Buffer.from("wav")),
        resolveRunDirectory: (_root, runId) => path.join(tmpDir, runId),
        execute: () => {},
        composeVerticalVideo: async ({ outputPath }) => {
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(path.join(path.dirname(outputPath), "final.mp4"), Buffer.from("mp4"));
          await fs.writeFile(path.join(path.dirname(outputPath), "transcript.json"), JSON.stringify({ words: [] }));
          await fs.writeFile(outputPath, Buffer.from("vert"));
        },
        sendApprovalVideo: async () => ({ messageId: 1 }),
        sendTelegramMessage: async ({ text }) => {
          telegramMessages.push(text);
          return {};
        },
      },
    });
    assert.equal(res.status, "dry-run-success");
    assert.equal((await loadLedger(ledgerPath)).entries.length, 0);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
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
        searchFn: async () => [],
      });
    },
    (err) => {
      assert.match(err.message, /IMAGE SOURCING ERROR|0 CANDIDATES RETURNED/i);
      return true;
    },
  );
});
