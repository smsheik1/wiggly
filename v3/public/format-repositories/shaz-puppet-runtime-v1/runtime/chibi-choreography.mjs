/**
 * Chibi Shaz Kinetic Animation & Choreography Engine
 *
 * Implements classical animation physics (anticipation, squash & stretch, cushions, and settle)
 * discovered from frame-by-frame analysis of the animator reference video.
 *
 * Core Hold Poses (acting presence):
 * - talk-gesture: front-facing conversational anchor
 * - present-card: body angled, arm pointing to screen/card
 * - think-chin: head tilted, hand on chin, deliberating
 * - shrug-open: hands out, playful disbelief / questioning
 * - point-emphasis: decisive pointing gesture
 */

export const CHIBI_HOLDS = {
  "talk-gesture": {
    file: "Timeline 1_0003x.png",
    overshootFile: "Timeline 1_0001.png",
    reboundFile: "Timeline 1_0002.png",
    accentFile: "Timeline 1_0001.png",
    description: "Front-facing neutral delivery, open conversational posture",
    defaultWeight: 35,
  },
  "present-card": {
    file: "Timeline 1_0005.png",
    overshootFile: "Timeline 1_0004x.png",
    reboundFile: "Timeline 1_0006.png",
    accentFile: "Timeline 1_0004x.png",
    description: "Body angled left, right hand extended presenting topic card/media",
    defaultWeight: 30,
  },
  "think-chin": {
    file: "Timeline 1_0008.png",
    overshootFile: "Timeline 1_0007x.png",
    reboundFile: "Timeline 1_0009.png",
    accentFile: "Timeline 1_0007x.png",
    description: "Head tilted down, hand propping up chin, introspective posture",
    defaultWeight: 25,
  },
  "shrug-open": {
    file: "Timeline 1_0011.png",
    overshootFile: "Timeline 1_0010.png",
    reboundFile: "Timeline 1_0012.png",
    accentFile: "Timeline 1_0010.png",
    description: "Hands out to sides, playful questioning or disbelief posture",
    defaultWeight: 25,
  },
  "point-emphasis": {
    file: "Timeline 1_0013.png",
    overshootFile: "Timeline 1_0012.png",
    reboundFile: "Timeline 1_0014.png",
    accentFile: "Timeline 1_0012.png",
    description: "Arm extended pointing toward topic/audience for decisive emphasis",
    defaultWeight: 20,
  },
};

// Aliases for compatibility with earlier asset IDs
export const CHIBI_POSE_ALIASES = {
  "talk-excited-1": "talk-gesture",
  "talk-excited-2": "talk-gesture",
  "talk-gesture-1": "talk-gesture",
  "talk-gesture-2": "talk-gesture",
  "talk-smile": "present-card",
  "present-open": "present-card",
  "present-gesture": "present-card",
  "think-chin": "think-chin",
  "think-down": "think-chin",
  "shrug-smile": "shrug-open",
  "listen-side": "shrug-open",
  "talk-laugh": "talk-gesture",
  "point-side": "point-emphasis",
  "point-up": "point-emphasis",
  "celebrate": "point-emphasis",
  "facepalm": "shrug-open",
};

/**
 * Transition Cushions: 1-2 frames of squash, stretch, and anticipation
 * that connect hold poses dynamically.
 */
