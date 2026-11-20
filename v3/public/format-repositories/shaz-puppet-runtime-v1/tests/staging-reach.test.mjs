import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { doesPoseReachEnterRect, loadGestureReachData, scanRgbaReach } from "../runtime/gesture-reach.mjs";
import { getStreamerStudioForegroundBuffer } from "../runtime/studio-staging.mjs";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPROVED_BASE_POSES = ["neutral-listening", "present", "think", "aha", "point", "confident"];

test("gesture-reach.json matches registered pose SHA-256s and all base poses clear the boom mic by >= 24px", async () => {
  const reachData = await loadGestureReachData(KIT_ROOT);
  const index = JSON.parse(await fs.readFile(path.join(KIT_ROOT, "poses", "index.json"), "utf8"));

  const fgPng = await getStreamerStudioForegroundBuffer();
  const { data: fgRaw, info } = await sharp(fgPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const micMask = Buffer.from(fgRaw);
  for (let y = 658; y < info.height; y += 1) {
    micMask.fill(0, y * info.width * 4, (y + 1) * info.width * 4);
  }
  const liveMicBox = scanRgbaReach(micMask, info.width, info.height).aboveDesk;
  assert.ok(liveMicBox, "live studio boom mic must be measurable above desk line");
  assert.ok(liveMicBox.minX >= 1192, `boom mic left edge (${liveMicBox.minX}) must sit >= 1192 on lower-right edge`);

  for (const entry of index.poses) {
    const rawRecipe = await fs.readFile(path.join(KIT_ROOT, "poses", entry.path), "utf8");
    const actualSha = crypto.createHash("sha256").update(rawRecipe).digest("hex");
    const recorded = reachData.poses?.[entry.id];
    assert.ok(recorded, `gesture-reach.json missing entry for pose ${entry.id}`);
    assert.equal(recorded.recipeSha256, actualSha, `gesture-reach.json SHA mismatch for pose ${entry.id}`);
  }

  for (const poseId of APPROVED_BASE_POSES) {
    const reach = reachData.poses[poseId];
    assert.ok(reach.aboveDesk, `pose ${poseId} must have measured aboveDesk box`);
    const gapPx = liveMicBox.minX - reach.aboveDesk.maxX;
    assert.ok(gapPx >= 24, `pose ${poseId} maxX=${reach.aboveDesk.maxX} leaves only ${gapPx}px before mic minX=${liveMicBox.minX} (require >= 24px)`);
    assert.equal(doesPoseReachEnterRect(reach, liveMicBox, { padding: 16 }), false);
  }
});
