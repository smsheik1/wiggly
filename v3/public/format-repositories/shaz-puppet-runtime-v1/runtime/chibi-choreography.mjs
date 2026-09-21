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
    description: "Front-facing neutral delivery, open conversational posture",
    defaultWeight: 35,
  },
  "present-card": {
    file: "Timeline 1_0005.png",
    description: "Body angled left, right hand extended presenting topic card/media",
    defaultWeight: 30,
  },
  "think-chin": {
    file: "Timeline 1_0008.png",
    description: "Head tilted down, hand propping up chin, introspective posture",
    defaultWeight: 25,
  },
  "shrug-open": {
    file: "Timeline 1_0011.png",
    description: "Hands out to sides, playful questioning or disbelief posture",
    defaultWeight: 25,
  },
  "point-emphasis": {
    file: "Timeline 1_0013.png",
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

export function buildChibiSchedule({ routine, durationFrames }) {
  if (!Number.isInteger(durationFrames) || durationFrames <= 0) {
    throw new Error(`buildChibiSchedule requires positive integer durationFrames, got ${durationFrames}`);
  }

  const holdList = Array.isArray(routine) && routine.length > 0
    ? routine.map(normalizeChibiHold)
    : ["present-card"];

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
      for (let i = 0; i < duration; i += 1) {
        schedule.push(step.file);
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
