import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { executeJob, requestDescriptor, loadKey } from '../runtime/providers.mjs';
import { importMedia, verifyFiles, measureAudio } from '../runtime/media.mjs';
import { digest } from '../runtime/contracts.mjs';
import { keyFor } from '../runtime/gates.mjs';
import { audioProject } from './helpers.mjs';

function bind(p, j) { p.step = j.plan.operation; p.gate = 'collect'; j.key = keyFor(p); j.dependencies = []; j.digest = digest({ plan: j.plan, request: j.request, dependencies: j.dependencies }); j.status = 'submitting'; j.authorization = { message: 'ISOLATED TEST authorized HTTP mock', at: new Date().toISOString() }; p.jobs = [j]; return j; }

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'memoir-provider-'));
  const wav = join(dir, 'sample.wav');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=12', wav]);
  const file = await importMedia(wav, dir);
  const imagePath = join(dir, 'reference.png');
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=32x32', '-frames:v', '1', imagePath]);
  const image = await importMedia(imagePath, dir);
  return { dir, file, image };
}

test('Cartesia clone uploads exact sample, language, private access; receipt recovery makes zero calls', async () => {
  const { dir, file } = await fixture();
  try {
    const p = audioProject(); p.artifacts.find(a => a.key === 'voiceSample').content.files = [file];
    const plan = { provider: 'cartesia', operation: 'clone', estimatedCostUsd: 0.1, parameters: {} };
    const j = { id: 'job-1', plan, request: requestDescriptor(p, plan), digest: 'isolated' }; let count = 0; bind(p, j);
    const mocked = async (url, options) => { count++; assert.equal(url, 'https://api.cartesia.ai/voices/clone');
      assert.equal(options.body.get('language'), 'en'); assert.equal(options.body.get('access'), 'private');
      assert.deepEqual(Buffer.from(await options.body.get('clip').arrayBuffer()), await readFile(file.path));
      assert.equal(options.headers['Cartesia-Version'], '2026-08-14');
      return Response.json({ id: 'private-test-clone', access: 'private' }); };
    const result = await executeJob(p, j, dir, 'isolated-test-key', mocked); assert.equal(result.voiceId, 'private-test-clone');
    await rm(join(dir, 'receipts', 'job-1', 'result.json'));
    const recovered = await executeJob(p, j, dir, '', () => { throw new Error('Forbidden network'); }, true);
    assert.deepEqual(recovered, result); assert.equal(count, 1);
  } finally { await rm(dir, { recursive: true }); }
});

test('Muse reference edits carry selected image bytes; correct three-candidate count and no secret leak on failure', async () => {
  const { dir, image } = await fixture();
  try {
    const p = audioProject(); p.characterId = 'alex'; p.artifacts.push({ key: 'roster', valid: true, content: { characters: [{ id: 'alex', references: [image] }] } });
    const plan = { provider: 'meta-muse', operation: 'candidates', estimatedCostUsd: 0.03, parameters: { prompt: 'Agent-authored isolated test character.' } };
    const j = { id: 'job-1', plan, request: requestDescriptor(p, plan), digest: 'isolated' }; let count = 0;
    j.request.output_format = 'png'; bind(p, j);
    const bytes = await readFile(image.path);
    const mocked = async (url, options) => { count++; assert.equal(url, 'https://api.meta.ai/v1/images/edits');
      const body = JSON.parse(options.body); assert.equal(body.n, 3); assert.equal(body.model, 'muse-image-1.0');
      assert.equal(body.images[0].image_url, `data:image/png;base64,${bytes.toString('base64')}`);
      return Response.json({ data: Array.from({ length: 3 }, () => ({ b64_json: bytes.toString('base64') })) }); };
    const result = await executeJob(p, j, dir, 'isolated-test-key', mocked); assert.equal(result.files.length, 3); assert.equal(count, 1);
    const broken = bind(p, { ...j, id: 'job-2' });
    await assert.rejects(executeJob(p, broken, dir, 'isolated-test-key', async () => { count++; return new Response('invalid isolated-test-key', { status: 401 }); }), /HTTP 401: invalid \[redacted\]/);
    await assert.rejects(executeJob(p, broken, dir, 'isolated-test-key', mocked), /UNCERTAIN_SUBREQUEST/); assert.equal(count, 2);
  } finally { await rm(dir, { recursive: true }); }
});

test('narration uses current clone, four separate natural-speed calls; unknown second subrequest is never duplicated', async () => {
  const { dir, file } = await fixture();
  try {
    const p = audioProject(); const plan = { provider: 'cartesia', operation: 'narration', estimatedCostUsd: 0.1, parameters: {} };
    const j = { id: 'job-1', plan, request: requestDescriptor(p, plan), digest: 'isolated' }; let calls = 0; bind(p, j);
    const mocked = async (_url, options) => { calls++; const body = JSON.parse(options.body); assert.equal(body.voice, 'private-clone-test'); assert.equal(body.generation_config.speed, 1);
      if (calls === 2) throw new Error('Isolated process/network loss'); return new Response(await readFile(file.path)); };
    await assert.rejects(executeJob(p, j, dir, 'isolated', mocked), /loss/);
    await assert.rejects(executeJob(p, j, dir, 'isolated', mocked), /UNCERTAIN_SUBREQUEST/); assert.equal(calls, 2);
    const complete = bind(p, { ...j, id: 'job-2' }); let completedCalls = 0;
    const result = await executeJob(p, complete, dir, 'isolated', async () => { completedCalls++; return new Response(await readFile(file.path)); });
    assert.equal(completedCalls, 4); assert.equal(result.files.length, 4); assert.equal(result.voiceId, 'private-clone-test');
  } finally { await rm(dir, { recursive: true }); }
});

