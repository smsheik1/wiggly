import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const VALID_CAMERA_MOTIONS = [
  "static-broadcast",
  "zoom-in-evidence",
  "push-in-anchor",
  "subtle-pan",
];

export const VALID_TICKER_BADGES = [
  "BREAKING NEWS",
  "INVESTIGATION",
  "SCIENTIFIC BREAKTHROUGH",
  "BIKINI BOTTOM UPDATE",
  "THE VERDICT",
];

export const VALID_ANCHOR_EXPRESSIONS = [
  "deadpan-serious",
  "shocked-gasp",
  "cynical-smirk",
  "signing-off",
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
      `Cannot direct Talking Fish News: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Talking Fish Director', and copy the generated key.\n` +
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
export function planFishNewsDeterministic(beatText, { beatContext } = {}) {
  const index = beatContext?.beatIndex ?? 0;
  const recentMotions = beatContext?.recentMotions || [];
  const recentBadges = beatContext?.recentBadges || [];

  let cameraMotion = "static-broadcast";
  if (index === 0) {
    cameraMotion = "static-broadcast";
  } else if (index === 1) {
    cameraMotion = "zoom-in-evidence";
  } else if (index === 2) {
    cameraMotion = "subtle-pan";
  } else {
    // Payoff
    cameraMotion = "push-in-anchor";
  }

  // Guarantee no adjacent duplicate camera motion
  if (recentMotions.length > 0 && cameraMotion === recentMotions[0]) {
    const alternates = VALID_CAMERA_MOTIONS.filter((m) => m !== recentMotions[0]);
    cameraMotion = alternates[0] || "static-broadcast";
  }

  let tickerBadge = "BREAKING NEWS";
  if (index === 0) {
    tickerBadge = "BREAKING NEWS";
  } else if (index === 1) {
    tickerBadge = "INVESTIGATION";
  } else if (index === 2) {
    tickerBadge = "SCIENTIFIC BREAKTHROUGH";
  } else {
    tickerBadge = "THE VERDICT";
  }

  // Guarantee no adjacent duplicate ticker badge
  if (recentBadges.length > 0 && tickerBadge === recentBadges[0]) {
    const alternates = VALID_TICKER_BADGES.filter((b) => b !== recentBadges[0]);
    tickerBadge = alternates[0] || "BIKINI BOTTOM UPDATE";
  }

  let anchorExpression = "deadpan-serious";
  if (index === 1) anchorExpression = "shocked-gasp";
  else if (index === 2) anchorExpression = "cynical-smirk";
  else if (index === 3) anchorExpression = "signing-off";

  return {
    cameraMotion,
    cameraConfidence: 1.0,
    tickerBadge,
    badgeConfidence: 1.0,
    anchorExpression,
    expressionConfidence: 1.0,
    isPayoff: index === 3,
    payoffProbability: index === 3 ? 0.98 : 0.05,
    provenance: "deterministic-variety-planner",
  };
}

/**
 * Directs a single Talking Fish News story beat using Jev System One.
 */
export async function evaluateFishNewsBeatDirector(beatText, { apiKey, fetchFn, beatContext } = {}) {
  const questions = {
    camera_motion: {
      type: "choice",
      instructions:
        "Which virtual broadcast camera framing matches the drama, comedic beat, and focus of this news story beat?",
      criteria: {
        "static-broadcast": "Authoritative standard anchor desk framing showing the fish anchor and the framed evidence screen",
        "zoom-in-evidence": "Dramatic push-in towards the framed evidence screen to highlight a crucial visual finding or detail",
        "push-in-anchor": "Punchy push-in on the fish anchor to emphasize a deadpan delivery, shocking fact, or final punchline",
        "subtle-pan": "Sweeping lateral camera motion across the newsroom desk adding broadcast energy",
      },
    },
    ticker_badge: {
      type: "choice",
      instructions: "What news ticker category badge should display beneath the headline screen?",
      criteria: {
        "BREAKING NEWS": "Urgent breaking story, unexpected bulletin, or opening hook",
        "INVESTIGATION": "Deeper analysis, measurements, or examining the facts of what happened",
        "SCIENTIFIC BREAKTHROUGH": "Science, tech, planetary exploration, or medical discovery",
        "BIKINI BOTTOM UPDATE": "Local underwater community, public safety, or environmental impact",
        "THE VERDICT": "The final factual conclusion, takeaway, or deadpan payoff",
      },
    },
    anchor_expression: {
      type: "choice",
      instructions: "Which fish news anchor attitude best delivers this line?",
      criteria: {
        "deadpan-serious": "Classic unblinking, stern fish anchor stare delivering ridiculous news completely straight",
        "shocked-gasp": "Wide-eyed dramatic intensity emphasizing an astonishing statistic or escalation",
        "cynical-smirk": "Witty, dry skepticism toward corporate statements or bizarre findings",
        "signing-off": "Authoritative sign-off directly facing the viewer for the final punchline",
      },
    },
    is_payoff: {
      type: "noul",
      instructions: "Is this beat delivering the closing factual takeaway and deadpan comedic punchline?",
    },
  };

  const state = {
    story_beat: beatText,
    beat_progression: beatContext
      ? `Beat ${beatContext.beatIndex + 1} of ${beatContext.totalBeats}`
      : undefined,
    topic: beatContext?.topic,
    stage: beatContext?.stage || (beatContext?.beatIndex === 0 ? "hook" : beatContext?.beatIndex === 3 ? "payoff" : "body"),
    recent_camera_motions: beatContext?.recentMotions?.length > 0 ? beatContext.recentMotions : ["none yet"],
    recent_badges: beatContext?.recentBadges?.length > 0 ? beatContext.recentBadges : ["none yet"],
    direction_goal:
      "Direct the Talking Fish News broadcast with sharp journalistic pacing, comedic deadpan timing, " +
      "and dynamic camera and ticker variety across all 4 beats.",
  };

  const result = await callJevSystemOne({ state, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    throw new Error("Jev System One returned an empty response object.");
  }

  const answers = result.answers;

  // Validate Camera Motion
  let cameraMotion = answers.camera_motion?.choice;
  if (!VALID_CAMERA_MOTIONS.includes(cameraMotion)) {
    cameraMotion = "static-broadcast";
  }

  // Guardrail: Enforce variety against immediate repeat
  const lastMotion = beatContext?.recentMotions?.[0];
  if (lastMotion && cameraMotion === lastMotion) {
    const alternates = VALID_CAMERA_MOTIONS.filter((m) => m !== lastMotion);
    cameraMotion = alternates[0] || "static-broadcast";
  }

  // Validate Ticker Badge
  let tickerBadge = answers.ticker_badge?.choice;
  if (!VALID_TICKER_BADGES.includes(tickerBadge)) {
    tickerBadge = "BREAKING NEWS";
  }

  const lastBadge = beatContext?.recentBadges?.[0];
  if (lastBadge && tickerBadge === lastBadge) {
    const alternates = VALID_TICKER_BADGES.filter((b) => b !== lastBadge);
    tickerBadge = alternates[0] || "BIKINI BOTTOM UPDATE";
  }

  // Validate Expression
  let anchorExpression = answers.anchor_expression?.choice;
  if (!VALID_ANCHOR_EXPRESSIONS.includes(anchorExpression)) {
    anchorExpression = "deadpan-serious";
  }

  // Validate Payoff
  const payoffProb = answers.is_payoff?.probability ?? answers.is_payoff?.noul ?? 0;
  const isPayoff = payoffProb >= 0.5;

  return {
    cameraMotion,
    cameraConfidence: answers.camera_motion?.confidence ?? 0,
    tickerBadge,
    badgeConfidence: answers.ticker_badge?.confidence ?? 0,
    anchorExpression,
    expressionConfidence: answers.anchor_expression?.confidence ?? 0,
    isPayoff,
    payoffProbability: payoffProb,
    provenance: "jev-systemone",
  };
}

/**
 * Directs an entire 4-beat Talking Fish News story.
 */
export async function directFishNewsStory(story, { apiKey, fetchFn, dryRun = false, logger = console.log } = {}) {
  const beatsList = Array.isArray(story.beats)
    ? story.beats
    : Array.isArray(story.script?.beats)
    ? story.script.beats
    : null;

  if (!beatsList || beatsList.length !== 4) {
    throw new Error("Talking Fish News requires exactly 4 story beats (hook, what happened, why it matters, payoff).");
  }

  const totalBeats = 4;
  const directedBeats = [];
  const recentMotions = [];
  const recentBadges = [];

  const stages = ["hook", "what-happened", "why-it-matters", "takeaway-and-punchline"];

  for (let i = 0; i < beatsList.length; i += 1) {
    const beatText = beatsList[i];
    const beatContext = {
      beatIndex: i,
      totalBeats,
      topic: story.research?.topic || story.topic || "Current News",
      stage: stages[i],
      recentMotions: recentMotions.slice(0, 2),
      recentBadges: recentBadges.slice(0, 2),
    };

    let evaluation;
    if (dryRun) {
      evaluation = planFishNewsDeterministic(beatText, { beatContext });
    } else {
      evaluation = await evaluateFishNewsBeatDirector(beatText, {
        apiKey,
        fetchFn,
        beatContext,
      });
    }

    recentMotions.unshift(evaluation.cameraMotion);
    recentBadges.unshift(evaluation.tickerBadge);

    directedBeats.push({
      beatIndex: i,
      stage: stages[i],
      text: beatText,
      cameraMotion: evaluation.cameraMotion,
      tickerBadge: evaluation.tickerBadge,
      anchorExpression: evaluation.anchorExpression,
      isPayoff: evaluation.isPayoff,
      provenance: evaluation.provenance,
    });

    if (logger) {
      logger(`[Fish Director] Beat ${i + 1}/4 (${stages[i]}): Camera=${evaluation.cameraMotion} Badge="${evaluation.tickerBadge}" Expression=${evaluation.anchorExpression}`);
    }
  }

  return {
    version: "1.0",
    format: "talking-fish-news",
    director: dryRun ? "deterministic-variety-planner" : "jev-systemone",
    topic: story.research?.topic || story.topic || "Current News",
    totalBeats,
    createdAt: new Date().toISOString(),
    beats: directedBeats,
  };
}
