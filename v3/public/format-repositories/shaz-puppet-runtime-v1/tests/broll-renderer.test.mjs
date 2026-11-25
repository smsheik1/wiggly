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
  calculateKenBurnsWindow,
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

// 2026-11-25 shaky zoom bug: each Ken Burns frame was cropped at whole source
// pixels with width and height rounded on their own, so the picture's center
// hopped ~0.5px back and forth while the zoom itself only moved ~1.3px a frame.
// That reads as an unsteady handheld camera. Track a small dot through a real
// rendered zoom and require its path to be smooth.
async function dotCentroid(png) {
  const { data, info } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const v = data[y * info.width + x];
      if (v > 0) {
        sum += v;
        sx += x * v;
        sy += y * v;
      }
    }
  }
  return { x: sx / sum, y: sy / sum };
}

for (const motion of ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"]) {
  test(`Ken Burns ${motion} moves smoothly with no frame-to-frame shake`, async () => {
    const sourceBuffer = await sharp({
      create: { width: 1280, height: 720, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 255, b: 255 } },
          }).png().toBuffer(),
          left: 930,
          top: 510,
        },
      ])
      .png()
      .toBuffer();

    const durationFrames = 48;
    const points = [];
    for (let f = 0; f < durationFrames; f += 1) {
      const frame = await renderKenBurnsFrame({ sourceBuffer, motion, localFrame: f, durationFrames });
      points.push(await dotCentroid(frame));
    }

    // Second difference = change in velocity. A steady camera keeps it near 0;
    // the old whole-pixel crop produced jolts of 0.5px and more.
    let worst = 0;
    for (let i = 1; i < points.length - 1; i += 1) {
      const ax = points[i + 1].x - 2 * points[i].x + points[i - 1].x;
      const ay = points[i + 1].y - 2 * points[i].y + points[i - 1].y;
      worst = Math.max(worst, Math.abs(ax), Math.abs(ay));
    }
    assert.ok(worst < 0.2, `${motion} shakes: worst frame-to-frame jolt ${worst.toFixed(3)}px (must be < 0.2px)`);
  });
}

test("calculateKenBurnsWindow is exact: centered, 16:9, never rounded to whole pixels", () => {
  for (let f = 0; f <= 60; f += 1) {
    const view = calculateKenBurnsWindow({ motion: "zoom-in", progress: f / 60 });
    assert.ok(Math.abs(view.left + view.width / 2 - 640) < 1e-9, `frame ${f} center x ${view.left + view.width / 2}`);
    assert.ok(Math.abs(view.top + view.height / 2 - 360) < 1e-9, `frame ${f} center y ${view.top + view.height / 2}`);
    assert.ok(Math.abs(view.width / view.height - 16 / 9) < 1e-9, `frame ${f} aspect ${view.width}x${view.height}`);
  }
});
