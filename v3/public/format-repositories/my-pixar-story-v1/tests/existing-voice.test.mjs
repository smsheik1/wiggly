import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {initialProject,taskFor,current,openWorkflow} from '../runtime/workflow.mjs';
import {Project,digest} from '../runtime/contracts.mjs';
import {lookupExistingVoice,requestDescriptor} from '../runtime/providers.mjs';
import {producerUpdate} from '../runtime/presentation.mjs';
import {prepareCrewTask} from '../runtime/crew.mjs';
import {inputs,script,file,send,event,reviewed,approved,captureEvents} from './helpers.mjs';

// Synthetic identities/media and mocked HTTP only. Never a production voice-quality proof.
const choice={voiceId:'00000000-0000-4000-8000-000000000001',name:'ISOLATED existing storyteller',consentMessage:'ISOLATED own-voice consent'};
const lookup={...choice,language:'en',isOwner:true,status:'active',access:'public',apiVersion:'2026-08-14',checkedAt:'2026-10-04T00:00:00Z',endpoint:`https://api.cartesia.ai/voices/${choice.voiceId}`,httpStatus:200};delete lookup.consentMessage;
const sample={files:[file()],consent:true,language:'en'};
function start(){let p=initialProject('project',inputs);p=approved(reviewed(send(p,'artifact',{workerId:'writer',content:{inputs:p.inputs,sourceInputDigest:digest(p.inputs),commonSenseChecks:[]}})));p=approved(reviewed(send(p,'artifact',{workerId:'writer',content:{...script,commonSenseChecks:[],proposedCast:[{id:'alex',name:'Alex',ageVariant:'adult',minor:false,storyPurpose:'ISOLATED memories'}]}})));return p;}
const choose=p=>send(p,'choose-voice',{actor:'human',message:'ISOLATED use my existing voice',content:choice});
const verify=p=>send(p,'voice-verified',{actor:'runtime',content:lookup});
const upload=p=>send(p,'artifact',{actor:'human',workerId:'ISOLATED-human',content:sample});
const plan={provider:'cartesia',operation:'clone',estimatedCostUsd:.05,parameters:{}};

test('existing voice selection and authenticated lookup preserve the locked script and wait for a real reference, without spend or approval',()=>{
 let p=start();const locked=JSON.stringify(current(p,'script')),snapshot=p.studio.sha256;
 p=send(p,'configure-debug',{actor:'human',message:'ISOLATED debug',debugEnabled:true});p=verify(choose(p));
 assert.equal(p.step,'voiceSample');assert.equal(p.gate,'human');assert.equal(p.debug.paused,true);
 assert.equal(JSON.stringify(current(p,'script')),locked);assert.equal(p.studio.sha256,snapshot);assert.equal(p.jobs.length,0);assert.equal(p.budget.maxCostUsd,0);assert.equal(current(p,'clone'),undefined);
 const status={project:p,pending:taskFor(p)},u=producerUpdate(status,'/isolated-test/run');
 assert.equal(u.voiceChoice.verified,true);assert.equal(u.voiceChoice.access,'public');assert.match(u.message,/owned by your account/);assert.match(u.message,/original cloning recording/);assert.match(u.message,/hear a short sample before approving the voice/);assert.equal(u.nextWorker,null);
});

test('reference submission binds the exact existing voice and lookup provenance then reaches audition planning, still debug-paused',()=>{
 let p=verify(choose(start()));p=send(p,'configure-debug',{actor:'human',message:'ISOLATED debug',debugEnabled:true});p=upload(p);
 const clone=current(p,'clone');assert.equal(p.step,'audition');assert.equal(p.gate,'produce');assert.equal(p.debug.paused,true);assert.equal(p.jobs.length,0);
 assert.equal(clone.content.voiceId,choice.voiceId);assert.equal(clone.content.receiptId,`voice-lookup:${digest(lookup)}`);assert.deepEqual(clone.content.origin.lookup,lookup);
 assert.deepEqual(clone.dependencies,[current(p,'voiceSample').id]);assert.equal(clone.approvedBy,undefined);assert.equal(current(p,'audition'),undefined);
 const completion=producerUpdate({project:p,pending:taskFor(p)}).completion;
 assert.equal(completion.artifactId,current(p,'voiceSample').id);assert.equal(completion.artifactDigest,current(p,'voiceSample').digest);assert.equal(completion.actor,'human');assert.equal(completion.worker,null);assert.equal(clone.authoredBy,'provider-runtime');
 const audition=requestDescriptor(p,{...plan,operation:'audition'});assert.equal(audition.voice,choice.voiceId);assert.equal(audition.transcripts[0],current(p,'script').content.beats[0].narration);
 assert.throws(()=>send(p,'plan',{plan:{...plan,operation:'audition'}}),/DEBUG_PAUSED/);
});

