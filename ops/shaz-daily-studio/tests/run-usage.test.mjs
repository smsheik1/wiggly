import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { evaluateSentenceDirector } from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/director-jev.mjs";
import { deriveMultiShotPlanWithJev } from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/multi-shot-timeline.mjs";
import {
  createRunUsageTracker,
  readKitJevCalls,
  readMediaSourcingUsage,
  updateRunUsage,
  writeRunUsage,
} from "../run-usage.mjs";

test("createRunUsageTracker, readKitJevCalls, readMediaSourcingUsage, and updateRunUsage track real provider calls", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-usage-test-"));
  try {
    await fs.writeFile(
      path.join(tmpDir, "state.json"),
      JSON.stringify({ schemaVersion: 1, director: { mode: "jev", jevCalls: 7 } }),
    );
    await fs.writeFile(
      path.join(tmpDir, "media-sources.json"),
      JSON.stringify({ schemaVersion: 1, telemetry: { serperQueries: 4, serperDownloads: 6 } }),
    );

    const tracker = createRunUsageTracker({ runId: "run-1", writerAgent: "agy" });
    tracker.recordNewsMcp(1);
    tracker.recordArticleFetch(1);
    tracker.recordAgentWriter({ calls: 2, attempts: 2 });
    tracker.recordCartesia({ calls: 1, characters: 380 });
    tracker.setJev(await readKitJevCalls(tmpDir));
    tracker.recordSerper(await readMediaSourcingUsage(tmpDir));

    await writeRunUsage(tmpDir, tracker.snapshot());
    await updateRunUsage(tmpDir, (p) => {
      p.telegram.calls += 1;
      p.convex.uploads += 1;
      p.buffer.creates += 2;
    });

    const saved = JSON.parse(await fs.readFile(path.join(tmpDir, "run-usage.json"), "utf8"));
    assert.equal(saved.providers.jev.calls, 7);
    assert.equal(saved.providers.serper.queries, 4);
    assert.equal(saved.providers.serper.downloads, 6);
    assert.equal(saved.providers.telegram.calls, 1);
    assert.equal(saved.providers.convex.uploads, 1);
    assert.equal(saved.providers.buffer.creates, 2);
    assert.equal(saved.totalExternalCalls, 1 + 1 + 2 + 1 + 7 + 4 + 6 + 1 + 1 + 2);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evaluateSentenceDirector and deriveMultiShotPlanWithJev report exact HTTP call counts including retries", async () => {
  let hits = 0;
  const fetchFn = async () => {
    hits += 1;
    if (hits === 1) {
      return new Response("upstream error", { status: 503 });
    }
    return new Response(
      JSON.stringify({
        answers: {
          shot_energy: { choice: "chill" },
          card_headline: { choice: "TEST HEADLINE" },
          camera_motion: { choice: "zoom-in" },
          badge_category: { choice: "BREAKING" },
          is_punchline: { noul: 0.1 },
          shot_type: { choice: "talk-to-camera" },
          shaz_puppet_pose: { choice: "present" },
          chibi_pose: { choice: "facepalm" },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const single = await evaluateSentenceDirector("Nintendo shipped a console update.", {
    apiKey: "test-key",
    fetchFn,
  });
  assert.equal(single._jevCalls, 2);

  const plan = await deriveMultiShotPlanWithJev({
    transcript: {
      words: [
        { text: "First", startMs: 0, endMs: 900 },
        { text: "sentence.", startMs: 950, endMs: 2100 },
        { text: "Second", startMs: 2200, endMs: 3200 },
        { text: "line.", startMs: 3250, endMs: 4300 },
      ],
    },
    audioDurationSeconds: 4.3,
    script: {
      title: "Two Line Test",
      hook: { text: "First sentence." },
      beats: [],
      landing: { text: "Second line." },
    },
    apiKey: "test-key",
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          answers: {
            shot_energy: { choice: "chill" },
            card_headline: { choice: "TWO LINE" },
            camera_motion: { choice: "zoom-in" },
            badge_category: { choice: "BREAKING" },
            is_punchline: { noul: 0.1 },
            shot_type: { choice: "talk-to-camera" },
            shaz_puppet_pose: { choice: "present" },
            chibi_pose: { choice: "facepalm" },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });
  assert.equal(plan._jevCalls, 2);
});
