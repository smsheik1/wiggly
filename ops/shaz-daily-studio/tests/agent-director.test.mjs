import assert from "node:assert/strict";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AgentUnavailableError } from "../../../v3/lib/agent-bridge.ts";
import {
  AgentDirectorError,
  buildDirectorPrompt,
  planShotsWithAgent,
} from "../agent-director.mjs";
import { CandidateSkipError, classifyRunError } from "../errors.mjs";
import { loadStudioConfig, runDailyBatch } from "../studio-daily.mjs";

function makeTranscript() {
  return {
    text: "First beat starts here. Second beat reacts strongly. Third beat lands cleanly.",
    words: [
      { text: "First", startMs: 0, endMs: 400 },
      { text: "beat", startMs: 420, endMs: 800 },
      { text: "starts", startMs: 820, endMs: 1200 },
      { text: "here.", startMs: 1220, endMs: 1900 },
      { text: "Second", startMs: 2050, endMs: 2500 },
      { text: "beat", startMs: 2520, endMs: 2900 },
      { text: "reacts", startMs: 2920, endMs: 3400 },
      { text: "strongly.", startMs: 3420, endMs: 4000 },
      { text: "Third", startMs: 4150, endMs: 4600 },
      { text: "beat", startMs: 4620, endMs: 5000 },
      { text: "lands", startMs: 5020, endMs: 5400 },
      { text: "cleanly.", startMs: 5420, endMs: 6000 },
    ],
  };
}

function makeScript() {
  return {
    title: "Studio Agent Director Test",
    headline: "AGENT DIRECTOR WORKS",
    backgroundId: "living-room",
    hashtags: ["#Gaming", "#Tech", "#GamingNews"],
    visualQueries: ["PlayStation 5 Pro console", "Sony controller close up", "Living room TV setup"],
    hook: { text: "First beat starts here.", cardBadge: "BREAKING", cardHeadline: "FIRST BEAT" },
    beats: [
      {
        text: "So second beat reacts strongly.",
        connector: "So",
        cardBadge: "REALITY CHECK",
        cardHeadline: "SECOND BEAT",
        claims: [{ quote: "Second beat reacts strongly", sourceUrl: "https://example.com/a" }],
      },
    ],
    landing: { text: "Because third beat lands cleanly.", connector: "Because", cardBadge: "YOUR VERDICT", cardHeadline: "FINAL BEAT" },
  };
}

function makeValidAgentDraft() {
  return {
    title: "AGENT DIRECTOR WORKS",
    shots: [
      {
        id: "shot-01",
        shotType: "talk-to-camera",
        startFrame: 0,
        endFrameExclusive: 48,
        backgroundId: "living-room",
        poseId: "present",
        otsGraphic: { badge: "BREAKING", headline: "FIRST BEAT", image: "media/img-01.jpg" },
        rationale: "Present clear opening",
      },
      {
        id: "shot-02",
        shotType: "b-roll",
        startFrame: 48,
        endFrameExclusive: 96,
        backgroundId: "living-room",
        brollMedia: "media/img-01.jpg",
        motion: "zoom-in",
        rationale: "Show hardware cutaway",
      },
      {
        id: "shot-03",
        shotType: "talk-to-camera",
        startFrame: 96,
        endFrameExclusive: 144,
        backgroundId: "living-room",
        poseId: "neutral-listening",
        rationale: "Clean closing anchor",
      },
    ],
  };
}

test("loadStudioConfig parses director mode and defaults to jev", async () => {
  const cfg = await loadStudioConfig();
  assert.equal(cfg.director, "jev");
});

