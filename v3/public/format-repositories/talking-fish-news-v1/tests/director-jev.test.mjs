import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callJevSystemOne,
  directFishNewsStory,
  evaluateFishNewsBeatDirector,
  planFishNewsDeterministic,
  VALID_ANCHOR_EXPRESSIONS,
  VALID_CAMERA_MOTIONS,
  VALID_TICKER_BADGES,
} from "../runtime/director-jev.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const nasaCuriosityPath = path.join(rootDir, "fixtures", "nasa-curiosity.json");

test("Rule 12: director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test news state",
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

test("evaluateFishNewsBeatDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        camera_motion: {
          choice: "zoom-in-evidence",
          confidence: 0.93,
        },
        ticker_badge: {
          choice: "SCIENTIFIC BREAKTHROUGH",
          confidence: 0.95,
        },
        anchor_expression: {
          choice: "deadpan-serious",
          confidence: 0.89,
        },
        is_payoff: {
          noul: 0.05,
        },
      },
    }),
  });

  const evaluation = await evaluateFishNewsBeatDirector("Curiosity just found a sea of tiny honeycomb shapes.", {
    apiKey: "mock-key",
    fetchFn: mockFetch,
    beatContext: {
      beatIndex: 0,
      totalBeats: 4,
      topic: "Martian honeycomb textures",
      stage: "hook",
      recentMotions: [],
      recentBadges: [],
    },
  });

  assert.ok(evaluation);
  assert.equal(evaluation.cameraMotion, "zoom-in-evidence");
  assert.equal(evaluation.tickerBadge, "SCIENTIFIC BREAKTHROUGH");
  assert.equal(evaluation.anchorExpression, "deadpan-serious");
  assert.equal(evaluation.isPayoff, false);
  assert.equal(evaluation.provenance, "jev-systemone");
});

test("evaluateFishNewsBeatDirector enforces variety guardrail against duplicate consecutive camera motion", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        camera_motion: {
          choice: "zoom-in-evidence", // duplicate of last beat
          confidence: 0.9,
        },
        ticker_badge: {
          choice: "INVESTIGATION",
          confidence: 0.88,
        },
        anchor_expression: {
          choice: "shocked-gasp",
          confidence: 0.85,
        },
        is_payoff: {
          noul: 0.1,
        },
      },
    }),
  });

  const evaluation = await evaluateFishNewsBeatDirector("Each polygon is only a few inches wide.", {
    apiKey: "mock-key",
    fetchFn: mockFetch,
    beatContext: {
      beatIndex: 1,
      totalBeats: 4,
      recentMotions: ["zoom-in-evidence"],
      recentBadges: ["BREAKING NEWS"],
    },
  });

  assert.ok(evaluation);
  assert.notEqual(evaluation.cameraMotion, "zoom-in-evidence", "Must not repeat identical camera motion consecutively");
  assert.ok(VALID_CAMERA_MOTIONS.includes(evaluation.cameraMotion));
});

test("planFishNewsDeterministic provides variety across all 4 beats", () => {
  const beatTexts = [
    "Breaking news. Curiosity found honeycomb shapes.",
    "Each polygon is only a few inches wide.",
    "Some may be ancient mud cracks while others formed as buried water moved.",
    "Scientists are testing the chemistry now. Mars has entered its floor-tile era.",
  ];

  const recentM = [];
  const recentB = [];

  for (let i = 0; i < beatTexts.length; i += 1) {
    const plan = planFishNewsDeterministic(beatTexts[i], {
      beatContext: {
        beatIndex: i,
        totalBeats: 4,
        recentMotions: [...recentM],
        recentBadges: [...recentB],
      },
    });

    assert.ok(VALID_CAMERA_MOTIONS.includes(plan.cameraMotion));
    assert.ok(VALID_TICKER_BADGES.includes(plan.tickerBadge));
    assert.ok(VALID_ANCHOR_EXPRESSIONS.includes(plan.anchorExpression));

    if (recentM.length > 0) {
      assert.notEqual(plan.cameraMotion, recentM[0], `Camera motion repeated at beat ${i}`);
    }
    if (recentB.length > 0) {
      assert.notEqual(plan.tickerBadge, recentB[0], `Ticker badge repeated at beat ${i}`);
    }

    recentM.unshift(plan.cameraMotion);
    recentB.unshift(plan.tickerBadge);
  }
});

test("directFishNewsStory directs all 4 beats of nasa-curiosity fixture in dry-run mode", async () => {
  const fixture = JSON.parse(readFileSync(nasaCuriosityPath, "utf8"));
  const plan = await directFishNewsStory(fixture, {
    dryRun: true,
    logger: null,
  });

  assert.equal(plan.version, "1.0");
  assert.equal(plan.format, "talking-fish-news");
  assert.equal(plan.director, "deterministic-variety-planner");
  assert.equal(plan.totalBeats, 4);
  assert.equal(plan.beats.length, 4);

  // Check variety across all beats
  for (let i = 0; i < plan.beats.length; i += 1) {
    const beat = plan.beats[i];
    assert.ok(VALID_CAMERA_MOTIONS.includes(beat.cameraMotion));
    assert.ok(VALID_TICKER_BADGES.includes(beat.tickerBadge));
    assert.ok(VALID_ANCHOR_EXPRESSIONS.includes(beat.anchorExpression));

    if (i > 0) {
      assert.notEqual(beat.cameraMotion, plan.beats[i - 1].cameraMotion);
      assert.notEqual(beat.tickerBadge, plan.beats[i - 1].tickerBadge);
    }
  }

  assert.equal(plan.beats[3].isPayoff, true, "Beat 4 must be recognized as the payoff");
});

test("requirements.json declares Typesafe / Jev System One with TYPESAFE_API_KEY", () => {
  const rawRequirements = readFileSync(path.join(rootDir, "requirements.json"), "utf8");
  assert.doesNotMatch(rawRequirements, /type_[a-zA-Z0-9]{20,}/, "No real secrets in requirements.json");

  const requirements = JSON.parse(rawRequirements);
  const jevProvider = requirements.providers?.find((p) => p.name?.includes("Jev") || p.id === "typesafe");
  assert.ok(jevProvider, "requirements.json must declare Typesafe / Jev System One");
  const envVars = jevProvider.environmentVariables || (jevProvider.environmentVariable ? [jevProvider.environmentVariable] : []);
  assert.ok(envVars.includes("TYPESAFE_API_KEY"), "Jev provider must require TYPESAFE_API_KEY");
  assert.equal(jevProvider.optional, false, "Jev Director is a required choreography provider");
});
