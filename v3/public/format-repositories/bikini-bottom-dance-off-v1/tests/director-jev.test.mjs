import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callJevSystemOne,
  directDanceOffEpisode,
  evaluateDanceCompetitorDirector,
  getTypesafeApiKey,
  planDanceChoreographyDeterministic,
  VALID_BACKGROUNDS,
  VALID_BATTLE_INTENSITIES,
} from "../runtime/director-jev.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const smokeInputPath = path.join(rootDir, "fixtures", "smoke", "input.json");

test("Rule 12: director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test dance state",
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

test("evaluateDanceCompetitorDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        battle_intensity: {
          choice: "furious-showdown",
          confidence: 0.94,
        },
      },
    }),
  });

  const evaluation = await evaluateDanceCompetitorDirector(
    { characterId: "squilliam", label: "Squilliam Fancyson", taunt: "Behold real art." },
    {
      characterIndex: 2,
      apiKey: "mock-key",
      fetchFn: mockFetch,
      availableMotions: [
        { id: "silly-dancing", durationSeconds: 12 },
        { id: "hip-hop-dancing", durationSeconds: 6 },
        { id: "cheering", durationSeconds: 4 },
      ],
      usedMotions: new Set(),
    }
  );

  assert.equal(evaluation.battleIntensity, "furious-showdown");
  assert.equal(evaluation.provenance, "typesafe-jev-system-one");
  assert.ok(evaluation.soloMotionId);
  assert.ok(evaluation.finaleMotionId);
  assert.ok(evaluation.reactionMotionId);
});

test("variety-first planner produces distinct motions for each character in deterministic mode", () => {
  const raw = JSON.parse(readFileSync(smokeInputPath, "utf8"));
  const chars = raw.characters;

  const used = new Set();
  for (let i = 0; i < chars.length; i += 1) {
    const plan = planDanceChoreographyDeterministic(chars[i], {
      characterIndex: i,
      availableMotions: [
        { id: `motion-solo-${i}`, durationSeconds: 5 },
        { id: `motion-finale-${i}`, durationSeconds: 10 },
        { id: `motion-react-${i}`, durationSeconds: 4 },
      ],
      usedMotions: used,
    });

    assert.ok(VALID_BATTLE_INTENSITIES.includes(plan.battleIntensity));
    assert.notEqual(plan.soloMotionId, plan.finaleMotionId);
    assert.notEqual(plan.soloMotionId, plan.reactionMotionId);

    used.add(plan.soloMotionId);
    used.add(plan.finaleMotionId);
    used.add(plan.reactionMotionId);
  }
});

test("directDanceOffEpisode produces contract-compliant episode with 4 competitors in deterministic mode", async () => {
  const raw = JSON.parse(readFileSync(smokeInputPath, "utf8"));
  const directed = await directDanceOffEpisode(raw, { mode: "deterministic" });

  assert.equal(directed.characters.length, 4);
  for (const c of directed.characters) {
    assert.ok(c.characterId);
    assert.ok(c.motionId);
    assert.ok(c.finaleMotionId);
    assert.ok(c.reactionMotionId);
    assert.ok(c.label);
    assert.ok(c.color);
    assert.ok(VALID_BATTLE_INTENSITIES.includes(c.directionMetadata?.battleIntensity));
  }
});

test("Live Jev System One director integration (if TYPESAFE_API_KEY is configured)", async (t) => {
  const apiKey = getTypesafeApiKey();
  if (!apiKey) {
    t.skip("No TYPESAFE_API_KEY in environment or secrets.env; skipping live call.");
    return;
  }

  const raw = JSON.parse(readFileSync(smokeInputPath, "utf8"));
  const char = raw.characters[0];

  try {
    const res = await evaluateDanceCompetitorDirector(char, {
      characterIndex: 0,
      apiKey,
      availableMotions: [
        { id: "silly-dancing", durationSeconds: 12 },
        { id: "hip-hop-dancing", durationSeconds: 6 },
        { id: "cheering", durationSeconds: 4 },
      ],
      usedMotions: new Set(),
    });

    assert.ok(VALID_BATTLE_INTENSITIES.includes(res.battleIntensity));
    assert.equal(res.provenance, "typesafe-jev-system-one");
  } catch (err) {
    if (err.message.includes("402") || err.message.includes("401") || err.message.includes("429")) {
      assert.match(err.message, /JEV DIRECTOR API ERROR/);
    } else {
      throw err;
    }
  }
});
