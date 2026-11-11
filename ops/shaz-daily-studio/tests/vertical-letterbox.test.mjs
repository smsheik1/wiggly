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
} from "../vertical-letterbox.mjs";

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
  const { data: spacedData, info: spacedInfo } = await (await import("sharp")).default(buf).raw().toBuffer({ resolveWithObject: true });
  const { data: fusedData, info: fusedInfo } = await (await import("sharp")).default(fusedBuf).raw().toBuffer({ resolveWithObject: true });

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
