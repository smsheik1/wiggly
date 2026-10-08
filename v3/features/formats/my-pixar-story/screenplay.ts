/**
 * My Pixar Story — Screenplay & Storyboard Compiler
 *
 * Compiles the Golden 5 answers into:
 * 1. Timed 12–15s narration scripts per scene (for Cartesia Sonic TTS).
 * 2. Visual scene descriptions & SeaDance 2.0 Mini / 2.5 video prompts.
 * 3. Complete MyPixarStoryStoryboard payload ready for validation and rendering.
 */

import type {
  MyPixarStoryInputs,
  MyPixarStoryScene,
  MyPixarStoryStoryboard,
  StoryBeatNumber,
} from "./types";
import {
  compileCharacterDna,
  getAgeProgressionDescriptor,
  buildSeaDanceVideoPrompt,
  buildKeyframeImagePrompt,
  BEAT_VISUAL_PROFILES,
} from "./prompt";
import { askActiveAgent } from "../../../lib/agent-bridge";

export interface AntigravityScreenplayOutput {
  beats: Array<{
    beatNumber: number;
    beatTitle: string;
    narrationScript: string;
    shotA: {
      name: string;
      description: string;
      keyframePrompt: string;
      videoPrompt: string;
    };
    shotB: {
      name: string;
      description: string;
      keyframePrompt: string;
      videoPrompt: string;
    };
  }>;
}

const SCREENPLAY_SCHEMA = {
  type: "object",
  properties: {
    beats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          beatNumber: { type: "integer" },
          beatTitle: { type: "string" },
          narrationScript: { type: "string" },
          shotA: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              keyframePrompt: { type: "string" },
              videoPrompt: { type: "string" },
            },
            "required": ["name", "description", "keyframePrompt", "videoPrompt"],
          },
          shotB: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              keyframePrompt: { type: "string" },
              videoPrompt: { type: "string" },
            },
            "required": ["name", "description", "keyframePrompt", "videoPrompt"],
          },
        },
        "required": ["beatNumber", "beatTitle", "narrationScript", "shotA", "shotB"],
      },
    },
  },
  "required": ["beats"],
};

function cleanSentence(text?: string, maxSentences: number = 2): string {
  if (!text) return "";
  const matches = text.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) return text.trim();
  return matches.slice(0, maxSentences).join(" ").trim();
}

/**
 * Compiles the 5-scene narration scripts from the Golden 5 answers.
 * Each script is tuned for ~12–15 seconds of spoken audio (~30–45 words).
 */
export function compileNarrationScripts(inputs: MyPixarStoryInputs): [string, string, string, string, string] {
  const { subject, answers } = inputs;
  const recipient = subject.recipientName || "sweetheart";
  const name = subject.preferredName || "I";
  const rel = (subject.relationshipToRecipient || "loved one").toLowerCase();
  const isDirectFamily = rel.includes("father") || rel.includes("mother") || rel.includes("parent") || rel.includes("grand");

  // Extract core memory phrases from answers adhering to 18-24 words
  const a1 = cleanSentence(answers.scene1Childhood.weirdObsession || answers.scene1Childhood.partnerInCrime, 1);
  const a2 = cleanSentence(answers.scene2TeenFreedom.freedomMachine || answers.scene2TeenFreedom.secretTeenIdentity, 1);
  const a3 = cleanSentence(answers.scene3LeapOfFaith.triumphMoment || answers.scene3LeapOfFaith.riskOrAdventure, 1);
  const a4 = cleanSentence(answers.scene4Romance.theMomentIKnew || answers.scene4Romance.howWeMet, 1);
  const a5 = cleanSentence(answers.scene5LegacyFinale.whatIWishKidsUnderstood || answers.scene5LegacyFinale.timeMachineMessageToChildSelf, 1);

  // Scene 1: Childhood
  const script1 = isDirectFamily
    ? `When I was little, ${recipient}, ${a1.slice(0, 90).trim()}.`
    : `Growing up, ${name} held tight to simple wonders: ${a1.slice(0, 90).trim()}.`;

  // Scene 2: Teen Freedom
  const script2 = isDirectFamily
    ? `In my teen years, ${recipient}, ${a2.slice(0, 90).trim()}.`
    : `As a teenager, ${name} chased freedom through the nights: ${a2.slice(0, 90).trim()}.`;

  // Scene 3: Leap of Faith
  const script3 = isDirectFamily
    ? `Taking that first big leap was terrifying, but ${a3.slice(0, 90).trim()}.`
    : `Risking everything on a dream, ${name} pressed forward: ${a3.slice(0, 90).trim()}.`;

  // Scene 4: The Anchor
  const script4 = isDirectFamily
    ? `The moment that changed everything was ${a4.slice(0, 90).trim()}.`
    : `In a quiet moment that grounded everything, ${a4.slice(0, 90).trim()}.`;

  // Scene 5: Legacy Finale (14-18 words)
  const script5 = isDirectFamily
    ? `${recipient}, never forget: ${a5.slice(0, 75).trim()}.`
    : `Looking back across the journey, the truth endures: ${a5.slice(0, 75).trim()}.`;

  return [script1, script2, script3, script4, script5];
}

