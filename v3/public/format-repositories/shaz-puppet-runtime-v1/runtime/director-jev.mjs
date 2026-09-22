import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { normalizeChibiHold } from "./chibi-choreography.mjs";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

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
 */
export async function callJevSystemOne({ state, questions, apiKey: explicitKey, fetchFn = fetch }) {
  const key = explicitKey !== undefined ? explicitKey : getTypesafeApiKey();
  if (!key) {
    return null;
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
    throw new Error(`Jev API error (HTTP ${response.status}): ${errText}`);
  }

  return response.json();
}

/**
 * Directs a single spoken commentary sentence using Jev.
 * Returns { chibiPose, cameraMotion, badge, isPunchline } or null if Jev is unavailable.
 */
export async function evaluateSentenceDirector(sentence, { apiKey, fetchFn } = {}) {
  const questions = {
    chibi_pose: {
      type: "choice",
      instructions: "Which animated Shaz character gesture fits the comedic tone of this beat best?",
      criteria: {
        "point-emphasis": "Asserting a fact, dropping a bomb, pointing out something crucial, calling someone out",
        "facepalm": "Total disbelief, exasperation, facepalm moment at absurdity or stupidity",
        "shrug-open": "Confusion, questioning who this is for, 'who knows', disbelief, helplessness",
        "think-chin": "Analyzing logically, skeptical thinking, pondering, questioning assumptions",
        "present-card": "Presenting data, asking a question, wrapping up, call to action, welcoming",
        "talk-gesture": "General energetic speaking animation, narrative momentum",
      },
    },
    camera_motion: {
      type: "choice",
      instructions: "Which virtual camera move matches the drama and pacing of this beat?",
      criteria: {
        "zoom-in": "Dramatic push-in or punch-in building tension or emphasizing a focal point",
        "zoom-out": "Pulling back to reveal wide context or comic relief",
        "pan-right": "Cinematic sweeping move panning right to track momentum",
        "pan-left": "Cinematic sweeping move panning left to reveal elements",
        "pan-up": "Sweeping camera move upwards",
        "pan-down": "Sweeping camera move downwards",
      },
    },
    badge_category: {
      type: "choice",
      instructions: "What short graphic badge category should display on the topic card?",
      criteria: {
        "BREAKING": "Breaking news, fresh announcement, new leak or reveal",
        "THE CLASH": "Controversy, fight, debate, community outrage, drama",
        "REALITY CHECK": "Skeptical analysis, logic check, questioning corporate claims",
        "COMMUNITY ROAST": "Jokes, memes, viral comments, roasts",
        "YOUR VERDICT": "Audience call to action, question to the viewer",
      },
    },
    is_punchline: {
      type: "noul",
      instructions: "Is this sentence delivering a comedic punchline or sarcastic joke?",
    },
    shot_type: {
      type: "choice",
      instructions: "What visual shot format best serves this sentence in a video commentary? Default to talk-to-camera unless there is a strong comedic cutaway or statistical quote.",
      criteria: {
        "talk-to-camera": "Standard anchor: Shaz speaking directly to the viewer on camera. Use this for 75%+ of sentences.",
        "chibi-commentary": "Comedic cutaway: Chibi animated character with pop card for an exaggerated roast, funny tangent, or sarcastic aside.",
        "text-card": "Graphic card: Big bold full-screen kinetic text card to highlight an astonishing quote, statistic, or critical takeaway.",
      },
    },
    shaz_puppet_pose: {
      type: "choice",
      instructions: "Which approved puppet gesture best suits Shaz speaking this line? Select neutral-listening for regular narration, or select an active gesture (point, think, confident, present, aha) when the line delivers emphasis, skepticism, punchlines, or conclusion.",
      criteria: {
        "neutral-listening": "Default baseline narration without overt arm movement",
        "point": "Direct emphasis, calling someone or something out, or making an accusatory point",
        "think": "Pondering, reflecting, questioning assumptions, chin hold",
        "confident": "Confident conclusion, hands on hips, or strong definitive statement",
        "present": "Presenting data or welcoming the audience with open hands",
        "aha": "Sudden realization, discovery, epiphany, or connecting the dots",
      },
    },
  };

  const result = await callJevSystemOne({ state: sentence, questions, apiKey, fetchFn });
  if (!result || !result.answers) return null;

  const answers = result.answers;
  const allowedMotions = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"];
  const chosenMotion = answers.camera_motion?.choice;
  const cameraMotion = allowedMotions.includes(chosenMotion) ? chosenMotion : "zoom-in";

  const allowedShotTypes = ["talk-to-camera", "chibi-commentary", "text-card"];
  const chosenShotType = answers.shot_type?.choice;
  const shotType = allowedShotTypes.includes(chosenShotType) ? chosenShotType : "talk-to-camera";

  return {
    shotType,
    shotTypeConfidence: answers.shot_type?.confidence ?? 0,
    shazPose: answers.shaz_puppet_pose?.choice || "neutral-listening",
    shazConfidence: answers.shaz_puppet_pose?.confidence || 0,
    chibiPose: normalizeChibiHold(answers.chibi_pose?.choice),
    chibiConfidence: answers.chibi_pose?.confidence || 0,
    cameraMotion,
    cameraConfidence: answers.camera_motion?.confidence || 0,
    badge: answers.badge_category?.choice || "KEY POINT",
    badgeConfidence: answers.badge_category?.confidence || 0,
    isPunchline: (answers.is_punchline?.probability ?? answers.is_punchline?.noul ?? 0) > 0.6,
    punchlineProbability: answers.is_punchline?.probability ?? answers.is_punchline?.noul ?? 0,
    provenance: "jev-systemone",
  };
}

/**
 * Lints a commentary script for corporate PR buzzwords and AI tells using Jev.
 */
export async function lintScriptWithJev(scriptText, { apiKey, fetchFn } = {}) {
  const questions = {
    is_corporate_pr_speak: {
      type: "noul",
      instructions: "Does this read like canned, corporate PR buzzwords or an automated generic AI summary ('in today's landscape', 'polarizing discourse', 'notable step forward')?",
    },
    has_authentic_voice: {
      type: "noul",
      instructions: "Does this have the authentic voice of a human internet creator speaking directly and bluntly to their audience?",
    },
    script_grade: {
      type: "choice",
      instructions: "Grade the script quality for an entertaining commentary video.",
      criteria: {
        "pass": "Authentic, punchy, conversational, engaging",
        "reject-corporate": "Dry, wooden, reads like a press release or corporate post",
        "reject-cliche": "Uses standard AI clichés and generic filler phrases",
      },
    },
  };

  const result = await callJevSystemOne({ state: scriptText, questions, apiKey, fetchFn });
  if (!result || !result.answers) return null;

  const answers = result.answers;
  return {
    grade: answers.script_grade?.choice || "pass",
    confidence: answers.script_grade?.confidence || 0,
    isCorporate: (answers.is_corporate_pr_speak?.noul ?? 0) >= 0.4,
    corporateProbability: answers.is_corporate_pr_speak?.noul ?? 0,
    hasAuthenticVoice: (answers.has_authentic_voice?.noul ?? 0) >= 0.5,
    authenticProbability: answers.has_authentic_voice?.noul ?? 0,
    provenance: "jev-systemone",
  };
}
