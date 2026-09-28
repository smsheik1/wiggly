import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const VALID_SPEAKER_ROLES = ["learner", "guide", "challenger"];
export const VALID_LAYOUTS = [
  "two-balanced",
  "two-first-focus",
  "two-second-focus",
  "three-balanced",
];
export const VALID_CALLOUT_THEMES = [
  "neutral",
  "question",
  "warm",
  "cool",
  "violet",
  "gold",
];
export const VALID_ACTING_ENERGIES = [
  "curious-inquiry",
  "master-explains",
  "ominous-challenge",
  "epiphany-breakthrough",
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
      `Cannot direct Otaku Explainer: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Otaku Explainer Director', and copy the generated key.\n` +
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
export function planOtakuSceneDeterministic(scene, { sceneContext } = {}) {
  const index = sceneContext?.sceneIndex ?? 0;
  const recentLayouts = sceneContext?.recentLayouts || [];
  const recentThemes = sceneContext?.recentThemes || [];
  const speakerRole = scene.speakerRole || "learner";

  // Select layout based on speaker role and index
  let layout = "two-balanced";
  if (speakerRole === "learner") {
    layout = "two-first-focus";
  } else if (speakerRole === "guide") {
    layout = "two-second-focus";
  } else if (speakerRole === "challenger") {
    layout = "three-balanced";
  }

  // Prevent layout stagnation (avoid 3 consecutive identical layouts)
  if (recentLayouts.length >= 2 && recentLayouts[0] === layout && recentLayouts[1] === layout) {
    const alternates = VALID_LAYOUTS.filter((l) => l !== layout);
    layout = alternates[index % alternates.length] || "two-balanced";
  }

  // Select callout theme based on role
  let theme = "neutral";
  if (speakerRole === "learner") theme = "question";
  else if (speakerRole === "guide") theme = "gold";
  else if (speakerRole === "challenger") theme = "violet";

  // Avoid identical consecutive themes
  if (recentThemes.length > 0 && theme === recentThemes[0]) {
    const alternates = VALID_CALLOUT_THEMES.filter((t) => t !== recentThemes[0]);
    theme = alternates[index % alternates.length] || "cool";
  }

  let actingEnergy = "curious-inquiry";
  if (speakerRole === "guide") actingEnergy = "master-explains";
  else if (speakerRole === "challenger") actingEnergy = "ominous-challenge";
  else if (index === (sceneContext?.totalScenes || 1) - 1) actingEnergy = "epiphany-breakthrough";

  let calloutLabel = scene.callout?.label;
  if (!calloutLabel) {
    if (speakerRole === "learner") calloutLabel = "WAIT, WHAT?!";
    else if (speakerRole === "guide") calloutLabel = "SECRET JUTSU";
    else if (speakerRole === "challenger") calloutLabel = "WARNING!";
  }

  return {
    layout,
    layoutConfidence: 1.0,
    callout: {
      label: calloutLabel.slice(0, 14),
      theme,
    },
    actingEnergy,
    energyConfidence: 1.0,
    provenance: "deterministic-variety-planner",
  };
}

/**
 * Directs an individual anime explainer scene using Jev System One.
 */
export async function evaluateOtakuSceneDirector(scene, { apiKey, fetchFn, sceneContext } = {}) {
  const questions = {
    layout: {
      type: "choice",
      instructions: "Which anime character placement layout best frames this dialogue turn and pedagogical beat?",
      criteria: {
        "two-balanced": "Two characters with equal visual weight discussing a concept side by side",
        "two-first-focus": "Emphasizes the first character (learner or questioner) on the left",
        "two-second-focus": "Emphasizes the second character (sensei or guide) on the right",
        "three-balanced": "All three roles (learner, guide, challenger) present for maximum tension",
      },
    },
    callout_theme: {
      type: "choice",
      instructions: "What visual color theme should the HUD callout badge display?",
      criteria: {
        "neutral": "Standard explanatory caption bubble",
        "question": "Puzzled inquiry or energetic confusion (learner)",
        "warm": "Friendly encouraging insight",
        "cool": "Tactical calm breakdown",
        "violet": "Sinister counterpoint, challenge, or dangerous misconception",
        "gold": "Ultimate secret technique, profound insight, or golden takeaway",
      },
    },
    acting_energy: {
      type: "choice",
      instructions: "What emotional energy governs the delivery of this line?",
      criteria: {
        "curious-inquiry": "Impatient eager pupil questioning an impossible technique",
        "master-explains": "Calm, composed sensei making complex mechanics crystal clear",
        "ominous-challenge": "Challenger exposing the fatal flaw in conventional wisdom",
        "epiphany-breakthrough": "Sudden realization and triumphant mastery of the concept",
      },
    },
  };

  const state = {
    speaker_role: scene.speakerRole,
    dialogue: scene.dialogue,
    estimated_duration_ms: scene.estimatedDurationMs,
    scene_progression: sceneContext
      ? `Scene ${sceneContext.sceneIndex + 1} of ${sceneContext.totalScenes}`
      : undefined,
    recent_layouts: sceneContext?.recentLayouts?.length > 0 ? sceneContext.recentLayouts : ["none yet"],
    direction_goal:
      "Direct the anime explainer staging with dynamic manga-style character layouts, " +
      "eye-catching HUD callouts, and expressive anime mentor-pupil pacing.",
  };

  const result = await callJevSystemOne({ state, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    throw new Error("Jev System One returned an empty response object.");
  }

  const answers = result.answers;

  let layout = answers.layout?.choice;
  if (!VALID_LAYOUTS.includes(layout)) {
    layout = "two-balanced";
  }

  // Prevent layout stagnation
  if (sceneContext?.recentLayouts?.length >= 2 &&
      sceneContext.recentLayouts[0] === layout &&
      sceneContext.recentLayouts[1] === layout) {
    const alternates = VALID_LAYOUTS.filter((l) => l !== layout);
    layout = alternates[0] || "two-balanced";
  }

  let theme = answers.callout_theme?.choice;
  if (!VALID_CALLOUT_THEMES.includes(theme)) {
    theme = "neutral";
  }

  let actingEnergy = answers.acting_energy?.choice;
  if (!VALID_ACTING_ENERGIES.includes(actingEnergy)) {
    actingEnergy = "master-explains";
  }

  let calloutLabel = scene.callout?.label || "POINT";
  if (scene.speakerRole === "learner") calloutLabel = "QUESTION";
  else if (scene.speakerRole === "challenger") calloutLabel = "CAUTION";
  else if (scene.speakerRole === "guide") calloutLabel = "INSIGHT";

  return {
    layout,
    layoutConfidence: answers.layout?.confidence ?? 0.95,
    callout: {
      label: calloutLabel.slice(0, 14),
      theme,
    },
    actingEnergy,
    energyConfidence: answers.acting_energy?.confidence ?? 0.95,
    provenance: "typesafe-jev-system-one",
  };
}

/**
 * Directs an entire Otaku Explainer lesson plan (all scenes) with variety memory.
 */
export async function directOtakuScenes(planInput, { apiKey, fetchFn, mode = "auto" } = {}) {
  const scenes = planInput.scenes || [];
  const directedScenes = [];
  const recentLayouts = [];
  const recentThemes = [];

  const useDeterministic = mode === "deterministic";

  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    const sceneContext = {
      sceneIndex: i,
      totalScenes: scenes.length,
      recentLayouts: [...recentLayouts],
      recentThemes: [...recentThemes],
    };

    let direction;
    if (useDeterministic) {
      direction = planOtakuSceneDeterministic(scene, { sceneContext });
    } else {
      direction = await evaluateOtakuSceneDirector(scene, { apiKey, fetchFn, sceneContext });
    }

    recentLayouts.unshift(direction.layout);
    recentThemes.unshift(direction.callout.theme);

    directedScenes.push({
      ...scene,
      layout: direction.layout,
      callout: direction.callout,
      directionMetadata: {
        actingEnergy: direction.actingEnergy,
        provenance: direction.provenance,
      },
    });
  }

  const cloned = JSON.parse(JSON.stringify(planInput));
  cloned.scenes = directedScenes;
  cloned.directedAt = new Date().toISOString();
  cloned.director = "Jev System One Autonomous Actor Director";

  return cloned;
}
