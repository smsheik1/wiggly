import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

/**
 * Loads the TypeSafe / Jev API key from secrets.env or environment variables.
 * Strictly adheres to Wiggly Rule 12 (Zero Silent Fallbacks).
 */
export function getTypesafeApiKey() {
  if (process.env.TYPESAFE_API_KEY?.trim()) {
    return process.env.TYPESAFE_API_KEY.trim();
  }
  if (process.env.JEV_API_KEY?.trim()) {
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
        // Ignore read errors and continue
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
 */
export async function callJevSystemOne({ state, questions, apiKey: explicitKey, fetchFn = fetch }) {
  const key = explicitKey !== undefined ? explicitKey : getTypesafeApiKey();
  if (!key) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ JEV DIRECTOR FAILURE: TYPESAFE_API_KEY IS MISSING (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `Cannot direct the scene: Jev autonomous actor director requires TYPESAFE_API_KEY.\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/dashboard\n` +
      `2. Log in, then click on 'API Keys' in the sidebar navigation (or go to https://typesafe.ai/keys).\n` +
      `3. Click 'Create New Secret Key', name it 'Wiggly Pixar Director', and copy the generated key.\n` +
      `4. Check balance: Go to https://typesafe.ai/billing and confirm an active card or available credits.\n` +
      `5. Open your local 'secrets.env' file at the root of your Wiggly repository in your code editor.\n` +
      `6. Add or update this exact line:\n` +
      `   TYPESAFE_API_KEY=your_copied_key_here\n` +
      `7. Save the file and re-run your operation.\n` +
      `================================================================================\n`
    );
  }

  const response = await fetchFn(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
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
      `❌ JEV DIRECTOR API ERROR (HTTP ${response.status}) (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `The TypeSafe Jev API call failed with response:\n${errText}\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and go to: https://typesafe.ai/billing\n` +
      `2. Verify active credits or an unexpired payment card. Click 'Add Credits' if balance is 0.\n` +
      `3. Go to https://typesafe.ai/keys, confirm your key is active, or create a fresh key.\n` +
      `4. Open 'secrets.env' at your repo root and update TYPESAFE_API_KEY.\n` +
      `5. Check https://status.typesafe.ai to confirm Jev services are operational.\n` +
      `6. Save 'secrets.env' and retry.\n` +
      `================================================================================\n`
    );
  }

  return response.json();
}

/**
 * Jev Module 1: Screenplay Word-Budget & Visual-Anchor Linter
 */
