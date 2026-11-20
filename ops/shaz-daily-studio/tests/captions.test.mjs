import assert from "node:assert/strict";
import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/sharp.mjs";

import { CandidateSkipError, runDailyBatch } from "../studio-daily.mjs";
import { composeVerticalVideo } from "../vertical-letterbox.mjs";

test("composeVerticalVideo aligns authored script spellings onto transcript word timestamps and rejects low coverage", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-captions-test-"));
  try {
    const sourceVideoPath = path.join(tmpDir, "source.mp4");
    await fs.writeFile(sourceVideoPath, Buffer.from("fake-mp4"));
    const outputPath = path.join(tmpDir, "vertical.mp4");

    const script = {
      hook: { text: "John Ternus says PS5s cost $500!" },
      beats: [{ text: "Fans save 30% today." }],
      landing: { text: "Would you upgrade?" },
    };
    const transcript = {
      words: [
        { text: "John", startMs: 0, endMs: 250 },
        { text: "Turners", startMs: 260, endMs: 550 },
        { text: "says", startMs: 560, endMs: 750 },
        { text: "PS", startMs: 760, endMs: 950 },
        { text: "5s", startMs: 960, endMs: 1200 },
        { text: "cost", startMs: 1210, endMs: 1450 },
        { text: "500", startMs: 1460, endMs: 1700 },
        { text: "dollars", startMs: 1710, endMs: 2000 },
        { text: "Fans", startMs: 2200, endMs: 2500 },
        { text: "say", startMs: 2510, endMs: 2750 },
        { text: "30", startMs: 2760, endMs: 3000 },
        { text: "percent", startMs: 3010, endMs: 3300 },
        { text: "today", startMs: 3310, endMs: 3650 },
        { text: "Would", startMs: 3800, endMs: 4000 },
        { text: "you", startMs: 4010, endMs: 4200 },
        { text: "upgrade", startMs: 4210, endMs: 4550 },
      ],
    };

    const capturedSubtitlePngs = [];
    await composeVerticalVideo({
      sourceVideoPath,
      transcript,
      script,
      headline: "PS5 PRO NEWS",
      outputPath,
      execFileFn: async (_cmd, args) => {
        for (let i = 0; i < args.length; i += 1) {
          if (args[i] === "-i" && args[i + 1]?.endsWith(".png") && path.basename(args[i + 1]).startsWith("sub-")) {
            capturedSubtitlePngs.push(await fs.readFile(args[i + 1]));
          }
        }
        await fs.writeFile(outputPath, Buffer.from("vertical-out"));
      },
    });

    assert.ok(capturedSubtitlePngs.length >= 3, "expected aligned caption overlay PNGs passed to ffmpeg");
    const firstMeta = await sharp(capturedSubtitlePngs[0]).metadata();
    assert.equal(firstMeta.width, 1080);

    // Mismatched audio vs script (<90%) must fail loudly without falling back to Whisper text
    await assert.rejects(
      () => composeVerticalVideo({
        sourceVideoPath,
        transcript: { words: [{ text: "completely", startMs: 0, endMs: 300 }, { text: "unrelated", startMs: 310, endMs: 700 }] },
        script,
        headline: "MISMATCH",
        outputPath,
        execFileFn: async () => {
          throw new Error("ffmpeg must not run on unaligned script");
        },
      }),
      (err) => err?.code === "SCRIPT_ALIGNMENT_LOW",
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("studio-daily skips candidate on <90% script-to-transcript mismatch BEFORE running validate/render", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-align-skip-"));
  const stagesByStory = [];
  const telegramMessages = [];
  try {
    let storyIdx = 0;
    const res = await runDailyBatch({
      count: 1,
      dryRun: true,
      ledgerPath: path.join(tmpDir, "ledger.json"),
      env: { ...process.env, WIGGLY_STUDIO_HOME: tmpDir },
      deps: {
        findTopStories: async () => [
          { source: "newsmcp", topic: { eventId: "e-bad-align", title: "Sony Updates PlayStation Firmware" } },
          { source: "newsmcp", topic: { eventId: "e-good-align", title: "Backup Aligned Story" } },
        ],
        fetchArticleForTopic: async (topic) => ({
          url: `https://example.com/${topic.eventId}`,
          fetchedAt: "2026-11-11T12:00:00Z",
          sha256: "a".repeat(64),
          title: topic.title,
          text: "Sony shipped firmware updates for PS5 Pro consoles today across retail bundles. ".repeat(12),
        }),
        authorShazScript: async () => ({
          schemaVersion: "shaz-script-v1",
          sourceUrl: "https://example.com/e-bad-align",
          title: "Sony Updates PlayStation Firmware",
          headline: "PS5 UPDATE",
          backgroundId: "living-room",
          hook: { text: "Sony dropped updates today." },
          beats: [{ text: "Stores restocked bundles." }],
          landing: { text: "Ready?" },
        }),
        compileDialogueText: (s) => `${s.hook.text} ${s.beats[0].text} ${s.landing.text}`,
        sourceStoryMedia: async () => [],
        synthesizeShazVoice: async ({ outputPath }) => fs.writeFile(outputPath, Buffer.from("wav")),
        resolveRunDirectory: (_root, runId) => path.join(tmpDir, runId),
        execute: (_cmd, args) => {
          const sub = args[1];
          const runArg = args.find((a) => a.startsWith("--run="))?.split("=")[1];
          const runDir = path.join(tmpDir, runArg);
          fsSync.mkdirSync(runDir, { recursive: true });
          if (sub === "init") {
            storyIdx += 1;
            stagesByStory.push([]);
          }
          stagesByStory[storyIdx - 1].push(sub);
          if (sub === "init") {
            const words = storyIdx === 1
              ? [{ text: "garbled", startMs: 0, endMs: 500 }, { text: "audio", startMs: 510, endMs: 900 }]
              : [
                  { text: "Sony", startMs: 0, endMs: 250 },
                  { text: "dropped", startMs: 260, endMs: 550 },
                  { text: "updates", startMs: 560, endMs: 850 },
                  { text: "today", startMs: 860, endMs: 1150 },
                  { text: "Stores", startMs: 1200, endMs: 1450 },
                  { text: "restocked", startMs: 1460, endMs: 1750 },
                  { text: "bundles", startMs: 1760, endMs: 2050 },
                  { text: "Ready", startMs: 2100, endMs: 2350 },
                ];
            fsSync.writeFileSync(path.join(runDir, "transcript.json"), JSON.stringify({ words }));
          }
          if (sub === "render") {
            fsSync.writeFileSync(path.join(runDir, "final.mp4"), Buffer.from("mp4"));
          }
          if (sub === "inspect") {
            const sha = crypto.createHash("sha256").update(Buffer.from("mp4")).digest("hex");
            fsSync.writeFileSync(path.join(runDir, "quality-report.json"), JSON.stringify({ schemaVersion: 1, status: "pass", outputSha256: sha }));
          }
        },
        composeVerticalVideo: async ({ outputPath, script }) => {
          assert.ok(script?.hook?.text, "studio-daily must pass authored script to composeVerticalVideo");
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
        sendApprovalVideo: async () => ({ messageId: 1 }),
        sendTelegramMessage: async ({ text }) => {
          telegramMessages.push(text);
          return {};
        },
      },
    });

    assert.equal(res.candidates.length, 1);
    assert.equal(res.skips.length, 1);
    assert.deepEqual(stagesByStory[0], ["init"], "mismatched story must skip at script-alignment BEFORE validate/render");
    assert.deepEqual(stagesByStory[1], ["init", "validate", "render", "inspect"]);
    assert.match(telegramMessages.join("\n"), /script-alignment/i);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
