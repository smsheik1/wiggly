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
      instructions: "Which approved puppet gesture best suits Shaz speaking this line? Select neutral-listening for regular narration, or select an active gesture (chin-stroke, point, think, confident, present, aha) when the line delivers emphasis, skepticism, punchlines, or conclusion.",
      criteria: {
        "neutral-listening": "Default baseline narration without overt arm movement",
        "chin-stroke": "Smug, confident chin-stroke with hand resting under jaw and sly smirk; perfect for sarcastic irony, skepticism, or witty callouts",
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

/**
 * Deterministic fallback to select the highest-signal image candidate without network or API keys.
 */
export function curateImageCandidatesDeterministic(sentence, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const sLower = (sentence || "").toLowerCase();
  const isPunchlineOrSarcastic = sLower.includes("nobody asked") || sLower.includes("ridiculous") || sLower.includes("joke") || sLower.includes("dealbreaker");

  let bestIndex = 0;
  let bestScore = -1;

  for (const [idx, c] of candidates.entries()) {
    let score = 0;
    const titleLower = (c.title || "").toLowerCase();
    const sourceLower = (c.source || c.domain || "").toLowerCase();

    // Prefer recognized authoritative news publications
    const newsKeywords = ["verge", "reuters", "bloomberg", "detroit", "autopian", "motortrend", "techcrunch", "wsj", "macrumors", "ars"];
    if (newsKeywords.some((k) => sourceLower.includes(k) || titleLower.includes(k))) {
      score += 3;
    }

    // If comedic/sarcastic beat, reward meme or reaction imagery
    if (isPunchlineOrSarcastic && (titleLower.includes("meme") || titleLower.includes("reaction") || titleLower.includes("funny"))) {
      score += 4;
    }

    // Penalize generic stock keywords or watermark signs
    if (titleLower.includes("stock photo") || titleLower.includes("getty") || titleLower.includes("alamy") || titleLower.includes("clipart")) {
      score -= 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  const chosen = candidates[bestIndex];
  return {
    selectedCandidate: chosen,
    selectedIndex: bestIndex,
    badge: isPunchlineOrSarcastic ? "REACTION" : (chosen.source ? chosen.source.toUpperCase().slice(0, 16) : "REPORT"),
    confidence: 0.85,
    rationale: "Deterministic editorial signal ranking",
    provenance: "heuristic",
  };
}

/**
 * Curates image candidates using Jev System One actor intuition.
 * Evaluates candidates for comedic contrast, rhetorical punch, and journalistic proof.
 */
export async function curateImageCandidatesWithJev({ sentence, candidates, apiKey, fetchFn } = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const criteria = {};
  for (const [idx, c] of candidates.entries()) {
    const key = `candidate_${idx}`;
    criteria[key] = `[${c.source || c.domain || "Web"}]: "${c.title || "Image"}"`;
  }

  const questions = {
    best_image: {
      type: "choice",
      instructions: "Which image candidate best matches the commentary beat with authentic journalistic proof, clear editorial context, or hilarious comedic contrast? Avoid generic stock art, watermarks, or irrelevant clipart.",
      criteria,
    },
    card_badge: {
      type: "choice",
      instructions: "What punchy 1-2 word badge should appear at the top of the card?",
      criteria: {
        "REPORT": "Verified news report, breaking leak, or official announcement",
        "REALITY CHECK": "Skeptical or critical take on corporate claims",
        "REACTION": "Audience meme, deadpan roast, or community sentiment",
        "THE DEALBREAKER": "Key dealbreaker or controversial takeaway",
      },
    },
  };

  const result = await callJevSystemOne({ state: `Spoken dialogue: "${sentence}"`, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    return curateImageCandidatesDeterministic(sentence, candidates);
  }

  const answers = result.answers;
  const choiceKey = answers.best_image?.choice;
  const matchIndex = choiceKey ? Number(choiceKey.replace("candidate_", "")) : 0;
  const selectedIndex = (!isNaN(matchIndex) && matchIndex >= 0 && matchIndex < candidates.length) ? matchIndex : 0;

  return {
    selectedCandidate: candidates[selectedIndex],
    selectedIndex,
    badge: answers.card_badge?.choice || "REPORT",
    confidence: answers.best_image?.confidence ?? 0.9,
    rationale: `Jev selected candidate ${selectedIndex} for editorial impact`,
    provenance: "jev-systemone",
  };
}

