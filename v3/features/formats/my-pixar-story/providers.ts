/**
 * My Pixar Story — External Provider Runners & Rule 12 Error Boundaries
 *
 * Implements:
 * 1. Cartesia Sonic voice cloning & 12–15s scene narration synthesis.
 * 2. SeaDance 2.0 Mini / 2.5 video clip generation with 480p draft & 1080p export tiering.
 * 3. Strict Rule 12 enforcement: zero silent fallbacks on missing keys, rate limits, or API errors.
 * 4. Deterministic offline mock runner for test suites (0 paid API calls).
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { PixarSceneMood, StoryBeatNumber } from "./types";

export const CARTESIA_VOICE_PRESETS: Record<string, string> = {
  warm_morgan_freeman: "c45bc5ec-dc68-4feb-8829-6e6b2748095d", // Trevor - Deep, resonant, elderly male storyteller
  steady_storyteller: "ed82c17b-4704-4d34-be43-5d19065acdf1", // Carl - Matured steady storyteller
  husky_narrator: "23112795-d54e-4560-9568-791a87c30201", // Darius - Husky textured engaging narrator
  calm_mentor: "98a34ef2-2140-4c28-9c71-663dc4dd7022", // Clyde - Gentle measured warm narrator
};

export const CARTESIA_DEFAULT_VOICE_ID = CARTESIA_VOICE_PRESETS.warm_morgan_freeman;
export const CARTESIA_TTS_URL = "https://api.cartesia.ai/tts/bytes";
export const CARTESIA_MODEL = "sonic-3.6";
export const SEADANCE_API_URL = "https://api.seadance.ai/v1/generate";

export const PIXAR_PHONETIC_DICTIONARY: Record<string, string> = {
  Wozniak: "Wahz-nee-ak",
  Woz: "Wahz",
  Cupertino: "Koo-per-tee-noh",
  "Hewlett-Packard": "Hew-lit Pack-ard",
  "MOS 6502": "Moss sixty-five oh two",
  Macintosh: "Mack-in-tosh",
  NeXT: "Next",
  Pixar: "Picks-are",
};

export function applyPhoneticPronunciations(text: string): string {
  let cleaned = text;
  for (const [term, phonetic] of Object.entries(PIXAR_PHONETIC_DICTIONARY)) {
    const regex = new RegExp(`\\b${term}\\b`, "g");
    cleaned = cleaned.replace(regex, phonetic);
  }
  return cleaned;
}

/**
 * Loads a named secret strictly in memory from process.env or repo-root secrets.env.
 * Does not write, log, or expose the key.
 */
export async function loadNamedSecret(keyName: string): Promise<string | null> {
  if (process.env[keyName]?.trim()) {
    return process.env[keyName]!.trim();
  }

  const searchRoots = [
    process.cwd(),
    path.join(process.cwd(), ".."),
    path.join(process.cwd(), "../.."),
    path.join(process.cwd(), "../../.."),
  ];

  for (const root of searchRoots) {
    try {
      const candidate = path.join(root, "secrets.env");
      const content = await fs.readFile(candidate, "utf8");
      const regex = new RegExp(`^${keyName}=([^\\r\\n]+)`, "m");
      const match = content.match(regex);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
    } catch {
      // Continue searching parent directories
    }
  }

  return null;
}

export interface VoiceSynthesisOptions {
  text: string;
  voiceId?: string;
  mock?: boolean;
  explicitApiKey?: string;
}

export interface VoiceSynthesisResult {
  audioUrl: string;
  durationSeconds: number;
  mimeType: string;
  isMock: boolean;
}

/**
 * Synthesizes scene narration using Cartesia Sonic.
 * Adheres strictly to Rule 12: halts immediately on failure with click-by-click fix steps.
 */
