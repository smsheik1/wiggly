import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RunStopError } from "../errors.mjs";
import { parseSecretsEnv, redactSecrets } from "../secrets.mjs";
import { getPendingBatchPath, resumePendingBatchPoll, runDailyBatch } from "../studio-daily.mjs";
import {
  computeChicagoDeadline,
  escapeTelegramHtml,
  flushTelegramBacklog,
  pollBatchDecision,
  sendApprovalVideo,
} from "../telegram-approval.mjs";

const SENTINEL_TOKEN = "123456:TEST_BOT_TOKEN_SENTINEL";

test("parseSecretsEnv preserves base64 '=' padding and trims matching quotes", () => {
  const parsed = parseSecretsEnv(
    [
      "# comment line",
      'TELEGRAM_BOT_TOKEN="123456:abc== "',
      "STUDIO_UPLOAD_SECRET='deadbeef=='",
      "CONVEX_SITE_URL=https://wry-viper-639.convex.site",
    ].join("\n"),
  );

  assert.equal(parsed.TELEGRAM_BOT_TOKEN, "123456:abc==");
  assert.equal(parsed.STUDIO_UPLOAD_SECRET, "deadbeef==");
  assert.equal(parsed.CONVEX_SITE_URL, "https://wry-viper-639.convex.site");
});

test("redactSecrets masks Telegram bot tokens and known secret strings", () => {
  const masked = redactSecrets(
    `Error calling https://api.telegram.org/bot${SENTINEL_TOKEN}/sendVideo with header my-super-secret-value`,
    ["my-super-secret-value"],
    { env: {} },
  );

  assert.doesNotMatch(masked, /TEST_BOT_TOKEN_SENTINEL/);
  assert.doesNotMatch(masked, /my-super-secret-value/);
  assert.match(masked, /bot\[REDACTED\]/);
  assert.match(masked, /\[REDACTED\]/);
});