test('unverified selection blocks replacement cloning and can recover through metadata verification only',()=>{
 let p=upload(choose(start()));assert.equal(p.step,'clone');assert.equal(p.gate,'escalate');assert.equal(current(p,'clone'),undefined);
 assert.match(producerUpdate({project:p,pending:taskFor(p)}).message,/verify-voice/);
 assert.throws(()=>send(p,'plan',{plan}),/planning is not allowed|EXISTING_VOICE_SELECTED/);assert.throws(()=>requestDescriptor(p,plan),/EXISTING_VOICE_SELECTED/);
 p=verify(p);assert.equal(p.step,'audition');assert.equal(p.jobs.length,0);
});

test('a fresh verification attempt clears prior success durably so failed rechecks cannot reuse stale ownership proof',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-recheck-'));let w=openWorkflow(join(dir,'checkpoints.sqlite'));try{
 let s=await w.init('project',inputs);for(const e of captureEvents(()=>verify(choose(start()))).events)s=await w.respond('project',e);
 assert.equal(s.project.voiceChoice.lookup.isOwner,true);
 const oldCheckpoint=s.checkpointId;w.close();w=null;
 const mock=join(dir,'mock-http.mjs'),secrets=join(dir,'secrets.env'),runner=fileURLToPath(new URL('../runner.mjs',import.meta.url));
 await writeFile(secrets,'CARTESIA_API_KEY=ISOLATED-FAKE-KEY\n');await writeFile(mock,"globalThis.fetch=async(url,options)=>{if(options.method!=='GET')throw new Error('Forbidden generation');return new Response('ISOLATED failed recheck',{status:403});};");
 assert.throws(()=>execFileSync(process.execPath,['--import',mock,runner,'verify-voice','--secrets',secrets,'--run',dir],{encoding:'utf8',stdio:'pipe'}),/HTTP 403/);
 w=openWorkflow(join(dir,'checkpoints.sqlite'));s=await w.status('project');assert.notEqual(s.checkpointId,oldCheckpoint);assert.equal(s.project.voiceChoice.lookup,undefined);
 assert.equal(producerUpdate(s).voiceChoice.verified,false);assert.match(producerUpdate(s).message,/verification is still required/);
 s=await w.respond('project',event(s.project,'artifact',{actor:'human',workerId:'ISOLATED-human',content:sample}));assert.equal(s.project.gate,'escalate');assert.equal(current(s.project,'clone'),undefined);assert.equal(s.project.jobs.length,0);
 s=await w.respond('project',event(s.project,'voice-verified',{actor:'runtime',content:lookup}));assert.equal(s.project.step,'audition');assert.equal(s.project.jobs.length,0);
 }finally{w?.close();await rm(dir,{recursive:true});}
});

test('only a human with consent may choose, only trusted runtime may verify, and exact metadata must bind the choice',()=>{
 const p=start();assert.throws(()=>send(p,'choose-voice',{actor:'agent',content:choice,message:'ISOLATED'}),/actor|Actor|human/);
 assert.throws(()=>send(p,'choose-voice',{actor:'human',content:{...choice,consentMessage:''},message:'ISOLATED'}));
 assert.throws(()=>send(p,'voice-verified',{actor:'runtime',content:lookup}),/EXISTING_VOICE_MISMATCH/);
 const selected=choose(p);assert.throws(()=>send(selected,'voice-verified',{actor:'human',content:lookup}),/actor|Actor|runtime/);
 for(const delta of [{voiceId:'00000000-0000-4000-8000-000000000002'},{name:'different'},{apiVersion:'different'},{endpoint:'https://example.com/voice'},{isOwner:false},{status:'archived'}])assert.throws(()=>send(selected,'voice-verified',{actor:'runtime',content:{...lookup,...delta}}));
 assert.throws(()=>send(initialProject('ISOLATED-too-early',inputs),'choose-voice',{actor:'human',message:'ISOLATED',content:choice}),/EXISTING_VOICE_LOCKED/);
 assert.throws(()=>choose(upload(verify(selected))),/EXISTING_VOICE_LOCKED/);
});