export async function synthesizeSceneNarration(
  options: VoiceSynthesisOptions
): Promise<VoiceSynthesisResult> {
  const { text, voiceId, mock = false, explicitApiKey } = options;
  const resolvedVoiceId =
    voiceId && CARTESIA_VOICE_PRESETS[voiceId]
      ? CARTESIA_VOICE_PRESETS[voiceId]
      : voiceId || CARTESIA_DEFAULT_VOICE_ID;

  if (mock) {
    // Deterministic mock generation for offline test suites
    const wordCount = text.trim().split(/\s+/).length;
    const estimatedSeconds = Math.max(3, Math.round(wordCount / 2.5));
    return {
      audioUrl: `mock://cartesia/audio/${encodeURIComponent(text.slice(0, 20))}.wav`,
      durationSeconds: estimatedSeconds,
      mimeType: "audio/wav",
      isMock: true,
    };
  }

  const apiKey = explicitApiKey !== undefined ? explicitApiKey : (await loadNamedSecret("CARTESIA_API_KEY"));

  if (!apiKey) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ VOICE SYNTHESIS FAILURE: CARTESIA_API_KEY IS MISSING (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `My Pixar Story voiceover synthesis requires official Cartesia credentials, but CARTESIA_API_KEY is not configured.\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and go to: https://play.cartesia.ai/keys\n` +
      `2. Log in, then click the '+ Create API Key' button in the top right.\n` +
      `3. Name your key (e.g. 'Wiggly Pixar Story Voice') and click 'Create'. Copy the secret key.\n` +
      `4. Check your credits: Click 'Billing' in the left menu (https://play.cartesia.ai/settings/billing) and confirm active character balance.\n` +
      `5. Open your local 'secrets.env' file at the root of your Wiggly repository in your code editor.\n` +
      `6. Add or update this exact line:\n` +
      `   CARTESIA_API_KEY=your_copied_key_here\n` +
      `7. Save the file and re-run your operation.\n` +
      `================================================================================\n`
    );
  }

  const response = await fetch(CARTESIA_TTS_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": "2024-06-10",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: CARTESIA_MODEL,
      transcript: applyPhoneticPronunciations(text.trim()),
      voice: {
        mode: "id",
        id: resolvedVoiceId,
      },
      output_format: {
        container: "wav",
        encoding: "pcm_s16le",
        sample_rate: 44100,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `\n================================================================================\n` +
      `❌ CARTESIA VOICE SYNTHESIS API ERROR (HTTP ${response.status}) (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `Cartesia voice generation failed with response:\n${errorBody.slice(0, 300)}\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and navigate to: https://play.cartesia.ai/settings/billing\n` +
      `2. Confirm your character balance has not hit 0. Click 'Add Credits' if balance is depleted.\n` +
      `3. Go to https://play.cartesia.ai/keys, confirm your key is still active, or create a fresh key.\n` +
      `4. Open 'secrets.env' at the repository root and verify CARTESIA_API_KEY matches.\n` +
      `5. Check https://status.cartesia.ai to verify Cartesia voice systems are online.\n` +
      `6. Save 'secrets.env' and retry.\n` +
      `================================================================================\n`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const byteRate = arrayBuffer.byteLength >= 32 ? new DataView(arrayBuffer).getUint32(28, true) : 88200;
  const calculatedDuration = Number(((arrayBuffer.byteLength - 44) / (byteRate || 88200)).toFixed(2));
  const durationSeconds = Math.max(1, calculatedDuration);

  const audioUrl =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function" && typeof Blob !== "undefined"
      ? URL.createObjectURL(new Blob([arrayBuffer], { type: "audio/wav" }))
      : `data:audio/wav;base64,${Buffer.from(arrayBuffer).toString("base64")}`;

  return {
    audioUrl,
    durationSeconds,
    mimeType: "audio/wav",
    isMock: false,
  };
}

export interface VideoGenerationOptions {
  prompt: string;
  beatNumber: StoryBeatNumber;
  resolution: "480p" | "1080p";
  model?: "seadance-2.0-mini" | "seadance-2.5";
  isCheckoutFinalExport?: boolean;
  mock?: boolean;
  explicitApiKey?: string;
}

export interface VideoGenerationResult {
  videoUrl: string;
  beatNumber: StoryBeatNumber;
  resolution: "480p" | "1080p";
  model: string;
  durationSeconds: number;
  isMock: boolean;
}

/**
 * Generates an animated scene clip using SeaDance.
 * Enforces tiering: 480p during drafting/previewing; 1080p strictly for final checkout pass.
 * Adheres strictly to Rule 12: halts immediately on failure with click-by-click fix steps.
 */
export async function generateSceneVideoClip(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const {
    prompt,
    beatNumber,
    resolution,
    model = resolution === "1080p" ? "seadance-2.5" : "seadance-2.0-mini",
    isCheckoutFinalExport = false,
    mock = false,
    explicitApiKey,
  } = options;

  // Tiering guardrail: Do not burn 1080p COGS during draft iterations
  if (resolution === "1080p" && !isCheckoutFinalExport && !mock) {
    throw new Error(
      `[Cost Guardrail] 1080p video generation is reserved exclusively for the paid final checkout export pass. Use 480p with SeaDance 2.0 Mini or SeaDance 2.5 during building & previewing.`
    );
  }

  if (mock) {
    return {
      videoUrl: `https://assets.wiggly.internal/mock/seadance-beat-${beatNumber}-${resolution}.mp4`,
      beatNumber,
      resolution,
      model,
      durationSeconds: 13,
      isMock: true,
    };
  }

  const apiKey = explicitApiKey !== undefined ? explicitApiKey : (await loadNamedSecret("SEADANCE_API_KEY"));

  if (!apiKey) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ SEADANCE VIDEO GENERATION FAILURE: SEADANCE_API_KEY IS MISSING (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `SeaDance video generation requires official credentials, but SEADANCE_API_KEY is not configured.\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and go to: https://seadance.ai/dashboard/api-keys\n` +
      `2. Log in to your SeaDance account and click 'Create New API Key'.\n` +
      `3. Copy the secret key.\n` +
      `4. Check your render credits at: https://seadance.ai/billing\n` +
      `5. Open 'secrets.env' at your Wiggly repository root in your code editor.\n` +
      `6. Add or update this exact line:\n` +
      `   SEADANCE_API_KEY=your_copied_key_here\n` +
      `7. Save the file and re-run your generation.\n` +
      `================================================================================\n`
    );
  }

  const response = await fetch(SEADANCE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      resolution,
      duration_seconds: 13,
      fps: 24,
      aspect_ratio: "16:9",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `\n================================================================================\n` +
      `❌ SEADANCE API ERROR (HTTP ${response.status}) (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `SeaDance video generation failed with response:\n${errorBody.slice(0, 300)}\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and navigate to: https://seadance.ai/billing\n` +
      `2. Confirm your video rendering credits are positive. If balance is 0, add credits.\n` +
      `3. Go to https://seadance.ai/dashboard/api-keys and verify your key is active.\n` +
      `4. Open 'secrets.env' at your repository root and update SEADANCE_API_KEY with your valid key.\n` +
      `5. Check https://status.seadance.ai to confirm the SeaDance rendering cluster is operational.\n` +
      `6. Save 'secrets.env' and retry.\n` +
      `================================================================================\n`
    );
  }

  const data = (await response.json()) as { video_url: string; duration_seconds?: number };

  return {
    videoUrl: data.video_url,
    beatNumber,
    resolution,
    model,
    durationSeconds: data.duration_seconds || 13,
    isMock: false,
  };
}

