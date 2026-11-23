import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { enforceStoryMix, fetchNewsMcpEvents, fetchStoryPool, NewsMcpError, pickDistinctEvents, STORY_AREAS } from "../newsmcp.mjs";
import { AgentOutputError, AgentUnavailableError } from "../../../v3/lib/agent-bridge.ts";

test("fetchNewsMcpEvents throws loud Rule 12 error when NEWSMCP_API_KEY is missing", async () => {
  await assert.rejects(
    () => fetchNewsMcpEvents({ env: {}, secretsPath: "/nonexistent/secrets.env" }),
    (err) => err instanceof NewsMcpError && /NEWSMCP_API_KEY is missing/.test(err.message) && /https:\/\/newsmcp\.com/.test(err.message),
  );
});

test("fetchNewsMcpEvents throws on HTTP non-ok and malformed JSON payloads while preserving = in keys", async () => {
  let capturedAuth = null;
  const events = await fetchNewsMcpEvents({
    apiKey: "nmcp_key_with=equals==",
    sector: "gaming_esports",
    fetchFn: async (_url, init) => {
      capturedAuth = init.headers["x-api-key"];
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              event_id: "evt_101",
              headline: "Valve Announces Steam Machine 2",
              abstract: "Shipping in fall 2026.",
              sources: ["https://example.com/a", "https://example.com/b"],
              newsrooms: 4,
              last_seen: "2026-11-11T10:00:00Z",
            },
          ],
        }),
      };
    },
  });
  assert.equal(capturedAuth, "nmcp_key_with=equals==");
  assert.equal(events[0].eventId, "evt_101");
  assert.deepEqual(events[0].sources, ["https://example.com/a", "https://example.com/b"]);

  await assert.rejects(
    () =>
      fetchNewsMcpEvents({
        apiKey: "secret_token_value",
        sector: "gaming_esports",
        fetchFn: async () => ({ ok: false, status: 429, statusText: "Too Many Requests", text: async () => "rate limited" }),
      }),
    (err) => err instanceof NewsMcpError && /HTTP 429/.test(err.message),
  );

  await assert.rejects(
    () =>
      fetchNewsMcpEvents({
        apiKey: "secret_token_value",
        sector: "gaming_esports",
        fetchFn: async () => ({ ok: true, json: async () => ({ unexpected: [] }) }),
      }),
    (err) => err instanceof NewsMcpError && /missing 'events' array/.test(err.message),
  );
});

test("secrets.mjs preserves '=' inside key values when reading from secrets.env", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "newsmcp-secrets-"));
  const secretsFile = path.join(tmpDir, "secrets.env");
  try {
    await fs.writeFile(secretsFile, "NEWSMCP_API_KEY=abc==def=123\n", "utf8");
    let capturedAuth = null;
    await fetchNewsMcpEvents({
      env: {},
      secretsPath: secretsFile,
      sector: "gaming_esports",
      fetchFn: async (_url, init) => {
        capturedAuth = init.headers["x-api-key"];
        return { ok: true, json: async () => ({ events: [] }) };
      },
    });
    assert.equal(capturedAuth, "abc==def=123");
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("pickDistinctEvents enforces valid unique eventIds, retries bad output, and aborts immediately on AgentUnavailableError", async () => {
  const candidates = [
    { eventId: "evt_1", title: "Sony Cuts PS5 Price", snippet: "Official cut", newsrooms: 3 },
    { eventId: "evt_2", title: "PS5 Gets Price Cut at Retailers", snippet: "Same event", newsrooms: 2 },
    { eventId: "evt_3", title: "Nintendo Reveals Switch 2 Firmware", snippet: "Update 2.0", newsrooms: 5 },
  ];

  // Duplicate eventId triggers retry with exact error fed back, then succeeds
  const prompts = [];
  const picked = await pickDistinctEvents({
    candidates,
    recentPublishedTitles: ["Xbox Series X Refresh Announced"],
    maxPicks: 2,
    askAgentFn: async (prompt) => {
      prompts.push(prompt);
      if (prompts.length === 1) {
        return { picks: [{ eventId: "evt_1", reason: "a", conflict: "Sony vs PS5 owners" }, { eventId: "evt_1", reason: "dup", conflict: "Sony vs PS5 owners" }] };
      }
      return {
        picks: [
          { eventId: "evt_1", reason: "sony news", franchise: "PlayStation", conflict: "Sony vs fans who paid full price" },
          { eventId: "evt_3", reason: "nintendo update", franchise: "Nintendo Switch", conflict: "Nintendo vs owners of old storage cards" },
        ],
      };
    },
  });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Duplicate eventId 'evt_1'/);
  assert.deepEqual(picked.map((p) => p.topic.eventId), ["evt_1", "evt_3"]);

  // Unknown eventId exhausts retries cleanly
  await assert.rejects(
    () =>
      pickDistinctEvents({
        candidates,
        askAgentFn: async () => ({ picks: [{ eventId: "evt_999", reason: "made up" }] }),
      }),
    (err) => err instanceof AgentOutputError && /Unknown eventId 'evt_999'/.test(err.message),
  );

  // AgentUnavailableError is never retried
  let calls = 0;
  await assert.rejects(
    () =>
      pickDistinctEvents({
        candidates,
        askAgentFn: async () => {
          calls += 1;
          throw new AgentUnavailableError("CLI missing");
        },
      }),
    AgentUnavailableError,
  );
  assert.equal(calls, 1);
});

