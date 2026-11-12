import test from "node:test";
import assert from "node:assert/strict";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  BufferApiError,
  deriveStoryHashtags,
  publishVideoToAllChannels,
  sanitizeHashtags,
} from "../buffer-publisher.mjs";
import { loadLedger } from "../content-ledger.mjs";
import { RunStopError, classifyRunError } from "../errors.mjs";
import { resumePublishForRun, runDailyBatch } from "../studio-daily.mjs";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFakeBufferFetch(options = {}) {
  const {
    channels = [
      { id: "ch-ig", name: "Shaz Skits IG", service: "instagram", isDisconnected: false },
      { id: "ch-yt", name: "Shaz Shorts YT", service: "youtube", isDisconnected: false },
    ],
    onCreatePost,
  } = options;
  const createCalls = [];
  const postsQueries = [];

  const fetchFn = async (_url, init) => {
    const parsed = JSON.parse(init.body);
    const query = String(parsed.query || "");

    if (query.includes("account") && query.includes("organizations")) {
      return jsonResponse({
        data: {
          account: {
            id: "acc-1",
            email: "shaz@example.com",
            organizations: [{ id: "org-1", name: "Shaz Studio" }],
          },
        },
      });
    }

    if (query.includes("GetChannels")) {
      return jsonResponse({
        data: {
          channels,
        },
      });
    }

    if (query.includes("RecentChannelPosts")) {
      const channelId = parsed.variables?.input?.filter?.channelIds?.[0];
      postsQueries.push({ channelId, variables: parsed.variables });
      const recentMap = options.recentPostsByChannel || {};
      const edges = (recentMap[channelId] || []).map((node) => ({ node }));
      return jsonResponse({
        data: {
          posts: { edges },
        },
      });
    }

    if (query.includes("CreatePost")) {
      const input = parsed.variables?.input || {};
      createCalls.push(input);
      if (typeof onCreatePost === "function") {
        return await onCreatePost(input, createCalls.filter((c) => c.channelId === input.channelId).length);
      }
      return jsonResponse({
        data: {
          createPost: {
            __typename: "PostActionSuccess",
            post: { id: `post-${input.channelId}-${createCalls.length}`, status: "sending" },
          },
        },
      });
    }

    throw new Error(`Unexpected GraphQL query in test mock: ${query.slice(0, 80)}`);
  };

  return { fetchFn, createCalls, postsQueries };
}

test("deriveStoryHashtags word-boundary checks match standalone ai/llm/tech without substring false positives", () => {
  const noTech = deriveStoryHashtags("Wait for Details on New Release", { title: "Daily Briefing" });
  assert.equal(noTech.includes("#tech"), false);

  const aiMatch = deriveStoryHashtags("Big AI Model Announcement Today", {});
  assert.equal(aiMatch.includes("#tech"), true);

  const llmMatch = deriveStoryHashtags("Local LLM Benchmark Shocker", {});
  assert.equal(llmMatch.includes("#tech"), true);

  const techMatch = deriveStoryHashtags("Tech Layoffs Hit Hardware Division", {});
  assert.equal(techMatch.includes("#tech"), true);

  assert.deepEqual(sanitizeHashtags([" AI!! ", "Game-Dev", "#PS5", "x", null]), ["#ai", "#gamedev", "#ps5"]);
});

