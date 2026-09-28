import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callJevSystemOne,
  directRoastEpisode,
  evaluateRoastCueDirector,
  getTypesafeApiKey,
  planRoastCueDeterministic,
  VALID_REACTION_ATTITUDES,
  VALID_ROAST_POSES,
} from "../runtime/director-jev.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const specularProofPath = path.join(rootDir, "inputs", "specular-commentary-proof.json");

test("Rule 12: director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test roast state",
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

test("evaluateRoastCueDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        presenter_pose: {
          choice: "laugh",
          confidence: 0.96,
        },
        horizontal_flip: {
          condition: true,
          probability: 0.88,
        },
        comedic_attitude: {
          choice: "savage-laugh",
          confidence: 0.94,
        },
      },
    }),
  });

  const evaluation = await evaluateRoastCueDirector(
    { type: "turn", sender: "Mom", text: "Even your dog unfollowed you.", atSeconds: 5.4 },
    {
      apiKey: "mock-key",
      fetchFn: mockFetch,
      cueContext: {
        cueIndex: 2,
        totalCues: 5,
        recentPoses: ["talk"],
        recentFlips: [false],
      },
    }
  );

  assert.equal(evaluation.pose, "laugh");
  assert.equal(evaluation.flip, true);
  assert.equal(evaluation.attitude, "savage-laugh");
  assert.equal(evaluation.provenance, "typesafe-jev-system-one");
});

test("variety-first planner prevents monotonous poses and static avatar orientation", () => {
  const raw = JSON.parse(readFileSync(specularProofPath, "utf8"));
  const recentPoses = [];
  const recentFlips = [];

  for (let i = 0; i < 6; i += 1) {
    const event = {
      type: i === 0 ? "hook" : "turn",
      sender: i % 2 === 0 ? "me" : "roaster",
      text: "You really thought this was a good idea?",
      atSeconds: i * 2.5,
    };

    const context = {
      cueIndex: i,
      totalCues: 6,
      recentPoses: [...recentPoses],
      recentFlips: [...recentFlips],
    };

    const plan = planRoastCueDeterministic(event, { cueContext: context });

    assert.ok(VALID_ROAST_POSES.includes(plan.pose));
    assert.ok(VALID_REACTION_ATTITUDES.includes(plan.attitude));
    assert.equal(typeof plan.flip, "boolean");

    if (recentPoses.length > 0) {
      assert.notEqual(plan.pose, recentPoses[0], `Cue ${i} repeated pose ${recentPoses[0]}`);
    }

    recentPoses.unshift(plan.pose);
    recentFlips.unshift(plan.flip);
  }
});

test("directRoastEpisode produces valid contract-compliant cues in deterministic mode", async () => {
  const raw = JSON.parse(readFileSync(specularProofPath, "utf8"));
  const directed = await directRoastEpisode(raw, { mode: "deterministic" });

  assert.ok(directed.presenter?.enabled);
  assert.ok(Array.isArray(directed.presenter?.cues));
  assert.ok(directed.presenter.cues.length > 0);

  for (const cue of directed.presenter.cues) {
    assert.ok(VALID_ROAST_POSES.includes(cue.pose));
    assert.equal(typeof cue.flip, "boolean");
    assert.equal(typeof cue.atSeconds, "number");
  }
});

test("Live Jev System One director integration (if TYPESAFE_API_KEY is configured)", async (t) => {
  const apiKey = getTypesafeApiKey();
  if (!apiKey) {
    t.skip("No TYPESAFE_API_KEY in environment or secrets.env; skipping live call.");
    return;
  }

  const raw = JSON.parse(readFileSync(specularProofPath, "utf8"));
  const event = {
    type: "turn",
    sender: "Alex",
    text: "Your pitch deck has 40 slides and zero revenue.",
    atSeconds: 4.0,
  };

  try {
    const res = await evaluateRoastCueDirector(event, {
      apiKey,
      cueContext: {
        cueIndex: 1,
        totalCues: 4,
        recentPoses: ["talk"],
        recentFlips: [false],
      },
    });

    assert.ok(VALID_ROAST_POSES.includes(res.pose));
    assert.ok(VALID_REACTION_ATTITUDES.includes(res.attitude));
    assert.equal(res.provenance, "typesafe-jev-system-one");
  } catch (err) {
    if (err.message.includes("402") || err.message.includes("401") || err.message.includes("429")) {
      assert.match(err.message, /JEV DIRECTOR API ERROR/);
    } else {
      throw err;
    }
  }
});
