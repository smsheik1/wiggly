import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {initialProject,current,taskFor,revisionImpact,openWorkflow} from '../runtime/workflow.mjs';
import {digest} from '../runtime/contracts.mjs';
import {voiceBasis,narrationLocked,assertAllowed} from '../runtime/gates.mjs';
import {requestDescriptor} from '../runtime/providers.mjs';
import {producerUpdate} from '../runtime/presentation.mjs';
import {prepareCrewTask,runCrewTask,crewRoles} from '../runtime/crew.mjs';
import {importMedia,sha} from '../runtime/media.mjs';
import {createCartesiaTranscriptionTool} from '../runtime/cartesia-stt.mjs';
import {inputs,script,send,event,approved,reviewed,file,produce,captureEvents,qualifyTestAudio} from './helpers.mjs';

// Isolated mechanics only: synthetic identities/audio, mocked provider/perception results.
const choice={voiceId:'00000000-0000-4000-8000-000000000002',name:'ISOLATED reused clone',consentMessage:'ISOLATED own-voice consent',reuseWithoutSample:true};
const lookup={voiceId:choice.voiceId,name:choice.name,language:'en',isOwner:true,status:'active',access:'private',apiVersion:'2026-08-14',checkedAt:'2026-10-04T00:00:00Z',endpoint:`https://api.cartesia.ai/voices/${choice.voiceId}`,httpStatus:200};
const draft={...script,commonSenseChecks:[],proposedCast:[{id:'alex',name:'Alex',ageVariant:'adult',minor:false,storyPurpose:'ISOLATED memories'}]};
function start(options={}){let p=initialProject('project',inputs,options);p=approved(reviewed(send(p,'artifact',{workerId:'writer',content:{inputs:p.inputs,sourceInputDigest:digest(p.inputs),commonSenseChecks:[]}})));return approved(reviewed(send(p,'artifact',{workerId:'writer',content:draft})));}
const choose=(p,content=choice)=>send(p,'choose-voice',{actor:'human',message:'ISOLATED reuse my existing clone',content});
const verify=p=>send(p,'voice-verified',{actor:'runtime',content:lookup});
const ready=()=>verify(choose(start()));
function audition(){let p=ready();p=send(p,'set-budget',{actor:'human',message:'ISOLATED ceiling',budgetLimitUsd:1});return produce(p,{files:[file(1)],voiceId:choice.voiceId,transcript:draft.beats[0].narration});}
function reviewEvent(p){const a=current(p);return event(p,'review',{workerId:'audio-reviewer',artifactId:a.id,artifactDigest:a.digest,review:{decision:'provisional',perception:'direct-audio',modelVersion:'ISOLATED-model',capabilityVersion:'ISOLATED-tools',coverage:{artifactSha256:a.content.files[0].sha256,audioFiles:a.content.files.map(f=>({sha256:f.sha256,seconds:f.durationSeconds}))},checks:taskFor(p).criteria.map(criterion=>({criterion,status:criterion==='voice-match'?'inconclusive':'pass',evidence:criterion==='voice-match'?'ISOLATED: no original recording; actual human must recognize their voice.':'ISOLATED mock check',location:'whole fixture',repair:''})),measurements:{identityBasis:'human-recognition',transcripts:a.content.transcript?[a.content.transcript]:a.content.transcripts,speechToTextMethod:'ISOLATED mock STT',speakingRateWpm:a.content.files.map(()=>80),silenceSeconds:a.content.files.map(()=>0),measurementNotes:'ISOLATED: no biometric comparison or production-quality claim.'}}});}
const passReview=p=>send(p,'review',{...reviewEvent(p)});
function humanApprove(p){const a=current(p);return approved(p,{humanReview:{decision:'approved',perception:'direct-audio',checks:taskFor(p).criteria.map(criterion=>({criterion,status:'pass',evidence:'ISOLATED actual human recognizes own voice and approves this fixture',location:'whole fixture',repair:''}))}});}

