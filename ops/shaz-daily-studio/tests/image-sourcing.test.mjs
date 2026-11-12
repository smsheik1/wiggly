import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import { extractArticleFromHtml } from "../article-fetch.mjs";
import { USER_AGENT as STUDIO_USER_AGENT } from "../article-fetch.mjs";
import { CandidateSkipError, classifyRunError } from "../errors.mjs";
import {
  buildAuthorPrompt,
  buildTargetedImageQueries,
  computeImageDHash,
  computeTargetImageCount,
  dHashHammingDistance,
  measureAudioDurationSeconds,
  sourceStoryMedia,
} from "../studio-daily.mjs";
import { SerperApiError } from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/serper-search.mjs";

async function makeTestPng({ width = 800, height = 600, variant = 0 } = {}) {
  // Draw distinct stripes/patterns per variant so dHashes are clearly > 6 Hamming bits apart
  const stripeW = 40 + variant * 55;
  const rectX = (variant * 97) % Math.max(100, width - 220);
  const rectY = (variant * 71) % Math.max(100, height - 220);
  const bg = variant % 2 === 0 ? "#102a43" : "#3b0764";
  const accent = ["#f97316", "#22c55e", "#38bdf8", "#eab308", "#ec4899", "#a855f7", "#14b8a6", "#f43f5e"][variant % 8];
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${bg}"/>
    <rect x="${rectX}" y="${rectY}" width="200" height="180" fill="${accent}"/>
    <polygon points="0,${height} ${stripeW},0 ${stripeW + 120},${height}" fill="#ffffff" opacity="0.85"/>
    <circle cx="${width - 140 - (variant * 40) % 250}" cy="${120 + (variant * 35) % 200}" r="75" fill="#fde047"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function buildWavBuffer(durationSeconds = 30) {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const dataSize = Math.round(durationSeconds * byteRate);
  const buf = Buffer.alloc(44);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

test("extractArticleFromHtml extracts og:image, twitter:image, and article body imgs with resolved URLs while filtering icons", () => {
  const longPara = "Valve detailed its upcoming hardware revision with custom silicon and improved thermal design. ".repeat(14);
  const html = `<!doctype html>
    <html>
      <head>
        <title>Valve Hardware Update</title>
        <meta property="og:image" content="/assets/hero-banner.jpg" />
        <meta name="twitter:image" content="https://cdn.example.com/twitter-card.png" />
      </head>
      <body>
        <nav><img src="/icons/site-favicon.png" width="32" height="32" /></nav>
        <article>
          <h1>Valve Hardware Update</h1>
          <p>${longPara}</p>
          <img src="/media/in-body-shot.png" alt="Console close-up" width="1200" height="675" />
          <img src="https://cdn.example.com/avatar-author.jpg" width="80" height="80" />
          <img src="/images/badge.svg" />
          <img srcset="/media/small.png 400w, https://cdn.example.com/large-srcset.webp 1280w" alt="High res" />
        </article>
      </body>
    </html>`;

  const extracted = extractArticleFromHtml(html, "https://news.example.com/story/valve-update");
  assert.ok(extracted.text.length >= 800);
  const urls = extracted.images.map((i) => i.imageUrl);
  assert.equal(urls[0], "https://news.example.com/assets/hero-banner.jpg");
  assert.equal(urls.includes("https://cdn.example.com/twitter-card.png"), true);
  assert.equal(urls.includes("https://news.example.com/media/in-body-shot.png"), true);
  assert.equal(urls.includes("https://cdn.example.com/large-srcset.webp"), true);
  assert.equal(urls.some((u) => u.includes("favicon") || u.includes("avatar") || u.endsWith(".svg")), false);
});

test("computeTargetImageCount, measureAudioDurationSeconds, and buildAuthorPrompt target ~7-8 images on 30s runs", async () => {
  assert.equal(computeTargetImageCount(30), 8);
  assert.equal(computeTargetImageCount(28), 7);
  assert.equal(computeTargetImageCount(12), 5);
  assert.equal(computeTargetImageCount(60), 10);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-wav-dur-"));
  try {
    const wavPath = path.join(tmpDir, "test.wav");
    await fs.writeFile(wavPath, buildWavBuffer(29.2));
    const measured = await measureAudioDurationSeconds(wavPath, { dialogueText: "fallback words" });
    assert.ok(Math.abs(measured - 29.2) < 0.05);
    assert.equal(computeTargetImageCount(measured), 7);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  const prompt = buildAuthorPrompt({ title: "GTA 6 Map Rumor" });
  assert.equal(prompt.match(/"<exact /g)?.length >= 6, true, "buildAuthorPrompt should ask for 6-8 visualQueries");

  const queries = buildTargetedImageQueries("GTA 6", {
    visualQueries: ["q1 aaa", "q2 bbb", "q3 ccc", "q4 ddd", "q5 eee", "q6 fff", "q7 ggg"],
  });
  assert.equal(queries.length, 7, "must NOT truncate author queries at 3");
});

test("sourceStoryMedia prioritizes article images first, fills remaining with Serper, uses honest UA (no fake Referer), deduplicates via dHash, and writes media-sources.json", async () => {
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-media-stage-"));
  const articlePng1 = await makeTestPng({ width: 900, height: 600, variant: 0 });
  const articlePng2 = await makeTestPng({ width: 900, height: 600, variant: 1 });
  // Near-duplicate re-encoded version of variant 1 -> should be rejected by dHash
  const nearDupPng = await sharp(articlePng2).resize(880, 590).jpeg({ quality: 75 }).toBuffer();
  const tinyPng = await makeTestPng({ width: 320, height: 240, variant: 2 });
  const serperPngs = await Promise.all([2, 3, 4, 5, 6].map((v) => makeTestPng({ width: 1000, height: 640, variant: v })));

  // Verify test fixtures really obey dHash expectation
  const d0 = await computeImageDHash(articlePng2);
  const dDup = await computeImageDHash(nearDupPng);
  const dDistinct = await computeImageDHash(serperPngs[0]);
  assert.ok(dHashHammingDistance(d0, dDup) <= 6, `expected near-dup Hamming <= 6, got ${dHashHammingDistance(d0, dDup)}`);
  assert.ok(dHashHammingDistance(d0, dDistinct) > 6, `expected distinct Hamming > 6, got ${dHashHammingDistance(d0, dDistinct)}`);

  const seenHeaders = [];
  const fetchFn = async (url, init = {}) => {
    seenHeaders.push({ url, headers: init.headers || {} });
    const map = {
      "https://article.example.com/hero1.png": articlePng1,
      "https://article.example.com/tiny.png": tinyPng,
      "https://article.example.com/hero2.png": articlePng2,
      "https://serper.example.com/dup-of-hero2.jpg": nearDupPng,
      "https://serper.example.com/s1.png": serperPngs[0],
      "https://serper.example.com/s2.png": serperPngs[1],
      "https://serper.example.com/s3.png": serperPngs[2],
      "https://serper.example.com/s4.png": serperPngs[3],
      "https://serper.example.com/s5.png": serperPngs[4],
    };
    if (url === "https://article.example.com/html-error.png") {
      return new Response("<html>Not Found</html>", { status: 200, headers: { "content-type": "text/html" } });
    }
    const buf = map[url];
    if (!buf) return new Response("missing", { status: 404 });
    return new Response(buf, { status: 200, headers: { "content-type": "image/png" } });
  };

  let searchCallCount = 0;
  const searchFn = async () => {
    searchCallCount += 1;
    if (searchCallCount === 1) {
      return [
        { imageUrl: "https://serper.example.com/dup-of-hero2.jpg", domain: "serper.example.com", title: "dup", width: 880, height: 590 },
        { imageUrl: "https://serper.example.com/s1.png", domain: "serper.example.com", title: "s1", width: 1000, height: 640 },
        { imageUrl: "https://serper.example.com/s2.png", domain: "serper.example.com", title: "s2", width: 1000, height: 640 },
      ];
    }
    return [
      { imageUrl: "https://serper.example.com/s3.png", domain: "serper.example.com", title: "s3", width: 1000, height: 640 },
      { imageUrl: "https://serper.example.com/s4.png", domain: "serper.example.com", title: "s4", width: 1000, height: 640 },
      { imageUrl: "https://serper.example.com/s5.png", domain: "serper.example.com", title: "s5", width: 1000, height: 640 },
    ];
  };

  try {
    const seq = await sourceStoryMedia({
      topic: { title: "Switch 2 Revealed" },
      article: {
        url: "https://article.example.com/post",
        images: [
          { imageUrl: "https://article.example.com/hero1.png", pageUrl: "https://article.example.com/post", domain: "article.example.com" },
          { imageUrl: "https://article.example.com/tiny.png", pageUrl: "https://article.example.com/post", domain: "article.example.com" },
          { imageUrl: "https://article.example.com/html-error.png", pageUrl: "https://article.example.com/post", domain: "article.example.com" },
          { imageUrl: "https://article.example.com/hero2.png", pageUrl: "https://article.example.com/post", domain: "article.example.com" },
        ],
      },
      script: {
        title: "Switch 2 Revealed",
        targetDurationSeconds: 28,
        visualQueries: ["q1 switch", "q2 joycon", "q3 dock", "q4 screen", "q5 mario", "q6 nintendo"],
      },
      durationSeconds: 28,
      stageDir,
      searchFn,
      fetchFn,
    });

    assert.equal(seq.length, 7);
    assert.equal(new Set(seq).size, 7);
    assert.equal(seenHeaders.every((h) => h.headers["User-Agent"] === STUDIO_USER_AGENT), true);
    assert.equal(seenHeaders.some((h) => Boolean(h.headers.Referer)), false, "Must never spoof Google Referer");

    const receipt = JSON.parse(await fs.readFile(path.join(stageDir, "media-sources.json"), "utf8"));
    assert.equal(receipt.targetCount, 7);
    assert.equal(receipt.uniqueCount, 7);
    assert.equal(receipt.items[0].origin, "article");
    assert.equal(receipt.items[1].origin, "article");
    assert.equal(receipt.items[2].origin, "serper");
    assert.equal(receipt.items.some((i) => i.sourceUrl.includes("dup-of-hero2")), false, "dHash duplicate must be excluded");
    assert.ok(receipt.items.every((i) => i.width >= 600 && i.height >= 400 && i.sha256 && i.dhash && i.repeats === 0));
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
});

test("sourceStoryMedia spreads non-adjacent repeats when 2 <= unique < target and skips when < 2", async () => {
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-media-repeat-"));
  const imgA = await makeTestPng({ width: 800, height: 600, variant: 0 });
  const imgB = await makeTestPng({ width: 800, height: 600, variant: 3 });

  const fetchFn = async (url) => {
    if (url.endsWith("a.png")) return new Response(imgA, { status: 200, headers: { "content-type": "image/png" } });
    if (url.endsWith("b.png")) return new Response(imgB, { status: 200, headers: { "content-type": "image/png" } });
    return new Response("not found", { status: 404 });
  };

  try {
    const seq = await sourceStoryMedia({
      topic: { title: "Sparse Image Story" },
      article: {
        url: "https://article.example.com/sparse",
        images: [
          { imageUrl: "https://cdn.example.com/a.png", pageUrl: "https://article.example.com/sparse", domain: "cdn.example.com" },
          { imageUrl: "https://cdn.example.com/b.png", pageUrl: "https://article.example.com/sparse", domain: "cdn.example.com" },
        ],
      },
      script: { title: "Sparse Image Story", visualQueries: ["one query", "two query"] },
      durationSeconds: 30,
      stageDir,
      searchFn: async () => [],
      fetchFn,
    });

    assert.equal(seq.length, 8);
    assert.equal(new Set(seq).size, 2);
    for (let i = 1; i < seq.length; i += 1) {
      assert.notEqual(seq[i], seq[i - 1], `Repeated images must NEVER appear back-to-back at index ${i}`);
    }

    const receipt = JSON.parse(await fs.readFile(path.join(stageDir, "media-sources.json"), "utf8"));
    assert.equal(receipt.repeatsAllowed, true);
    assert.equal(receipt.items[0].repeats, 3);
    assert.equal(receipt.items[1].repeats, 3);

    // Fewer than 2 unique images -> CandidateSkipError
    await assert.rejects(
      () =>
        sourceStoryMedia({
          topic: { title: "Too Empty" },
          article: {
            url: "https://article.example.com/one",
            images: [{ imageUrl: "https://cdn.example.com/a.png", domain: "cdn.example.com" }],
          },
          script: { title: "Too Empty", visualQueries: ["one query", "two query"] },
          durationSeconds: 30,
          stageDir,
          searchFn: async () => [],
          fetchFn,
        }),
      (err) => err instanceof CandidateSkipError && err.stage === "media-sourcing",
    );

    // SerperApiError (e.g., 401/missing key) propagates loudly as RunStopError, not CandidateSkipError
    await assert.rejects(
      () =>
        sourceStoryMedia({
          topic: { title: "Serper Failure" },
          article: null,
          script: { title: "Serper Failure", visualQueries: ["one query", "two query"] },
          durationSeconds: 30,
          stageDir,
          searchFn: async () => {
            throw new SerperApiError("Serper missing key", { isAccountError: true });
          },
          fetchFn,
        }),
      (err) => err instanceof SerperApiError && classifyRunError(err).kind === "stop",
    );
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
});
