import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialProject, current, applyEvent, taskFor, revisionImpact, assertAllowed, openWorkflow, audioLocked } from '../runtime/workflow.mjs';
import { digest } from '../runtime/contracts.mjs';
import { inputs, script, file, event, send, authored, reviewed, approved, produce, audioProject } from './helpers.mjs';

test('five answer groups feed exactly four 15-second beats; stable digest ignores object key ordering', () => {
  assert.equal(Object.keys(inputs.answers).length, 5);
  assert.throws(() => send(initialProject('x', inputs), 'artifact', { workerId: 'writer', content: { ...script, beats: [...script.beats, script.beats[0]] } }), /4/);
  assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
});

test('author → evidenced rejection → repair → independent pass → user lock; stale replies cannot advance', () => {
  let p = authored(initialProject('x', inputs)); const stale = event(p, 'review');
  p = reviewed(p, 'rejected'); assert.equal(p.gate, 'author');
  p = authored(p); assert.equal(current(p).version, 2); assert.equal(p.artifacts[0].valid, false);
  assert.throws(() => applyEvent(p, stale), /STALE_TASK/);
  assert.throws(() => send(p, 'approve', { message: 'go' }), /agent-passing/);
  p = reviewed(p); p = approved(p); assert.equal(p.step, 'voiceSample');
  assert.throws(() => send(p, 'artifact', { actor: 'human', workerId: 'human', content: { files: [file(0, 9)], consent: true, language: 'en' } }), /10 seconds/);
});

test('unrelated notes preserve stage; reviewer cannot approve its own writing or reject by taste', () => {
  let p = authored(initialProject('x', inputs));
  const a = current(p); const good = event(p, 'review', { workerId: 'writer', artifactId: a.id, artifactDigest: a.digest, review: reviewed(p).artifacts.at(-1).review });
  assert.throws(() => applyEvent(p, good), /distinct reviewer/);
  const before = p.step; p = send(p, 'note', { message: 'Tell me about LangGraph.' }); assert.equal(p.step, before); assert.equal(p.gate, 'review');
  assert.throws(() => reviewed(p, 'rejected', { checks: [{ criterion: 'facts', status: 'fail', evidence: 'I prefer another ending', location: 'ending', repair: '' }] }), /required criterion/);
  p = reviewed(p, 'rejected'); p = reviewed(authored(p), 'rejected'); assert.equal(p.gate, 'escalate');
  assert.throws(() => send(p, 'artifact', { workerId: 'writer', content: script }), /not allowed/);
});

test('SQLite process-independent restart, invalid response leaves current interrupt healthy', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'memoir-state-')); let w = openWorkflow(join(dir, 'state.sqlite'));
  try {
    const first = await w.init('x', inputs); const e = event(first.project, 'artifact', { workerId: 'writer', content: script });
    await w.respond('x', e); w.close(); w = openWorkflow(join(dir, 'state.sqlite'));
    const recovered = await w.status('x'); assert.equal(recovered.pending.gate, 'review');
    await assert.rejects(w.respond('x', e), /STALE_TASK/); assert.equal((await w.status('x')).pending.taskId, recovered.pending.taskId);
    await w.respond('x', event(recovered.project, 'review', { workerId: 'reviewer', artifactId: current(recovered.project).id, artifactDigest: current(recovered.project).digest,
      review: reviewed(recovered.project).artifacts.at(-1).review }));
    assert.equal((await w.status('x')).pending.gate, 'human');
    await assert.rejects(w.init('x', inputs), /already exists/);
  } finally { w.close(); await rm(dir, { recursive: true }); }
});

test('audio-first cannot be bypassed; alternate/stock voice cannot masquerade as clone', () => {
  const p = initialProject('x', inputs);
  for (const kind of ['candidates', 'sheet', 'background', 'keyframe', 'video']) assert.throws(() => assertAllowed(p, kind), /AUDIO_LOCK/);
  const ready = audioProject(); assert.equal(audioLocked(ready), true); assert.equal(ready.step, 'roster');
  const clone = ready.artifacts.find(a => a.key === 'clone');
  const impact = revisionImpact(ready, clone.id); assert(impact.remainValid.includes('voiceSample@1')); assert(impact.affected.includes('narration@1'));
});

test('missing STT, similarity or actual audio perception prevents narration lock', () => {
  let p = audioProject(); const narration = current(p, 'narration');
  p.step = 'narration'; p.gate = 'review'; delete narration.approvedBy;
  assert.throws(() => reviewed(p, 'approved', { perception: 'unavailable' }), /missing perception/);
  assert.throws(() => reviewed(p, 'approved', { measurements: undefined }), /measurements/);
  const m = reviewed(p).artifacts.find(a => a.id === narration.id).review.measurements;
  assert.throws(() => reviewed(p, 'approved', { measurements: { ...m, transcripts: ['garbled', ...m.transcripts.slice(1)] } }), /differs/);
});