test("story areas are NewsMCP sectors only: no keyword or brand lists (destroyed 2026-11-23)", () => {
  assert.deepEqual(STORY_AREAS.map((a) => a.id), ["games", "tech", "entertainment"]);
  for (const a of STORY_AREAS) {
    assert.equal(a.query, undefined, `${a.id} has no keyword query`);
    assert.match(a.sector, /^[a-z_]+(,[a-z_]+)*$/, `${a.id} is NewsMCP sector ids only`);
  }
  const all = JSON.stringify(STORY_AREAS).toLowerCase();
  for (const name of ["playstation", "xbox", "nintendo", "gta", "apple", "samsung", "tesla", "youtuber", "disney", "pixar"]) {
    assert.ok(!all.includes(name), `no brand name "${name}" in the searches`);
  }
});

test("fetchNewsMcpEvents refuses a search with no sector (no silent keyword fallback)", async () => {
  await assert.rejects(
    () => fetchNewsMcpEvents({ apiKey: "k", fetchFn: async () => { throw new Error("should not be called"); } }),
    (err) => err instanceof NewsMcpError && /needs a NewsMCP sector/.test(err.message),
  );
});

test("fetchStoryPool searches every area, tags and dedupes events, and only fails if every area fails", async () => {
  const sectors = [];
  const { events, calls } = await fetchStoryPool({
    fetchEventsFn: async ({ sector }) => {
      sectors.push(sector);
      return [{ eventId: "shared", title: "Shared" }, { eventId: `only-${sectors.length}`, title: sector }];
    },
  });
  assert.equal(calls, STORY_AREAS.length);
  assert.deepEqual(sectors, STORY_AREAS.map((a) => a.sector));
  assert.equal(events.filter((e) => e.eventId === "shared").length, 1);
  assert.equal(events.find((e) => e.eventId === "shared").area, "games");

  const warn = console.warn;
  console.warn = () => {};
  try {
    const partial = await fetchStoryPool({
      fetchEventsFn: async ({ sector }) => {
        if (sector === "media_entertainment") throw new Error("boom");
        return [{ eventId: sector, title: sector }];
      },
    });
    assert.equal(partial.events.length, STORY_AREAS.length - 1);
    assert.equal(partial.failures.length, 1);
  } finally {
    console.warn = warn;
  }
  await assert.rejects(
    () => fetchStoryPool({ fetchEventsFn: async () => { throw new Error("down"); } }),
    (err) => err instanceof NewsMcpError && /Every NewsMCP area search failed/.test(err.message),
  );
});

test("enforceStoryMix: 1 story per franchise, 2 per area, keeps the picker's order", () => {
  const p = (id, area, franchise) => ({ topic: { eventId: id, title: id }, area, franchise });
  const { kept, dropped } = enforceStoryMix([
    p("gta-1", "games", "GTA 6"),
    p("gta-2", "games", "gta-6"),
    p("gta-3", "games", "Grand Theft Auto 6".replace("Grand Theft Auto ", "GTA ")),
    p("xbox", "games", "Xbox"),
    p("switch", "games", "Nintendo"),
    p("ai", "tech", "none"),
    p("ai-2", "tech", "none"),
  ]);
  assert.deepEqual(kept.map((k) => k.topic.eventId), ["gta-1", "xbox", "ai", "ai-2"]);
  assert.equal(dropped.length, 3);
  assert.match(dropped[0].reason, /gta 6/);
  assert.match(dropped[2].reason, /2 stories from "games"/);
});

test("pickDistinctEvents rejects picks with no conflict and its prompt asks for conflict + one per franchise", async () => {
  const candidates = [{ eventId: "evt_1", title: "IShowSpeed hits 40M subs", snippet: "Milestone", newsrooms: 2 }];
  const prompts = [];
  await assert.rejects(
    () =>
      pickDistinctEvents({
        candidates,
        askAgentFn: async (prompt) => {
          prompts.push(prompt);
          return { picks: [{ eventId: "evt_1", reason: "big milestone", conflict: "" }] };
        },
      }),
    (err) => err instanceof AgentOutputError && /no "conflict"/.test(err.message),
  );
  assert.match(prompts[0], /CONFLICT IS REQUIRED/);
  assert.match(prompts[0], /ONE STORY PER GAME, FRANCHISE OR COMPANY/);
  assert.match(prompts[1], /no "conflict"/, "the exact error is fed back");
});

