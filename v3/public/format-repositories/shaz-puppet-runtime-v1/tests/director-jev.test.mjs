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

test("director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await evaluateSentenceDirector("Hello world", { apiKey: null, fetchFn: () => { throw new Error("Should not fetch"); } });
    },
    /TYPESAFE_API_KEY IS MISSING/,
  );
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

test("curateImageCandidatesDeterministic selects reputable news source over generic stock photo", async () => {
  const { curateImageCandidatesDeterministic } = await import("../runtime/director-jev.mjs");

  const candidates = [
    { index: 0, title: "Royalty Free Stock Photo of a Car Steering Wheel", source: "Getty Images", domain: "gettyimages.com" },
    { index: 1, title: "GM Is Getting Rid Of Apple CarPlay In All Of Its Cars", source: "The Autopian", domain: "theautopian.com" },
    { index: 2, title: "Generic vehicle vector clipart", source: "ClipArt Library", domain: "clipart.com" },
  ];

  const result = curateImageCandidatesDeterministic("General Motors just confirmed they still plan to ban Apple CarPlay.", candidates);
  assert.ok(result);
  assert.equal(result.selectedIndex, 1);
  assert.equal(result.selectedCandidate.source, "The Autopian");
  assert.equal(result.provenance, "heuristic");
});

test("curateImageCandidatesDeterministic selects meme on sarcastic punchline", async () => {
  const { curateImageCandidatesDeterministic } = await import("../runtime/director-jev.mjs");

  const candidates = [
    { index: 0, title: "GM electric vehicle charging station photo", source: "Car and Driver", domain: "caranddriver.com" },
    { index: 1, title: "SpongeBob Green Fish Deadpan Stare Reaction Meme", source: "Know Your Meme", domain: "knowyourmeme.com" },
  ];

  const result = curateImageCandidatesDeterministic("Nobody actually asked for this ridiculous paywall.", candidates);
  assert.ok(result);
  assert.equal(result.selectedIndex, 1);
  assert.equal(result.badge, "REACTION");
});

test("curateImageCandidatesWithJev parses Jev selection correctly", async () => {
  const { curateImageCandidatesWithJev } = await import("../runtime/director-jev.mjs");

  const candidates = [
    { index: 0, title: "GM corporate building exterior", source: "Bloomberg", domain: "bloomberg.com" },
    { index: 1, title: "Who needs Apple CarPlay? Not General Motors' EVs", source: "Detroit Free Press", domain: "freep.com" },
    { index: 2, title: "SpongeBob meme fish reaction", source: "Reddit", domain: "reddit.com" },
  ];

  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        best_image: {
          choice: "candidate_1",
          confidence: 0.94,
        },
        card_badge: {
          choice: "REPORT",
          confidence: 0.91,
        },
      },
    }),
  });

  const curated = await curateImageCandidatesWithJev({
    sentence: "General Motors confirms it will not offer Apple CarPlay in future EVs.",
    candidates,
    apiKey: "mock-key",
    fetchFn: mockFetch,
  });

  assert.ok(curated);
  assert.equal(curated.selectedIndex, 1);
  assert.equal(curated.selectedCandidate.source, "Detroit Free Press");
  assert.equal(curated.badge, "REPORT");
  assert.equal(curated.provenance, "jev-systemone");
});

test("searchGoogleImages throws Rule 12 error when SERPER_API_KEY is missing, handles HTTP errors, and preserves empty [] results", async () => {
  const { searchGoogleImages, SerperApiError } = await import("../runtime/serper-search.mjs");

  // Missing key must throw loudly (never return null)
  await assert.rejects(
    async () => searchGoogleImages("test query", { apiKey: null }),
    (err) => err instanceof SerperApiError && /SERPER_API_KEY IS MISSING/.test(err.message) && err.isAccountError === true,
  );

  // HTTP 429 marks account/quota error clearly
  await assert.rejects(
    async () => searchGoogleImages("test query", {
      apiKey: "mock-serper",
      fetchFn: async () => ({ ok: false, status: 429, text: async () => "rate limited" }),
    }),
    (err) => err instanceof SerperApiError && err.status === 429 && err.isAccountError === true,
  );

  // Empty images array still returns []
  const emptyResults = await searchGoogleImages("obscure query", {
    apiKey: "mock-serper",
    fetchFn: async () => ({ ok: true, json: async () => ({ images: [] }) }),
  });
  assert.deepEqual(emptyResults, []);

  // Mock fetch returns structured results
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      images: [
        {
          title: "GM CarPlay Ban Announcement",
          imageUrl: "https://example.com/carplay.jpg",
          source: "The Verge",
          domain: "theverge.com",
          imageWidth: 800,
          imageHeight: 600,
        },
      ],
    }),
  });

  const results = await searchGoogleImages("GM CarPlay", { apiKey: "mock-serper", fetchFn: mockFetch });
  assert.ok(Array.isArray(results));
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "GM CarPlay Ban Announcement");
  assert.equal(results[0].source, "The Verge");
  assert.equal(results[0].imageUrl, "https://example.com/carplay.jpg");
});

