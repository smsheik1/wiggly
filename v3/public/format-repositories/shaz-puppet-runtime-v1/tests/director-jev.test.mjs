import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSentenceDirector,
  getTypesafeApiKey,
  lintScriptWithJev,
} from "../runtime/director-jev.mjs";
import {
  deriveMultiShotPlan,
  deriveMultiShotPlanWithJev,
} from "../runtime/multi-shot-timeline.mjs";

test("director-jev returns null gracefully when no key is provided", async () => {
  const result = await evaluateSentenceDirector("Hello world", { apiKey: null, fetchFn: () => { throw new Error("Should not fetch"); } });
  assert.equal(result, null);
});

test("evaluateSentenceDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-1.13.0",
      answers: {
        shot_type: {
          choice: "talk-to-camera",
          confidence: 0.89,
        },
        shaz_puppet_pose: {
          choice: "think",
          confidence: 0.91,
        },
        chibi_pose: {
          choice: "facepalm",
          confidence: 0.88,
        },
        camera_motion: {
          choice: "zoom-in",
          confidence: 0.95,
        },
        badge_category: {
          choice: "THE CLASH",
          confidence: 0.82,
        },
        is_punchline: {
          noul: 0.92,
        },
      },
    }),
  });

  const evaluation = await evaluateSentenceDirector("Seven hundred dollars without a disc drive?!", {
    apiKey: "mock-key",
    fetchFn: mockFetch,
  });

  assert.ok(evaluation);
  assert.equal(evaluation.shotType, "talk-to-camera");
  assert.equal(evaluation.shazPose, "think");
  assert.equal(evaluation.chibiPose, "shrug-open");
  assert.equal(evaluation.cameraMotion, "zoom-in");
  assert.equal(evaluation.badge, "THE CLASH");
  assert.equal(evaluation.isPunchline, true);
  assert.equal(evaluation.provenance, "jev-systemone");
});

test("lintScriptWithJev detects corporate PR draft from mock Jev response", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-1.13.0",
      answers: {
        is_corporate_pr_speak: {
          noul: 0.96,
        },
        has_authentic_voice: {
          noul: 0.08,
        },
        script_grade: {
          choice: "reject-corporate",
          confidence: 0.97,
        },
      },
    }),
  });

  const report = await lintScriptWithJev("In today's ever-evolving landscape...", {
    apiKey: "mock-key",
    fetchFn: mockFetch,
  });

  assert.ok(report);
  assert.equal(report.grade, "reject-corporate");
  assert.equal(report.isCorporate, true);
  assert.equal(report.hasAuthenticVoice, false);
});

test("deriveMultiShotPlanWithJev prioritizes talk-to-camera with neutral-listening anchor", async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount += 1;
    return {
      ok: true,
      json: async () => ({
        model: "jev-1.13.0",
        answers: {
          shot_type: { choice: callCount === 3 ? "chibi-commentary" : "talk-to-camera", confidence: 0.85 },
          shaz_puppet_pose: {
            // Beat 1: active gesture (point)
            // Beat 2: active gesture (think) -> should be grounded back to neutral-listening for breathing room!
            choice: callCount === 1 ? "point" : callCount === 2 ? "think" : "neutral-listening",
            confidence: 0.75,
          },
          chibi_pose: { choice: "point-emphasis", confidence: 0.85 },
          camera_motion: { choice: "zoom-in", confidence: 0.8 },
          badge_category: { choice: "REALITY CHECK", confidence: 0.8 },
          is_punchline: { noul: callCount === 3 ? 0.9 : 0.1 },
        },
      }),
    };
  };

  const sampleTranscript = {
    text: "Sentence one here. Sentence two here. Sentence three is funny. Sentence four wraps up.",
    words: [
      { text: "Sentence", startMs: 0, endMs: 500 },
      { text: "one", startMs: 550, endMs: 900 },
      { text: "here.", startMs: 950, endMs: 2000 },
      { text: "Sentence", startMs: 2100, endMs: 2600 },
      { text: "two", startMs: 2650, endMs: 3000 },
      { text: "here.", startMs: 3050, endMs: 4200 },
      { text: "Sentence", startMs: 4300, endMs: 4800 },
      { text: "three", startMs: 4850, endMs: 5200 },
      { text: "is", startMs: 5250, endMs: 5500 },
      { text: "funny.", startMs: 5550, endMs: 6500 },
      { text: "Sentence", startMs: 6600, endMs: 7000 },
      { text: "four", startMs: 7050, endMs: 7400 },
      { text: "wraps", startMs: 7450, endMs: 7800 },
      { text: "up.", startMs: 7850, endMs: 8800 },
    ],
  };

  const plan = await deriveMultiShotPlanWithJev({
    transcript: sampleTranscript,
    audioDurationSeconds: 9.0,
    apiKey: "mock-key",
    fetchFn: mockFetch,
  });

  assert.ok(plan);
  assert.equal(plan.shots.length, 4);

  // Shot 1 is talk-to-camera with point
  assert.equal(plan.shots[0].shotType, "talk-to-camera");
  assert.equal(plan.shots[0].poseId, "point");

  // Shot 2 is talk-to-camera, but because shot 1 was active, shot 2 grounds back in neutral-listening!
  assert.equal(plan.shots[1].shotType, "talk-to-camera");
  assert.equal(plan.shots[1].poseId, "neutral-listening");

  // Shot 3 is comedic chibi cutaway
  assert.equal(plan.shots[2].shotType, "chibi-commentary");

  // Shot 4 is talk-to-camera outro
  assert.equal(plan.shots[3].shotType, "talk-to-camera");
  assert.equal(plan.shots[3].poseId, "neutral-listening");
});