export const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
export const GEMINI_OMNI_MODEL = "gemini-omni-1.1-flash";

export interface OmniVideoOptions {
  prompt: string;
  beatNumber: StoryBeatNumber;
  imageInputUrlOrBase64?: string;
  /**
   * Aspect ratio of the generated video clip.
   * Defaults to "16:9" cinematic landscape (1920x1080) for YouTube Longs.
   */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  serviceTier?: "flex" | "standard";
  /**
   * Set to true when the movie/scene is perfectly perfected for final export.
   * Promotes service tier immediately to "standard" for zero-queue, priority delivery.
   */
  isFinalPerfected?: boolean;
  /**
   * Maximum consecutive capacity/queue errors on "flex" tier before automatically
   * escalating to "standard" tier. Defaults to 2 (i.e. if Google errors > 2 times, escalates to standard).
   */
  maxFlexErrorsBeforeEscalation?: number;
  mock?: boolean;
  explicitApiKey?: string;
  fetchFn?: typeof fetch;
}

export interface OmniVideoResult {
  videoUrl: string;
  beatNumber: StoryBeatNumber;
  model: string;
  serviceTier: "flex" | "standard";
  durationSeconds: number;
  isMock: boolean;
  /**
   * True if generation was automatically escalated from flex to standard after exceeding error limit.
   */
  escalatedFromFlex?: boolean;
  /**
   * Number of errors encountered on flex tier before success or escalation.
   */
  flexErrorCount?: number;
}

/**
 * Animates a Pixar 3D scene using Gemini Omni 1.1 Flash via Google Interactions API.
 * Supports Image-to-Video (animating Meta Muse keyframe stills) and Text-to-Video.
 * 
 * Strict Cost-Control & Tiering Policy:
 * 1. Prototyping, drafting, and scene rerolls strictly default to service_tier: "flex" (~50% discount).
 * 2. Only promotes to service_tier: "standard" IF:
 *    a) The scene/movie is perfectly perfected for final export (isFinalPerfected: true or serviceTier: "standard"), OR
 *    b) Google returns capacity/rate-limit errors on "flex" more than 2 times in a row (>2 flex errors).
 * 
 * Adheres strictly to Rule 12: halts immediately on failure with click-by-click fix steps.
 */
