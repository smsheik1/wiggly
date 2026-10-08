/**
 * My Pixar Story — Pre-Flight Validator
 *
 * Enforces strict validation before any paid media or external API calls:
 * 1. Validates MyPixarStoryInputs (Golden 5 answers, character traits, audio minimum 10s).
 * 2. Validates MyPixarStoryStoryboard (5 scenes, duration bounds, character consistency, Pixar styling).
 */

import type { MyPixarStoryInputs, MyPixarStoryStoryboard, MyPixarStoryAdScene } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates the raw user inputs before script compilation or generation.
 */
export function validateMyPixarStoryInputs(inputs: unknown): ValidationResult {
  const errors: string[] = [];

  if (!inputs || typeof inputs !== "object") {
    return { valid: false, errors: ["Inputs must be a valid object."] };
  }

  const data = inputs as Partial<MyPixarStoryInputs>;

  // Subject validation
  if (!data.subject) {
    errors.push("Missing required 'subject' field.");
  } else {
    if (!data.subject.preferredName?.trim()) {
      errors.push("Subject 'preferredName' is required.");
    }
    if (!data.subject.recipientName?.trim()) {
      errors.push("Recipient name ('recipientName') is required.");
    }
    if (!data.subject.keyPhysicalTraits) {
      errors.push("Subject 'keyPhysicalTraits' is required.");
    } else {
      const traits = data.subject.keyPhysicalTraits;
      if (!traits.hairColor?.trim()) errors.push("Physical trait 'hairColor' is required.");
      if (!traits.hairStyle?.trim()) errors.push("Physical trait 'hairStyle' is required.");
      if (!traits.eyeColor?.trim()) errors.push("Physical trait 'eyeColor' is required.");
    }
  }

  // Golden 5 Answers validation
  if (!data.answers) {
    errors.push("Missing required 'answers' field.");
  } else {
    const { scene1Childhood, scene2TeenFreedom, scene3LeapOfFaith, scene4Romance, scene5LegacyFinale } = data.answers;

    if (!scene1Childhood?.partnerInCrime?.trim() || !scene1Childhood?.weirdObsession?.trim()) {
      errors.push("Scene 1 (Childhood) requires 'partnerInCrime' and 'weirdObsession'.");
    }
    if (!scene2TeenFreedom?.freedomMachine?.trim() || !scene2TeenFreedom?.secretTeenIdentity?.trim()) {
      errors.push("Scene 2 (Teen Freedom) requires 'freedomMachine' and 'secretTeenIdentity'.");
    }
    if (!scene3LeapOfFaith?.riskOrAdventure?.trim() || !scene3LeapOfFaith?.triumphMoment?.trim()) {
      errors.push("Scene 3 (Leap of Faith) requires 'riskOrAdventure' and 'triumphMoment'.");
    }
    if (!scene4Romance?.howWeMet?.trim() || !scene4Romance?.awkwardDateMoment?.trim()) {
      errors.push("Scene 4 (Romance) requires 'howWeMet' and 'awkwardDateMoment'.");
    }
    if (!scene5LegacyFinale?.whatIWishKidsUnderstood?.trim() || !scene5LegacyFinale?.timeMachineMessageToChildSelf?.trim()) {
      errors.push("Scene 5 (Legacy Finale) requires 'whatIWishKidsUnderstood' and 'timeMachineMessageToChildSelf'.");
    }
  }

  // Audio capture validation (10s minimum gate)
  if (data.audio?.voiceCapture) {
    const { durationSeconds, audioUrl } = data.audio.voiceCapture;
    if (!audioUrl?.trim()) {
      errors.push("Voice capture audioUrl cannot be empty.");
    }
    if (typeof durationSeconds !== "number" || durationSeconds < 10) {
      errors.push(
        `Voice capture duration is ${durationSeconds ?? 0}s. A minimum of 10 seconds of speech is strictly required for Cartesia Sonic cloning.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates the compiled 5-scene storyboard before triggering SeaDance or TTS runners.
 */
export function validateMyPixarStoryStoryboard(storyboard: unknown): ValidationResult {
  const errors: string[] = [];

  if (!storyboard || typeof storyboard !== "object") {
    return { valid: false, errors: ["Storyboard must be a valid object."] };
  }

  const sb = storyboard as Partial<MyPixarStoryStoryboard>;

  if (sb.format !== "my-pixar-story") {
    errors.push("Storyboard format must be 'my-pixar-story'.");
  }

  if (!Array.isArray(sb.scenes) || sb.scenes.length !== 5) {
    errors.push(`Storyboard must contain exactly 5 scenes (found ${sb.scenes?.length ?? 0}).`);
  } else {
    sb.scenes.forEach((scene, index) => {
      const sceneLabel = `Scene ${index + 1}`;
      if (!scene.narrationScript?.trim()) {
        errors.push(`${sceneLabel} is missing its narration script.`);
      }
      if (!scene.characterDnaAgePrompt?.trim()) {
        errors.push(`${sceneLabel} is missing characterDnaAgePrompt.`);
      }
      if (!scene.seaDanceVideoPrompt?.trim()) {
        errors.push(`${sceneLabel} is missing seaDanceVideoPrompt.`);
      } else if (
        !scene.seaDanceVideoPrompt.includes("feature-quality 3D animated film") &&
        !scene.seaDanceVideoPrompt.includes("Pixar 3D animated film render")
      ) {
        errors.push(`${sceneLabel} video prompt is missing the required Pixar 3D aesthetic signature.`);
      }
      if (typeof scene.estimatedDurationSeconds !== "number" || scene.estimatedDurationSeconds <= 0) {
        errors.push(`${sceneLabel} has an invalid duration.`);
      }
    });
  }

  if (typeof sb.totalDurationSeconds !== "number" || sb.totalDurationSeconds < 45 || sb.totalDurationSeconds > 120) {
    errors.push(
      `Total storyboard duration (${sb.totalDurationSeconds ?? 0}s) must be between 45 and 120 seconds.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a complete MyPixarStoryAdScene for canonical ad rendering.
 */
export function validateMyPixarStoryAdScene(value: unknown): ValidationResult {
  const errors: string[] = [];

  if (!value || typeof value !== "object") {
    return { valid: false, errors: ["Scene must be a valid object."] };
  }

  const scene = value as Partial<MyPixarStoryAdScene>;

  if (scene.format !== "my-pixar-story") {
    errors.push("Scene format must be 'my-pixar-story'.");
  }

  if (!scene.creative || typeof scene.creative !== "object") {
    errors.push("Scene requires creative metadata.");
  }

  if (!scene.style || typeof scene.style !== "object" || !scene.style.accentColor) {
    errors.push("Scene style must define an accentColor.");
  }

  if (!scene.layout || typeof scene.layout !== "object") {
    errors.push("Scene requires a layout object.");
  } else {
    if (scene.layout.preset !== "my-pixar-story-memoir") {
      errors.push("Scene layout preset must be 'my-pixar-story-memoir'.");
    }
    if (!scene.layout.storyboard) {
      errors.push("Scene is missing required storyboard in layout.");
    } else {
      const sbResult = validateMyPixarStoryStoryboard(scene.layout.storyboard);
      if (!sbResult.valid) {
        errors.push(...sbResult.errors);
      }
    }
    if (
      scene.layout.activeClipUrls &&
      (!Array.isArray(scene.layout.activeClipUrls) || scene.layout.activeClipUrls.length > 5)
    ) {
      errors.push("Scene activeClipUrls must be an array of at most 5 clip URLs.");
    }
    if (
      scene.layout.activeKeyframeUrls &&
      (!Array.isArray(scene.layout.activeKeyframeUrls) || scene.layout.activeKeyframeUrls.length > 5)
    ) {
      errors.push("Scene activeKeyframeUrls must be an array of at most 5 keyframe URLs.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
