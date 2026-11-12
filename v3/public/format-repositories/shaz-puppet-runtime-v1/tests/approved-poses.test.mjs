import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_SHAZ_PUPPET_POSES,
  evaluateSentenceDirector,
  JevDirectorSkipError,
} from "../runtime/director-jev.mjs";
import {
  deriveMultiShotPlan,
  deriveMultiShotPlanWithJev,
  resolvePuppetPoseId,
  validateMultiShotPlan,
} from "../runtime/multi-shot-timeline.mjs";
import {
  getApprovedPerformancePoses,
  isPoseApprovedForPerformance,
  loadPerformanceApprovalsSync,
} from "../runtime/pose-approvals.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNAPPROVED_POSES = ["shrug", "key-point", "excited-celebration", "point-at-screen", "chin-stroke-swagger"];
const EXPECTED_APPROVED = ["neutral-listening", "present", "think", "aha", "point", "confident"];

test("performance-approvals.json exposes only the 6 base approved poses and binds SHA-256 hashes", () => {
  const manifest = loadPerformanceApprovalsSync({ root: KIT_ROOT });
  assert.deepEqual(manifest.approvedPoseIds, EXPECTED_APPROVED);
  assert.deepEqual(getApprovedPerformancePoses({ root: KIT_ROOT }), EXPECTED_APPROVED);
  assert.deepEqual([...ALLOWED_SHAZ_PUPPET_POSES], EXPECTED_APPROVED);

  for (const id of EXPECTED_APPROVED) {
    assert.equal(isPoseApprovedForPerformance(id), true, `expected ${id} approved`);
  }
  for (const id of UNAPPROVED_POSES) {
    assert.equal(isPoseApprovedForPerformance(id), false, `expected ${id} NOT approved`);
  }
});