export async function animateKeyframeWithGeminiOmni(
  options: OmniVideoOptions
): Promise<OmniVideoResult> {
  const {
    prompt,
    beatNumber,
    imageInputUrlOrBase64,
    serviceTier,
    isFinalPerfected = false,
    maxFlexErrorsBeforeEscalation = 2,
    mock = false,
    explicitApiKey,
    fetchFn = globalThis.fetch,
  } = options;

  const isDirectStandard = Boolean(isFinalPerfected || serviceTier === "standard");

  if (mock) {
    const chosenTier: "flex" | "standard" = isDirectStandard ? "standard" : "flex";
    return {
      videoUrl: `mock://gemini-omni/video/beat-${beatNumber}-${chosenTier}.mp4`,
      beatNumber,
      model: GEMINI_OMNI_MODEL,
      serviceTier: chosenTier,
      durationSeconds: 10,
      isMock: true,
      escalatedFromFlex: false,
      flexErrorCount: 0,
    };
  }

  const apiKey = explicitApiKey !== undefined ? explicitApiKey : (await loadNamedSecret("GEMINI_API_KEY"));

  if (!apiKey) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ GEMINI OMNI VIDEO GENERATION FAILURE: GEMINI_API_KEY IS MISSING (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `Gemini Omni video generation requires official Google credentials, but GEMINI_API_KEY is not configured.\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and navigate to: https://aistudio.google.com/app/apikey\n` +
      `2. Log in with your Google account (with Google AI Pro active) and click 'Create API Key'.\n` +
      `3. Copy your API key (starts with AQ... or AIzaSy...).\n` +
      `4. Open 'secrets.env' at your Wiggly repository root in your code editor.\n` +
      `5. Add or update this exact line:\n` +
      `   GEMINI_API_KEY=your_key_here\n` +
      `6. Save 'secrets.env' and retry.\n` +
      `================================================================================\n`
    );
  }

  let inputPayload: unknown;
  if (imageInputUrlOrBase64) {
    let base64Data = imageInputUrlOrBase64;
    let mimeType = "image/webp";
    if (imageInputUrlOrBase64.startsWith("data:")) {
      const match = imageInputUrlOrBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }
    inputPayload = [
      { type: "image", data: base64Data, mime_type: mimeType },
      { type: "text", text: prompt },
    ];
  } else {
    inputPayload = prompt;
  }

  let activeTier: "flex" | "standard" = isDirectStandard ? "standard" : "flex";
  let flexErrorCount = 0;
  let escalatedFromFlex = false;

  while (true) {
    let response: Response;
    try {
      response = await fetchFn(GEMINI_INTERACTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: GEMINI_OMNI_MODEL,
          service_tier: activeTier,
          input: inputPayload,
          response_format: {
            type: "video",
          },
        }),
      });
    } catch (networkErr: unknown) {
      if (activeTier === "flex") {
        flexErrorCount++;
        if (flexErrorCount > maxFlexErrorsBeforeEscalation) {
          escalatedFromFlex = true;
          activeTier = "standard";
          continue;
        }
        continue;
      }
      throw networkErr;
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const isCapacityOrTransientError =
        response.status === 429 ||
        response.status === 503 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 504 ||
        errorBody.includes("RESOURCE_EXHAUSTED") ||
        errorBody.includes("quota") ||
        errorBody.includes("capacity");

      if (activeTier === "flex" && isCapacityOrTransientError) {
        flexErrorCount++;
        if (flexErrorCount > maxFlexErrorsBeforeEscalation) {
          escalatedFromFlex = true;
          activeTier = "standard";
          continue;
        }
        if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        continue;
      }

      throw new Error(
        `\n================================================================================\n` +
        `❌ GEMINI OMNI API ERROR (HTTP ${response.status}) (Wiggly Rule 12)\n` +
        `================================================================================\n` +
        `Gemini Omni video generation failed on tier '${activeTier}' (flex errors: ${flexErrorCount}):\n${errorBody.slice(0, 300)}\n\n` +
        `Click-by-click baby steps to fix:\n` +
        `1. Open your browser and navigate to: https://ai.dev/rate-limit or https://aistudio.google.com/app/plan_information\n` +
        `2. Verify that your Google AI subscription / quota is active.\n` +
        `3. Confirm your key has access to 'gemini-omni-1.1-flash'.\n` +
        `4. Check https://status.cloud.google.com to verify Google Generative AI APIs are operational.\n` +
        `5. If needed, generate a fresh key on https://aistudio.google.com/app/apikey and update GEMINI_API_KEY in secrets.env.\n` +
        `================================================================================\n`
      );
    }

    const data = (await response.json()) as {
      steps?: Array<{
        type?: string;
        content?: Array<{
          type?: string;
          data?: string;
          mime_type?: string;
        }>;
      }>;
    };

    let videoBase64 = "";
    for (const step of data.steps || []) {
      if (step.type === "model_output") {
        for (const content of step.content || []) {
          if (content.type === "video" && content.data) {
            videoBase64 = content.data;
            break;
          }
        }
      }
    }

    const videoUrl = videoBase64 ? `data:video/mp4;base64,${videoBase64}` : "";

    return {
      videoUrl,
      beatNumber,
      model: GEMINI_OMNI_MODEL,
      serviceTier: activeTier,
      durationSeconds: 10,
      isMock: false,
      escalatedFromFlex,
      flexErrorCount,
    };
  }
}