test("evaluateSentenceDirector passes beatContext to Jev state and resolves active fun poses", async () => {
  let capturedState = null;
  const mockFetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    capturedState = body.state;
    return {
      ok: true,
      json: async () => ({
        model: "jev-1.13.0",
        answers: {
          shot_type: { choice: "talk-to-camera", confidence: 0.9 },
          shaz_puppet_pose: { choice: "chin-stroke", confidence: 0.88 },
          chibi_pose: { choice: "think-chin", confidence: 0.8 },
          camera_motion: { choice: "zoom-in", confidence: 0.85 },
          badge_category: { choice: "COMMUNITY ROAST", confidence: 0.9 },
          is_punchline: { noul: 0.85 },
        },
      }),
    };
  };

  const evaluation = await evaluateSentenceDirector("And they expected us not to notice!", {
    apiKey: "mock-key",
    fetchFn: mockFetch,
    beatContext: {
      beatIndex: 2,
      totalBeats: 5,
      recentPoses: ["point-at-screen", "excited-celebration"],
    },
  });

  assert.ok(evaluation);
  assert.equal(evaluation.shazPose, "chin-stroke");
  assert.equal(capturedState.sentence, "And they expected us not to notice!");
  assert.equal(capturedState.beat_progression, "Beat 3 of 5");
  assert.deepEqual(capturedState.recent_poses, ["point-at-screen", "excited-celebration"]);
  assert.match(capturedState.direction_goal, /variety/i);
});

test("deriveMultiShotPlanWithJev throws loud error with baby steps and refuses to fall back when no key is provided", async () => {
  const sampleTranscript = {
    text: "Sentence one here. Sentence two here.",
    words: [
      { text: "Sentence", startMs: 0, endMs: 500 },
      { text: "one", startMs: 550, endMs: 900 },
      { text: "here.", startMs: 950, endMs: 2000 },
      { text: "Sentence", startMs: 2100, endMs: 2600 },
      { text: "two", startMs: 2650, endMs: 3000 },
      { text: "here.", startMs: 3050, endMs: 4200 },
    ],
  };

  await assert.rejects(
    async () => {
      await deriveMultiShotPlanWithJev({
        transcript: sampleTranscript,
        audioDurationSeconds: 4.5,
        apiKey: null,
      });
    },
    (err) => {
      assert.match(err.message, /TYPESAFE_API_KEY IS MISSING/);
      assert.match(err.message, /Silent fallbacks are strictly prohibited/);
      assert.match(err.message, /Baby steps to fix:/);
      assert.match(err.message, /https:\/\/typesafe\.ai\/dashboard/);
      return true;
    },
  );
});

test("curateImageCandidatesWithJev throws loud error when Jev returns invalid answers payload", async () => {
  const { curateImageCandidatesWithJev } = await import("../runtime/director-jev.mjs");
  const candidates = [
    { index: 0, title: "Test candidate", source: "The Verge" },
  ];

  const mockFetch = async () => ({
    ok: true,
    json: async () => ({ model: "jev-latest", answers: null }),
  });

  await assert.rejects(
    async () => {
      await curateImageCandidatesWithJev({
        sentence: "Test sentence",
        candidates,
        apiKey: "mock-key",
        fetchFn: mockFetch,
      });
    },
    /EMPTY OR INVALID ANSWERS PAYLOAD/,
  );
});

