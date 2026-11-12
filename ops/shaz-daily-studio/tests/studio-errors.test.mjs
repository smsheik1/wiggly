import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { JevApiError } from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/director-jev.mjs";
import { SerperApiError } from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/serper-search.mjs";
import { VoiceSynthesisError } from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/voice.mjs";
import { RunStopError } from "../errors.mjs";
import { acquireStudioLock, assertFreeDiskSpace } from "../preflight.mjs";
import { runDailyBatch } from "../studio-daily.mjs";

function makeFakeArticle(url = "https://news.example.com/e1") {
  return {
    url,
    fetchedAt: "2026-11-11T12:00:00Z",
    sha256: "abc123".padEnd(64, "0"),
    title: "Test Story Title",
    text: "Nintendo revealed hardware specs on Tuesday while developers tested retail software builds. ".repeat(14),
  };
}

function makeFakeScript(url = "https://news.example.com/e1", suffix = "") {
  return {
    title: `Switch Update News${suffix}`,
    headline: "SWITCH UPDATE",
    backgroundId: "living-room",
    sourceUrl: url,
    hook: { type: "talk", text: "Wait so Nintendo just updated the console specs on Tuesday." },
    beats: [
      { type: "fact", text: "Plus developers have been testing retail builds this week." },
    ],
    landing: { type: "question", text: "Did you expect that or were you waiting?" },
    visualQueries: ["switch query 1", "switch query 2", "switch query 3"],
    hashtags: ["#nintendo", "#gaming", "#tech"],
  };
}

function baseBatchDeps(tmpDir, telegramMessages, overrides = {}) {
  return {
    findTopStories: async () => [
      { source: "newsmcp", topic: { eventId: "e1", title: "Story One", sources: ["https://news.example.com/1"] } },
      { source: "newsmcp", topic: { eventId: "e2", title: "Story Two", sources: ["https://news.example.com/2"] } },
    ],
    fetchArticleForTopic: async (topic) => makeFakeArticle(topic.sources[0]),
    authorShazScript: async (topic) => makeFakeScript(topic.sources[0], ` ${topic.eventId}`),
    compileDialogueText: (script) => [script.hook.text, ...script.beats.map((b) => b.text), script.landing.text].join(" "),
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
    sendApprovalVideo: async () => ({ messageId: 101 }),
    sendTelegramMessage: async ({ text }) => {
      telegramMessages.push(text);
      return {};
    },
    ...overrides,
  };
}

