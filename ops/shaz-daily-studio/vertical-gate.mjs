import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { CandidateSkipError } from "./errors.mjs";
import { sha256 } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/run-common.mjs";

const execFileAsync = promisify(execFile);

export const MAX_VERTICAL_BYTES = 15 * 1024 * 1024;
export const MAX_DURATION_DELTA_SECONDS = 0.1;

/**
 * Probes stream and container metadata for an MP4 deliverable via `ffprobe`.
 */
export async function probeMediaStreams(filePath, { execFileFn = execFileAsync } = {}) {
  const { stdout } = await execFileFn("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size",
    "-show_entries",
    "stream=codec_type,codec_name,width,height",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(String(stdout || "{}"));
  const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
  const videoStream = streams.find((s) => s?.codec_type === "video") || null;
  const audioStream = streams.find((s) => s?.codec_type === "audio") || null;
  const durationSeconds = Number(parsed?.format?.duration);
  return {
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    sizeBytes: Number.isFinite(Number(parsed?.format?.size)) ? Number(parsed.format.size) : null,
    video: videoStream
      ? {
          codec: String(videoStream.codec_name || "").toLowerCase(),
          width: Number(videoStream.width) || 0,
          height: Number(videoStream.height) || 0,
        }
      : null,
    audio: audioStream
      ? {
          codec: String(audioStream.codec_name || "").toLowerCase(),
        }
      : null,
  };
}

/**
 * Validates the vertical MP4 deliverable before Telegram dispatch.
 * Enforces 1080x1920 H.264, AAC audio presence, duration parity (<= 0.1s), and size < 15 MB.
 * Throws CandidateSkipError so broken renders never reach operator approval.
 */
export async function validateVerticalDeliverable({
  verticalVideoPath,
  masterVideoPath = null,
  masterDurationSeconds = null,
  expectedWidth = 1080,
  expectedHeight = 1920,
  maxBytes = MAX_VERTICAL_BYTES,
  maxDurationDeltaSeconds = MAX_DURATION_DELTA_SECONDS,
  probeFn = null,
  execFileFn = execFileAsync,
  statFn = (p) => fs.stat(p),
  sha256Fn = sha256,
} = {}) {
  const fail = (message) =>
    new CandidateSkipError(message, {
      stage: "vertical-gate",
    });

  if (!verticalVideoPath) {
    throw fail("Vertical deliverable path is missing.");
  }

  let stat;
  try {
    stat = await statFn(verticalVideoPath);
  } catch (err) {
    throw fail(`Vertical deliverable is unreadable at ${verticalVideoPath}: ${err.message}`);
  }

  const bytes = Number(stat?.size ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw fail(`Vertical deliverable ${path.basename(verticalVideoPath)} is empty (0 bytes).`);
  }
  if (bytes > maxBytes) {
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    const limitMb = (maxBytes / (1024 * 1024)).toFixed(2);
    throw fail(`Vertical deliverable (${mb} MB) exceeds ${limitMb} MB Telegram/publish cap.`);
  }

  const runProbe = probeFn || ((file) => probeMediaStreams(file, { execFileFn }));
  let probe;
  try {
    probe = await runProbe(verticalVideoPath);
  } catch (err) {
    throw fail(`ffprobe failed on ${path.basename(verticalVideoPath)}: ${err.message}`);
  }

  if (!probe?.video) {
    throw fail(`Vertical deliverable ${path.basename(verticalVideoPath)} has no video stream.`);
  }
  if (probe.video.width !== expectedWidth || probe.video.height !== expectedHeight) {
    throw fail(
      `Vertical deliverable dimensions ${probe.video.width}x${probe.video.height} must equal ${expectedWidth}x${expectedHeight}.`,
    );
  }
  if (probe.video.codec !== "h264") {
    throw fail(`Vertical deliverable video codec '${probe.video.codec || "none"}' must be h264.`);
  }
  if (!probe?.audio) {
    throw fail(`Vertical deliverable ${path.basename(verticalVideoPath)} has no audio stream.`);
  }
  if (probe.audio.codec !== "aac") {
    throw fail(`Vertical deliverable audio codec '${probe.audio.codec || "none"}' must be aac.`);
  }

  const durationSeconds = Number(probe.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw fail(`Vertical deliverable ${path.basename(verticalVideoPath)} has invalid duration (${probe.durationSeconds}).`);
  }

  let resolvedMasterDuration = masterDurationSeconds !== null && masterDurationSeconds !== undefined
    ? Number(masterDurationSeconds)
    : null;
  if (resolvedMasterDuration === null && masterVideoPath) {
    try {
      const masterProbe = await runProbe(masterVideoPath);
      resolvedMasterDuration = Number(masterProbe?.durationSeconds);
    } catch (err) {
      throw fail(`ffprobe failed on master video ${path.basename(masterVideoPath)}: ${err.message}`);
    }
  }

  let durationDeltaSeconds = null;
  if (resolvedMasterDuration !== null) {
    if (!Number.isFinite(resolvedMasterDuration) || resolvedMasterDuration <= 0) {
      throw fail(`Master deliverable has invalid duration (${resolvedMasterDuration}).`);
    }
    durationDeltaSeconds = Math.abs(durationSeconds - resolvedMasterDuration);
    if (durationDeltaSeconds > maxDurationDeltaSeconds) {
      throw fail(
        `Vertical duration (${durationSeconds.toFixed(3)}s) differs from master (${resolvedMasterDuration.toFixed(3)}s) by ${durationDeltaSeconds.toFixed(3)}s (max ${maxDurationDeltaSeconds}s).`,
      );
    }
  }

  const digest = await sha256Fn(verticalVideoPath);
  return {
    ok: true,
    file: path.basename(verticalVideoPath),
    sha256: digest,
    bytes,
    width: probe.video.width,
    height: probe.video.height,
    videoCodec: probe.video.codec,
    audioCodec: probe.audio.codec,
    durationSeconds: Number(durationSeconds.toFixed(4)),
    masterDurationSeconds: resolvedMasterDuration !== null ? Number(resolvedMasterDuration.toFixed(4)) : null,
    durationDeltaSeconds: durationDeltaSeconds !== null ? Number(durationDeltaSeconds.toFixed(4)) : null,
  };
}
