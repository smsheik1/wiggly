/**
 * My Pixar Story — Conversational State Machine & Interview Orchestrator
 *
 * Implements:
 * 1. Two-Pass Turn Loop (Pass 1 Extractor -> Router -> Pass 2 Director).
 * 2. Bridge & Pivot Conversational Policy for handling tangents and meta-questions.
 * 3. Immutable Checkpointing & Time-Travel Rollback.
 * 4. Zero-Bloat pure TypeScript implementation (native Convex & Next.js compatible).
 */

import type {
  InterviewSessionState,
  NarrativeSlot,
  Golden5Answers,
  ConfirmedPhysicalTraits,
  CharacterVisualProfile,
  StoryBeatNumber,
  SessionCheckpoint,
  TangentMemory,
} from "./types";
import { compileCharacterDna } from "./prompt";

export const GOLDEN_5_METADATA: Record<
  keyof Golden5Answers,
  { beat: StoryBeatNumber; title: string; prompt: string }
> = {
  scene1Childhood: {
    beat: 1,
    title: "Chapter 1: The Wonder Years & Mischief",
    prompt:
      "Take us back to you at 8 years old: who was your partner-in-crime, what silly trouble did you get into, and what was your weird obsession that you thought was the coolest thing on earth?",
  },
  scene2TeenFreedom: {
    beat: 2,
    title: "Chapter 2: The Freedom Machine & Secret Identity",
    prompt:
      "What was your first real taste of freedom—what were you driving or riding, and what is one thing about teenage you that would completely shock your kids if they saw you back then?",
  },
  scene3LeapOfFaith: {
    beat: 3,
    title: "Chapter 3: The Leap of Faith",
    prompt:
      "What was the craziest risk or adventure you took when you first stepped out into the world on your own, and the moment you realized 'I actually did it'?",
  },
  scene4Romance: {
    beat: 4,
    title: "Chapter 4: Mom & Dad's Origin Story",
    prompt:
      "How did you meet your partner, what was the most awkward or hilarious thing that happened when you were trying to impress them, and when did you know they were 'the one'?",
  },
  scene5LegacyFinale: {
    beat: 5,
    title: "Chapter 5: What I Wish You Knew",
    prompt:
      "What is one thing you wish your kids truly understood about who you are inside—and if you could walk up to that 8-year-old kid on the bicycle and give them a hug today, what would you tell them?",
  },
};

export const ORDERED_SLOTS: Array<keyof Golden5Answers> = [
  "scene1Childhood",
  "scene2TeenFreedom",
  "scene3LeapOfFaith",
  "scene4Romance",
  "scene5LegacyFinale",
];

export interface TurnAnalysis {
  action:
    | "answer_active_slot"
    | "opportunistic_fill"
    | "revise_past_slot"
    | "tangent_anecdote"
    | "meta_question";
  targetSlotId: keyof Golden5Answers;
  extractedDistillation?: string;
  extractedSnippet?: string;
  tangentStory?: string;
  metaQuestionTopic?: "privacy" | "pricing" | "preview" | "length" | "general";
  confidence: number; // 0.0 to 1.0
}

/**
 * Creates the initial clean interview session state.
 */