test("acquireStudioLock blocks concurrent active runs and cleanly reclaims stale dead-PID locks", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-lock-test-"));
  try {
    const lock1 = await acquireStudioLock({ studioHome: tmpDir, mode: "batch" });
    await assert.rejects(
      () => acquireStudioLock({ studioHome: tmpDir, mode: "single" }),
      (err) => err instanceof RunStopError && err.code === "STUDIO_LOCKED",
    );
    await lock1.release();

    // Write a stale lock owned by an inactive PID and reclaim it
    const lockPath = path.join(tmpDir, "studio.lock");
    await fs.writeFile(lockPath, JSON.stringify({ pid: 999999, mode: "crashed", token: "stale" }));
    const lock2 = await acquireStudioLock({
      studioHome: tmpDir,
      mode: "batch",
      isPidAliveFn: () => false,
    });
    const parsed = JSON.parse(await fs.readFile(lockPath, "utf8"));
    assert.equal(parsed.pid, process.pid);
    await lock2.release();
    await assert.rejects(() => fs.stat(lockPath), { code: "ENOENT" });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("assertFreeDiskSpace and runDailyBatch preflight stop before API spend on low disk and release lock", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-disk-preflight-"));
  const telegramMessages = [];
  let scoutCalled = false;

  try {
    await assert.rejects(
      () =>
        assertFreeDiskSpace({
          minFreeDiskMb: 1500,
          checkPath: tmpDir,
          statfsFn: async () => ({ bsize: 1024 * 1024, bavail: 900 }),
        }),
      (err) => err instanceof RunStopError && err.code === "DISK_LOW",
    );

    await assert.rejects(
      () =>
        runDailyBatch({
          count: 2,
          env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
          deps: baseBatchDeps(tmpDir, telegramMessages, {
            statfsFn: async () => ({ bsize: 1024 * 1024, bavail: 755 }),
            findTopStories: async () => {
              scoutCalled = true;
              return [];
            },
          }),
        }),
      (err) => err instanceof RunStopError && err.code === "DISK_LOW",
    );

    assert.equal(scoutCalled, false, "must fail disk preflight before calling findTopStories");
    assert.match(telegramMessages[0], /Low Disk Space/);
    await assert.rejects(() => fs.stat(path.join(tmpDir, "studio.lock")), { code: "ENOENT" });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("runDailyBatch enforces provider:'cartesia' and stops run with alert on VoiceSynthesisError or SerperApiError", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-provider-stop-"));
  const telegramMessages = [];

  try {
    const seenProviders = [];
    let attempts = 0;
    await assert.rejects(
      () =>
        runDailyBatch({
          count: 2,
          env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
          deps: baseBatchDeps(tmpDir, telegramMessages, {
            synthesizeShazVoice: async ({ provider }) => {
              attempts += 1;
              seenProviders.push(provider);
              throw new VoiceSynthesisError("CARTESIA_API_KEY missing", {
                provider: "cartesia",
                isMissingKey: true,
              });
            },
          }),
        }),
      VoiceSynthesisError,
    );
    assert.deepEqual(seenProviders, ["cartesia"]);
    assert.equal(attempts, 1, "VoiceSynthesisError must stop immediately rather than trying candidate 2");
    assert.match(telegramMessages[0], /Voice Synthesis Failure \(Cartesia\)/);

    telegramMessages.length = 0;
    let serperAttempts = 0;
    await assert.rejects(
      () =>
        runDailyBatch({
          count: 2,
          env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
          deps: baseBatchDeps(tmpDir, telegramMessages, {
            sourceStoryMedia: async () => {
              serperAttempts += 1;
              throw new SerperApiError("Serper HTTP 429 Too Many Requests", {
                status: 429,
                isAccountError: true,
              });
            },
          }),
        }),
      SerperApiError,
    );
    assert.equal(serperAttempts, 1, "Serper 429/401/402/403 must stop run immediately");
    assert.match(telegramMessages[0], /Serper Image Search Failure/);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("runDailyBatch skips child [JEV_CANDIDATE_SKIP] and render errors, while stopping on Jev billing errors and unknown ReferenceError", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-skip-vs-stop-"));
  const telegramMessages = [];

  try {
    // 1. Candidate 1 hits [JEV_CANDIDATE_SKIP], Candidate 2 hits render error, Candidate 3 succeeds
    const res = await runDailyBatch({
      count: 1,
      dryRun: true,
      env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
      deps: baseBatchDeps(tmpDir, telegramMessages, {
        findTopStories: async () => [
          { source: "newsmcp", topic: { eventId: "e1", title: "Jev Skip Story", sources: ["https://news.example.com/1"] } },
          { source: "newsmcp", topic: { eventId: "e2", title: "Render Skip Story", sources: ["https://news.example.com/2"] } },
          { source: "newsmcp", topic: { eventId: "e3", title: "Healthy Story", sources: ["https://news.example.com/3"] } },
        ],
        execute: (() => {
          let initCount = 0;
          return (_cmd, args) => {
            if (args.includes("init")) {
              initCount += 1;
              if (initCount === 1) {
                throw new Error("node failed:\n[JEV_CANDIDATE_SKIP] Jev gave no valid camera_motion for line 2: Test.");
              }
            }
            if (args.includes("render") && initCount === 2) {
              throw new Error("node failed:\nRemotion frame crash");
            }
          };
        })(),
      }),
    });

    assert.equal(res.status, "dry-run-success");
    assert.equal(res.candidates.length, 1);
    assert.equal(res.skips.length, 2);
    assert.equal(res.skips[0].stage, "jev-director");
    assert.equal(res.skips[1].stage, "render");
    assert.match(telegramMessages[0], /Voice: <code>cartesia<\/code>/);

    // 2. Child Jev account/billing failure stops run immediately
    telegramMessages.length = 0;
    let execCalls = 0;
    await assert.rejects(
      () =>
        runDailyBatch({
          count: 2,
          env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
          deps: baseBatchDeps(tmpDir, telegramMessages, {
            execute: () => {
              execCalls += 1;
              throw new JevApiError("TYPESAFE_API_KEY IS MISSING — check your TypeSafe billing", {
                isAccountError: true,
                isMissingKey: true,
              });
            },
          }),
        }),
      RunStopError,
    );
    assert.equal(execCalls, 1);
    assert.match(telegramMessages[0], /Jev Director API Failure/);

    // 3. Unknown ReferenceError stops run instead of silently skipping
    telegramMessages.length = 0;
    let bugCalls = 0;
    await assert.rejects(
      () =>
        runDailyBatch({
          count: 2,
          env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
          deps: baseBatchDeps(tmpDir, telegramMessages, {
            composeVerticalVideo: async () => {
              bugCalls += 1;
              throw new ReferenceError("undefinedSymbol is not defined");
            },
          }),
        }),
      ReferenceError,
    );
    assert.equal(bugCalls, 1);
    assert.match(telegramMessages[0], /Unexpected Studio Failure/);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
