import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { renderOtsCardFrame } from "../runtime/ots-card-renderer.mjs";

test("OTS card renderer never renders red sticker tag or badge pill at the root", async () => {
  // Test with explicit badge passed
  const buffer = await renderOtsCardFrame({
    badge: "THE TARGET",
    headline: "Whoop 4.0 Screenless Band",
    width: 440,
    height: 440,
    entranceFrame: 10,
  });

  assert.ok(buffer instanceof Buffer, "Should return buffer");
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.width, 440);
  assert.equal(metadata.height, 440);

  // Sample the area where the red sticker pill used to be (x: 20-100, y: 20-40)
  // Ensure no red pill pixels (#ef4444: rgb(239, 68, 68)) exist
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  let foundRedStickerPixel = false;
  // Check top-left quadrant (x: 10..150, y: 10..50)
  for (let y = 10; y < 50; y += 1) {
    for (let x = 10; x < 150; x += 1) {
      const idx = (y * info.width + x) * info.channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // #ef4444 has high red (~239) and lower green/blue (~68)
      if (r > 200 && g < 100 && b < 100) {
        foundRedStickerPixel = true;
        break;
      }
    }
    if (foundRedStickerPixel) break;
  }

  assert.equal(
    foundRedStickerPixel,
    false,
    "Guardrail: Red tag / sticker pill must never be rendered on OTS graphic cards",
  );
});

test("OTS card renders clean hero media without badge overlays when image provided", async () => {
  const dummyImage = await sharp({
    create: {
      width: 428,
      height: 428,
      channels: 4,
      background: { r: 50, g: 100, b: 150, alpha: 255 },
    },
  }).png().toBuffer();

  const buffer = await renderOtsCardFrame({
    image: dummyImage,
    headline: "TEST HEADLINE",
    width: 440,
    height: 440,
    entranceFrame: 10,
  });

  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.width, 440);
  assert.equal(metadata.height, 440);
});