export function createInitialSessionState(params: {
  sessionId?: string;
  userId?: string;
  subjectName: string;
  recipientName: string;
  visualTraits?: ConfirmedPhysicalTraits;
  visualProfile?: CharacterVisualProfile;
  audioConfig?: {
    narrationMode: "parent_clone" | "storybook_narrator";
    audioUrl?: string;
    durationSeconds?: number;
  };
}): InterviewSessionState {
  const defaultTraits: ConfirmedPhysicalTraits =
    params.visualTraits ||
    params.visualProfile?.confirmedTraits || {
      gender: "male",
      ageBracket: "40s",
      hairColor: "dark_brown",
      hairStyle: "short",
      eyeColor: "brown",
      glasses: false,
    };

  const compiledDna =
    params.visualProfile?.compiledCharacterDnaPrompt ||
    compileCharacterDna(defaultTraits, params.subjectName);

  const initialSlots: Record<keyof Golden5Answers, NarrativeSlot> = {
    scene1Childhood: {
      id: "scene1Childhood",
      beat: 1,
      title: GOLDEN_5_METADATA.scene1Childhood.title,
      questionPrompt: GOLDEN_5_METADATA.scene1Childhood.prompt,
      status: "in_progress",
    },
    scene2TeenFreedom: {
      id: "scene2TeenFreedom",
      beat: 2,
      title: GOLDEN_5_METADATA.scene2TeenFreedom.title,
      questionPrompt: GOLDEN_5_METADATA.scene2TeenFreedom.prompt,
      status: "unseen",
    },
    scene3LeapOfFaith: {
      id: "scene3LeapOfFaith",
      beat: 3,
      title: GOLDEN_5_METADATA.scene3LeapOfFaith.title,
      questionPrompt: GOLDEN_5_METADATA.scene3LeapOfFaith.prompt,
      status: "unseen",
    },
    scene4Romance: {
      id: "scene4Romance",
      beat: 4,
      title: GOLDEN_5_METADATA.scene4Romance.title,
      questionPrompt: GOLDEN_5_METADATA.scene4Romance.prompt,
      status: "unseen",
    },
    scene5LegacyFinale: {
      id: "scene5LegacyFinale",
      beat: 5,
      title: GOLDEN_5_METADATA.scene5LegacyFinale.title,
      questionPrompt: GOLDEN_5_METADATA.scene5LegacyFinale.prompt,
      status: "unseen",
    },
  };

  return {
    sessionId: params.sessionId || `session-${Date.now()}`,
    userId: params.userId || "guest-user",
    subjectName: params.subjectName,
    recipientName: params.recipientName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pipelineStage: "golden_5_interview",
    visualProfile: params.visualProfile || {
      status: params.visualTraits ? "confirmed" : "pending_upload",
      sourcePhotoUrls: [],
      confirmedTraits: defaultTraits,
      compiledCharacterDnaPrompt: compiledDna,
    },
    audioCapture: {
      status: params.audioConfig?.audioUrl ? "verified" : "pending",
      durationSeconds: params.audioConfig?.durationSeconds || 0,
      audioFileUrl: params.audioConfig?.audioUrl,
      narrationMode: params.audioConfig?.narrationMode || "parent_clone",
    },
    currentActiveSlotId: "scene1Childhood",
    slots: initialSlots,
    anecdoteBank: [],
    checkpoints: [],
  };
}

/**
 * Pass 1: Extractor Turn
 * Analyzes the user's utterance against the active slot, history, and intent categories.
 */