/**
 * Builds the complete 5-scene Pixar Storyboard from user inputs.
 */
export function compileStoryboard(inputs: MyPixarStoryInputs): MyPixarStoryStoryboard {
  const { subject, answers, tone } = inputs;
  const characterDna = compileCharacterDna(subject.keyPhysicalTraits, subject.preferredName);
  const narrationScripts = compileNarrationScripts(inputs);

  const sceneTitles = [
    "Chapter 1: The Wonder Years & Mischief",
    "Chapter 2: The Freedom Machine",
    "Chapter 3: The Leap of Faith",
    "Chapter 4: The Origin of Us",
    "Chapter 5: What I Wish You Knew",
  ];

  // Specific visual scene actions derived from answers
  const sceneActions: [string, string, string, string, string] = [
    `A young child actively engaged in their childhood world, immersed in the memory of ${answers.scene1Childhood.weirdObsession.slice(0, 80)}`,
    `A young teenager discovering freedom and movement, centered around ${answers.scene2TeenFreedom.freedomMachine.slice(0, 80)}`,
    `A determined young adult taking a bold leap of faith, experiencing ${answers.scene3LeapOfFaith.triumphMoment.slice(0, 80)}`,
    `Two loved ones sharing an authentic emotional bond, grounded in the memory of ${answers.scene4Romance.theMomentIKnew.slice(0, 80)}`,
    `The adult subject reflecting tenderly on their journey and family connection, looking toward the future with heartfelt love`,
  ];

  const scenes: MyPixarStoryScene[] = [];
  let cumulativeDuration = 0;

  for (let i = 0; i < 5; i++) {
    const beatNumber = (i + 1) as StoryBeatNumber;
    const visualProfile = BEAT_VISUAL_PROFILES[beatNumber];
    const { ageLabel, characterPrompt } = getAgeProgressionDescriptor(
      characterDna,
      beatNumber,
      subject.keyPhysicalTraits
    );

    const seaDancePrompt = buildSeaDanceVideoPrompt(
      beatNumber,
      characterPrompt,
      sceneActions[i],
      visualProfile.camera,
      visualProfile.lighting,
      visualProfile.shotScalePrompt
    );

    const keyframePrompt = buildKeyframeImagePrompt(
      characterPrompt,
      sceneActions[i],
      visualProfile.lighting,
      visualProfile.shotScalePrompt
    );

    const artifact = inputs.familyMemorabilia?.find((m) => m.beatNumber === beatNumber);

    const seaDancePromptWithArtifact = artifact
      ? `${seaDancePrompt}. In the background (${artifact.placementInScene.replace(/_/g, " ")}), an authentic family keepsake is visible: ${artifact.description}.`
      : seaDancePrompt;

    const keyframePromptWithArtifact = artifact
      ? `${keyframePrompt}, with authentic family keepsake in scene: ${artifact.description}`
      : keyframePrompt;

    // Each scene defaults to ~13 seconds, total ~65 seconds
    const sceneDuration = 13;
    cumulativeDuration += sceneDuration;

    scenes.push({
      sceneIndex: i as 0 | 1 | 2 | 3 | 4,
      beatNumber,
      beatTitle: sceneTitles[i],
      ageLabel,
      narrationScript: narrationScripts[i],
      estimatedDurationSeconds: sceneDuration,
      characterDnaAgePrompt: characterPrompt,
      keyframeImagePrompt: keyframePromptWithArtifact,
      seaDanceVideoPrompt: seaDancePromptWithArtifact,
      shotScale: visualProfile.shotScale,
      focalLength: visualProfile.focalLength,
      musicMood: visualProfile.musicMood,
      cameraMovement: visualProfile.camera,
      environmentalLighting: visualProfile.lighting,
      scrapbookArtifact: artifact,
    });
  }

  return {
    format: "my-pixar-story",
    version: "0.1.0",
    subjectName: subject.preferredName,
    recipientName: subject.recipientName,
    compiledCharacterDna: characterDna,
    tone,
    imageProvider: inputs.visuals?.imageProvider ?? "meta-muse",
    imageModel: inputs.visuals?.imageModel ?? "muse-image-1.0",
    familyMemorabilia: inputs.familyMemorabilia,
    scenes: scenes as [
      MyPixarStoryScene,
      MyPixarStoryScene,
      MyPixarStoryScene,
      MyPixarStoryScene,
      MyPixarStoryScene
    ],
    totalDurationSeconds: cumulativeDuration,
    musicTrackId: "pixar-orchestral-memoir-suite-v1",
  };
}

