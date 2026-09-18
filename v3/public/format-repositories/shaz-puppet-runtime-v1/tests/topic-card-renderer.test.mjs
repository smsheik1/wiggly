import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderTopicCard, buildTopicCardSvg, TOPIC_THEMES, TOPIC_ICONS } from "../runtime/topic-card-renderer.mjs";

test("buildTopicCardSvg emits valid svg with theme and icon", () => {
  const svg = buildTopicCardSvg({
    badge: "TEST BADGE",
    headline: "TEST HEADLINE",
    quote: "Test Quote",
    theme: "cold-blue",
    icon: "puppy",
  });
  assert.match(svg, /TEST BADGE/);
  assert.match(svg, /TEST HEADLINE/);
  assert.match(svg, /Test Quote/);
  assert.match(svg, /#0077b6/);
});

test("renderTopicCard renders valid 1280x720 png buffer", async () => {
  const buffer = await renderTopicCard({
    badge: "PUPPY TALK",
    headline: "HAVING A PUPPY",
    quote: "Harder than it looks!",
    theme: "emerald-green",
    icon: "trophy",
  });
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 720);
  assert.equal(metadata.format, "png");
});

test("renderTopicCard composites optional inner image", async () => {
  const innerImg = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  }).png().toBuffer();

  const buffer = await renderTopicCard({
    badge: "INNER IMAGE TEST",
    headline: "WITH PHOTO",
    quote: "Testing inner photo compositing",
    theme: "deep-purple",
    innerImageBuffer: innerImg,
  });
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.width, 1280);
  assert.equal(metadata.height, 720);
});
