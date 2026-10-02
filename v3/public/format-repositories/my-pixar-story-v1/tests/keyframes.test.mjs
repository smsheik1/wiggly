import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { current, taskFor, revisionImpact, assertAllowed, openWorkflow } from '../runtime/workflow.mjs';
import { digest, criteria } from '../runtime/contracts.mjs';
import { author, image, backgroundProject } from './background-helpers.mjs';
import { approved, reviewed, send, produce, captureEvents } from './helpers.mjs';
import { shotsProject, shotPlan, keyframeProject, composition, promptLocked, generated } from './shot-helpers.mjs';
test('shot plan requires all backgrounds, covers four beats exactly and binds scene/cast/approved angle', () => {
  assert.throws(() => assertAllowed(backgroundProject(), 'shots'), /BACKGROUND_LOCK/);
  const p = shotsProject();
  for (const edit of [x => x.shots[0].durationSeconds=14, x=>x.shots[0].startSeconds=1, x=>x.shots[1].angleId='reverse', x=>x.shots[0].characterIds=[], x=>x.shots[0].beat=2]) {
    const bad=structuredClone(shotPlan);edit(bad);assert.throws(()=>author(p,bad,'planner'));
  }
  assert.equal(keyframeProject().step,'keyframePrompt');
});
test('composition tasks provide actual approved setting and character images; wrong/reordered hashes cannot bind',()=>{
 const p=keyframeProject(),task=taskFor(p);assert.equal(task.references[0].role,'setting');assert.equal(task.references[0].artifactId,'backgroundAngle:home:reverse@1');assert.equal(task.references[1].artifactId,'sheet:alex@1');assert.equal(task.shotDigest,digest(task.shot));assert.equal(task.immediateScenes[0].id,'home-0');assert.equal(task.role,'composition-writer');
 const bad=composition(p);bad.references.reverse();assert.throws(()=>author(p,bad,'composition-writer'),/exact approved/);assert.throws(()=>author(p,{...composition(p),shotDigest:'wrong'},'composition-writer'),/this shot/);
});
test('prompt review and human lock precede generation; exact prompt and 16:9 production image enforced',()=>{
 let p=author(keyframeProject(),composition(keyframeProject()),'composition-writer');assert.throws(()=>approved(p),/agent-passing/);p=reviewed(p);assert.equal(p.gate,'human');p=approved(p);
 assert.throws(()=>send(p,'plan',{plan:{provider:'meta-muse',operation:'keyframe',estimatedCostUsd:.01,parameters:{prompt:'wrong'}}}),/approved keyframe prompt/);
 assert.throws(()=>produce(p,{files:[{...image(20),width:100,height:100}],prompt:current(p,'keyframePrompt:home-0-wide').content.prompt}),/16:9/);
 p=generated(p);assert.throws(()=>reviewed(p,'approved',{perception:'unavailable'}),/missing perception/);p=reviewed(p);assert.equal(p.gate,'human');assert.equal(p.shotId,'home-0-wide');p=approved(p);assert.equal(p.shotId,'home-1-wide');
});
test('extra-hand defect is rejected internally and routes evidence to composition writer',()=>{
 let p=generated();const a=current(p);const checks=criteria.keyframe.map(criterion=>({criterion,status:criterion==='anatomy'?'fail':'pass',evidence:criterion==='anatomy'?'Three hands visible on one person.':'Isolated finding.',location:'right hand at bicycle handle',repair:criterion==='anatomy'?'Remove extra hand; preserve the two hand contacts.':''}));
 p=send(p,'review',{workerId:'visual-reviewer',artifactId:a.id,artifactDigest:a.digest,review:{decision:'rejected',perception:'direct-image',checks}});assert.equal(p.step,'keyframePrompt');assert.equal(p.gate,'author');assert.equal(current(p,'keyframe:home-0-wide'),undefined);assert.match(JSON.stringify(taskFor(p).feedback),/extra hand/);
});
test('generation limit survives prompt revisions for the same approved shot plan',()=>{
 let p=promptLocked();for(let i=0;i<3;i++){p=generated(p);const a=current(p);p=send(p,'changes',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED TEST adjust pose'});p=promptLocked(p);}
 assert.throws(()=>generated(p),/ATTEMPT_LIMIT/);
});
test('all shots get independent image review and human locks before reviewer qualification; video remains blocked',()=>{
 let p=keyframeProject();for(const shot of shotPlan.shots){assert.equal(p.shotId,shot.id);p=approved(reviewed(generated(promptLocked(p))));}assert.equal(p.step,'reviewerQualification');assert.equal(p.gate,'author');assert.throws(()=>assertAllowed(p,'video'),/VISUAL_REVIEWER_NOT_QUALIFIED/);
});
test('background changes reopen affected shot prompts/frames but keep other location frames and shot plan',()=>{
 let p=keyframeProject();for(const shot of shotPlan.shots)p=approved(reviewed(generated(promptLocked(p))));
 const master=current(p,'backgroundCandidates:home'),impact=revisionImpact(p,master.id);assert(impact.affected.includes('keyframe:home-0-wide@1'));assert(impact.affected.includes('keyframe:home-1-wide@1'));assert(impact.remainValid.includes('keyframe:shop-0-wide@1'));assert(impact.remainValid.includes('shots@1'));
 const frame=current(p,'keyframe:shop-0-wide');p=send(p,'changes',{artifactId:frame.id,artifactDigest:frame.digest,message:'ISOLATED TEST improve expression'});assert.equal(p.step,'keyframePrompt');assert.equal(p.shotId,'shop-0-wide');assert(current(p,'keyframe:home-0-wide').approvedBy);
});
test('SQLite restarts at keyframe prompt approval; stale and missing-perception events cannot advance',async()=>{
 const captured=captureEvents(()=>{let p=keyframeProject();return reviewed(author(p,composition(p),'composition-writer'));});
 const dir=await mkdtemp(join(tmpdir(),'keyframe-checkpoint-'));let w=openWorkflow(join(dir,'state.sqlite'));
 try {await w.init('isolated',captured.project.inputs,{reviewMode:'qualified'});for(const e of captured.events)await w.respond('isolated',e);const before=await w.status('isolated');assert.equal(before.pending.gate,'human');w.close();w=openWorkflow(join(dir,'state.sqlite'));assert.equal((await w.status('isolated')).pending.taskId,before.pending.taskId);await assert.rejects(w.respond('isolated',{taskId:'stale',actor:'human',action:'approve',message:'approve'}),/STALE_TASK/);}finally{w.close();await rm(dir,{recursive:true,force:true});}
});

test('older shot-pending checkpoint opens explicitly; rejected image escalation resolves back to its prompt',()=>{
 let p=shotsProject();p.gate='pending';p=send(p,'start-shots',{actor:'human',message:'ISOLATED TEST start composition'});assert.equal(p.gate,'author');assert(taskFor(p).availableLocations[0].characterSheets[0].content.files.length);
 p=generated();p=reviewed(p,'rejected',{repairTarget:'script'});assert.equal(p.gate,'escalate');p=send(p,'resolve',{message:'ISOLATED TEST keep narration, repair composition instead'});assert.equal(p.step,'keyframePrompt');assert.equal(p.gate,'author');
});
test('thumbnail-sized widescreen receipts cannot become production keyframes',()=>{
 const p=promptLocked();assert.throws(()=>produce(p,{files:[{...image(20),width:320,height:180}],prompt:current(p,'keyframePrompt:home-0-wide').content.prompt}),/1280/);
});


test('two rejected frames for the same shot escalate even after repaired prompt approval',()=>{
 let p=reviewed(generated(),'rejected');assert.equal(p.gate,'author');
 p=generated(promptLocked(p));p=reviewed(p,'rejected');assert.equal(p.gate,'escalate');assert.equal(p.reviewDisagreements,2);
 p=send(p,'resolve',{message:'ISOLATED TEST final repair direction'});assert.equal(p.step,'keyframePrompt');
});
