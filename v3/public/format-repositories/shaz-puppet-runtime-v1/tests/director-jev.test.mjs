import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSentenceDirector,
  getTypesafeApiKey,
  lintScriptWithJev,
} from "../runtime/director-jev.mjs";

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
