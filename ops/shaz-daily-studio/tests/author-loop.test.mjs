import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { authorShazScript, runDailyBatch, ScriptAuthorError } from "../studio-daily.mjs";
import { AgentOutputError, AgentUnavailableError } from "../../../v3/lib/agent-bridge.ts";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_PATH = path.resolve(TESTS_DIR, "../studio-daily.mjs");

const TEST_NOW = new Date("2026-11-07T12:00:00Z");

function makeSampleArticle(url = "https://news.example.com/gta6-date") {
  return {
    url,
    fetchedAt: "2026-11-11T10:00:00Z",
    sha256: "abc123",
    title: "Grand Theft Auto VI Confirmed for November 19, 2026",
    text: [
      "Rockstar Games confirmed today that Grand Theft Auto VI launches on November 19, 2026 for PlayStation 5 and Xbox Series X consoles.",
      "The base digital edition will retail for $69.99 worldwide with a 120GB storage footprint according to storefront listings.",
      "Analysts expect pre-orders to open across participating retail stores next Monday morning with preload opening forty-eight hours early.",
    ].join(" "),
  };
}

function makeValidGroundedScript(url = "https://news.example.com/gta6-date", titleSuffix = "") {
  return {
    schemaVersion: "shaz-script-v1",
    sourceUrl: url,
    title: `GTA 6 Launches November 19${titleSuffix}`,
    headline: "GTA 6 NOVEMBER LAUNCH",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Rockstar locked the November launch date and base retail pricing globally.",
      counterintuitiveAngle: "Console players still need 120GB of free SSD space ready before pre-load day.",
      concreteFactOrStory: "Digital copies cost $69.99 on PlayStation 5 and Xbox Series X at launch.",
    },
    claims: [
      {
        target: "hook",
        says: "Rockstar confirmed GTA VI launches November 19, 2026 for PS5 and Xbox Series X.",
        quote: "Rockstar Games confirmed today that Grand Theft Auto VI launches on November 19, 2026",
      },
      {
        target: "beat-01",
        says: "Base edition retails for $69.99 worldwide with a 120GB footprint.",
        quote: "base digital edition will retail for $69.99 worldwide with a 120GB storage footprint",
      },
    ],
    hook: {
      formula: "surprising-stat",
      text: "Rockstar just confirmed GTA six launches in 12 days on console, and your home storage drive is officially cooked right now.",
    },
    visualQueries: [
      "Grand Theft Auto VI key art official",
      "PlayStation 5 Xbox Series X console lineup",
      "Vice City screenshot Rockstar Games",
    ],
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "Clear out 120GB right now because the base digital edition alone costs $69.99 worldwide.",
        impliedQuestion: "What does the base game cost and require?",
      },
      {
        id: "beat-02",
        connector: "BUT",
        text: "At least pre-orders open across retail stores Monday morning so you still have time to budget.",
        impliedQuestion: "When do pre-orders actually go live?",
      },
      {
        id: "beat-03",
        connector: "THEREFORE",
        text: "Delete three bloated shooters tonight before everybody else starts downloading Vice City at launch.",
        impliedQuestion: "What should players prepare tonight?",
      },
    ],
    landing: {
      type: "question",
      text: "Are you paying $69.99 on day one or waiting until next month?",
    },
    backgroundId: "map-photo-zone",
    hashtags: ["#gta6", "#playstation5", "#xbox"],
  };
}

test("authorShazScript retries up to 3 attempts feeding back exact error + previous payload, and never falls back to templates", async () => {
  const topic = { title: "GTA 6 Launches November 19", link: "https://news.example.com/gta6-date" };
  const article = makeSampleArticle();
  const seenPrompts = [];

  const script = await authorShazScript(topic, {
    now: TEST_NOW,
    article,
    config: { writerAgent: "agy", agentTimeoutMs: 60_000, maxScriptAttempts: 3, batchSize: 3 },
    askAgentFn: async (prompt, opts) => {
      assert.equal(opts.agent, "agy");
      assert.equal(opts.requireJson, true);
      seenPrompts.push(prompt);
      if (seenPrompts.length === 1) {
        throw new AgentOutputError("Non-JSON output", "oops sorry not json");
      }
      if (seenPrompts.length === 2) {
        const bad = makeValidGroundedScript();
        bad.landing.text = "Are you paying $99.99 on day one or waiting until next month?";
        return bad;
      }
      return makeValidGroundedScript();
    },
  });

  assert.equal(seenPrompts.length, 3);
  assert.match(seenPrompts[1], /RETRY REVISION REQUIRED \(ATTEMPT 2\/3\)/);
  assert.match(seenPrompts[1], /Non-JSON output/);
  assert.match(seenPrompts[2], /RETRY REVISION REQUIRED \(ATTEMPT 3\/3\)/);
  assert.match(seenPrompts[2], /\$99\.99/);
  assert.match(seenPrompts[2], /Previous JSON output to repair/);
  assert.equal(script.sourceUrl, article.url);

  // Exhausting all 3 attempts throws ScriptAuthorError (never template fallback)
  let failCalls = 0;
  await assert.rejects(
    () =>
      authorShazScript(topic, {
        now: TEST_NOW,
        article,
        config: { writerAgent: "agy", agentTimeoutMs: 60_000, maxScriptAttempts: 3, batchSize: 3 },
        askAgentFn: async () => {
          failCalls += 1;
          const bad = makeValidGroundedScript();
          bad.claims = [];
          return bad;
        },
      }),
    (err) => err instanceof ScriptAuthorError && err.attempts.length === 3 && failCalls === 3,
  );
});

