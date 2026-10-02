import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { digest } from '../runtime/contracts.mjs';
import { scriptChecks, audioChecks, transcriptDiff, evaluateTask, verifiedMedia, artifactEvidence } from '../runtime/evaluators.mjs';
import { validateDataset, taskForCase, runEvaluation, langsmithExamples } from '../evaluation/harness.mjs';
import { inputs, script, authored } from './helpers.mjs';
import { initialProject } from '../runtime/workflow.mjs';
const dataset = JSON.parse(await readFile(new URL('../evaluation/dataset.json', import.meta.url), 'utf8'));

test('real saved-case dataset declares provenance; related cases and identical assets cannot cross splits', () => {
  assert.equal(validateDataset(dataset).cases.length, 22); assert.equal(dataset.cases.filter(c => c.origin === 'saved-output').length, 20);
  const related = structuredClone(dataset); related.cases[0].split = 'holdout'; assert.throws(() => validateDataset(related), /RELATED_CASE/);
  const duplicate = structuredClone(dataset); duplicate.cases[13].input.media = duplicate.cases[0].input.media; assert.throws(() => validateDataset(duplicate), /ASSET_LEAKAGE/);
  const bad = structuredClone(dataset); bad.cases[0].label = { ...bad.cases[0].label, status: 'fail', repair: '' }; assert.throws(() => validateDataset(bad), /repair/);
  const provisional = structuredClone(dataset); provisional.cases[0].label.authority = 'agent-provisional'; assert.throws(() => validateDataset(provisional), /PROVISIONAL_LABEL/);
});

test('worker tasks strip expected labels, split and provenance evidence; responses bind exact input', async () => {
  const task = taskForCase(dataset.cases[0]); assert(!('label' in task)); assert(!JSON.stringify(task).includes(dataset.cases[0].label.evidence)); assert(!('split' in task));
  const prediction = await evaluateTask(task); assert.equal(prediction.inputDigest, digest({ kind: task.kind, input: task.input }));
  await assert.rejects(runEvaluation(dataset, { predictions: [{ ...prediction, inputDigest: 'stale' }] }), /STALE/);
  await assert.rejects(runEvaluation(dataset, { predictions: [prediction, prediction] }), /DUPLICATE/);
  await assert.rejects(runEvaluation(dataset, { predictions: [prediction] }), /INCOMPLETE/);
  await assert.rejects(runEvaluation(dataset, { predictions: [] }), /INCOMPLETE/);
});

test('local rules catch only measured timing/contracts, with zero false approvals and no invented perceptual success', async () => {
  const r = await runEvaluation(dataset, { split: 'all' });
  assert.equal(r.metrics.duration.flaggedDefects, 2); assert.equal(r.metrics.duration.incorrectRejections, 0);
  assert.equal(r.metrics.anatomy.flaggedDefects, 0); assert.equal(r.metrics.anatomy.missedDefects, 1); assert.equal(r.metrics.anatomy.unresolved, 1);
  assert.equal(r.metrics['voice-match'].unresolved, 1); assert.equal(r.productionApproval, false); assert.equal(r.productionStateMutated, false);
  assert.equal(r.qualification.anatomyJudge, false); assert.equal(r.apiCalls, 0);
});

test('a judge that rejects usable timing or approves the known anatomical defect gets counted accurately', async () => {
  const good = taskForCase(dataset.cases.find(c => c.label.status === 'pass' && c.kind === 'audio-duration'));
  const defect = taskForCase(dataset.cases.find(c => c.kind === 'video-anatomy'));
  const wrongGood = { ...await evaluateTask(good), evaluator: 'isolated-bad-judge', check: { criterion: good.criterion, status: 'fail', evidence: 'Isolated wrong judgement', location: 'whole stem', repair: 'Unnecessary regeneration' } };
  const wrongDefect = { ...await evaluateTask(defect), evaluator: 'isolated-bad-judge', check: { criterion: defect.criterion, status: 'pass', evidence: 'Isolated wrong anatomy judgement', location: 't=5', repair: '' }, basis: { mode: 'direct-image', mediaVerified: true, scope: 'anatomy' } };
  const predictions = await Promise.all(dataset.cases.filter(c => c.split === 'calibration').map(c => evaluateTask(taskForCase(c))));
  const r = await runEvaluation(dataset, { predictions: predictions.map(p => p.caseId === good.caseId ? wrongGood : p.caseId === defect.caseId ? wrongDefect : p) });
  assert.equal(r.metrics.duration.incorrectRejections, 1); assert.equal(r.metrics.anatomy.falseApprovals, 1); assert.equal(r.qualification.anatomyJudge, false);
  await assert.rejects(runEvaluation(dataset, { predictions: [{ ...wrongDefect, basis: { ...wrongDefect.basis, mode: 'metadata' } }] }), /direct perception/);
});