export const CHIBI_TRANSITIONS = {
  entrance: [
    { file: "Timeline 1_0000In.png", frames: 2 }, // enter smear
    { file: "Timeline 1_0001.png", frames: 2 },   // squash / anticipation
    { file: "Timeline 1_0002.png", frames: 1 },   // settle bounce
  ],
  exit: [
    { file: "Timeline 1_0014.png", frames: 1 },   // crouch windup
    { file: "Timeline 1_0015.png", frames: 2 },   // apex celebration stretch
    { file: "Timeline 1_0016.png", frames: 2 },   // exit smear
  ],
  cushions: {
    "talk-gesture->present-card": [
      { file: "Timeline 1_0004x.png", frames: 2 },
    ],
    "present-card->think-chin": [
      { file: "Timeline 1_0006.png", frames: 2 },
      { file: "Timeline 1_0007x.png", frames: 2 },
    ],
    "think-chin->shrug-open": [
      { file: "Timeline 1_0009.png", frames: 2 },
      { file: "Timeline 1_0010.png", frames: 2 },
    ],
    "shrug-open->point-emphasis": [
      { file: "Timeline 1_0012.png", frames: 2 },
    ],
    "present-card->point-emphasis": [
      { file: "Timeline 1_0012.png", frames: 2 },
    ],
    "talk-gesture->think-chin": [
      { file: "Timeline 1_0006.png", frames: 2 },
      { file: "Timeline 1_0007x.png", frames: 2 },
    ],
    "talk-gesture->shrug-open": [
      { file: "Timeline 1_0009.png", frames: 2 },
      { file: "Timeline 1_0010.png", frames: 2 },
    ],
    "talk-gesture->point-emphasis": [
      { file: "Timeline 1_0012.png", frames: 2 },
    ],
    "present-card->shrug-open": [
      { file: "Timeline 1_0009.png", frames: 2 },
      { file: "Timeline 1_0010.png", frames: 2 },
    ],
    "think-chin->present-card": [
      { file: "Timeline 1_0004x.png", frames: 2 },
    ],
    "think-chin->point-emphasis": [
      { file: "Timeline 1_0012.png", frames: 2 },
    ],
    "shrug-open->present-card": [
      { file: "Timeline 1_0004x.png", frames: 2 },
    ],
    "shrug-open->think-chin": [
      { file: "Timeline 1_0006.png", frames: 2 },
      { file: "Timeline 1_0007x.png", frames: 2 },
    ],
    "point-emphasis->present-card": [
      { file: "Timeline 1_0004x.png", frames: 2 },
    ],
    "point-emphasis->think-chin": [
      { file: "Timeline 1_0006.png", frames: 2 },
      { file: "Timeline 1_0007x.png", frames: 2 },
    ],
    "point-emphasis->shrug-open": [
      { file: "Timeline 1_0010.png", frames: 2 },
    ],
  },
};

export function normalizeChibiHold(poseId) {
  if (!poseId) return "present-card";
  if (CHIBI_HOLDS[poseId]) return poseId;
  if (CHIBI_POSE_ALIASES[poseId]) return CHIBI_POSE_ALIASES[poseId];
  return "present-card";
}

/**
 * Derives an authentic clause-level Chibi Shaz acting progression matching the human animator reference
 * (~15-30 frames / 0.6s - 1.2s per hold), connected by 2-frame squash/stretch cushions.
 *
 * @param {string} [primaryPose="present-card"] - The key thematic pose or emotional peak
 * @param {number} [durationFrames=72] - Total shot duration in frames
 * @returns {string[]} Array of hold pose IDs
 */
