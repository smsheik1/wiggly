import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { eligibleMotions } from "./choreography.mjs";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const VALID_BACKGROUNDS = [
  "deep-ocean",
  "retro-tv",
  "dance-club",
  "control-room",
];

export const VALID_BATTLE_INTENSITIES = [
  "warmup-groove",
  "escalating-heat",
  "furious-showdown",
  "grand-triumph",
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
      `Cannot direct Bikini Bottom Dance Off: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Dance Off Director', and copy the generated key.\n` +
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
export function planDanceChoreographyDeterministic(character, { characterIndex, availableMotions = [], usedMotions = new Set() } = {}) {
  const index = characterIndex ?? 0;

  // Filter out already used motions in this run
  const unused = availableMotions.filter((m) => !usedMotions.has(m.id));
  const pool = unused.length >= 3 ? unused : availableMotions;

  // Select distinct solo, finale, and reaction motions
  const soloCandidate = pool.find((m) => !usedMotions.has(m.id)) || pool[0];
  const finaleCandidate = pool.find((m) => !usedMotions.has(m.id) && m.id !== soloCandidate?.id && (m.durationSeconds >= 9 || !m.durationSeconds))
    || pool.find((m) => m.id !== soloCandidate?.id)
    || pool[0];
  const reactionCandidate = pool.find((m) => !usedMotions.has(m.id) && m.id !== soloCandidate?.id && m.id !== finaleCandidate?.id)
    || pool[0];

  const soloMotionId = soloCandidate?.id || character.motionId || "hip-hop-dancing";
  const finaleMotionId = finaleCandidate?.id || character.finaleMotionId || "silly-dancing";
  const reactionMotionId = reactionCandidate?.id || character.reactionMotionId || "cheering";

  const battleIntensity = VALID_BATTLE_INTENSITIES[index % VALID_BATTLE_INTENSITIES.length];

  return {
    soloMotionId,
    finaleMotionId,
    reactionMotionId,
    battleIntensity,
    confidence: 1.0,
    provenance: "deterministic-variety-planner",
  };
}

/**
 * Directs dance choreography for a single competitor using Jev System One.
 */
export async function evaluateDanceCompetitorDirector(character, { characterIndex, availableMotions = [], usedMotions = new Set(), apiKey, fetchFn } = {}) {
  const questions = {
    battle_intensity: {
      type: "choice",
      instructions: "What musical energy and battle intensity stage does this competitor represent in the 4-dancer arc?",
      criteria: {
        "warmup-groove": "Dancer 1: Opening groove establishing the rhythm and inviting the audience into the dance arena",
        "escalating-heat": "Dancer 2: Stepping up the challenge with bolder footwork and sharper attitude",
        "furious-showdown": "Dancer 3: High-octane climax showcasing explosive technique or absurd swagger",
        "grand-triumph": "Dancer 4: The showstopping finale performer dropping the definitive dance victory move",
      },
    },
  };

  const state = {
    character_id: character.characterId,
    character_label: character.label,
    slot_index: characterIndex + 1,
    taunt: character.taunt || "(no taunt)",
    direction_goal:
      "Direct the dance battle lineup with escalating rhythmic tension, " +
      "matching character personalities with expressive high-energy dance routines.",
  };

  const result = await callJevSystemOne({ state, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    throw new Error("Jev System One returned an empty response object.");
  }

  const answers = result.answers;
  let battleIntensity = answers.battle_intensity?.choice;
  if (!VALID_BATTLE_INTENSITIES.includes(battleIntensity)) {
    battleIntensity = VALID_BATTLE_INTENSITIES[characterIndex % VALID_BATTLE_INTENSITIES.length];
  }

  // Select motions from pool avoiding duplicates
  const deterministic = planDanceChoreographyDeterministic(character, { characterIndex, availableMotions, usedMotions });

  return {
    soloMotionId: deterministic.soloMotionId,
    finaleMotionId: deterministic.finaleMotionId,
    reactionMotionId: deterministic.reactionMotionId,
    battleIntensity,
    confidence: answers.battle_intensity?.confidence ?? 0.95,
    provenance: "typesafe-jev-system-one",
  };
}

/**
 * Directs an entire Bikini Bottom Dance Off episode (all 4 competitors) with variety memory.
 */
export async function directDanceOffEpisode(episodeInput, { apiKey, fetchFn, mode = "auto", catalogMotions = [] } = {}) {
  const characters = episodeInput.characters || [];
  const directedCharacters = [];
  const usedMotions = new Set();

  const useDeterministic = mode === "deterministic";

  for (let i = 0; i < characters.length; i += 1) {
    const char = characters[i];
    const characterContext = {
      characterIndex: i,
      totalCharacters: characters.length,
      availableMotions: catalogMotions,
      usedMotions,
    };

    let direction;
    if (useDeterministic) {
      direction = planDanceChoreographyDeterministic(char, characterContext);
    } else {
      direction = await evaluateDanceCompetitorDirector(char, { ...characterContext, apiKey, fetchFn });
    }

    usedMotions.add(direction.soloMotionId);
    usedMotions.add(direction.finaleMotionId);
    usedMotions.add(direction.reactionMotionId);

    directedCharacters.push({
      characterId: char.characterId,
      motionId: direction.soloMotionId,
      finaleMotionId: direction.finaleMotionId,
      reactionMotionId: direction.reactionMotionId,
      label: char.label,
      taunt: char.taunt,
      color: char.color,
      directionMetadata: {
        battleIntensity: direction.battleIntensity,
        provenance: direction.provenance,
      },
    });
  }

  const cloned = JSON.parse(JSON.stringify(episodeInput));
  cloned.characters = directedCharacters;
  cloned.directedAt = new Date().toISOString();
  cloned.director = "Jev System One Autonomous Actor Director";

  return cloned;
}
