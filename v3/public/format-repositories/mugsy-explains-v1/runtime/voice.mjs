import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Official Mugsy Explains voice clone on Fish Audio
export const MUGSY_VOICE_ID = 'a126d52c2d20443bb024aeef10e741bf';

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
    path.join(root, '../../../../secrets.env')
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

export function probeAudioDuration(audioPath) {
  const ffprobe = process.env.FFPROBE || 'ffprobe';
  const output = execFileSync(
    ffprobe,
    [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath
    ],
    { encoding: 'utf8' }
  );
  const dur = parseFloat(output.trim());
  if (isNaN(dur) || dur <= 0) {
    throw new Error(`Failed to probe duration for ${audioPath}`);
  }
  return dur;
}

export async function synthesizeMugsySentence({
  text,
  outputPath,
  voiceId = MUGSY_VOICE_ID,
  speed = 1.15,
  apiKey: explicitApiKey,
  repoRoot
}) {
  const dir = path.dirname(outputPath);
  mkdirSync(dir, { recursive: true });

  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const words = text.split(/\s+/).filter(Boolean).length;
  const apiKey = explicitApiKey || await loadFishApiKey(repoRoot);

  // 1. Primary path: Fish Audio with Mugsy voice model
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
          prosody: { speed }
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
  } catch {}

  if (sayAvailable && process.platform === 'darwin') {
    const aiffPath = outputPath.replace(/\.[^.]+$/, '.aiff');
    try {
      execFileSync('say', ['-v', 'Daniel', '-r', '180', '-o', aiffPath, text], { stdio: 'ignore' });
      execFileSync(
        ffmpeg,
        ['-y', '-v', 'error', '-i', aiffPath, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', outputPath],
        { stdio: 'ignore' }
      );
      try { unlinkSync(aiffPath); } catch {}
      return probeAudioDuration(outputPath);
    } catch {
      // Fall through to sine fallback
    }
  }

  // 3. Ultra-offline fallback for CI runners
  const estimatedDuration = Math.max(1.2, (words / 2.5) + 0.3);
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

export async function buildLessonAudio(contentJsonPath, audioOutputDir, options = {}) {
  const fullContentPath = path.resolve(process.cwd(), contentJsonPath);
  const content = JSON.parse(readFileSync(fullContentPath, 'utf8'));
  const lessons = content.lessons || [];

  const sentencesMeta = [];
  let sentenceIdx = 0;

  for (let l = 0; l < lessons.length; l++) {
    const lesson = lessons[l];
    for (let s = 0; s < lesson.sentences.length; s++) {
      const sentence = lesson.sentences[s];
      const audioFilename = `sentence-${String(sentenceIdx).padStart(2, '0')}.wav`;
      const audioFullPath = path.join(audioOutputDir, audioFilename);

      const duration = await synthesizeMugsySentence({
        text: sentence.text,
        outputPath: audioFullPath,
        ...options
      });

      sentencesMeta.push({
        index: sentenceIdx,
        lessonIndex: l,
        role: sentence.role,
        text: sentence.text,
        chunks: sentence.chunks || [sentence.text],
        audioFile: audioFilename,
        audioPath: audioFullPath,
        durationSeconds: duration
      });

      sentenceIdx++;
    }
  }

  return sentencesMeta;
}
