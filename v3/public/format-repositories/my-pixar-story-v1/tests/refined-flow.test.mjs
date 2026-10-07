// Isolated protocol and synthetic tone tests only. No media provider/model calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {initialProject,taskFor,current,assertAllowed,revisionImpact,characterPromptRecipeSha256} from '../runtime/workflow.mjs';
import {Project,digest} from '../runtime/contracts.mjs';
import {importMedia,narrationWindow,measureAudio} from '../runtime/media.mjs';
import {requestDescriptor,executeJob} from '../runtime/providers.mjs';
import {inputs,script,send,authored,reviewed,approved,answersLocked,questionnaire,intakeFixture,produce} from './helpers.mjs';
import {confirmed,supervisedAudio,supervisedCharacters} from './supervised-helpers.mjs';
import {image,author} from './background-helpers.mjs';
const promptFor=p=>{const c=current(p,'roster').content.characters.find(c=>c.id===p.characterId);return {prompt:'Exact full-body character design',characterDigest:digest(c),referenceHashes:c.references.map(f=>f.sha256),recipeSha256:characterPromptRecipeSha256};};
function promptReady(){let p=confirmed(supervisedAudio());return approved(reviewed(author(p,{characters:[{id:'alex',name:'Alex',ageVariant:'adult',important:true,references:[image(1)],notes:'ISOLATED'}]},'cast-owner')));}

test('answers require source binding, independent questionnaire review and exact human lock before script; historical state stays revision 2',()=>{
 const p=initialProject('new',inputs,{workflowRevision:3});assert.equal(p.step,'answers');assert.equal(p.workflowRevision,3);
 assert.equal(taskFor(p).formatRole,'script-writer');assert.equal(taskFor(p).questionnaire.questions.length,5);assert.deepEqual(taskFor(p).sourceInputs,inputs);
 assert.throws(()=>assertAllowed(p,'script'),/ANSWERS_LOCK_REQUIRED/);
 assert.throws(()=>authored(p));
 assert.throws(()=>send(p,'artifact',{workerId:'intake',content:{...questionnaire(p),sourceInputDigest:'wrong'}}),/ANSWER_SOURCE_MISMATCH/);
 let q=send(p,'artifact',{workerId:'intake',content:questionnaire(p)}),a=current(q);
 assert.equal(taskFor(q).formatRole,'text-reviewer');
 assert.throws(()=>send(q,'review',{workerId:'intake',artifactId:a.id,artifactDigest:a.digest,review:{decision:'approved',perception:'direct-text',checks:[]}}));
 q=reviewed(q);assert.equal(q.gate,'human');assert.throws(()=>assertAllowed(q,'script'),/ANSWERS_LOCK_REQUIRED/);
 assert.throws(()=>send(q,'approve',{artifactId:a.id,artifactDigest:'stale',message:'ISOLATED',intakeConfirmation:intakeFixture(q)}),/exact current/);
 q=approved(q);assert.equal(q.step,'script');assert.equal(taskFor(q).lockedAnswers.id,'answers@1');
 assert.deepEqual(taskFor(q).dependencies.map(a=>a.key),['answers']);
 const legacy=initialProject('legacy',inputs,{workflowRevision:2});delete legacy.workflowRevision;const loaded=Project.parse(legacy);assert.equal(loaded.step,'script');assert.equal(loaded.workflowRevision,2);assert.equal(taskFor(loaded).lockedAnswers,null);
});

