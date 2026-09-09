import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { critiqueTutorialScript } from '../runtime/critique.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('critiqueTutorialScript fails empty or invalid input', () => {
  assert.throws(() => critiqueTutorialScript(null), /Invalid input supplied/);
  assert.throws(() => critiqueTutorialScript('{ invalid json'), /Input path not found or invalid JSON string/);
  
  const emptyRes = critiqueTutorialScript({ steps: [] });
  assert.equal(emptyRes.verdict, 'CRITICAL_FAIL');
  assert.ok(emptyRes.score < 65);
  assert.ok(emptyRes.actionableFeedback.some(f => f.includes('Script contains no steps')));
});

test('critiqueTutorialScript flags missing proof-first hero step (Law 1)', () => {
  const input = {
    steps: [
      { id: 'intro', kind: 'browser', label: 'Choose a format', durationSeconds: 6, nativeAudio: false },
      { id: 'run', kind: 'terminal', label: 'Run the agent', durationSeconds: 6 },
      { id: 'cp', kind: 'terminal', label: 'Check the receipt', durationSeconds: 6, checkpoint: { eyebrow: 'Check', headline: 'Verifying setup completely', badge: 'Next' } },
      { id: 'final', kind: 'final', label: 'Watch the result', durationSeconds: 6, nativeAudio: true }
    ]
  };
  const res = critiqueTutorialScript(input);
  assert.ok(res.breakdown.proofFirst.score < 25);
  assert.ok(res.actionableFeedback.some(f => f.includes("must be kind 'hero' or 'final'")));
});

test('critiqueTutorialScript flags non-imperative action titles (Law 2)', () => {
  const input = {
    steps: [
      { id: 'hero', kind: 'hero', label: 'See the finished result', durationSeconds: 5, nativeAudio: true },
      { id: 'step2', kind: 'browser', label: 'How to choose a format', durationSeconds: 5 },
      { id: 'step3', kind: 'terminal', label: 'Setting up the agent', durationSeconds: 5 },
      { id: 'cp', kind: 'terminal', label: 'Verify the receipt', durationSeconds: 5, checkpoint: { eyebrow: 'Check', headline: 'Verifying setup completely', badge: 'Next' } },
      { id: 'final', kind: 'final', label: 'Watch the result', durationSeconds: 5, nativeAudio: true }
    ]
  };
  const res = critiqueTutorialScript(input);
  assert.ok(res.breakdown.imperativeTitles.score < 20);
  assert.ok(res.actionableFeedback.some(f => f.includes('must begin with an imperative action verb')));
});

test('critiqueTutorialScript flags banned conversational fluff phrases (Law 3)', () => {
  const input = {
    steps: [
      { id: 'hero', kind: 'hero', label: 'See the finished result', durationSeconds: 5, nativeAudio: true },
      {
        id: 'browser',
        kind: 'browser',
        label: 'Choose a format',
        durationSeconds: 6,
        narration: { file: 'audio.wav' },
        captions: [
          { start: 0.2, end: 4.5, text: "Hey guys, welcome back to the channel! In this video without further ado let's dive in." }
        ]
      },
      { id: 'cp', kind: 'terminal', label: 'Verify the receipt', durationSeconds: 5, checkpoint: { eyebrow: 'Check', headline: 'Verifying setup completely', badge: 'Next' } },
      { id: 'final', kind: 'final', label: 'Watch the result', durationSeconds: 5, nativeAudio: true }
    ]
  };
  const res = critiqueTutorialScript(input);
  assert.ok(res.breakdown.fluffAndDensity.score < 20);
  assert.ok(res.actionableFeedback.some(f => f.includes('Banned fluff phrase detected')));
});

test('critiqueTutorialScript flags missing or low-quality checkpoint (Law 4)', () => {
  const input = {
    steps: [
      { id: 'hero', kind: 'hero', label: 'See the finished result', durationSeconds: 5, nativeAudio: true },
      { id: 'step2', kind: 'browser', label: 'Choose a format', durationSeconds: 5 },
      { id: 'step3', kind: 'terminal', label: 'Run the agent', durationSeconds: 5 },
      { id: 'final', kind: 'final', label: 'Watch the result', durationSeconds: 5, nativeAudio: true }
    ]
  };
  const res = critiqueTutorialScript(input);
  assert.equal(res.breakdown.checkpoint.score, 0);
  assert.ok(res.actionableFeedback.some(f => f.includes('Script lacks a checkpoint card')));
});

test('critiqueTutorialScript flags narration exceeding step duration or rushed pacing (Law 5)', () => {
  const input = {
    steps: [
      { id: 'hero', kind: 'hero', label: 'See the finished result', durationSeconds: 5, nativeAudio: true },
      {
        id: 'step2',
        kind: 'browser',
        label: 'Choose a format',
        durationSeconds: 4,
        narration: { file: 'audio.wav' },
        captions: [
          { start: 0.1, end: 3.9, text: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen." }
        ]
      },
      { id: 'cp', kind: 'terminal', label: 'Verify the receipt', durationSeconds: 5, checkpoint: { eyebrow: 'Check', headline: 'Verifying setup completely', badge: 'Next' } },
      { id: 'final', kind: 'final', label: 'Watch the result', durationSeconds: 5, nativeAudio: true }
    ]
  };
  const res = critiqueTutorialScript(input);
  assert.ok(res.breakdown.clockAndPacing.score < 20);
  assert.ok(res.actionableFeedback.some(f => f.includes('Narration') || f.includes('Speaking rate too fast')));
});

test('critiqueTutorialScript approves golden benchmark: batman-arkham-first-run', () => {
  const goldenPath = path.join(root, 'examples/batman-arkham-first-run/input.json');
  assert.ok(existsSync(goldenPath), 'Golden benchmark file must exist');
  const res = critiqueTutorialScript(goldenPath);
  assert.equal(res.verdict, 'PASS');
  assert.ok(res.score >= 85, `Expected score >= 85, received ${res.score}`);
});

test('critiqueTutorialScript approves golden benchmark: animal-conversations-compositor', () => {
  const goldenPath = path.join(root, 'examples/animal-conversations-compositor/input.json');
  assert.ok(existsSync(goldenPath), 'Golden benchmark file must exist');
  const res = critiqueTutorialScript(goldenPath);
  assert.equal(res.verdict, 'PASS');
  assert.ok(res.score >= 85, `Expected score >= 85, received ${res.score}`);
});

test('CLI execution passes for valid input and outputs JSON with --json flag', () => {
  const goldenPath = path.join(root, 'examples/animal-conversations-compositor/input.json');
  const output = execFileSync(
    process.execPath,
    ['runtime/critique.mjs', goldenPath, '--json'],
    { cwd: root, encoding: 'utf8' }
  );
  const parsed = JSON.parse(output);
  assert.equal(parsed.verdict, 'PASS');
  assert.ok(parsed.score >= 85);
  assert.equal(typeof parsed.breakdown, 'object');
});