test("sendApprovalVideo never calls /getFile and never returns a token URL", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-approval-test-"));
  const videoPath = path.join(tempDir, "candidate.mp4");
  await fs.writeFile(videoPath, Buffer.from("fake-mp4-bytes"));

  const calledUrls = [];
  const mockFetch = async (url) => {
    calledUrls.push(String(url));
    if (String(url).includes("/getFile")) {
      throw new Error("/getFile must never be called");
    }
    return {
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          message_id: 42,
          video: { file_id: "file_abc" },
        },
      }),
    };
  };

  try {
    const res = await sendApprovalVideo({
      videoPath,
      title: "GTA 6 News",
      runId: "daily-test-1",
      captionText: "Voice script line.",
      token: SENTINEL_TOKEN,
      chatId: "999999",
      fetchFn: mockFetch,
    });

    assert.equal(calledUrls.length, 1);
    assert.match(calledUrls[0], /\/sendVideo$/);
    assert.equal(calledUrls.some((u) => u.includes("/getFile")), false);
    assert.deepEqual(res, {
      messageId: 42,
      fileId: "file_abc",
      chatId: "999999",
    });
    assert.equal("publicVideoUrl" in res, false);
    assert.equal(JSON.stringify(res).includes(SENTINEL_TOKEN), false);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("sendApprovalVideo scrubs bot token from thrown errors", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-err-test-"));
  const videoPath = path.join(tempDir, "candidate.mp4");
  await fs.writeFile(videoPath, Buffer.from("fake-mp4-bytes"));

  try {
    await assert.rejects(
      () =>
        sendApprovalVideo({
          videoPath,
          title: "Fail Test",
          runId: "daily-test-2",
          token: SENTINEL_TOKEN,
          chatId: "999999",
          fetchFn: async () => {
            throw new Error(`request to https://api.telegram.org/bot${SENTINEL_TOKEN}/sendVideo failed`);
          },
        }),
      (err) => {
        assert.equal(err.message.includes(SENTINEL_TOKEN), false);
        assert.match(err.message, /bot\[REDACTED\]/);
        return true;
      },
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("escapeTelegramHtml & sendApprovalVideo dryRun uses HTML without buttons even with Markdown chars", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-dryrun-html-"));
  const videoPath = path.join(tempDir, "candidate.mp4");
  await fs.writeFile(videoPath, Buffer.from("fake-mp4"));

  let capturedFormData = null;
  try {
    await sendApprovalVideo({
      videoPath,
      title: "Valve <Deck> & *Wild* _Sub_ [2]",
      runId: "daily-dry-1",
      captionText: "Look at <this> & [that]!",
      candidateNumber: 1,
      totalCandidates: 3,
      dryRun: true,
      token: SENTINEL_TOKEN,
      chatId: "999999",
      fetchFn: async (_url, init) => {
        capturedFormData = init.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, result: { message_id: 11, video: { file_id: "f1" } } }),
        };
      },
    });

    assert.equal(capturedFormData.get("parse_mode"), "HTML");
    assert.equal(capturedFormData.get("reply_markup"), null, "dryRun must not attach inline buttons");
    const caption = capturedFormData.get("caption");
    assert.match(caption, /🧪 <b>DRY RUN — won't post<\/b>/);
    assert.match(caption, /Valve &lt;Deck&gt; &amp; \*Wild\* _Sub_ \[2\]/);
    assert.equal(escapeTelegramHtml("a<b>c&d"), "a&lt;b&gt;c&amp;d");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("computeChicagoDeadline picks 20:00 America/Chicago across CST/CDT and rolls past-8pm to tomorrow", () => {
  // 2026-11-11 15:00 CST (21:00 UTC) -> same day 20:00 CST (2026-11-12T02:00:00Z)
  const cstBefore = computeChicagoDeadline(new Date("2026-11-11T21:00:00Z"));
  assert.equal(cstBefore.toISOString(), "2026-11-12T02:00:00.000Z");

  // 2026-11-11 20:30 CST (2026-11-12T02:30:00Z) -> next day 20:00 CST (2026-11-13T02:00:00Z)
  const cstAfter = computeChicagoDeadline(new Date("2026-11-12T02:30:00Z"));
  assert.equal(cstAfter.toISOString(), "2026-11-13T02:00:00.000Z");

  // 2026-07-15 14:00 CDT (19:00 UTC) -> same day 20:00 CDT (2026-07-16T01:00:00Z)
  const cdtBefore = computeChicagoDeadline(new Date("2026-07-15T19:00:00Z"));
  assert.equal(cdtBefore.toISOString(), "2026-07-16T01:00:00.000Z");
});

test("pollBatchDecision rejects missing operatorUserId, blocks unauthorized users/chats, handles expired batch & all-passed", async () => {
  await assert.rejects(
    () =>
      pollBatchDecision({
        candidates: [{ runId: "r1", title: "Story 1" }],
        token: SENTINEL_TOKEN,
        chatId: "999999",
        env: {},
        secretsPath: null,
        fetchFn: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: [] }) }),
      }),
    (err) => err instanceof RunStopError && err.code === "TELEGRAM_MISSING_OPERATOR_ID",
  );

  // Flush backlog returns latest update_id so live polling starts at baseline + 1
  const requestedUrls = [];
  const baseline = await flushTelegramBacklog({
    token: SENTINEL_TOKEN,
    fetchFn: async (url) => {
      requestedUrls.push(url);
      return { ok: true, status: 200, json: async () => ({ ok: true, result: [{ update_id: 500 }] }) };
    },
  });
  assert.equal(baseline, 500);
  assert.match(requestedUrls[0], /getUpdates\?offset=-1&timeout=0$/);

  const answers = [];
  const editedCaptions = [];
  const unauthorized = [];
  let nowMs = 1_000_000;
  let pollStep = 0;

  const res = await pollBatchDecision({
    candidates: [
      { runId: "r1", title: "Cand 1", messageId: 10 },
      { runId: "r2", title: "Cand 2", messageId: 11 },
    ],
    batchId: "b1",
    initialUpdateId: baseline,
    deadline: new Date(nowMs + 30_000),
    token: SENTINEL_TOKEN,
    chatId: "999999",
    operatorUserId: "777777",
    nowFn: () => new Date(nowMs),
    sleepFn: async () => {
      nowMs += 1000;
    },
    onUnauthorizedTap: (entry) => unauthorized.push(entry),
    fetchFn: async (url, init) => {
      const u = String(url);
      if (u.includes("/getUpdates")) {
        requestedUrls.push(u);
        pollStep += 1;
        if (pollStep === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: [
                // Wrong user
                {
                  update_id: 501,
                  callback_query: {
                    id: "cb_unauth_user",
                    from: { id: 888888 },
                    message: { chat: { id: 999999 }, message_id: 10 },
                    data: "approve:r1",
                  },
                },
                // Wrong chat
                {
                  update_id: 502,
                  callback_query: {
                    id: "cb_unauth_chat",
                    from: { id: 777777 },
                    message: { chat: { id: 111111 }, message_id: 10 },
                    data: "approve:r1",
                  },
                },
                // Old batch button from authorized Shaz
                {
                  update_id: 503,
                  callback_query: {
                    id: "cb_expired",
                    from: { id: 777777 },
                    message: { chat: { id: 999999 }, message_id: 9 },
                    data: "approve:old-run",
                  },
                },
                // Authorized reject #1
                {
                  update_id: 504,
                  callback_query: {
                    id: "cb_rej_1",
                    from: { id: 777777 },
                    message: { chat: { id: 999999 }, message_id: 10 },
                    data: "reject:r1",
                  },
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: [
              // Authorized approve #2
              {
                update_id: 505,
                callback_query: {
                  id: "cb_app_2",
                  from: { id: 777777 },
                  message: { chat: { id: 999999 }, message_id: 11 },
                  data: "approve:r2",
                },
              },
            ],
          }),
        };
      }
      if (u.includes("/answerCallbackQuery")) {
        answers.push(JSON.parse(init.body));
      }
      if (u.includes("/editMessageCaption")) {
        editedCaptions.push(JSON.parse(init.body));
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
    },
  });

  assert.match(requestedUrls[1], /offset=501/);
  assert.equal(unauthorized.length, 2);
  assert.deepEqual(
    answers.map((a) => a.text),
    [
      "Not allowed",
      "Not allowed",
      "This batch has expired",
      "❌ Candidate passed.",
      '⏳ Picked "Cand 2" — finalizing & publishing...',
    ],
  );
  assert.equal(res.status, "approved");
  assert.equal(res.runId, "r2");
  assert.match(editedCaptions[1].caption, /Picked — finalizing &amp; publishing/);
  assert.doesNotMatch(editedCaptions[1].caption, /POSTED TO INSTAGRAM/);

  // Test all-passed when rejecting all candidates
  const allPassed = await pollBatchDecision({
    candidates: [{ runId: "r1", title: "One" }, { runId: "r2", title: "Two" }],
    deadline: new Date(Date.now() + 60_000),
    token: SENTINEL_TOKEN,
    chatId: "999999",
    operatorUserId: "777777",
    fetchFn: async (url) => {
      if (String(url).includes("/getUpdates")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            result: [
              { update_id: 1, callback_query: { id: "a", from: { id: 777777 }, message: { chat: { id: 999999 } }, data: "reject:r1" } },
              { update_id: 2, callback_query: { id: "b", from: { id: 777777 }, message: { chat: { id: 999999 } }, data: "reject:r2" } },
            ],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, result: true }) };
    },
  });
  assert.equal(allPassed.status, "all-passed");
  assert.deepEqual(allPassed.rejectedRunIds.sort(), ["r1", "r2"]);

  // Test no-pick deadline expiration
  let clock = 1000;
  const noPick = await pollBatchDecision({
    candidates: [{ runId: "r1", title: "One" }],
    deadline: new Date(2500),
    token: SENTINEL_TOKEN,
    chatId: "999999",
    operatorUserId: "777777",
    nowFn: () => new Date(clock),
    sleepFn: async () => { clock += 2000; },
    fetchFn: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, result: [] }) }),
  });
  assert.equal(noPick.status, "no-pick");
});

