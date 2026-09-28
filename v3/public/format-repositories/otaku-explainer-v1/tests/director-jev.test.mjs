import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callJevSystemOne,
  directOtakuScenes,
  evaluateOtakuSceneDirector,
  getTypesafeApiKey,
  planOtakuSceneDeterministic,
  VALID_ACTING_ENERGIES,
  VALID_CALLOUT_THEMES,
  VALID_LAYOUTS,
  VALID_SPEAKER_ROLES,
} from "../runtime/director-jev.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");

const sampleLesson = {
  world: "naruto",
  topic: "How does Chakra work?",
  scenes: [
    { id: "scene-1", speakerRole: "learner", visibleRoles: ["learner", "guide"], dialogue: "Wait, so Chakra isn't just magic?! How does it actually work?!", estimatedDurationMs: 4000 },
    { id: "scene-2", speakerRole: "guide", visibleRoles: ["learner", "guide"], dialogue: "Chakra is the precise blend of physical stamina and spiritual energy.", estimatedDurationMs: 5000 },
    { id: "scene-3", speakerRole: "challenger", visibleRoles: ["learner", "guide", "challenger"], dialogue: "And if your ratio is off by even a fraction, the jutsu fails completely.", estimatedDurationMs: 4500 },
    { id: "scene-4", speakerRole: "guide", visibleRoles: ["learner", "guide"], dialogue: "Master control first, and even the simplest hand signs become lethal.", estimatedDurationMs: 4000 },
  ],
};

test("Rule 12: director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test otaku state",
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

test("evaluateOtakuSceneDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        layout: {
          choice: "two-second-focus",
          confidence: 0.94,
        },
        callout_theme: {
          choice: "gold",
          confidence: 0.97,
        },
        acting_energy: {
          choice: "master-explains",
          confidence: 0.95,
        },
      },
    }),
  });

  const evaluation = await evaluateOtakuSceneDirector(
    { speakerRole: "guide", dialogue: "Chakra requires exact equilibrium.", estimatedDurationMs: 4000 },
    {
      apiKey: "mock-key",
      fetchFn: mockFetch,
      sceneContext: {
        sceneIndex: 1,
        totalScenes: 4,
        recentLayouts: ["two-first-focus"],
        recentThemes: ["question"],
      },
    }
  );

  assert.equal(evaluation.layout, "two-second-focus");
  assert.equal(evaluation.callout.theme, "gold");
  assert.equal(evaluation.actingEnergy, "master-explains");
  assert.equal(evaluation.provenance, "typesafe-jev-system-one");
});

test("variety-first planner prevents monotonous layouts and callout themes", () => {
  const scenes = sampleLesson.scenes;
  const recentLayouts = [];
  const recentThemes = [];

  for (let i = 0; i < scenes.length; i += 1) {
    const context = {
      sceneIndex: i,
      totalScenes: scenes.length,
      recentLayouts: [...recentLayouts],
      recentThemes: [...recentThemes],
    };

    const plan = planOtakuSceneDeterministic(scenes[i], { sceneContext: context });

    assert.ok(VALID_LAYOUTS.includes(plan.layout));
    assert.ok(VALID_CALLOUT_THEMES.includes(plan.callout.theme));
    assert.ok(VALID_ACTING_ENERGIES.includes(plan.actingEnergy));

    if (recentThemes.length > 0) {
      assert.notEqual(plan.callout.theme, recentThemes[0], `Scene ${i} repeated theme ${recentThemes[0]}`);
    }

    recentLayouts.unshift(plan.layout);
    recentThemes.unshift(plan.callout.theme);
  }
});

test("directOtakuScenes produces contract-compliant lesson plan in deterministic mode", async () => {
  const directed = await directOtakuScenes(sampleLesson, { mode: "deterministic" });

  assert.equal(directed.scenes.length, 4);
  for (const s of directed.scenes) {
    assert.ok(VALID_LAYOUTS.includes(s.layout));
    assert.ok(VALID_CALLOUT_THEMES.includes(s.callout.theme));
    assert.ok(s.callout.label.length <= 14);
    assert.ok(VALID_ACTING_ENERGIES.includes(s.directionMetadata?.actingEnergy));
  }
});

test("Live Jev System One director integration (if TYPESAFE_API_KEY is configured)", async (t) => {
  const apiKey = getTypesafeApiKey();
  if (!apiKey) {
    t.skip("No TYPESAFE_API_KEY in environment or secrets.env; skipping live call.");
    return;
  }

  const singleScene = sampleLesson.scenes[0];

  try {
    const res = await evaluateOtakuSceneDirector(singleScene, {
      apiKey,
      sceneContext: {
        sceneIndex: 0,
        totalScenes: sampleLesson.scenes.length,
        recentLayouts: [],
        recentThemes: [],
      },
    });

    assert.ok(VALID_LAYOUTS.includes(res.layout));
    assert.ok(VALID_CALLOUT_THEMES.includes(res.callout.theme));
    assert.ok(VALID_ACTING_ENERGIES.includes(res.actingEnergy));
    assert.equal(res.provenance, "typesafe-jev-system-one");
  } catch (err) {
    if (err.message.includes("402") || err.message.includes("401") || err.message.includes("429")) {
      assert.match(err.message, /JEV DIRECTOR API ERROR/);
    } else {
      throw err;
    }
  }
});
