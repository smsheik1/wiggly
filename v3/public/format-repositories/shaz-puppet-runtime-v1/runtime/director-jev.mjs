import { CHIBI_HOLDS, CHIBI_POSE_ALIASES, normalizeChibiHold } from "./chibi-choreography.mjs";
import { readSecret } from "./secrets.mjs";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const ALLOWED_SHOT_TYPES = ["talk-to-camera", "b-roll", "chibi-commentary", "text-card"];
export const ALLOWED_CAMERA_MOTIONS = ["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"];
export const ALLOWED_SHAZ_PUPPET_POSES = [
  "neutral-listening",
  "chin-stroke",
  "chin-stroke-swagger",
  "excited-celebration",
  "point-at-screen",
  "confident",
  "shrug",
  "think",
  "point",
  "aha",
  "present",
];
export const ALLOWED_BADGE_CATEGORIES = [
  "BREAKING",
  "THE CLASH",
  "REALITY CHECK",
  "COMMUNITY ROAST",
  "YOUR VERDICT",
];
export const ALLOWED_SCRIPT_GRADES = ["pass", "reject-corporate", "reject-cliche"];

export class JevApiError extends Error {
  constructor(message, { status = null, isAccountError = false, isRetryable5xx = false, isNetworkError = false, cause } = {}) {
    super(message, { cause });
    this.name = "JevApiError";
    this.status = status;
    this.isAccountError = isAccountError;
    this.isRetryable5xx = isRetryable5xx;
    this.isNetworkError = isNetworkError;
  }
}

export class JevDirectorSkipError extends Error {
  constructor(message, { lineNumber = null, field = null, sentence = "", cause } = {}) {
    super(message, { cause });
    this.name = "JevDirectorSkipError";
    this.code = "JEV_CANDIDATE_SKIP";
    this.lineNumber = lineNumber;
    this.field = field;
    this.sentence = sentence;
  }
}

function isValidChibiPoseChoice(choice) {
  return typeof choice === "string" && (
    Object.prototype.hasOwnProperty.call(CHIBI_HOLDS, choice) ||
    Object.prototype.hasOwnProperty.call(CHIBI_POSE_ALIASES, choice)
  );
}

/**
 * Loads the TypeSafe API key from env or module-anchored secrets.env.
 */
export function getTypesafeApiKey(options = {}) {
  return readSecret("TYPESAFE_API_KEY", options) || readSecret("JEV_API_KEY", options);
}

/**
 * Calls Jev System One API with typed questions.
 */
