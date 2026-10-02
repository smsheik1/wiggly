import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audioProject, send, approved, reviewed, produce, file, event, captureEvents } from './helpers.mjs';
import { current, taskFor, revisionImpact, assertAllowed, openWorkflow, backgroundRecipeSha256 } from '../runtime/workflow.mjs';
import { criteria } from '../runtime/contracts.mjs';
import { backgroundProject, registry, author, brief, prompt, ownerChecked, readyForMaster, masterLocked, locationComplete, image } from './background-helpers.mjs';
test('background inventory cannot start before audio and every character sheet lock',()=>{
 const p=audioProject();assert.throws(()=>assertAllowed(p,'backgroundCandidates'),/CHARACTER_LOCK/);p.artifacts.find(a=>a.key==='narration').approvedBy=undefined;assert.throws(()=>assertAllowed(p,'backgroundCandidates'),/AUDIO_LOCK/);
});
test('registry covers four beats, established cast and valid scene-angle references',()=>{
 const p=backgroundProject();const bad=structuredClone(registry);bad.locations[1].scenes[1].beat=1;assert.throws(()=>author(p,bad),/four beats/);
 const wrong=structuredClone(registry);wrong.locations[0].scenes[0].characterIds=['unknown'];assert.throws(()=>author(p,wrong),/established characters/);
});
test('scene-primary owner brief, distinct prompter, owner check and independent review precede human approval',()=>{
 let p=approved(reviewed(author(backgroundProject(),registry)));assert.deepEqual(taskFor(p).inputPriority,['immediateScenes','approvedScript','inputs.answers']);assert.equal(taskFor(p).immediateScenes.length,2);
 p=approved(reviewed(author(p,brief(p))));assert.throws(()=>author(p,prompt(p)),/distinct from owner/);assert.throws(()=>author(p,{...prompt(p),recipeSha256:'wrong'},'pixar-prompter'),/recipe/);
 p=author(p,prompt(p),'pixar-prompter');assert.equal(p.gate,'owner-review');assert.throws(()=>reviewed(p),/distinct reviewer/);assert.throws(()=>approved(p),/agent-passing/);
 p=ownerChecked(p);assert.throws(()=>send(p,'review',{workerId:'background-owner',artifactId:current(p).id,artifactDigest:current(p).digest,review:{decision:'approved',perception:'direct-text',checks:criteria[p.step].map(criterion=>({criterion,status:'pass',evidence:'fixture',location:'prompt'}))}}),/distinct independent/);
 p=reviewed(p);assert.equal(p.gate,'human');p=approved(p);assert.equal(p.step,'backgroundCandidates');
});
test('three concepts require direct perception and explicit selection; angles bind actual selected master',()=>{
 let p=readyForMaster();p=produce(p,{files:[5,6,7].map(image),prompt:current(p,'backgroundPrompt:home').content.prompt});assert.throws(()=>reviewed(p,'approved',{perception:'unavailable'}),/missing perception/);p=reviewed(p);assert.throws(()=>approved(p),/three candidate/);p=approved(p,{selection:1});
 p=approved(reviewed(author(p,brief(p))));p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));
 p=send(p,'plan',{plan:{provider:'meta-muse',operation:p.step,estimatedCostUsd:.01,parameters:{prompt:current(p,'backgroundAnglePrompt:home:reverse').content.prompt}}});assert.deepEqual(p.jobs.at(-1).request.images,[image(6)]);assert.equal(p.jobs.at(-1).request.n,1);
});
test('locations process one at a time; each angle is separately reviewed and human locked; future video stays blocked',()=>{
 let p=locationComplete();assert.equal(p.locationId,'shop');assert.equal(p.step,'backgroundBrief');
 p=approved(reviewed(author(p,brief(p))));p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));p=approved(reviewed(produce(p,{files:[5,6,7].map(image),prompt:current(p,'backgroundPrompt:shop').content.prompt})),{selection:2});p=locationComplete(p);assert.equal(p.step,'shots');assert.equal(p.gate,'author');assert.throws(()=>assertAllowed(p,'video'),/KEYFRAME_LOCK_REQUIRED/);
});
test('master revision invalidates dependent angle while preserving other location locks',()=>{
 let p=locationComplete();p=approved(reviewed(author(p,brief(p))));p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));p=approved(reviewed(produce(p,{files:[5,6,7].map(image),prompt:current(p,'backgroundPrompt:shop').content.prompt})),{selection:0});p=locationComplete(p);
 const a=current(p,'backgroundCandidates:home'),impact=revisionImpact(p,a.id);assert(impact.affected.includes('backgroundAngle:home:reverse@1'));assert(impact.remainValid.includes('backgroundCandidates:shop@1'));
 p=send(p,'changes',{artifactId:a.id,artifactDigest:a.digest,message:'Move home doorway.'});assert.equal(p.locationId,'home');assert.equal(p.step,'backgroundBrief');assert.equal(p.gate,'author');assert.equal(p.characterId,null);assert.equal(current(p,'backgroundAngle:home:reverse'),undefined);assert(current(p,'backgroundCandidates:shop').approvedBy);
});
test('rejection repairs technical prompt with evidence and restarts owner check',()=>{let p=approved(reviewed(author(backgroundProject(),registry)));p=approved(reviewed(author(p,brief(p))));p=ownerChecked(author(p,prompt(p),'pixar-prompter'),'rejected');assert.equal(p.gate,'author');p=author(p,prompt(p),'pixar-prompter');assert.equal(p.gate,'owner-review');});
test('SQLite resumes exact background gate after restart and stale replies cannot advance',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'background-checkpoint-'));let w=openWorkflow(join(dir,'state.sqlite'));
 try { const {project:p,events}=captureEvents(readyForMaster);await w.init('isolated',p.inputs,{reviewMode:'qualified'});
   for (const e of events) await w.respond('isolated',e);
   const before=await w.status('isolated');assert.equal(before.pending.step,'backgroundCandidates');w.close();w=openWorkflow(join(dir,'state.sqlite'));
   const after=await w.status('isolated');assert.equal(after.pending.taskId,before.pending.taskId);assert.equal(after.project.locationId,'home');
   await assert.rejects(w.respond('isolated',{taskId:'stale',action:'note',actor:'human',message:'unrelated'}),/STALE_TASK/);
   assert.equal((await w.status('isolated')).pending.taskId,after.pending.taskId);
 }finally{w.close();await rm(dir,{recursive:true,force:true});}
});