test('default cloning remains unchanged and historical clone bytes acquire no invented lookup provenance',()=>{
 const p=upload(start());assert.equal(p.step,'clone');assert.equal(p.gate,'produce');assert.equal(p.voiceChoice,undefined);assert.match(requestDescriptor(p,plan).endpoint,/voices\/clone$/);
 const legacy={provider:'cartesia',voiceId:'legacy-clone',receiptId:'legacy-receipt'};
 const historical=Project.parse({...p,artifacts:[...p.artifacts,{id:'legacy-clone@1',key:'clone',kind:'clone',version:1,valid:true,digest:digest(legacy),content:legacy,dependencies:[current(p,'voiceSample').id],authoredBy:'provider-runtime'}]});
 assert.deepEqual(current(historical,'clone').content,legacy);
 assert.throws(()=>send(start(),'artifact',{actor:'human',workerId:'ISOLATED-human',content:{...sample,consent:false}}));
});

test('worker task packets must retain the selected voice exactly',async()=>{
 const p=upload(verify(choose(start()))),task=taskFor(p);assert.deepEqual(task.voiceChoice,p.voiceChoice);
 await assert.rejects(prepareCrewTask(p,{...task,voiceChoice:null}),/TASK_INPUT_MISMATCH: voiceChoice/);
 const prepared=await prepareCrewTask(p,task);assert.equal(prepared.voiceChoice.voiceId,choice.voiceId);
});

test('authenticated GET keeps visibility and whitelisted provenance without raw response fields or key leakage',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-voice-get-'));try{
 const path=join(dir,'secrets.env');await writeFile(path,'CARTESIA_API_KEY=ISOLATED-FAKE-KEY\n');let calls=0;
 const result=await lookupExistingVoice(choose(start()),path,async(url,options)=>{calls++;assert.equal(url,lookup.endpoint);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);assert.equal(options.headers.Authorization,'Bearer ISOLATED-FAKE-KEY');assert.equal(options.headers['Cartesia-Version'],lookup.apiVersion);return Response.json({id:choice.voiceId,name:choice.name,language:'en',is_owner:true,status:'active',access:'public',user_id:'ISOLATED-secret-metadata'});});
 assert.equal(calls,1);assert.equal(result.access,'public');assert.equal(result.httpStatus,200);assert.doesNotMatch(JSON.stringify(result),/ISOLATED-FAKE-KEY|user_id|secret-metadata/);
 }finally{await rm(dir,{recursive:true});}
});

test('failed or mismatched GET stops once with canonical remediation and never falls back to a new clone',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-voice-failure-'));try{
 const path=join(dir,'secrets.env');await writeFile(path,'CARTESIA_API_KEY=ISOLATED-FAKE-KEY\n');
 for(const reply of [()=>new Response('ISOLATED body must not leak',{status:403}),()=>Response.json({id:choice.voiceId,name:choice.name,language:'en',is_owner:false,status:'active',access:'public'}),()=>Response.json({id:choice.voiceId,name:choice.name,language:'en',is_owner:true,status:'archived',access:'private'})]){
 let calls=0;await assert.rejects(lookupExistingVoice(choose(start()),path,async()=>{calls++;return reply();}),e=>{assert.match(e.message,/HTTP 403|owned by this account/);assert.match(e.message,/CARTESIA_API_KEY/);assert.ok(e.message.includes(path));assert.doesNotMatch(e.message,/ISOLATED body|ISOLATED-FAKE-KEY/);return true;});assert.equal(calls,1);
 }
 }finally{await rm(dir,{recursive:true});}
});

test('SQLite restart preserves the verified choice and raw CLI events cannot fabricate runtime verification',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-existing-sqlite-'));let w=openWorkflow(join(dir,'checkpoints.sqlite'));try{
 let s=await w.init('project',inputs);
 // Use captured isolated event sequence rather than altering any checkpoint rows.
 const captured=captureEvents(()=>verify(choose(start())));
 for(const e of captured.events)s=await w.respond('project',e);
 const checkpoint=s.checkpointId,lockedDigest=current(s.project,'script').digest;w.close();w=null;
 w=openWorkflow(join(dir,'checkpoints.sqlite'));s=await w.status('project');assert.equal(s.checkpointId,checkpoint);assert.equal(s.project.voiceChoice.lookup.voiceId,choice.voiceId);assert.equal(current(s.project,'script').digest,lockedDigest);w.close();w=null;
 const path=join(dir,'forged.json');await writeFile(path,JSON.stringify(event(s.project,'voice-verified',{actor:'runtime',content:lookup})));
 const runner=fileURLToPath(new URL('../runner.mjs',import.meta.url));assert.throws(()=>execFileSync(process.execPath,[runner,'respond',path,'--run',dir],{encoding:'utf8',stdio:'pipe'}),/runtime|Runtime|RUNTIME/);
 }finally{w?.close();await rm(dir,{recursive:true});}
});
