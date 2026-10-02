import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openWorkflow, assertAllowed, revisionImpact, current } from './runtime/workflow.mjs';
import { event, send, authored, reviewed, approved, intakeFixture, questionnaire } from './tests/helpers.mjs';
const dir = await mkdtemp(join(tmpdir(), 'wiggly-memoir-smoke-'));
try {
  for (const name of ['parent', 'grandparent']) {
    const inputs = JSON.parse(await readFile(new URL(`examples/${name}.json`, import.meta.url), 'utf8'));
    const path = join(dir, `${name}.sqlite`); let w = openWorkflow(path);
    const initial = await w.init(name, inputs); assert.equal(initial.pending.step, 'answers');
    const q=questionnaire(initial.project);
    let answers=await w.respond(name,event(initial.project,'artifact',{workerId:'isolated-intake',content:q}));
    const qr=reviewed(answers.project);
    answers=await w.respond(name,event(answers.project,'review',{workerId:'isolated-questionnaire-reviewer',artifactId:current(answers.project).id,artifactDigest:current(answers.project).digest,review:current(qr).review}));
    answers=await w.respond(name,event(answers.project,'approve',{artifactId:current(answers.project).id,artifactDigest:current(answers.project).digest,message:'ISOLATED fixture confirmation',intakeConfirmation:intakeFixture(answers.project)}));
    assert.equal(answers.pending.step,'script');
    // Isolated contract fixture, never a claim of approved creative work for this person.
    const draft = authored(answers.project);
    await w.respond(name, event(answers.project, 'artifact', { workerId: 'isolated-smoke-writer', content: current(draft).content }));
    const first = await w.status(name); const pass = reviewed(first.project);
    await w.respond(name, event(first.project, 'review', { workerId: 'isolated-smoke-reviewer', artifactId: current(first.project).id, artifactDigest: current(first.project).digest, review: current(pass).review }));
    w.close(); w = openWorkflow(path);
    const resumed = await w.status(name); assert.equal(resumed.pending.gate, 'human');
    for (const kind of ['candidates', 'sheet', 'video']) assert.throws(() => assertAllowed(resumed.project, kind), /AUDIO_LOCK/);
    const locked = approved(resumed.project); await w.respond(name, event(resumed.project, 'approve', { artifactId: current(resumed.project).id, artifactDigest: current(resumed.project).digest, message: 'ISOLATED MOCK human approval; not a real creative approval.',intakeConfirmation:intakeFixture(resumed.project) }));
    assert.equal((await w.status(name)).pending.step, 'voiceSample');
    assert.deepEqual(revisionImpact(locked, 'script@1').affected, ['script@1']); w.close();
    process.stdout.write(`${name}: persistent answers/script author/reviewer/user loops + audio-first gates passed (isolated fixture).\n`);
  }
  process.stdout.write('FREE SMOKE PASS. No model, media-generation or credential calls.\n');
} finally { await rm(dir, { recursive: true }); }
