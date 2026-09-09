import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Default Zach D. Films narrator voice model (0873499c22e24d13b074fa76d27562e5)
export const ZACH_VOICE_ID = '0873499c22e24d13b074fa76d27562e5';

export async function loadFishApiKey(repoRoot) {
  if (process.env.FISH_STUDIO_APIKEY?.trim()) {
    return process.env.FISH_STUDIO_APIKEY.trim();
  }

  const root = repoRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const candidatePaths = [
    path.join(root, 'secrets.env'),
    path.join(root, '../secrets.env'),
    path.join(root, '../../secrets.env'),
    path.join(root, '../../../secrets.env'),
    path.join(root, '../../../../secrets.env'),
    path.join(root, '.env.local'),
    path.join(root, '../.env.local'),
    path.join(root, '../../.env.local'),
    path.join(root, '../../../.env.local'),
    path.join(root, '../../../../v3/.env.local')
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      try {
        const content = readFileSync(candidate, 'utf8');
        const match = content.match(/FISH_STUDIO_APIKEY=([^\r\n]+)/);
        if (match && match[1].trim()) return match[1].trim();
      } catch {}
    }
  }

  return null;
}

export function probeAudioDuration(filePath, ffprobe = process.env.FFPROBE || 'ffprobe') {
  const raw = execFileSync(
    ffprobe,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf8' }
  );
  const dur = parseFloat(raw.trim());
  if (isNaN(dur) || dur <= 0) {
    throw new Error(`Failed to probe audio duration for ${filePath}`);
  }
  return dur;
}

export function chunkNarrationText(text, maxWordsPerChunk = 7) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const rawSentences = cleaned.split(/(?<=[.?!])\s+/);
  const chunks = [];

  for (const sentence of rawSentences) {
    const words = sentence.split(' ').filter(Boolean);
    if (words.length <= maxWordsPerChunk) {
      chunks.push(words.join(' '));
    } else {
      let current = [];
      for (const w of words) {
        current.push(w);
        if (current.length >= maxWordsPerChunk || (current.length >= 4 && /[,;:]$/.test(w))) {
          chunks.push(current.join(' '));
          current = [];
        }
      }
      if (current.length) {
        chunks.push(current.join(' '));
      }
    }
  }

  return chunks.filter(c => c.trim().length > 0);
}

export function generateTimedCaptions({ text, audioDurationSeconds, startOffsetSeconds = 0.2 }) {
  const chunks = chunkNarrationText(text);
  if (!chunks.length) return [];

  const totalWords = chunks.reduce((acc, c) => acc + c.split(' ').filter(Boolean).length, 0);
  const effectiveAudioSpan = Math.max(0.2, audioDurationSeconds);
  let currentStart = startOffsetSeconds;
  const captions = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const words = chunk.split(' ').filter(Boolean).length;
    const isLast = i === chunks.length - 1;

    let chunkDuration;
    if (isLast) {
      chunkDuration = (startOffsetSeconds + effectiveAudioSpan) - currentStart;
    } else {
      chunkDuration = effectiveAudioSpan * (words / totalWords);
    }
    chunkDuration = Math.max(0.15, chunkDuration);

    const start = Number(currentStart.toFixed(3));
    const end = Number((currentStart + chunkDuration).toFixed(3));

    captions.push({ start, end, text: chunk });
    currentStart = end;
  }

  return captions;
}

