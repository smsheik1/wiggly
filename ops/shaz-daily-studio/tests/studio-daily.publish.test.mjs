import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runDailyBatch } from "../studio-daily.mjs";
import { sendApprovalVideo } from "../telegram-approval.mjs";

const SENTINEL_BOT_TOKEN = "123456:TESTTOKEN_GUARDRAIL";

async function collectAllFilesText(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const chunks = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      chunks.push(...(await collectAllFilesText(full)));
    } else {
      chunks.push(await fs.readFile(full, "utf8").catch(() => ""));
    }
  }
  return chunks;
}

test("runDailyBatch never leaks Telegram bot token, publishes Convex URL to Buffer, and deletes after sent", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "studio-publish-guard-"));
  const consoleOutput = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...args) => consoleOutput.push(args.map(String).join(" "));
  console.warn = (...args) => consoleOutput.push(args.map(String).join(" "));
  console.error = (...args) => consoleOutput.push(args.map(String).join(" "));

  const deletedStorageIds = [];
  const bufferPublishCalls = [];
  const callSequence = [];
  const shownTopics = [];
  const recordedTopics = [];
  let createdRunDir = null;
  let statusPollCount = 0;

  try {
    const deps = {
      findTopStories: async () => [
        { source: "mock", topic: { eventId: "evt_gta6", title: "GTA 6 Launches Soon", link: "https://example.com/gta6" } },
      ],
      fetchArticleForTopic: async (t) => ({
        url: t.link || "https://example.com/gta6",
        fetchedAt: new Date().toISOString(),
        sha256: "deadbeef".repeat(8),
        title: t.title,
        text: "Grand Theft Auto 6 article body content ".repeat(30),
      }),
      authorShazScript: async () => ({
        title: "GTA 6 Launches Soon",
        headline: "GTA 6 SOON",
        backgroundId: "living-room",
        hashtags: ["#gta6", "#gaming"],
      }),
      compileDialogueText: () => "GTA 6 launches soon and fans are ready.",
      sourceStoryMedia: async () => [],
      synthesizeShazVoice: async ({ outputPath }) => {
        await fs.writeFile(outputPath, Buffer.from("fake-wav"));
      },
      resolveRunDirectory: (_root, runId) => {
        createdRunDir = path.join(tempRoot, runId);
        return createdRunDir;
      },
      execute: (_cmd, args) => {
        const subcmd = args[1];
        callSequence.push(`execute:${subcmd}`);
        if (subcmd === "init") {
          return;
        }
      },
      composeVerticalVideo: async ({ outputPath }) => {
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(path.join(path.dirname(outputPath), "final.mp4"), Buffer.from("master-mp4"));
        await fs.writeFile(path.join(path.dirname(outputPath), "transcript.json"), JSON.stringify({ words: [] }));
        await fs.writeFile(outputPath, Buffer.from("vertical-mp4"));
      },
      sendApprovalVideo: async ({ videoPath, title, runId, captionText, candidateNumber, totalCandidates }) =>
        sendApprovalVideo({
          videoPath,
          title,
          runId,
          captionText,
          candidateNumber,
          totalCandidates,
          token: SENTINEL_BOT_TOKEN,
          chatId: "999999",
          fetchFn: async (url) => {
            if (String(url).includes("/getFile")) {
              throw new Error("/getFile must never be called");
            }
            return {
              ok: true,
              json: async () => ({
                ok: true,
                result: { message_id: 77, video: { file_id: "tg_file_1" } },
              }),
            };
          },
        }),
      sendTelegramMessage: async () => ({ message_id: 78 }),
      pollBatchDecision: async ({ candidates }) => ({
        status: "approved",
        runId: candidates[0].runId,
      }),
      sha256: async () => "deadbeef".repeat(8),
      writeJson: async (targetPath, payload) => {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, JSON.stringify(payload, null, 2));
      },
      uploadPublishVideo: async (filePath) => {
        callSequence.push("uploadPublishVideo");
        assert.match(filePath, /final-vertical\.mp4$/);
        return {
          url: "https://wry-viper-639.convex.cloud/api/storage/winner-1",
          storageId: "kg2_winner_1",
          sha256: "deadbeef".repeat(8),
          bytes: 12,
        };
      },
      publishVideoToAllChannels: async (args) => {
        callSequence.push("publishVideoToAllChannels");
        bufferPublishCalls.push(args);
        return {
          success: true,
          channels: {
            instagram: { success: true, service: "instagram", postId: "post_ig_1", status: "sending" },
            youtube: { success: true, service: "youtube", postId: "post_yt_1", status: "sending" },
          },
          pending: [],
        };
      },
      recordShown: async (topic) => {
        shownTopics.push(topic);
      },
      recordTopic: async (topic, meta) => {
        recordedTopics.push({ topic, meta });
        return [];
      },
      getBufferPostsStatus: async ({ postIds }) => {
        statusPollCount += 1;
        callSequence.push(`getBufferPostsStatus:${statusPollCount}`);
        assert.deepEqual(postIds, ["post_ig_1", "post_yt_1"]);
        if (statusPollCount === 1) {
          return { allSent: false, hasError: false, pendingIds: ["post_yt_1"], posts: [] };
        }
        return { allSent: true, hasError: false, pendingIds: [], posts: [] };
      },
      deletePublishVideo: async (storageId) => {
        callSequence.push("deletePublishVideo");
        deletedStorageIds.push(storageId);
        return { deleted: true, storageId };
      },
      sleepFn: async () => {},
      bufferPollIntervalMs: 0,
      bufferPollMaxAttempts: 5,
    };

    const result = await runDailyBatch({
      count: 1,
      env: { ...process.env, WIGGLY_STUDIO_HOME: tempRoot },
      deps,
    });

    assert.equal(result.status, "published");
    assert.equal(bufferPublishCalls.length, 1);
    assert.equal(
      bufferPublishCalls[0].videoUrl,
      "https://wry-viper-639.convex.cloud/api/storage/winner-1",
    );
    assert.equal(JSON.stringify(bufferPublishCalls[0]).includes(SENTINEL_BOT_TOKEN), false);

    // Must upload ONLY after finalize, publish before polling, and delete ONLY after sent
    assert.equal(callSequence.indexOf("execute:finalize") < callSequence.indexOf("uploadPublishVideo"), true);
    assert.equal(callSequence.indexOf("uploadPublishVideo") < callSequence.indexOf("publishVideoToAllChannels"), true);
    assert.equal(callSequence.indexOf("getBufferPostsStatus:2") < callSequence.indexOf("deletePublishVideo"), true);
    assert.deepEqual(deletedStorageIds, ["kg2_winner_1"]);
    assert.equal(shownTopics.length, 1);
    assert.equal(shownTopics[0].eventId, "evt_gta6");
    assert.equal(recordedTopics.length, 1);
    assert.equal(recordedTopics[0].meta.channels.instagram.postId, "post_ig_1");
    assert.equal(recordedTopics[0].meta.channels.youtube.postId, "post_yt_1");

    // Verify publish-media.json exists & records cleanup
    const mediaJsonRaw = await fs.readFile(path.join(createdRunDir, "publish-media.json"), "utf8");
    const mediaJson = JSON.parse(mediaJsonRaw);
    assert.equal(mediaJson.storageId, "kg2_winner_1");
    assert.equal(mediaJson.url, "https://wry-viper-639.convex.cloud/api/storage/winner-1");
    assert.equal(mediaJson.cleanupStatus, "deleted-after-sent");

    // Verify bot token sentinel appears NOWHERE in logs or written run files
    const allLogs = consoleOutput.join("\n");
    assert.equal(allLogs.includes(SENTINEL_BOT_TOKEN), false, "bot token leaked into console output");
    const allRunFiles = (await collectAllFilesText(createdRunDir)).join("\n");
    assert.equal(allRunFiles.includes(SENTINEL_BOT_TOKEN), false, "bot token leaked into run directory");
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
});

