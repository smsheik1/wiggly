import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Project,criteria,digest} from '../runtime/contracts.mjs';
import {initialProject,current,taskFor,assertAllowed,openWorkflow,revisionImpact,characterRecipeSha256} from '../runtime/workflow.mjs';
import {image,author,registry,brief,prompt,ownerChecked} from './background-helpers.mjs';
import {shotPlan} from './shot-helpers.mjs';
import {narrationLocked,locked} from '../runtime/gates.mjs';
import {inputs,script,file,send,authored,reviewed,approved,produce,intakeFixture} from './helpers.mjs';

import {confirmed,advisory,supervisedAudio,supervisedCharacters,supervisedBackgrounds} from './supervised-helpers.mjs';
test('supervised narration proceeds without fabricated qualification or speaker score, and requires human media confirmation',()=>{
 let p=supervisedAudio();assert.equal(p.gate,'human');assert.equal(narrationLocked(p),false);
 assert.equal(current(p).review.measurements.speakerSimilarity,undefined);
 assert.throws(()=>approved(p),/humanReview|undefined|object/i);
 p=confirmed(p);assert.equal(p.step,'roster');assert.equal(narrationLocked(p),true);
 assert.equal(p.artifacts.some(a=>a.kind.includes('Qualification')),false);
 assert.equal(current(p,'narration').humanReview.decision,'approved');
});
test('missing direct perception, a known defect, and stale human evidence cannot become provisional approval',()=>{
 const p=supervisedAudio(),a=current(p);
 const prior={...p,gate:'review'};
 const review=current(p).review;
 for(const bad of [{...review,perception:'unavailable'},{...review,checks:review.checks.map((c,i)=>i?c:{...c,status:'fail',repair:'Repair defect'})}]){
  assert.throws(()=>send(prior,'review',{workerId:'audio-reviewer',artifactId:a.id,artifactDigest:a.digest,review:bad}),/Provisional/);
 }
 assert.throws(()=>send(p,'approve',{artifactId:a.id,artifactDigest:'stale',message:'ISOLATED stale'}),/exact current/);
 assert.throws(()=>assertAllowed(p,'candidates'),/NARRATION_LOCK_REQUIRED/);
});
test('older checkpoints retain qualified policy and cannot silently skip qualification',()=>{
 const legacy=initialProject('legacy',inputs,{reviewMode:'qualified'});delete legacy.reviewMode;
 const loaded=Project.parse(legacy);assert.equal(loaded.reviewMode,'qualified');
 assert.throws(()=>assertAllowed(loaded,'video'),/LOCK_REQUIRED/);
 const changed=send(loaded,'configure-review',{actor:'human',reviewMode:'supervised',message:'ISOLATED explicitly select supervised v1'});
 assert.equal(changed.reviewMode,'supervised');assert.deepEqual(changed.inputs,loaded.inputs);
 assert.equal(changed.step,'script');assert.equal(changed.artifacts.length,0);
});
test('supervised policy and human media evidence survive a new SQLite connection',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-supervised-'));let w=openWorkflow(join(dir,'state.sqlite'));
 try{
  let s=await w.init('supervised',inputs);assert.equal(s.project.reviewMode,'supervised');
  const task=s.pending.taskId;w.close();w=openWorkflow(join(dir,'state.sqlite'));s=await w.status('supervised');
  assert.equal(s.pending.taskId,task);assert.equal(s.project.reviewMode,'supervised');assert.equal(s.pending.reviewPolicy.humanMediaConfirmationRequired,true);
 }finally{w.close();await rm(dir,{recursive:true});}
});
test('detail changes and redo require exact locked dependency impact; neither resets source facts or attempts',()=>{
 const p=confirmed(supervisedAudio()),a=current(p,'script'),impact=revisionImpact(p,a.id);
 for(const action of ['changes','redo']){
  assert.throws(()=>send(p,action,{actor:'human',artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED detail'}),/IMPACT_CONFIRMATION/);
  const q=send(p,action,{actor:'human',artifactId:a.id,artifactDigest:a.digest,impactDigest:impact.impactDigest,message:'ISOLATED confirmed scope'});
  assert.equal(q.step,'script');assert.equal(current(q,'narration'),undefined);assert.ok(current(q,'clone'));
  assert.deepEqual(q.inputs,p.inputs);assert.deepEqual(q.jobs,p.jobs);assert.equal(q.feedback.at(-1).intent,action==='redo'?'redo':'detail');
 }
 const noted=send(p,'note',{message:'ISOLATED unrelated idea'});
 assert.throws(()=>send(noted,'changes',{actor:'human',artifactId:a.id,artifactDigest:a.digest,impactDigest:impact.impactDigest,message:'ISOLATED stale scope'}),/IMPACT_CONFIRMATION/);
});
test('abandonment preserves artifacts, stops every new submission, and keeps uncertain jobs for human reconciliation',()=>{
 const p=confirmed(supervisedAudio());
 const q=send(p,'abandon',{actor:'human',message:'ISOLATED abandon project'});
 assert.equal(q.lifecycle,'abandoned');assert.equal(q.gate,'pending');assert.deepEqual(q.artifacts,p.artifacts);assert.deepEqual(q.jobs,p.jobs);
 assert.throws(()=>send(q,'artifact',{workerId:'writer',content:script}),/PROJECT_ABANDONED/);
 assert.throws(()=>send(q,'configure-review',{actor:'human',reviewMode:'qualified',message:'ISOLATED'}),/PROJECT_ABANDONED/);
 assert.throws(()=>assertAllowed(q,'video'),/PROJECT_ABANDONED/);
 const job=q.jobs[0];const reconciled=send(q,'reconcile',{actor:'human',jobId:job.id,artifactDigest:job.digest,result:{outcome:'confirmed-completed'},message:'ISOLATED confirmed existing job'});
 assert.equal(reconciled.lifecycle,'abandoned');assert.equal(reconciled.jobs[0].status,'ready');assert.deepEqual(reconciled.jobs[0].result,q.jobs[0].result);assert.equal(reconciled.jobs[0].reconciliation.outcome,'confirmed-completed');assert.deepEqual(reconciled.artifacts,q.artifacts);
});
test('shot intentions lead backgrounds; no approved references or user narration can be bypassed',()=>{
 let p=supervisedCharacters();assert.equal(p.step,'shotIntentions');
 assert.throws(()=>assertAllowed(p,'backgrounds'),/SHOT_INTENTIONS_REQUIRED/);
 const wrong=structuredClone(shotPlan);wrong.shots[0].durationSeconds=14;
 assert.throws(()=>author(p,{...registry,...wrong},'shot-planner'),/exactly 15/);
 p=approved(reviewed(author(p,{...registry,...shotPlan},'shot-planner')));assert.equal(p.step,'backgrounds');
 assert.ok(current(p,'shotIntentions').approvedBy);assert.equal(p.artifacts.some(a=>a.kind==='backgroundCandidates'),false);
 const changed=structuredClone(registry);changed.locations[0].name='Different unapproved setting';
 assert.throws(()=>author(p,changed),/derive exactly/);
});
test('post-background staging cannot change locked shot action/timing but may refine physical placement',()=>{
 const p=supervisedBackgrounds();assert.equal(p.step,'shots');
 const changed=structuredClone(shotPlan);changed.shots[0].action='Invented new action';assert.throws(()=>author(p,changed,'shot-planner'),/preserve approved shot intentions/);
 const refined=structuredClone(shotPlan);refined.shots[0].staging='Use approved actual doorway clearance.';
 const q=approved(reviewed(author(p,refined,'shot-planner')));assert.equal(q.step,'keyframePrompt');
 assert.equal(current(q,'shots').dependencies.includes(current(q,'shotIntentions').id),true);
});

test('one durable ceiling covers generation and inference; failures and rewinds do not reset it',()=>{
 let p=confirmed(supervisedAudio()),task=taskFor(p).taskId;
 const initial=p.jobs.reduce((n,j)=>n+j.plan.estimatedCostUsd,0);
 p=send(p,'set-budget',{actor:'human',budgetLimitUsd:initial+.1,message:'ISOLATED exact ceiling'});
 task=taskFor(p).taskId;
 const reservation={id:'gemini:isolated-request',provider:'gemini',estimatedCostUsd:.06};
 p=send(p,'reserve-compute',{actor:'runtime',reservation});assert.equal(taskFor(p).taskId,task);
 const duplicate=send(p,'reserve-compute',{actor:'runtime',reservation});assert.deepEqual(duplicate,p);
 assert.throws(()=>send(p,'reserve-compute',{actor:'runtime',reservation:{...reservation,estimatedCostUsd:.07}}),/RESERVATION_CHANGED/);
 assert.throws(()=>send(p,'reserve-compute',{actor:'runtime',reservation:{...reservation,id:'cartesia:other',provider:'cartesia-stt',estimatedCostUsd:.05}}),/BUDGET_EXCEEDED/);
 assert.throws(()=>send(p,'set-budget',{actor:'human',budgetLimitUsd:0,message:'ISOLATED lower cap'}),/covering existing/);
 const a=current(p,'narration'),impact=revisionImpact(p,a.id);
 p=send(p,'changes',{actor:'human',artifactId:a.id,artifactDigest:a.digest,impactDigest:impact.impactDigest,message:'ISOLATED revise'});
 p=send(p,'plan',{plan:{provider:'cartesia',operation:'narration',estimatedCostUsd:.05,parameters:{}}});
 const j=p.jobs.at(-1);assert.throws(()=>send(p,'authorize',{jobId:j.id,artifactDigest:j.digest,message:'ISOLATED approve request'}),/BUDGET_EXCEEDED/);
 p=send(p,'set-budget',{actor:'human',budgetLimitUsd:1,message:'ISOLATED explicit increase'});
 p=send(p,'authorize',{jobId:j.id,artifactDigest:j.digest,message:'ISOLATED request authorization'});
 p=send(p,'begin',{jobId:j.id,artifactDigest:j.digest});p=send(p,'provider-error',{jobId:j.id,artifactDigest:j.digest,message:'ISOLATED unknown outcome'});
 assert.ok(taskFor(p).budget.totalReservedUsd>=initial+.06+.05-1e-9);
 assert.equal(p.budget.reservations.length,1);
});
test('zero budget refuses paid generation and inference; accounting survives SQLite restart without changing creative task',async()=>{
 let p=approved(reviewed(authored(initialProject('zero',inputs))));
 p=send(p,'artifact',{actor:'human',workerId:'human',content:{files:[file()],consent:true,language:'en'}});
 p=send(p,'plan',{plan:{provider:'cartesia',operation:'clone',estimatedCostUsd:.1,parameters:{}}});const j=p.jobs.at(-1);
 assert.throws(()=>send(p,'authorize',{jobId:j.id,artifactDigest:j.digest,message:'ISOLATED'}),/BUDGET_EXCEEDED/);
 assert.throws(()=>send(p,'reserve-compute',{actor:'runtime',reservation:{id:'zero',provider:'gemini',estimatedCostUsd:.01}}),/BUDGET_EXCEEDED/);
 const dir=await mkdtemp(join(tmpdir(),'memoir-budget-'));let w=openWorkflow(join(dir,'state.sqlite'));
 try{
  let s=await w.init('budget',inputs);s=await w.respond('budget',{taskId:s.pending.taskId,actor:'human',action:'set-budget',budgetLimitUsd:.1,message:'ISOLATED'});
  const task=s.pending.taskId;s=await w.respond('budget',{taskId:task,actor:'runtime',action:'reserve-compute',reservation:{id:'r1',provider:'gemini',estimatedCostUsd:.05}});
  w.close();w=openWorkflow(join(dir,'state.sqlite'));s=await w.status('budget');assert.equal(s.pending.taskId,task);assert.equal(s.pending.budget.totalReservedUsd,.05);
  s=await w.respond('budget',{taskId:task,actor:'runtime',action:'reserve-compute',reservation:{id:'r1',provider:'gemini',estimatedCostUsd:.05}});assert.equal(s.project.budget.reservations.length,1);
 }finally{w.close();await rm(dir,{recursive:true});}
});

test('script lock needs actual human rights/reference and common-sense resolutions; later cast cannot switch identities or ages',()=>{
 const p=reviewed(authored(initialProject('intake',inputs))),a=current(p);
 const approve=intake=>send(p,'approve',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED',...(intake?{intakeConfirmation:intake}:{})});
 assert.throws(()=>approve(),/INTAKE_CONFIRMATION_REQUIRED/);
 const base=intakeFixture(p);
 for(const edit of [i=>i.voiceConsent=false,i=>i.characters[0].photoRights=false,i=>{i.characters[0].minor=true;i.characters[0].guardianAuthority=false;},i=>i.characters[0].likeness='await-reference',i=>i.resolvedFindings=[],i=>i.resolvedFindings[0].findingDigest='other']){
  const intake=structuredClone(base);edit(intake);assert.throws(()=>approve(intake));
 }
 const q=approve(base);assert.equal(q.step,'voiceSample');assert.equal(current(q,'script').intakeConfirmation.characters[0].id,'alex');
 const roster=confirmed(supervisedAudio()),character={id:'alex',name:'Alex',ageVariant:'adult',important:true,references:[image(1)],notes:'ISOLATED'};
 for(const change of [{id:'swapped-person'},{ageVariant:'child'},{references:[image(2)]}])assert.throws(()=>author(roster,{characters:[{...character,...change}]},'cast-owner'),/INTAKE_ROSTER_MISMATCH/);
 const interpreted=structuredClone(roster);const intake=current(interpreted,'script').intakeConfirmation.characters[0];intake.likeness='interpreted';intake.references=[];intake.decisionNotes='ISOLATED imagined adult likeness, unverified';
 assert.throws(()=>author(interpreted,{characters:[{...character,references:[]}]},'cast-owner'),/INTERPRETED_LIKENESS_REQUIRED/);
 const ready=author(interpreted,{characters:[{...character,references:[],notes:intake.decisionNotes}]},'cast-owner');assert.equal(ready.gate,'review');
});