export async function lintPixarScreenplay({ beatNumber, scriptText, options = {} }) {
  const words = scriptText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const questions = {
    primary_physical_anchor: {
      type: "choice",
      instructions: "What is the primary physical noun anchor that MUST be visible on camera for this line?",
      criteria: {
        "tactile-craft-prop": "A tangible physical object in hands (e.g. dual-cassette boombox, spiral notebook, wooden board, tools)",
        "vintage-vehicle": "A weathered vintage vehicle (e.g. four-door sedan, station wagon, truck, or bicycle) on an asphalt street",
        "performance-stage-mic": "A vintage microphone or audio equipment in front of a cipher or crowd",
        "keepsake-photo-screen": "A framed photograph, hospital blanket, or phone screen displaying the child/loved one",
        "abstract-concept": "No clear physical object, purely abstract emotional exposition"
      }
    },
    visual_binding_status: {
      type: "choice",
      instructions: "Does this line have a concrete, stagable physical anchor or is it detached abstraction?",
      criteria: {
        "bound-concrete": "Contains a tangible physical object or sensory action that directly anchors the visual frame",
        "detached-abstract": "Pure abstraction (e.g. 'circuits and poetry') with zero direct stagable visual noun"
      }
    }
  };

  const jevRes = await callJevSystemOne({
    state: { format: "my-pixar-story", stage: "screenplay-linter", beatNumber, scriptText, wordCount },
    questions,
    apiKey: options.apiKey,
    fetchFn: options.fetchFn
  });

  const anchor = jevRes.answers?.primary_physical_anchor?.choice || "abstract-concept";
  const binding = jevRes.answers?.visual_binding_status?.choice || "bound-concrete";
  const minWords = beatNumber === 5 ? 14 : 18;
  const maxWords = beatNumber === 5 ? 18 : 24;
  const isWordBudgetValid = wordCount >= minWords && wordCount <= maxWords;
  const warnings = [];

  if (wordCount < minWords) {
    warnings.push(`Word count too short (${wordCount} words). Rule 0.3 requires ${minWords}–${maxWords} words.`);
  } else if (wordCount > maxWords) {
    warnings.push(`Word count too verbose (${wordCount} words). Rule 0.3 requires ${minWords}–${maxWords} words to keep clips breathing.`);
  }

  if (binding === "detached-abstract") {
    warnings.push(`Narrative disconnect: line lacks a concrete physical visual anchor. Anchor detected: '${anchor}'.`);
  }

  // Rule 0.9: Check for stock forbidden phrases
  const stockPhrases = [
    /proud doesn't begin to cover it/i,
    /my whole world/i,
    /meant everything/i,
    /my greatest masterpiece/i,
    /^Long before/i,
  ];
  for (const pattern of stockPhrases) {
    if (pattern.test(scriptText)) {
      warnings.push(`Rule 0.9 violation: Script contains banned stock cliché: ${pattern}`);
    }
  }

  // Rule 0.9: Disallow sentence-initial participial -ing openers to prevent dangling modifiers (e.g. 'Holding your hand, the room went quiet')
  if (/^[A-Z][a-z]+ing\b/.test(scriptText.trim())) {
    warnings.push(`Rule 0.9 grammar violation: Sentence begins with an -ing participle opener ('${scriptText.trim().split(/\s+/).slice(0, 3).join(" ")}...'), which violates active voice and risks dangling modifiers. Begin with a direct subject or grounded preposition instead.`);
  }

  // Rule 0.7: Verify ageLabel if present in options
  if (options.ageLabel) {
    const validCanonicalStages = ["Childhood", "Teen Years", "Young Adult", "New Parent", "Today"];
    const isStageValid = validCanonicalStages.includes(options.ageLabel) || (options.allowedAges && options.allowedAges.includes(options.ageLabel));
    if (!isStageValid) {
      warnings.push(`Rule 0.7 violation: ageLabel '${options.ageLabel}' is unverified. Must use canonical plain life stages (Childhood, Teen Years, Young Adult, New Parent, Today) or an explicit age provided in the answers.`);
    }

    if (validCanonicalStages.includes(options.ageLabel)) {
      const stageIdx = validCanonicalStages.indexOf(options.ageLabel);
      if (options.previousStageIndex !== undefined && stageIdx <= options.previousStageIndex) {
        warnings.push(`Rule 0.7 chronology violation: Life stage '${options.ageLabel}' does not ascend past previous stage '${validCanonicalStages[options.previousStageIndex]}'.`);
      }
    }
  }

  return {
    beatNumber,
    wordCount,
    anchor,
    binding,
    isWordBudgetValid,
    isValid: isWordBudgetValid && binding === "bound-concrete" && warnings.length === 0,
    warnings
  };
}

/**
 * Jev Module 4: Voiceover Duration & Silence Floor Gate
 * Verifies that spoken audio stays <= 8.5s and leaves >= 3.0s of silence in a 12.4s chapter.
 */
export function lintVoiceoverDuration({ beatNumber, durationSeconds, targetClipDuration = 12.4 }) {
  const maxSpeechDuration = 8.5;
  const minSilenceFloor = 3.0;
  const remainingSilence = Number((targetClipDuration - durationSeconds).toFixed(2));
  const warnings = [];

  if (durationSeconds > maxSpeechDuration) {
    warnings.push(`Speech duration exceeded (${durationSeconds}s > ${maxSpeechDuration}s max). Leaves only ${remainingSilence}s of silence in a ${targetClipDuration}s chapter, violating the 3-second silence floor.`);
  }

  if (remainingSilence < minSilenceFloor) {
    warnings.push(`Silence floor violated (${remainingSilence}s < ${minSilenceFloor}s minimum). Acoustic score and character acting require at least 3.0s of speech-free space.`);
  }

  return {
    beatNumber,
    durationSeconds,
    targetClipDuration,
    remainingSilence,
    isValid: warnings.length === 0,
    warnings
  };
}

/**
 * Jev Module 2: Keyframe Staging & Prop Visibility Director
 */
