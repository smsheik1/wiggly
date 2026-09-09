import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chunkNarrationText,
  generateTimedCaptions,
  synthesizeSpeechFile,
  buildNarratedTutorialStep,
  probeAudioDuration
} from '../runtime/voice.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('chunkNarrationText splits text into readable subtitle lines', () => {
  const text = "Paste the instructions into a new conversation and send. The agent reads the package and sets it up.";
  const chunks = chunkNarrationText(text, 6);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.ok(c.split(' ').length <= 7);
  }
});

test('generateTimedCaptions calculates monotonic non-overlapping ranges', () => {
  const text = "On Wiggly, choose Copy for another coding agent.";
  const captions = generateTimedCaptions({
    text,
    audioDurationSeconds: 3.0,
    startOffsetSeconds: 0.2
  });
  assert.ok(captions.length >= 1);
  assert.equal(captions[0].start, 0.2);
  for (let i = 1; i < captions.length; i++) {
    assert.equal(captions[i].start, captions[i - 1].end);
  }
  const last = captions[captions.length - 1];
  assert.ok(Math.abs(last.end - 3.2) < 0.05);
});

test('synthesizeSpeechFile produces audio with positive duration', async () => {
  const tmpWav = path.join(root, 'media/test-speech.wav');
  try {
    const duration = await synthesizeSpeechFile({
      text: "Hello from Wiggly automated tutorial test.",
      outputPath: tmpWav,
      voice: "zach",
      offlineFixture: true
    });
    assert.ok(duration > 0.5);
    assert.ok(existsSync(tmpWav));
    const probed = probeAudioDuration(tmpWav);
    assert.ok(Math.abs(probed - duration) < 0.05);
  } finally {
    if (existsSync(tmpWav)) unlinkSync(tmpWav);
  }
});

test('real narration refuses missing Fish credentials instead of falling back', async () => {
  await assert.rejects(
    synthesizeSpeechFile({
      text: 'This must use Fish Audio.',
      outputPath: path.join(root, 'media', 'missing-key.wav'),
      voice: 'zach',
      apiKey: ''
    }),
    /Fish Audio is required.*no offline or paid fallback/
  );
});

test('real narration stops on a Fish error without retrying or switching models', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: false, status: 402 };
  };
  try {
    await assert.rejects(
      synthesizeSpeechFile({
        text: 'This request must stop.',
        outputPath: path.join(root, 'media', 'fish-error.wav'),
        voice: 'zach',
        apiKey: 'test-only-key'
      }),
      /stopped without retry or paid fallback/
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('buildNarratedTutorialStep creates contract-compliant step with breathing room', async () => {
  const tmpWav = path.join(root, 'media/test-step.wav');
  try {
    const { step, audioDuration } = await buildNarratedTutorialStep({
      id: 'test-step',
      number: 2,
      label: 'Choose a coding agent',
      kind: 'terminal',
      background: 'blue',
      mediaPath: 'examples/batman-arkham/runtime-receipt.png',
      narrationText: "Use a coding agent that can run files on your computer.",
      audioRelPath: 'test-step.wav',
      audioFullPath: tmpWav,
      voice: "zach",
      offlineFixture: true
    });

    assert.equal(step.id, 'test-step');
    assert.equal(step.kind, 'terminal');
    assert.ok(step.durationSeconds > audioDuration);
    const lastCap = step.captions[step.captions.length - 1];
    assert.ok(step.durationSeconds >= lastCap.end + 0.4, 'Must reserve breathing room before step cut');
  } finally {
    if (existsSync(tmpWav)) unlinkSync(tmpWav);
  }
});