/**
 * Compiles a rich 5-beat, 10-shot widescreen Pixar screenplay natively using
 * the active Google Antigravity model. Zero third-party dependencies, zero external API keys.
 * Falls back to deterministic compileStoryboard if running offline or outside Antigravity.
 */
export async function compileStoryboardWithAntigravity(
  inputs: MyPixarStoryInputs
): Promise<MyPixarStoryStoryboard> {
  const { subject, answers, tone } = inputs;
  const characterDna = compileCharacterDna(subject.keyPhysicalTraits, subject.preferredName);

  const prompt = `You are a master Pixar cinematic director and screenwriter.
Given a subject's real answers to 5 life story questions, write a 5-beat cinematic animated screenplay.
Target format: YouTube Longs 16:9 widescreen animated short film.

CRITICAL REQUIREMENTS:
1. Each beat has exactly TWO shots:
   - Shot A (Establishing/Medium Shot, 10s): Establishes the environment, setting, and main action with authentic details from the user's answer.
   - Shot B (Detail/Reaction/Close-up Shot, 10s): Captures the intimate emotion, close-up facial expression, hands, or specific mechanical/personal artifact described in the answer.
2. Screenplay Directing Rules (PIXAR-PROMPTER.md Part Zero - Single Source of Truth):
   - Adapt POV (0.1): ${subject.preferredName} speaks directly and tenderly to ${subject.recipientName} in 1st person throughout ALL 5 beats. Simple, honest, vulnerable words. At least one beat must admit a real fear, mistake, or cost, using ${subject.preferredName}'s own words from the answers.
   - Pacing & Word Budget (0.3):
     * EXACTLY 18 to 24 words per beat for Beats 1 to 4.
     * EXACTLY 14 to 18 words for Beat 5 (legacy finale), followed by a silent visual hold.
     * ONE memory per beat. Never squeeze or cram two memories into a single sentence.
     * Voiceover runs ~7-9 seconds, keeping at least 3 seconds of speech-free space in every clip for music and character acting.
   - Fidelity & Anti-Hallucination (0.7):
     * Facts come ONLY from the answers. Never add outside knowledge, career eras, or dates not provided in the answers.
     * Ages and life stages must strictly ascend across beats 1 through 5.
     * Avoid all stock phrases: strictly NO "Long before...", NO "my greatest masterpiece", NO "proud doesn't begin to cover it".
   - Keep Real Quotes (0.10):
     * If an answer contains a line someone actually said aloud, KEEP IT WORD-FOR-WORD. It is the one thing the script cannot improve on.
   - Directing & Grammar (0.4 & 0.9):
     * Physical prop anchors must come directly from the answers.
     * Every sentence must have a clear grammatical subject (no dangling modifiers, no two locations in one sentence).
3. Visual Prompts (keyframePrompt & videoPrompt - Dan Kieft Part One & Part Two):
   - Every keyframePrompt MUST open with:
     "A wide cinematic film still from a feature-length 3D animated film by Pixar Animation Studios (in the signature stylized animation aesthetic of Up, Ratatouille, and The Incredibles). RenderMan path-traced global illumination."
     Followed by stylized character caricature, RenderMan path-traced lighting, not photorealistic and not flat cartoon. Matte skin with warm subsurface glow through ears and fingertips, distinct facial color zones, tactile cloth with weight, 16:9 widescreen composition.
   - Every videoPrompt MUST follow Seedance 2.5 animation physics:
     "Real-time motion, no slow motion. Heads and hands travel in curved arcs, never robotic straight lines. Anticipation before every movement. Hair and cloth settle a beat after stopping. Moving hold with gentle breathing and natural blinks. Micro-saccades and asymmetric catchlights in eyes."
   - State exact shot count (Shot A establishing, Shot B reaction). Enforce no extra cuts.
   - Build settings and props ONLY from places and objects named in the answers.
   - Use preferred first names (e.g. "${subject.preferredName}") and physical traits in prompts to satisfy safety policies.

Subject: ${subject.fullName} ("${subject.preferredName}")
Recipient: ${subject.recipientName} (${subject.relationshipToRecipient})
Physical Traits: ${JSON.stringify(subject.keyPhysicalTraits)}

Answers:
${JSON.stringify(answers, null, 2)}

Output the full JSON matching the schema now.`;

  try {
    const response = await askActiveAgent<AntigravityScreenplayOutput>(prompt, {
      schema: SCREENPLAY_SCHEMA,
    });

    if (!response?.beats || response.beats.length < 5) {
      throw new Error("Antigravity returned incomplete beats");
    }

    const scenes: MyPixarStoryScene[] = [];
    let cumulativeDuration = 0;

    for (let i = 0; i < 5; i++) {
      const beatNumber = (i + 1) as StoryBeatNumber;
      const visualProfile = BEAT_VISUAL_PROFILES[beatNumber];
      const beatData = response.beats.find((b) => b.beatNumber === beatNumber) || response.beats[i];

      const { ageLabel, characterPrompt } = getAgeProgressionDescriptor(
        characterDna,
        beatNumber,
        subject.keyPhysicalTraits
      );

      const sceneDuration = 20; // 10s Shot A + 10s Shot B = 20s
      cumulativeDuration += sceneDuration;

      const artifact = inputs.familyMemorabilia?.find((m) => m.beatNumber === beatNumber);

      scenes.push({
        sceneIndex: i as 0 | 1 | 2 | 3 | 4,
        beatNumber,
        beatTitle: beatData.beatTitle || `Chapter ${beatNumber}`,
        ageLabel,
        narrationScript: beatData.narrationScript,
        estimatedDurationSeconds: sceneDuration,
        characterDnaAgePrompt: characterPrompt,
        keyframeImagePrompt: beatData.shotA.keyframePrompt,
        seaDanceVideoPrompt: beatData.shotA.videoPrompt,
        shotA: {
          shotType: "shot_a_establishing",
          name: beatData.shotA.name,
          description: beatData.shotA.description,
          keyframePrompt: beatData.shotA.keyframePrompt,
          videoPrompt: beatData.shotA.videoPrompt,
          durationSeconds: 10,
        },
        shotB: {
          shotType: "shot_b_reaction",
          name: beatData.shotB.name,
          description: beatData.shotB.description,
          keyframePrompt: beatData.shotB.keyframePrompt,
          videoPrompt: beatData.shotB.videoPrompt,
          durationSeconds: 10,
        },
        shotScale: visualProfile.shotScale,
        focalLength: visualProfile.focalLength,
        musicMood: visualProfile.musicMood,
        cameraMovement: visualProfile.camera,
        environmentalLighting: visualProfile.lighting,
        scrapbookArtifact: artifact,
      });
    }

    return {
      format: "my-pixar-story",
      version: "0.1.0",
      subjectName: subject.preferredName,
      recipientName: subject.recipientName,
      compiledCharacterDna: characterDna,
      tone,
      imageProvider: inputs.visuals?.imageProvider ?? "meta-muse",
      imageModel: inputs.visuals?.imageModel ?? "muse-image-1.0",
      familyMemorabilia: inputs.familyMemorabilia,
      scenes: scenes as [
        MyPixarStoryScene,
        MyPixarStoryScene,
        MyPixarStoryScene,
        MyPixarStoryScene,
        MyPixarStoryScene
      ],
      totalDurationSeconds: cumulativeDuration,
      musicTrackId: "pixar-orchestral-memoir-suite-v1",
    };
  } catch (err) {
    console.warn("Notice: Antigravity native screenplay compiler fallback to base compiler:", err);
    return compileStoryboard(inputs);
  }
}

