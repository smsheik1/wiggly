import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const VALID_ROAST_POSES = ["neutral", "talk", "laugh", "shock"];

export const VALID_REACTION_ATTITUDES = [
  "savage-laugh",
  "dramatic-gasp",
  "smug-chuckle",
  "feigned-sympathy",
  "stunned-silence",
];

/**
 * Loads the TypeSafe API key from secrets.env or environment variables.
 */
export function getTypesafeApiKey() {
  if (process.env.TYPESAFE_API_KEY) {
    return process.env.TYPESAFE_API_KEY.trim();
  }
  if (process.env.JEV_API_KEY) {
    return process.env.JEV_API_KEY.trim();
  }

  // Walk up directories to find secrets.env
  let currentDir = process.cwd();
  for (let i = 0; i < 7; i += 1) {
    const candidate = path.join(currentDir, "secrets.env");
    if (fs.existsSync(candidate)) {
      try {
        const lines = fs.readFileSync(candidate, "utf8").split("\n");
        for (const line of lines) {
          if (line.startsWith("TYPESAFE_API_KEY=") || line.startsWith("JEV_API_KEY=")) {
            const val = line.split("=")[1]?.trim();
            if (val) return val;
          }
        }
      } catch {
        // Ignore read errors
      }
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  return null;
}

/**
 * Calls Jev System One API with typed questions.
 * Enforces Rule 12: Zero silent fallbacks on missing credentials or HTTP failures.
 */
export async function callJevSystemOne({ state, questions, apiKey: explicitKey, fetchFn = fetch }) {
  const key = explicitKey !== undefined ? explicitKey : getTypesafeApiKey();
  if (!key) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ JEV DIRECTOR FAILURE: TYPESAFE_API_KEY IS MISSING\n` +
      `================================================================================\n` +
      `Cannot direct Roast Me Conversation: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Roast Me Director', and copy the generated key.\n` +
      `4. Check your account balance: Click 'Billing' in the left menu (https://typesafe.ai/billing) and ensure you have an active card or available credits.\n` +
      `5. Open your local 'secrets.env' file (located at the root of your Wiggly repository) in your code editor.\n` +
      `6. Add or update this exact line:\n` +
      `   TYPESAFE_API_KEY=your_copied_key_here\n` +
      `7. Save the file and re-run your command.\n` +
      `================================================================================\n`
    );
  }

  const response = await fetchFn(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state,
      questions,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `\n================================================================================\n` +
      `❌ JEV DIRECTOR API ERROR (HTTP ${response.status})\n` +
      `================================================================================\n` +
      `The TypeSafe Jev API call failed with response:\n${errText}\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/billing\n` +
      `2. Check your balance/credits to confirm your account has active credits or an unexpired payment card. Click 'Add Credits' if balance is 0.\n` +
      `3. Go to https://typesafe.ai/keys, confirm your key is active, or click 'Create New Key'.\n` +
      `4. Open 'secrets.env' at your repo root and update TYPESAFE_API_KEY with your verified key.\n` +
      `5. Check https://status.typesafe.ai to verify TypeSafe API services are operational.\n` +
      `6. Save 'secrets.env' and re-run your command.\n` +
      `================================================================================\n`
    );
  }

  return response.json();
}

/**
 * Deterministic variety-first planner for offline tests and explicit dry-run mode.
 */
export function planRoastCueDeterministic(event, { cueContext } = {}) {
  const index = cueContext?.cueIndex ?? 0;
  const recentPoses = cueContext?.recentPoses || [];
  const recentFlips = cueContext?.recentFlips || [];

  let pose = "neutral";
  if (index === 0) {
    pose = "neutral";
  } else if (event.type === "hook") {
    pose = "talk";
  } else if (event.type === "turn") {
    const isVictim = event.sender === "me";
    const text = String(event.text || "").toLowerCase();
    const hasBurn = text.includes("?") || text.includes("!") || text.length > 25;

    if (isVictim) {
      pose = "talk";
    } else if (hasBurn) {
      pose = index % 2 === 0 ? "laugh" : "shock";
    } else {
      pose = "talk";
    }
  }

  // Prevent consecutive identical poses
  if (recentPoses.length > 0 && pose === recentPoses[0]) {
    const alternates = VALID_ROAST_POSES.filter((p) => p !== recentPoses[0]);
    pose = alternates[index % alternates.length] || "talk";
  }

  // Alternate flip for lively avatar staging
  let flip = false;
  if (recentFlips.length > 0) {
    flip = !recentFlips[0];
  } else {
    flip = index % 2 === 1;
  }

  let attitude = "smug-chuckle";
  if (pose === "laugh") attitude = "savage-laugh";
  else if (pose === "shock") attitude = "dramatic-gasp";
  else if (pose === "talk") attitude = "feigned-sympathy";

  return {
    pose,
    poseConfidence: 1.0,
    flip,
    attitude,
    attitudeConfidence: 1.0,
    provenance: "deterministic-variety-planner",
  };
}

/**
 * Directs a single roast event / message cue using Jev System One.
 */
