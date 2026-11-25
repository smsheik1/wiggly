import assert from "node:assert/strict";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  renderHeaderCard,
  groupWordsIntoCues,
  renderSubtitlePhrase,
  composeVerticalVideo,
  formatSafeHeadline,
  VERTICAL_ENCODE_ARGS,
  OTS_GRAPHIC_ZONE,
  verticalStageGeometry,
  visibleStageRange,
  stageXToVerticalX,
  subtitleFontSize,
  VERTICAL_SAFE_AREA,
  VERTICAL_HEADER_Y,
  VERTICAL_SUBTITLE_Y,
} from "../vertical-letterbox.mjs";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

test("renderHeaderCard returns valid PNG buffer with expected dimensions", async () => {
  const buf = await renderHeaderCard({
    badge: "GTA 6 LEAK",
    headline: "Rockstar Confirms Major Change",
  });
  assert(Buffer.isBuffer(buf), "must return buffer");
  assert(buf.length > 1000, "buffer must have content");
});

test("renderHeaderCard cleanly renders without badge when badge is null or omitted", async () => {
  const buf = await renderHeaderCard({
    headline: "Polish guides highlight video game and Xbox shopping",
  });
  assert(Buffer.isBuffer(buf), "must return buffer");
  assert(buf.length > 1000, "buffer must have content");

  const bufNull = await renderHeaderCard({
    badge: null,
    headline: "No Badge Headline",
  });
  assert(Buffer.isBuffer(bufNull), "must return buffer without badge");
});

test("groupWordsIntoCues groups raw words into 3-word chunks with timing", () => {
  const words = [
    { word: "Sony", startMs: 0, endMs: 400 },
    { word: "just", startMs: 450, endMs: 700 },
    { word: "announced", startMs: 750, endMs: 1200 },
    { word: "the", startMs: 1250, endMs: 1400 },
    { word: "PS5", startMs: 1450, endMs: 1800 },
    { word: "Pro", startMs: 1850, endMs: 2200 },
  ];

  const cues = groupWordsIntoCues(words);
  assert.equal(cues.length, 2, "must produce 2 cues");
  assert.equal(cues[0].words.length, 3);
  assert.equal(cues[0].startMs, 0);
  assert.equal(cues[1].words.length, 3);
  assert.equal(cues[1].startMs, 1250);
});

test("groupWordsIntoCues dynamically snaps at punctuation boundaries and pauses", () => {
  const wordsWithPunctuation = [
    { word: "Wait,", startMs: 0, endMs: 300 },
    { word: "this", startMs: 350, endMs: 500 },
    { word: "is", startMs: 550, endMs: 700 },
    { word: "huge!", startMs: 750, endMs: 1000 },
    { word: "Buy", startMs: 1400, endMs: 1600 },
    { word: "now", startMs: 1650, endMs: 1900 },
  ];

  const cues = groupWordsIntoCues(wordsWithPunctuation);
  assert.equal(cues.length, 3, "must isolate punchy punctuation clauses");
  assert.equal(cues[0].words[0].word, "Wait,");
  assert.equal(cues[1].words.map((w) => w.word).join(" "), "this is huge!");
  assert.equal(cues[2].words.map((w) => w.word).join(" "), "Buy now");
});

test("renderSubtitlePhrase applies distinct activeWord color pop", async () => {
  const phrase = [
    { word: "HOT", startMs: 0, endMs: 200 },
    { word: "DEAL", startMs: 220, endMs: 400 },
  ];

  const bufDefault = await renderSubtitlePhrase({
    phraseWords: phrase,
    activeWordIndex: 0,
  });
  assert(Buffer.isBuffer(bufDefault));

  const bufYellow = await renderSubtitlePhrase({
    phraseWords: phrase,
    activeWordIndex: 1,
    activeColor: "#FFE600",
  });
  assert(Buffer.isBuffer(bufYellow));
});

test("renderSubtitlePhrase creates subtitle overlay buffer", async () => {
  const phrase = [
    { word: "Sony", startMs: 0, endMs: 400 },
    { word: "PS5", startMs: 450, endMs: 800 },
    { word: "Pro", startMs: 850, endMs: 1200 },
  ];
  const buf = await renderSubtitlePhrase({
    phraseWords: phrase,
    activeWordIndex: 1,
  });
  assert(Buffer.isBuffer(buf));
  assert(buf.length > 500);

  // Guardrail test: Words must not fuse together into a compound word.
  // Rendering multi-word phrase must have significantly wider non-zero alpha coverage than single fused word.
  const fusedBuf = await renderSubtitlePhrase({
    phraseWords: [{ word: "SonyPS5Pro", startMs: 0, endMs: 1200 }],
    activeWordIndex: 0,
  });
  const { data: spacedData, info: spacedInfo } = await (await import("../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/sharp.mjs")).default(buf).raw().toBuffer({ resolveWithObject: true });
  const { data: fusedData, info: fusedInfo } = await (await import("../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/sharp.mjs")).default(fusedBuf).raw().toBuffer({ resolveWithObject: true });

  const getWidth = (data, info) => {
    let minX = info.width, maxX = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * info.channels + 3] > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    return maxX - minX + 1;
  };

  const spacedWidth = getWidth(spacedData, spacedInfo);
  const fusedWidth = getWidth(fusedData, fusedInfo);
  assert(spacedWidth > fusedWidth + 30, `Spaced phrase (${spacedWidth}px) must be wider than fused words (${fusedWidth}px) by at least 30px`);
});

