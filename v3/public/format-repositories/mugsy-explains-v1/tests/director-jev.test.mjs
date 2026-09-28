import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  callJevSystemOne,
  directMugsyContent,
  evaluateMugsySentenceDirector,
  planMugsyDeterministic,
  VALID_BADGES,
  VALID_CAMERA_MOTIONS,
  VALID_MUGSY_POSES,
} from "../runtime/director-jev.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");
const contentJsonPath = path.join(rootDir, "content.json");

test("Rule 12: director-jev throws a loud error with baby steps when no key is provided", async () => {
  await assert.rejects(
    async () => {
      await callJevSystemOne({
        state: "Test state",
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

test("evaluateMugsySentenceDirector parses mock Jev response correctly", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        mugsy_pose: {
          choice: "coffee-explain",
          confidence: 0.94,
        },
        camera_motion: {
          choice: "punch-in",
          confidence: 0.91,
        },
        card_badge: {
          choice: "THE WINNER",
          confidence: 0.88,
        },
        is_punchline: {
          noul: 0.95,
        },
      },
    }),
  });

  const evaluation = await evaluateMugsySentenceDirector("A format packages the creative rules needed to repeat it.", {
    apiKey: "mock-key",
    fetchFn: mockFetch,
    beatContext: {
      beatIndex: 4,
      totalBeats: 15,
      lessonIndex: 0,
      leftLabel: "PROMPT",
      rightLabel: "FORMAT",
      role: "explain_b",
      recentPoses: ["point-right"],
    },
  });

  assert.ok(evaluation);
  assert.equal(evaluation.mugsyPose, "coffee-explain");
  assert.equal(evaluation.cameraMotion, "punch-in");
  assert.equal(evaluation.badge, "THE WINNER");
  assert.equal(evaluation.isPunchline, true);
  assert.equal(evaluation.provenance, "jev-systemone");
});

test("evaluateMugsySentenceDirector enforces variety guardrail against duplicate consecutive pose", async () => {
  // If Jev suggests 'point-left', but the last pose was ALSO 'point-left', variety guardrail must switch to alternate pose
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-latest",
      answers: {
        mugsy_pose: {
          choice: "point-left",
          confidence: 0.95,
        },
        camera_motion: {
          choice: "zoom-left",
          confidence: 0.9,
        },
        card_badge: {
          choice: "HEAD TO HEAD",
          confidence: 0.9,
        },
        is_punchline: {
          noul: 0.1,
        },
      },
    }),
  });

  const evaluation = await evaluateMugsySentenceDirector("This is another prompt.", {
    apiKey: "mock-key",
    fetchFn: mockFetch,
    beatContext: {
      beatIndex: 1,
      totalBeats: 15,
      lessonIndex: 0,
      role: "a",
      recentPoses: ["point-left"], // identical to Jev choice
    },
  });

  assert.ok(evaluation);
  assert.notEqual(evaluation.mugsyPose, "point-left", "Must not repeat the exact same pose consecutively");
  assert.ok(VALID_MUGSY_POSES.includes(evaluation.mugsyPose), "Must choose an alternate valid Mugsy pose");
});

test("planMugsyDeterministic ensures pose variety across all 5 roles", () => {
  const roles = ["a", "b", "question", "explain_a", "explain_b"];
  const recent = [];

  for (let i = 0; i < roles.length; i += 1) {
    const role = roles[i];
    const plan = planMugsyDeterministic(`Sentence for ${role}`, {
      beatContext: { role, recentPoses: [...recent] },
    });

    assert.ok(VALID_MUGSY_POSES.includes(plan.mugsyPose));
    assert.ok(VALID_CAMERA_MOTIONS.includes(plan.cameraMotion));
    assert.ok(VALID_BADGES.includes(plan.badge));

    if (recent.length > 0) {
      assert.notEqual(
        plan.mugsyPose,
        recent[0],
        `Pose ${plan.mugsyPose} repeated consecutively for role ${role}`
      );
    }
    recent.unshift(plan.mugsyPose);
  }
});

test("directMugsyContent directs all 15 sentences of content.json in dry-run mode", async () => {
  const content = JSON.parse(readFileSync(contentJsonPath, "utf8"));
  assert.equal(content.lessons?.length, 3, "content.json should have 3 lessons");

  const plan = await directMugsyContent(content, {
    dryRun: true,
    logger: null,
  });

  assert.equal(plan.version, "1.0");
  assert.equal(plan.director, "deterministic-variety-planner");
  assert.equal(plan.totalBeats, 15);
  assert.equal(plan.beats.length, 15);

  // Check no consecutive identical poses across all 15 beats
  for (let i = 0; i < plan.beats.length; i += 1) {
    const beat = plan.beats[i];
    assert.ok(VALID_MUGSY_POSES.includes(beat.mugsyPose), `Invalid pose at beat ${i}: ${beat.mugsyPose}`);
    assert.ok(VALID_CAMERA_MOTIONS.includes(beat.cameraMotion), `Invalid camera motion at beat ${i}`);
    assert.ok(VALID_BADGES.includes(beat.badge), `Invalid badge at beat ${i}`);

    if (i > 0) {
      const prevBeat = plan.beats[i - 1];
      assert.notEqual(
        beat.mugsyPose,
        prevBeat.mugsyPose,
        `Beats ${i - 1} and ${i} have identical consecutive pose: ${beat.mugsyPose}`
      );
    }
  }
});

test("requirements.json declares Typesafe / Jev System One with TYPESAFE_API_KEY", () => {
  const rawRequirements = readFileSync(path.join(rootDir, "requirements.json"), "utf8");
  assert.doesNotMatch(rawRequirements, /type_[a-zA-Z0-9]{20,}/, "No real secrets in requirements.json");

  const requirements = JSON.parse(rawRequirements);
  const jevProvider = requirements.providers?.find((p) => p.name?.includes("Jev"));
  assert.ok(jevProvider, "requirements.json must declare Typesafe / Jev System One");
  assert.ok(
    jevProvider.environmentVariables?.includes("TYPESAFE_API_KEY"),
    "Jev provider must require TYPESAFE_API_KEY"
  );
  assert.equal(jevProvider.optional, false, "Jev Director is a required choreography provider");
});

test("package.json declares direct and test scripts", () => {
  const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  assert.equal(pkg.scripts?.direct, "node runtime/direct.mjs content.json");
  assert.ok(pkg.scripts?.test, "package.json must declare a test script");
});
