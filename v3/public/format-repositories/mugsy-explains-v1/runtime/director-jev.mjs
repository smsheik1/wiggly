import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const VALID_MUGSY_POSES = [
  "point-left",
  "point-right",
  "question",
  "coffee-explain",
  "raise-hand",
];

export const VALID_CAMERA_MOTIONS = [
  "static",
  "punch-in",
  "zoom-left",
  "zoom-right",
];

export const VALID_BADGES = [
  "HEAD TO HEAD",
  "THE TRAP",
  "THE WINNER",
  "REALITY CHECK",
  "CORE RULE",
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
      `Cannot direct Mugsy's performance: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Mugsy Director', and copy the generated key.\n` +
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
export function planMugsyDeterministic(sentence, { beatContext } = {}) {
  const role = beatContext?.role || "a";
  const recent = beatContext?.recentPoses || [];
  const lastPose = recent[0] || null;

  let preferred;
  if (role === "a") {
    preferred = lastPose === "point-left" ? "coffee-explain" : "point-left";
  } else if (role === "b") {
    preferred = lastPose === "point-right" ? "raise-hand" : "point-right";
  } else if (role === "question") {
    preferred = lastPose === "question" ? "coffee-explain" : "question";
  } else if (role === "explain_a") {
    preferred = lastPose === "coffee-explain" ? "point-left" : "coffee-explain";
  } else {
    // explain_b (punchline/payoff)
    preferred = lastPose === "raise-hand" ? "coffee-explain" : "raise-hand";
  }

  // Camera motion
  let cameraMotion = "static";
  if (role === "a") cameraMotion = "zoom-left";
  else if (role === "b") cameraMotion = "zoom-right";
  else if (role === "question" || role === "explain_b") cameraMotion = "punch-in";

  // Badge
  let badge = "HEAD TO HEAD";
  if (role === "explain_a") badge = "THE TRAP";
  else if (role === "explain_b") badge = "THE WINNER";
  else if (role === "question") badge = "REALITY CHECK";

  return {
    mugsyPose: preferred,
    confidence: 1.0,
    cameraMotion,
    cameraConfidence: 1.0,
    badge,
    badgeConfidence: 1.0,
    isPunchline: role === "explain_b",
    punchlineProbability: role === "explain_b" ? 0.95 : 0.05,
    provenance: "deterministic-variety-planner",
  };
}

/**
 * Directs a single spoken commentary sentence for Mugsy Explains using Jev System One.
 */
export async function evaluateMugsySentenceDirector(sentence, { apiKey, fetchFn, beatContext } = {}) {
  const questions = {
    mugsy_pose: {
      type: "choice",
      instructions:
        "Which animated Mugsy pose best fits the comedic acting, focus, and energy of this sentence? " +
        "CRITICAL REQUIREMENT: Prioritize visual variety and character attitude. " +
        "Do NOT repeat recently used poses so Mugsy feels alive and spontaneous.",
      criteria: {
        "point-left": "Drawing visual attention to the left card/concept (A), introducing side A of the comparison",
        "point-right": "Drawing visual attention to the right card/concept (B), contrasting with side B or highlighting the winner",
        "question": "Engaging the viewer directly, asking 'What's the difference?', open palms, comic disbelief or curiosity",
        "coffee-explain": "Relaxed tech-savvy swagger, holding coffee mug, casually breaking down how things really work",
        "raise-hand": "High energy emphasis, hand raised high to deliver the breakthrough rule, key distinction, or mic drop",
      },
    },
    camera_motion: {
      type: "choice",
      instructions: "Which virtual camera framing matches the drama, comedic beat, and focus of this sentence?",
      criteria: {
        "static": "Standard balanced center framing showing Mugsy and both comparison cards",
        "punch-in": "Dramatic punch-in or push-in on Mugsy for the question, core takeaway, or punchline",
        "zoom-left": "Camera tracks or punches in towards the left concept card (A)",
        "zoom-right": "Camera tracks or punches in towards the right concept card (B)",
      },
    },
    card_badge: {
      type: "choice",
      instructions: "What visual badge or sticker category best summarizes this comparison beat?",
      criteria: {
        "HEAD TO HEAD": "Direct comparison between two concepts or sides",
        "THE TRAP": "Explaining the common mistake, limitation, or one-off pitfall",
        "THE WINNER": "Highlighting the reusable, scalable, or superior approach",
        "REALITY CHECK": "Skeptical or honest breakdown of how the tech actually behaves",
        "CORE RULE": "The foundational takeaway or golden rule",
      },
    },
    is_punchline: {
      type: "noul",
      instructions: "Is this sentence delivering the mic drop, decisive distinction, or punchline of the comparison?",
    },
  };

  const state = {
    sentence,
    lesson: beatContext
      ? `Lesson ${beatContext.lessonIndex + 1}: ${beatContext.leftLabel || "Concept A"} vs ${beatContext.rightLabel || "Concept B"}`
      : undefined,
    role: beatContext?.role,
    beat_progression: beatContext
      ? `Beat ${beatContext.beatIndex + 1} of ${beatContext.totalBeats}`
      : undefined,
    recent_poses: beatContext?.recentPoses?.length > 0 ? beatContext.recentPoses : ["none yet"],
    direction_goal:
      "Direct Mugsy's visual performance with maximum comedic attitude and variety. " +
      "Avoid repeating recent poses so Mugsy stays alive and unpredictable.",
  };

  const result = await callJevSystemOne({ state, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    throw new Error("Jev System One returned an empty response object.");
  }

  const answers = result.answers;

  // Validate Mugsy pose
  let chosenPose = answers.mugsy_pose?.choice;
  if (!VALID_MUGSY_POSES.includes(chosenPose)) {
    chosenPose = "question";
  }

  // Guardrail: Enforce variety against immediate repeat
  const lastPose = beatContext?.recentPoses?.[0];
  if (lastPose && chosenPose === lastPose) {
    // Choose the best alternate from the remaining valid poses
    const alternates = VALID_MUGSY_POSES.filter((p) => p !== lastPose);
    chosenPose = alternates[0] || "coffee-explain";
  }

  // Validate Camera Motion
  const chosenMotion = answers.camera_motion?.choice;
  const cameraMotion = VALID_CAMERA_MOTIONS.includes(chosenMotion) ? chosenMotion : "static";

  // Validate Badge
  const chosenBadge = answers.card_badge?.choice;
  const badge = VALID_BADGES.includes(chosenBadge) ? chosenBadge : "HEAD TO HEAD";

  // Validate Punchline
  const punchlineProb = answers.is_punchline?.probability ?? answers.is_punchline?.noul ?? 0;
  const isPunchline = punchlineProb >= 0.5;

  return {
    mugsyPose: chosenPose,
    poseConfidence: answers.mugsy_pose?.confidence ?? 0,
    cameraMotion,
    cameraConfidence: answers.camera_motion?.confidence ?? 0,
    badge,
    badgeConfidence: answers.card_badge?.confidence ?? 0,
    isPunchline,
    punchlineProbability: punchlineProb,
    provenance: "jev-systemone",
  };
}

/**
 * Directs an entire content.json file across all lessons and sentences.
 */
export async function directMugsyContent(content, { apiKey, fetchFn, dryRun = false, logger = console.log } = {}) {
  if (!content || !Array.isArray(content.lessons)) {
    throw new Error("Invalid content: must provide an object with a 'lessons' array.");
  }

  const totalBeats = content.lessons.reduce((acc, l) => acc + (l.sentences?.length || 0), 0);
  const beats = [];
  const recentPoses = [];

  let globalBeatIndex = 0;
  for (let lessonIndex = 0; lessonIndex < content.lessons.length; lessonIndex += 1) {
    const lesson = content.lessons[lessonIndex];
    const sentences = lesson.sentences || [];

    for (let sIdx = 0; sIdx < sentences.length; sIdx += 1) {
      const sentenceObj = sentences[sIdx];
      const sentenceText = typeof sentenceObj === "string" ? sentenceObj : sentenceObj.text;
      const role = sentenceObj.role || `sentence_${sIdx}`;

      const beatContext = {
        beatIndex: globalBeatIndex,
        totalBeats,
        lessonIndex,
        leftLabel: lesson.leftLabel,
        rightLabel: lesson.rightLabel,
        role,
        recentPoses: recentPoses.slice(0, 3),
      };

      let evaluation;
      if (dryRun) {
        evaluation = planMugsyDeterministic(sentenceText, { beatContext });
      } else {
        evaluation = await evaluateMugsySentenceDirector(sentenceText, {
          apiKey,
          fetchFn,
          beatContext,
        });
      }

      // Record to recent memory
      recentPoses.unshift(evaluation.mugsyPose);
      if (recentPoses.length > 5) recentPoses.pop();

      beats.push({
        beatIndex: globalBeatIndex,
        lessonIndex,
        role,
        sentence: sentenceText,
        mugsyPose: evaluation.mugsyPose,
        cameraMotion: evaluation.cameraMotion,
        badge: evaluation.badge,
        isPunchline: evaluation.isPunchline,
        provenance: evaluation.provenance,
      });

      if (logger) {
        logger(`[Jev Director] Beat ${globalBeatIndex + 1}/${totalBeats} (${role}): Pose=${evaluation.mugsyPose} Camera=${evaluation.cameraMotion} Badge="${evaluation.badge}"`);
      }

      globalBeatIndex += 1;
    }
  }

  return {
    version: "1.0",
    format: "mugsy-explains",
    director: dryRun ? "deterministic-variety-planner" : "jev-systemone",
    title: content.title || "Mugsy Explains",
    totalBeats,
    createdAt: new Date().toISOString(),
    beats,
  };
}