test("NewsMCP guardrail: key goes in x-api-key (never Bearer) and areas are searched one at a time", async () => {
  let headers = null;
  await fetchNewsMcpEvents({
    apiKey: "k1",
    sector: "gaming_esports",
    fetchFn: async (_url, init) => { headers = init.headers; return { ok: true, json: async () => ({ events: [] }) }; },
  });
  assert.equal(headers["x-api-key"], "k1");
  assert.equal(headers.Authorization, undefined, "Bearer makes NewsMCP treat us as keyless");

  let inFlight = 0;
  let maxInFlight = 0;
  const { calls } = await fetchStoryPool({
    fetchEventsFn: async ({ sector }) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return [{ eventId: `evt_${sector}`, title: sector }];
    },
  });
  assert.equal(calls, STORY_AREAS.length);
  assert.equal(maxInFlight, 1, "NewsMCP allows only 1 concurrent call");
});

test("picker guardrail: stories ranked by virality (speed x reach x fight), never by area or a rank hint (2026-11-23)", async () => {
  const { rankByVirality, viralityScore, hoursOld } = await import("../newsmcp.mjs");
  const now = new Date("2026-11-23T22:00:00Z");
  const at = (h) => new Date(now.getTime() - h * 3_600_000).toISOString().replace(/\.\d+Z$/, "");
  const pool = [
    { eventId: "g1", title: "Small local games story", snippet: "", area: "games", newsrooms: 14, languageCount: 1, firstSeen: at(2) },
    { eventId: "g2", title: "Old games story", snippet: "", area: "games", newsrooms: 60, languageCount: 5, firstSeen: at(120) },
    { eventId: "t1", title: "CEO fired and rehired", snippet: "", area: "tech", newsrooms: 173, languageCount: 30, firstSeen: at(8), eventType: "governance.board_change" },
    { eventId: "e1", title: "Studio sued by fans", snippet: "", area: "entertainment", newsrooms: 14, languageCount: 6, firstSeen: at(2), eventType: "legal_regulatory.lawsuit_filed" },
  ];
  assert.deepEqual(rankByVirality(pool, now).map((p) => p.eventId), ["t1", "e1", "g1", "g2"]);
  const base = { newsrooms: 20, languageCount: 4, firstSeen: at(3) };
  assert.ok(viralityScore(base, now) > viralityScore({ ...base, firstSeen: at(30) }, now), "spreading faster wins");
  assert.ok(viralityScore({ ...base, languageCount: 20 }, now) > viralityScore(base, now), "more languages wins");
  assert.ok(viralityScore({ ...base, eventType: "operations.layoffs" }, now) > viralityScore(base, now), "a labelled fight wins");
  assert.equal(Math.round(hoursOld({ firstSeen: at(8) }, now)), 8, "zone-less NewsMCP times are read as UTC");

  let prompt = "";
  await pickDistinctEvents({ candidates: pool, now, askAgentFn: async (p) => { prompt = p; return { picks: [] }; } });
  assert.doesNotMatch(prompt, /rankHint/);
  assert.doesNotMatch(prompt, /\bGTA\b/);
  assert.match(prompt, /ranked most viral first/);
  const order = [...prompt.matchAll(/"eventId": "([a-z]\d)"/g)].map((m) => m[1]);
  assert.deepEqual(order, ["t1", "e1", "g1", "g2"], "the viral tech fight leads, not the games area");
  assert.match(prompt, /"languages": 30/);
  assert.match(prompt, /"storyType": "governance.board_change"/);
});

test("NewsMCP searches are by sector, sorted trending, and ask for story type", async () => {
  let url = "";
  await fetchNewsMcpEvents({ apiKey: "k", sector: "gaming_esports", fetchFn: async (u) => { url = u; return { ok: true, json: async () => ({ events: [] }) }; } });
  assert.match(url, /[?&]sort=trending\b/);
  assert.match(url, /[?&]sector=gaming_esports\b/);
  assert.match(url, /event_type/);
  assert.doesNotMatch(url, /[?&]q=/, "no keyword search");
});

test("fetchStoryPool pauses between areas and retries a busy NewsMCP slot once, then fails loudly", async () => {
  const waits = [];
  let calls = 0;
  const busy = () => new NewsMcpError('NewsMCP returned HTTP 429 Body: {"message":"Max API Requests Concurrency Reached"}');
  const r = await fetchStoryPool({
    waitFn: async (ms) => { waits.push(ms); },
    fetchEventsFn: async ({ sector }) => {
      calls += 1;
      if (calls === 2) throw busy(); // tech is busy once
      return [{ eventId: `evt_${sector}`, title: sector }];
    },
  });
  assert.equal(r.failures.length, 0, "the retry recovered the busy area");
  assert.equal(calls, STORY_AREAS.length + 1);
  assert.deepEqual(waits, [1500, 4000, 1500]);

  const warn = console.warn;
  console.warn = () => {};
  try {
    const always = await fetchStoryPool({
      waitFn: async () => {},
      fetchEventsFn: async ({ sector }) => { if (sector === "media_entertainment") throw busy(); return [{ eventId: sector, title: sector }]; },
    });
    assert.equal(always.failures.length, 1, "still busy after one retry is reported, not hidden");
  } finally {
    console.warn = warn;
  }
});