test("evaluateSentenceDirector retries invalid/unknown answers once, then throws JevDirectorSkipError without silent defaults (Q6)", async () => {
  const { JevApiError, JevDirectorSkipError } = await import("../runtime/director-jev.mjs");

  // 1) Invalid choice on attempt 1 -> succeeds on retry attempt 2
  let calls = 0;
  const recovered = await evaluateSentenceDirector("They raised the price twice.", {
    apiKey: "mock-key",
    beatContext: { beatIndex: 1, totalBeats: 4, recentPoses: [] },
    fetchFn: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          json: async () => ({
            answers: {
              shot_type: { choice: "invalid-shot" },
              shaz_puppet_pose: { choice: "think" },
              chibi_pose: { choice: "think-chin" },
              camera_motion: { choice: "zoom-in" },
              badge_category: { choice: "REALITY CHECK" },
              is_punchline: { noul: 0.2 },
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          answers: {
            shot_type: { choice: "talk-to-camera" },
            shaz_puppet_pose: { choice: "think" },
            chibi_pose: { choice: "think-chin" },
            camera_motion: { choice: "zoom-out" },
            badge_category: { choice: "REALITY CHECK" },
            is_punchline: { noul: 0.2 },
          },
        }),
      };
    },
  });
  assert.equal(calls, 2);
  assert.equal(recovered.cameraMotion, "zoom-out");

  // 2) Persistent missing/unknown field (e.g. undefined chibi_pose or invalid badge) throws JevDirectorSkipError after 1 retry
  let failCalls = 0;
  await assert.rejects(
    async () =>
      evaluateSentenceDirector("Wait what happened?", {
        apiKey: "mock-key",
        beatContext: { beatIndex: 2, totalBeats: 5, recentPoses: [] },
        fetchFn: async () => {
          failCalls += 1;
          return {
            ok: true,
            json: async () => ({
              answers: {
                shot_type: { choice: "talk-to-camera" },
                shaz_puppet_pose: { choice: "shrug" },
                chibi_pose: { choice: "not-a-real-chibi-pose" },
                camera_motion: { choice: "zoom-in" },
                badge_category: { choice: "BREAKING" },
                is_punchline: { noul: 0.4 },
              },
            }),
          };
        },
      }),
    (err) =>
      err instanceof JevDirectorSkipError &&
      err.message === "Jev gave no valid chibi_pose for line 3: Wait what happened?",
  );
  assert.equal(failCalls, 2);

  // 3) Single-line 5xx retries once then throws JevDirectorSkipError
  let err500Calls = 0;
  await assert.rejects(
    async () =>
      evaluateSentenceDirector("Temporary flake.", {
        apiKey: "mock-key",
        fetchFn: async () => {
          err500Calls += 1;
          return { ok: false, status: 503, text: async () => "bad gateway" };
        },
      }),
    (err) => err instanceof JevDirectorSkipError && err.lineNumber === 1,
  );
  assert.equal(err500Calls, 2);

  // 4) Account error HTTP 401/402/429 throws JevApiError immediately WITHOUT retry or skip
  let err402Calls = 0;
  await assert.rejects(
    async () =>
      evaluateSentenceDirector("Billing exhausted.", {
        apiKey: "mock-key",
        fetchFn: async () => {
          err402Calls += 1;
          return { ok: false, status: 402, text: async () => "out of credits" };
        },
      }),
    (err) => err instanceof JevApiError && err.status === 402 && err.isAccountError === true,
  );
  assert.equal(err402Calls, 1);
});

test("lintScriptWithJev rejects missing/invalid script_grade instead of silently passing", async () => {
  await assert.rejects(
    async () =>
      lintScriptWithJev("Sample script.", {
        apiKey: "mock-key",
        fetchFn: async () => ({
          ok: true,
          json: async () => ({
            answers: {
              is_corporate_pr_speak: { noul: 0.1 },
              has_authentic_voice: { noul: 0.9 },
              script_grade: {},
            },
          }),
        }),
      }),
    /invalid or missing script_grade/i,
  );
});

test("deriveMultiShotPlanWithJev rethrows internal TypeError code bugs without TypeSafe billing wrapper", async () => {
  await assert.rejects(
    async () =>
      deriveMultiShotPlanWithJev({
        transcript: {
          text: "First sentence goes right here. Second sentence triggers the bug. Third sentence wraps things up.",
          words: [
            { text: "First", startMs: 0, endMs: 250 },
            { text: "sentence", startMs: 260, endMs: 520 },
            { text: "goes", startMs: 530, endMs: 750 },
            { text: "right", startMs: 760, endMs: 950 },
            { text: "here.", startMs: 960, endMs: 1200 },
            { text: "Second", startMs: 1300, endMs: 1550 },
            { text: "sentence", startMs: 1560, endMs: 1820 },
            { text: "triggers", startMs: 1830, endMs: 2100 },
            { text: "the", startMs: 2110, endMs: 2250 },
            { text: "bug.", startMs: 2260, endMs: 2500 },
            { text: "Third", startMs: 2600, endMs: 2850 },
            { text: "sentence", startMs: 2860, endMs: 3120 },
            { text: "wraps", startMs: 3130, endMs: 3350 },
            { text: "things", startMs: 3360, endMs: 3600 },
            { text: "up.", startMs: 3610, endMs: 3850 },
          ],
        },
        audioDurationSeconds: 4.0,
        brollMediaList: ["media-1.png"],
        script: {
          hook: { cardHeadline: "OK" },
          beats: [{ cardHeadline: 123 }],
          landing: { cardHeadline: "END" },
        }, // intentional internal TypeError (123.trim) on valid mock answers to test non-API bug propagation
        apiKey: "mock-key",
        fetchFn: async () => ({
          ok: true,
          json: async () => ({
            answers: {
              shot_type: { choice: "talk-to-camera" },
              shaz_puppet_pose: { choice: "neutral-listening" },
              chibi_pose: { choice: "talk-gesture" },
              camera_motion: { choice: "zoom-in" },
              badge_category: { choice: "BREAKING" },
              is_punchline: { noul: 0.1 },
            },
          }),
        }),
      }),
    (err) => err instanceof TypeError && !/TYPESAFE_API_KEY|billing/i.test(err.message),
  );
});