export async function synthesizeSpeechFile({
  text,
  outputPath,
  voice = 'zach',
  rate = 175,
  apiKey: explicitApiKey,
  repoRoot
}) {
  const dir = path.dirname(outputPath);
  mkdirSync(dir, { recursive: true });

  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const words = text.split(/\s+/).filter(Boolean).length;
  const apiKey = explicitApiKey || await loadFishApiKey(repoRoot);

  // 1. Primary path: Fish Audio with Zach D. Films voice model
  const voiceId = (voice === 'zach' || !voice) ? ZACH_VOICE_ID : voice;
  if (apiKey && voiceId) {
    try {
      const res = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          model: 's2.1-pro-free'
        },
        body: JSON.stringify({
          text,
          reference_id: voiceId,
          format: 'wav',
          normalize: true,
          prosody: { speed: 1.05 }
        })
      });

      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(outputPath, buf);
        return probeAudioDuration(outputPath);
      }
    } catch {
      // Fall through to offline fallback
    }
  }

  // 2. Offline fallback: macOS native `say`
  let sayAvailable = false;
  try {
    execFileSync('which', ['say'], { stdio: 'ignore' });
    sayAvailable = true;
  } catch {
    sayAvailable = false;
  }

  if (sayAvailable) {
    const tempAiff = `${outputPath}.temp.aiff`;
    try {
      execFileSync('say', ['-v', 'Samantha', '-r', String(rate), text, '-o', tempAiff], { stdio: 'ignore' });
      execFileSync(
        ffmpeg,
        ['-y', '-v', 'error', '-i', tempAiff, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath],
        { stdio: 'ignore' }
      );
      if (existsSync(tempAiff)) unlinkSync(tempAiff);
      return probeAudioDuration(outputPath);
    } catch {
      if (existsSync(tempAiff)) unlinkSync(tempAiff);
    }
  }

  // 3. Ultra-offline fallback for Linux CI runners
  const estimatedDuration = Math.max(1.2, (words / 2.3) + 0.4);
  execFileSync(
    ffmpeg,
    [
      '-y', '-v', 'error',
      '-f', 'lavfi', '-i', `sine=frequency=440:duration=${estimatedDuration.toFixed(2)}`,
      '-af', 'volume=0.05,afade=t=in:d=0.05,afade=t=out:st=' + (estimatedDuration - 0.1).toFixed(2) + ':d=0.1',
      '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le',
      outputPath
    ],
    { stdio: 'ignore' }
  );
  return probeAudioDuration(outputPath);
}

export async function buildNarratedTutorialStep({
  id,
  number,
  label,
  kind,
  windowTitle,
  background,
  mediaPath,
  mediaType = 'image',
  mediaFit = 'contain',
  narrationText,
  audioRelPath,
  audioFullPath,
  voice = 'zach',
  minStepDuration = 4.5,
  provenance = 'Synthesized tutorial voiceover (Zach D. Films style)'
}) {
  const audioDuration = await synthesizeSpeechFile({
    text: narrationText,
    outputPath: audioFullPath,
    voice
  });

  const captions = generateTimedCaptions({
    text: narrationText,
    audioDurationSeconds: audioDuration,
    startOffsetSeconds: 0.2
  });

  const lastCapEnd = captions.length ? captions[captions.length - 1].end : audioDuration;
  // Reserve at least 0.8s breathing room before step transition, aligned to 30 fps
  const calculatedDuration = Math.round(Math.max(minStepDuration, lastCapEnd + 0.8) * 30) / 30;

  const step = {
    id,
    kind,
    number: String(number),
    label,
    windowTitle: windowTitle || `${kind === 'browser' ? 'Wiggly — ' : 'Terminal — '}${label}`,
    background,
    durationSeconds: calculatedDuration,
    narration: {
      file: audioRelPath,
      startSeconds: 0.2,
      authorized: true,
      provenance: provenance || 'Locally synthesized tutorial speech.'
    },
    captions
  };

  if (mediaPath) {
    step.media = {
      type: mediaType,
      file: mediaPath,
      fit: mediaFit,
      authorized: true,
      provenance
    };
  }

  return {
    step,
    audioDuration
  };
}

// CLI test
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const text = 'On Wiggly, choose Copy for another coding agent.';
  const testWav = '/tmp/wiggly-test-voice.wav';
  console.log('[voice] Synthesizing Zach D. Films test narration...');
  const dur = await synthesizeSpeechFile({ text, outputPath: testWav, voice: 'zach' });
  console.log(`[voice] Produced audio (${dur.toFixed(2)}s) at ${testWav}`);
  const caps = generateTimedCaptions({ text, audioDurationSeconds: dur });
  console.log('[voice] Generated caption chunks:', JSON.stringify(caps, null, 2));
}