test("composeVerticalVideo produces 1080x1920 MP4 from 16:9 source", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-vert-test-"));
  const inputVideo = path.join(tempDir, "input.mp4");
  const outputVideo = path.join(tempDir, "output-vertical.mp4");

  try {
    // Generate 1-second 1280x720 dummy test video with audio
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "color=c=blue:s=1280x720:d=1",
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
      "-t", "1",
      "-c:v", "libx264",
      "-c:a", "aac",
      inputVideo,
    ]);

    const transcript = {
      words: [
        { word: "Breaking", startMs: 100, endMs: 400 },
        { word: "Gaming", startMs: 450, endMs: 700 },
        { word: "News", startMs: 750, endMs: 950 },
      ],
    };

    const res = await composeVerticalVideo({
      sourceVideoPath: inputVideo,
      transcript,
      headline: "The Biggest Mistake in Gaming",
      badge: "EXCLUSIVE",
      outputPath: outputVideo,
    });

    assert.equal(res.width, 1080);
    assert.equal(res.height, 1920);
    assert(fsSync.existsSync(outputVideo));

    // Probe output video specs
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=s=x:p=0",
      outputVideo,
    ]);

    assert.equal(stdout.trim(), "1080x1920", "video stream dimensions must be exactly 1080x1920");

    // Probe output audio specs: must be 48kHz stereo AAC for Instagram/TikTok compliance
    const { stdout: audioProbe } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=sample_rate,channels",
      "-of", "csv=s=x:p=0",
      outputVideo,
    ]);

    assert.equal(audioProbe.trim(), "48000x2", "audio stream must be 48000 Hz with 2 channels (stereo)");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("composeVerticalVideo does not include background music by default", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-vert-nomusic-"));
  const inputVideo = path.join(tempDir, "input.mp4");
  const outputVideo = path.join(tempDir, "output-vertical.mp4");

  try {
    // Generate 1-second video with a 440Hz sine wave tone
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "color=c=black:s=1280x720:d=1",
      "-f", "lavfi", "-i", "sine=f=440:d=1",
      "-t", "1",
      "-c:v", "libx264",
      "-c:a", "aac",
      inputVideo,
    ]);

    await composeVerticalVideo({
      sourceVideoPath: inputVideo,
      headline: "Voice Only Test",
      badge: "CLEAN AUDIO",
      outputPath: outputVideo,
    });

    assert(fsSync.existsSync(outputVideo));

    // Confirm that output audio exists and matches 48kHz stereo without errors
    const { stdout: audioProbe } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_name,sample_rate,channels",
      "-of", "csv=s=x:p=0",
      outputVideo,
    ]);
    assert.equal(audioProbe.trim(), "aacx48000x2");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("formatSafeHeadline snaps to whole word boundaries and never slices words mid-syllable", () => {
  const longHeadline = "Back Market offers €40 off refurbished PlayStation 5 consoles";
  const safe = formatSafeHeadline(longHeadline, 36);
  assert.equal(safe, "Back Market offers €40 off");
  assert.doesNotMatch(safe, /PlaySt$/);

  const shortHeadline = "GTA 6 Release Date";
  assert.equal(formatSafeHeadline(shortHeadline, 36), "GTA 6 Release Date");
});