export async function callJevSystemOne({ state, questions, apiKey: explicitKey, env, secretsPath, fetchFn = fetch }) {
  const key = explicitKey !== undefined ? explicitKey : getTypesafeApiKey({ env, secretsPath });
  if (!key) {
    throw new JevApiError(
      `\n================================================================================\n` +
      `❌ JEV DIRECTOR FAILURE: TYPESAFE_API_KEY IS MISSING\n` +
      `================================================================================\n` +
      `Cannot direct the scene: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Jev', and copy the generated key.\n` +
      `4. Check your account balance: Click 'Billing' in the left menu (https://typesafe.ai/billing) and ensure you have an active card or available credits.\n` +
      `5. Open your local 'secrets.env' file (located at the root of your Wiggly repository) in your code editor.\n` +
      `6. Add or update this exact line:\n` +
      `   TYPESAFE_API_KEY=your_copied_key_here\n` +
      `7. Save the file and re-run your command.\n` +
      `================================================================================\n`,
      { status: null, isAccountError: true },
    );
  }

  let response;
  try {
    response = await fetchFn(TYPESAFE_ENDPOINT, {
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
  } catch (err) {
    throw new JevApiError(
      `Jev System One network request failed: ${err.message}`,
      { isNetworkError: true, cause: err },
    );
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new JevApiError(
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
      `================================================================================\n`,
      {
        status: response.status,
        isAccountError: [401, 402, 403, 429].includes(response.status),
        isRetryable5xx: response.status >= 500 && response.status < 600,
      },
    );
  }

  return response.json();
}

function validateSentenceAnswers(answers, lineNumber, sentence) {
  if (!answers || typeof answers !== "object") {
    return { ok: false, field: "answers", error: `Jev gave no valid answers for line ${lineNumber}: ${sentence}` };
  }

  const shotType = answers.shot_type?.choice;
  if (!ALLOWED_SHOT_TYPES.includes(shotType)) {
    return { ok: false, field: "shot_type", error: `Jev gave no valid shot_type for line ${lineNumber}: ${sentence}` };
  }

  const shazPose = answers.shaz_puppet_pose?.choice;
  if (!ALLOWED_SHAZ_PUPPET_POSES.includes(shazPose)) {
    return { ok: false, field: "shaz_puppet_pose", error: `Jev gave no valid shaz_puppet_pose for line ${lineNumber}: ${sentence}` };
  }

  const rawChibiPose = answers.chibi_pose?.choice;
  if (!isValidChibiPoseChoice(rawChibiPose)) {
    return { ok: false, field: "chibi_pose", error: `Jev gave no valid chibi_pose for line ${lineNumber}: ${sentence}` };
  }

  const cameraMotion = answers.camera_motion?.choice;
  if (!ALLOWED_CAMERA_MOTIONS.includes(cameraMotion)) {
    return { ok: false, field: "camera_motion", error: `Jev gave no valid camera_motion for line ${lineNumber}: ${sentence}` };
  }

  const badge = answers.badge_category?.choice;
  if (!ALLOWED_BADGE_CATEGORIES.includes(badge)) {
    return { ok: false, field: "badge_category", error: `Jev gave no valid badge_category for line ${lineNumber}: ${sentence}` };
  }

  const punchlineProbability = answers.is_punchline?.probability ?? answers.is_punchline?.noul;
  if (typeof punchlineProbability !== "number" || !Number.isFinite(punchlineProbability) || punchlineProbability < 0 || punchlineProbability > 1) {
    return { ok: false, field: "is_punchline", error: `Jev gave no valid is_punchline for line ${lineNumber}: ${sentence}` };
  }

  return {
    ok: true,
    value: {
      shotType,
      shotTypeConfidence: answers.shot_type?.confidence ?? 0,
      shazPose,
      shazConfidence: answers.shaz_puppet_pose?.confidence ?? 0,
      chibiPose: normalizeChibiHold(rawChibiPose),
      chibiConfidence: answers.chibi_pose?.confidence ?? 0,
      cameraMotion,
      cameraConfidence: answers.camera_motion?.confidence ?? 0,
      badge,
      badgeConfidence: answers.badge_category?.confidence ?? 0,
      isPunchline: punchlineProbability > 0.6,
      punchlineProbability,
      provenance: "jev-systemone",
    },
  };
}

/**
 * Directs a single spoken commentary sentence using Jev.
 * Retries once on missing/invalid choices or line-level 5xx, then throws `JevDirectorSkipError` (zero silent defaults).
 */
export async function evaluateSentenceDirector(sentence, { apiKey, env, secretsPath, fetchFn, beatContext } = {}) {
  const questions = {
    chibi_pose: {
      type: "choice",
      instructions: "Which animated Shaz character gesture fits the comedic tone of this beat best?",
      criteria: {
        "point-emphasis": "Asserting a fact, dropping a bomb, pointing out something crucial, calling someone out",
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
        "talk-to-camera": "Standard anchor: Shaz speaking directly to the viewer on camera. Use this for punchy personal commentary.",
        "b-roll": "Full-screen visual b-roll cutaway: Cinematic screenshot, keyart, product photo, or gameplay footage illustrating the topic. Essential for showing the subject being discussed.",
        "chibi-commentary": "Comedic cutaway: Chibi animated character with pop card for an exaggerated roast, funny tangent, or sarcastic aside.",
        "text-card": "Graphic card: Big bold full-screen kinetic text card to highlight an astonishing quote, statistic, or critical takeaway.",
      },
    },
    shaz_puppet_pose: {
      type: "choice",
      instructions: "Which entertaining character pose best fits Shaz in this beat? Prioritize visual variety, lively energy, and character attitude. Avoid picking poses that were recently used.",
      criteria: {
        "neutral-listening": "Grounded, calm conversational baseline; natural breathing room between active gestures",
        "chin-stroke": "Smug smirk with hand resting under jaw; witty, sarcastic, playful swagger, or roasting",
        "excited-celebration": "High-energy double-arm bounce; celebration, hype, excitement, or victory",
        "point-at-screen": "Gesturing towards the OTS graphic card or headline to draw the viewer's eye",
        "confident": "Cool swagger with hands firmly on hips; grounded, strong, standing tall",
        "shrug": "Expressive palms-up shrug with raised shoulders; comic disbelief, bafflement, or 'who even knows?'",
        "think": "Curious hand-to-chin ponder; analytical, thoughtful, or questioning",
        "point": "Direct, snappy point towards the camera/audience for punchy emphasis",
        "aha": "Quick lightbulb eureka moment; sudden realization or sharing a neat takeaway",
        "present": "Open, welcoming host hands framing the topic or inviting the viewer in",
      },
    },
  };

  const lineNumber = Number.isInteger(beatContext?.beatIndex) ? beatContext.beatIndex + 1 : 1;
  const state = beatContext
    ? {
        sentence,
        beat_progression: `Beat ${beatContext.beatIndex + 1} of ${beatContext.totalBeats}`,
        recent_poses: beatContext.recentPoses?.length > 0 ? beatContext.recentPoses : ["none yet"],
        direction_goal: "Direct Shaz's visual performance for high entertainment value and variety. Avoid repeating recent poses so the screen stays fresh and visually dynamic.",
      }
    : sentence;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let result;
    try {
      result = await callJevSystemOne({ state, questions, apiKey, env, secretsPath, fetchFn });
    } catch (err) {
      if (err instanceof JevApiError) {
        if (err.isAccountError) throw err;
        if (err.isRetryable5xx || err.isNetworkError) {
          if (attempt === 1) continue;
          throw new JevDirectorSkipError(
            `Jev gave no valid api response for line ${lineNumber} (${err.status ? `HTTP ${err.status}` : "network error"}): ${sentence}`,
            { lineNumber, field: "api", sentence, cause: err },
          );
        }
      }
      throw err;
    }

    const check = validateSentenceAnswers(result?.answers, lineNumber, sentence);
    if (check.ok) {
      return check.value;
    }
    if (attempt === 2) {
      throw new JevDirectorSkipError(check.error, { lineNumber, field: check.field, sentence });
    }
  }
}

/**
 * Lints a commentary script for corporate PR buzzwords and AI tells using Jev.
 */
export async function lintScriptWithJev(scriptText, { apiKey, env, secretsPath, fetchFn } = {}) {
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

  const result = await callJevSystemOne({ state: scriptText, questions, apiKey, env, secretsPath, fetchFn });
  const answers = result?.answers;
  if (!answers || typeof answers !== "object") {
    throw new JevApiError("Jev script linter returned empty or invalid answers payload.");
  }

  const grade = answers.script_grade?.choice;
  if (!ALLOWED_SCRIPT_GRADES.includes(grade)) {
    throw new JevApiError(`Jev script linter returned invalid or missing script_grade: ${String(grade)}`);
  }

  const corpProb = answers.is_corporate_pr_speak?.probability ?? answers.is_corporate_pr_speak?.noul;
  if (typeof corpProb !== "number" || !Number.isFinite(corpProb) || corpProb < 0 || corpProb > 1) {
    throw new JevApiError("Jev script linter returned invalid is_corporate_pr_speak score.");
  }

  const authProb = answers.has_authentic_voice?.probability ?? answers.has_authentic_voice?.noul;
  if (typeof authProb !== "number" || !Number.isFinite(authProb) || authProb < 0 || authProb > 1) {
    throw new JevApiError("Jev script linter returned invalid has_authentic_voice score.");
  }

  return {
    grade,
    confidence: answers.script_grade?.confidence ?? 0,
    isCorporate: corpProb >= 0.4,
    corporateProbability: corpProb,
    hasAuthenticVoice: authProb >= 0.5,
    authenticProbability: authProb,
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
    throw new Error(
      `\n================================================================================\n` +
      `❌ JEV DIRECTOR FAILURE: EMPTY OR INVALID ANSWERS PAYLOAD\n` +
      `================================================================================\n` +
      `Jev System One returned an empty or invalid answers payload during image curation.\n` +
      `Silent fallbacks are prohibited per Wiggly Engineering Rule 12.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/billing\n` +
      `2. Confirm your account has active credits or an unexpired payment card.\n` +
      `3. Check https://status.typesafe.ai to verify TypeSafe API services are operational.\n` +
      `================================================================================\n`
    );
  }

  const answers = result.answers;
  const choiceKey = answers.best_image?.choice;
  const match = typeof choiceKey === "string" ? choiceKey.match(/^candidate_(\d+)$/) : null;
  const selectedIndex = match ? Number(match[1]) : -1;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= candidates.length) {
    throw new JevApiError(`Jev image curator returned invalid best_image choice: ${String(choiceKey)}`);
  }

  const allowedCardBadges = ["REPORT", "REALITY CHECK", "REACTION", "THE DEALBREAKER"];
  const cardBadge = answers.card_badge?.choice;
  if (!allowedCardBadges.includes(cardBadge)) {
    throw new JevApiError(`Jev image curator returned invalid card_badge choice: ${String(cardBadge)}`);
  }

  return {
    selectedCandidate: candidates[selectedIndex],
    selectedIndex,
    badge: cardBadge,
    confidence: answers.best_image?.confidence ?? 0.9,
    rationale: `Jev selected candidate ${selectedIndex} for editorial impact`,
    provenance: "jev-systemone",
  };
}

