import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callJevSystemOne,
  directAnimalConversation,
  evaluateAnimalBeatDirector,
  getTypesafeApiKey,
  planAnimalBeatDeterministic,
  VALID_CAMERAS,
  VALID_REACTIONS,
  VALID_SPEAKERS,
} from "../director-jev.mjs";

const rootDir = path.resolve(import.meta.dirname, "../..");
const smokeInputPath = path.join(rootDir, "fixtures", "smoke", "input.json");

test("Rule 12: director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test dialogue state",
        questions: {},
        apiKey: null,
        fetchFn: () => {
          throw new Error("Should not fetch when key is missing");
        },
      });
    },
    (err) => {
      assert.match(err.message, /TYPESAFE_API_KEY IS MISSING/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/dashboard/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/keys/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/billing/);
      assert.match(err.message, /secrets\.env/);
      assert.match(err.message, /TYPESAFE_API_KEY=your_copied_key_here/);
      return true;
    }
  );
});

test("Rule 12: director-jev throws a loud error with baby steps on HTTP API failure", async () => {
  const mockFailingFetch = async () => ({
    ok: false,
    status: 402,
    text: async () => JSON.stringify({ error: "Insufficient credits" }),
  });

  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test state",
        questions: {},
        apiKey: "test-fake-key",
        fetchFn: mockFailingFetch,
      });
    },
    (err) => {
      assert.match(err.message, /JEV DIRECTOR API ERROR \(HTTP 402\)/);
      assert.match(err.message, /Insufficient credits/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/billing/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/keys/);
      return true;
    }
  );
});

test("evaluateAnimalBeatDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        camera: {
          choice: "cat-close",
          confidence: 0.94,
        },
        reaction_attitude: {
          choice: "smug-cat",
          confidence: 0.96,
        },
        has_bounce_emphasis: {
          condition: true,
          probability: 0.91,
        },
        is_punchline: {
          condition: false,
          probability: 0.05,
        },
      },
    }),
  });

  const evaluation = await evaluateAnimalBeatDirector(
    { start: 0, end: 1.8, speaker: "cat", caption: "I told you that box was mine!" },
    {
      apiKey: "mock-key",
      fetchFn: mockFetch,
      beatContext: {
        beatIndex: 1,
        totalBeats: 4,
        recentCameras: ["two-shot"],
      },
    }
  );

  assert.equal(evaluation.camera, "cat-close");
  assert.equal(evaluation.reaction, "smug-cat");
  assert.ok(Array.isArray(evaluation.bounceAt));
  assert.ok(evaluation.bounceAt.length > 0);
  assert.equal(evaluation.isPunchline, false);
  assert.equal(evaluation.provenance, "typesafe-jev-system-one");
});

test("variety-first planner prevents camera stagnation and respects contract limits", () => {
  const input = JSON.parse(readFileSync(smokeInputPath, "utf8"));
  const timeline = input.timeline;

  const recentCameras = [];
  for (let i = 0; i < timeline.length; i += 1) {
    const context = {
      beatIndex: i,
      totalBeats: timeline.length,
      recentCameras: [...recentCameras],
    };

    const plan = planAnimalBeatDeterministic(timeline[i], { beatContext: context });

    assert.ok(VALID_CAMERAS.includes(plan.camera));
    assert.ok(VALID_REACTIONS.includes(plan.reaction));
    assert.ok(plan.bounceAt.length <= 2, "bounceAt must not exceed 2 items");

    // Camera shouldn't stay identical for 3 consecutive beats
    if (recentCameras.length >= 2) {
      const allThreeSame = recentCameras[0] === plan.camera && recentCameras[1] === plan.camera;
      assert.equal(allThreeSame, false, `Camera stagnated at beat ${i}`);
    }

    recentCameras.unshift(plan.camera);
  }
});

test("directAnimalConversation produces valid contract-compliant episode output in deterministic mode", async () => {
  const input = JSON.parse(readFileSync(smokeInputPath, "utf8"));
  const directed = await directAnimalConversation(input, { mode: "deterministic" });

  assert.equal(directed.schemaVersion, 1);
  assert.equal(directed.title, input.title);
  assert.equal(directed.timeline.length, input.timeline.length);

  for (const beat of directed.timeline) {
    assert.ok(VALID_CAMERAS.includes(beat.camera));
    assert.ok(VALID_SPEAKERS.includes(beat.speaker));
    if (beat.bounceAt) {
      assert.ok(beat.bounceAt.length <= 2);
      for (const offset of beat.bounceAt) {
        assert.ok(offset >= 0 && offset < (beat.end - beat.start));
      }
    }
  }
});

test("Live Jev System One director integration (if TYPESAFE_API_KEY is configured)", async (t) => {
  const apiKey = getTypesafeApiKey();
  if (!apiKey) {
    t.skip("No TYPESAFE_API_KEY in environment or secrets.env; skipping live call.");
    return;
  }

  const input = JSON.parse(readFileSync(smokeInputPath, "utf8"));
  const singleBeat = input.timeline[0];

  try {
    const res = await evaluateAnimalBeatDirector(singleBeat, {
      apiKey,
      beatContext: {
        beatIndex: 0,
        totalBeats: input.timeline.length,
        recentCameras: [],
      },
    });

    assert.ok(VALID_CAMERAS.includes(res.camera));
    assert.ok(VALID_REACTIONS.includes(res.reaction));
    assert.equal(res.provenance, "typesafe-jev-system-one");
  } catch (err) {
    if (err.message.includes("402") || err.message.includes("401") || err.message.includes("429")) {
      assert.match(err.message, /JEV DIRECTOR API ERROR/);
    } else {
      throw err;
    }
  }
});