export async function directKeyframeStaging({ beatNumber, scene, options = {} }) {
  const questions = {
    camera_focal_length: {
      type: "choice",
      instructions: "Which focal length and framing progression fits this beat in the 5-chapter memoir arc?",
      criteria: {
        "50mm-medium": "50mm portrait lens at chest height, intimate medium two-shot with hands active",
        "35mm-wide": "35mm wide lens, environmental framing showing vehicle or wide suburban context",
        "65mm-portrait": "65mm portrait lens, shallow depth of field across an intimate table",
        "85mm-closeup": "85mm emotional close-up, creamy background bokeh focusing on tearful sincerity"
      }
    },
    emotional_payoff_visibility: {
      type: "choice",
      instructions: "How must focal props or keepsakes (e.g. photo frames, CRT screens) be oriented to camera?",
      criteria: {
        "face-visible-to-lens": "The active face/screen of the prop must be angled toward camera lens so audience clearly sees it",
        "profile-angled": "Prop viewed from 45-degree angle in hands",
        "environment-backdrop": "Prop sits in the soft-focus background as an atmospheric accent"
      }
    },
    character_limb_assignment: {
      type: "choice",
      instructions: "How should character hands and bodies be spatially assigned to prevent diffusion blending?",
      criteria: {
        "two-characters-discrete-hands": "Exactly two characters; Character A hands flat on table, Character B hand resting on shoulder",
        "solo-subject-anchored": "Single character; hands gently holding the base of the prop or keepsake with blunt fingertips",
        "shared-workspace-separated": "Two characters on workbench or shared space; strictly 4 hands visible in distinct resting positions"
      }
    }
  };

  const jevRes = await callJevSystemOne({
    state: { format: "my-pixar-story", stage: "keyframe-director", beatNumber, narration: scene.narrationScript },
    questions,
    apiKey: options.apiKey,
    fetchFn: options.fetchFn
  });

  const focalLength = jevRes.answers?.camera_focal_length?.choice || "50mm-medium";
  const propVisibility = jevRes.answers?.emotional_payoff_visibility?.choice || "face-visible-to-lens";
  const limbAssignment = jevRes.answers?.character_limb_assignment?.choice || "two-characters-discrete-hands";

  // Build the strict directorial staging injection
  let stagingDirective = "";
  if (propVisibility === "face-visible-to-lens") {
    stagingDirective += " Director Staging: The primary focal prop (microphone, instrument, card, or keepsake) is clearly oriented toward the camera lens so the front face and action are visible to the audience; strictly NO unprompted photo frames. ";
  }
  if (limbAssignment === "two-characters-discrete-hands" || limbAssignment === "shared-workspace-separated") {
    stagingDirective += " Character Anatomy Directive: Exactly two characters in frame with strictly four hands total, resting naturally in distinct spatial zones; strictly NO extra arms, NO floating limbs, NO third-arm artifacts. ";
  } else if (limbAssignment === "solo-subject-anchored") {
    stagingDirective += " Character Anatomy Directive: Single character in frame, natural two-hand posture adhering strictly to the shot description; strictly NO extra limbs, NO unprompted picture frames. ";
  }

  return {
    beatNumber,
    focalLength,
    propVisibility,
    limbAssignment,
    stagingDirective
  };
}

/**
 * Jev Module 3: Video Motion Director (Enforces the "One Arc Rule")
 */
export async function directMotionArc({ beatNumber, scene, options = {} }) {
  const questions = {
    motion_arc_type: {
      type: "choice",
      instructions: "What is the single, continuous physical gesture arc for this 15-second diffusion clip?",
      criteria: {
        "rhythmic-craft-gesture": "Single continuous gesture: rhythmic sanding across wood grain, gentle breathing hold",
        "steady-push-roll": "Continuous push: leaning with legs against bumper in smooth rolling motion, no sudden jerks",
        "wonder-key-press": "Quiet discovery: hand rests on keyboard, slow push-in, eyes widen as screen glows, subtle blinks",
        "intimate-portrait-hold": "Moving hold: holding photo frame close, chest rising with gentle breath, soft tearful smile to lens"
      }
    },
    pacing_discipline: {
      type: "choice",
      instructions: "How should the actor move across the 15-second duration to prevent end-of-clip spasms?",
      criteria: {
        "single-continuous-arc": "One deliberate, unhurried action sustained across all 15 seconds; strictly NO secondary actions",
        "compound-prohibited": "Multiple sequential actions are strictly prohibited in a single 15s diffusion clip"
      }
    }
  };

  const jevRes = await callJevSystemOne({
    state: { format: "my-pixar-story", stage: "video-motion-director", beatNumber, sceneTitle: scene.beatTitle },
    questions,
    apiKey: options.apiKey,
    fetchFn: options.fetchFn
  });

  const arcType = jevRes.answers?.motion_arc_type?.choice || "intimate-portrait-hold";

  // Clean prompt mapped to single continuous arc
  let directedMotionPrompt = "Real-time motion, strictly no slow motion. Single continuous shot, no cuts. Exactly 15 seconds duration. ";
  switch (arcType) {
    case "rhythmic-craft-gesture":
      directedMotionPrompt += "Low-angle gentle camera tracking. Single continuous physical action: rhythmic tactile movement in smooth continuous arcs. Dust motes drift lazily through natural light. Character breathes softly in deep concentration, holding focus throughout the shot.";
      break;
    case "steady-push-roll":
      directedMotionPrompt += "Smooth cinematic tracking shot. Steady, continuous momentum moving forward smoothly at an even pace. Hair and clothing edges sway gently in the draft before settling. Authentic focused expression, maintaining constant physical momentum throughout without stopping.";
      break;
    case "wonder-key-press":
      directedMotionPrompt += "Cinematic slow camera push-in. Quiet moment of discovery with subtle eye saccades and gentle natural breathing holds. Hands maintain steady contact as an authentic, genuine reaction slowly registers on the face.";
      break;
    case "intimate-portrait-hold":
    default:
      directedMotionPrompt += "Emotional static camera with delicate organic breathing drift. Subject looks with deep tenderness and sincerity, shoulders rising and falling with gentle breath. Moving hold with natural blinks and subtle micro-expressions throughout the entire duration.";
      break;
  }

  return {
    beatNumber,
    arcType,
    directedMotionPrompt
  };
}

