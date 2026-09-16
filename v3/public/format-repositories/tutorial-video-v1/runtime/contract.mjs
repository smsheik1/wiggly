import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";

export const VIDEO = Object.freeze({ width: 1920, height: 1080, fps: 30 });
export const ALLOWED_STEP_KINDS = Object.freeze([
  "hero", "browser", "terminal", "media", "final", "end",
  "social-proof", "package-breakdown", "replacement-value", "scorecard", "checklist", "workflow"
]);
export const ALLOWED_BACKGROUNDS = Object.freeze(["lime", "blue", "cream"]);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const text = (value, label, maxLength) => {
  assert(typeof value === "string" && value.trim().length > 0, `${label} must be non-empty text.`);
  assert(value.length <= maxLength, `${label} must be at most ${maxLength} characters.`);
  return value.trim();
};

const seconds = (value, label, minimum = 0) => {
  assert(Number.isFinite(value) && value >= minimum, `${label} must be a number >= ${minimum}.`);
  return value;
};

const portablePath = (value, label) => {
  text(value, label, 240);
  assert(!path.isAbsolute(value), `${label} must be relative to media/.`);
  assert(!value.includes("\\") && !value.includes(":"), `${label} must use a portable relative path.`);
  assert(value.split("/").every((part) => part && part !== "." && part !== ".."), `${label} cannot leave media/.`);
  return value;
};

