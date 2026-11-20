import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { doesPoseReachEnterRect, loadGestureReachData, scanRectAlphaOverlap } from "../runtime/gesture-reach.mjs";
import { inspectMultiShotSpacing } from "../runtime/inspect-run.mjs";
import { deriveMultiShotPlan, deriveMultiShotPlanWithJev } from "../runtime/multi-shot-timeline.mjs";
import { OTS_GRAPHIC_ZONE, OTS_HEADLINE_BOX, renderOtsCardFrame } from "../runtime/ots-card-renderer.mjs";
import { createPoseRuntime } from "../runtime/pose-recipe.mjs";
import { PERFORMANCE_STAGE_VIEW } from "../runtime/render-sequence.mjs";
import { loadPoseRegistry } from "../runtime/run-common.mjs";
import { loadManifest, renderRigFrame } from "../runtime/rig-v2-renderer.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("renderOtsCardFrame renders headline scrim at the top edge and leaves bottom strip unscrimmed", async () => {
  const plainCard = await renderOtsCardFrame({
    headline: "",
    width: OTS_GRAPHIC_ZONE.width,
    height: OTS_GRAPHIC_ZONE.height,
    entranceFrame: 10,
  });
  const headlinedCard = await renderOtsCardFrame({
    headline: "NINTENDO SWITCH 2 UPDATE",
    width: OTS_GRAPHIC_ZONE.width,
    height: OTS_GRAPHIC_ZONE.height,
    entranceFrame: 10,
  });

  const plain = await sharp(plainCard).raw().toBuffer({ resolveWithObject: true });
  const top = await sharp(headlinedCard).raw().toBuffer({ resolveWithObject: true });

  // Measure brightness delta in top band (y=12..78) vs bottom band (y=height-70..height-14)
  let topDelta = 0;
  let bottomDelta = 0;
  const w = top.info.width;
  const h = top.info.height;
  for (let y = 12; y < 78; y += 1) {
    for (let x = 20; x < 280; x += 1) {
      const idx = (y * w + x) * 4;
      topDelta += Math.abs(top.data[idx] - plain.data[idx]);
    }
  }
  for (let y = h - 70; y < h - 14; y += 1) {
    for (let x = 20; x < w - 20; x += 1) {
      const idx = (y * w + x) * 4;
      bottomDelta += Math.abs(top.data[idx] - plain.data[idx]);
    }
  }

  assert.ok(topDelta > 50_000, `expected top headline & scrim delta > 50000, got ${topDelta}`);
  assert.equal(bottomDelta, 0, `expected bottom scrim completely removed (delta=0), got ${bottomDelta}`);
});

test("multi-shot planner skips OTS headline cards on overlapping poses like aha/point while allowing clear poses", async () => {
  const reachData = await loadGestureReachData(KIT_ROOT);
  assert.equal(doesPoseReachEnterRect(reachData.poses.aha, OTS_HEADLINE_BOX, { padding: 16 }), true);
  assert.equal(doesPoseReachEnterRect(reachData.poses.present, OTS_HEADLINE_BOX, { padding: 16 }), false);
  assert.equal(doesPoseReachEnterRect(reachData.poses["neutral-listening"], OTS_HEADLINE_BOX, { padding: 16 }), false);

  const words = [];
  for (let i = 0; i < 6; i += 1) {
    words.push(
      { id: `w${i * 3 + 1}`, text: "Sentence", startMs: i * 1600, endMs: i * 1600 + 300 },
      { id: `w${i * 3 + 2}`, text: "number", startMs: i * 1600 + 310, endMs: i * 1600 + 600 },
      { id: `w${i * 3 + 3}`, text: `${i + 1}.`, startMs: i * 1600 + 610, endMs: i * 1600 + 950 },
    );
  }
  const transcript = { text: words.map((w) => w.text).join(" "), words };

  // Force Jev to always pick `aha`: no shot may emit an overlapping otsGraphic
  const ahaPlan = await deriveMultiShotPlanWithJev({
    transcript,
    audioDurationSeconds: 10.0,
    brollMediaList: ["media/a.png", "media/b.png"],
    apiKey: "test-key",
    fetchFn: async () => ({
      ok: true,
      json: async () => ({
        answers: {
          shot_type: { choice: "talk-to-camera" },
          shaz_puppet_pose: { choice: "aha" },
          chibi_pose: { choice: "talk-gesture" },
          camera_motion: { choice: "zoom-in" },
          badge_category: { choice: "BREAKING" },
          is_punchline: { noul: 0.1 },
        },
      }),
    }),
  });
  const ahaWithOts = ahaPlan.shots.filter((s) => s.shotType === "talk-to-camera" && s.poseId === "aha" && s.otsGraphic);
  assert.equal(ahaWithOts.length, 0, "overlapping pose aha must never carry an OTS headline card");

  const detPlan = deriveMultiShotPlan({
    transcript,
    audioDurationSeconds: 10.0,
    brollMediaList: ["media/a.png", "media/b.png"],
  });
  const detBlockedOts = detPlan.shots.filter(
    (s) => s.shotType === "talk-to-camera" && s.otsGraphic?.headline && doesPoseReachEnterRect(reachData.poses?.[s.poseId], OTS_HEADLINE_BOX, { padding: 16 }),
  );
  assert.equal(detBlockedOts.length, 0);
});