test('new clone requires a genuine sample; verified existing clone reaches audition with no recording, dummy artifact or generation job',()=>{
 const fresh=start();assert.equal(fresh.step,'voiceSample');assert.match(producerUpdate({project:fresh,pending:taskFor(fresh)}).message,/Record 20–30 seconds/);
 assert.throws(()=>send(fresh,'plan',{plan:{provider:'cartesia',operation:'clone',estimatedCostUsd:.05,parameters:{}}}),/not allowed/);
 let p=choose(fresh);assert.equal(producerUpdate({project:p,pending:taskFor(p)}).inputRequest,null);assert.match(producerUpdate({project:p,pending:taskFor(p)}).message,/No new recording/);
 p=verify(p);assert.equal(p.step,'audition');assert.equal(p.gate,'produce');assert.equal(current(p,'voiceSample'),undefined);assert.deepEqual(current(p,'clone').dependencies,[]);assert.equal(p.jobs.length,0);
 assert.deepEqual(voiceBasis(p),{kind:'existing-clone',language:'en',referenceSha256:null,voiceId:choice.voiceId});
 for(const operation of ['audition','narration']){const request=requestDescriptor(p,{provider:'cartesia',operation,estimatedCostUsd:.05,parameters:{}});assert.equal(request.language,'en');assert.equal(request.voice,choice.voiceId);assert.equal(request.generation_config.speed,1);assert.equal(request.transcripts.length,operation==='audition'?1:4);}
 assert.throws(()=>assertAllowed(p,'keyframe'),/NARRATION_LOCK_REQUIRED/);assert.equal(narrationLocked(p),false);
});

test('historical verified selection changes only through explicit human reuse and stays debug-paused with story locks preserved',()=>{
 let p=verify(choose(start(),{...choice,reuseWithoutSample:false}));assert.equal(p.step,'voiceSample');const bytes=JSON.stringify(current(p,'script'));
 p=send(p,'configure-debug',{actor:'human',message:'ISOLATED debug',debugEnabled:true});
 assert.throws(()=>send(p,'reuse-voice',{actor:'agent',message:'ISOLATED'}),/human/);
 const unverified=choose(start());assert.throws(()=>send(unverified,'reuse-voice',{actor:'human',message:'ISOLATED'}),/NOT_VERIFIED/);
 p=send(p,'reuse-voice',{actor:'human',message:'ISOLATED skip recording for my existing clone'});assert.equal(p.step,'audition');assert.equal(p.debug.paused,true);assert.equal(JSON.stringify(current(p,'script')),bytes);assert.equal(p.jobs.length,0);
 assert.throws(()=>send(p,'reuse-voice',{actor:'human',message:'ISOLATED'}),/EXISTING_VOICE_LOCKED/);
 assert.throws(()=>send(p,'plan',{plan:{provider:'cartesia',operation:'audition',estimatedCostUsd:.05,parameters:{}}}),/DEBUG_PAUSED/);
});

test('sample-free audio review requires real human identity recognition and cannot invent similarity or source evidence',()=>{
 const p=audition(),e=reviewEvent(p);
 for(const mutation of [r=>r.measurements.referenceSha256=file().sha256,r=>r.measurements.speakerSimilarity=.99,r=>r.measurements.speakerSimilarityMethod='invented',r=>r.checks.find(c=>c.criterion==='voice-match').status='pass',r=>delete r.measurements.identityBasis]){const forged=structuredClone(e);mutation(forged.review);assert.throws(()=>send(p,'review',{...forged}),/HUMAN_VOICE_IDENTITY_REQUIRED/);}
 const reviewed=passReview(p);assert.equal(reviewed.gate,'human');assert.equal(current(reviewed).approvedBy,undefined);
 assert.throws(()=>approved(reviewed));
 const approvedAudition=humanApprove(reviewed);assert.equal(approvedAudition.step,'narration');assert.equal(current(approvedAudition,'audition').humanReview.checks.find(c=>c.criterion==='voice-match').status,'pass');assert.equal(narrationLocked(approvedAudition),false);
});

test('narration lock still requires four measured windows, independent review and explicit human approval without a source recording',()=>{
 let p=humanApprove(passReview(audition()));const sourceFiles=[2,3,4,5].map(n=>file(n,12));
 p=produce(p,{voiceId:choice.voiceId,transcripts:draft.beats.map(b=>b.narration),model:'ISOLATED',sourceFiles,tailSilenceSeconds:[3,3,3,3],files:sourceFiles.map((f,i)=>({...f,path:`/isolated-test/window-${i}.wav`,sha256:String(900+i).padStart(64,'0'),durationSeconds:15}))});
 p=passReview(p);assert.equal(narrationLocked(p),false);assert.throws(()=>assertAllowed(p,'keyframe'),/NARRATION_LOCK_REQUIRED/);p=humanApprove(p);assert.equal(narrationLocked(p),true);assert.equal(p.step,'roster');assert.equal(current(p,'voiceSample'),undefined);
});

