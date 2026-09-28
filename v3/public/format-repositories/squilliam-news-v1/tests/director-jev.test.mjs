import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callJevSystemOne,
  directSquilliamNewsPresentation,
  evaluateSquilliamSlideDirector,
  getTypesafeApiKey,
  planSquilliamNewsDeterministic,
  VALID_ANCHOR_EXPRESSIONS,
  VALID_CAMERA_MOTIONS,
  VALID_GESTURE_POSES,
  VALID_TICKER_BADGES,
} from "../runtime/director-jev.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const smokeContentPath = path.join(rootDir, "fixtures", "smoke", "content.json");

test("Rule 12: director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test presentation state",
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

test("evaluateSquilliamSlideDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        gesture_pose: {
          choice: "present_screen",
          confidence: 0.94,
        },
        camera_motion: {
          choice: "pan-across-evidence",
          confidence: 0.92,
        },
        ticker_badge: {
          choice: "OPULENT EXCLUSIVITY",
          confidence: 0.96,
        },
        anchor_expression: {
          choice: "smug-condescending",
          confidence: 0.98,
        },
        is_payoff: {
          condition: false,
          probability: 0.04,
        },
      },
    }),
  });

  const evaluation = await evaluateSquilliamSlideDirector(
    { type: "poster", image: "assets/story/poster.png", caption: "Squilliam's private art gallery." },
    {
      apiKey: "mock-key",
      fetchFn: mockFetch,
      slideContext: {
        slideIndex: 1,
        totalSlides: 10,
        recentGestures: ["intro_open"],
        recentMotions: ["wide-anchor-desk"],
        recentBadges: ["HIGH SOCIETY BULLETIN"],
      },
    }
  );

  assert.equal(evaluation.gesturePose, "present_screen");
  assert.equal(evaluation.cameraMotion, "pan-across-evidence");
  assert.equal(evaluation.tickerBadge, "OPULENT EXCLUSIVITY");
  assert.equal(evaluation.anchorExpression, "smug-condescending");
  assert.equal(evaluation.isPayoff, false);
  assert.equal(evaluation.provenance, "typesafe-jev-system-one");
});

test("variety-first planner prevents back-to-back duplicate gestures, camera motions, and badges", () => {
  const content = JSON.parse(readFileSync(smokeContentPath, "utf8"));
  const slides = content.slides;

  let lastGesture = null;
  let lastMotion = null;
  let lastBadge = null;

  for (let i = 0; i < slides.length; i += 1) {
    const context = {
      slideIndex: i,
      totalSlides: slides.length,
      recentGestures: lastGesture ? [lastGesture] : [],
      recentMotions: lastMotion ? [lastMotion] : [],
      recentBadges: lastBadge ? [lastBadge] : [],
    };

    const plan = planSquilliamNewsDeterministic(slides[i], { slideContext: context });

    assert.ok(VALID_GESTURE_POSES.includes(plan.gesturePose));
    assert.ok(VALID_CAMERA_MOTIONS.includes(plan.cameraMotion));
    assert.ok(VALID_TICKER_BADGES.includes(plan.tickerBadge));
    assert.ok(VALID_ANCHOR_EXPRESSIONS.includes(plan.anchorExpression));

    if (lastGesture) {
      assert.notEqual(plan.gesturePose, lastGesture, `Slide ${i} repeated gesture ${lastGesture}`);
    }
    if (lastMotion) {
      assert.notEqual(plan.cameraMotion, lastMotion, `Slide ${i} repeated camera motion ${lastMotion}`);
    }
    if (lastBadge) {
      assert.notEqual(plan.tickerBadge, lastBadge, `Slide ${i} repeated ticker badge ${lastBadge}`);
    }

    lastGesture = plan.gesturePose;
    lastMotion = plan.cameraMotion;
    lastBadge = plan.tickerBadge;
  }
});

test("directSquilliamNewsPresentation produces valid 10-slide choreography plan in deterministic mode", async () => {
  const content = JSON.parse(readFileSync(smokeContentPath, "utf8"));
  const plan = await directSquilliamNewsPresentation(content, { mode: "deterministic" });

  assert.equal(plan.characterId, content.characterId || "squilliam");
  assert.equal(plan.totalSlides, 10);
  assert.equal(plan.directedSlides.length, 10);

  // Check no consecutive identical gestures
  for (let i = 1; i < plan.directedSlides.length; i += 1) {
    const prev = plan.directedSlides[i - 1].direction;
    const curr = plan.directedSlides[i].direction;
    assert.notEqual(curr.gesturePose, prev.gesturePose, `Consecutive duplicate gesture at slide ${i}`);
    assert.notEqual(curr.cameraMotion, prev.cameraMotion, `Consecutive duplicate camera motion at slide ${i}`);
    assert.notEqual(curr.tickerBadge, prev.tickerBadge, `Consecutive duplicate ticker badge at slide ${i}`);
  }
});

test("Live Jev System One director integration (if TYPESAFE_API_KEY is configured)", async (t) => {
  const apiKey = getTypesafeApiKey();
  if (!apiKey) {
    t.skip("No TYPESAFE_API_KEY in environment or secrets.env; skipping live call.");
    return;
  }

  const content = JSON.parse(readFileSync(smokeContentPath, "utf8"));
  const singleSlide = content.slides[0];

  try {
    const res = await evaluateSquilliamSlideDirector(singleSlide, {
      apiKey,
      slideContext: {
        slideIndex: 0,
        totalSlides: 10,
        recentGestures: [],
        recentMotions: [],
        recentBadges: [],
      },
    });

    assert.ok(VALID_GESTURE_POSES.includes(res.gesturePose));
    assert.ok(VALID_CAMERA_MOTIONS.includes(res.cameraMotion));
    assert.ok(VALID_TICKER_BADGES.includes(res.tickerBadge));
    assert.ok(VALID_ANCHOR_EXPRESSIONS.includes(res.anchorExpression));
    assert.equal(res.provenance, "typesafe-jev-system-one");
  } catch (err) {
    if (err.message.includes("402") || err.message.includes("401") || err.message.includes("429")) {
      assert.match(err.message, /JEV DIRECTOR API ERROR/);
    } else {
      throw err;
    }
  }
});
