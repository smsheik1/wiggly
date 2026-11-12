import assert from "node:assert/strict";
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { RunStopError } from "../errors.mjs";
import { runDailyBatch } from "../studio-daily.mjs";
import { buildStudioDeliveryRecord, verifyUploadedMediaChecksum } from "../studio-delivery.mjs";

test("buildStudioDeliveryRecord & verifyUploadedMediaChecksum bind delivery to verified checksums and reject mismatches", () => {
  const masterSha = "a".repeat(64);
  const verticalSha = "b".repeat(64);
  const record = buildStudioDeliveryRecord({
    mode: "telegram-pick",
    pick: {
      telegramUserId: 123456,
      chatId: "999999",
      messageId: 42,
      pickedAt: "2026-11-12T05:00:00.000Z",
    },
    masterVideoPath: "/tmp/final.mp4",
    masterVideoSha256: masterSha,
    verticalGate: {
      file: "final-vertical.mp4",
      sha256: verticalSha,
      width: 1080,
      height: 1920,
      durationSeconds: 28.4,
      bytes: 4_200_000,
    },
    qualityReport: {
      status: "pass",
      outputSha256: masterSha,
    },
    publishedMediaSha256: verticalSha,
  });

  assert.equal(record.mode, "telegram-pick");
  assert.equal(record.pick.telegramUserId, 123456);
  assert.equal(record.publishedMediaSha256, verticalSha);
  assert.equal(record.directVideoPerception, undefined);

  assert.throws(
    () =>
      verifyUploadedMediaChecksum({
        uploadedSha256: "c".repeat(64),
        expectedSha256: verticalSha,
      }),
    (err) => err instanceof RunStopError && err.code === "MEDIA_CHECKSUM_MISMATCH",
  );
});

test("runDailyBatch skips candidates failing inspect or vertical gate before Telegram dispatch", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-gate-skip-"));
  const dispatchedTitles = [];
  const telegramMessages = [];
  let execRun = 0;

  try {
    const res = await runDailyBatch({
      count: 1,
      dryRun: true,
      env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
      deps: {
        findTopStories: async () => [
          { source: "newsmcp", topic: { eventId: "e1", title: "Failed Inspect Story", sources: ["https://news.example.com/1"] } },
          { source: "newsmcp", topic: { eventId: "e2", title: "Valid Story", sources: ["https://news.example.com/2"] } },
        ],
        fetchArticleForTopic: async (topic) => ({
          url: topic.sources[0],
          fetchedAt: "2026-11-11T12:00:00Z",
          sha256: "1".repeat(64),
          title: topic.title,
          text: "Nintendo ships firmware 2.0 update Tuesday across console docks. ".repeat(20),
        }),
        authorShazScript: async (topic) => ({
          schemaVersion: "shaz-script-v1",
          sourceUrl: topic.sources[0],
          title: topic.title,
          headline: "STORY HEADLINE",
          backgroundId: "living-room",
        }),
        compileDialogueText: () => "Short grounded dialogue script here.",
        sourceStoryMedia: async () => [],
        synthesizeShazVoice: async ({ outputPath }) => fs.writeFile(outputPath, Buffer.from("wav")),
        resolveRunDirectory: (_root, runId) => path.join(tmpDir, runId),
        execute: (_cmd, args) => {
          const sub = args[1];
          const runArg = args.find((a) => a.startsWith("--run="))?.split("=")[1];
          const runDir = path.join(tmpDir, runArg);
          fsSync.mkdirSync(runDir, { recursive: true });
          if (sub === "init") execRun += 1;
          if (sub === "render") {
            fsSync.writeFileSync(path.join(runDir, "final.mp4"), Buffer.from(`mp4-${execRun}`));
          }
          if (sub === "inspect") {
            const sha = crypto.createHash("sha256").update(Buffer.from(`mp4-${execRun}`)).digest("hex");
            fsSync.writeFileSync(
              path.join(runDir, "quality-report.json"),
              JSON.stringify({
                schemaVersion: 1,
                status: execRun === 1 ? "fail" : "pass",
                outputSha256: sha,
              }),
            );
          }
        },
        assertScriptAligned: () => ({ ok: true, coverage: 1, matchedCount: 1, totalCount: 1, unmatchedWords: [], words: [], segments: [] }),
        composeVerticalVideo: async ({ outputPath }) => {
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(path.join(path.dirname(outputPath), "transcript.json"), JSON.stringify({ words: [] }));
          await fs.writeFile(outputPath, Buffer.from("vert"));
        },
        validateVerticalDeliverable: async ({ verticalVideoPath, sha256Fn }) => ({
          file: path.basename(verticalVideoPath),
          sha256: await sha256Fn(verticalVideoPath),
          width: 1080,
          height: 1920,
          durationSeconds: 30,
          bytes: 4,
        }),
        sendApprovalVideo: async ({ title }) => {
          dispatchedTitles.push(title);
          return { messageId: 1, chatId: "999" };
        },
        sendTelegramMessage: async ({ text }) => {
          telegramMessages.push(text);
          return {};
        },
      },
    });

    assert.equal(res.status, "dry-run-success");
    assert.deepEqual(dispatchedTitles, ["Valid Story"]);
    assert.equal(res.skips.length, 1);
    assert.equal(res.skips[0].stage, "inspect");
    assert.match(telegramMessages[0], /Skipped 1 candidate/);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