test("buildDirectorPrompt exposes only approved poses and separates clear vs headline-blocked poses", () => {
  const prompt = buildDirectorPrompt({
    script: makeScript(),
    topic: { title: "Switch 2 News" },
    audioDurationSeconds: 6,
    totalDurationFrames: 144,
    transcript: makeTranscript(),
    brollMediaList: ["media/img-01.jpg"],
  });

  assert.match(prompt, /Approved Talk-to-Camera Poses ONLY: neutral-listening, present, think, aha, point, confident, shrug, excited-celebration, point-at-screen/);
  assert.match(prompt, /Poses clear for otsGraphic\.headline:[^\n]*present[^\n]*confident/);
  assert.match(prompt, /Poses that block otsGraphic\.headline[^\n]*aha[^\n]*point/);
  assert.doesNotMatch(prompt, /Poses ONLY:[^\n]*(key-point|chin-stroke-swagger)/);
});

test("planShotsWithAgent retries unapproved pose and OTS overlap errors, then accepts valid plan", async () => {
  const prompts = [];
  let call = 0;
  const result = await planShotsWithAgent({
    script: makeScript(),
    audioDurationSeconds: 6,
    transcript: makeTranscript(),
    transcriptSha256: "a".repeat(64),
    brollMediaList: ["media/img-01.jpg"],
    askAgentFn: async (prompt) => {
      prompts.push(prompt);
      call += 1;
      if (call === 1) {
        const bad = makeValidAgentDraft();
        bad.shots[0].poseId = "chin-stroke-swagger";
        return bad;
      }
      if (call === 2) {
        const overlap = makeValidAgentDraft();
        overlap.shots[0].poseId = "aha"; // Overlaps OTS_HEADLINE_BOX!
        return overlap;
      }
      return makeValidAgentDraft();
    },
  });

  assert.equal(call, 3);
  assert.equal(result.director, "agent");
  assert.equal(result.attempts.length, 3);
  assert.match(prompts[1], /not approved/i);
  assert.match(prompts[2], /overlaps the OTS headline zone/i);
  assert.equal(result.validated.shots[0].poseId, "present");
  assert.equal(result.multiShotInput.totalDurationFrames, 144);
});

test("planShotsWithAgent throws AgentDirectorError (CandidateSkip) after max retries and bubbles AgentUnavailableError", async () => {
  await assert.rejects(
    async () =>
      planShotsWithAgent({
        script: makeScript(),
        audioDurationSeconds: 6,
        transcript: makeTranscript(),
        brollMediaList: ["media/img-01.jpg"],
        maxAttempts: 2,
        askAgentFn: async () => ({ title: "Bad", shots: [{ id: "shot-01", shotType: "talk-to-camera", startFrame: 0, endFrameExclusive: 144, poseId: "chin-stroke-swagger" }] }),
      }),
    (err) => err instanceof AgentDirectorError && err instanceof CandidateSkipError && classifyRunError(err).stage === "agent-director",
  );

  await assert.rejects(
    async () =>
      planShotsWithAgent({
        script: makeScript(),
        audioDurationSeconds: 6,
        transcript: makeTranscript(),
        askAgentFn: async () => {
          throw new AgentUnavailableError("CLI offline");
        },
      }),
    (err) => err instanceof AgentUnavailableError && classifyRunError(err).kind === "stop",
  );
});

