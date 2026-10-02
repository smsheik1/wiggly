import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export async function probe(path) {
  const { stdout } = await exec('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path]);
  const p = JSON.parse(stdout); const audio = p.streams.find(s => s.codec_type === 'audio');
  const image = p.streams.find(s => s.codec_type === 'video');
  if (['.mp4', '.mov'].includes(extname(path).toLowerCase()) && image) { const durationSeconds = Number(image.duration ?? p.format.duration); const [n,d] = image.avg_frame_rate.split('/').map(Number); if (!(durationSeconds>0 && n/d>0)) throw new Error('Unmeasurable video.'); return {durationSeconds,width:image.width,height:image.height,fps:n/d,hasAudio:!!audio}; }
  if (audio) { const durationSeconds = Number(p.format.duration ?? audio.duration); if (!(durationSeconds > 0)) throw new Error('Unmeasurable audio duration.'); return { durationSeconds }; }
  if (image?.width && image?.height) return { width: image.width, height: image.height };
  throw new Error('No supported audio/image stream.');
}
export async function importMedia(source, runDir) {
  const extension = extname(source).toLowerCase();
  if (!['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov'].includes(extension)) throw new Error('Import a supported audio or image file.');
  const bytes = await readFile(resolve(source)); const sha256 = sha(bytes);
  const path = join(runDir, 'assets', `${sha256}${extension}`); await mkdir(join(runDir, 'assets'), { recursive: true });
  try { await writeFile(path, bytes, { flag: 'wx', mode: 0o600 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  if (sha(await readFile(path)) !== sha256) throw new Error('Immutable asset collision/tampering.');
  return { path, sha256, bytes: bytes.length, ...await probe(path) };
}
export async function verifyFiles(value) {
  if (!value || typeof value !== 'object') return;
  if(value.evidenceDirectory&&value.qualified===true&&value.datasetDigest){await (await import('../evaluation/audio-qualification.mjs')).verifyAudioQualificationEvidence(value);return;}
  if(value.evidenceDirectory&&value.datasetDigest&&value.predictionDigest){await (await import('../evaluation/visual-qualification.mjs')).verifyQualificationEvidence(value);return;}
  if (value.path && value.sha256 && value.bytes) {
    const bytes = await readFile(value.path);
    if (sha(bytes) !== value.sha256 || bytes.length !== value.bytes) throw new Error(`ASSET_CHANGED: ${value.path}`);
    const actual = await probe(value.path);
    for (const [k, v] of Object.entries(actual)) if (value[k] !== v) throw new Error(`MEDIA_METADATA_MISMATCH: ${value.path} ${k}`);
    return;
  }
  for (const child of Object.values(value)) await verifyFiles(child);
}
export async function measureAudio(file) {
  await verifyFiles(file);
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-i', file.path, '-af', 'silencedetect=noise=-40dB:d=0.3', '-f', 'null', '-'], { maxBuffer: 2 ** 20 });
  const silenceSeconds = [...stderr.matchAll(/silence_duration: ([0-9.]+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
  return { path: file.path, sha256: file.sha256, durationSeconds: file.durationSeconds, silenceSeconds,
    method: 'ffprobe duration; ffmpeg silencedetect -40dB, minimum 0.3s' };
}
