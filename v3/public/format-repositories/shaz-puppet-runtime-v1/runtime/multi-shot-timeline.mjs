import crypto from "node:crypto";
import path from "node:path";
import { evaluateSentenceDirector } from "./director-jev.mjs";
import { deriveChibiRoutine } from "./chibi-choreography.mjs";

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
 * Resolves semantic alias pose IDs to their registered recipe identifiers.
 * E.g. "chin-stroke" -> "chin-stroke-swagger" (the prop-free swagger chin-stroke pose)
 */
export function resolvePuppetPoseId(poseId) {
  if (poseId === "chin-stroke" || poseId === "chin-stroke-swagger" || poseId === "chin-stroke-smug" || poseId === "swagger" || poseId === "phone-use-sequence" || poseId === "look-at-phone") {
    return "chin-stroke-swagger";
  }
  if (poseId === "facepalm-frustrated" || poseId === "facepalm") {
    return "shrug";
  }
  if (poseId === "arms-crossed-skeptical" || poseId === "arms-crossed") {
    return "confident";
  }
  return poseId;
}

/**
 * Validates a multi-shot plan against measured audio and background assets.
 */
export function validateMultiShotPlan(input, { audioDurationSeconds, defaultBackgroundId, assets, poseRegistry, transcript }) {
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
      "poseId",
      "text",
      "highlights",
      "chibiPose",
      "chibiRoutine",
      "topicMedia",
      "brollMedia",
      "motion",
      "card",
      "otsGraphic",
      "rationale",
    ], `shots[${index}]`);

    if (!SHOT_ID.test(shot.id ?? "")) {
      throw new Error(`shots[${index}].id must be a valid lowercase identifier`);
    }

    if (!["talk-to-camera", "text-card", "chibi-commentary", "b-roll"].includes(shot.shotType)) {
      throw new Error(`shots[${index}].shotType must be 'talk-to-camera', 'text-card', 'chibi-commentary', or 'b-roll'`);
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

    if (shot.shotType === "talk-to-camera") {
      const resolvedPoseId = resolvePuppetPoseId(shot.poseId ?? "neutral-listening");
      if (poseRegistry?.byId && !poseRegistry.byId.has(resolvedPoseId)) {
        throw new Error(`shots[${index}].poseId '${shot.poseId}' is not a registered puppet pose`);
      }
      if (shot.otsGraphic !== undefined) {
        if (typeof shot.otsGraphic !== "object" || shot.otsGraphic === null) {
          throw new Error(`shots[${index}].otsGraphic must be an object`);
        }
        exactKeys(
          shot.otsGraphic,
          ["badge", "headline", "image", "subtext", "entranceDelayFrames", "durationFrames"],
          `shots[${index}].otsGraphic`,
        );
        if (shot.otsGraphic.headline !== undefined && typeof shot.otsGraphic.headline !== "string") {
          throw new Error(`shots[${index}].otsGraphic.headline must be a string`);
        }
        if (shot.otsGraphic.badge !== undefined && typeof shot.otsGraphic.badge !== "string") {
          throw new Error(`shots[${index}].otsGraphic.badge must be a string`);
        }
      }
    }

    if (shot.shotType === "chibi-commentary") {
      const allowedChibiPoses = new Set([
        ...(assets.chibiFrames?.poses ?? []).map((p) => p.id),
        "talk-gesture",
        "present-card",
        "think-chin",
        "shrug-open",
        "point-emphasis",
      ]);
      if (shot.chibiPose && !allowedChibiPoses.has(shot.chibiPose)) {
        throw new Error(`shots[${index}].chibiPose '${shot.chibiPose}' is not a registered chibi pose`);
      }
      if (shot.chibiRoutine !== undefined) {
        if (!Array.isArray(shot.chibiRoutine) || shot.chibiRoutine.length === 0) {
          throw new Error(`shots[${index}].chibiRoutine must be a non-empty array of pose IDs`);
        }
        for (const pose of shot.chibiRoutine) {
          if (!allowedChibiPoses.has(pose)) {
            throw new Error(`shots[${index}].chibiRoutine pose '${pose}' is not a valid chibi hold pose`);
          }
        }
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

    if (shot.shotType === "b-roll") {
      if (shot.motion !== undefined) {
        const allowedMotions = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"];
        if (!allowedMotions.includes(shot.motion)) {
          throw new Error(`shots[${index}].motion must be one of: ${allowedMotions.join(", ")}`);
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
      poseId: shot.shotType === "talk-to-camera" ? resolvePuppetPoseId(shot.poseId ?? "neutral-listening") : null,
      text: shot.text ?? null,
      highlights: shot.highlights ?? [],
      chibiPose: shot.chibiPose ?? "present-card",
      chibiRoutine: Array.isArray(shot.chibiRoutine) && shot.chibiRoutine.length > 1
        ? shot.chibiRoutine
        : deriveChibiRoutine(shot.chibiRoutine?.[0] ?? shot.chibiPose ?? "present-card", durationFrames),
      topicMedia: shot.topicMedia ?? null,
      brollMedia: shot.brollMedia ?? null,
      motion: shot.motion ?? "zoom-in",
      card: shot.card ?? null,
      otsGraphic: shot.otsGraphic ?? null,
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
    chibiPose = "talk-gesture";
  } else if (/\b(love|thank|thanks|heart|favorite|sweet|grateful)\b/i.test(lower)) {
    theme = "sunburst-gold";
    icon = "heart-paw";
    badge = "THE BEST";
    chibiPose = "present-card";
  } else if (/\b(rule|rules|train|training|discipline|disciplined|champion|trophy|win|best|master)\b/i.test(lower)) {
    theme = "emerald-green";
    icon = "trophy";
    badge = "THE GOLDEN RULE";
    chibiPose = "point-emphasis";
  } else if (/\b(chaos|clash|clashes|different|fight|versus|argue|disagree|styles)\b/i.test(lower)) {
    theme = "energy-orange";
    icon = "clash";
    badge = "THE CLASH";
    chibiPose = "shrug-open";
  } else if (/\b(puppy|puppies|dog|dogs|pet|pets|cat|cats|animal|animals|bark)\b/i.test(lower)) {
    theme = "cold-blue";
    icon = "puppy";
    badge = "REALITY CHECK";
    chibiPose = "think-chin";
  } else if (/\b(confused|confusion|why|what|how|lost|question|unsure)\b/i.test(lower)) {
    theme = "deep-purple";
    icon = "question";
    badge = "TOTAL CONFUSION";
    chibiPose = "think-chin";
  } else if (/\b(idea|ideas|think|thought|realize|discovery|aha)\b/i.test(lower)) {
    theme = "sunburst-gold";
    icon = "idea";
    badge = "BIG IDEA";
    chibiPose = "point-emphasis";
  }

  // Derive a punchy 2-4 word uppercase headline
  const cleanWords = text.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  const headline = cleanWords.slice(0, Math.min(4, cleanWords.length)).join(" ").toUpperCase() || "TAKEAWAY";

  return { theme, icon, badge, headline, chibiPose };
}

/**
 * Groups transcript words into natural sentence/clause beats.
 */
export function groupTranscriptIntoBeats(words) {
  if (!Array.isArray(words) || words.length === 0) return [];
  const beats = [];
  let currentWords = [];

  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    currentWords.push(w);

    const isLastWord = i === words.length - 1;
    const endsWithPunctuation = /[.!?]$/.test(w.text.trim());
    const durationMs = currentWords.at(-1).endMs - currentWords[0].startMs;
    const nextGapMs = !isLastWord ? words[i + 1].startMs - w.endMs : 0;

    // Break on sentence punctuation, a significant natural audio pause (> 350ms),
    // or when the clause reaches 3.5 - 6 seconds.
    if (isLastWord || ((endsWithPunctuation || nextGapMs >= 350 || durationMs >= 3500) && durationMs >= 1800)) {
      beats.push({
        text: currentWords.map((item) => item.text).join(" ").trim(),
        startMs: currentWords[0].startMs,
        endMs: currentWords.at(-1).endMs,
        words: [...currentWords],
      });
      currentWords = [];
    }
  }

  return beats;
}

/**
 * Automatically derives an intelligent, rhythmic multi-shot plan
 * from a word-timestamped transcript.
 */
export function deriveMultiShotPlan({
  transcript,
  audioDurationSeconds,
  defaultBackgroundId = "sisters-room",
  brollMediaList = [],
}) {
  const totalFrames = Math.max(1, Math.round(audioDurationSeconds * 24));

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
          poseId: "neutral-listening",
        },
      ],
    };
  }

  const beats = groupTranscriptIntoBeats(transcript.words);
  if (beats.length === 0) {
    return {
      schemaVersion: MULTI_SHOT_SCHEMA,
      title: transcript.text ? transcript.text.slice(0, 60) : "Automatic Video",
      totalDurationFrames: totalFrames,
      shots: [
        {
          id: "shot-01",
          shotType: "talk-to-camera",
          startFrame: 0,
          endFrameExclusive: totalFrames,
          backgroundId: defaultBackgroundId,
          poseId: "neutral-listening",
        },
      ],
    };
  }

  // Plan shots from beats with natural video commentary pacing:
  // - talk-to-camera is the primary anchor (~75% of runtime)
  // - neutral-listening is the home baseline, alternating with active punctuation
  // - Chibi commentary is used at most 1-2 times as comedic cutaway
  // - Text card is used at most once for key quote/stat (unless b-roll is supplied)
  const shots = [];
  let currentFrame = 0;
  let lastPoseId = null;

  // Decide cutaway indices for deterministic fallback
  const chibiIndices = new Set();
  const textCardIndices = new Set();
  const brollIndices = new Set();

  if (beats.length >= 3) {
    // Single chibi cutaway around 35-40% through video
    chibiIndices.add(Math.floor(beats.length * 0.35));
  }
  if (beats.length >= 7) {
    // Optional second chibi cutaway around 70% if video is long
    chibiIndices.add(Math.floor(beats.length * 0.7));
  }
  if (brollMediaList && brollMediaList.length > 0) {
    const brollIdx = Math.floor(beats.length * 0.55);
    if (!chibiIndices.has(brollIdx)) brollIndices.add(brollIdx);
  } else if (beats.length >= 5) {
    const textIdx = Math.floor(beats.length * 0.55);
    if (!chibiIndices.has(textIdx)) textCardIndices.add(textIdx);
  }

  const activePoses = [
    "chin-stroke-swagger",
    "point-at-screen",
    "excited-celebration",
    "confident",
    "shrug",
    "point",
    "think",
    "aha",
    "present",
  ];
  let activePoseIndex = 0;

  for (let bIndex = 0; bIndex < beats.length; bIndex += 1) {
    const beat = beats[bIndex];
    const isFirst = bIndex === 0;
    const isLast = bIndex === beats.length - 1;

    let endFrame = isLast ? totalFrames : Math.round((beat.endMs / 1000) * 24);
    if (endFrame <= currentFrame) endFrame = currentFrame + 24;
    if (isLast) endFrame = totalFrames;

    const shotId = `shot-${String(bIndex + 1).padStart(2, "0")}`;
    const semantics = analyzeSentenceSemantics(beat.text);

    let shotType = "talk-to-camera";
    if (isFirst || isLast) {
      shotType = "talk-to-camera";
    } else if (chibiIndices.has(bIndex)) {
      shotType = "chibi-commentary";
    } else if (brollIndices.has(bIndex)) {
      shotType = "b-roll";
    } else if (textCardIndices.has(bIndex)) {
      shotType = "text-card";
    }

    if (shotType === "talk-to-camera") {
      let chosenPose = "neutral-listening";
      // Natural cadence: if previous was active gesture, return to neutral baseline.
      if (lastPoseId && lastPoseId !== "neutral-listening") {
        chosenPose = "neutral-listening";
      } else if (!isFirst && bIndex % 2 === 1) {
        chosenPose = activePoses[activePoseIndex % activePoses.length];
        activePoseIndex += 1;
      }
      lastPoseId = chosenPose;

      shots.push({
        id: shotId,
        shotType: "talk-to-camera",
        startFrame: currentFrame,
        endFrameExclusive: endFrame,
        backgroundId: defaultBackgroundId,
        poseId: chosenPose,
      });
    } else if (shotType === "chibi-commentary") {
      lastPoseId = null;
      const shotDuration = endFrame - currentFrame;
      shots.push({
        id: shotId,
        shotType: "chibi-commentary",
        startFrame: currentFrame,
        endFrameExclusive: endFrame,
        backgroundId: defaultBackgroundId,
        chibiPose: semantics.chibiPose,
        chibiRoutine: deriveChibiRoutine(semantics.chibiPose, shotDuration),
        card: {
          badge: semantics.badge,
          headline: semantics.headline,
          quote: beat.text.length > 60 ? beat.text.slice(0, 57) + "..." : beat.text,
          theme: semantics.theme,
          icon: semantics.icon,
        },
      });
    } else if (shotType === "b-roll") {
      lastPoseId = null;
      const motions = ["zoom-in", "pan-right", "zoom-out", "pan-left"];
      const brollMedia = brollMediaList[bIndex % brollMediaList.length] ?? null;
      shots.push({
        id: shotId,
        shotType: "b-roll",
        startFrame: currentFrame,
        endFrameExclusive: endFrame,
        backgroundId: defaultBackgroundId,
        brollMedia,
        motion: motions[bIndex % motions.length],
      });
    } else if (shotType === "text-card") {
      lastPoseId = null;
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

/**
 * Derives an intelligent multi-shot plan utilizing TypeSafe AI's Jev model
 * for probabilistic comedic gesture and camera choreography.
 * Gracefully falls back to deterministic deriveMultiShotPlan if Jev is unavailable.
 */
export async function deriveMultiShotPlanWithJev({
  transcript,
  audioDurationSeconds,
  defaultBackgroundId = "sisters-room",
  brollMediaList = [],
  apiKey,
  fetchFn,
}) {
  const deterministicPlan = deriveMultiShotPlan({
    transcript,
    audioDurationSeconds,
    defaultBackgroundId,
    brollMediaList,
  });

  // If no transcript or single shot, return deterministic plan
  if (!transcript || !Array.isArray(transcript.words) || transcript.words.length === 0 || deterministicPlan.shots.length <= 1) {
    return deterministicPlan;
  }

  const beats = groupTranscriptIntoBeats(transcript.words);
  if (beats.length <= 1) return deterministicPlan;

  const totalFrames = Math.max(1, Math.round(audioDurationSeconds * 24));
  const shots = [];
  let currentFrame = 0;

  const puppetRotation = [
    "neutral-listening",
    "chin-stroke",
    "chin-stroke-swagger",
    "point-at-screen",
    "excited-celebration",
    "confident",
    "shrug",
    "point",
    "think",
    "aha",
    "present",
  ];
  const chibiRotation = ["point-emphasis", "think-chin", "present-card", "shrug-open", "talk-gesture"];
  const badgeRotation = ["REALITY CHECK", "THE CLASH", "COMMUNITY ROAST", "THE BEST", "YOUR VERDICT"];

  let lastChibiPose = null;
  let lastBadge = null;
  let lastPuppetPose = null;
  const usedPuppetPoses = [];
  let chibiCount = 0;
  let textCardCount = 0;
  const maxChibi = beats.length >= 7 ? 2 : 1;
  const maxTextCards = brollMediaList?.length > 0 ? 0 : 1;

  try {
    for (let bIndex = 0; bIndex < beats.length; bIndex += 1) {
      const beat = beats[bIndex];
      const isFirst = bIndex === 0;
      const isLast = bIndex === beats.length - 1;
      const shotId = `shot-${String(bIndex + 1).padStart(2, "0")}`;

      let endFrame = isLast ? totalFrames : Math.round((beat.endMs / 1000) * 24);
      if (endFrame <= currentFrame) endFrame = currentFrame + 24;
      if (isLast) endFrame = totalFrames;

      const semantics = analyzeSentenceSemantics(beat.text);
      const jevChoice = await evaluateSentenceDirector(beat.text, {
        apiKey,
        fetchFn,
        beatContext: {
          beatIndex: bIndex,
          totalBeats: beats.length,
          recentPoses: usedPuppetPoses.slice(-2),
        },
      });

      // Determine shot type using Jev + editorial rhythm:
      // - First shot is always talk-to-camera
      // - Last shot is always talk-to-camera
      // - Chibi commentary is reserved for comedic cutaways (max 1-2 per video)
      // - Text card is reserved for key quote/stats (max 1 per video)
      let shotType = "talk-to-camera";
      if (isFirst || isLast) {
        shotType = "talk-to-camera";
      } else if (
        jevChoice?.shotType === "chibi-commentary" ||
        (jevChoice?.isPunchline && chibiCount < maxChibi)
      ) {
        if (chibiCount < maxChibi && shots.at(-1)?.shotType !== "chibi-commentary") {
          shotType = "chibi-commentary";
          chibiCount += 1;
        }
      } else if (
        jevChoice?.shotType === "text-card" ||
        (brollMediaList?.length > 0 && bIndex === Math.floor(beats.length * 0.5))
      ) {
        if (brollMediaList?.length > 0) {
          shotType = "b-roll";
        } else if (textCardCount < maxTextCards && shots.at(-1)?.shotType !== "text-card") {
          shotType = "text-card";
          textCardCount += 1;
        }
      }

      if (shotType === "talk-to-camera") {
        let chosenPose = "neutral-listening";
        let rationale = "Natural conversational anchor";

        if (jevChoice?.shazPose) {
          const rawPose = jevChoice.shazPose;
          const resolved = resolvePuppetPoseId(rawPose);
          const conf = jevChoice.shazConfidence;

          // Natural performance rhythm:
          // If previous shot was an active physical gesture, default back to neutral-listening
          // unless Jev has very high confidence (>0.85) on a sharp emotional shift.
          if (lastPuppetPose && lastPuppetPose !== "neutral-listening") {
            if (conf >= 0.85 && resolved !== lastPuppetPose && resolved !== "neutral-listening") {
              chosenPose = puppetRotation.includes(resolved) ? resolved : "neutral-listening";
              rationale = `High-conviction actor shift: ${chosenPose} (${Math.round(conf * 100)}% conf)`;
            } else {
              chosenPose = "neutral-listening";
              rationale = "Breathing room anchor after physical gesture";
            }
          } else {
            // Previous was neutral or first shot
            if (resolved === "neutral-listening" || conf < 0.28) {
              chosenPose = "neutral-listening";
              rationale = `Conversational baseline (${Math.round(conf * 100)}% conf)`;
            } else {
              chosenPose = puppetRotation.includes(resolved) ? resolved : "neutral-listening";
              rationale = `Jev puppet actor instinct: ${chosenPose} (${Math.round(conf * 100)}% conf)`;
            }
          }
        }

        lastPuppetPose = chosenPose;
        if (chosenPose !== "neutral-listening") {
          usedPuppetPoses.push(chosenPose);
        }

        shots.push({
          id: shotId,
          shotType: "talk-to-camera",
          startFrame: currentFrame,
          endFrameExclusive: endFrame,
          backgroundId: defaultBackgroundId,
          poseId: chosenPose,
          rationale,
        });
      } else if (shotType === "chibi-commentary") {
        lastPuppetPose = null;
        let chosenPose = jevChoice?.chibiPose ?? semantics.chibiPose;
        let chosenBadge = jevChoice?.badge ?? semantics.badge;

        if (chosenPose === lastChibiPose) {
          chosenPose = chibiRotation.find((p) => p !== lastChibiPose) ?? "point-emphasis";
        }
        if (chosenBadge === lastBadge) {
          chosenBadge = badgeRotation.find((b) => b !== lastBadge) ?? "REALITY CHECK";
        }
        lastChibiPose = chosenPose;
        lastBadge = chosenBadge;

        const shotDuration = endFrame - currentFrame;
        shots.push({
          id: shotId,
          shotType: "chibi-commentary",
          startFrame: currentFrame,
          endFrameExclusive: endFrame,
          backgroundId: defaultBackgroundId,
          chibiPose: chosenPose,
          chibiRoutine: deriveChibiRoutine(chosenPose, shotDuration),
          card: {
            badge: chosenBadge,
            headline: semantics.headline,
            quote: beat.text.length > 60 ? beat.text.slice(0, 57) + "..." : beat.text,
            theme: semantics.theme,
            icon: semantics.icon,
          },
          rationale: jevChoice
            ? `Jev cutaway comedic instinct: ${chosenPose} (${Math.round((jevChoice.chibiConfidence || 0.8) * 100)}% conf)`
            : undefined,
        });
      } else if (shotType === "b-roll") {
        lastPuppetPose = null;
        const brollMedia = brollMediaList[bIndex % brollMediaList.length] ?? null;
        shots.push({
          id: shotId,
          shotType: "b-roll",
          startFrame: currentFrame,
          endFrameExclusive: endFrame,
          backgroundId: defaultBackgroundId,
          brollMedia,
          motion: jevChoice?.cameraMotion ?? "zoom-in",
        });
      } else if (shotType === "text-card") {
        lastPuppetPose = null;
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

    if (shots.length > 0 && currentFrame < totalFrames) {
      shots.at(-1).endFrameExclusive = totalFrames;
    }

    return {
      schemaVersion: MULTI_SHOT_SCHEMA,
      title: transcript.text ? transcript.text.slice(0, 60) : "Automatic Video",
      totalDurationFrames: totalFrames,
      shots,
    };
  } catch (err) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ JEV DIRECTOR FAILURE DURING MULTI-SHOT TIMELINE GENERATION\n` +
      `================================================================================\n` +
      `Jev failed to choreograph the scene beats:\n${err.message}\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Click 'Billing' at https://typesafe.ai/billing to check your balance or add credits.\n` +
      `3. Go to https://typesafe.ai/keys, click 'Create New Secret Key', and copy the key string.\n` +
      `4. Open 'secrets.env' at your repo root in your code editor.\n` +
      `5. Add or update: TYPESAFE_API_KEY=your_copied_key_here\n` +
      `6. Check https://status.typesafe.ai to verify services are operational.\n` +
      `7. Save 'secrets.env' and re-run your command.\n` +
      `================================================================================\n`
    );
  }
}

export { MULTI_SHOT_SCHEMA };


