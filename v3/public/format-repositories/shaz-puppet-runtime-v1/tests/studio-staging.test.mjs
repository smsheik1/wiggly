import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import {
  generateStreamerStudioForegroundSvg,
  generateCinematicVignetteSvg,
  getStreamerStudioForegroundBuffer,
  getCinematicVignetteBuffer,
} from "../runtime/studio-staging.mjs";

test("generateStreamerStudioForegroundSvg produces valid SVG structure", () => {
  const svg = generateStreamerStudioForegroundSvg({ width: 1280, height: 720 });
  assert.ok(svg.includes("<svg width=\"1280\" height=\"720\""));
  assert.ok(svg.includes("id=\"desk-layer\""));
  assert.ok(svg.includes("id=\"streamer-mic\""));
  assert.ok(svg.includes("stroke=\"#00F0FF\"")); // Ambient LED underglow
});

test("generateCinematicVignetteSvg produces valid radial vignette SVG", () => {
  const svg = generateCinematicVignetteSvg({ width: 1280, height: 720 });
  assert.ok(svg.includes("<svg width=\"1280\" height=\"720\""));
  assert.ok(svg.includes("id=\"vignette\""));
  assert.ok(svg.includes("<radialGradient"));
});

test("getStreamerStudioForegroundBuffer returns 1280x720 PNG buffer with transparency", async () => {
  const buffer = await getStreamerStudioForegroundBuffer({ width: 1280, height: 720 });
  assert.ok(Buffer.isBuffer(buffer));

  const meta = await sharp(buffer).metadata();
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 720);
  assert.equal(meta.format, "png");
  assert.equal(meta.hasAlpha, true);

  // Top area above desk must be transparent
  const topSliceBuffer = await sharp(buffer)
    .extract({ left: 100, top: 100, width: 200, height: 200 })
    .png()
    .toBuffer();
  const topSlice = await sharp(topSliceBuffer).stats();
  assert.equal(topSlice.isOpaque, false);
  assert.equal(topSlice.channels[3].mean, 0, "Upper region must be completely transparent for character visibility");
});

test("getCinematicVignetteBuffer returns 1280x720 PNG buffer with alpha depth", async () => {
  const buffer = await getCinematicVignetteBuffer({ width: 1280, height: 720 });
  assert.ok(Buffer.isBuffer(buffer));

  const meta = await sharp(buffer).metadata();
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 720);
  assert.equal(meta.format, "png");
  assert.equal(meta.hasAlpha, true);
});