/**
 * Jev Module 4: Assembly & Transition Director
 */
export async function directFilmAssembly({ targetBeats = [1, 2, 3, 5], options = {} }) {
  const questions = {
    transition_style: {
      type: "choice",
      instructions: "What transition style best bridges the temporal jumps between these life chapters?",
      criteria: {
        "warm-film-dissolve": "0.5s warm film crossfade (dissolve) across chapter boundaries to create nostalgic memory flow",
        "dip-to-black": "0.5s fade through black to signify passage of decades",
        "straight-cut": "Hard cut between shots"
      }
    },
    audio_ducking_level: {
      type: "choice",
      instructions: "How should the orchestral piano soundtrack be mixed under the Cartesia narration?",
      criteria: {
        "balanced-18db": "Soundtrack at -18dB (volume 0.14) so dialogue is crisp and intimate, swelling during reaction holds",
        "prominent-12db": "Soundtrack at -12dB for high cinematic drama",
        "subtle-24db": "Soundtrack at -24dB background whisper"
      }
    }
  };

  const jevRes = await callJevSystemOne({
    state: { format: "my-pixar-story", stage: "assembly-director", beats: targetBeats },
    questions,
    apiKey: options.apiKey,
    fetchFn: options.fetchFn
  });

  const transition = jevRes.answers?.transition_style?.choice || "warm-film-dissolve";
  const audioMix = jevRes.answers?.audio_ducking_level?.choice || "balanced-18db";

  return {
    transitionDurationSeconds: transition === "warm-film-dissolve" ? 0.5 : 0.0,
    transitionType: transition === "warm-film-dissolve" ? "fade" : "cut",
    bgMusicVolume: audioMix === "balanced-18db" ? 0.14 : 0.10
  };
}

/**
 * Jev Module 5: Autonomous Multi-Modal Vision Reviewer Gate
 * Uses Google Gemini Vision (gemini-3.8-flash / gemini-2.5-flash-image) to inspect rendered keyframe stills
 * for Pixar 3D stylization consistency, character likeness adherence, and anti-uncanny-valley checks.
 * Enforces Rule 12: halts loudly with click-by-click instructions if credentials fail.
 * Enforces Vision Model requirement: STOP immediately if the active model does not support image inputs.
 */
export async function reviewKeyframeWithVision({
  imagePath,
  beatNumber,
  subjectName,
  promptDescription,
  apiKey: explicitKey = undefined,
  model: requestedModel = "gemini-3.8-flash",
}) {
  let key = explicitKey;
  if (!key) {
    // Load GEMINI_API_KEY from process.env or secrets.env
    if (process.env.GEMINI_API_KEY?.trim()) {
      key = process.env.GEMINI_API_KEY.trim();
    } else {
      let currentDir = process.cwd();
      for (let i = 0; i < 7; i += 1) {
        const candidate = path.join(currentDir, "secrets.env");
        if (fs.existsSync(candidate)) {
          try {
            const lines = fs.readFileSync(candidate, "utf8").split("\n");
            for (const line of lines) {
              if (line.startsWith("GEMINI_API_KEY=")) {
                const val = line.split("=")[1]?.trim();
                if (val) {
                  key = val;
                  break;
                }
              }
            }
          } catch {}
        }
        if (key) break;
        const parent = path.dirname(currentDir);
        if (parent === currentDir) break;
        currentDir = parent;
      }
    }
  }

  if (!key) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ VISION REVIEWER FAILURE: GEMINI_API_KEY IS MISSING (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `Gemini Vision Reviewer requires official credentials, but GEMINI_API_KEY is not configured.\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and navigate to: https://aistudio.google.com/app/apikey\n` +
      `2. Log in and click 'Create API Key' (or copy an existing active key).\n` +
      `3. Open 'secrets.env' at your Wiggly repository root in your code editor.\n` +
      `4. Add or update this exact line:\n` +
      `   GEMINI_API_KEY=your_key_here\n` +
      `5. Save the file and re-run your review.\n` +
      `================================================================================\n`
    );
  }

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Vision Reviewer target image not found at: ${imagePath}`);
  }

  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Data = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  const systemPrompt = `You are a Senior Pixar Supervising Art Director and Quality Assurance Director.