export function analyzeUserUtterance(
  state: InterviewSessionState,
  utterance: string
): TurnAnalysis {
  const text = utterance.trim().toLowerCase();
  const currentSlotId = state.currentActiveSlotId;

  // 1. Check for Meta Questions
  if (text.includes("who gets to see") || text.includes("private") || text.includes("shared")) {
    return {
      action: "meta_question",
      targetSlotId: currentSlotId,
      metaQuestionTopic: "privacy",
      confidence: 0.95,
    };
  }
  if (text.includes("how much") || text.includes("cost") || text.includes("pay") || text.includes("price")) {
    return {
      action: "meta_question",
      targetSlotId: currentSlotId,
      metaQuestionTopic: "pricing",
      confidence: 0.95,
    };
  }
  if (text.includes("preview") || text.includes("see it first") || text.includes("before i pay")) {
    return {
      action: "meta_question",
      targetSlotId: currentSlotId,
      metaQuestionTopic: "preview",
      confidence: 0.95,
    };
  }
  if (text.includes("how long") || text.includes("how many") || text.includes("minutes") || text.includes("seconds")) {
    return {
      action: "meta_question",
      targetSlotId: currentSlotId,
      metaQuestionTopic: "length",
      confidence: 0.95,
    };
  }

  // 2. Check for Revisions to Past Slots
  if (
    text.startsWith("actually, change") ||
    text.startsWith("wait, change") ||
    text.startsWith("actually wait, for my childhood") ||
    text.startsWith("for chapter 1") ||
    text.includes("redo what i said about") ||
    text.includes("back when i was 8") ||
    text.includes("back when i was eight")
  ) {
    let target: keyof Golden5Answers = "scene1Childhood";
    if (text.includes("high school") || text.includes("car") || text.includes("freedom")) {
      target = "scene2TeenFreedom";
    } else if (text.includes("college") || text.includes("risk") || text.includes("job")) {
      target = "scene3LeapOfFaith";
    } else if (text.includes("romance") || text.includes("wife") || text.includes("husband") || text.includes("date")) {
      target = "scene4Romance";
    }
    return {
      action: "revise_past_slot",
      targetSlotId: target,
      extractedDistillation: utterance.trim(),
      confidence: 0.9,
    };
  }

  // 3. Check for Tangents vs. Answers
  // Tangent signals: conversational pivots, unrelated anecdotes, pet stories out of place
  const isTangentIntro =
    text.includes("did i ever tell you about") ||
    text.includes("speaking of") ||
    text.includes("by the way") ||
    text.includes("reminds me of") ||
    text.includes("lawn tractor") ||
    text.includes("off topic");

  const isDogOrPetStory = text.includes("our dog") || text.includes("my dog") || text.includes("golden retriever") || text.includes("the cat");
  const isFamilyThanksgivingMishap = text.includes("thanksgiving") || text.includes("turkey caught fire");
  
  if (isTangentIntro) {
    return {
      action: "tangent_anecdote",
      targetSlotId: currentSlotId,
      tangentStory: utterance.trim(),
      confidence: 0.9,
    };
  }

  // If active slot is Scene 2 (Teen Freedom / Car) but user is talking about a dog with no mention of car, bike, or school:
  if (currentSlotId === "scene2TeenFreedom" && isDogOrPetStory && !text.includes("car") && !text.includes("drive") && !text.includes("bike")) {
    return {
      action: "tangent_anecdote",
      targetSlotId: currentSlotId,
      tangentStory: utterance.trim(),
      confidence: 0.88,
    };
  }

  if (isFamilyThanksgivingMishap && currentSlotId !== "scene1Childhood") {
    return {
      action: "tangent_anecdote",
      targetSlotId: currentSlotId,
      tangentStory: utterance.trim(),
      confidence: 0.88,
    };
  }

  // 4. Default: Answers the Active Slot
  // Evaluate richness of response
  const wordCount = utterance.trim().split(/\s+/).length;
  const confidence = wordCount >= 10 ? 0.92 : wordCount >= 4 ? 0.75 : 0.45;

  return {
    action: "answer_active_slot",
    targetSlotId: currentSlotId,
    extractedDistillation: utterance.trim(),
    confidence,
  };
}

/**
 * Pass 2: The Pixar Director Turn
 * Generates the response adhering to the Bridge & Pivot policy.
 */
export function generateDirectorResponse(
  state: InterviewSessionState,
  analysis: TurnAnalysis,
  recipientName: string
): string {
  // Scenario A: Meta Question
  if (analysis.action === "meta_question") {
    let answer = "";
    switch (analysis.metaQuestionTopic) {
      case "privacy":
        answer = "This film is 100% private to you and your family. Nobody else sees it unless you choose to share your private link or download the video.";
        break;
      case "pricing":
        answer = "Drafting, previewing, and rerolling your video with SeaDance 2.0 Mini is included. You only pay if you decide to export the final high-res 1080p archival cut!";
        break;
      case "preview":
        answer = "Yes, absolutely! You will watch the full draft preview with your voice and music before you finalize anything.";
        break;
      case "length":
        answer = "The finished short film is approximately 60 to 75 seconds—crafted in 5 core chapters, just like the prologue of a Pixar film.";
        break;
      default:
        answer = "Happy to answer any questions along the way!";
    }
    const currentPrompt = state.slots[state.currentActiveSlotId].questionPrompt;
    return `${answer}\n\nNow, back to our story: ${currentPrompt}`;
  }

  // Scenario B: Tangent / Personal Anecdote (The Bridge & Pivot)
  if (analysis.action === "tangent_anecdote") {
    const currentPrompt = state.slots[state.currentActiveSlotId].questionPrompt;
    return [
      "Haha, I love that memory—that is pure gold! I'm definitely saving that to tuck into the background of one of your scenes.",
      `Now, let's keep moving through your story: ${currentPrompt}`,
    ].join("\n\n");
  }

  // Scenario C: Revision
  if (analysis.action === "revise_past_slot") {
    const revisedTitle = state.slots[analysis.targetSlotId].title;
    return `Got it! I've updated your story for ${revisedTitle}. Everything else is right where you left it. Shall we jump back to where we were?`;
  }

  // Scenario D: Normal Answer (Validated & Advancing)
  if (state.pipelineStage === "script_review") {
    return [
      `That was beautiful. What a gift for ${recipientName}.`,
      "We've captured all five chapters of your story! Our animators are ready to compile your 5-scene Pixar script and timeline. Click below to review your screenplay!",
    ].join("\n\n");
  }

  const activeSlotPrompt = state.slots[state.currentActiveSlotId].questionPrompt;
  const currentSlotIndex = ORDERED_SLOTS.indexOf(state.currentActiveSlotId);

  const affirmations = [
    "That is so vivid—I can practically see the sunlight in that scene.",
    "Oh man, that's hilarious and so relatable.",
    "What a turning point. That took real guts.",
    "That is such a tender moment. Pure magic.",
  ];
  const affirmation =
    currentSlotIndex > 0
      ? affirmations[Math.min(currentSlotIndex - 1, affirmations.length - 1)]
      : affirmations[0];

  return `${affirmation}\n\n${activeSlotPrompt}`;
}

