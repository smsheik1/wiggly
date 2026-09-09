import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL, synthesize, validatePlan } from '../runtime/narrate.mjs';

const validPlan = {
  model: MODEL,
  voiceId: '0327fdb5da9e4fd782899a8058c8ae2b',
  voiceProvenance: 'test voice',
  authorized: true,
  runId: 'test-run',
  steps: [{ id: 'intro', phrases: ['Open the format.'] }, { id: 'run', phrases: ['Run the package.'] }],
};

test('narration plan rejects paid or malformed requests before provider calls', () => {
  assert.throws(() => validatePlan({ ...validPlan, model: 's2.1-pro' }), /s2.1-pro-free/);
  assert.throws(() => validatePlan({ ...validPlan, voiceId: 'missing' }), /valid Fish voice ID/);
  assert.throws(() => validatePlan({ ...validPlan, steps: [{ id: 'intro', phrases: [''] }, { id: 'run', phrases: ['Run.'] }] }), /28 words/);
});

test('Fish transport pins the free model and stops without retry or fallback', async () => {
  let request;
  const bytes = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(80)]);
  const result = await synthesize('Say this once.', validPlan.voiceId, 'test-key', async (url, options) => {
    request = { url, options };
    return { ok: true, arrayBuffer: async () => bytes };
  });
  assert.equal(request.options.headers.model, MODEL);
  assert.equal(request.options.redirect, 'error');
  assert.deepEqual(result, bytes);

  let calls = 0;
  await assert.rejects(
    synthesize('Stop here.', validPlan.voiceId, 'test-key', async () => {
      calls += 1;
      return { ok: false, status: 402 };
    }),
    /no retry or paid fallback/
  );
  assert.equal(calls, 1);
});