test('answer clarification needs human feedback; confirmed rewinds invalidate downstream work and preserve independent clone',()=>{
 let p=initialProject('clarify',inputs,{workflowRevision:3});const changed=structuredClone(questionnaire(p));changed.inputs.subject.recipientName='Different recipient';
 assert.throws(()=>send(p,'artifact',{workerId:'intake',content:changed}),/ANSWER_CLARIFICATION_REQUIRED/);
 p=reviewed(send(p,'artifact',{workerId:'intake',content:questionnaire(p)}),'rejected');
 assert.throws(()=>send(p,'artifact',{workerId:'intake',content:changed}),/ANSWER_CLARIFICATION_REQUIRED/);
 const a=current(p);p=send(p,'changes',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED actual human corrected the recipient name'});
 p=approved(reviewed(send(p,'artifact',{workerId:'intake',content:changed})));
 const switched=structuredClone(questionnaire(p));switched.inputs.subject.fullName='Different storyteller';let fresh=initialProject('identity',inputs,{workflowRevision:3});assert.throws(()=>send(fresh,'artifact',{workerId:'intake',content:switched}),/STORYTELLER_CHANGE_REQUIRES_NEW_PROJECT/);
 assert.equal(taskFor(p).inputs.subject.recipientName,'Different recipient');assert.equal(p.inputs.subject.recipientName,inputs.subject.recipientName);
 const all=supervisedCharacters(),answer=current(all,'answers'),impact=revisionImpact(all,answer.id);
 for(const key of ['script','audition','narration','roster','characterPrompt:alex','candidates:alex','sheetPrompt:alex','sheet:alex'])assert.ok(impact.affected.includes(current(all,key).id),key);
 assert.ok(impact.remainValid.includes(current(all,'clone').id));
 assert.throws(()=>send(all,'changes',{artifactId:answer.id,artifactDigest:answer.digest,message:'ISOLATED'}),/IMPACT_CONFIRMATION/);
 const revised=send(all,'changes',{artifactId:answer.id,artifactDigest:answer.digest,impactDigest:impact.impactDigest,message:'ISOLATED confirmed all dependent work'});
 assert.equal(revised.step,'answers');assert.equal(current(revised,'narration'),undefined);assert.ok(current(revised,'clone'));
});

test('script approval reuses confirmed intake but requires resolution for newly introduced findings and cannot swap locked age/photos',()=>{
 let p=reviewed(authored(answersLocked(initialProject('script',inputs,{workflowRevision:3}))));let a=current(p);
 p=send(p,'approve',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED approve exact script'});assert.equal(p.step,'voiceSample');
 let q=answersLocked(initialProject('new-finding',inputs,{workflowRevision:3}));const extra={category:'action',finding:'Bicycle ride needs safe blocking',resolution:'Ask human'};
 q=reviewed(send(q,'artifact',{workerId:'writer',content:{...script,commonSenseChecks:[...script.commonSenseChecks,extra]}}));a=current(q);
 assert.throws(()=>send(q,'approve',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED'}),/INTAKE_UNRESOLVED/);
 const intake=intakeFixture(q);const bad=structuredClone(intake);bad.characters[0].ageVariant='child';assert.throws(()=>approved(q,{intakeConfirmation:bad}),/ANSWERS_INVENTORY_LOCKED/);
 assert.equal(approved(q,{intakeConfirmation:intake}).step,'voiceSample');
});

test('Cleo prompt is bound/reviewed/human-approved before exactly three Muse reference candidates; defects return to prompt and repeated failures escalate',()=>{
 let p=promptReady();assert.equal(p.step,'characterPrompt');assert.equal(taskFor(p).formatRole,'cast-designer');assert.equal(taskFor(p).castEntry.ageVariant,'adult');
 assert.deepEqual(taskFor(p).inputPriority,['approvedScript','castEntry','castEntry.references','inputs.answers']);
 assert.throws(()=>assertAllowed(p,'candidates'),/CHARACTER_DESIGN_PROMPT_LOCK_REQUIRED/);
 const prompt=promptFor(p);for(const delta of [{characterDigest:'wrong'},{referenceHashes:[]},{recipeSha256:'wrong'}])assert.throws(()=>author(p,{...prompt,...delta},'cast-owner'),/CHARACTER_PROMPT_BINDING_REQUIRED/);
 p=reviewed(author(p,prompt,'cast-owner'));assert.equal(p.gate,'human');assert.throws(()=>assertAllowed(p,'candidates'),/CHARACTER_DESIGN_PROMPT_LOCK_REQUIRED/);
 p=approved(p);assert.equal(p.step,'candidates');
 const wrong={provider:'meta-muse',operation:'candidates',estimatedCostUsd:.03,parameters:{prompt:'Unapproved override'}};assert.throws(()=>send(p,'plan',{plan:wrong}),/approved character design prompt/);
 assert.throws(()=>send(p,'plan',{plan:{...wrong,provider:'replicate',parameters:{prompt:prompt.prompt}}}),/Provider/);
 const plan={...wrong,parameters:{prompt:prompt.prompt}},request=requestDescriptor(p,plan);assert.equal(request.n,3);assert.equal(request.model,'muse-image-1.0');assert.equal(request.endpoint,'https://api.meta.ai/v1/images/edits');assert.deepEqual(request.images,[image(1)]);
 p=reviewed(produce(p,{files:[1,2,3].map(image),prompt:prompt.prompt}),'rejected');assert.equal(p.step,'characterPrompt');assert.equal(p.gate,'author');assert.match(taskFor(p).feedback[0].message,/Restore the bicycle/);
 p=approved(reviewed(author(p,promptFor(p),'cast-owner')));p=reviewed(produce(p,{files:[1,2,3].map(image),prompt:current(p,'characterPrompt:alex').content.prompt}),'rejected');assert.equal(p.gate,'escalate');
});

test('15-second window appends exact digital silence without changing a single speech sample; overlong stem is untouched',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-window-'));
 try{
  const path=join(dir,'source.wav');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=731:duration=1','-ar','44100','-c:a','pcm_s16le',path]);
  const source=await importMedia(path,dir),window=await narrationWindow(source,dir,join(dir,'padded.wav'));
  assert.equal(window.file.durationSeconds,15);assert.equal(window.tailSilenceSeconds,14);
  const decode=f=>execFileSync('ffmpeg',['-v','error','-i',f.path,'-f','s16le','-acodec','pcm_s16le','-'],{maxBuffer:4*1024*1024});
  const before=decode(source),after=decode(window.file);assert.deepEqual(after.subarray(0,before.length),before);assert.ok(after.subarray(before.length).every(b=>b===0));
  const measured=await measureAudio(window.file);assert.ok(measured.silenceSeconds>=13.9);
  const long=join(dir,'long.wav');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=731:duration=16',long]);const over=await importMedia(long,dir);
  assert.deepEqual(await narrationWindow(over,dir,join(dir,'forbidden-trim.wav')),{file:over,tailSilenceSeconds:0});
 }finally{await rm(dir,{recursive:true});}
});

test('Cartesia adapter keeps four originals, pads only after four natural-speed calls, and recovers without duplicate calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-window-provider-'));
 try{
  const path=join(dir,'tone.wav');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=300:duration=1',path]);const bytes=await readFile(path);
  const p=supervisedAudio();p.workflowRevision=4;p.step='narration';p.gate='collect';const plan={provider:'cartesia',operation:'narration',estimatedCostUsd:.1,parameters:{}},request=requestDescriptor(p,plan),dependencies=[];assert.equal(request.beatWindowSeconds,15);
  const j={id:'isolated-window',key:'narration',plan,request,dependencies,digest:digest({plan,request,dependencies}),status:'submitting',authorization:{message:'ISOLATED HTTP mock',at:new Date().toISOString()}};p.jobs=[j];let calls=0;
  const result=await executeJob(p,j,dir,'ISOLATED',async(_url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(body.generation_config.speed,1);assert.equal(body.beatWindowSeconds,undefined);return new Response(bytes);});
  assert.equal(calls,4);assert.deepEqual(result.files.map(f=>f.durationSeconds),[15,15,15,15]);assert.deepEqual(result.sourceFiles.map(f=>f.durationSeconds),[1,1,1,1]);assert.deepEqual(result.tailSilenceSeconds,[14,14,14,14]);
  assert.deepEqual(await executeJob(p,j,dir,'',()=>{throw new Error('Network forbidden');},true),result);assert.equal(calls,4);
 }finally{await rm(dir,{recursive:true});}
});

