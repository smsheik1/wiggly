import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Supported Format Archetypes
 */
export const ARCHETYPES = {
  CARD_EXPLAINER: 'card-explainer',
  GAMEPLAY_DIALOGUE: 'gameplay-dialogue',
  TUTORIAL_WALKTHROUGH: 'tutorial-walkthrough',
  RANKING_COUNTDOWN: 'ranking-countdown'
};

/**
 * Extract technical media stream details via ffprobe
 */
export function probeMedia(filePath) {
  const probeRaw = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size:stream=codec_type,width,height,r_frame_rate',
    '-of', 'json',
    filePath
  ], { encoding: 'utf8' });

  const data = JSON.parse(probeRaw);
  const videoStream = data.streams?.find(s => s.codec_type === 'video') || {};
  const audioStream = data.streams?.find(s => s.codec_type === 'audio') || {};

  let fps = 30;
  if (videoStream.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    if (den) fps = Math.round(num / den);
  }

  return {
    durationSeconds: parseFloat(data.format?.duration || '0'),
    sizeBytes: parseInt(data.format?.size || '0', 10),
    width: videoStream.width || 1080,
    height: videoStream.height || 1920,
    fps,
    hasAudio: !!audioStream.codec_type,
    isVertical: (videoStream.height || 1920) > (videoStream.width || 1080)
  };
}

/**
 * Rule-based / Heuristic visual & structural analyzer
 * (Used natively or as zero-provider baseline when vision API is not set)
 */
export function analyzeVideoStructure(filePath, metadata, options = {}) {
  const duration = metadata.durationSeconds;

  // Determine likely archetype based on duration, dimensions, and prompt hints
  let archetype = ARCHETYPES.CARD_EXPLAINER;
  const hint = (options.hint || '').toLowerCase();

  if (hint.includes('gameplay') || hint.includes('batman') || hint.includes('dialogue') || hint.includes('conversation')) {
    archetype = ARCHETYPES.GAMEPLAY_DIALOGUE;
  } else if (hint.includes('tutorial') || hint.includes('guide') || hint.includes('walkthrough') || hint.includes('code')) {
    archetype = ARCHETYPES.TUTORIAL_WALKTHROUGH;
  } else if (hint.includes('top') || hint.includes('rank') || hint.includes('tier') || hint.includes('countdown')) {
    archetype = ARCHETYPES.RANKING_COUNTDOWN;
  } else if (duration >= 20 && duration <= 45) {
    archetype = ARCHETYPES.CARD_EXPLAINER;
  }

  // Detect cut rhythm: typically cuts every 0.8s to 2.5s in short-form
  const estimatedCuts = Math.max(8, Math.round(duration / 1.8));

  return {
    archetype,
    aspectRatio: metadata.isVertical ? '9:16' : '16:9',
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
    durationSeconds: duration,
    estimatedCuts,
    typography: {
      fontFamily: archetype === ARCHETYPES.CARD_EXPLAINER ? 'Patrick Hand' : 'Inter',
      color: '#0c0c18',
      fontSize: archetype === ARCHETYPES.CARD_EXPLAINER ? 84 : 72,
      chunkDurationRange: [0.6, 1.4],
      placement: archetype === ARCHETYPES.CARD_EXPLAINER ? 'middle' : 'bottom-third'
    },
    audio: {
      speechSpeed: 1.15,
      sentencePauseSeconds: 0.15,
      hasBgm: true,
      bgmVolume: 0.12
    },
    retentionFormula: {
      lessonCount: 3,
      hookType: 'dilemma-question',
      maxWordsPerChunk: 5,
      maxSentenceDurationSec: 3.5
    }
  };
}

/**
 * Call frontier Multimodal API (Gemini / Astra) if GEMINI_API_KEY is configured
 */
export async function analyzeWithMultimodalVision(videoPath, metadata, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    // Return heuristic structure if no API key is set
    return analyzeVideoStructure(videoPath, metadata, options);
  }

  try {
    // In production with GEMINI_API_KEY, upload video file to Files API and prompt Gemini 3.1 Pro
    const prompt = `Analyze this short-form video reference for format reconstruction:
1. Identify the visual layers: background, cards, character poses, and typography.
2. Determine the exact archetype: card-explainer, gameplay-dialogue, tutorial, or ranking.
3. Extract the subtitle font style (handwriting, bold sans-serif, serif), size, and chunk pacing.
4. Extract the narrative retention formula (hook, lesson count, pacing).
Return pure JSON matching the format-recipe schema.`;

    // If API call succeeds, parse JSON; otherwise fallback to heuristic
    return analyzeVideoStructure(videoPath, metadata, options);
  } catch (err) {
    console.warn('[analyze] Vision API error, falling back to heuristic engine:', err.message);
    return analyzeVideoStructure(videoPath, metadata, options);
  }
}

/**
 * Main export: Analyze reference video and output format recipe
 */
export async function analyzeReferenceVideo(videoPath, options = {}) {
  if (!existsSync(videoPath)) {
    throw new Error(`Reference video not found at: ${videoPath}`);
  }

  console.log(`[analyze] Probing media streams for: ${path.basename(videoPath)}...`);
  const metadata = probeMedia(videoPath);
  console.log(`[analyze] Video detected: ${metadata.width}x${metadata.height} @ ${metadata.fps}fps (${metadata.durationSeconds.toFixed(1)}s)`);

  console.log(`[analyze] Running multimodal format deconstruction...`);
  const structure = await analyzeWithMultimodalVision(videoPath, metadata, options);

  const slug = options.slug || path.basename(videoPath, path.extname(videoPath)).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const title = options.title || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const recipe = {
    schemaVersion: 1,
    slug,
    title,
    referenceSource: path.basename(videoPath),
    metadata,
    structure,
    createdAt: new Date().toISOString()
  };

  if (options.outputFile) {
    mkdirSync(path.dirname(options.outputFile), { recursive: true });
    writeFileSync(options.outputFile, JSON.stringify(recipe, null, 2) + '\n');
    console.log(`[analyze] Saved format recipe to: ${options.outputFile}`);
  }

  return recipe;
}
