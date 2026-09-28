import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const VALID_CAMERAS = ["two-shot", "cat-close", "bunny-close"];
export const VALID_SPEAKERS = ["cat", "bunny", "both", "none"];
export const VALID_REACTIONS = [
  "smug-cat",
  "panicked-bunny",
  "deadpan-stare",
  "excited-hop",
  "dramatic-gasp",
  "skeptical-squint",
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
      `Cannot direct Animal Conversations: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Animal Conversations Director', and copy the generated key.\n` +
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
export function planAnimalBeatDeterministic(beat, { beatContext } = {}) {
  const index = beatContext?.beatIndex ?? 0;
  const recentCameras = beatContext?.recentCameras || [];
  const speaker = beat.speaker || "cat";

  // Determine dynamic camera: focus on active speaker or wide two-shot
  let camera = "two-shot";
  if (speaker === "cat") {
    camera = (index % 3 === 1) ? "cat-close" : "two-shot";
  } else if (speaker === "bunny") {
    camera = (index % 3 === 1) ? "bunny-close" : "two-shot";
  } else {
    camera = "two-shot";
  }

  // Prevent camera stagnation (never 3 consecutive identical cameras)
  if (recentCameras.length >= 2 && recentCameras[0] === camera && recentCameras[1] === camera) {
    const alternates = VALID_CAMERAS.filter((c) => c !== camera);
    camera = alternates[0] || "two-shot";
  }

  // Determine bounce emphasis based on caption length and punctuation
  const text = (beat.caption || beat.vocalization || "").trim();
  const hasExclamation = text.includes("!") || text.includes("?");
  const duration = (beat.end || 2.0) - (beat.start || 0);

  let bounceAt = [];
  if (hasExclamation && duration >= 0.8) {
    bounceAt = [Number((Math.min(0.25, duration * 0.2)).toFixed(2))];
    if (duration >= 1.6) {
      bounceAt.push(Number((Math.min(duration - 0.3, duration * 0.7)).toFixed(2)));
    }
  }

  let reaction = speaker === "cat" ? "smug-cat" : "panicked-bunny";
  if (index === 0) reaction = "skeptical-squint";
  else if (hasExclamation) reaction = "excited-hop";

  return {
    camera,
    cameraConfidence: 1.0,
    bounceAt,
    reaction,
    reactionConfidence: 1.0,
    isPunchline: Boolean(beatContext?.isLastBeat || index === (beatContext?.totalBeats || 1) - 1),
    provenance: "deterministic-variety-planner",
  };
}

/**
 * Directs a single dialogue beat in Animal Conversations using Jev System One.
 */
export async function evaluateAnimalBeatDirector(beat, { apiKey, fetchFn, beatContext } = {}) {
  const questions = {
    camera: {
      type: "choice",
      instructions: "Which camera shot best frames this dialogue turn or comedic reaction?",
      criteria: {
        "two-shot": "Classic wide two-shot showing both the cat and bunny and their physical body language",
        "cat-close": "Punchy close-up on the cat emphasizing a smug face, deadpan retort, or feline reaction",
        "bunny-close": "Energetic close-up on the bunny capturing wide eyes, agitation, or hyperactive talking",
      },
    },
    reaction_attitude: {
      type: "choice",
      instructions: "What expressive comedic attitude drives this delivery?",
      criteria: {
        "smug-cat": "Confident, slightly condescending feline composure",
        "panicked-bunny": "Frantic, rapid-fire, wide-eyed rabbit stress or excitement",
        "deadpan-stare": "Complete lack of amusement, staring in flat disbelief",
        "excited-hop": "Bouncy, playful enthusiasm",
        "dramatic-gasp": "Theatrical over-the-top shock or audible gasp",
        "skeptical-squint": "Narrowed eyes questioning the other character's sanity",
      },
    },
    has_bounce_emphasis: {
      type: "noul",
      instructions: "Does this line have energetic physical emphasis that warrants a vertical character hop/bounce?",
    },
    is_punchline: {
      type: "noul",
      instructions: "Is this line delivering the closing comedic punchline of the conversation?",
    },
  };

  const state = {
    speaker: beat.speaker,
    spoken_caption: beat.caption || "(no speech)",
    vocalization: beat.vocalization || "(none)",
    duration: ((beat.end || 0) - (beat.start || 0)).toFixed(2),
    beat_progression: beatContext
      ? `Beat ${beatContext.beatIndex + 1} of ${beatContext.totalBeats}`
      : undefined,
    recent_cameras: beatContext?.recentCameras?.length > 0 ? beatContext.recentCameras : ["none yet"],
    direction_goal:
      "Direct the Cat & Bunny conversation with snappy cartoon comedic timing, " +
      "dynamic camera switching between close-ups and two-shots, and natural physical bounce accents.",
  };

  const result = await callJevSystemOne({ state, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    throw new Error("Jev System One returned an empty response object.");
  }

  const answers = result.answers;

  let camera = answers.camera?.choice;
  if (!VALID_CAMERAS.includes(camera)) {
    camera = beat.speaker === "cat" ? "cat-close" : beat.speaker === "bunny" ? "bunny-close" : "two-shot";
  }

  // Prevent camera stagnation (avoid 3 consecutive identical cameras)
  if (beatContext?.recentCameras?.length >= 2 &&
      beatContext.recentCameras[0] === camera &&
      beatContext.recentCameras[1] === camera) {
    const alternates = VALID_CAMERAS.filter((c) => c !== camera);
    camera = alternates[0] || "two-shot";
  }

  let reaction = answers.reaction_attitude?.choice;
  if (!VALID_REACTIONS.includes(reaction)) {
    reaction = beat.speaker === "cat" ? "smug-cat" : "panicked-bunny";
  }

  const hasBounce = Boolean(answers.has_bounce_emphasis?.condition);
  const durationNum = Math.max(0.5, (beat.end || 2.0) - (beat.start || 0));
  let bounceAt = [];
  if (hasBounce && durationNum >= 0.6) {
    bounceAt.push(Number((Math.min(0.2, durationNum * 0.15)).toFixed(2)));
    if (durationNum >= 1.5) {
      bounceAt.push(Number((Math.min(durationNum - 0.25, durationNum * 0.65)).toFixed(2)));
    }
  }

  const isPunchline = Boolean(answers.is_punchline?.condition);

  return {
    camera,
    cameraConfidence: answers.camera?.confidence ?? 0.95,
    reaction,
    reactionConfidence: answers.reaction_attitude?.confidence ?? 0.95,
    bounceAt,
    isPunchline,
    provenance: "typesafe-jev-system-one",
  };
}

/**
 * Directs an entire Animal Conversations timeline with variety-first camera choreography.
 */
export async function directAnimalConversation(episodeInput, { apiKey, fetchFn, mode = "auto" } = {}) {
  const timeline = episodeInput.timeline || [];
  const directedTimeline = [];
  const recentCameras = [];

  const useDeterministic = mode === "deterministic";

  for (let i = 0; i < timeline.length; i += 1) {
    const beat = timeline[i];
    const beatContext = {
      beatIndex: i,
      totalBeats: timeline.length,
      recentCameras: [...recentCameras],
      isLastBeat: i === timeline.length - 1,
    };

    let direction;
    if (useDeterministic) {
      direction = planAnimalBeatDeterministic(beat, { beatContext });
    } else {
      direction = await evaluateAnimalBeatDirector(beat, { apiKey, fetchFn, beatContext });
    }

    recentCameras.unshift(direction.camera);

    directedTimeline.push({
      start: beat.start,
      end: beat.end,
      speaker: beat.speaker,
      camera: direction.camera,
      caption: beat.caption,
      captionSpeaker: beat.captionSpeaker,
      vocalization: beat.vocalization,
      bounceAt: direction.bounceAt.length > 0 ? direction.bounceAt : undefined,
      directionMetadata: {
        reaction: direction.reaction,
        isPunchline: direction.isPunchline,
        provenance: direction.provenance,
      },
    });
  }

  return {
    schemaVersion: 1,
    title: episodeInput.title,
    episodeLabel: episodeInput.episodeLabel,
    audioFile: episodeInput.audioFile,
    background: episodeInput.background,
    timeline: directedTimeline,
    directedAt: new Date().toISOString(),
    director: "Jev System One Autonomous Actor Director",
  };
}