test("authorShazScript does not retry AgentUnavailableError", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      authorShazScript(
        { title: "Any News", link: "https://news.example.com/gta6-date" },
        {
          now: TEST_NOW,
          article: makeSampleArticle(),
          config: { writerAgent: "agy", agentTimeoutMs: 60_000, maxScriptAttempts: 3, batchSize: 3 },
          askAgentFn: async () => {
            calls += 1;
            throw new AgentUnavailableError("agy timed out after 60000ms");
          },
        },
      ),
    AgentUnavailableError,
  );
  assert.equal(calls, 1);
});

test("runDailyBatch skips failed article/3x-script stories, pulls backup NewsMCP event, and notes skips in Telegram summary", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-skip-test-"));
  const telegramBannerTexts = [];
  const dispatchedTitles = [];

  try {
    const result = await runDailyBatch({
      count: 2,
      dryRun: true,
      env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
      deps: {
        findTopStories: async () => [
          { source: "newsmcp", topic: { eventId: "e1", title: "Paywalled Story", sources: ["https://paywall.example.com/1"] } },
          { source: "newsmcp", topic: { eventId: "e2", title: "Good Story A", sources: ["https://open.example.com/a"] } },
          { source: "newsmcp", topic: { eventId: "e3", title: "Bad Agent Draft Story", sources: ["https://open.example.com/b"] } },
          { source: "newsmcp", topic: { eventId: "e4", title: "Good Story B", sources: ["https://open.example.com/c"] } },
        ],
        fetchArticleForTopic: async (topic) => {
          if (topic.eventId === "e1") {
            const { ArticleFetchError } = await import("../article-fetch.mjs");
            throw new ArticleFetchError("Paywall 403", [{ url: topic.sources[0], reason: "403" }]);
          }
          return makeSampleArticle(topic.sources[0]);
        },
        authorShazScript: async (topic) => {
          if (topic.eventId === "e3") {
            throw new ScriptAuthorError("Failed 3 attempts", [{ attempt: 1 }, { attempt: 2 }, { attempt: 3 }]);
          }
          return makeValidGroundedScript(topic.sources[0], ` - ${topic.title}`);
        },
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
        sendApprovalVideo: async ({ title }) => {
          dispatchedTitles.push(title);
          return { messageId: dispatchedTitles.length };
        },
        sendTelegramMessage: async ({ text }) => {
          telegramBannerTexts.push(text);
          return {};
        },
      },
    });

    assert.equal(result.status, "dry-run-success");
    assert.equal(result.candidates.length, 2);
    assert.equal(result.skips.length, 2);
    assert.deepEqual(dispatchedTitles, [
      "GTA 6 Launches November 19 - Good Story A",
      "GTA 6 Launches November 19 - Good Story B",
    ]);
    assert.match(telegramBannerTexts[0], /Skipped 2 candidates/);
    assert.match(telegramBannerTexts[0], /<i>Paywalled Story<\/i> \(article-fetch\)/);
    assert.match(telegramBannerTexts[0], /<i>Bad Agent Draft Story<\/i> \(script-author\)/);
    assert.match(telegramBannerTexts[0], /Writer: <code>agy<\/code>/);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("static P2-V3 guardrail: zero template fallback phrases remain in studio-daily.mjs", async () => {
  const source = await fs.readFile(STUDIO_PATH, "utf8");
  for (const banned of [
    "Everyone is buzzing about",
    "READ THE FINE PRINT",
    "HYPE VS PRICE TAG",
    "PREPARE FOR THE WORST",
    "CRUSTY USED CONSOLES",
    "CRUSTY USED HARDWARE",
    "ZERO ACTUAL DISCOUNTS",
    "UNCONFIRMED DEAL RUMORS",
    "PURE ALGORITHM CLICKBAIT",
  ]) {
    assert.equal(source.includes(banned), false, `Found banned template/leaky phrase in studio-daily.mjs: ${banned}`);
  }
});