test('rejected and inconclusive reviews cannot persist invented source hashes, scores or comparison tool evidence either',()=>{
 const p=audition();
 for(const decision of ['rejected','inconclusive'])for(const mutate of [r=>r.measurements.identityBasis='recorded-reference',r=>r.measurements.referenceSha256='f'.repeat(64),r=>r.measurements.speakerSimilarity=.99,r=>r.measurements.speakerSimilarityMethod='ISOLATED invented method',r=>r.toolEvidence=[{tool:'speakerSimilarity',sha256:current(p).content.files[0].sha256,referenceSha256:'f'.repeat(64)}]]){
  const e=reviewEvent(p);e.review.decision=decision;if(decision==='rejected'){e.review.checks[0].status='fail';e.review.checks[0].repair='ISOLATED repair audible glitch';}mutate(e.review);assert.throws(()=>send(p,'review',{...e}),/HUMAN_VOICE_IDENTITY_REQUIRED/);
 }
 const rejected=reviewEvent(p);rejected.review.decision='rejected';rejected.review.checks[0].status='fail';rejected.review.checks[0].repair='ISOLATED repair an actual audible glitch';assert.equal(send(p,'review',{...rejected}).gate,'produce');
});

test('script revision retains existing clone and resumes at audition instead of asking for an unneeded recording',()=>{
 let p=humanApprove(passReview(audition()));const clone=JSON.stringify(current(p,'clone')),a=current(p,'script');
 p=send(p,'changes',{actor:'human',artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED revise text',impactDigest:revisionImpact(p,a.id).impactDigest});
 p=approved(reviewed(send(p,'artifact',{workerId:'writer',content:draft})));assert.equal(p.step,'audition');assert.equal(current(p,'voiceSample'),undefined);assert.equal(JSON.stringify(current(p,'clone')),clone);
});

test('an optional source supplied before clone selection retains real-reference comparison rather than erasing it',()=>{
 let p=send(start(),'artifact',{actor:'human',workerId:'ISOLATED-human',content:{files:[file()],consent:true,language:'en'}});p=verify(choose(p));
 assert.equal(p.step,'audition');assert.equal(voiceBasis(p).kind,'recorded-reference');assert.deepEqual(current(p,'clone').dependencies,[current(p,'voiceSample').id]);assert.equal(voiceBasis(p).referenceSha256,file().sha256);
});

test('audio instruction correction is explicit, limited to Ava/rubric and forbidden after any provider work',()=>{
 let p=start();const scriptBytes=JSON.stringify(current(p,'script'));
 const change=(p,path)=>{const copy=structuredClone(p);copy.studio.documents[path].content+='\nISOLATED old instruction';copy.studio.documents[path].sha256=sha(Buffer.from(copy.studio.documents[path].content));copy.studio.sha256=digest({config:copy.studio.config,documents:copy.studio.documents});return copy;};
 p=change(p,'crew/ava/SKILL.md');p=send(p,'refresh-audio-instructions',{actor:'human',message:'ISOLATED correct existing-clone review'});assert.equal(JSON.stringify(current(p,'script')),scriptBytes);
 assert.throws(()=>send(change(start(),'crew/leo/SKILL.md'),'refresh-audio-instructions',{actor:'human',message:'ISOLATED'}),/AUDIO_REFRESH_SCOPE/);
 assert.throws(()=>send(start(),'refresh-audio-instructions',{actor:'agent',message:'ISOLATED'}),/human/);
 assert.throws(()=>send(audition(),'refresh-audio-instructions',{actor:'human',message:'ISOLATED'}),/AUDIO_REFRESH_LOCKED/);
});

test('qualified review cannot silently turn missing original-reference identity into an automated pass',()=>{
 let p=verify(choose(start({reviewMode:'qualified',workflowRevision:4})));p=qualifyTestAudio(p);p=produce(p,{files:[file(1)],voiceId:choice.voiceId,transcript:draft.beats[0].narration});const r=reviewEvent(p);r.review.modelVersion='ISOLATED-audio-v1';r.review.capabilityVersion='ISOLATED-tools-v1';r.review.measurements.speakerSimilarity=.99;r.review.measurements.speakerSimilarityMethod='ISOLATED fake comparison';r.review.decision='approved';r.review.checks=r.review.checks.map(c=>({...c,status:'pass'}));assert.throws(()=>send(p,'review',{...r}),/HUMAN_VOICE_IDENTITY_REQUIRED/);
});

test('canonical worker packet includes existing voice basis and actual review broker works without a sample',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-no-sample-broker-'));try{
 const wav=join(dir,'fixture.wav');execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=220:duration=12',wav]);const f=await importMedia(wav,dir);
 let p=ready();p=send(p,'set-budget',{actor:'human',message:'ISOLATED ceiling',budgetLimitUsd:1});p=produce(p,{files:[f],voiceId:choice.voiceId,transcript:draft.beats[0].narration});
 p=send(p,'configure-crew',{actor:'human',message:'ISOLATED bind test crew',crew:{workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:role==='audio-reviewer'?'audio-reviewer':role,name,role,modelVersion:'ISOLATED-model',capabilityVersion:'ISOLATED-tools',execution:'host'}))}});
 const task=taskFor(p);await assert.rejects(prepareCrewTask(p,{...task,voiceBasis:{...task.voiceBasis,language:'xx'}}),/TASK_INPUT_MISMATCH: voiceBasis/);
 const tools={listenAudio:async()=>({perception:'direct-audio',seconds:12}),transcribe:async()=>({transcript:draft.beats[0].narration,method:'ISOLATED mock transcriber'})};
 const result=await runCrewTask(p,task,{tools,runTask:async(t,{callTool})=>{assert.equal(t.voiceReference,null);assert.equal(t.voiceBasis.language,'en');await assert.rejects(callTool('speakerSimilarity',{sha256:f.sha256,referenceSha256:f.sha256}),/VOICE_REFERENCE_UNAVAILABLE/);for(const name of ['listenAudio','measureAudio','transcribe'])await callTool(name,{sha256:f.sha256});return reviewEvent(p);}});
 assert.equal(result.review.measurements.identityBasis,'human-recognition');assert.equal(result.review.measurements.referenceSha256,undefined);assert.equal(result.review.measurements.speakerSimilarity,undefined);p=send(p,'review',{...result});assert.equal(p.gate,'human');
 }finally{await rm(dir,{recursive:true});}
});

