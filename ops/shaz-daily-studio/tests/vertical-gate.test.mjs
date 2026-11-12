import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CandidateSkipError } from "../errors.mjs";
import { MAX_VERTICAL_BYTES, validateVerticalDeliverable } from "../vertical-gate.mjs";

test("validateVerticalDeliverable validates a real 1080x1920 h264+aac MP4 with ffprobe", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vertical-gate-real-"));
  try {
    const master = path.join(tmpDir, "final.mp4");
    const vertical = path.join(tmpDir, "final-vertical.mp4");
    execFileSync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "color=c=black:s=1280x720:d=1.0:r=24",
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=1.0",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
      master,
    ], { stdio: "ignore" });
    execFileSync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "color=c=black:s=1080x1920:d=1.0:r=24",
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo:d=1.0",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
      vertical,
    ], { stdio: "ignore" });

    const res = await validateVerticalDeliverable({
      verticalVideoPath: vertical,
      masterVideoPath: master,
    });
    assert.equal(res.ok, true);
    assert.equal(res.width, 1080);
    assert.equal(res.height, 1920);
    assert.equal(res.videoCodec, "h264");
    assert.equal(res.audioCodec, "aac");
    assert.equal(typeof res.sha256, "string");
    assert.equal(res.sha256.length, 64);
    assert.ok(res.durationDeltaSeconds <= 0.1);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("validateVerticalDeliverable rejects 0-byte, oversized, wrong dimensions, missing audio, and duration drift", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vertical-gate-err-"));
  const filePath = path.join(tmpDir, "final-vertical.mp4");
  try {
    await fs.writeFile(filePath, Buffer.alloc(0));
    await assert.rejects(
      () => validateVerticalDeliverable({ verticalVideoPath: filePath }),
      (err) => err instanceof CandidateSkipError && /empty \(0 bytes\)/.test(err.message),
    );

    await fs.writeFile(filePath, Buffer.from("ok"));
    await assert.rejects(
      () =>
        validateVerticalDeliverable({
          verticalVideoPath: filePath,
          statFn: async () => ({ size: MAX_VERTICAL_BYTES + 1 }),
        }),
      (err) => err instanceof CandidateSkipError && /exceeds/.test(err.message),
    );

    await assert.rejects(
      () =>
        validateVerticalDeliverable({
          verticalVideoPath: filePath,
          probeFn: async () => ({
            durationSeconds: 30,
            video: { codec: "h264", width: 1280, height: 720 },
            audio: { codec: "aac" },
          }),
        }),
      (err) => err instanceof CandidateSkipError && /1280x720 must equal 1080x1920/.test(err.message),
    );

    await assert.rejects(
      () =>
        validateVerticalDeliverable({
          verticalVideoPath: filePath,
          probeFn: async () => ({
            durationSeconds: 30,
            video: { codec: "h264", width: 1080, height: 1920 },
            audio: null,
          }),
        }),
      (err) => err instanceof CandidateSkipError && /no audio stream/.test(err.message),
    );

    await assert.rejects(
      () =>
        validateVerticalDeliverable({
          verticalVideoPath: filePath,
          masterDurationSeconds: 30,
          probeFn: async () => ({
            durationSeconds: 29.5,
            video: { codec: "h264", width: 1080, height: 1920 },
            audio: { codec: "aac" },
          }),
        }),
      (err) => err instanceof CandidateSkipError && /differs from master/.test(err.message),
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