export async function evaluateRoastCueDirector(event, { apiKey, fetchFn, cueContext } = {}) {
  const questions = {
    presenter_pose: {
      type: "choice",
      instructions: "Which 2D avatar presenter pose best reacts to this roast moment?",
      criteria: {
        "neutral": "Calm, deadpan listening posture setting up the text message interaction",
        "talk": "Active commentary / reading posture with raised index finger",
        "laugh": "Savage laughing posture with tongue out and celebratory victory fist reacting to a devastating burn",
        "shock": "Wide-eyed open-mouthed disbelief at an unbelievable text or awkward confession",
      },
    },
    horizontal_flip: {
      type: "noul",
      instructions: "Should the character avatar flip horizontally to face the incoming message bubble?",
    },
    comedic_attitude: {
      type: "choice",
      instructions: "What comedic delivery attitude underlines the reaction?",
      criteria: {
        "savage-laugh": "Relentless laughter at the victim getting absolutely cooked",
        "dramatic-gasp": "Feigned or genuine shock at the audacity of the message",
        "smug-chuckle": "Knowing smirk recognizing the brutal comeback",
        "feigned-sympathy": "Mock pity for the victim's inevitable defeat",
        "stunned-silence": "Frozen in second-hand embarrassment",
      },
    },
  };

  const state = {
    event_type: event.type,
    sender: event.sender,
    text: event.text || "(hook setup)",
    timestamp_seconds: event.atSeconds,
    cue_progression: cueContext
      ? `Cue ${cueContext.cueIndex + 1} of ${cueContext.totalCues}`
      : undefined,
    recent_poses: cueContext?.recentPoses?.length > 0 ? cueContext.recentPoses : ["none yet"],
    direction_goal:
      "Direct the 2D PNGtuber presenter reactions with energetic comedic variety, " +
      "matching burns and setups with punchy laugh, shock, and talking poses without visual stagnation.",
  };

  const result = await callJevSystemOne({ state, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    throw new Error("Jev System One returned an empty response object.");
  }

  const answers = result.answers;

  let pose = answers.presenter_pose?.choice;
  if (!VALID_ROAST_POSES.includes(pose)) {
    pose = "talk";
  }

  // Enforce variety guardrail: avoid consecutive identical poses
  if (cueContext?.recentPoses?.[0] === pose) {
    const alternates = VALID_ROAST_POSES.filter((p) => p !== cueContext.recentPoses[0]);
    pose = alternates[0] || "neutral";
  }

  let flip = Boolean(answers.horizontal_flip?.condition);
  if (cueContext?.recentFlips?.length > 0 && cueContext.recentFlips[0] === flip) {
    flip = !cueContext.recentFlips[0];
  }

  let attitude = answers.comedic_attitude?.choice;
  if (!VALID_REACTION_ATTITUDES.includes(attitude)) {
    attitude = "savage-laugh";
  }

  return {
    pose,
    poseConfidence: answers.presenter_pose?.confidence ?? 0.95,
    flip,
    attitude,
    attitudeConfidence: answers.comedic_attitude?.confidence ?? 0.95,
    provenance: "typesafe-jev-system-one",
  };
}

/**
 * Directs all presenter cues across a Roast Me Conversation episode.
 */
export async function directRoastEpisode(episodeInput, { apiKey, fetchFn, mode = "auto" } = {}) {
  const events = [];

  // Hook event
  if (episodeInput.hook) {
    events.push({
      type: "hook",
      atSeconds: 0,
      text: episodeInput.hook.text,
      sender: episodeInput.hook.authorName,
    });
  }

  // Turn events across contacts
  let currentTime = episodeInput.hook?.durationSeconds || 0;
  for (const contact of episodeInput.contacts || []) {
    for (const turn of contact.turns || []) {
      events.push({
        type: "turn",
        atSeconds: Number(currentTime.toFixed(2)),
        text: turn.text,
        sender: turn.sender,
      });
      currentTime += Number(turn.durationSeconds || 2);
    }
  }

  const directedCues = [];
  const recentPoses = [];
  const recentFlips = [];

  const useDeterministic = mode === "deterministic";

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const cueContext = {
      cueIndex: i,
      totalCues: events.length,
      recentPoses: [...recentPoses],
      recentFlips: [...recentFlips],
    };

    let direction;
    if (useDeterministic) {
      direction = planRoastCueDeterministic(event, { cueContext });
    } else {
      direction = await evaluateRoastCueDirector(event, { apiKey, fetchFn, cueContext });
    }

    recentPoses.unshift(direction.pose);
    recentFlips.unshift(direction.flip);

    directedCues.push({
      atSeconds: event.atSeconds,
      pose: direction.pose,
      flip: direction.flip,
      directionMetadata: {
        attitude: direction.attitude,
        provenance: direction.provenance,
      },
    });
  }

  const cloned = JSON.parse(JSON.stringify(episodeInput));
  cloned.presenter = cloned.presenter || {
    enabled: true,
    character: "male",
    sway: { cycleSeconds: 1.4, maxAngleDeg: 2.2, maxHorizontalPx: 16, maxVerticalPx: 6 },
  };
  cloned.presenter.cues = directedCues;
  cloned.directedAt = new Date().toISOString();
  cloned.director = "Jev System One Autonomous Actor Director";

  return cloned;
}
