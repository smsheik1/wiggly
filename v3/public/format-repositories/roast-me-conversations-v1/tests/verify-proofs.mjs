import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { layout } from "../runtime/render.mjs";

const files = process.argv.slice(2);
assert.ok(files.length >= 1, "Pass output MP4 path(s)");

const run = (tool, args) => execFileSync(tool, ["-v", "error", "-protocol_whitelist", "file,pipe", ...args], { timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
const results = [];

for (const file of files) {
  const probe = JSON.parse(run("ffprobe", ["-show_format", "-show_streams", "-of", "json", file]).toString());
  const video = probe.streams.find(s => s.codec_type === "video");
  const audio = probe.streams.find(s => s.codec_type === "audio");

  assert.ok(video, "Video stream required");
  assert.equal(video.width, 1080, "Width must be 1080");
  assert.equal(video.height, 1920, "Height must be 1920");
  assert.equal(video.r_frame_rate, "25/1", "FPS must be 25");
  assert.ok(audio, "Audio stream required");
  assert.equal(audio.sample_rate, "48000", "Audio sample rate must be 48000 Hz");

  const dur = Number(probe.format.duration);
  assert.ok(dur > 3, "Duration must be > 3 seconds");

  // Sample Hook Frame at 1.0s
  const hookRgb = run("ffmpeg", ["-ss", "1.0", "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
  assert.equal(hookRgb.length, 1080 * 1920 * 3);

  // Sample Dialogue/Scene Frame at 5.0s
  const sampleTime = Math.min(5.0, dur - 0.5);
  const chatRgb = run("ffmpeg", ["-ss", String(sampleTime), "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"]);
  assert.equal(chatRgb.length, 1080 * 1920 * 3);

  // Verify presence of card pixels in upper center area (light or dark card)
  let cardUpperPixels = 0;
  for (let y = 200; y < 600; y++) {
    for (let x = 200; x < 800; x++) {
      const idx = (y * 1080 + x) * 3;
      const r = chatRgb[idx], g = chatRgb[idx + 1], b = chatRgb[idx + 2];
      // Light card (white) or dark card (very dark)
      if ((r > 230 && g > 230 && b > 230) || (r < 25 && g < 25 && b < 25)) {
        cardUpperPixels++;
      }
    }
  }
  assert.ok(cardUpperPixels > 10000, "Expected dense card pixels in upper area");

  // Check for receipt and verify presenter if configured
  let receipt = null;
  try {
    receipt = JSON.parse(await readFile(file + ".receipt.json", "utf8"));
  } catch {}

  if (receipt?.presenter) {
    // Verify avatar presence in lower foreground area (y: 1300 to 1800, x: 300 to 780)
    let nonBgPixels = 0;
    for (let y = 1400; y < 1800; y += 4) {
      for (let x = 400; x < 700; x += 4) {
        const idx = (y * 1080 + x) * 3;
        const r = chatRgb[idx], g = chatRgb[idx + 1], b = chatRgb[idx + 2];
        if (r > 10 || g > 10 || b > 10) nonBgPixels++;
      }
    }
    assert.ok(nonBgPixels > 1000, "Expected character avatar pixels in presenter foreground");
  }

  results.push({
    file,
    durationSeconds: dur,
    width: 1080,
    height: 1920,
    fps: 25,
    videoCodec: video.codec_name,
    audioCodec: audio.codec_name,
    presenterVerified: Boolean(receipt?.presenter)
  });
}

console.log(JSON.stringify({ status: "passed", verifiedCount: files.length, results }, null, 2));