test('script structure never establishes semantic quality, and malformed drafts fail with localized repair', () => {
  const good = scriptChecks(script); assert.equal(good[0].status, 'pass'); assert(good.slice(1).every(c => c.status === 'inconclusive'));
  const bad = scriptChecks({ ...script, beats: script.beats.slice(0, 3) })[0]; assert.equal(bad.status, 'fail'); assert(bad.location && bad.repair);
  const unsupported = structuredClone(script); unsupported.beats[0].narration = 'I invented a flying bicycle and won a Nobel prize.';
  assert.equal(scriptChecks(unsupported).find(c => c.criterion === 'facts').status, 'inconclusive');
});

test('STT diff catches skipped/changed words; wrong hashes cannot impersonate transcription or likeness', () => {
  assert.equal(transcriptDiff('We laughed, together.', 'we laughed together').editDistance, 0);
  assert.equal(transcriptDiff('we tried again together', 'we tried together').editDistance, 1);
  assert.equal(transcriptDiff('we tried again', 'we flew again').editDistance, 1);
  const input = { durations: [12], lockedTexts: ['we tried again together'], audioHashes: ['audio-1'], sampleHash: 'sample', stt: { method: 'ISOLATED test transcript', audioHashes: ['audio-1'], transcripts: ['we tried together'] } };
  const r = audioChecks(input); assert.equal(r.checks.find(c => c.criterion === 'transcript').status, 'fail'); assert.equal(r.speakingRateWpm[0], 15);
  assert.equal(audioChecks({ ...input, stt: { ...input.stt, audioHashes: ['wrong'] } }).checks.find(c => c.criterion === 'transcript').status, 'inconclusive');
  assert.equal(audioChecks({ ...input, similarity: { method: 'ISOLATED embedding', referenceSha256: 'sample', audioHashes: ['audio-1'], score: 0.99 } }).checks.find(c => c.criterion === 'voice-match').status, 'inconclusive');
  assert.equal(audioChecks({ ...input, durations: [15.01] }).checks[0].status, 'fail');
  assert.equal(audioChecks({ ...input, similarity: { method: 'test', referenceSha256: 'sample', score: 0.99 } }).checks.find(c => c.criterion === 'voice-match').status, 'inconclusive');
});

test('LangSmith export remains local and keeps expected outputs separate from worker inputs', () => {
  const rows = langsmithExamples(dataset, 'holdout'); assert.equal(rows.length, 9); assert(rows.every(r => r.metadata.split === 'holdout'));
  assert(rows.every(r => !('label' in r.inputs) && r.outputs.status));
});

test('media verification refuses traversal and changed bytes; snapshot labels never impersonate fresh inspection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'memoir-eval-media-'));
  try {
    await assert.rejects(verifiedMedia({ locator: '../outside.wav' }, dir, true), /inside/);
    await writeFile(join(dir, 'audio.wav'), 'changed'); await assert.rejects(verifiedMedia({ locator: 'audio.wav', sha256: 'wrong', bytes: 7 }, dir, true), /ASSET_CHANGED/);
    await symlink(join(dir, '..'), join(dir, 'escape'));
    await assert.rejects(verifiedMedia({ locator: 'escape' }, dir), /inside/);
    const prediction = await evaluateTask(taskForCase(dataset.cases[0])); assert.equal(prediction.basis.mediaVerified, false);
  } finally { await rm(dir, { recursive: true }); }
});

test('offline CLI leaves an existing checkpoint untouched and default tasks exclude holdout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'memoir-eval-cli-')); const root = new URL('../', import.meta.url);
  const run = (...args) => spawnSync(process.execPath, ['runner.mjs', ...args, '--run', dir], { cwd: root, encoding: 'utf8' });
  try {
    assert.equal(run('init', 'examples/parent.json').status, 0);
    const before = JSON.parse(run('status').stdout);
    // Evaluation commands do not open/mutate production checkpoints.
    const report = spawnSync(process.execPath, ['runner.mjs', 'eval', '--split', 'holdout'], { cwd: root, encoding: 'utf8' }); assert.equal(report.status, 0, report.stderr);
    assert.deepEqual(JSON.parse(run('status').stdout), before);
    const tasks = JSON.parse(spawnSync(process.execPath, ['runner.mjs', 'eval-tasks'], { cwd: root, encoding: 'utf8' }).stdout);
    assert.equal(tasks.length, 13); assert(!tasks.some(t => t.caseId.startsWith('steve')));
  } finally { await rm(dir, { recursive: true }); }
});

test('advisory evidence binds the current artifact but cannot certify facts or approve it', async () => {
  const p = authored(initialProject('test',inputs,{workflowRevision:2})); const before = digest(p); const r = await artifactEvidence(p);
  assert.equal(r.artifactId, 'script@1'); assert.equal(r.productionApproval, false); assert.equal(digest(p), before);
  assert.equal(r.checks.find(c => c.criterion === 'facts').status, 'inconclusive');
});
