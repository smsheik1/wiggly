import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Project,criteria} from '../runtime/contracts.mjs';
import {initialProject,current,taskFor,assertAllowed,openWorkflow,revisionImpact} from '../runtime/workflow.mjs';
import {narrationLocked,locked} from '../runtime/gates.mjs';
import {inputs,script,file,send,authored,reviewed,approved,produce} from './helpers.mjs';

// Invented people and protocol fixtures only. These are not human media labels.
export function confirmed(p){
 const a=current(p),perception=p.step==='film'?'direct-audiovisual':p.step==='video'?'direct-video':['candidates','sheet','backgroundCandidates','backgroundAngle','keyframe'].includes(p.step)?'direct-image':'direct-audio';
 return approved(p,{humanReview:{decision:'approved',perception,checks:criteria[p.step].map(criterion=>({criterion,status:'pass',location:'ISOLATED fixture',evidence:'ISOLATED human-event simulation; no real quality claim.'}))}});
}
export function advisory(p){
 const measurements={transcripts:p.step==='audition'?[script.beats[0].narration]:script.beats.map(b=>b.narration),speechToTextMethod:'ISOLATED STT',referenceSha256:file().sha256,speakingRateWpm:Array(p.step==='audition'?1:4).fill(80),silenceSeconds:Array(p.step==='audition'?1:4).fill(0),measurementNotes:'Calibrated similarity unavailable; explicit human voice comparison required.'};
 return reviewed(p,'provisional',{measurements,checks:criteria[p.step].map(criterion=>({criterion,status:criterion==='voice-match'?'inconclusive':'pass',evidence:'ISOLATED protocol fixture',location:'whole fixture',repair:''}))});
}
export function supervisedAudio(){
 let p=approved(reviewed(authored(initialProject('invented-supervised',inputs))));
 p=send(p,'artifact',{actor:'human',workerId:'human',content:{files:[file()],consent:true,language:'en'}});
 p=produce(p,{provider:'cartesia',voiceId:'private-clone-test',receiptId:'isolated'});
 assert.equal(p.step,'audition');
 p=confirmed(advisory(produce(p,{files:[file(1)],voiceId:'private-clone-test',transcript:script.beats[0].narration})));
 return advisory(produce(p,{files:[1,2,3,4].map(n=>file(n)),voiceId:'private-clone-test',transcripts:script.beats.map(b=>b.narration),model:'isolated'}));
}
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
 assert.equal(reconciled.lifecycle,'abandoned');assert.equal(reconciled.jobs[0].status,'ready');assert.deepEqual(reconciled.artifacts,q.artifacts);
});