test('native character prompt author and Sage reviewer must actually view every scoped photo before submitting',async()=>{
 const {crewRoles,runCrewTask}=await import('../runtime/crew.mjs');const {applyEvent}=await import('../runtime/workflow.mjs');
 const dir=await mkdtemp(join(tmpdir(),'memoir-prompt-photos-'));
 try{
  const path=join(dir,'reference.png');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=blue:size=32x32','-frames:v','1',path]);const photo=await importMedia(path,dir);
  let p=promptReady();current(p,'roster').content.characters[0].references=[photo];
  p.crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({role,name,workerId:`isolated-${role}`,modelVersion:'ISOLATED',capabilityVersion:'ISOLATED',execution:'host'}))};
  let task=taskFor(p),submission={taskId:task.taskId,action:'artifact',actor:'agent',workerId:task.crewWorker.workerId,content:promptFor(p)};
  await assert.rejects(runCrewTask(p,task,{runTask:async()=>submission}),/CHARACTER_REFERENCES_NOT_VIEWED/);
  const host={tools:{viewImage:async()=>({perception:'direct-image'})},runTask:async(_task,{callTool})=>{await callTool('viewImage',{sha256:photo.sha256});return submission;}};
  p=applyEvent(p,await runCrewTask(p,task,host));task=taskFor(p);assert.equal(task.formatRole,'text-reviewer');
  submission={taskId:task.taskId,action:'review',actor:'reviewer',workerId:task.crewWorker.workerId,artifactId:task.artifact.id,artifactDigest:task.artifact.digest,review:{decision:'approved',perception:'direct-text',modelVersion:'ISOLATED',capabilityVersion:'ISOLATED',checks:task.criteria.map(criterion=>({criterion,status:'pass',location:'ISOLATED',evidence:'ISOLATED reference inspection'}))}};
  await assert.rejects(runCrewTask(p,task,{runTask:async()=>submission}),/CHARACTER_REFERENCES_NOT_VIEWED/);
  const seen=await runCrewTask(p,task,host);assert.equal(seen.review.toolEvidence[0].sha256,photo.sha256);assert.equal(applyEvent(p,seen).gate,'human');
 }finally{await rm(dir,{recursive:true});}
});