export interface DirectorTurnResponse {
  messageText: string;
  directorMessage: string;
  intentRecognized: "slot_answer" | "tangent_story" | "meta_question" | "slot_revision";
  transitionQuestion: string;
  tangentSavedToMemory: boolean;
  targetSlotId?: keyof Golden5Answers;
}

/**
 * Main Turn Execution Engine
 * Evaluates utterance, updates state, saves checkpoint, and returns next director reply.
 */
export function executeInterviewTurn(
  sessionOrParams:
    | InterviewSessionState
    | { session: InterviewSessionState; userUtterance: string },
  maybeUtterance?: string
): {
  nextState: InterviewSessionState;
  updatedSession: InterviewSessionState;
  directorResponse: DirectorTurnResponse;
  directorMessage: string;
  turnAnalysis: TurnAnalysis;
  checkpoint: SessionCheckpoint;
} {
  const currentState: InterviewSessionState =
    "session" in sessionOrParams ? sessionOrParams.session : sessionOrParams;
  const userUtterance: string =
    "userUtterance" in sessionOrParams
      ? sessionOrParams.userUtterance
      : maybeUtterance || "";

  // 1. Create Immutable Checkpoint BEFORE mutating state
  const completedCount = Object.values(currentState.slots).filter(
    (s) => s.status === "confirmed" || s.status === "filled"
  ).length;

  const checkpoint: SessionCheckpoint = {
    checkpointId: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    pipelineStage: currentState.pipelineStage,
    currentActiveSlotId: currentState.currentActiveSlotId,
    completedSlotsCount: completedCount,
  };

  // 2. Clone state deeply
  const nextState: InterviewSessionState = JSON.parse(JSON.stringify(currentState));
  nextState.checkpoints.push(checkpoint);
  nextState.updatedAt = new Date().toISOString();

  // 3. Pass 1: Analyze Turn
  const analysis = analyzeUserUtterance(currentState, userUtterance);

  // 4. State Transitions based on Analysis
  if (analysis.action === "answer_active_slot") {
    const slot = nextState.slots[analysis.targetSlotId];
    slot.status = "filled";
    slot.userRawTranscript = userUtterance;
    slot.distilledAnswer = analysis.extractedDistillation;

    // Advance to next slot if confidence is high
    if (analysis.confidence >= 0.7) {
      slot.status = "confirmed";
      const currentIndex = ORDERED_SLOTS.indexOf(analysis.targetSlotId);
      if (currentIndex + 1 < ORDERED_SLOTS.length) {
        const nextKey = ORDERED_SLOTS[currentIndex + 1];
        nextState.currentActiveSlotId = nextKey;
        nextState.slots[nextKey].status = "in_progress";
      } else {
        nextState.pipelineStage = "script_review";
      }
    }
  } else if (analysis.action === "tangent_anecdote") {
    // Bank the tangent memory
    const beatNumber = GOLDEN_5_METADATA[currentState.currentActiveSlotId].beat;
    const tangent: TangentMemory = {
      id: `tangent-${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: analysis.tangentStory || userUtterance,
      possibleBeatRelevance: beatNumber,
    };
    nextState.anecdoteBank.push(tangent);
  } else if (analysis.action === "revise_past_slot") {
    const slot = nextState.slots[analysis.targetSlotId];
    slot.userRawTranscript = userUtterance;
    slot.distilledAnswer = analysis.extractedDistillation;
    slot.status = "confirmed";
  }

  // 5. Pass 2: Director Turn
  const directorMessage = generateDirectorResponse(
    nextState,
    analysis,
    nextState.recipientName
  );

  const activePrompt = nextState.slots[nextState.currentActiveSlotId]?.questionPrompt || "";

  const directorResponse: DirectorTurnResponse = {
    messageText: directorMessage,
    directorMessage,
    intentRecognized:
      analysis.action === "answer_active_slot"
        ? "slot_answer"
        : analysis.action === "tangent_anecdote"
        ? "tangent_story"
        : analysis.action === "meta_question"
        ? "meta_question"
        : "slot_revision",
    transitionQuestion: activePrompt,
    tangentSavedToMemory: analysis.action === "tangent_anecdote",
    targetSlotId: analysis.targetSlotId,
  };

  return {
    nextState,
    updatedSession: nextState,
    directorResponse,
    directorMessage,
    turnAnalysis: analysis,
    checkpoint,
  };
}

/**
 * Time-Travel: Rolls back state to a specific checkpoint.
 */
export function rollbackToCheckpoint(
  currentState: InterviewSessionState,
  checkpointId: string
): InterviewSessionState {
  const targetIndex = currentState.checkpoints.findIndex(
    (c) => c.checkpointId === checkpointId
  );

  if (targetIndex === -1) {
    throw new Error(`Checkpoint '${checkpointId}' not found.`);
  }

  const targetCheckpoint = currentState.checkpoints[targetIndex];
  const restoredState: InterviewSessionState = JSON.parse(JSON.stringify(currentState));

  restoredState.pipelineStage = targetCheckpoint.pipelineStage as any;
  restoredState.currentActiveSlotId = targetCheckpoint.currentActiveSlotId as any;
  restoredState.checkpoints = restoredState.checkpoints.slice(0, targetIndex + 1);
  restoredState.updatedAt = new Date().toISOString();

  // Reset slots that were ahead of this checkpoint
  const activeIndex = ORDERED_SLOTS.indexOf(restoredState.currentActiveSlotId);
  for (let i = activeIndex + 1; i < ORDERED_SLOTS.length; i++) {
    restoredState.slots[ORDERED_SLOTS[i]].status = "unseen";
  }
  restoredState.slots[restoredState.currentActiveSlotId].status = "in_progress";

  return restoredState;
}

/**
 * Compiles confirmed session state slots into canonical Golden5Answers.
 */
export function compileAnswersFromSession(state: InterviewSessionState): Golden5Answers {
  return {
    scene1Childhood: {
      partnerInCrime: state.slots.scene1Childhood.distilledAnswer || "",
      sillyTrouble: state.slots.scene1Childhood.distilledAnswer || "",
      weirdObsession: state.slots.scene1Childhood.distilledAnswer || "",
    },
    scene2TeenFreedom: {
      freedomMachine: state.slots.scene2TeenFreedom.distilledAnswer || "",
      secretTeenIdentity: state.slots.scene2TeenFreedom.distilledAnswer || "",
    },
    scene3LeapOfFaith: {
      riskOrAdventure: state.slots.scene3LeapOfFaith.distilledAnswer || "",
      triumphMoment: state.slots.scene3LeapOfFaith.distilledAnswer || "",
    },
    scene4Romance: {
      howWeMet: state.slots.scene4Romance.distilledAnswer || "",
      awkwardDateMoment: state.slots.scene4Romance.distilledAnswer || "",
      theMomentIKnew: state.slots.scene4Romance.distilledAnswer || "",
    },
    scene5LegacyFinale: {
      whatIWishKidsUnderstood: state.slots.scene5LegacyFinale.distilledAnswer || "",
      timeMachineMessageToChildSelf: state.slots.scene5LegacyFinale.distilledAnswer || "",
    },
  };
}

export const createInitialInterviewState = createInitialSessionState;
export const rollbackToPastCheckpoint = rollbackToCheckpoint;
