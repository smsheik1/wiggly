import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export const VALID_DELIVERY_ATTITUDES = [
  "deadpan-stoic",
  "incredulous-banter",
  "smug-intellectual",
  "feigned-apathy",
  "passionate-outburst",
];

export const VALID_VISUAL_EMPHASES = [
  "steady-focus",
  "dramatic-speed-ramp",
  "punch-in-cut",
  "slow-glide",
];

export const VALID_TURN_ROLES = [
  "hook-provocation",
  "forensic-counter",
  "absurdist-escalation",
  "philosophical-punchline",
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
      `Cannot direct Character Gameplay Conversation: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go directly to https://typesafe.ai/keys).\n` +
      `3. Click the 'Create New Secret Key' button, name it 'Wiggly Gameplay Conversation Director', and copy the generated key.\n` +
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
export function planGameplayTurnDeterministic(turn, { turnContext } = {}) {
  const index = turnContext?.turnIndex ?? 0;
  const totalTurns = turnContext?.totalTurns ?? 1;
  const recentAttitudes = turnContext?.recentAttitudes || [];
  const recentEmphases = turnContext?.recentEmphases || [];

  let turnRole = "hook-provocation";
  if (index === 0) turnRole = "hook-provocation";
  else if (index === totalTurns - 1) turnRole = "philosophical-punchline";
  else if (index % 2 === 1) turnRole = "forensic-counter";
  else turnRole = "absurdist-escalation";

  let deliveryAttitude = "incredulous-banter";
  if (index === 0) deliveryAttitude = "incredulous-banter";
  else if (turnRole === "forensic-counter") deliveryAttitude = "smug-intellectual";
  else if (turnRole === "absurdist-escalation") deliveryAttitude = "passionate-outburst";
  else if (turnRole === "philosophical-punchline") deliveryAttitude = "deadpan-stoic";

  // Prevent consecutive duplicate delivery attitudes
  if (recentAttitudes.length > 0 && deliveryAttitude === recentAttitudes[0]) {
    const alternates = VALID_DELIVERY_ATTITUDES.filter((a) => a !== recentAttitudes[0]);
    deliveryAttitude = alternates[index % alternates.length] || "deadpan-stoic";
  }

  let visualEmphasis = "steady-focus";
  if (turnRole === "philosophical-punchline") visualEmphasis = "punch-in-cut";
  else if (turnRole === "forensic-counter") visualEmphasis = "dramatic-speed-ramp";
  else if (index % 2 === 0) visualEmphasis = "slow-glide";
  else visualEmphasis = "steady-focus";

  // Prevent consecutive duplicate visual emphasis
  if (recentEmphases.length > 0 && visualEmphasis === recentEmphases[0]) {
    const alternates = VALID_VISUAL_EMPHASES.filter((e) => e !== recentEmphases[0]);
    visualEmphasis = alternates[index % alternates.length] || "steady-focus";
  }

  return {
    turnRole,
    deliveryAttitude,
    deliveryConfidence: 1.0,
    visualEmphasis,
    emphasisConfidence: 1.0,
    isPunchline: index === totalTurns - 1,
    provenance: "deterministic-variety-planner",
  };
}

/**
 * Directs a single dialogue turn in Character Gameplay Conversations using Jev System One.
 */
export async function evaluateGameplayTurnDirector(turn, { apiKey, fetchFn, turnContext } = {}) {
  const questions = {
    turn_role: {
      type: "choice",
      instructions: "What Socratic dramatic function does this dialogue turn serve in the conversation arc?",
      criteria: {
        "hook-provocation": "Opening high-energy in-media-res question hooking the audience immediately",
        "forensic-counter": "Dense factual, mathematical, or moral counter-argument refuting the premise",
        "absurdist-escalation": "Pushing the debate to its most extreme, comical, or hyper-specific conclusion",
        "philosophical-punchline": "The final definitive answer, punchline, or philosophical mic-drop",
      },
    },
    delivery_attitude: {
      type: "choice",
      instructions: "Which vocal delivery attitude and emotional conviction best fits this character's argument?",
      criteria: {
        "deadpan-stoic": "Cold, gravelly, unshakeable conviction without wasting words",
        "incredulous-banter": "Energetic disbelief challenging the other character's sanity or logic",
        "smug-intellectual": "Arrogant, analytical lecture dissecting every flaw in the argument",
        "feigned-apathy": "Dismissive pragmatism pretending not to care while proving a point",
        "passionate-outburst": "Explosive moral outrage or exasperation at the sheer absurdity",
      },
    },
    visual_emphasis: {
      type: "choice",
      instructions: "What video pacing and visual gameplay camera dynamic should accompany this turn?",
      criteria: {
        "steady-focus": "Clean, legible tracking of gameplay keeping focus squarely on the spoken argument",
        "dramatic-speed-ramp": "Accelerated tension underscoring rapid-fire evidence or forensic breakdown",
        "punch-in-cut": "Punchy subtle framing zoom emphasizing a devastating rebuttal or punchline",
        "slow-glide": "Atmospheric gliding motion providing breathing room for high-concept dialogue",
      },
    },
    is_punchline: {
      type: "noul",
      instructions: "Is this turn delivering the final comedic punchline or conclusion of the Short?",
    },
  };

  const state = {
    speaker: turn.speaker,
    dialogue_text: turn.text,
    duration_seconds: turn.durationSeconds,
    turn_progression: turnContext
      ? `Turn ${turnContext.turnIndex + 1} of ${turnContext.totalTurns}`
      : undefined,
    topic: turnContext?.topic,
    recent_attitudes: turnContext?.recentAttitudes?.length > 0 ? turnContext.recentAttitudes : ["none yet"],
    recent_emphases: turnContext?.recentEmphases?.length > 0 ? turnContext.recentEmphases : ["none yet"],
    direction_goal:
      "Direct the character dialogue and gameplay visual pacing with sharp Socratic tension, " +
      "dynamic vocal contrast, and comedic payoff across all turns.",
  };

  const result = await callJevSystemOne({ state, questions, apiKey, fetchFn });
  if (!result || !result.answers) {
    throw new Error("Jev System One returned an empty response object.");
  }

  const answers = result.answers;

  let turnRole = answers.turn_role?.choice;
  if (!VALID_TURN_ROLES.includes(turnRole)) {
    turnRole = turnContext?.turnIndex === 0 ? "hook-provocation" : "forensic-counter";
  }

  let deliveryAttitude = answers.delivery_attitude?.choice;
  if (!VALID_DELIVERY_ATTITUDES.includes(deliveryAttitude)) {
    deliveryAttitude = "incredulous-banter";
  }

  // Enforce variety guardrail: avoid consecutive duplicate delivery attitudes
  if (turnContext?.recentAttitudes?.[0] === deliveryAttitude) {
    const alternates = VALID_DELIVERY_ATTITUDES.filter((a) => a !== turnContext.recentAttitudes[0]);
    deliveryAttitude = alternates[0] || "deadpan-stoic";
  }

  let visualEmphasis = answers.visual_emphasis?.choice;
  if (!VALID_VISUAL_EMPHASES.includes(visualEmphasis)) {
    visualEmphasis = "steady-focus";
  }

  // Enforce variety guardrail: avoid consecutive duplicate visual emphasis
  if (turnContext?.recentEmphases?.[0] === visualEmphasis) {
    const alternates = VALID_VISUAL_EMPHASES.filter((e) => e !== turnContext.recentEmphases[0]);
    visualEmphasis = alternates[0] || "steady-focus";
  }

  const isPunchline = Boolean(answers.is_punchline?.condition);

  return {
    turnRole,
    deliveryAttitude,
    deliveryConfidence: answers.delivery_attitude?.confidence ?? 0.95,
    visualEmphasis,
    emphasisConfidence: answers.visual_emphasis?.confidence ?? 0.95,
    isPunchline,
    provenance: "typesafe-jev-system-one",
  };
}

/**
 * Directs an entire Character Gameplay Conversation episode with variety-first choreography.
 */
export async function directGameplayConversation(conversationInput, { apiKey, fetchFn, mode = "auto" } = {}) {
  const turns = conversationInput.turns || [];
  const directedTurns = [];
  const recentAttitudes = [];
  const recentEmphases = [];

  const useDeterministic = mode === "deterministic";

  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i];
    const turnContext = {
      turnIndex: i,
      totalTurns: turns.length,
      topic: conversationInput.topic || conversationInput.header?.title,
      recentAttitudes: [...recentAttitudes],
      recentEmphases: [...recentEmphases],
    };

    let direction;
    if (useDeterministic) {
      direction = planGameplayTurnDeterministic(turn, { turnContext });
    } else {
      direction = await evaluateGameplayTurnDirector(turn, { apiKey, fetchFn, turnContext });
    }

    recentAttitudes.unshift(direction.deliveryAttitude);
    recentEmphases.unshift(direction.visualEmphasis);

    directedTurns.push({
      speaker: turn.speaker,
      text: turn.text,
      durationSeconds: turn.durationSeconds,
      audio: turn.audio,
      captions: turn.captions,
      direction: {
        turnRole: direction.turnRole,
        deliveryAttitude: direction.deliveryAttitude,
        visualEmphasis: direction.visualEmphasis,
        isPunchline: direction.isPunchline,
        provenance: direction.provenance,
      },
    });
  }

  return {
    schemaVersion: conversationInput.schemaVersion || 1,
    topic: conversationInput.topic,
    header: conversationInput.header,
    castMode: conversationInput.castMode,
    cast: conversationInput.cast,
    gameplay: conversationInput.gameplay,
    music: conversationInput.music,
    turns: directedTurns,
    directedAt: new Date().toISOString(),
    director: "Jev System One Autonomous Actor Director",
  };
}