export function deriveChibiRoutine(primaryPose = "present-card", durationFrames = 72) {
  const norm = normalizeChibiHold(primaryPose);

  // Short shots (< 36 frames / 1.5s): 1 clear hold
  if (durationFrames < 36) {
    return [norm];
  }

  // Medium shots (36-63 frames / 1.5s - 2.6s): 2-step setup -> payoff
  if (durationFrames < 64) {
    const mediumPairs = {
      "point-emphasis": ["think-chin", "point-emphasis"],
      "present-card": ["talk-gesture", "present-card"],
      "think-chin": ["talk-gesture", "think-chin"],
      "shrug-open": ["present-card", "shrug-open"],
      "talk-gesture": ["talk-gesture", "present-card"],
    };
    return mediumPairs[norm] ?? ["talk-gesture", norm];
  }

  // Standard shots (64-95 frames / 2.7s - 4.0s): 3-step conversational progression
  if (durationFrames < 96) {
    const standardTriads = {
      "point-emphasis": ["talk-gesture", "think-chin", "point-emphasis"],
      "present-card": ["talk-gesture", "present-card", "think-chin"],
      "think-chin": ["talk-gesture", "present-card", "think-chin"],
      "shrug-open": ["talk-gesture", "think-chin", "shrug-open"],
      "talk-gesture": ["present-card", "think-chin", "talk-gesture"],
    };
    return standardTriads[norm] ?? ["talk-gesture", "present-card", norm];
  }

  // Long shots (>= 96 frames / 4.0s+): 4-step dynamic acting routine
  const longQuads = {
    "point-emphasis": ["talk-gesture", "present-card", "think-chin", "point-emphasis"],
    "present-card": ["talk-gesture", "present-card", "think-chin", "shrug-open"],
    "think-chin": ["talk-gesture", "present-card", "think-chin", "shrug-open"],
    "shrug-open": ["talk-gesture", "present-card", "think-chin", "shrug-open"],
    "talk-gesture": ["present-card", "think-chin", "shrug-open", "talk-gesture"],
  };
  return longQuads[norm] ?? ["talk-gesture", "present-card", "think-chin", norm];
}

export function buildChibiSchedule({ routine, durationFrames }) {
  if (!Number.isInteger(durationFrames) || durationFrames <= 0) {
    throw new Error(`buildChibiSchedule requires positive integer durationFrames, got ${durationFrames}`);
  }

  let holdList = Array.isArray(routine) && routine.length > 0
    ? routine.map(normalizeChibiHold)
    : ["present-card"];

  // Root-level guardrail for blind agents:
  // If only a single static hold was supplied for a shot >= 48 frames (2.0s),
  // automatically expand into an authentic clause-level progression so characters never freeze.
  if (holdList.length === 1 && durationFrames >= 48) {
    holdList = deriveChibiRoutine(holdList[0], durationFrames);
  }

  const steps = [];

  for (const item of CHIBI_TRANSITIONS.entrance) {
    steps.push({ type: "fixed", file: item.file, frames: item.frames });
  }

  for (let i = 0; i < holdList.length; i += 1) {
    const currentHoldId = holdList[i];
    const holdDef = CHIBI_HOLDS[currentHoldId];

    if (i > 0) {
      const prevHoldId = holdList[i - 1];
      if (prevHoldId !== currentHoldId) {
        const cushionKey = `${prevHoldId}->${currentHoldId}`;
        const cushions = CHIBI_TRANSITIONS.cushions[cushionKey] ?? [
          { file: "Timeline 1_0004x.png", frames: 2 },
        ];
        for (const c of cushions) {
          steps.push({ type: "fixed", file: c.file, frames: c.frames });
        }
      }
    }

    steps.push({
      type: "hold",
      id: currentHoldId,
      file: holdDef.file,
      weight: holdDef.defaultWeight,
    });
  }

  for (const item of CHIBI_TRANSITIONS.exit) {
    steps.push({ type: "fixed", file: item.file, frames: item.frames });
  }

  const fixedTotal = steps
    .filter((s) => s.type === "fixed")
    .reduce((acc, s) => acc + s.frames, 0);

  const holdSteps = steps.filter((s) => s.type === "hold");
  const totalWeight = holdSteps.reduce((acc, s) => acc + s.weight, 0);
  const framesForHolds = Math.max(holdSteps.length, durationFrames - fixedTotal);

  const schedule = [];
  let allocatedHolds = 0;

  for (const step of steps) {
    if (step.type === "fixed") {
      for (let i = 0; i < step.frames; i += 1) {
        schedule.push(step.file);
      }
    } else if (step.type === "hold") {
      const isLastHold = step === holdSteps.at(-1);
      let duration = Math.max(1, Math.round((step.weight / totalWeight) * framesForHolds));
      if (isLastHold) {
        duration = Math.max(1, framesForHolds - allocatedHolds);
      } else {
        allocatedHolds += duration;
      }

      const holdDef = CHIBI_HOLDS[step.id];
      const settleFile = holdDef?.file ?? step.file;

      for (let i = 0; i < duration; i += 1) {
        schedule.push(settleFile);
      }
    }
  }

  while (schedule.length < durationFrames) {
    const firstHoldIndex = schedule.indexOf(holdSteps[0].file);
    const insertIndex = firstHoldIndex >= 0 ? firstHoldIndex : Math.floor(schedule.length / 2);
    schedule.splice(insertIndex, 0, holdSteps[0].file);
  }

  if (schedule.length > durationFrames) {
    schedule.length = durationFrames;
  }

  return schedule;
}

