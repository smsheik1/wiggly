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
      "card",
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
      if (shot.card !== undefined) {
        if (typeof shot.card !== "object" || shot.card === null) {
          throw new Error(`shots[${index}].card must be an object`);
        }
        exactKeys(shot.card, ["badge", "headline", "quote", "theme", "icon", "image"], `shots[${index}].card`);
        if (typeof shot.card.badge !== "string" || shot.card.badge.trim().length < 1) {
          throw new Error(`shots[${index}].card.badge must be a non-empty string`);
        }
        if (typeof shot.card.headline !== "string" || shot.card.headline.trim().length < 1) {
          throw new Error(`shots[${index}].card.headline must be a non-empty string`);
        }
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
      card: shot.card ?? null,
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

/**
 * Heuristically detects semantic themes, badges, icons, and chibi reaction poses
 * from a phrase or sentence text.
 */
export function analyzeSentenceSemantics(text) {
  const lower = text.toLowerCase();

  let theme = "warm-red";
  let icon = "star";
  let chibiPose = "present-open";
  let badge = "KEY POINT";

  if (/\b(food|eat|eating|dinner|cook|cooking|greet|burger|burgers|snack|pizza|mom|kitchen)\b/i.test(lower)) {
    theme = "warm-red";
    icon = "burger";
    badge = "HOMEMADE";
    chibiPose = "talk-laugh";
  } else if (/\b(rule|rules|train|training|discipline|disciplined|champion|trophy|win|best|master)\b/i.test(lower)) {
    theme = "emerald-green";
    icon = "trophy";
    badge = "THE GOLDEN RULE";
    chibiPose = "celebrate";
  } else if (/\b(chaos|clash|clashes|different|fight|versus|argue|disagree|styles)\b/i.test(lower)) {
    theme = "energy-orange";
    icon = "clash";
    badge = "THE CLASH";
    chibiPose = "shrug-smile";
  } else if (/\b(puppy|puppies|dog|dogs|pet|pets|cat|cats|animal|animals|bark)\b/i.test(lower)) {
    theme = "cold-blue";
    icon = "puppy";
    badge = "REALITY CHECK";
    chibiPose = "think-down";
  } else if (/\b(confused|confusion|why|what|how|lost|question|unsure)\b/i.test(lower)) {
    theme = "deep-purple";
    icon = "question";
    badge = "TOTAL CONFUSION";
    chibiPose = "think-chin";
  } else if (/\b(love|thank|thanks|heart|favorite|sweet|grateful)\b/i.test(lower)) {
    theme = "sunburst-gold";
    icon = "heart-paw";
    badge = "THE BEST";
    chibiPose = "present-open";
  } else if (/\b(idea|ideas|think|thought|realize|discovery|aha)\b/i.test(lower)) {
    theme = "sunburst-gold";
    icon = "idea";
    badge = "BIG IDEA";
    chibiPose = "point-up";
  }

  // Derive a punchy 2-4 word uppercase headline
  const cleanWords = text.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  const headline = cleanWords.slice(0, Math.min(4, cleanWords.length)).join(" ").toUpperCase() || "TAKEAWAY";

  return { theme, icon, badge, headline, chibiPose };
}

/**
 * Automatically derives an intelligent, rhythmic multi-shot plan
 * from a word-timestamped transcript.
 */
export function deriveMultiShotPlan({ transcript, audioDurationSeconds, defaultBackgroundId = "sisters-room" }) {
  const totalFrames = Math.max(1, Math.round(audioDurationSeconds * 24));
  const totalDurationMs = Math.round(audioDurationSeconds * 1000);

  // If no transcript or very short, fallback to a single talk-to-camera shot
  if (!transcript || !Array.isArray(transcript.words) || transcript.words.length === 0) {
    return {
      schemaVersion: MULTI_SHOT_SCHEMA,
      title: "Automatic Video",
      totalDurationFrames: totalFrames,
      shots: [
        {
          id: "shot-01",
          shotType: "talk-to-camera",
          startFrame: 0,
          endFrameExclusive: totalFrames,
          backgroundId: defaultBackgroundId,
        },
      ],
    };
  }

  // Group transcript words into natural sentence/clause beats
  const beats = [];
  let currentWords = [];

  for (let i = 0; i < transcript.words.length; i += 1) {
    const w = transcript.words[i];
    currentWords.push(w);

    const isLastWord = i === transcript.words.length - 1;
    const endsWithPunctuation = /[.!?]$/.test(w.text.trim());
    const durationMs = currentWords.at(-1).endMs - currentWords[0].startMs;
    const nextGapMs = !isLastWord ? transcript.words[i + 1].startMs - w.endMs : 0;

    // Break on sentence punctuation, a significant natural audio pause (> 400ms),
    // or when the clause reaches 3.5 - 6 seconds.
    if (isLastWord || ((endsWithPunctuation || nextGapMs >= 350 || durationMs >= 3500) && durationMs >= 1800)) {
      beats.push({
        text: currentWords.map((item) => item.text).join(" ").trim(),
        startMs: currentWords[0].startMs,
        endMs: isLastWord ? totalDurationMs : transcript.words[i + 1].startMs,
        words: [...currentWords],
      });
      currentWords = [];
    }
  }

  // Build the shots sequence following the Director Playbook rhythm
  const shots = [];
  let currentFrame = 0;

  // Shot rotation state machine:
  // 0: talk-to-camera (Hook / Anecdote)
  // 1: chibi-commentary with on-the-fly topic card
  // 2: text-card (punchy text highlight) or talk-to-camera
  // 3: chibi-commentary or talk-to-camera
  for (let bIndex = 0; bIndex < beats.length; bIndex += 1) {
    const beat = beats[bIndex];
    const isFirst = bIndex === 0;
    const isLast = bIndex === beats.length - 1;

    // Calculate end frame for this beat
    let endFrame = isLast ? totalFrames : Math.round((beat.endMs / 1000) * 24);
    if (endFrame <= currentFrame) endFrame = currentFrame + 24; // Ensure at least 1s
    if (isLast) endFrame = totalFrames;

    const shotId = `shot-${String(bIndex + 1).padStart(2, "0")}`;
    const semantics = analyzeSentenceSemantics(beat.text);

    // Rhythm selection:
    // First shot is always talk-to-camera (engaging personal intro)
    // Even indices alternate between chibi-commentary and text-cards
    // Odd indices return to talk-to-camera or chibi
    let shotType = "talk-to-camera";
    if (isFirst) {
      shotType = "talk-to-camera";
    } else if (bIndex % 3 === 1) {
      shotType = "chibi-commentary";
    } else if (bIndex % 3 === 2) {
      // 50% chance text-card if short punchy text, otherwise chibi or talk
      if (beat.words.length <= 8 && beat.text.length <= 50) {
        shotType = "text-card";
      } else {
        shotType = "talk-to-camera";
      }
    } else {
      shotType = "chibi-commentary";
    }

    if (shotType === "talk-to-camera") {
      shots.push({
        id: shotId,
        shotType: "talk-to-camera",
        startFrame: currentFrame,
        endFrameExclusive: endFrame,
        backgroundId: defaultBackgroundId,
      });
    } else if (shotType === "chibi-commentary") {
      shots.push({
        id: shotId,
        shotType: "chibi-commentary",
        startFrame: currentFrame,
        endFrameExclusive: endFrame,
        backgroundId: defaultBackgroundId,
        chibiPose: semantics.chibiPose,
        card: {
          badge: semantics.badge,
          headline: semantics.headline,
          quote: beat.text.length > 60 ? beat.text.slice(0, 57) + "..." : beat.text,
          theme: semantics.theme,
          icon: semantics.icon,
        },
      });
    } else if (shotType === "text-card") {
      // Pick 1-2 highlight words
      const words = beat.text.split(/\s+/);
      const highlightPhrase = words.slice(Math.max(0, words.length - 3)).join(" ");
      shots.push({
        id: shotId,
        shotType: "text-card",
        startFrame: currentFrame,
        endFrameExclusive: endFrame,
        backgroundId: defaultBackgroundId,
        text: beat.text,
        highlights: [
          { phrase: highlightPhrase, color: semantics.theme === "cold-blue" ? "#00b4d8" : "#f77f00" },
        ],
      });
    }

    currentFrame = endFrame;
  }

  // Ensure last shot reaches totalFrames exactly
  if (shots.length > 0 && currentFrame < totalFrames) {
    shots.at(-1).endFrameExclusive = totalFrames;
  }

  return {
    schemaVersion: MULTI_SHOT_SCHEMA,
    title: transcript.text ? transcript.text.slice(0, 60) : "Automatic Video",
    totalDurationFrames: totalFrames,
    shots,
  };
}

export { MULTI_SHOT_SCHEMA };