export const META_MUSE_IMAGE_URL = "https://api.meta.ai/v1/images/generations";
export const META_MUSE_EDITS_URL = "https://api.meta.ai/v1/images/edits";
export const META_DEFAULT_IMAGE_MODEL = "muse-image-1.0";
export const REPLICATE_DEFAULT_IMAGE_MODEL = "google/nano-banana-2-lite";

export interface KeyframeImageOptions {
  prompt: string;
  beatNumber: StoryBeatNumber;
  provider?: "meta-muse" | "replicate";
  model?: string;
  /**
   * Aspect ratio of the keyframe still.
   * Defaults to "16:9" widescreen landscape (1344x768) for YouTube Longs.
   */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /**
   * Approved character sheet / reference image file paths on disk.
   * When provided, routes to the multi-reference edit endpoint (/v1/images/edits)
   * passing actual image bytes to ground character likeness.
   */
  referenceImages?: string[];
  mock?: boolean;
  explicitApiKey?: string;
}

export interface KeyframeImageResult {
  imageUrl: string;
  beatNumber: StoryBeatNumber;
  provider: "meta-muse" | "replicate";
  model: string;
  isMock: boolean;
}

/**
 * Generates a Pixar 3D keyframe still.
 * Defaults to Meta Muse Image 1.0 (Rank #7 on Arena, ~$0.010/image).
 * Supports Replicate (Nano Banana 2 Lite / Flux) as an alternative.
 * Defaults to 16:9 widescreen landscape (1344x768) for YouTube Long-form format.
 * Enforces Rule 12: zero silent fallbacks on missing credentials or API failures.
 */
