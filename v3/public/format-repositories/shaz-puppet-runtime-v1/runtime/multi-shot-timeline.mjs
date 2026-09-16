import crypto from "node:crypto";
import path from "node:path";

const MULTI_SHOT_SCHEMA = "shaz-multi-shot-v1";
const SHOT_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_SHOTS = 64;
const MAX_OUTPUT_FRAMES = 1800;

function exactKeys(value, allowed, context) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    throw new Error(`${context} contains unsupported key(s): ${extras.join(", ")}`);
  }
}

/**
 * Validates a multi-shot plan against measured audio and background assets.
 */
export function validateMultiShotPlan(input, { audioDurationSeconds, defaultBackgroundId, assets, transcript }) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("multi-shot input must be an object");
  }

  exactKeys(input, [
    "schemaVersion",
    "title",
    "audioFile",
    "totalDurationFrames",
    "planningTranscriptSha256",
    "transcript",
    "lipSync",
    "shots",
  ], "multi-shot input");

  if (input.schemaVersion !== MULTI_SHOT_SCHEMA) {
    throw new Error(`unsupported schemaVersion ${input.schemaVersion}, expected ${MULTI_SHOT_SCHEMA}`);
  }

  if (typeof input.title !== "string" || input.title.trim().length < 1 || input.title.length > 120) {
    throw new Error("input.title must contain 1-120 characters");
  }

  const expectedTotalFrames = Math.max(1, Math.round(audioDurationSeconds * 24));
  if (input.totalDurationFrames !== expectedTotalFrames) {
    throw new Error(
      `input.totalDurationFrames (${input.totalDurationFrames}) must match measured audio frames (${expectedTotalFrames})`,
    );
  }

  if (expectedTotalFrames > MAX_OUTPUT_FRAMES) {
    throw new Error(`multi-shot sequence produces ${expectedTotalFrames} frames; maximum is ${MAX_OUTPUT_FRAMES}`);
  }

  if (!Array.isArray(input.shots) || input.shots.length === 0 || input.shots.length > MAX_SHOTS) {
    throw new Error(`input.shots must contain 1-${MAX_SHOTS} shots`);
  }

  const registeredBackgroundIds = new Set((assets.backgrounds ?? []).map(({ id }) => id));

  let currentFrame = 0;
  const validatedShots = [];

  for (let index = 0; index < input.shots.length; index += 1) {
    const shot = input.shots[index];
    exactKeys(shot, [
      "id",
      "shotType",
      "startFrame",
      "endFrameExclusive",
      "backgroundId",
      "text",
      "highlights",
      "chibiPose",
      "topicMedia",
      "rationale",
    ], `shots[${index}]`);

    if (!SHOT_ID.test(shot.id ?? "")) {
      throw new Error(`shots[${index}].id must be a valid lowercase identifier`);
    }

    if (!["talk-to-camera", "text-card", "chibi-commentary"].includes(shot.shotType)) {
      throw new Error(`shots[${index}].shotType must be 'talk-to-camera', 'text-card', or 'chibi-commentary'`);
    }

    if (shot.startFrame !== currentFrame) {
      throw new Error(
        `shots[${index}].startFrame (${shot.startFrame}) must equal preceding shot end frame (${currentFrame}); no gaps or overlaps allowed`,
      );
    }

    if (!Number.isInteger(shot.endFrameExclusive) || shot.endFrameExclusive <= shot.startFrame) {
      throw new Error(`shots[${index}].endFrameExclusive must be greater than startFrame`);
    }

    const durationFrames = shot.endFrameExclusive - shot.startFrame;
    const backgroundId = shot.backgroundId ?? defaultBackgroundId ?? "sisters-room";
    if (!registeredBackgroundIds.has(backgroundId)) {
      throw new Error(`shots[${index}].backgroundId '${backgroundId}' is not a registered background`);
    }

    if (shot.shotType === "chibi-commentary") {
      const chibiPoses = new Set((assets.chibiFrames?.poses ?? []).map((p) => p.id));
      if (shot.chibiPose && !chibiPoses.has(shot.chibiPose)) {
        throw new Error(`shots[${index}].chibiPose '${shot.chibiPose}' is not a registered chibi pose`);
      }
    }

    if (shot.shotType === "text-card") {
      if (typeof shot.text !== "string" || shot.text.trim().length < 1) {
        throw new Error(`shots[${index}] of type 'text-card' requires a non-empty text string`);
      }
      if (shot.highlights !== undefined) {
        if (!Array.isArray(shot.highlights)) {
          throw new Error(`shots[${index}].highlights must be an array`);
        }
        for (let hIndex = 0; hIndex < shot.highlights.length; hIndex += 1) {
          const hl = shot.highlights[hIndex];
          exactKeys(hl, ["phrase", "color"], `shots[${index}].highlights[${hIndex}]`);
          if (typeof hl.phrase !== "string" || !hl.phrase) {
            throw new Error(`shots[${index}].highlights[${hIndex}].phrase must be a non-empty string`);
          }
          if (!HEX_COLOR.test(hl.color ?? "")) {
            throw new Error(`shots[${index}].highlights[${hIndex}].color must be a 6-digit hex color like #00b4d8`);
          }
        }
      }
    }

    currentFrame = shot.endFrameExclusive;

    validatedShots.push({
      index,
      id: shot.id,
      shotType: shot.shotType,
      startFrame: shot.startFrame,
      endFrameExclusive: shot.endFrameExclusive,
      durationFrames,
      backgroundId,
      text: shot.text ?? null,
      highlights: shot.highlights ?? [],
      chibiPose: shot.chibiPose ?? "present-open",
      topicMedia: shot.topicMedia ?? null,
      rationale: shot.rationale ?? null,
    });
  }

  if (currentFrame !== expectedTotalFrames) {
    throw new Error(
      `shots timeline ends at frame ${currentFrame}, but measured audio requires ${expectedTotalFrames} frames`,
    );
  }

  return {
    schemaVersion: MULTI_SHOT_SCHEMA,
    totalFrames: expectedTotalFrames,
    durationSeconds: expectedTotalFrames / 24,
    audioDurationSeconds,
    shots: validatedShots,
  };
}

export { MULTI_SHOT_SCHEMA };
