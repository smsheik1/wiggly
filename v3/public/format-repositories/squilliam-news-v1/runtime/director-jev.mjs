import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const VALID_CAMERA_MOTIONS = [
  "wide-anchor-desk",
  "grand-pedestal",
  "push-in-smug",
  "pan-across-evidence",
  "dramatic-overhead",
];

export const VALID_TICKER_BADGES = [
  "HIGH SOCIETY BULLETIN",
  "OPULENT EXCLUSIVITY",
  "CULTURE & REFINEMENT",
  "CRINGE COMMONER ALERT",
  "FINAL VERDICT",
];

export const VALID_ANCHOR_EXPRESSIONS = [
  "smug-condescending",
  "flamboyant-gasp",
  "haughty-chuckle",
  "triumphant-sign-off",
];

export const VALID_GESTURE_POSES = [
  "intro_open",
  "present_screen",
  "incredulous",
  "big_reveal",
  "verdict",
  "button",
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
      `Cannot direct Squilliam News: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Squilliam Director', and copy the generated key.\n` +
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
export function planSquilliamNewsDeterministic(slide, { slideContext } = {}) {
  const index = slideContext?.slideIndex ?? 0;
  const recentGestures = slideContext?.recentGestures || [];
  const recentMotions = slideContext?.recentMotions || [];
  const recentBadges = slideContext?.recentBadges || [];

  // Default gesture based on slide type and index
  let gesturePose = "intro_open";
  if (index === 0) gesturePose = "intro_open";
  else if (index === 1 || slide.type === "poster") gesturePose = "present_screen";
  else if (slide.type === "photo") {
    const photoVariants = ["incredulous", "present_screen", "big_reveal"];
    gesturePose = photoVariants[index % photoVariants.length];
  } else if (slide.type === "jab") gesturePose = "incredulous";
  else if (slide.type === "details") gesturePose = "present_screen";
  else if (slide.type === "notice") gesturePose = "big_reveal";
  else if (slide.type === "cta") gesturePose = "verdict";
  else if (slide.type === "signoff") gesturePose = "button";

  // Enforce variety: never repeat consecutive gesture
  if (recentGestures.length > 0 && gesturePose === recentGestures[0]) {
    const alternates = VALID_GESTURE_POSES.filter((g) => g !== recentGestures[0]);
    gesturePose = alternates[index % alternates.length] || "present_screen";
  }

  // Camera motion selection
  let cameraMotion = "wide-anchor-desk";
  if (index === 0) cameraMotion = "wide-anchor-desk";
  else if (slide.type === "poster" || slide.type === "photo") cameraMotion = "pan-across-evidence";
  else if (slide.type === "jab") cameraMotion = "push-in-smug";
  else if (slide.type === "details") cameraMotion = "grand-pedestal";
  else if (slide.type === "notice") cameraMotion = "dramatic-overhead";
  else if (slide.type === "cta") cameraMotion = "push-in-smug";
  else if (slide.type === "signoff") cameraMotion = "wide-anchor-desk";

  // Enforce variety: never repeat consecutive camera motion
  if (recentMotions.length > 0 && cameraMotion === recentMotions[0]) {
    const alternates = VALID_CAMERA_MOTIONS.filter((m) => m !== recentMotions[0]);
    cameraMotion = alternates[index % alternates.length] || "grand-pedestal";
  }

  // Ticker badge selection
  let tickerBadge = "HIGH SOCIETY BULLETIN";
  if (index === 0) tickerBadge = "HIGH SOCIETY BULLETIN";
  else if (slide.type === "jab" || slide.type === "photo") tickerBadge = "CRINGE COMMONER ALERT";
  else if (slide.type === "details") tickerBadge = "CULTURE & REFINEMENT";
  else if (slide.type === "notice") tickerBadge = "OPULENT EXCLUSIVITY";
  else if (slide.type === "cta" || slide.type === "signoff") tickerBadge = "FINAL VERDICT";

  // Enforce variety: never repeat consecutive ticker badge
  if (recentBadges.length > 0 && tickerBadge === recentBadges[0]) {
    const alternates = VALID_TICKER_BADGES.filter((b) => b !== recentBadges[0]);
    tickerBadge = alternates[index % alternates.length] || "HIGH SOCIETY BULLETIN";
  }

  // Expression selection
  let anchorExpression = "smug-condescending";
  if (slide.type === "jab" || gesturePose === "incredulous") anchorExpression = "haughty-chuckle";
  else if (slide.type === "notice" || gesturePose === "big_reveal") anchorExpression = "flamboyant-gasp";
  else if (slide.type === "signoff" || slide.type === "cta") anchorExpression = "triumphant-sign-off";

  return {
    gesturePose,
    gestureConfidence: 1.0,
    cameraMotion,
    cameraConfidence: 1.0,
    tickerBadge,
    badgeConfidence: 1.0,
    anchorExpression,
    expressionConfidence: 1.0,
    isPayoff: slide.type === "cta" || slide.type === "signoff",
    payoffProbability: (slide.type === "cta" || slide.type === "signoff") ? 0.98 : 0.05,
    provenance: "deterministic-variety-planner",
  };
}

/**
 * Directs a single Squilliam News story slide using Jev System One.
 */
export async function evaluateSquilliamSlideDirector(slide, { apiKey, fetchFn, slideContext } = {}) {
  const questions = {
    gesture_pose: {
      type: "choice",
      instructions:
        "Which high-society anchor pose best captures the comedic arrogance and theatrical staging of this slide?",
      criteria: {
        "intro_open": "Grand opening pose welcoming the audience with condescending aristocratic elegance",
        "present_screen": "Flamboyant gesture directing attention to the evidence screen beside the desk",
        "incredulous": "Arched monobrow, leaning back in visceral disgust at peasant behavior",
        "big_reveal": "Sweeping dramatic presentation of the scandalous truth or opulent masterpiece",
        "verdict": "Haughty pointing posture delivering the definitive cultural judgment",
        "button": "Restrained, smug sign-off composure looking down directly at the viewer",
      },
    },
    camera_motion: {
      type: "choice",
      instructions:
        "Which broadcast camera movement enhances the comedic haughtiness and visual depth of the 3D studio?",
      criteria: {
        "wide-anchor-desk": "Authoritative wide anchor desk framing showing the presenter and the studio monitors",
        "grand-pedestal": "Slow opulent pedestal elevating the anchor above the viewer's eye level",
        "push-in-smug": "Dramatic punchy push-in into Squilliam's smug grin as he delivers a devastating burn",
        "pan-across-evidence": "Dynamic camera sweep linking the presenter directly to the story screen",
        "dramatic-overhead": "High-angle dramatic perspective emphasizing grand theatrical presentation",
      },
    },
    ticker_badge: {
      type: "choice",
      instructions: "What high-society news ticker badge should display for this segment?",
      criteria: {
        "HIGH SOCIETY BULLETIN": "Breaking high-class bulletin or opening broadcast hook",
        "OPULENT EXCLUSIVITY": "Luxury, lavish lifestyle, five-star refinement, and pure prestige",
        "CULTURE & REFINEMENT": "High art, music, fine dining, or classical sophistication",
        "CRINGE COMMONER ALERT": "Exposing pedestrian, embarrassing, or unrefined middle-class blunders",
        "FINAL VERDICT": "The supreme, unquestionable sign-off conclusion",
      },
    },
    anchor_expression: {
      type: "choice",
      instructions: "Which anchor attitude best delivers this line?",
      criteria: {
        "smug-condescending": "Signature aristocratic superiority with half-closed eyes and haughty smirk",
        "flamboyant-gasp": "Feigned theatrical shock at commoner indignities or unbelievable news",
        "haughty-chuckle": "Posh aristocratic laughter at the sheer absurdity of the subject",
        "triumphant-sign-off": "Smug self-satisfied grin confirming Squilliam's superiority over all",
      },
    },
    is_payoff: {
      type: "noul",
      instructions: "Is this slide delivering the climactic punchline, call to action, or sign-off?",
    },
  };

  const state = {
    slide_type: slide.type,
    slide_text: slide.eyebrow || slide.title || slide.caption || slide.label || "",
    slide_subtext: slide.subhead || slide.footer || slide.details || "",
    slide_progression: slideContext
      ? `Slide ${slideContext.slideIndex + 1} of ${slideContext.totalSlides}`
      : undefined,
    recent_gestures: slideContext?.recentGestures?.length > 0 ? slideContext.recentGestures : ["none yet"],
    recent_camera_motions: slideContext?.recentMotions?.length > 0 ? slideContext.recentMotions : ["none yet"],
    recent_badges: slideContext?.recentBadges?.length > 0 ? slideContext.recentBadges : ["none yet"],
    direction_goal:
      "Direct the Squilliam News Network presentation with theatrical high-society comedic timing, " +
      "ensuring lively pose variety, camera motion diversity, and sharp comedic contrast.",
  };

  const result = await callJevSystemOne({ state, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    throw new Error("Jev System One returned an empty response object.");
  }

  const answers = result.answers;

  // Validate Gesture Pose
  let gesturePose = answers.gesture_pose?.choice;
  if (!VALID_GESTURE_POSES.includes(gesturePose)) {
    gesturePose = "present_screen";
  }

  // Validate Camera Motion
  let cameraMotion = answers.camera_motion?.choice;
  if (!VALID_CAMERA_MOTIONS.includes(cameraMotion)) {
    cameraMotion = "wide-anchor-desk";
  }

  // Validate Ticker Badge
  let tickerBadge = answers.ticker_badge?.choice;
  if (!VALID_TICKER_BADGES.includes(tickerBadge)) {
    tickerBadge = "HIGH SOCIETY BULLETIN";
  }

  // Validate Expression
  let anchorExpression = answers.anchor_expression?.choice;
  if (!VALID_ANCHOR_EXPRESSIONS.includes(anchorExpression)) {
    anchorExpression = "smug-condescending";
  }

  // Enforce variety guardrails: no back-to-back duplicate gestures
  if (slideContext?.recentGestures?.[0] === gesturePose) {
    const alternates = VALID_GESTURE_POSES.filter((g) => g !== slideContext.recentGestures[0]);
    gesturePose = alternates[0] || "present_screen";
  }

  // Enforce variety guardrails: no back-to-back duplicate camera motions
  if (slideContext?.recentMotions?.[0] === cameraMotion) {
    const alternates = VALID_CAMERA_MOTIONS.filter((m) => m !== slideContext.recentMotions[0]);
    cameraMotion = alternates[0] || "wide-anchor-desk";
  }

  // Enforce variety guardrails: no back-to-back duplicate ticker badges
  if (slideContext?.recentBadges?.[0] === tickerBadge) {
    const alternates = VALID_TICKER_BADGES.filter((b) => b !== slideContext.recentBadges[0]);
    tickerBadge = alternates[0] || "OPULENT EXCLUSIVITY";
  }

  const isPayoff = Boolean(answers.is_payoff?.condition);
  const payoffProbability = answers.is_payoff?.probability ?? (isPayoff ? 0.95 : 0.05);

  return {
    gesturePose,
    gestureConfidence: answers.gesture_pose?.confidence ?? 0.95,
    cameraMotion,
    cameraConfidence: answers.camera_motion?.confidence ?? 0.95,
    tickerBadge,
    badgeConfidence: answers.ticker_badge?.confidence ?? 0.95,
    anchorExpression,
    expressionConfidence: answers.anchor_expression?.confidence ?? 0.95,
    isPayoff,
    payoffProbability,
    provenance: "typesafe-jev-system-one",
  };
}

/**
 * Directs an entire Squilliam News presentation (all slides) with strict variety memory.
 */
export async function directSquilliamNewsPresentation(content, { apiKey, fetchFn, mode = "auto" } = {}) {
  const slides = content.slides || [];
  const directedSlides = [];
  const recentGestures = [];
  const recentMotions = [];
  const recentBadges = [];

  const useDeterministic = mode === "deterministic";

  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i];
    const slideContext = {
      slideIndex: i,
      totalSlides: slides.length,
      recentGestures: [...recentGestures],
      recentMotions: [...recentMotions],
      recentBadges: [...recentBadges],
    };

    let direction;
    if (useDeterministic) {
      direction = planSquilliamNewsDeterministic(slide, { slideContext });
    } else {
      direction = await evaluateSquilliamSlideDirector(slide, { apiKey, fetchFn, slideContext });
    }

    recentGestures.unshift(direction.gesturePose);
    recentMotions.unshift(direction.cameraMotion);
    recentBadges.unshift(direction.tickerBadge);

    directedSlides.push({
      slideIndex: i,
      slideType: slide.type,
      start: slide.start,
      end: slide.end,
      direction,
    });
  }

  return {
    headline: content.headline,
    characterId: content.characterId || "squilliam",
    totalSlides: slides.length,
    directedSlides,
    directedAt: new Date().toISOString(),
    director: "Jev System One Autonomous Actor Director",
  };
}
