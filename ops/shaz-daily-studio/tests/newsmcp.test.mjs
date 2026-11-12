import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { fetchNewsMcpEvents, NewsMcpError, pickDistinctEvents } from "../newsmcp.mjs";
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
    fetchFn: async (_url, init) => {
      capturedAuth = init.headers.Authorization;
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
  assert.equal(capturedAuth, "Bearer nmcp_key_with=equals==");
  assert.equal(events[0].eventId, "evt_101");
  assert.deepEqual(events[0].sources, ["https://example.com/a", "https://example.com/b"]);

  await assert.rejects(
    () =>
      fetchNewsMcpEvents({
        apiKey: "secret_token_value",
        fetchFn: async () => ({ ok: false, status: 429, statusText: "Too Many Requests", text: async () => "rate limited" }),
      }),
    (err) => err instanceof NewsMcpError && /HTTP 429/.test(err.message),
  );

  await assert.rejects(
    () =>
      fetchNewsMcpEvents({
        apiKey: "secret_token_value",
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
      fetchFn: async (_url, init) => {
        capturedAuth = init.headers.Authorization;
        return { ok: true, json: async () => ({ events: [] }) };
      },
    });
    assert.equal(capturedAuth, "Bearer abc==def=123");
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
        return { picks: [{ eventId: "evt_1", reason: "a" }, { eventId: "evt_1", reason: "dup" }] };
      }
      return { picks: [{ eventId: "evt_1", reason: "sony news" }, { eventId: "evt_3", reason: "nintendo update" }] };
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