test("composeVerticalVideo enforces capped bitrate encode flags without ultrafast", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-vert-args-"));
  const inputVideo = path.join(tempDir, "input.mp4");
  const outputVideo = path.join(tempDir, "output-vertical.mp4");
  await fs.writeFile(inputVideo, Buffer.from("dummy-input"));

  let capturedCmd = null;
  let capturedArgs = null;
  try {
    await composeVerticalVideo({
      sourceVideoPath: inputVideo,
      headline: "Bitrate Cap Guardrail",
      outputPath: outputVideo,
      execFileFn: async (cmd, args) => {
        capturedCmd = cmd;
        capturedArgs = args;
      },
    });

    assert.equal(capturedCmd, "ffmpeg");
    assert.ok(Array.isArray(capturedArgs));
    assert.equal(capturedArgs.includes("-maxrate"), true, "ffmpeg args must include -maxrate");
    assert.equal(capturedArgs.includes("3M"), true, "ffmpeg args must cap bitrate at 3M");
    assert.equal(capturedArgs.includes("-crf"), true);
    assert.equal(capturedArgs.includes("23"), true);
    assert.equal(capturedArgs.includes("ultrafast"), false, "ultrafast must not regress");
    assert.equal(VERTICAL_ENCODE_ARGS.includes("-maxrate"), true);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("composeVerticalVideo applies the safe-area layout (stage shrunk to x 100-980 at y 560, header at y 256, captions at y 1150)", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-vert-layoutb-"));
  const inputVideo = path.join(tempDir, "input.mp4");
  const outputVideo = path.join(tempDir, "output-vertical.mp4");
  await fs.writeFile(inputVideo, Buffer.from("dummy-input"));

  let capturedArgs = null;
  try {
    await composeVerticalVideo({
      sourceVideoPath: inputVideo,
      transcript: {
        words: [{ word: "Test", startMs: 0, endMs: 500 }],
      },
      headline: "Layout B Geometry Guardrail",
      badge: "LAYOUT B",
      outputPath: outputVideo,
      execFileFn: async (_cmd, args) => {
        capturedArgs = args;
      },
    });

    const filterComplexIdx = capturedArgs.indexOf("-filter_complex");
    assert.ok(filterComplexIdx !== -1, "must have -filter_complex argument");
    const filter = capturedArgs[filterComplexIdx + 1];

    assert.match(filter, /scale=1042:586,crop=880:586:39:0/);
    assert.match(filter, /overlay=100:560/);
    assert.match(filter, /overlay=0:256/);
    assert.match(filter, /overlay=0:1150/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("vertical crop keeps the whole picture card and Shaz in view (2026-11-24 cut-off card bug)", () => {
  const range = visibleStageRange(verticalStageGeometry());
  const cardLeft = OTS_GRAPHIC_ZONE.left;
  const cardRight = OTS_GRAPHIC_ZONE.left + OTS_GRAPHIC_ZONE.width;
  assert.ok(range.left <= cardLeft - 16, `card left edge ${cardLeft} is cut: view starts at ${range.left}`);
  assert.ok(range.right >= cardRight + 16, `card right edge ${cardRight} is cut: view ends at ${range.right}`);
  // Shaz's lean poses reach past x=1100; never cut more of his right side than the old center crop (x 1120).
  assert.ok(range.right >= 1120, `Shaz's right side is cut: view ends at ${range.right}`);
  const geo = verticalStageGeometry();
  assert.ok(geo.cropX + geo.outputWidth <= geo.scaledWidth, "crop stays inside the scaled stage");
});

// 2026-11-25: on YouTube the card was still cut off. Shorts/TikTok/Reels zoom the video to fill
// tall phones (up to ~10% off each side) and draw their UI over the top and bottom. Everything
// that matters must sit inside VERTICAL_SAFE_AREA. Measured on real rendered pixels.
async function inkBounds(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

test("picture card, Shaz, headline and captions all sit inside the apps' safe area", async () => {
  const safe = VERTICAL_SAFE_AREA;
  const geo = verticalStageGeometry();

  // Picture card and Shaz (stage x 64 -> 1120) land inside the safe width.
  const cardLeftX = stageXToVerticalX(OTS_GRAPHIC_ZONE.left, geo);
  const shazRightX = stageXToVerticalX(1120, geo);
  assert.ok(cardLeftX >= safe.left, `card starts at x ${cardLeftX.toFixed(0)}, inside the side crop (< ${safe.left})`);
  assert.ok(shazRightX <= safe.right, `Shaz reaches x ${shazRightX.toFixed(0)}, inside the side crop (> ${safe.right})`);
  assert.ok(geo.overlayY >= safe.top && geo.overlayY + geo.scaledHeight <= safe.bottom, "stage band inside safe top/bottom");

  // Headline: worst cases are 3 lines with a badge, and 1 short line without.
  for (const [headline, badge] of [
    ["Sony Says PS5 Pro Owners Must Update Before GTA Six Launch Day", "BREAKING"],
    ["GTA", null],
  ]) {
    const b = await inkBounds(await renderHeaderCard({ headline, badge }));
    const top = VERTICAL_HEADER_Y + b.minY;
    const bottom = VERTICAL_HEADER_Y + b.maxY;
    assert.ok(top >= safe.top, `headline "${headline}" starts at y ${top}, under the apps' top bar`);
    assert.ok(bottom < geo.overlayY, `headline "${headline}" (to y ${bottom}) overlaps the video at y ${geo.overlayY}`);
    assert.ok(b.minX >= safe.left && b.maxX <= safe.right, `headline "${headline}" x ${b.minX}-${b.maxX} hits the side crop`);
  }

  // Captions: a long 3-word phrase must shrink to fit, and stay above the channel name / title.
  for (const words of [["HIS", "RETRO", "GAME"], ["CONTROVERSIAL", "ANNOUNCEMENT", "CONFIRMED"]]) {
    const phraseWords = words.map((text) => ({ text }));
    const b = await inkBounds(await renderSubtitlePhrase({ phraseWords, activeWordIndex: 1 }));
    assert.ok(b.minX >= safe.left && b.maxX <= safe.right, `caption "${words.join(" ")}" x ${b.minX}-${b.maxX} hits the side crop (font ${subtitleFontSize(phraseWords)}px)`);
    assert.ok(VERTICAL_SUBTITLE_Y + b.minY > geo.overlayY + geo.scaledHeight, "caption sits below the video");
    assert.ok(VERTICAL_SUBTITLE_Y + b.maxY <= safe.bottom, `caption bottom y ${VERTICAL_SUBTITLE_Y + b.maxY} is under the channel name`);
  }
});