test('real duration/silence measurements and immutable-file checks; secret loader selects only named key', async () => {
  const { dir, file } = await fixture();
  try {
    const m = await measureAudio(file); assert.equal(m.durationSeconds, 12); assert.equal(m.silenceSeconds, 0);
    await assert.rejects(verifyFiles({ ...file, durationSeconds: 10 }), /METADATA_MISMATCH/);
    await writeFile(file.path, 'tampered'); await assert.rejects(verifyFiles(file), /ASSET_CHANGED/);
    const secrets = join(dir, 'secrets.env'); await writeFile(secrets, 'UNRELATED=do-not-use\nCARTESIA_API_KEY="isolated-key"\n');
    assert.equal(await loadKey('cartesia', secrets), 'isolated-key'); await assert.rejects(loadKey('meta-muse', secrets), /META_API_KEY/);
  } finally { await rm(dir, { recursive: true }); }
});

test('standalone CLI resumes in another process, rejects runtime impersonation, and cannot finalize a film', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'memoir-cli-')); const root = new URL('../', import.meta.url);
  const run = (...args) => spawnSync(process.execPath, ['runner.mjs', ...args, '--run', dir], { cwd: root, encoding: 'utf8' });
  try {
    const init = run('init', 'examples/grandparent.json'); assert.equal(init.status, 0, init.stderr);
    const one = JSON.parse(init.stdout); const two = JSON.parse(run('status').stdout); assert.equal(one.pending.taskId, two.pending.taskId);
    const ev = join(dir, 'event.json'); await writeFile(ev, JSON.stringify({ taskId: two.pending.taskId, actor: 'runtime', action: 'begin' }));
    assert.match(run('respond', ev).stderr, /reserved/); assert.equal(run('finalize').status, 1);
    assert.equal(JSON.parse(run('status').stdout).sequence, 0);
  } finally { await rm(dir, { recursive: true }); }
});

test('calling the adapter directly cannot bypass the graph submission/authorization gates', async () => {
  const p = audioProject(); const plan = { provider: 'meta-muse', operation: 'candidates', estimatedCostUsd: 0.03, parameters: {} };
  await assert.rejects(executeJob(p, { id: 'invented', plan, request: {}, digest: 'invented', dependencies: [] }, '/unused', 'unused', () => { throw new Error('Must not reach network'); }), /UNAUTHORIZED_PROVIDER_CALL/);
});


test('background generation omits references; angle edit sends selected master bytes and cannot replay a completed request', async () => {
  const {readyForMaster,masterLocked,author,brief,prompt,ownerChecked} = await import('./background-helpers.mjs');
  const {send,approved,reviewed} = await import('./helpers.mjs');
  const {current} = await import('../runtime/workflow.mjs');
  const {dir,image} = await fixture();
  try {
    const bytes=await readFile(image.path);let calls=0;
    let p=readyForMaster();const masterPlan={provider:'meta-muse',operation:p.step,estimatedCostUsd:.03,parameters:{prompt:current(p,'backgroundPrompt:home').content.prompt}};
    const master=bind(p,{id:'background-master',plan:masterPlan,request:requestDescriptor(p,masterPlan)});master.request.output_format='png';bind(p,master);
    const result=await executeJob(p,master,dir,'isolated',async(url,opts)=>{calls++;assert.equal(url,'https://api.meta.ai/v1/images/generations');const body=JSON.parse(opts.body);assert.equal(body.n,3);assert.equal(body.images,undefined);assert.equal(body.size,'1536x864');return Response.json({data:Array(3).fill({b64_json:bytes.toString('base64')})});});assert.equal(result.files.length,3);
    p=masterLocked();p.artifacts.find(a=>a.key==='backgroundCandidates:home').content.files[1]=image;
    p=approved(reviewed(author(p,brief(p))));p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));
    const plan={provider:'meta-muse',operation:p.step,estimatedCostUsd:.01,parameters:{prompt:current(p,'backgroundAnglePrompt:home:reverse').content.prompt}};
    const j=bind(p,{id:'background-angle',plan,request:requestDescriptor(p,plan)});j.request.output_format='png';bind(p,j);
    const edited=await executeJob(p,j,dir,'isolated',async(url,opts)=>{calls++;assert.equal(url,'https://api.meta.ai/v1/images/edits');const body=JSON.parse(opts.body);assert.equal(body.n,1);assert.deepEqual(body.images,[{image_url:`data:image/png;base64,${bytes.toString('base64')}`}]);return Response.json({data:[{b64_json:bytes.toString('base64')}]});});assert.equal(edited.files.length,1);
    await executeJob(p,j,dir,'',()=>{throw new Error('Forbidden replay')},true);assert.equal(calls,2);
  }finally{await rm(dir,{recursive:true});}
});
