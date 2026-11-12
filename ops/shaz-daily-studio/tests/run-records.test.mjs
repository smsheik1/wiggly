import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveRunDirectory } from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/run-common.mjs";
import { KIT_ROOT, runDailyBatch } from "../studio-daily.mjs";

test("runDailyBatch never touches runDirectory before runner.mjs init and persists all 4 traceability files afterward", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "studio-run-records-"));
  let createdRunDir = null;
  let initCalled = false;
  const writtenBeforeInit = [];

  const article = {
    url: "https://news.example.com/run-records-check",
    fetchedAt: "2026-11-11T12:00:00Z",
    sha256: "deadbeef".repeat(8),
    title: "Real Init Run Record Check",
    text:
      [
        "Nintendo announced firmware update 2.0 on Tuesday adding cloud save sync refinements across docked consoles.",
        "Players running compatible storage cards will notice faster transfer throughput immediately after installing the free update.",
      ].join(" ")
      + " Additional hardware and software ecosystem notes continue for verification.".repeat(10),
  };

  const script = {
    schemaVersion: "shaz-script-v1",
    sourceUrl: article.url,
    title: "Nintendo Ships Firmware 2.0",
    headline: "NINTENDO FIRMWARE UPDATE",
    targetDurationSeconds: 30,
    research: {
      primaryInsight: "Nintendo rolled out firmware update 2.0 focusing on docked cloud saves.",
      counterintuitiveAngle: "Storage transfer speed boosts do not require any paid accessory.",
      concreteFactOrStory: "Compatible storage cards transfer noticeably faster right after installing the update.",
    },
    claims: [
      {
        target: "hook",
        says: "Nintendo added cloud save refinements in update 2.0.",
        quote: "Nintendo announced firmware update 2.0 on Tuesday adding cloud save sync refinements",
      },
      {
        target: "beat-01",
        says: "Transfer throughput improved for compatible storage cards.",
        quote: "notice faster transfer throughput immediately after installing the free update",
      },
    ],
    hook: {
      formula: "surprising-stat",
      text: "Nintendo quietly shipped firmware update 2.0 on Tuesday without screaming from a rooftop stage showcase like usual.",
    },
    visualQueries: [
      "Nintendo Switch docked console close up",
      "Nintendo firmware update screen",
      "MicroSD storage card gaming console",
    ],
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        text: "Your cloud save sync stops stalling right after you pull the free system patch tonight.",
        impliedQuestion: "What actually changes for docked players?",
      },
      {
        id: "beat-02",
        connector: "BUT",
        text: "Most people skip patch notes until storage card transfers suddenly finish twice as cleanly.",
        impliedQuestion: "Why did storage performance improve?",
      },
      {
        id: "beat-03",
        connector: "THEREFORE",
        text: "Grab the update before jumping into Friday downloads so docked sync stays responsive.",
        impliedQuestion: "What should players do tonight?",
      },
    ],
    landing: {
      type: "question",
      text: "Did you already install firmware 2.0 or leave your console sleeping all week?",
    },
    backgroundId: "living-room",
    hashtags: ["#nintendo", "#switch2", "#gaming"],
  };

  try {
    const result = await runDailyBatch({
      count: 1,
      dryRun: true,
      deps: {
        findTopStories: async () => [
          {
            source: "newsmcp (4 newsrooms)",
            pickReason: "Fresh hardware firmware update",
            topic: {
              eventId: "evt_fw_test",
              title: "Nintendo Announced Firmware Update 2.0",
              sources: [article.url],
            },
          },
        ],
        fetchArticleForTopic: async () => article,
        askAgentFn: async () => script,
        sourceStoryMedia: async () => [],
        synthesizeShazVoice: async ({ outputPath }) => {
          await fs.writeFile(outputPath, Buffer.from("fake-wav"));
        },
        resolveRunDirectory: (_root, runId) => {
          createdRunDir = path.join(tempRoot, runId);
          return createdRunDir;
        },
        writeJson: async (targetPath, payload) => {
          if (!initCalled && createdRunDir && targetPath.startsWith(createdRunDir)) {
            writtenBeforeInit.push(targetPath);
          }
          await fs.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.writeFile(targetPath, JSON.stringify(payload, null, 2));
        },
        execute: (_cmd, args) => {
          const subcmd = args[1];
          if (subcmd === "init") {
            // Mirror real runner.mjs init guardrail: fail if runDirectory exists before init!
            if (fsSync.existsSync(createdRunDir)) {
              throw new Error(`run already exists: ${createdRunDir}`);
            }
            fsSync.mkdirSync(createdRunDir, { recursive: true });
            initCalled = true;
          }
        },
        composeVerticalVideo: async ({ outputPath }) => {
          await fs.writeFile(path.join(path.dirname(outputPath), "final.mp4"), Buffer.from("mp4"));
          await fs.writeFile(path.join(path.dirname(outputPath), "transcript.json"), JSON.stringify({ words: [] }));
          await fs.writeFile(outputPath, Buffer.from("vert"));
        },
        sendApprovalVideo: async () => ({ messageId: 1 }),
        sendTelegramMessage: async () => ({}),
      },
    });

    assert.equal(result.status, "dry-run-success");
    assert.deepEqual(writtenBeforeInit, [], "nothing may write inside runDirectory before runner.mjs init");

    const storyJson = JSON.parse(await fs.readFile(path.join(createdRunDir, "story.json"), "utf8"));
    const articleJson = JSON.parse(await fs.readFile(path.join(createdRunDir, "article.json"), "utf8"));
    const scriptJson = JSON.parse(await fs.readFile(path.join(createdRunDir, "script.json"), "utf8"));
    const receiptJson = JSON.parse(await fs.readFile(path.join(createdRunDir, "author-receipt.json"), "utf8"));

    assert.equal(storyJson.eventId, "evt_fw_test");
    assert.equal(storyJson.sourceUrl, article.url);
    assert.equal(storyJson.writerAgent, "agy");
    assert.equal(articleJson.url, article.url);
    assert.equal(articleJson.sha256, article.sha256);
    assert.equal(scriptJson.claims.length, 2);
    assert.equal(receiptJson.agent, "agy");
    assert.equal(receiptJson.writerAgent, "agy");
    assert.equal(receiptJson.finalAttempt, 1);
    assert.ok(typeof receiptJson.durationMs === "number" && receiptJson.durationMs >= 0);
    assert.match(receiptJson.promptSha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(receiptJson.errors, []);
    assert.ok(receiptJson.finalWordCount >= 70 && receiptJson.finalWordCount <= 88);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("real runner.mjs init creates runDirectory cleanly and rejects pre-existing runDirectory", async () => {
  const realRunId = `test-p2-init-${Date.now().toString(36)}`;
  const realRunDir = resolveRunDirectory(KIT_ROOT, realRunId);
  const inputPath = path.join(os.tmpdir(), `${realRunId}-input.json`);

  try {
    await fs.writeFile(
      inputPath,
      JSON.stringify({
        schemaVersion: "shaz-sequence-input-v1",
        title: "Init ordering check",
        sequence: [
          { poseId: "think", holdFrames: 4, gapFrames: 0 },
        ],
      }),
      "utf8",
    );

    // Real runner.mjs init succeeds on non-existent runDirectory
    execFileSync(
      "node",
      [path.join(KIT_ROOT, "runner.mjs"), "init", `--run=${realRunId}`, `--input=${inputPath}`],
      { cwd: KIT_ROOT, stdio: "pipe" },
    );
    assert.equal(fsSync.existsSync(realRunDir), true);

    // Real runner.mjs init fails loudly if runDirectory already existed
    assert.throws(
      () =>
        execFileSync(
          "node",
          [path.join(KIT_ROOT, "runner.mjs"), "init", `--run=${realRunId}`, `--input=${inputPath}`],
          { cwd: KIT_ROOT, stdio: "pipe" },
        ),
      /run already exists/,
    );
  } finally {
    await fs.rm(realRunDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(inputPath, { force: true }).catch(() => {});
  }
});
