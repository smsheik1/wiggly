import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Harvest voice reference and optionally train a Fish Audio model
 */
export async function harvestVoiceAssets(videoPath, outputDir, options = {}) {
  const voiceDir = path.join(outputDir, 'assets/voice');
  mkdirSync(voiceDir, { recursive: true });

  const refWav = path.join(voiceDir, 'reference-00.wav');
  console.log('[harvest-assets] Extracting clean speech sample from reference video...');

  // Extract first 15 seconds of clean speech audio
  try {
    execFileSync('ffmpeg', [
      '-y', '-v', 'error',
      '-ss', '00:00:01',
      '-t', '15',
      '-i', videoPath,
      '-vn',
      '-ar', '44100',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      refWav
    ]);
  } catch (err) {
    console.warn('[harvest-assets] Could not extract speech slice, generating synthetic tone fallback');
    execFileSync('ffmpeg', [
      '-y', '-v', 'error',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
      '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le',
      refWav
    ]);
  }

  const apiKey = process.env.FISH_STUDIO_APIKEY || process.env.FISH_API_KEY;
  let modelId = options.voiceId || 'a126d52c2d20443bb024aeef10e741bf'; // Default official clone

  if (apiKey && !options.skipTrain) {
    console.log('[harvest-assets] Registering speech sample with Fish Audio API...');
    try {
      const audioBytes = readFileSync(refWav);
      const formData = new FormData();
      formData.append('title', `${options.title || 'Format'} Official Voice`);
      formData.append('voices', new Blob([audioBytes], { type: 'audio/wav' }), 'reference.wav');
      formData.append('visibility', 'unlist');
      formData.append('type', 's2.1-pro-free');

      const res = await fetch('https://api.fish.audio/v1/model', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData
      });

      if (res.ok) {
        const json = await res.json();
        if (json._id || json.id) {
          modelId = json._id || json.id;
          console.log(`[harvest-assets] ✅ Registered Fish Audio Voice Model: ${modelId}`);
        }
      }
    } catch (err) {
      console.warn('[harvest-assets] Fish Audio training skipped:', err.message);
    }
  }

  const voiceConfig = {
    schemaVersion: 1,
    provider: 'fish-audio',
    modelId,
    name: `${options.title || 'Format'} Official Voice`,
    referenceAudio: 'assets/voice/reference-00.wav',
    speed: 1.15
  };

  writeFileSync(path.join(voiceDir, 'voice.json'), JSON.stringify(voiceConfig, null, 2) + '\n');
  return voiceConfig;
}

/**
 * Harvest or bundle font assets
 */
export async function harvestFontAssets(outputDir, fontFamily = 'Patrick Hand') {
  const fontDir = path.join(outputDir, 'assets/fonts');
  mkdirSync(fontDir, { recursive: true });

  const fontDest = path.join(fontDir, 'PatrickHand-Regular.ttf');
  // Copy Patrick Hand from local assets if available
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidateFonts = [
    path.resolve(moduleDir, '../../mugsy-explains-v1/assets/fonts/PatrickHand-Regular.ttf'),
    path.resolve(process.cwd(), 'v3/public/format-repositories/mugsy-explains-v1/assets/fonts/PatrickHand-Regular.ttf'),
    path.resolve(process.cwd(), '../mugsy-explains-v1/assets/fonts/PatrickHand-Regular.ttf')
  ];
  const localFont = candidateFonts.find(p => existsSync(p));
  if (localFont) {
    copyFileSync(localFont, fontDest);
  } else {
    // Generate OFL note
    writeFileSync(path.join(fontDir, 'OFL.txt'), 'Patrick Hand SIL Open Font License\n');
  }

  return { fontFamily, fontPath: 'assets/fonts/PatrickHand-Regular.ttf' };
}

/**
 * Harvest character poses from video or existing pose library
 */
export async function harvestCharacterPoses(videoPath, outputDir, archetype) {
  const posesDir = path.join(outputDir, 'assets/poses');
  mkdirSync(posesDir, { recursive: true });

  const poseFiles = [
    'coffee-explain.png',
    'point-left.png',
    'point-right.png',
    'question.png',
    'raise-hand.png'
  ];

  // Try to copy poses from local library if available
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePosesDirs = [
    path.resolve(moduleDir, '../../mugsy-explains-v1/assets/poses'),
    path.resolve(process.cwd(), 'v3/public/format-repositories/mugsy-explains-v1/assets/poses'),
    path.resolve(process.cwd(), '../mugsy-explains-v1/assets/poses')
  ];
  const localPosesDir = candidatePosesDirs.find(d => existsSync(d));
  let copiedCount = 0;

  if (localPosesDir) {
    for (const file of poseFiles) {
      const src = path.join(localPosesDir, file);
      const dest = path.join(posesDir, file);
      if (existsSync(src)) {
        copyFileSync(src, dest);
        copiedCount++;
      }
    }
  }

  console.log(`[harvest-assets] Configured ${copiedCount} character poses in assets/poses/`);
  return poseFiles;
}

/**
 * Main export: Harvest all required assets for the child repo
 */
export async function harvestAllAssets(videoPath, outputDir, recipe, options = {}) {
  console.log('[harvest-assets] Harvesting assets for format:', recipe.slug);

  const voice = await harvestVoiceAssets(videoPath, outputDir, {
    title: recipe.title,
    voiceId: options.voiceId
  });

  const font = await harvestFontAssets(outputDir, recipe.structure?.typography?.fontFamily || 'Patrick Hand');
  const poses = await harvestCharacterPoses(videoPath, outputDir, recipe.structure?.archetype);

  return {
    voice,
    font,
    poses
  };
}