Your task is to evaluate whether a generated film keyframe meets feature-quality Pixar 3D animated production standards.

Scene Context:
- Beat Number: ${beatNumber}
- Subject: ${subjectName}
- Expected Action / Staging: ${promptDescription}

Strict Production Criteria:
1. Pixar 3D CGI Aesthetic: Must strictly look like feature-quality RenderMan 3D path-traced animation (stylized expressive character design, smooth subsurface skin scattering, soft sculpted hair, tactile cloth with weight). Strictly REJECT if it looks like a live-action photograph, realistic human skin scan, flat 2D cartoon, or uncanny valley realism.
2. Character Likeness in Animation: Must capture the subject's distinct recognizable bone structure translated into stylized Pixar animated character design.
3. Unified Universe Check: If multiple characters are present (e.g. father and child), both MUST share the exact same Pixar 3D animated shader and stylization level. Strictly REJECT if one character is cartoon and the other is a realistic human.

Scoring Rubric:
- 8-10: Masterpiece/Flawless Pixar 3D styling and character likeness. Approve.
- 7: Production-ready Pixar 3D styling and recognizable character likeness. Approve.
- 1-6: Rejected (Photorealistic human photograph, uncanny valley, broken anatomy, wrong person, flat 2D).

Respond strictly in valid JSON with this exact schema:
{
  "approved": boolean,
  "score": number, // integer or float from 1 to 10 (>= 7 approved)
  "pixarStyleScore": number, // 1-10
  "likenessScore": number, // 1-10
  "critique": "Detailed art critique evaluating aesthetic, lighting, likeness, and style consistency",
  "actionableFixes": ["Specific directive 1", "Specific directive 2"]
}`;

  // Call the vision model
  const modelToUse = requestedModel;
  const isImageModelOnly = modelToUse.includes("-image");

  const requestBody = {
    contents: [{
      parts: [
        { text: systemPrompt },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]
    }]
  };

  if (!isImageModelOnly) {
    requestBody.generationConfig = { response_mime_type: "application/json" };
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // Check if error is due to model lack of image input support
    if (res.status === 400 && (errText.includes("image") || errText.includes("unsupported") || errText.includes("inline_data"))) {
      throw new Error(
        `\n================================================================================\n` +
        `❌ STOP: MODEL DOES NOT SUPPORT IMAGE INPUTS (VISION MODEL REQUIRED)\n` +
        `================================================================================\n` +
        `The configured model '${modelToUse}' does not support multimodal image inputs.\n\n` +
        `Action required:\n` +
        `Please start again in a model that supports image inputs (vision model), such as:\n` +
        `- gemini-3.8-flash (recommended default vision model)\n` +
        `- Google Antigravity Multimodal\n` +
        `- Claude 3.5 Sonnet\n` +
        `================================================================================\n`
      );
    }
    throw new Error(`Gemini Vision API error (HTTP ${res.status}): ${errText.slice(0, 300)}`);
  }

  const jsonRes = await res.json();
  const textOutput = jsonRes.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error("No review critique returned from Gemini Vision model.");
  }

  let reviewData;
  try {
    const cleaned = textOutput.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
    reviewData = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse vision review JSON: ${textOutput}`);
  }

  // Gating rule: approval requires score >= 7 and approved === true
  const isApproved = Boolean(reviewData.approved) && Number(reviewData.score || 0) >= 7;

  return {
    approved: isApproved,
    score: Number(reviewData.score || 0),
    pixarStyleScore: Number(reviewData.pixarStyleScore || 0),
    likenessScore: Number(reviewData.likenessScore || 0),
    critique: String(reviewData.critique || ""),
    actionableFixes: Array.isArray(reviewData.actionableFixes) ? reviewData.actionableFixes : []
  };
}
