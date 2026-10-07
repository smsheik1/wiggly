// Invented protocol fixtures; no provider calls or real creative acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialProject,current,assertAllowed,taskFor} from '../runtime/workflow.mjs';
import {digest} from '../runtime/contracts.mjs';
import {inputs,script,send,reviewed} from './helpers.mjs';
import {supervisedAudio,confirmed} from './supervised-helpers.mjs';
import {author,image} from './background-helpers.mjs';
const proposedCast=[{id:'alex',name:'Alex',ageVariant:'adult',minor:false,storyPurpose:'Narrator appears in the memory.'}];
const approveExact=(p,extra={})=>send(p,'approve',{artifactId:current(p).id,artifactDigest:current(p).digest,message:'ISOLATED confirm exact deliverable',...extra});

test('new intake locks memories without casting or photos; writer must propose cast before script approval',()=>{
 for(const relationshipToRecipient of ['parent','grandparent']){
  const source={...inputs,subject:{...inputs.subject,relationshipToRecipient}};
  let p=initialProject('new-'+relationshipToRecipient,source);assert.equal(p.workflowRevision,4);
  p=reviewed(send(p,'artifact',{workerId:'writer',content:{inputs:source,sourceInputDigest:digest(source),commonSenseChecks:[]}}));
  assert.throws(()=>assertAllowed(p,'script'),/ANSWERS_LOCK_REQUIRED/);
  p=approveExact(p);assert.equal(p.step,'script');assert.equal(current(p,'answers').intakeConfirmation,undefined);
  assert.throws(()=>send(p,'artifact',{workerId:'writer',content:script}),/SCRIPT_CAST_PROPOSAL_REQUIRED/);
  p=reviewed(send(p,'artifact',{workerId:'writer',content:{...script,commonSenseChecks:[],proposedCast}}));
  assert.deepEqual(current(p).content.proposedCast,proposedCast);
  p=approveExact(p);assert.equal(p.step,'voiceSample');assert.deepEqual(taskFor(p).proposedCast,proposedCast);
  assert.throws(()=>assertAllowed(p,'candidates'),/NARRATION_LOCK_REQUIRED/);assert.throws(()=>assertAllowed(p,'roster'),/NARRATION_LOCK_REQUIRED/);
 }
});

test('factual blockers cannot be waived by a passing review or a cast proposal',()=>{
 let p=initialProject('fact',inputs);const finding={category:'age',finding:'Two contradictory ages for the same memory',resolution:'Confirm which supplied age is correct'};
 p=reviewed(send(p,'artifact',{workerId:'writer',content:{inputs,sourceInputDigest:digest(inputs),commonSenseChecks:[finding]}}));
 assert.throws(()=>approveExact(p),/INTAKE_UNRESOLVED/);
 p=approveExact(p,{resolvedFindings:[{findingDigest:digest({category:finding.category,finding:finding.finding}),resolution:'ISOLATED human confirms the original age.'}]});
 assert.equal(p.step,'script');
});

function rosterReady(){let p=confirmed(supervisedAudio());p.workflowRevision=4;current(p,'script').content.proposedCast=proposedCast;return p;}
test('cast references and consent remain enforced at roster; approved script cast cannot silently change',()=>{
 let p=rosterReady();p=reviewed(author(p,{characters:[{id:'alex',name:'Alex',ageVariant:'adult',important:true,references:[image(1)],notes:'ISOLATED'}]},'cast-owner'));
 assert.throws(()=>approveExact(p),/INTAKE_CONFIRMATION_REQUIRED/);
 const intake=structuredClone(current(p,'script').intakeConfirmation);intake.resolvedFindings=[];
 const wrong=structuredClone(intake);wrong.characters[0].ageVariant='child';assert.throws(()=>approveExact(p,{intakeConfirmation:wrong}),/SCRIPT_CAST_MISMATCH/);
 const missing=structuredClone(intake);missing.characters[0].references=[];assert.throws(()=>approveExact(p,{intakeConfirmation:missing}),/INTAKE_UNRESOLVED/);
 const swapped=structuredClone(intake);swapped.characters[0].references=[image(2)];assert.throws(()=>approveExact(p,{intakeConfirmation:swapped}),/INTAKE_ROSTER_MISMATCH/);
 p=approveExact(p,{intakeConfirmation:intake});assert.equal(p.step,'characterPrompt');assert.deepEqual(current(p,'roster').intakeConfirmation,intake);
});

test('script and cast are delivered together after SQLite restart; no intake inventory demand in the delivery view',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const {openWorkflow}=await import('../runtime/workflow.mjs');const {presentDeliverable}=await import('../runtime/presentation.mjs');
 const dir=await mkdtemp(join(tmpdir(),'script-led-cast-'));let w=openWorkflow(join(dir,'state.sqlite'));
 try{
  let s=await w.init('project',inputs);const submit=async(action,extra={})=>{s=await w.respond('project',{taskId:s.pending.taskId,actor:action==='approve'?'human':action==='review'?'reviewer':'agent',action,...extra});};
  const mirror=p=>{const next=reviewed(p);return {workerId:'independent-reviewer',artifactId:current(p).id,artifactDigest:current(p).digest,review:current(next).review};};
  await submit('artifact',{workerId:'writer',content:{inputs,sourceInputDigest:digest(inputs),commonSenseChecks:[]}});await submit('review',mirror(s.project));
  await submit('approve',{artifactId:current(s.project).id,artifactDigest:current(s.project).digest,message:'ISOLATED exact memories approved'});
  await submit('artifact',{workerId:'writer',content:{...script,commonSenseChecks:[],proposedCast}});await submit('review',mirror(s.project));
  w.close();w=openWorkflow(join(dir,'state.sqlite'));s=await w.status('project');const delivered=await presentDeliverable(s);
  assert.match(delivered.markdown,/Proposed on-screen cast/);assert.match(delivered.markdown,/Narrator appears in the memory/);assert.equal(delivered.intakeConfirmationRequired,false);
  assert.equal(s.project.workflowRevision,4);assert.equal(s.project.step,'script');assert.equal(current(s.project).approvedBy,undefined);assert.equal(s.project.jobs.length,0);
 }finally{w.close();await rm(dir,{recursive:true});}
});

test('workers receive the verified workflow revision and approved cast proposal, never caller replacements',async()=>{
 const {prepareCrewTask}=await import('../runtime/crew.mjs');
 let p=initialProject('packet',inputs);let task=taskFor(p);const packet=await prepareCrewTask(p,task);assert.equal(packet.workflowRevision,4);
 await assert.rejects(prepareCrewTask(p,{...task,workflowRevision:3}),/TASK_INPUT_MISMATCH/);
 p=reviewed(send(p,'artifact',{workerId:'writer',content:{inputs,sourceInputDigest:digest(inputs),commonSenseChecks:[]}}));p=approveExact(p);
 p=reviewed(send(p,'artifact',{workerId:'writer',content:{...script,commonSenseChecks:[],proposedCast}}));p=approveExact(p);task=taskFor(p);
 await assert.rejects(prepareCrewTask(p,{...task,proposedCast:[]}),/TASK_INPUT_MISMATCH/);
});