test("runDailyBatch skips immediate delete and leaves 7-day failsafe when Buffer never reaches sent", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "studio-publish-timeout-"));
  const deletedStorageIds = [];
  let createdRunDir = null;

  try {
    const result = await runDailyBatch({
      count: 1,
      autoApprove: true,
      env: { ...process.env, WIGGLY_STUDIO_HOME: tempRoot },
      deps: {
        findTopStories: async () => [{ source: "mock", topic: { title: "Timeout Topic" } }],
        fetchArticleForTopic: async () => ({
          url: "https://example.com/timeout",
          fetchedAt: new Date().toISOString(),
          sha256: "deadbeef".repeat(8),
          title: "Timeout Topic",
          text: "Timeout topic article content ".repeat(35),
        }),
        authorShazScript: async () => ({ title: "Timeout Topic", backgroundId: "living-room" }),
        compileDialogueText: () => "Short test dialogue.",
        sourceStoryMedia: async () => [],
        synthesizeShazVoice: async ({ outputPath }) => fs.writeFile(outputPath, Buffer.from("wav")),
        resolveRunDirectory: (_root, runId) => {
          createdRunDir = path.join(tempRoot, runId);
          return createdRunDir;
        },
        execute: () => {},
        composeVerticalVideo: async ({ outputPath }) => {
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          await fs.writeFile(path.join(path.dirname(outputPath), "final.mp4"), Buffer.from("mp4"));
          await fs.writeFile(path.join(path.dirname(outputPath), "transcript.json"), JSON.stringify({ words: [] }));
          await fs.writeFile(outputPath, Buffer.from("vert"));
        },
        sendApprovalVideo: async () => ({ messageId: 1, fileId: "f1", chatId: "9" }),
        sendTelegramMessage: async () => ({}),
        sha256: async () => "abcd".repeat(16),
        writeJson: async (p, data) => {
          await fs.mkdir(path.dirname(p), { recursive: true });
          await fs.writeFile(p, JSON.stringify(data));
        },
        uploadPublishVideo: async () => ({
          url: "https://wry-viper-639.convex.cloud/api/storage/keep-me",
          storageId: "kg2_keep_me",
          sha256: "abcd".repeat(16),
          bytes: 4,
        }),
        publishVideoToAllChannels: async () => ({
          success: true,
          channels: { instagram: { postId: "post_still_sending" } },
          pending: [],
        }),
        recordShown: async () => {},
        recordTopic: async () => [],
        getBufferPostsStatus: async () => ({
          allSent: false,
          hasError: false,
          pendingIds: ["post_still_sending"],
          posts: [],
        }),
        deletePublishVideo: async (id) => deletedStorageIds.push(id),
        sleepFn: async () => {},
        bufferPollIntervalMs: 0,
        bufferPollMaxAttempts: 2,
      },
    });

    assert.equal(result.status, "published");
    assert.deepEqual(deletedStorageIds, []);
    const mediaJson = JSON.parse(await fs.readFile(path.join(createdRunDir, "publish-media.json"), "utf8"));
    assert.equal(mediaJson.cleanupStatus, "deferred-to-7d-ttl");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
});