test("live rendered puppet pixels inside OTS_HEADLINE_BOX are 0 for present/neutral-listening and > 0 for aha", async () => {
  const manifest = await loadManifest(path.join(KIT_ROOT, "rig-v2", "runtime.json"));
  const assetRoot = path.join(KIT_ROOT, "rig-v2", "assets");
  const propRoot = path.join(KIT_ROOT, "assets", "props");
  const assetCache = new Map();
  const propCache = new Map();

  for (const [poseId, expectZero] of [["neutral-listening", true], ["present", true], ["aha", false]]) {
    const recipe = JSON.parse(
      await (await import("node:fs/promises")).readFile(path.join(KIT_ROOT, "poses", "authored", `${poseId}.json`), "utf8"),
    );
    const runtime = createPoseRuntime(manifest, recipe);
    let maxPx = 0;
    for (let f = 1; f <= (recipe.durationFrames || 1); f += 1) {
      const rendered = await renderRigFrame({
        manifest,
        frame: f,
        assetRoot,
        propRoot,
        assetCache,
        propCache,
        poseRuntime: runtime,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        stageView: PERFORMANCE_STAGE_VIEW,
      });
      const { data, info } = await sharp(rendered.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const px = scanRectAlphaOverlap(data, info.width, info.height, OTS_HEADLINE_BOX, { padding: 8 });
      if (px > maxPx) maxPx = px;
      if (!expectZero && maxPx > 0) break;
    }
    if (expectZero) {
      assert.equal(maxPx, 0, `expected 0 overlap pixels in OTS_HEADLINE_BOX for ${poseId}, got ${maxPx}`);
    } else {
      assert.ok(maxPx > 0, `expected > 0 overlap pixels in OTS_HEADLINE_BOX for ${poseId}`);
    }
  }
});

test("inspectMultiShotSpacing fails loudly on puppet-headline overlap and passes clear shots", async () => {
  const manifest = await loadManifest(path.join(KIT_ROOT, "rig-v2", "runtime.json"));
  const registry = await loadPoseRegistry(KIT_ROOT, manifest);

  const overlapping = await inspectMultiShotSpacing({
    root: KIT_ROOT,
    validated: {
      manifest,
      registry,
      timeline: {
        shots: [
          { id: "shot-01", shotType: "talk-to-camera", poseId: "aha", otsGraphic: { headline: "TEST HEADLINE" } },
          { id: "shot-02", shotType: "talk-to-camera", poseId: "shrug" },
        ],
      },
    },
  });
  assert.ok(overlapping.failures.some((f) => /ots headline overlaps puppet pose aha/i.test(f)));
  assert.ok(overlapping.spacingChecks[0].maxHeadlineOverlapPixels > 0);

  const clear = await inspectMultiShotSpacing({
    root: KIT_ROOT,
    validated: {
      manifest,
      registry,
      timeline: {
        shots: [
          { id: "shot-01", shotType: "talk-to-camera", poseId: "present", otsGraphic: { headline: "CLEAR HEADLINE" } },
          { id: "shot-02", shotType: "talk-to-camera", poseId: "confident", otsGraphic: { headline: "CLEAR HEADLINE" } },
          { id: "shot-03", shotType: "talk-to-camera", poseId: "neutral-listening", otsGraphic: { headline: "CLEAR HEADLINE" } },
        ],
      },
    },
  });
  assert.deepEqual(clear.failures, []);
  assert.equal(clear.spacingChecks.length, 3);
  assert.ok(clear.spacingChecks.every((c) => c.maxHeadlineOverlapPixels === 0 && c.reachHitsHeadline === false));
});
