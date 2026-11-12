import assert from "node:assert/strict";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildBlindAssignment,
  pollBlindAbVote,
  runDirectorAbComparison,
} from "../tools/director-ab.mjs";

test("buildBlindAssignment alternates Option A and B based on RNG", () => {
  assert.deepEqual(buildBlindAssignment({ rngIntFn: () => 0 }), { A: "agent", B: "jev" });
  assert.deepEqual(buildBlindAssignment({ rngIntFn: () => 1 }), { A: "jev", B: "agent" });
});

test("pollBlindAbVote ignores unauthorized user taps and accepts authorized operator vote", async () => {
  const answers = [];
  let pollCall = 0;
  const mockFetch = async (url, init) => {
    if (url.includes("/getUpdates")) {
      pollCall += 1;
      if (pollCall === 1) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: [
              {
                update_id: 10,
                callback_query: {
                  id: "cb-bad",
                  data: "ab_pick:pair-1:A",
                  from: { id: 999999 },
                  message: { chat: { id: 12345 } },
                },
              },
              {
                update_id: 11,
                callback_query: {
                  id: "cb-good",
                  data: "ab_pick:pair-1:B",
                  from: { id: 777 },
                  message: { chat: { id: 12345 } },
                },
              },
            ],
          }),
        };
      }
    }
    if (url.includes("/answerCallbackQuery")) {
      answers.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ ok: true, result: true }) };
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const vote = await pollBlindAbVote({
    pairId: "pair-1",
    token: "bot-token",
    chatId: "12345",
    operatorUserId: "777",
    pollIntervalMs: 0,
    fetchFn: mockFetch,
    sleepFn: async () => {},
  });

  assert.equal(vote.winnerLabel, "B");
  assert.equal(vote.telegramUserId, 777);
  assert.equal(vote.unauthorizedTaps.length, 1);
  assert.equal(vote.unauthorizedTaps[0].userId, 999999);
  assert.equal(answers[0].text, "Not allowed");
  assert.equal(answers[0].show_alert, true);
  assert.match(answers[1].text, /Recorded blind vote: B/);
});

test("runDirectorAbComparison reuses existing audio/media (zero paid regen), dispatches blind A/B, and logs winner", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-director-ab-"));
  const runsDir = path.join(tmpDir, "agent-runs");
  const sourceRunId = "daily-2026-11-11-src";
  const sourceDir = path.join(runsDir, sourceRunId);
  const resultsPath = path.join(tmpDir, "director-ab-results.json");
  const dispatched = [];
  const revealed = [];

  try {
    await fs.mkdir(path.join(sourceDir, "media"), { recursive: true });
    await fs.writeFile(path.join(sourceDir, "user-audio.wav"), "existing-wav");
    await fs.writeFile(path.join(sourceDir, "media", "img-01.jpg"), "existing-img");
    await fs.writeFile(path.join(sourceDir, "story.json"), JSON.stringify({ title: "PS5 Pro Price Drop" }));
    await fs.writeFile(path.join(sourceDir, "script.json"), JSON.stringify({
      title: "PS5 Pro Price Drop",
      headline: "PS5 PRO DROPS $50",
      backgroundId: "living-room",
    }));
    await fs.writeFile(path.join(sourceDir, "transcript.json"), JSON.stringify({
      text: "Hello gamers.",
      words: [{ text: "Hello", startMs: 0, endMs: 400 }, { text: "gamers.", startMs: 420, endMs: 900 }],
    }));

    const result = await runDirectorAbComparison({
      sourceRunId,
      kitRoot: tmpDir,
      resultsPath,
      deps: {
        loadStudioConfig: async () => ({ writerAgent: "agy", director: "jev", agentTimeoutMs: 60_000, maxScriptAttempts: 3, batchSize: 3 }),
        resolveRunDirectory: (_root, runId) => path.join(runsDir, runId),
        measureDurationFn: async () => 2.0,
        planShotsWithAgent: async () => ({
          director: "agent",
          attempts: [{ attempt: 1, ok: true }],
          multiShotInput: { schemaVersion: "shaz-multi-shot-v1", title: "PS5 PRO DROPS $50", audioFile: "user-audio.wav", totalDurationFrames: 48, shots: [] },
        }),
        execute: (_cmd, args) => {
          const runId = args.find((a) => a.startsWith("--run=")).slice("--run=".length);
          const subcmd = args[1];
          const dir = path.join(runsDir, runId);
          fsSync.mkdirSync(dir, { recursive: true });
          if (subcmd === "init") {
            fsSync.writeFileSync(path.join(dir, "transcript.json"), "{}");
          } else if (subcmd === "render") {
            fsSync.writeFileSync(path.join(dir, "final.mp4"), `master-${runId}`);
          }
          return "{}";
        },
        composeVerticalVideo: async ({ outputPath }) => {
          await fs.writeFile(outputPath, `vertical-${path.basename(path.dirname(outputPath))}`);
        },
        flushTelegramBacklog: async () => 50,
        // Force rngIntFn -> 1 so Option A = jev, Option B = agent
        rngIntFn: () => 1,
        dispatchBlindAbPrompt: async (payload) => {
          dispatched.push(payload);
        },
        pollBlindAbVote: async () => ({
          winnerLabel: "B",
          telegramUserId: 777,
          votedAt: "2026-11-12T01:00:00Z",
          unauthorizedTaps: [],
        }),
        sendTelegramMessage: async (msg) => {
          revealed.push(msg.text);
        },
      },
    });

    assert.equal(dispatched.length, 1);
    assert.ok(dispatched[0].optionAVideoPath.endsWith("-jev/final-vertical.mp4"));
    assert.ok(dispatched[0].optionBVideoPath.endsWith("-agent/final-vertical.mp4"));
    assert.equal(result.arms.A.director, "jev");
    assert.equal(result.arms.B.director, "agent");
    assert.equal(result.winnerLabel, "B");
    assert.equal(result.winnerDirector, "agent");
    assert.match(revealed[0], /Option A was: <b>jev<\/b>/);
    assert.match(revealed[0], /Your Pick: <b>B<\/b> \(agent\)/);

    const saved = JSON.parse(await fs.readFile(resultsPath, "utf8"));
    assert.equal(saved.pairs.length, 1);
    assert.equal(saved.pairs[0].winnerDirector, "agent");
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