test('older pending checkpoint requires explicit human start and inconclusive owner check resumes at owner',()=>{
 let p=backgroundProject();p.gate='pending';assert.throws(()=>send(p,'artifact',{workerId:'owner',content:registry}),/not allowed/);
 p=send(p,'start-backgrounds',{actor:'human',message:'ISOLATED TEST open background workflow'});assert.equal(p.gate,'author');
 p=approved(reviewed(author(p,registry)));p=approved(reviewed(author(p,brief(p))));p=author(p,prompt(p),'pixar-prompter');
 const a=current(p);p=send(p,'owner-review',{workerId:'background-owner',artifactId:a.id,artifactDigest:a.digest,review:{decision:'inconclusive',perception:'unavailable',checks:criteria[p.step].map(criterion=>({criterion,status:'inconclusive',evidence:'Actual owner review unavailable.',location:'full prompt'}))}});
 assert.equal(p.gate,'escalate');p=send(p,'resolve',{message:'ISOLATED TEST owner review is now available'});assert.equal(p.gate,'owner-review');
});
test('background plans cannot change approved prompt or omit image count cost; portrait receipts fail',()=>{
 let p=readyForMaster();const text=current(p,'backgroundPrompt:home').content.prompt;
 assert.throws(()=>send(p,'plan',{plan:{provider:'meta-muse',operation:p.step,estimatedCostUsd:.03,parameters:{prompt:'different'}}}),/approved background prompt/);
 assert.throws(()=>send(p,'plan',{plan:{provider:'meta-muse',operation:p.step,estimatedCostUsd:.01,parameters:{prompt:text}}}),/every requested image/);
 assert.throws(()=>produce(p,{files:[5,6,7].map(n=>({...image(n),width:900,height:1600})),prompt:text}),/16:9/);
});
test('advisory reviewer evidence binds location-scoped artifact without pretending to inspect images',async()=>{
 const {artifactEvidence}=await import('../runtime/evaluators.mjs');let p=readyForMaster();p=produce(p,{files:[5,6,7].map(image),prompt:current(p,'backgroundPrompt:home').content.prompt});const evidence=await artifactEvidence(p);assert.equal(evidence.artifactId,current(p).id);assert(evidence.checks.every(c=>c.status==='inconclusive'));assert.equal(evidence.productionApproval,false);
});
