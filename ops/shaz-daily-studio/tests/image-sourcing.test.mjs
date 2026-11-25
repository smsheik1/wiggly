import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/sharp.mjs";

import { extractArticleFromHtml } from "../article-fetch.mjs";
import { USER_AGENT as STUDIO_USER_AGENT } from "../article-fetch.mjs";
import { CandidateSkipError, classifyRunError } from "../errors.mjs";
import {
  buildAuthorPrompt,
  buildTargetedImageQueries,
  computeImageDHash,
  computeTargetImageCount,
  copyOriginalMedia,
  dHashHammingDistance,
  ORIGINAL_MEDIA_DIR,
  PREFERRED_PHOTO_MIN_WIDTH,
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

// ---------------------------------------------------------------------------------------------
// Full-size originals + preferring photos wide enough for a full-width vertical frame.
// Guards the bug class where layout code only had the squashed 1280x720 b-roll to work from.
// ---------------------------------------------------------------------------------------------

function imageServer(map) {
  return async (url) => {
    const entry = map[url];
    if (!entry) return new Response("missing", { status: 404 });
    return new Response(entry.buf, { status: 200, headers: { "content-type": entry.type || "image/png" } });
  };
}

test("sourceStoryMedia keeps a byte-identical full-size original for every photo it uses", async () => {
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-media-originals-"));
  const bigJpeg = await sharp(await makeTestPng({ width: 1600, height: 900, variant: 0 })).jpeg({ quality: 90 }).toBuffer();
  const bigPng = await makeTestPng({ width: 1400, height: 1000, variant: 3 });
  try {
    await sourceStoryMedia({
      topic: { title: "Originals" },
      article: {
        url: "https://article.example.com/post",
        images: [
          { imageUrl: "https://cdn.example.com/a.jpg", domain: "cdn.example.com" },
          { imageUrl: "https://cdn.example.com/b.png", domain: "cdn.example.com" },
        ],
      },
      script: { title: "Originals", visualQueries: ["q1", "q2"] },
      targetCount: 2,
      stageDir,
      searchFn: async () => [],
      fetchFn: imageServer({
        "https://cdn.example.com/a.jpg": { buf: bigJpeg, type: "image/jpeg" },
        "https://cdn.example.com/b.png": { buf: bigPng },
      }),
    });

    const receipt = JSON.parse(await fs.readFile(path.join(stageDir, "media-sources.json"), "utf8"));
    assert.deepEqual(receipt.items.map((i) => i.originalFile), [
      `${ORIGINAL_MEDIA_DIR}/broll-01.jpg`,
      `${ORIGINAL_MEDIA_DIR}/broll-02.png`,
    ]);
    assert.ok((await fs.readFile(path.join(stageDir, receipt.items[0].originalFile))).equals(bigJpeg));
    assert.ok((await fs.readFile(path.join(stageDir, receipt.items[1].originalFile))).equals(bigPng));
    // The 1280x720 b-roll the current renderer uses is still written unchanged.
    const broll = await sharp(path.join(stageDir, receipt.items[0].file)).metadata();
    assert.deepEqual([broll.width, broll.height], [1280, 720]);
    assert.deepEqual([receipt.items[0].width, receipt.items[0].height], [1600, 900]);
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
});

test("sourceStoryMedia records phone photos at their displayed (EXIF-rotated) size", async () => {
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-media-exif-"));
  // Stored landscape 1600x1200 but tagged "rotate 90" -> displays as 1200x1600 portrait.
  const rotated = await sharp(await makeTestPng({ width: 1600, height: 1200, variant: 1 })).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const plain = await makeTestPng({ width: 1300, height: 800, variant: 4 });
  try {
    await sourceStoryMedia({
      topic: { title: "Exif" },
      article: {
        url: "https://article.example.com/post",
        images: [
          { imageUrl: "https://cdn.example.com/r.jpg", domain: "cdn.example.com" },
          { imageUrl: "https://cdn.example.com/p.png", domain: "cdn.example.com" },
        ],
      },
      script: { title: "Exif", visualQueries: ["q1", "q2"] },
      targetCount: 2,
      stageDir,
      searchFn: async () => [],
      fetchFn: imageServer({
        "https://cdn.example.com/r.jpg": { buf: rotated, type: "image/jpeg" },
        "https://cdn.example.com/p.png": { buf: plain },
      }),
    });
    const receipt = JSON.parse(await fs.readFile(path.join(stageDir, "media-sources.json"), "utf8"));
    assert.deepEqual([receipt.items[0].width, receipt.items[0].height], [1200, 1600]);
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
});

test("sourceStoryMedia prefers search photos wide enough for a full-width vertical frame", async () => {
  assert.equal(PREFERRED_PHOTO_MIN_WIDTH, 1080);
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-media-prefer-"));
  const small = await makeTestPng({ width: 800, height: 600, variant: 0 });
  const bigA = await makeTestPng({ width: 1400, height: 800, variant: 3 });
  const bigB = await makeTestPng({ width: 1600, height: 900, variant: 5 });
  try {
    await sourceStoryMedia({
      topic: { title: "Prefer Big" },
      article: null,
      script: { title: "Prefer Big", visualQueries: ["q1", "q2"] },
      targetCount: 2,
      stageDir,
      // The search result claims the small photo is huge, so it sorts first; the real size is only known after download.
      searchFn: async () => [
        { imageUrl: "https://s.example.com/small.png", domain: "s.example.com", width: 3000, height: 2000 },
        { imageUrl: "https://s.example.com/bigA.png", domain: "s.example.com", width: 1400, height: 800 },
        { imageUrl: "https://s.example.com/bigB.png", domain: "s.example.com", width: 1600, height: 900 },
      ],
      fetchFn: imageServer({
        "https://s.example.com/small.png": { buf: small },
        "https://s.example.com/bigA.png": { buf: bigA },
        "https://s.example.com/bigB.png": { buf: bigB },
      }),
    });
    const receipt = JSON.parse(await fs.readFile(path.join(stageDir, "media-sources.json"), "utf8"));
    // Both big photos are used (biggest first, by the search sort); the small one stays in reserve.
    assert.deepEqual(receipt.items.map((i) => i.sourceUrl), ["https://s.example.com/bigB.png", "https://s.example.com/bigA.png"]);
    assert.equal(receipt.telemetry.reservesHeld, 1);
    assert.equal(receipt.telemetry.reservesUsed, 0);
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
});

test("sourceStoryMedia still uses small search photos when there are not enough big ones, and always uses the article's own photos", async () => {
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-media-reserve-"));
  const articleSmall = await makeTestPng({ width: 700, height: 500, variant: 1 });
  const big = await makeTestPng({ width: 1400, height: 800, variant: 3 });
  const small = await makeTestPng({ width: 800, height: 600, variant: 6 });
  try {
    await sourceStoryMedia({
      topic: { title: "Reserve" },
      article: { url: "https://article.example.com/post", images: [{ imageUrl: "https://cdn.example.com/lead.png", domain: "cdn.example.com" }] },
      script: { title: "Reserve", visualQueries: ["q1", "q2"] },
      targetCount: 3,
      stageDir,
      searchFn: async () => [
        { imageUrl: "https://s.example.com/small.png", domain: "s.example.com", width: 3000, height: 2000 },
        { imageUrl: "https://s.example.com/big.png", domain: "s.example.com", width: 1400, height: 800 },
      ],
      fetchFn: imageServer({
        "https://cdn.example.com/lead.png": { buf: articleSmall },
        "https://s.example.com/small.png": { buf: small },
        "https://s.example.com/big.png": { buf: big },
      }),
    });
    const receipt = JSON.parse(await fs.readFile(path.join(stageDir, "media-sources.json"), "utf8"));
    assert.deepEqual(receipt.items.map((i) => i.sourceUrl), [
      "https://cdn.example.com/lead.png", // article photo first, even though it is small
      "https://s.example.com/big.png", // big search photo beats the small one
      "https://s.example.com/small.png", // small one fills the last slot
    ]);
    assert.equal(receipt.telemetry.reservesUsed, 1);
    assert.ok(receipt.items.every((i) => i.originalFile));
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
});

test("copyOriginalMedia copies listed originals into the run folder and fails loudly if one is missing", async () => {
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-copy-stage-"));
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-copy-run-"));
  try {
    await fs.mkdir(path.join(stageDir, ORIGINAL_MEDIA_DIR), { recursive: true });
    await fs.writeFile(path.join(stageDir, ORIGINAL_MEDIA_DIR, "broll-01.jpg"), "photo-bytes");
    const writeReceipt = (items) => fs.writeFile(path.join(stageDir, "media-sources.json"), JSON.stringify({ items }));

    await writeReceipt([{ file: "media/broll-01.png", originalFile: `${ORIGINAL_MEDIA_DIR}/broll-01.jpg` }]);
    assert.deepEqual(await copyOriginalMedia({ stageDir, runDirectory }), [`${ORIGINAL_MEDIA_DIR}/broll-01.jpg`]);
    assert.equal(await fs.readFile(path.join(runDirectory, ORIGINAL_MEDIA_DIR, "broll-01.jpg"), "utf8"), "photo-bytes");

    await writeReceipt([{ file: "media/broll-02.png", originalFile: `${ORIGINAL_MEDIA_DIR}/broll-02.jpg` }]);
    await assert.rejects(() => copyOriginalMedia({ stageDir, runDirectory }), /missing: media\/original\/broll-02\.jpg/);
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});
