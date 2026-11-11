import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import {
  isLightCutout,
  stageProductShowcaseCard,
  stageScenicNon16x9,
  normalizeBrollMedia,
  calculateKenBurnsCrop,
  renderKenBurnsFrame,
} from "../runtime/broll-renderer.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("isLightCutout distinguishes white/light backdrops from scenic imagery", async () => {
  // 1. Synthetic white product cutout (e.g. 800x800 with white background and centered dark box)
  const whiteCutout = await sharp({
    create: {
      width: 800,
      height: 800,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 300,
            height: 300,
            channels: 4,
            background: { r: 20, g: 20, b: 20, alpha: 1 },
          },
        }).png().toBuffer(),
        left: 250,
        top: 250,
      },
    ])
    .png()
    .toBuffer();

  const isCutout = await isLightCutout(whiteCutout);
  assert.equal(isCutout, true, "White background cutout must be detected as light cutout");

  // 2. Real scenic background
  const bgPath = path.join(root, "assets", "backgrounds", "living-room.png");
  const bgBuffer = await fs.readFile(bgPath);
  const isBgCutout = await isLightCutout(bgBuffer);
  assert.equal(isBgCutout, false, "Scenic environment background must not be classified as cutout");
});

test("stageProductShowcaseCard stages product cutout onto 1280x720 card with dark gradient", async () => {
  const whiteCutout = await sharp({
    create: {
      width: 600,
      height: 600,
      channels: 4,
      background: { r: 250, g: 250, b: 250, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 200,
            height: 350,
            channels: 4,
            background: { r: 10, g: 10, b: 80, alpha: 1 },
          },
        }).png().toBuffer(),
        left: 200,
        top: 125,
      },
    ])
    .png()
    .toBuffer();

  const staged = await stageProductShowcaseCard(whiteCutout);
  assert.ok(Buffer.isBuffer(staged));

  const meta = await sharp(staged).metadata();
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 720);
  assert.equal(meta.format, "png");
});

test("stageScenicNon16x9 stages square image onto 1280x720 blurred background", async () => {
  const squareScenic = await sharp({
    create: {
      width: 500,
      height: 500,
      channels: 4,
      background: { r: 120, g: 80, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const staged = await stageScenicNon16x9(squareScenic);
  assert.ok(Buffer.isBuffer(staged));

  const meta = await sharp(staged).metadata();
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 720);
});

test("normalizeBrollMedia standardizes diverse aspect ratios and cutouts to 1280x720", async () => {
  // Test native 16:9
  const native16x9 = await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 3,
      background: { r: 40, g: 50, b: 60 },
    },
  })
    .png()
    .toBuffer();

  const norm16x9 = await normalizeBrollMedia(native16x9);
  const meta1 = await sharp(norm16x9).metadata();
  assert.equal(meta1.width, 1280);
  assert.equal(meta1.height, 720);

  // Test 1:1 square cutout
  const squareCutout = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const normCutout = await normalizeBrollMedia(squareCutout);
  const meta2 = await sharp(normCutout).metadata();
  assert.equal(meta2.width, 1280);
  assert.equal(meta2.height, 720);
});