test("runDailyBatch routes cfg.director='agent' through transcribeAudio + planShotsWithAgent and passes --director=agent", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-agent-dir-"));
  const executedCommands = [];
  const transcript = makeTranscript();

  try {
    const result = await runDailyBatch({
      count: 1,
      dryRun: true,
      noTelegram: true,
      ledgerPath: path.join(tmpDir, "ledger.json"),
      deps: {
        loadStudioConfig: async () => ({
          writerAgent: "agy",
          director: "agent",
          agentTimeoutMs: 60_000,
          maxScriptAttempts: 2,
          batchSize: 1,
          minFreeDiskMb: 0,
          retentionDays: 7,
        }),
        acquireStudioLock: async () => ({ release: async () => {} }),
        assertFreeDiskSpace: async () => {},
        findTopStories: async () => [
          {
            source: "newsmcp",
            topic: { eventId: "evt_agent_1", title: "Sony Updates PS5", link: "https://example.com/a", sources: ["https://example.com/a"] },
          },
        ],
        fetchArticleForTopic: async () => ({ url: "https://example.com/a", title: "Sony Updates PS5", text: "Second beat reacts strongly. ".repeat(35), sha256: "b".repeat(64), images: [] }),
        authorShazScript: async () => Object.assign(makeScript(), { dialogueText: transcript.text }),
        sourceStoryMedia: async ({ stageDir }) => {
          await fs.mkdir(path.join(stageDir, "media"), { recursive: true });
          await fs.writeFile(path.join(stageDir, "media", "img-01.jpg"), "fake");
          return ["media/img-01.jpg"];
        },
        synthesizeShazVoice: async ({ outputPath }) => {
          // 6s silent mono WAV header so measureAudioDurationSeconds measures ~6.0s if needed
          const sampleRate = 24000;
          const samples = sampleRate * 6;
          const buf = Buffer.alloc(44 + samples * 2);
          buf.write("RIFF", 0);
          buf.writeUInt32LE(36 + samples * 2, 4);
          buf.write("WAVEfmt ", 8);
          buf.writeUInt32LE(16, 16);
          buf.writeUInt16LE(1, 20);
          buf.writeUInt16LE(1, 22);
          buf.writeUInt32LE(sampleRate, 24);
          buf.writeUInt32LE(sampleRate * 2, 28);
          buf.writeUInt16LE(2, 32);
          buf.writeUInt16LE(16, 34);
          buf.write("data", 36);
          buf.writeUInt32LE(samples * 2, 40);
          await fs.writeFile(outputPath, buf);
        },
        transcribeAudio: async ({ outputPath }) => {
          await fs.writeFile(outputPath, JSON.stringify(transcript));
          return { transcript, transcriptSha256: "c".repeat(64) };
        },
        askAgentFn: async () => makeValidAgentDraft(),
        resolveRunDirectory: (_root, runId) => path.join(tmpDir, "runs", runId),
        execute: (cmd, args) => {
          executedCommands.push([cmd, ...args]);
          const runArg = args.find((a) => a.startsWith("--run="));
          const subcmd = args[1];
          const runDir = path.join(tmpDir, "runs", runArg.slice("--run=".length));
          fsSync.mkdirSync(runDir, { recursive: true });
          if (subcmd === "init") {
            fsSync.writeFileSync(path.join(runDir, "transcript.json"), JSON.stringify(transcript));
            fsSync.writeFileSync(path.join(runDir, "state.json"), JSON.stringify({ director: { mode: "agent", jevCalls: 0 } }));
          } else if (subcmd === "render") {
            fsSync.writeFileSync(path.join(runDir, "final.mp4"), "fake-mp4");
          } else if (subcmd === "inspect") {
            fsSync.writeFileSync(path.join(runDir, "quality-report.json"), JSON.stringify({ status: "pass" }));
          }
          return "{}";
        },
        assertScriptAligned: () => ({ ok: true, coverage: 1 }),
        composeVerticalVideo: async ({ outputPath }) => {
          await fs.writeFile(outputPath, "fake-vertical-mp4");
        },
        validateVerticalDeliverable: async ({ outputPath }) => ({
          status: "pass",
          verticalSha256: await Promise.resolve("d".repeat(64)),
          path: outputPath,
        }),
      },
    });

    assert.equal(result.status, "dry-run-success");
    assert.equal(result.candidates.length, 1);
    const initCall = executedCommands.find((c) => c[2] === "init");
    assert.ok(initCall.includes("--director=agent"), `expected --director=agent in ${initCall.join(" ")}`);
    const runDir = result.candidates[0].runDirectory;
    assert.equal(fsSync.existsSync(path.join(runDir, "director-receipt.json")), true);
    const usage = JSON.parse(await fs.readFile(path.join(runDir, "run-usage.json"), "utf8"));
    assert.equal(usage.providers.jev.calls, 0);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
