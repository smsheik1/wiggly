#!/usr/bin/env node
import {loadStudio,studioFor,limitsFor,communicationFor} from './runtime/instructions.mjs';
import {assertDebugReady,debugSnapshot} from './runtime/debug.mjs';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import { VERSION, Content, Event, Review, Plans, Inputs, IntakeConfirmation, VoiceChoiceInput, digest } from './runtime/contracts.mjs';
import { openWorkflow, revisionImpact } from './runtime/workflow.mjs';
import { importMedia, verifyFiles, measureAudio } from './runtime/media.mjs';
import { executeJob, loadKey, remediation, checkProvider,lookupExistingVoice,atomicJson } from './runtime/providers.mjs';
import { current, locked, assertAllowed } from './runtime/gates.mjs';
import { renderFilm, inspectFilm } from './runtime/assemble.mjs';
import {prepareComposition, servePreview, verifyRenderer} from './runtime/remotion.mjs';
import { assemblyManifest, assertFilmInspection } from './runtime/studio.mjs';
import {presentDeliverable,producerUpdate} from './runtime/presentation.mjs';
import {Crew,crewRoles,runCrewTask,prepareCrewTask} from './runtime/crew.mjs';
import {CodexHost,driveCrew} from './runtime/codex-host.mjs';
import {createGeminiReviewTools,GEMINI_REVIEW_PROFILE} from './runtime/gemini-review.mjs';
import {createCartesiaTranscriptionTool,CARTESIA_STT_PROFILE} from './runtime/cartesia-stt.mjs';
import {createAudioEditTools,AUDIO_EDIT_PROFILE} from './runtime/audio-edit.mjs';
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
  const visible = ['approved','provisional'].includes(pending.artifact?.review?.decision) || pending.gate === 'review' || pending.gate === 'author';
  return {producer:producerUpdate(status,runDir),debug:project.debug??{enabled:false,paused:false}, formatVersion: VERSION, checkpointId: status.checkpointId, sequence: project.sequence, communication:communicationFor(project),pending: { ...pending, artifact: visible ? pending.artifact : null },
    validArtifacts: project.artifacts.filter(a => a.valid).map(a => ({ id: a.id, digest: a.digest, kind: a.kind, approved: !!a.approvedBy })),
    jobs: project.jobs.map(j => ({ id: j.id, status: j.status, digest: j.digest, providerJobId: j.providerJobId })), allowances: project.allowances };
}
async function verifySubmission(status,event){
  await verifyFiles({content:event.content,intakeConfirmation:event.intakeConfirmation});
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
    const studio=loadStudio();
    print({studioVersion:studio.config.version,studioSha256:studio.sha256,instructionFiles:Object.keys(studio.documents),formatVersion: VERSION, node: process.version, tools, renderer:renderer.manifest.renderer, dependencies: 'LangGraph + SQLite loaded',
      requiredKeys: ['CARTESIA_API_KEY', 'META_API_KEY', 'REPLICATE_API_TOKEN (video stage)'], conditionalKeys:['GEMINI_API_KEY (shipped Codex media review)'], optionalKeys:['ELEVENLABS_API_KEY (generated music/effects; imports need no key)'], credentialsRead: false, productionStageLimit: 'supervised v1 through private finalization; every media lock needs human review and every video request needs exact human authorization; qualified policy remains available; real production proof not performed' });
    if (Object.values(tools).some(v => !v)) process.exitCode = 1; return;
  }
  if (command === 'schema') {
    const name = args[0]; const schema = name === 'crew' ? Crew : name === 'event' ? Event : name === 'review' ? Review : name === 'plan' ? Plans : name === 'inputs' ? Inputs : name==='intake-confirmation'?IntakeConfirmation:Content[name];
    if (!schema) throw new Error('schema needs event/review/plan/inputs or a supported artifact kind.'); print(z.toJSONSchema(schema)); return;
  }
  const release = await lock(); const workflow = openWorkflow(join(runDir, 'checkpoints.sqlite'));
  try {
    if (command === 'init') {
      const inputs = await json(args[0]); print(presentation(await workflow.init('project', inputs,{reviewMode:option('review-mode','supervised')}))); return;
    }
    if (command === 'import') { print(await importMedia(args[0], runDir)); return; }
    const status = await workflow.status('project');
    if(command==='reuse-voice'){const message=option('message');if(!message||args.length)throw new Error('reuse-voice needs the actual human instruction.');print(presentation(await workflow.respond('project',{taskId:status.pending.taskId,actor:'human',action:'reuse-voice',message})));return;}
    if(['use-voice','verify-voice'].includes(command)){
      let selected=status;
      if(command==='use-voice'){
        const voiceId=option('id'),name=option('name'),message=option('message'),consentMessage=option('consent-message');
        const content=VoiceChoiceInput.parse({voiceId,name,consentMessage,reuseWithoutSample:true});if(!message||args.length)throw new Error('use-voice needs the exact human selection and own-voice consent messages.');
        selected=await workflow.respond('project',{taskId:status.pending.taskId,actor:'human',action:'choose-voice',message,content});
      }else if(args.length||!status.project.voiceChoice)throw new Error('verify-voice requires the current human-selected voice.');
      const p=selected.project;
      if(!locked(p,'script')||!['voiceSample','clone'].includes(p.step)||p.jobs.length||current(p,'clone'))throw new Error('EXISTING_VOICE_LOCKED: no lookup/rebinding after provider work or clone binding.');
      selected=await workflow.respond('project',{taskId:selected.pending.taskId,actor:'runtime',action:'voice-verification-start'});
      const content=await lookupExistingVoice(selected.project,secretsPath),receiptId=`voice-lookup:${digest(content)}`;
      const directory=join(runDir,'voice-lookups');await mkdir(directory,{recursive:true,mode:0o700});const receiptPath=join(directory,digest(content)+'.json');await atomicJson(receiptPath,content);
      const result=await workflow.respond('project',{taskId:selected.pending.taskId,actor:'runtime',action:'voice-verified',content});
      print({...presentation(result),voiceLookup:{receiptId,receiptPath,method:'GET',generationPerformed:false}});return;
    }
    if(command==='input-folder'){
      const show=args.includes('--open');if(show)args.splice(args.indexOf('--open'),1);
      if(args.length||status.project.lifecycle==='abandoned'||status.pending.step!=='voiceSample'||status.pending.gate!=='human')throw new Error('INPUT_FOLDER_UNAVAILABLE: the current step must be waiting for your voice sample.');
      const producer=producerUpdate(status,runDir);if(!producer.inputRequest)throw new Error('INPUT_FOLDER_UNAVAILABLE: the existing-clone path requires verification, not a new recording.');const folder=producer.inputRequest.folder;
      await mkdir(folder,{recursive:true,mode:0o700});
      if(show){const result=spawnSync(process.platform==='darwin'?'open':process.platform==='win32'?'explorer.exe':'xdg-open',[folder],{encoding:'utf8'});if(result.error||result.status!==0)throw new Error(`INPUT_FOLDER_OPEN_FAILED: ${folder}: ${result.error?.message??result.stderr??result.status}`);}
      print({producer,folder,opened:show,providerCalls:0,projectStateMutated:false});return;
    }
    if(command==='debug'){
      const mode=args.shift(),message=option('message');
      if(!['on','off'].includes(mode)||!message||args.length)throw new Error('Use debug on|off --message "<actual human instruction>" --run /absolute/run.');
      print(presentation(await workflow.respond('project',{taskId:status.pending.taskId,actor:'human',action:'configure-debug',debugEnabled:mode==='on',message})));return;
    }
    if(command==='debug-next'){
      const message=option('message');if(!message||args.length)throw new Error('debug-next needs --message with the actual human instruction to continue one step.');
      print(presentation(await workflow.respond('project',{taskId:status.pending.taskId,actor:'human',action:'debug-next',message})));return;
    }
    if(command==='debug-inspect'){if(args.length)throw new Error('Unknown debug-inspect arguments.');print(await debugSnapshot(status,runDir));return;}
    if(['crew-start','crew-refresh','drive-codex','work-codex'].includes(command)){
      const reviewCalls=Number(option('review-calls','0'));
      const transcriptionCalls=Number(option('transcription-calls','0'));
      const reviewCost=Number(option('review-cost-usd','0')),transcriptionCost=Number(option('transcription-cost-usd','0'));
      let budgetQueue=Promise.resolve();
      const beforeRequest=async({provider,requestDigest,task})=>{if(status.project.reviewMode!=='supervised')return;const amount=provider==='gemini'?reviewCost:transcriptionCost;if(!Number.isFinite(amount)||amount<=0)throw new Error('ACCOUNT_ESTIMATE_REQUIRED: set positive --review-cost-usd / --transcription-cost-usd before paid inference.');budgetQueue=budgetQueue.then(async()=>{const latest=await workflow.status('project');if(latest.pending.taskId!==task.taskId)throw new Error('STALE_TASK: inference reservation belongs to an older task.');await workflow.respond('project',{taskId:task.taskId,actor:'runtime',action:'reserve-compute',reservation:{id:provider+':'+requestDigest,provider,estimatedCostUsd:amount}});});return budgetQueue;};
      const perceptionTools={...createGeminiReviewTools({secretsPath,receiptDirectory:join(runDir,'gemini-reviews'),maxCalls:reviewCalls,beforeRequest}),...createCartesiaTranscriptionTool({secretsPath,receiptDirectory:join(runDir,'cartesia-transcriptions'),maxCalls:transcriptionCalls,beforeRequest}),...createAudioEditTools({runDir})};
      // A four-file review includes twelve tool calls and a structured report.
      // Keep a bounded ten-minute window; timeout still stops without a retry.
      const host=new CodexHost({cwd:join(runDir,'host-workspace'),timeoutMs:600000,perceptionTools,perceptionProfile:{media:GEMINI_REVIEW_PROFILE,transcription:CARTESIA_STT_PROFILE,audioEditing:AUDIO_EDIT_PROFILE},onProgress:({worker,item})=>process.stderr.write(`${worker}: ${item}\n`)});
      try{
        if(['crew-start','crew-refresh'].includes(command)){
          const message=option('message'),model=option('model');
          if(!message||command==='crew-start'&&status.project.crew||command==='crew-refresh'&&!status.project.crew)throw new Error('crew-start requires an unconfigured run; crew-refresh requires existing bindings. Supply --message with the actual human instruction.');
          if(status.project.jobs.some(j=>['submitting','submitted','uncertain'].includes(j.status)))throw new Error('Reconcile outstanding jobs before changing crew.');
          await host.initialize();const crew=command==='crew-refresh'?await host.refreshCrew(status.project.crew):await host.startCrew(model,studioFor(status.project)?.config??loadStudio().config);
          print(presentation(await workflow.respond('project',{taskId:status.pending.taskId,actor:'human',action:'configure-crew',message,crew})));return;
        }
        if(!status.project.crew)throw new Error('CREW_NOT_CONFIGURED: use crew-start before local Codex dispatch.');
        const maxTasks=command==='work-codex'?1:Number(option('max-tasks',String(limitsFor(status.project).crewTasksPerDispatch))),repair=option('repair-invalid','false');
        if(!['true','false'].includes(repair))throw new Error('--repair-invalid needs true or false.');
        await host.initialize();
        const result=await driveCrew(workflow,'project',host,{maxTasks,repairInvalid:repair==='true',receiptDirectory:join(runDir,'host-dispatch'),verifySubmission,onProgress:progress=>process.stderr.write(progress.type==='repair-notice'?`DEFECT FOUND: ${progress.notice.key??progress.notice.artifactId}. ${progress.notice.findings?.map(f=>f.evidence).join(' ')??'See the localized repair notice in status.'} Repair routed through the current task.\n`:`${progress.step}: ${progress.gate}\n`)});
        print({completed:result.completed,stop:result.stop,...presentation(result.status)});return;
      }finally{host.close();}
    }
    if(['qualify-audio','qualify-visual','generate','collect','render','preview','finalize'].includes(command)&&!status.project.crew)throw new Error('CREW_NOT_CONFIGURED: bind actual host workers using configure-crew; old approvals never supply capabilities.');
    if(command==='qualify-audio'){
      assertDebugReady(status.project);
      const dataset=await json(option('dataset')),predictions=await json(option('predictions')),worker=option('worker'),model=option('model'),capability=option('capability');
      if(!worker||!model||!capability||args.length)throw new Error('Specify --dataset, --predictions, --worker, --model and --capability.');
      const computed=await qualifyAudio(dataset,predictions,worker,model,capability);print(computed);requireAudioQualification(computed);
      const path=join(runDir,'evaluation','audio-'+digest({dataset:computed.datasetDigest,predictions:computed.predictionDigest,worker,model,capability}));await mkdir(path,{recursive:true});const report={...computed,evidenceDirectory:path};
      for(const [name,value]of Object.entries({dataset,predictions,report}))await writeFile(join(path,`${name}.json`),JSON.stringify(value,null,2)+'\n',{mode:0o600});
      await verifyFiles(report);print(presentation(await workflow.respond('project',{taskId:status.pending.taskId,action:'audio-qualified',actor:'runtime',content:report})));return;
    }
    if(command==='qualify-visual'){
      assertDebugReady(status.project);
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
    if (command === 'validate') { for (const a of status.project.artifacts.filter(a => a.valid)) await verifyFiles(a); print({ valid: true, pending: status.pending.step, sequence: status.project.sequence }); return; }
    if (command === 'measure') { const a = status.project.artifacts.findLast(a => a.key === args[0] && a.valid); if (!a?.content.files) throw new Error('Specify an existing audio artifact key, e.g. narration or audition.'); print(await Promise.all(a.content.files.map(measureAudio))); return; }
    if (command === 'respond') {
      const event = await json(args[0]);
      if (event.actor === 'runtime') throw new Error('Runtime events are reserved for the provider collector.');
      if(!status.project.crew&&['agent','reviewer'].includes(event.actor)&&event.action!=='note')throw new Error('CREW_NOT_CONFIGURED: run crew-template, bind actual host IDs/model/tools and submit human configure-crew.');
      await verifySubmission(status,event);
      print(presentation(await workflow.respond('project', event))); return;
    }
    if (command === 'work') {
      if (!['author', 'owner-review', 'review', 'produce'].includes(status.pending.gate)) { print(presentation(status)); return; }
      const modulePath = args[0];
      const task = modulePath ? status.pending : await prepareCrewTask(status.project,status.pending);
      if (!modulePath) { print({communication:communicationFor(status.project), task, responseSchema: z.toJSONSchema(Event), contentSchema: Content[status.pending.step] ? z.toJSONSchema(Content[status.pending.step]) : null,
        instruction: 'The operating host agent must perform this task, write an event JSON, then call respond. A trusted host integration exporting runTask(task, {worker, callTool}) may automate it after configure-crew; supply actual perception tools and inherit the current host model. The format broker checks every tool call; the host must restrict any ambient tools separately.' }); return; }
      const worker = await import(pathToFileURL(resolve(modulePath)).href);
      if (typeof worker.runTask !== 'function') throw new Error('Worker module must export runTask(task).');
      const event = await runCrewTask(status.project,task,worker);
      if (event.actor !== status.pending.actor || !['artifact', 'owner-review', 'review', 'plan'].includes(event.action)) throw new Error('Worker may only author, review or plan; it cannot approve for the user or call providers through the format tools.');
      await verifySubmission(status,event);
      print(presentation(await workflow.respond('project', event))); return;
    }
    if (command === 'generate' || command === 'collect') {
      const { project, pending } = status; const job = pending.job;
      if (pending.gate !== 'collect' || !job) throw new Error('Only a current authorized generation request can be executed/collected.');
      if(command==='generate')assertDebugReady(project);
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
    throw new Error('Use check, check-provider, schema, init, status, present, work, respond, use-voice, verify-voice, reuse-voice, input-folder, import, measure, validate, impact, generate, collect, crew-template, crew-start, crew-refresh, work-codex, drive-codex, debug, debug-next, debug-inspect, audio-tasks, qualify-audio, visual-tasks, qualify-visual, preview, render or finalize. See SKILL.md.');
  } catch(error){
    const latest=await workflow.status('project').catch(()=>null);
    if(latest?.project.debug?.enabled&&!latest.project.debug.paused)await workflow.respond('project',{taskId:latest.pending.taskId,actor:'runtime',action:'debug-stop',message:'Command stopped: '+error.message});
    throw error;
  } finally { workflow.close(); await release(); }
}
main().catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
