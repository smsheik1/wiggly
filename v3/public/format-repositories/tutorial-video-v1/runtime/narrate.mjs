#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODEL = 's2.1-pro-free';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const hash = (value) => createHash('sha256').update(value).digest('hex');
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};

export function validatePlan(plan) {
  requireValue(plan?.model === MODEL, `Only ${MODEL} is supported; paid fallback is disabled.`);
  requireValue(typeof plan.voiceId === 'string' && /^[a-f0-9]{32}$/i.test(plan.voiceId), 'Choose a valid Fish voice ID before generating.');
  requireValue(plan.voiceProvenance?.trim() && plan.authorized === true, 'Record the selected voice source and authorization.');
  requireValue(typeof plan.runId === 'string' && /^[a-z0-9][a-z0-9_-]{1,48}$/i.test(plan.runId), 'Use a short, filesystem-safe runId.');
  requireValue(Array.isArray(plan.steps) && plan.steps.length >= 2 && plan.steps.length <= 12, 'Provide 2–12 narrated steps.');
  for (const step of plan.steps) {
    requireValue(typeof step.id === 'string' && /^[a-z0-9][a-z0-9_-]{1,48}$/i.test(step.id), 'Every narration step needs a filesystem-safe id.');
    requireValue(Array.isArray(step.phrases) && step.phrases.length > 0 && step.phrases.length <= 8, `${step.id}: provide 1–8 short narration phrases.`);
    for (const phrase of step.phrases) {
      const words = String(phrase).trim().split(/\s+/).filter(Boolean);
      requireValue(words.length >= 1 && words.length <= 28, `${step.id}: keep each narration phrase to 28 words or fewer.`);
    }
  }
  return plan;
}

export async function synthesize(text, voiceId, key, request = fetch) {
  requireValue(key, 'Set FISH_STUDIO_APIKEY or FISH_API_KEY in the process environment; no offline or paid fallback is enabled.');
  const response = await request('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      model: MODEL,
    },
    body: JSON.stringify({ text, reference_id: voiceId, format: 'wav', sample_rate: 44100, normalize: true, prosody: { speed: 1, volume: 0 } }),
    redirect: 'error',
  });
  requireValue(response.ok, `Fish HTTP ${response.status}. Stopped; no retry or paid fallback.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  requireValue(bytes.length > 64 && bytes.subarray(0, 4).toString() === 'RIFF', 'Fish returned an empty or invalid WAV payload.');
  return bytes;
}

function duration(file, ffprobe = process.env.FFPROBE || 'ffprobe') {
  const raw = execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' });
  const seconds = Number.parseFloat(raw.trim());
  requireValue(Number.isFinite(seconds) && seconds > 0, `Unable to measure narration duration: ${file}`);
  return seconds;
}

function captionsFor(phrases, durations) {
  let cursor = 0;
  return phrases.map((text, index) => {
    const start = Number(cursor.toFixed(3));
    cursor += durations[index];
    return { start, end: Number(cursor.toFixed(3)), text };
  });
}

function concatWavs(files, output, ffmpeg = process.env.FFMPEG || 'ffmpeg') {
  if (files.length === 1) {
    execFileSync(ffmpeg, ['-y', '-v', 'error', '-i', files[0], '-c:a', 'pcm_s16le', output], { stdio: 'ignore' });
    return;
  }
  const list = `${output}.concat.txt`;
  writeFileSync(list, `${files.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join('\n')}\n`);
  try {
    execFileSync(ffmpeg, ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', output], { stdio: 'ignore' });
  } finally {
    try { execFileSync('rm', [list], { stdio: 'ignore' }); } catch {}
  }
}

export async function narrate(plan, { root = ROOT, key = process.env.FISH_STUDIO_APIKEY || process.env.FISH_API_KEY, request = fetch } = {}) {
  validatePlan(plan);
  requireValue(key, 'Set FISH_STUDIO_APIKEY or FISH_API_KEY in the process environment; no offline or paid fallback is enabled.');
  const outputRoot = path.join(root, 'media', 'runs', plan.runId, 'narration');
  mkdirSync(outputRoot, { recursive: true });
  const estimate = { model: MODEL, voiceId: plan.voiceId, runId: plan.runId, estimatedProviderCostUsd: 0, providerCallsThisRun: 0 };
  const steps = [];
  for (const step of plan.steps) {
    const stepDir = path.join(outputRoot, step.id);
    mkdirSync(stepDir, { recursive: true });
    const phraseFiles = [];
    const phraseDurations = [];
    for (let index = 0; index < step.phrases.length; index += 1) {
      const phrase = String(step.phrases[index]).trim();
      const requestHash = hash(JSON.stringify({ model: MODEL, voiceId: plan.voiceId, text: phrase }));
      const file = path.join(stepDir, `${index + 1}.wav`);
      const receiptFile = `${file}.receipt.json`;
      if (existsSync(file) && existsSync(receiptFile)) {
        const receipt = JSON.parse(readFileSync(receiptFile, 'utf8'));
        requireValue(receipt.requestHash === requestHash && receipt.model === MODEL, `${step.id}: cached narration receipt does not match this plan.`);
      } else {
        const bytes = await synthesize(phrase, plan.voiceId, key, request);
        writeFileSync(file, bytes);
        writeFileSync(receiptFile, JSON.stringify({ schemaVersion: 1, requestHash, model: MODEL, provider: 'Fish Audio', providerCostUsd: 0 }, null, 2) + '\n');
        estimate.providerCallsThisRun += 1;
      }
      phraseFiles.push(file);
      phraseDurations.push(duration(file));
    }
    const output = path.join(outputRoot, `${step.id}.wav`);
    concatWavs(phraseFiles, output);
    const measured = duration(output);
    steps.push({ id: step.id, durationSeconds: Math.ceil(measured * 30) / 30, narration: { file: path.relative(path.join(root, 'media'), output).split(path.sep).join('/'), authorized: true, provenance: `Fish Audio ${MODEL}; voice ${plan.voiceId}; ${plan.voiceProvenance}` }, captions: captionsFor(step.phrases, phraseDurations) });
  }
  const result = { ...estimate, timingBasis: 'Measured duration of each separately synthesized phrase; inspect joins during playback.', steps };
  writeFileSync(path.join(outputRoot, 'receipt.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const planPath = process.argv[2];
  requireValue(planPath, 'Usage: node runtime/narrate.mjs narration-plan.json [--estimate]');
  const plan = JSON.parse(readFileSync(path.resolve(planPath), 'utf8'));
  console.log(JSON.stringify(process.argv.includes('--estimate') ? { model: MODEL, ...validatePlan(plan), estimatedProviderCostUsd: 0 } : await narrate(plan), null, 2));
}