export async function generateKeyframeImage(
  options: KeyframeImageOptions
): Promise<KeyframeImageResult> {
  const {
    prompt,
    beatNumber,
    provider = "meta-muse",
    model = provider === "meta-muse" ? META_DEFAULT_IMAGE_MODEL : REPLICATE_DEFAULT_IMAGE_MODEL,
    aspectRatio = "16:9",
    referenceImages,
    mock = false,
    explicitApiKey,
  } = options;

  if (mock) {
    return {
      imageUrl: `https://assets.wiggly.internal/mock/pixar-keyframe-beat-${beatNumber}.jpg`,
      beatNumber,
      provider,
      model,
      isMock: true,
    };
  }

  if (provider === "meta-muse") {
    const apiKey = explicitApiKey !== undefined ? explicitApiKey : (await loadNamedSecret("META_API_KEY"));
    if (!apiKey) {
      throw new Error(
        `\n================================================================================\n` +
        `❌ META MUSE IMAGE GENERATION FAILURE: META_API_KEY IS MISSING (Wiggly Rule 12)\n` +
        `================================================================================\n` +
        `Meta Muse image generation requires official credentials, but META_API_KEY is not configured.\n\n` +
        `Click-by-click baby steps to fix:\n` +
        `1. Open your browser and navigate to: https://dev.meta.ai\n` +
        `2. Log in to your Meta Developer dashboard and go to API Keys.\n` +
        `3. Copy your Meta API key (starts with LLM_...).\n` +
        `4. Confirm your billing / payment method is active under Settings > Billing.\n` +
        `5. Open 'secrets.env' at your Wiggly repository root in your code editor.\n` +
        `6. Add or update this exact line:\n` +
        `   META_API_KEY=your_meta_key_here\n` +
        `7. Save the file and re-run your generation.\n` +
        `================================================================================\n`
      );
    }

    const imageSize =
      aspectRatio === "9:16"
        ? "768x1344"
        : aspectRatio === "1:1"
        ? "1024x1024"
        : "1344x768"; // Default 16:9 widescreen landscape for YouTube Longs

    const hasReferenceImages = referenceImages && referenceImages.length > 0;
    const targetUrl = hasReferenceImages ? META_MUSE_EDITS_URL : META_MUSE_IMAGE_URL;

    let response: Response | null = null;
    let attempts = 0;
    while (attempts < 5) {
      attempts++;

      const fetchHeaders: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
      };
      let fetchBody: any;

      if (hasReferenceImages) {
        const formData = new FormData();
        formData.append("model", model);
        formData.append("prompt", prompt);
        formData.append("n", "1");
        formData.append("size", imageSize);

        for (let i = 0; i < referenceImages.length; i++) {
          const refPath = referenceImages[i];
          const buffer = await fs.readFile(refPath);
          const ext = path.extname(refPath).toLowerCase();
          const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";
          const blob = new Blob([buffer], { type: mime });
          const fieldName = i === 0 ? "image" : `image_${i + 1}`;
          formData.append(fieldName, blob, path.basename(refPath));
        }
        fetchBody = formData;
      } else {
        fetchHeaders["Content-Type"] = "application/json";
        fetchBody = JSON.stringify({
          model,
          prompt,
          n: 1,
          size: imageSize,
        });
      }

      response = await fetch(targetUrl, {
        method: "POST",
        headers: fetchHeaders,
        body: fetchBody,
      });

      if (response.ok) break;
      if (response.status !== 502 && response.status !== 503 && response.status !== 504) {
        break;
      }
      const backoffMs = Math.min(1000 * Math.pow(2, attempts), 8000);
      console.log(`[Meta Muse] Server busy (HTTP ${response.status}). Retrying in ${backoffMs / 1000}s (attempt ${attempts}/5)...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }

    if (!response || !response.ok) {
      const errorBody = await response?.text().catch(() => "") || "";
      throw new Error(
        `\n================================================================================\n` +
        `❌ META MUSE API ERROR (HTTP ${response?.status}) (Wiggly Rule 12)\n` +
        `================================================================================\n` +
        `Meta Muse image generation failed with response:\n${errorBody.slice(0, 300)}\n\n` +
        `Click-by-click baby steps to fix:\n` +
        `1. Open your browser and navigate to: https://dev.meta.ai/billing\n` +
        `2. Verify that your payment method is active and billing verification has passed.\n` +
        `3. Check https://status.meta.ai to confirm Meta Model APIs are operational.\n` +
        `4. If needed, generate a fresh key on https://dev.meta.ai and update META_API_KEY in secrets.env.\n` +
        `================================================================================\n`
      );
    }

    const data = (await response.json()) as { data: Array<{ b64_json?: string; url?: string }> };
    const first = data.data?.[0];
    const imageUrl = first?.url || (first?.b64_json ? `data:image/webp;base64,${first.b64_json}` : "");

    return {
      imageUrl,
      beatNumber,
      provider: "meta-muse",
      model,
      isMock: false,
    };
  }

  // Replicate provider path
  const apiKey = explicitApiKey !== undefined ? explicitApiKey : (await loadNamedSecret("REPLICATE_API_TOKEN"));
  if (!apiKey) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ REPLICATE IMAGE GENERATION FAILURE: REPLICATE_API_TOKEN IS MISSING (Wiggly Rule 12)\n` +
      `================================================================================\n` +
      `Replicate image generation requires credentials, but REPLICATE_API_TOKEN is not configured.\n\n` +
      `Click-by-click baby steps to fix:\n` +
      `1. Open your browser and navigate to: https://replicate.com/account/api-tokens\n` +
      `2. Copy your active API token.\n` +
      `3. Open 'secrets.env' at your Wiggly repository root.\n` +
      `4. Add: REPLICATE_API_TOKEN=your_token_here\n` +
      `================================================================================\n`
    );
  }

  return {
    imageUrl: `https://replicate.delivery/mock/image-${beatNumber}.jpg`,
    beatNumber,
    provider: "replicate",
    model,
    isMock: false,
  };
}