/**
 * Computes choppy 2D transforms (anticipation squash, overshoot, undershoot rebound, living speech beats)
 * stepped strictly on twos (12 fps animated cadence) for authentic kinetic anime/cartoon physics.
 *
 * @param {number} frameIndex - Current 0-based frame within the shot
 * @param {number} totalFrames - Total duration of the shot in frames
 * @returns {{ dx: number, dy: number, sx: number, sy: number, phase: string }}
 */
export function getChibiFrameTransform(frameIndex, totalFrames) {
  // Stepped on twos for snappy, hand-drawn cartoon exposure timing
  const steppedFrame = Math.floor(frameIndex / 2) * 2;
  const framesFromEnd = totalFrames - 1 - steppedFrame;

  // 1. Entrance Phase (first 8 frames)
  if (steppedFrame <= 1) {
    // Entrance smear in from bottom-right corner
    return { dx: 35, dy: 45, sx: 0.92, sy: 0.92, phase: "entrance-smear" };
  }
  if (steppedFrame <= 3) {
    // Anticipation squash at touchdown
    return { dx: 4, dy: 12, sx: 1.06, sy: 0.92, phase: "anticipation-squash" };
  }
  if (steppedFrame <= 5) {
    // Kinetic OVERSHOOT popping UP past target rest height
    return { dx: -2, dy: -22, sx: 0.96, sy: 1.06, phase: "entrance-overshoot" };
  }
  if (steppedFrame <= 7) {
    // Rebound UNDERSHOOT dipping below rest height before settle
    return { dx: 1, dy: 6, sx: 1.02, sy: 0.98, phase: "entrance-undershoot" };
  }

  // 2. Exit Phase (last 6 frames)
  if (framesFromEnd <= 1) {
    // Exit smear zooming out into bottom-right corner
    return { dx: 45, dy: 50, sx: 0.85, sy: 0.85, phase: "exit-smear" };
  }
  if (framesFromEnd <= 3) {
    // Apex celebration stretch / jump OVERSHOOT exploding upwards
    return { dx: -6, dy: -32, sx: 0.93, sy: 1.08, phase: "exit-overshoot" };
  }
  if (framesFromEnd <= 5) {
    // Crouch windup / anticipation squash before launch
    return { dx: 0, dy: 12, sx: 1.06, sy: 0.92, phase: "exit-crouch" };
  }

  // 3. Body / Hold Phase: Established hold followed by living speech & reaction beats
  // Hold is established cleanly for frames 8..23
  // Periodic 16-frame cycle starting at frame 24:
  // beat 0-1: accent pop overshoot
  // beat 2-3: rebound undershoot
  // beat 4-15: settle rest
  if (steppedFrame >= 24) {
    const holdStep = (steppedFrame - 24) % 16;
    if (holdStep === 0) {
      return { dx: -2, dy: -12, sx: 0.97, sy: 1.04, phase: "beat-overshoot" };
    }
    if (holdStep === 2) {
      return { dx: 1, dy: 5, sx: 1.01, sy: 0.99, phase: "beat-undershoot" };
    }
  }

  // Neutral settle hold
  return { dx: 0, dy: 0, sx: 1.0, sy: 1.0, phase: "settle-hold" };
}