test("pollBatchDecision throws RunStopError immediately on HTTP 401 and 409", async () => {
  let calls401 = 0;
  await assert.rejects(
    () =>
      pollBatchDecision({
        candidates: [{ runId: "r1", title: "One" }],
        deadline: new Date(Date.now() + 60_000),
        token: SENTINEL_TOKEN,
        chatId: "999999",
        operatorUserId: "777777",
        fetchFn: async () => {
          calls401 += 1;
          return { ok: false, status: 401, json: async () => ({ ok: false, description: "Unauthorized" }) };
        },
      }),
    (err) => err instanceof RunStopError && err.code === "TELEGRAM_AUTH_OR_CHAT" && err.canAlert === false,
  );
  assert.equal(calls401, 1);

  let calls409 = 0;
  await assert.rejects(
    () =>
      pollBatchDecision({
        candidates: [{ runId: "r1", title: "One" }],
        deadline: new Date(Date.now() + 60_000),
        token: SENTINEL_TOKEN,
        chatId: "999999",
        operatorUserId: "777777",
        fetchFn: async () => {
          calls409 += 1;
          return { ok: false, status: 409, json: async () => ({ ok: false, description: "Conflict" }) };
        },
      }),
    (err) => err instanceof RunStopError && err.code === "TELEGRAM_409_CONFLICT" && err.canAlert === true,
  );
  assert.equal(calls409, 1);
});