const mediaFile = (mediaRoot, value, label) => {
  const relative = portablePath(value, label);
  const resolved = path.resolve(mediaRoot, relative);
  assert(resolved.startsWith(`${path.resolve(mediaRoot)}${path.sep}`), `${label} cannot leave media/.`);
  assert(existsSync(resolved), `${label} does not exist: media/${relative}`);
  const stat = lstatSync(resolved);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular file, not a symlink.`);
  assert(stat.size <= 250 * 1024 * 1024, `${label} exceeds the 250 MB per-file limit.`);
  return { relative, resolved };
};

export function probeMedia(file, ffprobe = process.env.FFPROBE || "ffprobe") {
  const raw = execFileSync(
    ffprobe,
    [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
      "-of", "json",
      file,
    ],
    { encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
  );
  const parsed = JSON.parse(raw);
  return {
    durationSeconds: Number(parsed.format?.duration || 0),
    video: parsed.streams?.find((stream) => stream.codec_type === "video") || null,
    audio: parsed.streams?.find((stream) => stream.codec_type === "audio") || null,
  };
}

function validateAuthorizedAsset(asset, label, mediaRoot, expectedKind) {
  assert(asset && typeof asset === "object", `${label} is required.`);
  const file = mediaFile(mediaRoot, asset.file, `${label}.file`);
  assert(asset.authorized === true, `${label}.authorized must be true.`);
  text(asset.provenance, `${label}.provenance`, 1200);
  const metadata = probeMedia(file.resolved);
  if (expectedKind === "audio") assert(metadata.audio, `${label}.file needs an audio stream.`);
  if (expectedKind === "image") assert(/\.(png|jpe?g|webp)$/i.test(file.relative), `${label}.file must be PNG, JPEG, or WebP.`);
  if (expectedKind === "video") assert(metadata.video, `${label}.file needs a video stream.`);
  return { ...asset, file: file.relative, metadata };
}

export function validateTutorialInput(input, { mediaRoot }) {
  assert(input && typeof input === "object", "Input must be a JSON object.");
  assert(input.schemaVersion === 2, "schemaVersion must be 2.");
  assert(!("sourceVideo" in input), "sourceVideo is forbidden: supply editable tutorial ingredients, not a finished master video.");
  assert(input.format && typeof input.format === "object", "format metadata is required.");
  const format = {
    name: text(input.format.name, "format.name", 48),
    slug: text(input.format.slug, "format.slug", 80),
    promise: text(input.format.promise, "format.promise", 150),
    url: text(input.format.url, "format.url", 240),
    outputLabel: text(input.format.outputLabel, "format.outputLabel", 70),
  };
  text(input.title, "title", 80);
  text(input.audience, "audience", 120);
  assert(Array.isArray(input.steps) && input.steps.length >= 4 && input.steps.length <= 14, "steps must contain 4–14 tutorial sections.");

  const ids = new Set();
  let startFrame = 0;
  let narrationCount = 0;
  let checkpointCount = 0;
  let browserCount = 0;
  let terminalCount = 0;
  let finalCount = 0;

  const steps = input.steps.map((rawStep, index) => {
    assert(rawStep && typeof rawStep === "object", `steps[${index}] must be an object.`);
    const id = text(rawStep.id, `steps[${index}].id`, 60);
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), `steps[${index}].id must be kebab-case.`);
    assert(!ids.has(id), `Duplicate step id: ${id}`);
    ids.add(id);
    assert(ALLOWED_STEP_KINDS.includes(rawStep.kind), `${id}.kind must be one of ${ALLOWED_STEP_KINDS.join(", ")}.`);
    const durationSeconds = seconds(rawStep.durationSeconds, `${id}.durationSeconds`, 1);
    assert(durationSeconds <= 75, `${id}.durationSeconds must be <= 75.`);
    const durationInFrames = Math.round(durationSeconds * VIDEO.fps);
    assert(Math.abs(durationInFrames / VIDEO.fps - durationSeconds) <= 0.017, `${id}.durationSeconds must align to 30 fps.`);
    const label = text(rawStep.label, `${id}.label`, 65);
    const background = rawStep.background || "lime";
    assert(ALLOWED_BACKGROUNDS.includes(background), `${id}.background must be lime, blue, or cream.`);
    if (rawStep.kind === "browser") browserCount += 1;
    if (rawStep.kind === "terminal") terminalCount += 1;
    if (rawStep.kind === "final") finalCount += 1;

    let media = null;
    if (rawStep.media) {
      assert(["video", "image"].includes(rawStep.media.type), `${id}.media.type must be video or image.`);
      media = validateAuthorizedAsset(rawStep.media, `${id}.media`, mediaRoot, rawStep.media.type);
      const startSeconds = seconds(rawStep.media.startSeconds ?? 0, `${id}.media.startSeconds`);
      const fit = rawStep.media.fit || "contain";
      assert(["contain", "cover"].includes(fit), `${id}.media.fit must be contain or cover.`);
      if (rawStep.media.type === "video") {
        assert(startSeconds + durationSeconds <= media.metadata.durationSeconds + 0.06, `${id}.media is shorter than the requested section; looping and frozen fallbacks are forbidden.`);
      }
      media = { ...media, startSeconds, fit };
    }
    if (!["end", "package-breakdown", "replacement-value", "scorecard", "checklist", "workflow"].includes(rawStep.kind)) {
      assert(media, `${id}.media is required for ${rawStep.kind} sections.`);
    }

    let narration = null;
    if (rawStep.narration) {
      assert(rawStep.kind !== "final", `${id}: final-result playback cannot have tutorial narration over it.`);
      narration = validateAuthorizedAsset(rawStep.narration, `${id}.narration`, mediaRoot, "audio");
      const startSeconds = seconds(rawStep.narration.startSeconds ?? 0, `${id}.narration.startSeconds`);
      assert(startSeconds + narration.metadata.durationSeconds <= durationSeconds + 0.06, `${id}.narration is cut off by the section duration.`);
      narration = { ...narration, startSeconds };
      narrationCount += 1;
    }

    const captions = rawStep.captions || [];
    assert(Array.isArray(captions), `${id}.captions must be an array.`);
    if (narration) assert(captions.length > 0, `${id} needs timed captions for its narration.`);
    if (!narration) assert(captions.length === 0, `${id} cannot have tutorial captions without narration audio.`);
    let previousEnd = 0;
    for (const [captionIndex, caption] of captions.entries()) {
      const start = seconds(caption.start, `${id}.captions[${captionIndex}].start`);
      const end = seconds(caption.end, `${id}.captions[${captionIndex}].end`, 0.01);
      assert(start >= previousEnd && end > start && end <= durationSeconds, `${id} caption timings must be ordered and inside the section.`);
      text(caption.text, `${id}.captions[${captionIndex}].text`, 105);
      previousEnd = end;
    }

    let checkpoint = null;
    if (rawStep.checkpoint) {
      checkpoint = {
        eyebrow: text(rawStep.checkpoint.eyebrow, `${id}.checkpoint.eyebrow`, 38),
        headline: text(rawStep.checkpoint.headline, `${id}.checkpoint.headline`, 90),
        badge: text(rawStep.checkpoint.badge, `${id}.checkpoint.badge`, 28),
      };
      checkpointCount += 1;
    }

    const nativeAudio = rawStep.nativeAudio === true;
    if (nativeAudio) {
      assert(rawStep.kind === "hero" || rawStep.kind === "final", `${id}.nativeAudio is only allowed on hero or final video sections.`);
      assert(media?.type === "video" && media.metadata.audio, `${id}.nativeAudio requires a video with audio.`);
      assert(!narration, `${id} cannot mix tutorial narration over native result audio.`);
    }
    if (rawStep.kind === "final") assert(nativeAudio, `${id}: final result must preserve its native audio.`);

    const result = {
      id,
      kind: rawStep.kind,
      number: text(String(rawStep.number ?? index + 1), `${id}.number`, 4),
      label,
      background,
      windowTitle: rawStep.windowTitle ? text(rawStep.windowTitle, `${id}.windowTitle`, 70) : null,
      durationSeconds,
      durationInFrames,
      startFrame,
      media,
      narration,
      captions,
      checkpoint,
      nativeAudio,
    };
    startFrame += durationInFrames;
    return result;
  });

  assert(browserCount >= 1, "At least one browser step is required; the signature format must show the real Wiggly page or workflow.");
  assert(terminalCount >= 1, "At least one terminal step is required; the signature format must show the real coding-agent/runtime workflow.");
  assert(narrationCount >= 2, "At least two supplied narration turns are required.");
  assert(checkpointCount >= 1, "At least one neon checkpoint callout is required.");
  assert(finalCount === 1, "Exactly one native-audio final-result section is required.");
  assert(startFrame >= VIDEO.fps * 12 && startFrame <= VIDEO.fps * 240, "The composed tutorial must be 12–240 seconds, based on its ingredients.");

  let music = null;
  if (input.music) {
    music = validateAuthorizedAsset(input.music, "music", mediaRoot, "audio");
    const volume = input.music.volume ?? 0.20;
    assert(Number.isFinite(volume) && volume > 0 && volume <= 0.35, "music.volume must be > 0 and <= 0.35.");
    assert(music.metadata.durationSeconds + 0.06 >= startFrame / VIDEO.fps, "Music must cover the full tutorial; the runtime does not silently loop it.");
    music = { ...music, volume };
  }

  return {
    schemaVersion: 2,
    title: input.title.trim(),
    audience: input.audience.trim(),
    format,
    steps,
    music,
    width: VIDEO.width,
    height: VIDEO.height,
    fps: VIDEO.fps,
    durationInFrames: startFrame,
    durationSeconds: startFrame / VIDEO.fps,
  };
}

export function loadAndValidateInput(inputFile, options) {
  return validateTutorialInput(JSON.parse(readFileSync(inputFile, "utf8")), options);
}