test('request authorization binds exact snapshot; begin/job ID persists and duplicate submission is rejected', () => {
  let p = approved(reviewed(authored(initialProject('x', inputs))));
  p = send(p, 'artifact', { actor: 'human', workerId: 'human', content: { files: [file()], consent: true, language: 'en' } });
  p = send(p, 'plan', { plan: { provider: 'cartesia', operation: 'clone', estimatedCostUsd: 0.1, parameters: {} } });
  const j = p.jobs[0]; assert.equal(p.gate, 'authorize'); assert.equal(j.request.clip.sha256, file().sha256);
  assert.throws(() => send(p, 'authorize', { jobId: j.id, artifactDigest: 'wrong', message: 'yes' }), /exact generation/);
  p = send(p, 'authorize', { jobId: j.id, artifactDigest: j.digest, message: 'ISOLATED TEST consent' });
  p = send(p, 'begin', { jobId: j.id, artifactDigest: j.digest });
  assert.throws(() => send(p, 'begin', { jobId: j.id, artifactDigest: j.digest }), /ALREADY_SUBMITTED/);
  p = send(p, 'job-id', { jobId: j.id, artifactDigest: j.digest, providerJobId: 'saved-provider-123' }); assert.equal(p.jobs[0].providerJobId, 'saved-provider-123');
  p = send(p, 'provider-error', { jobId: j.id, artifactDigest: j.digest, message: 'Timeout; outcome uncertain' });
  assert.throws(() => send(p, 'resolve', { message: 'retry' }), /UNCERTAIN_JOB/);
  p = send(p, 'reconcile', { jobId: j.id, artifactDigest: j.digest, message: 'Provider confirms existing result; collect it.' });
  assert.equal(p.jobs[0].status, 'uncertain'); assert.equal(p.gate, 'collect');
});

test('each required character gets three candidates + selected-image sheet; all sheets before backgrounds', () => {
  let p = audioProject();
  p = send(p, 'artifact', { workerId: 'roster-author', content: { characters: ['alex', 'mia'].map(id => ({ id, name: id, ageVariant: id === 'alex' ? 'adult' : 'child', important: true, references: [{ path: `/isolated-test/${id}.png`, sha256: file().sha256, bytes: 1024, width: 100, height: 100 }], notes: 'ISOLATED TEST reference, not production.' })) } });
  p = approved(reviewed(p));
  for (const id of ['alex', 'mia']) {
    assert.equal(p.characterId, id);
    p = produce(p, { files: [1, 2, 3].map(i => ({ path: `/isolated-test/image-${i}.png`, sha256: file(i).sha256, bytes: 1024, width: 100, height: 100 })), prompt: 'Design character.' });
    p = approved(reviewed(p), { selection: 1 });
    const prompt = { prompt: `Selected-image sheet of ${id}, four turnaround poses and eight expressions.`, recipeSha256: file().sha256, referenceSha256: file(2).sha256, turnaround: ['front', 'three-quarter', 'profile', 'back'], expressions: ['neutral', 'happy', 'delighted', 'sad', 'surprised', 'confused', 'angry', 'talking'] };
    assert.throws(() => send(p, 'artifact', { workerId: 'sheet-writer', content: { ...prompt, referenceSha256: 'wrong' } }), /selected character/);
    p = send(p, 'artifact', { workerId: 'sheet-writer', content: prompt }); p = reviewed(p); assert.equal(p.step, 'sheet');
    p = approved(reviewed(produce(p, { files: [{ path: '/isolated-test/sheet.png', sha256: file(5).sha256, bytes: 1024, width: 100, height: 100 }], prompt: prompt.prompt })));
  }
  assert.equal(p.step, 'backgrounds'); assert.equal(p.gate, 'pending'); assert.throws(() => assertAllowed(p, 'video'), /PRODUCTION_NOT_SPECIFIED/);
});

test('bounded preauthorization is explicit and exhaustion returns to the human', () => {
  let p = audioProject(); p.step = 'audition'; p.gate = 'produce';
  p = send(p, 'allowance', { message: 'ISOLATED TEST: allow one audition request up to $0.05.', allowance: { operations: ['audition'], maxRequests: 1, maxCostUsd: 0.05 } });
  p = produce(p, { files: [file(6)], voiceId: 'private-clone-test', transcript: script.beats[0].narration }); assert.equal(p.jobs.at(-1).allowanceId, 'allowance-1');
  p = reviewed(p, 'rejected');
  p = send(p, 'plan', { plan: { provider: 'cartesia', operation: 'audition', estimatedCostUsd: 0.05, parameters: {} } }); assert.equal(p.gate, 'authorize');
});

test('script revision preserves the sample and clone and resumes at audition after reapproval', () => {
  let p = audioProject(); const a = current(p, 'script'); const cloneId = current(p, 'clone').id;
  p = send(p, 'changes', { artifactId: a.id, artifactDigest: a.digest, message: 'ISOLATED TEST: shorten beat two.' });
  assert.equal(current(p, 'clone').id, cloneId); assert.equal(current(p, 'narration'), undefined);
  p = approved(reviewed(authored(p))); assert.equal(p.step, 'audition'); assert.equal(current(p, 'clone').id, cloneId);
});

test('an audio timing repair requiring different words returns to the script decision instead of regeneration', () => {
  let p = audioProject(); p.step = 'narration'; p.gate = 'review';
  p = reviewed(p, 'rejected', { repairTarget: 'script' }); assert.equal(p.gate, 'escalate');
  assert.throws(() => send(p, 'plan', { plan: { provider: 'cartesia', operation: 'narration', estimatedCostUsd: 0.1, parameters: {} } }), /not allowed/);
});