test('CLI existing-voice default skips recording durably and preserves zero spend after SQLite restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-no-sample-cli-'));let w=openWorkflow(join(dir,'checkpoints.sqlite'));try{
 await w.init('project',inputs);for(const e of captureEvents(start).events)await w.respond('project',e);w.close();w=null;
 const secrets=join(dir,'secrets.env'),mock=join(dir,'mock.mjs'),runner=fileURLToPath(new URL('../runner.mjs',import.meta.url));await writeFile(secrets,'CARTESIA_API_KEY=ISOLATED\n');await writeFile(mock,`globalThis.fetch=async(url,options)=>{if(options.method!=='GET')throw new Error('Forbidden generation');return Response.json(${JSON.stringify({id:choice.voiceId,name:choice.name,language:'en',is_owner:true,status:'active',access:'private'})});};`);
 const result=JSON.parse(execFileSync(process.execPath,['--import',mock,runner,'use-voice','--id',choice.voiceId,'--name',choice.name,'--message','ISOLATED actual clone selection','--consent-message',choice.consentMessage,'--secrets',secrets,'--run',dir],{encoding:'utf8'}));assert.equal(result.pending.step,'audition');assert.equal(result.producer.inputRequest,null);assert.equal(result.jobs.length,0);
 w=openWorkflow(join(dir,'checkpoints.sqlite'));const s=await w.status('project');assert.equal(s.project.voiceChoice.reuseWithoutSample,true);assert.equal(current(s.project,'voiceSample'),undefined);assert.equal(s.project.budget.maxCostUsd,0);assert.equal(s.project.jobs.length,0);
 }finally{w?.close();await rm(dir,{recursive:true});}
});

test('independent STT uses the verified existing-clone language without an original sample or script hint',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-no-reference-stt-'));try{
 const wav=join(dir,'fixture.wav'),secrets=join(dir,'secrets.env');execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=220:duration=1',wav]);await writeFile(secrets,'CARTESIA_API_KEY=ISOLATED-KEY\n');const file=await importMedia(wav,dir);let calls=0;
 const tools=createCartesiaTranscriptionTool({secretsPath:secrets,receiptDirectory:join(dir,'receipts'),maxCalls:1,fetcher:async(url,options)=>{calls++;assert.equal(options.body.get('language'),'en');assert.equal(options.body.get('prompt'),null);return Response.json({type:'transcript',text:'ISOLATED decoded words',language:'en',duration:file.durationSeconds});}});
 const result=await tools.transcribe({file,worker:{role:'audio-reviewer',workerId:'ISOLATED-ava'},task:{taskId:'ISOLATED-no-reference',voiceReference:null,voiceBasis:{kind:'existing-clone',language:'en'}}});assert.equal(result.language,'en');assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true});}
});
