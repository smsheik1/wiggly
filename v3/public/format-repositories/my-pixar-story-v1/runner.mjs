#!/usr/bin/env node
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import { VERSION, Content, Event, Review, Plans, Inputs, digest } from './runtime/contracts.mjs';
import { openWorkflow, revisionImpact } from './runtime/workflow.mjs';
import { importMedia, verifyFiles, measureAudio } from './runtime/media.mjs';
import { executeJob, loadKey, remediation, checkProvider } from './runtime/providers.mjs';
import { current, locked, assertAllowed } from './runtime/gates.mjs';
import { renderFilm, inspectFilm } from './runtime/assemble.mjs';
import {prepareComposition, servePreview, verifyRenderer} from './runtime/remotion.mjs';
import { assemblyManifest, assertFilmInspection } from './runtime/studio.mjs';
import {presentDeliverable} from './runtime/presentation.mjs';
import {Crew,crewRoles,runCrewTask,prepareCrewTask} from './runtime/crew.mjs';
import {CodexHost,DEFAULT_WORKER_MODEL,driveCrew} from './runtime/codex-host.mjs';
import {createGeminiReviewTools,GEMINI_REVIEW_PROFILE} from './runtime/gemini-review.mjs';
import {createCartesiaTranscriptionTool,CARTESIA_STT_PROFILE} from './runtime/cartesia-stt.mjs';
import {AudioCase,audioTask,qualifyAudio,requireAudioQualification} from './evaluation/audio-qualification.mjs';
import { VisualCase, visualTask, qualifyVisual, requireVisualQualification } from './evaluation/visual-qualification.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const command = args.shift();
function option(name, fallback) { const i = args.indexOf(`--${name}`); if (i < 0) return fallback; const value = args[i + 1]; if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value.`); args.splice(i, 2); return value; }
const runDir = resolve(option('run', join(root, 'agent-runs', 'draft')));
const secretsPath = resolve(option('secrets', join(root, 'secrets.env')));
const print = value => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const json = async path => JSON.parse(await readFile(resolve(path), 'utf8'));
async function lock() {
  await mkdir(runDir, { recursive: true }); const path = join(runDir, 'writer.lock');
  try { await writeFile(path, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 }); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const prior = JSON.parse(await readFile(path, 'utf8')); let active = true;
    try { process.kill(prior.pid, 0); } catch (error) { if (error.code === 'ESRCH') active = false; else throw error; }
    if (active) throw new Error(`RUN_BUSY: process ${prior.pid} owns this run.`);
    await unlink(path); await writeFile(path, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  }
  return () => unlink(path);
}
function presentation(status) {
  const { project, pending } = status;
  // A failed candidate never becomes the ordinary user-facing deliverable.
  const visible = pending.artifact?.review?.decision === 'approved' || pending.gate === 'review' || pending.gate === 'author';
  return { formatVersion: VERSION, checkpointId: status.checkpointId, sequence: project.sequence, pending: { ...pending, artifact: visible ? pending.artifact : null },
    validArtifacts: project.artifacts.filter(a => a.valid).map(a => ({ id: a.id, digest: a.digest, kind: a.kind, approved: !!a.approvedBy })),
    jobs: project.jobs.map(j => ({ id: j.id, status: j.status, digest: j.digest, providerJobId: j.providerJobId })), allowances: project.allowances };
}
async function verifySubmission(status,event){
  await verifyFiles(event.content);
  if(['artifact','plan','approve','authorize','owner-review'].includes(event.action)||event.action==='review'&&event.review?.decision!=='inconclusive')await verifyFiles(status.project.artifacts.filter(a=>a.valid));
}
async function main() {
  if(command==='check-provider'){const provider=option('provider');if(args.length)throw new Error('Unknown provider check arguments.');print(await checkProvider(provider,secretsPath));return;}
  if(command==='crew-template'){print({workers:Object.entries(crewRoles).map(([role,definition])=>({role,name:definition.name,workerId:`bind-host-${role}`,modelVersion:'inherit-host-model',capabilityVersion:'bind-actual-tools-v1',execution:'host'})),instruction:'Use your current host model and actual independent worker IDs; replace template model/capability values with the actual deployed versions before configuration. No external model is required.'});return;}
  if(command==='audio-tasks'){const cases=z.array(AudioCase).parse(await json(option('dataset'))),split=option('split','holdout');if(!['calibration','holdout'].includes(split))throw new Error('Invalid audio split.');print(cases.filter(c=>c.split===split).map(audioTask));return;}
  if(command==='visual-tasks'){const cases=z.array(VisualCase).parse(await json(option('dataset'))),split=option('split','holdout');if(!['calibration','holdout'].includes(split))throw new Error('Invalid visual split.');print(cases.filter(c=>c.split===split).map(visualTask));return;}
  if (command === 'eval' || command === 'eval-tasks' || command === 'eval-export') {
    const { validateDataset, selectCases, taskForCase, runEvaluation, langsmithExamples } = await import('./evaluation/harness.mjs');
    const dataset = validateDataset(await json(option('dataset', join(root, 'evaluation', 'dataset.json'))));
    const split = option('split', 'calibration'); const output = option('out'); const responses = option('predictions'); const mediaRoot = option('media-root');
    if (args.length) throw new Error(`Unknown evaluation arguments: ${args.join(' ')}`);
    const result = command === 'eval-tasks' ? selectCases(dataset, split).map(taskForCase) : command === 'eval-export' ? langsmithExamples(dataset, split) :
      await runEvaluation(dataset, { split, predictions: responses ? await json(responses) : undefined, mediaRoot });
    if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(resolve(output), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 }); print({ path: resolve(output), productionStateMutated: false, apiCalls: 0 }); }
    else print(result);
    return;
  }
  if (command === 'recipe' || command === 'background-recipe') { const content = await readFile(join(root, command === 'background-recipe' ? 'background-prompter.md' : 'character-sheet-recipe.md'), 'utf8'); print({ path: join(root, command === 'background-recipe' ? 'background-prompter.md' : 'character-sheet-recipe.md'), sha256: (await import('./runtime/media.mjs')).sha(Buffer.from(content)), content }); return; }
  if (command === 'check') {
    const tools = Object.fromEntries(['ffprobe', 'ffmpeg', 'tar'].map(tool => [tool, spawnSync(tool, ['-version'], { stdio: 'ignore' }).error?.code !== 'ENOENT']));
    const renderer=await verifyRenderer();
    print({ formatVersion: VERSION, node: process.version, tools, renderer:renderer.manifest.renderer, dependencies: 'LangGraph + SQLite loaded',
      requiredKeys: ['CARTESIA_API_KEY', 'META_API_KEY'], optionalKeys:['REPLICATE_API_TOKEN','ELEVENLABS_API_KEY','GEMINI_API_KEY (Codex media review)'], credentialsRead: false, productionStageLimit: 'final film; video blocked until reviewer qualification and human authorization; real production proof not performed' });
    if (Object.values(tools).some(v => !v)) process.exitCode = 1; return;
  }
  if (command === 'schema') {
    const name = args[0]; const schema = name === 'crew' ? Crew : name === 'event' ? Event : name === 'review' ? Review : name === 'plan' ? Plans : name === 'inputs' ? Inputs : Content[name];
    if (!schema) throw new Error('schema needs event/review/plan/inputs or a supported artifact kind.'); print(z.toJSONSchema(schema)); return;
  }
  const release = await lock(); const workflow = openWorkflow(join(runDir, 'checkpoints.sqlite'));
  try {
    if (command === 'init') {
      const inputs = await json(args[0]); print(presentation(await workflow.init('project', inputs))); return;
    }
    if (command === 'import') { print(await importMedia(args[0], runDir)); return; }
    const status = await workflow.status('project');
    if(['crew-start','crew-refresh','drive-codex','work-codex'].includes(command)){
      const reviewCalls=Number(option('review-calls','0'));
      const transcriptionCalls=Number(option('transcription-calls','0'));
      const perceptionTools={...createGeminiReviewTools({secretsPath,receiptDirectory:join(runDir,'gemini-reviews'),maxCalls:reviewCalls}),...createCartesiaTranscriptionTool({secretsPath,receiptDirectory:join(runDir,'cartesia-transcriptions'),maxCalls:transcriptionCalls})};
      const host=new CodexHost({cwd:join(runDir,'host-workspace'),perceptionTools,perceptionProfile:{media:GEMINI_REVIEW_PROFILE,transcription:CARTESIA_STT_PROFILE},onProgress:({worker,item})=>process.stderr.write(`${worker}: ${item}\n`)});
      try{
        if(['crew-start','crew-refresh'].includes(command)){
          const message=option('message'),model=option('model',DEFAULT_WORKER_MODEL);
          if(!message||command==='crew-start'&&status.project.crew||command==='crew-refresh'&&!status.project.crew)throw new Error('crew-start requires an unconfigured run; crew-refresh requires existing bindings. Supply --message with the actual human instruction.');
          if(status.project.jobs.some(j=>['submitting','submitted','uncertain'].includes(j.status)))throw new Error('Reconcile outstanding jobs before changing crew.');
          await host.initialize();const crew=command==='crew-refresh'?await host.refreshCrew(status.project.crew):await host.startCrew(model);
          print(presentation(await workflow.respond('project',{taskId:status.pending.taskId,actor:'human',action:'configure-crew',message,crew})));return;
        }
        if(!status.project.crew)throw new Error('CREW_NOT_CONFIGURED: use crew-start before local Codex dispatch.');
        const maxTasks=command==='work-codex'?1:Number(option('max-tasks','8')),repair=option('repair-invalid','false');
        if(!['true','false'].includes(repair))throw new Error('--repair-invalid needs true or false.');
        await host.initialize();
        const result=await driveCrew(workflow,'project',host,{maxTasks,repairInvalid:repair==='true',receiptDirectory:join(runDir,'host-dispatch'),verifySubmission,onProgress:({step,gate})=>process.stderr.write(`${step}: ${gate}\n`)});
        print({completed:result.completed,stop:result.stop,...presentation(result.status)});return;
      }finally{host.close();}
    }
    if(['qualify-audio','qualify-visual','generate','collect','render','preview','finalize'].includes(command)&&!status.project.crew)throw new Error('CREW_NOT_CONFIGURED: bind actual host workers using configure-crew; old approvals never supply capabilities.');
    if(command==='qualify-audio'){
      const dataset=await json(option('dataset')),predictions=await json(option('predictions')),worker=option('worker'),model=option('model'),capability=option('capability');
      if(!worker||!model||!capability||args.length)throw new Error('Specify --dataset, --predictions, --worker, --model and --capability.');
      const computed=await qualifyAudio(dataset,predictions,worker,model,capability);print(computed);requireAudioQualification(computed);
      const path=join(runDir,'evaluation','audio-'+digest({dataset:computed.datasetDigest,predictions:computed.predictionDigest,worker,model,capability}));await mkdir(path,{recursive:true});const report={...computed,evidenceDirectory:path};
      for(const [name,value]of Object.entries({dataset,predictions,report}))await writeFile(join(path,`${name}.json`),JSON.stringify(value,null,2)+'\n',{mode:0o600});
      await verifyFiles(report);print(presentation(await workflow.respond('project',{taskId:status.pending.taskId,action:'audio-qualified',actor:'runtime',content:report})));return;
    }
    if(command==='qualify-visual'){
      const dataset=await json(option('dataset')),predictions=await json(option('predictions')),worker=option('worker'),model=option('model'),capability=option('capability');
      if(!worker||!model||!capability||args.length)throw new Error('Specify --dataset, --predictions, --worker, --model and --capability.');
      const computed=await qualifyVisual(dataset,predictions,worker,model,capability);print(computed);requireVisualQualification(computed,'image');requireVisualQualification(computed,'video');
      const path=join(runDir,'evaluation',digest({dataset:computed.datasetDigest,predictions:computed.predictionDigest,worker,model,capability}));await mkdir(path,{recursive:true});const report={...computed,evidenceDirectory:path};
      for(const [name,value] of Object.entries({dataset,predictions,report}))await writeFile(join(path,`${name}.json`),JSON.stringify(value,null,2)+'\n',{mode:0o600});
      await verifyFiles(report);
      const result=await workflow.respond('project',{taskId:status.pending.taskId,action:'qualified',actor:'runtime',content:report});
      print(presentation(result));return;
    }
    if(command==='preview'){
      const p=status.project;if(!locked(p,'editPlan')||!['film','complete'].includes(p.step))throw new Error('Preview requires the approved edit and current film stage.');
      assertAllowed(p,'film');await verifyFiles(p.artifacts.filter(a=>a.valid));const manifest=assemblyManifest(p);if(current(p,'film')&&current(p,'film').content.manifestDigest!==digest(manifest))throw new Error('STALE_FILM: renderer or assets changed; reopen film review before preview.');
      const prepared=await prepareComposition(manifest,join(runDir,'assembly',digest(manifest)));const {url}=await servePreview(prepared);print({url,manifestDigest:digest(manifest),approvesNothing:true,providerCalls:0});return;
    }
    if(command==='render'){
      const content=await renderFilm(status.project,runDir);print(presentation(await workflow.respond('project',{taskId:status.pending.taskId,actor:'runtime',action:'rendered',content})));return;
    }
    if(command==='finalize'){
      const p=status.project,film=current(p,'film');if(p.step!=='complete'||!locked(p,'film'))throw new Error('FINALIZATION_BLOCKED: final film must pass agent and human review first.');
      assertAllowed(p,'film');await verifyRenderer();await verifyFiles(p.artifacts.filter(a=>a.valid));
      if(film.content.manifestDigest!==digest(assemblyManifest(p))||film.content.editPlanDigest!==current(p,'editPlan').digest)throw new Error('STALE_FILM: current assets differ from approved film.');
      const inspection=await inspectFilm(film.content.files[0]);assertFilmInspection(inspection);
      const result={formatVersion:VERSION,projectId:p.id,film:film.content.files[0],artifactId:film.id,artifactDigest:film.digest,approvedBy:film.approvedBy,review:film.review,inspection,manifest:assemblyManifest(p),provenance:film.content.provenance,published:false};
      const path=join(runDir,'finalized.json');await writeFile(path,JSON.stringify(result,null,2)+'\n',{mode:0o600});print({path,film:result.film.path,published:false});return;
    }
    if(command==='present'){print(await presentDeliverable(status));return;}
    if (command === 'status' || command === 'inspect') { print({...presentation(status),...(command==='inspect'&&current(status.project,'film')?{filmMeasurements:await inspectFilm(current(status.project,'film').content.files[0])}:{})}); return; }
    if (command === 'impact') { print(revisionImpact(status.project, args[0])); return; }
    if (command === 'validate') { for (const a of status.project.artifacts.filter(a => a.valid)) await verifyFiles(a.content); print({ valid: true, pending: status.pending.step, sequence: status.project.sequence }); return; }
    if (command === 'measure') { const a = status.project.artifacts.findLast(a => a.key === args[0] && a.valid); if (!a?.content.files) throw new Error('Specify an existing audio artifact key, e.g. narration or audition.'); print(await Promise.all(a.content.files.map(measureAudio))); return; }
    if (command === 'respond') {
      const event = await json(args[0]);
      if (event.actor === 'runtime') throw new Error('Runtime events are reserved for the provider collector.');
      if (status.pending.step === 'sheetPrompt' && event.action === 'artifact') { const recipe = (await import('./runtime/media.mjs')).sha(await readFile(join(root, 'character-sheet-recipe.md'))); if (event.content?.recipeSha256 !== recipe) throw new Error('Sheet prompt must use the packaged recipe hash; run recipe.'); }
      if(!status.project.crew&&['agent','reviewer'].includes(event.actor)&&event.action!=='note')throw new Error('CREW_NOT_CONFIGURED: run crew-template, bind actual host IDs/model/tools and submit human configure-crew.');
      await verifySubmission(status,event);
      print(presentation(await workflow.respond('project', event))); return;
    }
    if (command === 'work') {
      if (!['author', 'owner-review', 'review', 'produce'].includes(status.pending.gate)) { print(presentation(status)); return; }
      const modulePath = args[0];
      const task = modulePath ? status.pending : await prepareCrewTask(status.project,status.pending);
      if (!modulePath) { print({ task, responseSchema: z.toJSONSchema(Event), contentSchema: Content[status.pending.step] ? z.toJSONSchema(Content[status.pending.step]) : null,
        instruction: 'The operating host agent must perform this task, write an event JSON, then call respond. A trusted host integration exporting runTask(task, {worker, callTool}) may automate it after configure-crew; supply actual perception tools and inherit the current host model. The format broker checks every tool call; the host must restrict any ambient tools separately.' }); return; }
      const worker = await import(pathToFileURL(resolve(modulePath)).href);
      if (typeof worker.runTask !== 'function') throw new Error('Worker module must export runTask(task).');
      const event = await runCrewTask(status.project,task,worker);
      if (event.actor !== status.pending.actor || !['artifact', 'owner-review', 'review', 'plan'].includes(event.action)) throw new Error('Worker may only author, review or plan; it cannot approve for the user or call providers through the format tools.');
      if (status.pending.step === 'sheetPrompt' && event.action === 'artifact') { const recipe = (await import('./runtime/media.mjs')).sha(await readFile(join(root, 'character-sheet-recipe.md'))); if (event.content?.recipeSha256 !== recipe) throw new Error('Sheet prompt must use the packaged recipe hash; run recipe.'); }
      await verifySubmission(status,event);
      print(presentation(await workflow.respond('project', event))); return;
    }
    if (command === 'generate' || command === 'collect') {
      const { project, pending } = status; const job = pending.job;
      if (pending.gate !== 'collect' || !job) throw new Error('Only a current authorized generation request can be executed/collected.');
      await verifyFiles(project.artifacts.filter(a=>a.valid));
      const runtimeEvent = async (action,extra={})=>{
        const latest=await workflow.status('project');return workflow.respond('project',{taskId:latest.pending.taskId,actor:'runtime',jobId:job.id,artifactDigest:job.digest,action,...extra});
      };
      const onJobId=async providerJobId=>{
        const latest=(await workflow.status('project')).project.jobs.find(j=>j.id===job.id);
        if(latest.providerJobId&&latest.providerJobId!==providerJobId)throw new Error('Provider job ID changed; stop and reconcile.');
        if(!latest.providerJobId)await runtimeEvent('job-id',{providerJobId});
      };
      const receiptPath=join(runDir,'receipts',job.id,'result.json');
      try {const result=await json(receiptPath);await verifyFiles(result);print(presentation(await runtimeEvent('receipt',{result})));return;}
      catch(e){if(e.code!=='ENOENT')throw e;}
      if(command==='generate'&&job.status!=='authorized'){
        if(['submitting','submitted'].includes(job.status))await runtimeEvent('provider-error',{message:'Process ended after submission began. Outcome unknown; reconcile existing request.'});
        throw new Error('ALREADY_SUBMITTED: use collect/reconciliation; never resubmit.');
      }
      if(command==='collect'&&job.status==='authorized')throw new Error('NOT_SUBMITTED: collection cannot start a paid request.');
      await verifyFiles(job.request);
      let key='';
      if(command==='generate'||job.plan.provider==='replicate'){
        try{key=await loadKey(job.plan.provider,secretsPath);}catch(e){throw new Error(`${e.message}\n${remediation(job.plan.provider,secretsPath)}`);}
      }
      if(command==='generate')await runtimeEvent('begin');
      try{
        const latest=(await workflow.status('project')).project;
        const result=await executeJob(latest,latest.jobs.find(j=>j.id===job.id),runDir,key,command==='collect'&&job.plan.provider!=='replicate'?()=>{throw new Error('Collection cannot resubmit synchronous providers.');}:fetch,command==='collect',onJobId);
        if(result.pending){print({...presentation(await workflow.status('project')),collection:result});return;}
        await verifyFiles(result);print(presentation(await runtimeEvent('receipt',{result})));
      }catch(e){
        const diagnostic=key?e.message.replaceAll(key,'[redacted]'):e.message;
        await runtimeEvent('provider-error',{message:diagnostic});throw new Error(`${diagnostic}\n${remediation(job.plan.provider,secretsPath)}`);
      }return;
    }
    throw new Error('Use check, check-provider, schema, init, status, present, work, respond, import, measure, validate, impact, generate, collect, crew-template, crew-start, crew-refresh, work-codex, drive-codex, audio-tasks, qualify-audio, visual-tasks, qualify-visual, preview, render or finalize. See SKILL.md.');
  } finally { workflow.close(); await release(); }
}
main().catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