test("runDailyBatch --dry-run sends buttonless labeled preview & resumePendingBatchPoll recovers interrupted waits", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-resume-dryrun-"));
  const testEnv = { ...process.env, WIGGLY_STUDIO_HOME: tmpDir };
  const dispatchedDryFlags = [];
  const messages = [];

  try {
    // 1. dryRun passes dryRun: true to sendApprovalVideo, never polls or writes pending-batch.json
    const dryRes = await runDailyBatch({
      count: 1,
      dryRun: true,
      env: testEnv,
      deps: {
        findTopStories: async () => [{ source: "newsmcp", topic: { eventId: "e_dry", title: "Dry <Title>" } }],
        fetchArticleForTopic: async () => ({
          url: "https://example.com/dry",
          fetchedAt: "2026-11-11T12:00:00Z",
          sha256: "0".repeat(64),
          title: "Dry <Title>",
          text: "Article body text about game update on Tuesday. ".repeat(20),
        }),
        authorShazScript: async () => ({ title: "Dry <Title>", backgroundId: "living-room" }),
        compileDialogueText: () => "Short dry run test script.",
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
        sendApprovalVideo: async ({ dryRun }) => {
          dispatchedDryFlags.push(dryRun);
          return { messageId: 1, chatId: "999999" };
        },
        sendTelegramMessage: async ({ text, replyMarkup }) => {
          messages.push({ text, replyMarkup });
          return {};
        },
      },
    });
    assert.equal(dryRes.status, "dry-run-success");
    assert.deepEqual(dispatchedDryFlags, [true]);
    assert.match(messages[0].text, /🧪 <b>DRY RUN — won't post<\/b>/);
    assert.equal(messages[0].replyMarkup, undefined);
    await assert.rejects(() => fs.stat(getPendingBatchPath(testEnv)), { code: "ENOENT" });

    // 2. resumePendingBatchPoll handles no-pick and cleans pending-batch.json
    const pendingPath = getPendingBatchPath(testEnv);
    await fs.writeFile(
      pendingPath,
      JSON.stringify({
        schemaVersion: 1,
        batchId: "batch-test",
        baselineUpdateId: 77,
        deadlineIso: new Date(Date.now() + 60_000).toISOString(),
        rejectedRunIds: [],
        candidates: [{ candidateNumber: 1, runId: "daily-1", script: { title: "Saved Cand" }, approval: { messageId: 9, chatId: "999999" } }],
      }),
    );
    messages.length = 0;
    const resumedNoPick = await resumePendingBatchPoll({
      env: testEnv,
      deps: {
        pollBatchDecision: async ({ initialUpdateId }) => {
          assert.equal(initialUpdateId, 77);
          return { status: "no-pick" };
        },
        sendTelegramMessage: async ({ text }) => {
          messages.push({ text });
          return {};
        },
      },
    });
    assert.equal(resumedNoPick.status, "no-pick");
    assert.match(messages[0].text, /No pick today/);
    await assert.rejects(() => fs.stat(pendingPath), { code: "ENOENT" });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});