test("publishVideoToAllChannels sanitizes tags onto Buffer payloads and retries only failing channel", async () => {
  const sleepCalls = [];
  const checkpoints = [];
  const { fetchFn, createCalls } = makeFakeBufferFetch({
    onCreatePost: async (input, attemptForChannel) => {
      if (input.channelId === "ch-ig") {
        return jsonResponse({
          data: { createPost: { __typename: "PostActionSuccess", post: { id: "ig-post-1", status: "sending" } } },
        });
      }
      if (input.channelId === "ch-yt" && attemptForChannel < 3) {
        return jsonResponse({ errors: [{ message: "Temporary Buffer 500 error" }] }, 500);
      }
      return jsonResponse({
        data: { createPost: { __typename: "PostActionSuccess", post: { id: "yt-post-3", status: "sending" } } },
      });
    },
  });

  const res = await publishVideoToAllChannels({
    videoUrl: "https://cdn.example.com/clip.mp4",
    title: "Nintendo Switch 2 Dock Leak",
    caption: "Quick recap here.",
    tags: [" Nintendo!! ", "Switch-2", "#Gaming"],
    apiKey: "buf-secret-key",
    retryDelaysMs: [10, 20],
    sleepFn: async (ms) => {
      sleepCalls.push(ms);
    },
    onCheckpoint: async (snap) => {
      checkpoints.push(snap);
    },
    fetchFn,
  });

  assert.equal(res.success, true);
  assert.equal(res.channels.instagram.postId, "ig-post-1");
  assert.equal(res.channels.youtube.postId, "yt-post-3");

  const igCalls = createCalls.filter((c) => c.channelId === "ch-ig");
  const ytCalls = createCalls.filter((c) => c.channelId === "ch-yt");
  assert.equal(igCalls.length, 1, "Instagram should only be called once");
  assert.equal(ytCalls.length, 3, "YouTube should be retried until attempt 3 succeeds");
  assert.deepEqual(sleepCalls, [10, 20]);
  assert.match(igCalls[0].text, /#nintendo #switch2 #gaming/);
  assert.equal(checkpoints.length >= 2, true);
});

test("partial channel failure records ledger immediately, keeps Convex media, alerts with --resume-publish, and resumes cleanly", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-pr-g-"));
  const runsRoot = path.join(tmpDir, "runs");
  const studioHome = path.join(tmpDir, "studio-home");
  const ledgerPath = path.join(studioHome, "published-topics.json");
  const env = {
    ...process.env,
    WIGGLY_STUDIO_HOME: studioHome,
    BUFFER_API_KEY: "buf-test-key",
  };

  let ytShouldFail = true;
  let createCalls = [];
  const { fetchFn: baseFetch } = makeFakeBufferFetch({
    onCreatePost: async (input) => {
      createCalls.push(input);
      if (input.channelId === "ch-yt" && ytShouldFail) {
        return jsonResponse({
          data: {
            createPost: { __typename: "UnexpectedError", message: "YouTube quota timeout" },
          },
        });
      }
      return jsonResponse({
        data: {
          createPost: {
            __typename: "PostActionSuccess",
            post: { id: `post-${input.channelId}`, status: "sending" },
          },
        },
      });
    },
  });

  const deletedStorageIds = [];
  const uploadedPaths = [];
  const telegramMessages = [];
  const editedCaptions = [];
  let createdRunId = null;

  const resolveRunDirectory = (_root, runId) => path.join(runsRoot, runId);

  const sharedDeps = {
    loadStudioConfig: async () => ({
      writerAgent: "claude",
      agentTimeoutMs: 5000,
      maxScriptAttempts: 3,
      batchSize: 1,
      minFreeDiskMb: 0,
      retentionDays: 7,
    }),
    statfsFn: async () => ({ bavail: 10_000, bsize: 1024 * 1024 }),
    resolveRunDirectory,
    findTopStories: async () => [
      { topic: { title: "Valve Steam Deck 2 Battery Details", link: "https://example.com/sd2" }, source: "newsmcp" },
    ],
    fetchArticleForTopic: async () => ({
      url: "https://example.com/sd2",
      text: "Valve engineers confirmed Steam Deck 2 prioritizes battery efficiency.",
      sha256: "abc",
      imageCandidates: [],
    }),
    authorShazScript: async () => ({
      title: "Valve Steam Deck 2 Battery Details",
      headline: "Steam Deck 2 Battery",
      hook: "Valve confirmed Steam Deck 2 battery focus.",
      lines: [{ speaker: "shaz", text: "Valve confirmed Steam Deck 2 prioritizes efficiency." }],
      hashtags: ["#steamdeck", "#gaming"],
      visualQueries: ["steam deck oled", "valve handheld"],
    }),
    compileDialogueText: () => "Valve confirmed Steam Deck 2 prioritizes efficiency.",
    sourceStoryMedia: async () => ["media/shot-1.png"],
    synthesizeShazVoice: async ({ outputPath }) => {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, Buffer.from("fake-wav"));
    },
    execute: (_cmd, args) => {
      const sub = args[1];
      const runArg = args.find((a) => a.startsWith("--run="))?.split("=")[1];
      createdRunId = runArg;
      const runDir = path.join(runsRoot, runArg);
      fsSync.mkdirSync(runDir, { recursive: true });
      if (sub === "init") {
        fsSync.writeFileSync(path.join(runDir, "transcript.json"), JSON.stringify({ words: [] }));
      }
      if (sub === "render") {
        fsSync.writeFileSync(path.join(runDir, "final.mp4"), "fake-master-mp4");
      }
    },
    composeVerticalVideo: async ({ outputPath }) => {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, Buffer.from("fake-vertical-mp4"));
    },
    sendApprovalVideo: async ({ runId }) => ({ chatId: "123", messageId: 99, runId }),
    pollBatchDecision: async () => ({ status: "picked", runId: createdRunId, messageId: 99 }),
    editTelegramMessageCaption: async (payload) => {
      editedCaptions.push(payload);
      return {};
    },
    sendTelegramMessage: async (payload) => {
      telegramMessages.push(payload);
      return {};
    },
    uploadPublishVideo: async (filePath) => {
      uploadedPaths.push(filePath);
      return {
        url: `https://convex.example.com/video-${uploadedPaths.length}.mp4`,
        storageId: `storage-${uploadedPaths.length}`,
        sha256: "vsha",
        bytes: 123,
      };
    },
    deletePublishVideo: async (storageId) => {
      deletedStorageIds.push(storageId);
    },
    publishVideoToAllChannels: (opts) =>
      publishVideoToAllChannels({
        ...opts,
        retryDelaysMs: [0, 0, 0],
        sleepFn: async () => {},
        apiKey: "buf-test-key",
        fetchFn: baseFetch,
      }),
    getBufferPostsStatus: async ({ postIds }) => ({
      posts: postIds.map((id) => ({ id, status: "sent", error: null })),
      allSent: true,
      hasError: false,
      pendingIds: [],
    }),
    bufferPollMaxAttempts: 1,
    bufferPollIntervalMs: 0,
    sleepFn: async () => {},
  };

  try {
    await assert.rejects(
      () =>
        runDailyBatch({
          count: 1,
          ledgerPath,
          env,
          deps: sharedDeps,
        }),
      (err) => err instanceof RunStopError && err.code === "PUBLISH_CHANNEL_INCOMPLETE",
    );

    assert.ok(createdRunId, "runId must be captured");
    const runDir = path.join(runsRoot, createdRunId);
    const savedState = JSON.parse(await fs.readFile(path.join(runDir, "publish-state.json"), "utf8"));
    assert.equal(savedState.channels.instagram.status, "posted");
    assert.equal(savedState.channels.instagram.postId, "post-ch-ig");
    assert.equal(savedState.channels.youtube.status, "failed");
    assert.equal(savedState.channels.tiktok.status, "not-connected");

    const savedMedia = JSON.parse(await fs.readFile(path.join(runDir, "publish-media.json"), "utf8"));
    assert.equal(savedMedia.cleanupStatus, "retained-for-resume");
    assert.equal(deletedStorageIds.length, 0, "Convex media must be preserved on incomplete publish");

    // Ledger must already record 'published' immediately from Instagram success!
    const ledgerAfterPartial = await loadLedger(ledgerPath, { env });
    assert.equal(ledgerAfterPartial.entries.length, 1);
    assert.ok(ledgerAfterPartial.entries[0].published, "entry.published must be populated immediately");
    assert.equal(ledgerAfterPartial.entries[0].published.channels.instagram.postId, "post-ch-ig");
    assert.equal(ledgerAfterPartial.entries[0].published.channels.youtube, undefined);

    const incompleteMsg = telegramMessages.find((m) => m.text.includes("Buffer Publish Incomplete"));
    assert.ok(incompleteMsg, "Telegram alert must mention incomplete publish");
    assert.ok(incompleteMsg.text.includes(`--resume-publish=${createdRunId}`), "Alert must give resume command");
    assert.ok(editedCaptions.some((c) => c.caption.includes("Instagram ✓") && c.caption.includes("YouTube ❌")));

    // Now test --resume-publish with YouTube fixed and video reachable -> IG must NOT be called again!
    ytShouldFail = false;
    createCalls = [];
    const resumed = await resumePublishForRun({
      runId: createdRunId,
      ledgerPath,
      env,
      deps: {
        ...sharedDeps,
        checkPublicVideoReachable: async () => true,
      },
    });

    assert.equal(resumed.status, "published");
    assert.equal(uploadedPaths.length, 1, "Reachable Convex video must NOT be re-uploaded on resume");
    assert.equal(createCalls.filter((c) => c.channelId === "ch-ig").length, 0, "Already-posted IG channel must be skipped");
    assert.equal(createCalls.filter((c) => c.channelId === "ch-yt").length, 1, "Failed YT channel must be posted");
    assert.deepEqual(deletedStorageIds, ["storage-1"], "Convex video must be cleaned up after resume succeeds");

    const ledgerAfterResume = await loadLedger(ledgerPath, { env });
    assert.equal(ledgerAfterResume.entries.length, 1, "Upsert must keep 1 entry for the story");
    assert.equal(ledgerAfterResume.entries[0].published.channels.instagram.postId, "post-ch-ig");
    assert.equal(ledgerAfterResume.entries[0].published.channels.youtube.postId, "post-ch-yt");

    const resumeCompleteMsg = telegramMessages.find((m) => m.text.includes("RESUME PUBLISH COMPLETE"));
    assert.ok(resumeCompleteMsg?.text.includes("Instagram ✓ · YouTube ✓"));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("resumePublishForRun re-uploads expired Convex video and formats 3 connected channels including TikTok", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-pr-g-resume-"));
  const runsRoot = path.join(tmpDir, "runs");
  const studioHome = path.join(tmpDir, "studio-home");
  const ledgerPath = path.join(studioHome, "published-topics.json");
  const runId = "daily-2026-11-11-resumett";
  const runDir = path.join(runsRoot, runId);
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(path.join(runDir, "final-vertical.mp4"), "new-vertical-bytes");
  await fs.writeFile(
    path.join(runDir, "script.json"),
    JSON.stringify({
      title: "PlayStation Portable 2 Rumor",
      hook: { text: "Sony handheld rumors just dropped." },
      beats: [{ text: "Reports point to custom AMD silicon." }],
      landing: { text: "Would you pick one up?" },
      hashtags: ["#playstation", "#gaming"],
    }),
  );
  await fs.writeFile(
    path.join(runDir, "publish-state.json"),
    JSON.stringify({
      schemaVersion: 1,
      runId,
      title: "PlayStation Portable 2 Rumor",
      videoUrl: "https://convex.example.com/expired.mp4",
      storageId: "old-storage",
      channels: {
        instagram: { service: "instagram", status: "posted", channelId: "ch-ig", postId: "ig-already" },
        youtube: { service: "youtube", status: "failed", channelId: "ch-yt" },
        tiktok: { service: "tiktok", status: "failed", channelId: "ch-tt" },
      },
    }),
  );

  const env = { ...process.env, WIGGLY_STUDIO_HOME: studioHome, BUFFER_API_KEY: "buf-test" };
  const { fetchFn, createCalls } = makeFakeBufferFetch({
    channels: [
      { id: "ch-ig", name: "Shaz Skits IG", service: "instagram", isDisconnected: false },
      { id: "ch-yt", name: "Shaz Shorts YT", service: "youtube", isDisconnected: false },
      { id: "ch-tt", name: "Shaz TikTok", service: "tiktok", isDisconnected: false },
    ],
  });

  const telegramMessages = [];
  const uploadedUrls = [];
  const deletedIds = [];

  try {
    const res = await resumePublishForRun({
      runId,
      ledgerPath,
      env,
      deps: {
        resolveRunDirectory: (_root, id) => path.join(runsRoot, id),
        checkPublicVideoReachable: async () => false,
        uploadPublishVideo: async () => {
          const url = "https://convex.example.com/fresh-video.mp4";
          uploadedUrls.push(url);
          return { url, storageId: "fresh-storage", sha256: "fsha", bytes: 18 };
        },
        deletePublishVideo: async (id) => {
          deletedIds.push(id);
        },
        sendTelegramMessage: async (msg) => {
          telegramMessages.push(msg);
          return {};
        },
        publishVideoToAllChannels: (opts) =>
          publishVideoToAllChannels({
            ...opts,
            retryDelaysMs: [0],
            sleepFn: async () => {},
            apiKey: "buf-test",
            fetchFn,
          }),
        getBufferPostsStatus: async ({ postIds }) => ({
          posts: postIds.map((id) => ({ id, status: "sent", error: null })),
          allSent: true,
          hasError: false,
          pendingIds: [],
        }),
        bufferPollMaxAttempts: 1,
        bufferPollIntervalMs: 0,
        sleepFn: async () => {},
      },
    });

    assert.equal(res.status, "published");
    assert.deepEqual(uploadedUrls, ["https://convex.example.com/fresh-video.mp4"]);
    assert.deepEqual(deletedIds, ["fresh-storage"]);
    assert.equal(createCalls.filter((c) => c.channelId === "ch-ig").length, 0);
    assert.equal(createCalls.filter((c) => c.channelId === "ch-yt").length, 1);
    assert.equal(createCalls.filter((c) => c.channelId === "ch-tt").length, 1);
    assert.equal(createCalls.every((c) => c.assets[0].video.url === "https://convex.example.com/fresh-video.mp4"), true);

    const completion = telegramMessages.find((m) => m.text.includes("RESUME PUBLISH COMPLETE"));
    assert.ok(completion?.text.includes("Instagram ✓ · YouTube ✓ · TikTok ✓"));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("ambiguous timeout recovers existing Buffer post without duplicate or enters unknown state until verified on resume", async () => {
  // Case A: timeout followed by matching post in Buffer -> recovers posted without retry
  {
    const { fetchFn, createCalls, postsQueries } = makeFakeBufferFetch({
      recentPostsByChannel: {
        "ch-yt": [
          {
            id: "yt-created-anyway",
            status: "sending",
            text: "Starfield DLC Impressions #Shorts\n\nBody",
            createdAt: "2026-11-11T15:00:05Z",
          },
        ],
      },
      onCreatePost: async (input) => {
        if (input.channelId === "ch-ig") {
          return jsonResponse({
            data: { createPost: { __typename: "PostActionSuccess", post: { id: "ig-ok", status: "sending" } } },
          });
        }
        throw new DOMException("Timed out", "AbortError");
      },
    });

    const res = await publishVideoToAllChannels({
      videoUrl: "https://cdn.example.com/v.mp4",
      title: "Starfield DLC Impressions",
      caption: "Body",
      apiKey: "buf-test",
      nowFn: () => new Date("2026-11-11T15:00:00Z"),
      fetchFn,
    });

    assert.equal(res.success, true);
    assert.equal(res.channels.youtube.postId, "yt-created-anyway");
    assert.equal(res.channels.youtube.recoveredFromTimeout, true);
    assert.equal(createCalls.filter((c) => c.channelId === "ch-yt").length, 1, "Must NEVER retry blindly when Buffer already received the post");
    assert.equal(postsQueries.length, 1);
  }

  // Case B & C: timeout with no post initially -> unknown; resume checks posts first and retries ONLY if absent
  {
    let recentPosts = {};
    let shouldTimeout = true;
    const { fetchFn, createCalls } = makeFakeBufferFetch({
      get recentPostsByChannel() {
        return recentPosts;
      },
      onCreatePost: async (input) => {
        if (input.channelId === "ch-ig") {
          return jsonResponse({
            data: { createPost: { __typename: "PostActionSuccess", post: { id: "ig-ok", status: "sending" } } },
          });
        }
        if (shouldTimeout) {
          return jsonResponse({ error: "Gateway Timeout" }, 504);
        }
        return jsonResponse({
          data: { createPost: { __typename: "PostActionSuccess", post: { id: "yt-clean-retry", status: "sending" } } },
        });
      },
    });

    const first = await publishVideoToAllChannels({
      videoUrl: "https://cdn.example.com/v.mp4",
      title: "Elden Ring Co-Op Update",
      caption: "Body",
      apiKey: "buf-test",
      nowFn: () => new Date("2026-11-11T15:00:00Z"),
      fetchFn,
    });

    assert.equal(first.success, false);
    assert.equal(first.unknown.length, 1);
    assert.equal(first.channelStates.youtube.status, "unknown");
    assert.equal(createCalls.filter((c) => c.channelId === "ch-yt").length, 1, "Initial ambiguous timeout must not blindly retry");

    // On resume with retryUnknownWhenMissing: true, since recentPosts is still empty, it safely creates once
    shouldTimeout = false;
    const resumed = await publishVideoToAllChannels({
      videoUrl: "https://cdn.example.com/v.mp4",
      title: "Elden Ring Co-Op Update",
      caption: "Body",
      checkpoint: {
        schemaVersion: 1,
        channels: first.channelStates,
      },
      retryUnknownWhenMissing: true,
      apiKey: "buf-test",
      nowFn: () => new Date("2026-11-11T15:02:00Z"),
      fetchFn,
    });

    assert.equal(resumed.success, true);
    assert.equal(resumed.channels.youtube.postId, "yt-clean-retry");
    assert.equal(createCalls.filter((c) => c.channelId === "ch-ig").length, 1, "IG checkpoint must not repost");
    assert.equal(createCalls.filter((c) => c.channelId === "ch-yt").length, 2);
  }

  // Resume verification finds unknown post that appeared late -> recovers without createPost
  {
    const { fetchFn, createCalls } = makeFakeBufferFetch({
      recentPostsByChannel: {
        "ch-yt": [
          {
            id: "yt-late-arrival",
            status: "sent",
            text: "Late Arrival Story #Shorts",
            createdAt: "2026-11-11T15:00:10Z",
          },
        ],
      },
    });

    const resumed = await publishVideoToAllChannels({
      videoUrl: "https://cdn.example.com/v.mp4",
      title: "Late Arrival Story",
      checkpoint: {
        schemaVersion: 1,
        channels: {
          instagram: { service: "instagram", status: "posted", channelId: "ch-ig", postId: "ig-already" },
          youtube: {
            service: "youtube",
            status: "unknown",
            channelId: "ch-yt",
            attemptedAt: "2026-11-11T15:00:00Z",
          },
        },
      },
      retryUnknownWhenMissing: true,
      apiKey: "buf-test",
      fetchFn,
    });

    assert.equal(resumed.success, true);
    assert.equal(resumed.channels.youtube.postId, "yt-late-arrival");
    assert.equal(createCalls.length, 0, "Late arrival post must be recovered without calling createPost");
  }
});

test("Buffer missing key / 401 / UnauthorizedError stops run immediately without retrying 3x", async () => {
  await assert.rejects(
    () =>
      publishVideoToAllChannels({
        videoUrl: "https://cdn.example.com/v.mp4",
        title: "Missing key check",
        apiKey: "",
      }),
    (err) => err instanceof BufferApiError && err.isAccountError === true && classifyRunError(err).kind === "stop",
  );

  let attempts = 0;
  const { fetchFn } = makeFakeBufferFetch({
    onCreatePost: async () => {
      attempts += 1;
      return jsonResponse({ error: "Invalid token" }, 401);
    },
  });

  await assert.rejects(
    () =>
      publishVideoToAllChannels({
        videoUrl: "https://cdn.example.com/v.mp4",
        title: "401 unauthorized check",
        apiKey: "bad-key",
        retryDelaysMs: [0, 0, 0],
        sleepFn: async () => {},
        fetchFn,
      }),
    (err) => err instanceof BufferApiError && err.isAccountError === true && classifyRunError(err).kind === "stop",
  );
  assert.equal(attempts, 1, "HTTP 401 must fail immediately without retries");

  let gqlAttempts = 0;
  const { fetchFn: gqlFetch } = makeFakeBufferFetch({
    onCreatePost: async () => {
      gqlAttempts += 1;
      return jsonResponse({
        data: { createPost: { __typename: "UnauthorizedError", message: "Channel token expired" } },
      });
    },
  });

  await assert.rejects(
    () =>
      publishVideoToAllChannels({
        videoUrl: "https://cdn.example.com/v.mp4",
        title: "GraphQL UnauthorizedError check",
        apiKey: "bad-key",
        retryDelaysMs: [0, 0, 0],
        sleepFn: async () => {},
        fetchFn: gqlFetch,
      }),
    (err) => err instanceof BufferApiError && err.isAccountError === true && classifyRunError(err).kind === "stop",
  );
  assert.equal(gqlAttempts, 1, "GraphQL UnauthorizedError must fail immediately without retries");
});