test("loadPerformanceApprovalsSync throws loudly when an approved pose recipe checksum mismatches", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-pose-approvals-"));
  try {
    const index = JSON.parse(await fs.readFile(path.join(KIT_ROOT, "poses", "index.json"), "utf8"));
    const approvals = JSON.parse(await fs.readFile(path.join(KIT_ROOT, "poses", "performance-approvals.json"), "utf8"));
    approvals.poses[0].recipeSha256 = "0".repeat(64);

    const tmpIndexPath = path.join(tmpDir, "index.json");
    const tmpApprovalsPath = path.join(tmpDir, "performance-approvals.json");
    await fs.writeFile(tmpIndexPath, JSON.stringify(index, null, 2));
    await fs.writeFile(tmpApprovalsPath, JSON.stringify(approvals, null, 2));

    assert.throws(
      () => loadPerformanceApprovalsSync({ approvalsPath: tmpApprovalsPath, indexPath: tmpIndexPath }),
      /recipeSha256 mismatch/i,
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("evaluateSentenceDirector advertises only approved poses and rejects unapproved pose choices", async () => {
  let capturedCriteria = null;
  await assert.rejects(
    async () =>
      evaluateSentenceDirector("They really tried selling that for five hundred dollars.", {
        apiKey: "mock-key",
        beatContext: { beatIndex: 1, totalBeats: 4, recentPoses: [] },
        fetchFn: async (_url, init) => {
          const body = JSON.parse(init.body);
          capturedCriteria = Object.keys(body.questions.shaz_puppet_pose.criteria);
          return {
            ok: true,
            json: async () => ({
              answers: {
                shot_type: { choice: "talk-to-camera", confidence: 0.9 },
                shaz_puppet_pose: { choice: "shrug", confidence: 0.9 },
                chibi_pose: { choice: "think-chin", confidence: 0.8 },
                camera_motion: { choice: "zoom-in", confidence: 0.8 },
                badge_category: { choice: "REALITY CHECK", confidence: 0.8 },
                is_punchline: { noul: 0.2 },
              },
            }),
          };
        },
      }),
    (err) => err instanceof JevDirectorSkipError && /shaz_puppet_pose/i.test(err.message),
  );

  assert.deepEqual(capturedCriteria, EXPECTED_APPROVED);
  for (const unapproved of [...UNAPPROVED_POSES, "chin-stroke"]) {
    assert.ok(!capturedCriteria.includes(unapproved), `unapproved pose ${unapproved} must not appear in Jev criteria`);
  }
});

test("deriveMultiShotPlan and deriveMultiShotPlanWithJev never emit unapproved poses", async () => {
  const words = [];
  for (let i = 0; i < 6; i += 1) {
    words.push(
      { text: "Topic", startMs: i * 1800, endMs: i * 1800 + 500 },
      { text: "beat", startMs: i * 1800 + 550, endMs: i * 1800 + 1000 },
      { text: `number${i + 1}.`, startMs: i * 1800 + 1050, endMs: i * 1800 + 1600 },
    );
  }
  const transcript = { text: words.map((w) => w.text).join(" "), words };

  const deterministic = deriveMultiShotPlan({
    transcript,
    audioDurationSeconds: 11,
    defaultBackgroundId: "living-room",
    brollMediaList: [],
  });
  for (const shot of deterministic.shots.filter((s) => s.shotType === "talk-to-camera")) {
    assert.ok(EXPECTED_APPROVED.includes(shot.poseId), `unexpected unapproved pose ${shot.poseId}`);
  }

  let idx = 0;
  const approvedCycle = ["present", "think", "aha", "point", "confident", "neutral-listening"];
  const jevPlan = await deriveMultiShotPlanWithJev({
    transcript,
    audioDurationSeconds: 11,
    defaultBackgroundId: "living-room",
    apiKey: "mock-key",
    fetchFn: async () => {
      const choice = approvedCycle[idx % approvedCycle.length];
      idx += 1;
      return {
        ok: true,
        json: async () => ({
          answers: {
            shot_type: { choice: "talk-to-camera", confidence: 0.9 },
            shaz_puppet_pose: { choice, confidence: 0.9 },
            chibi_pose: { choice: "present-card", confidence: 0.8 },
            camera_motion: { choice: "zoom-in", confidence: 0.8 },
            badge_category: { choice: "REALITY CHECK", confidence: 0.8 },
            is_punchline: { noul: 0.1 },
          },
        }),
      };
    },
  });
  for (const shot of jevPlan.shots.filter((s) => s.shotType === "talk-to-camera")) {
    assert.ok(EXPECTED_APPROVED.includes(shot.poseId), `unexpected Jev pose ${shot.poseId}`);
  }
});

test("resolvePuppetPoseId removes silent pose swaps and validateMultiShotPlan enforces approval unless explicitly opted in", async () => {
  assert.equal(resolvePuppetPoseId("facepalm"), "facepalm");
  assert.equal(resolvePuppetPoseId("arms-crossed"), "arms-crossed");
  assert.equal(resolvePuppetPoseId("phone-use-sequence"), "phone-use-sequence");
  assert.equal(resolvePuppetPoseId("chin-stroke"), "chin-stroke");

  const assets = JSON.parse(await fs.readFile(path.join(KIT_ROOT, "assets.json"), "utf8"));
  const poseIndex = JSON.parse(await fs.readFile(path.join(KIT_ROOT, "poses", "index.json"), "utf8"));
  const poseRegistry = { byId: new Map(poseIndex.poses.map((p) => [p.id, p])) };
  const basePlan = {
    schemaVersion: "shaz-multi-shot-v1",
    title: "Approval check",
    audioFile: "user-audio.wav",
    totalDurationFrames: 48,
    shots: [
      {
        id: "shot-01",
        shotType: "talk-to-camera",
        poseId: "shrug",
        startFrame: 0,
        endFrameExclusive: 48,
        backgroundId: "sisters-room",
      },
    ],
  };

  assert.throws(
    () => validateMultiShotPlan(basePlan, { audioDurationSeconds: 2.0, defaultBackgroundId: "sisters-room", assets, poseRegistry }),
    /not approved/i,
  );

  const optedIn = validateMultiShotPlan(basePlan, {
    audioDurationSeconds: 2.0,
    defaultBackgroundId: "sisters-room",
    assets,
    poseRegistry,
    allowUnapprovedPoses: true,
  });
  assert.equal(optedIn.shots[0].poseId, "shrug");
});