test('resolving a planner pricing blocker preserves approved visual prompts and retry counters',async()=>{
 const {promptLocked}=await import('./shot-helpers.mjs'),{videoReady}=await import('./studio-helpers.mjs');
 const candidates=approved(reviewed(author(promptReady(),promptFor(promptReady()),'cast-owner')));
 for(let p of [candidates,promptLocked(),videoReady()]){
  const before=JSON.stringify(p.artifacts),jobs=JSON.stringify(p.jobs),budget=JSON.stringify(p.budget),step=p.step; p.reviewDisagreements=1;
  p=send(p,'planning-blocked',{actor:'agent',workerId:'planner',message:'ISOLATED exact account pricing unavailable; verify rate.',blocker:{kind:'account-readiness',...taskFor(p).planningGuide}});assert.equal(p.gate,'escalate');assert.equal(p.reviewDisagreements,1);
  p=send(p,'resolve',{actor:'human',message:'ISOLATED pricing verified for the exact request'});
  assert.equal(p.step,step);assert.equal(p.gate,'produce');assert.equal(JSON.stringify(p.artifacts),before);assert.equal(JSON.stringify(p.jobs),jobs);assert.equal(JSON.stringify(p.budget),budget);assert.equal(p.reviewDisagreements,1);
 }
});
