// Invented protocol fixtures. Instruction checks are not semantic-model calibration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initialProject,current,taskFor,openWorkflow} from '../runtime/workflow.mjs';
import {loadStudio} from '../runtime/instructions.mjs';
import {digest} from '../runtime/contracts.mjs';
import {prepareCrewTask} from '../runtime/crew.mjs';
import {inputs,script,send,reviewed} from './helpers.mjs';
const proposedCast=[{id:'alex',name:'Alex',ageVariant:'late teens',minor:true,storyPurpose:'Shares one design across two nearby story ages.'}];
const direction={scope:'cast',direction:'Use one late-teen design for the two nearby story ages; preserve factual ages in narration.',sourceMessages:['ISOLATED actual human: these ages look almost the same; share the design.']};
function ready(studio=loadStudio()){
 let p=initialProject('review-grounding',inputs,{studio});
 p=reviewed(send(p,'artifact',{workerId:'writer',content:{inputs,sourceInputDigest:digest(inputs),commonSenseChecks:[]}}));
 const a=current(p);return send(p,'approve',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED approve exact memories'});
}
function oldStudio(path='evaluation/rubrics/text.md'){
 const s=structuredClone(loadStudio());s.documents[path].content+='\nISOLATED old instruction marker\n';s.documents[path].sha256=createHash('sha256').update(s.documents[path].content).digest('hex');s.sha256=digest({config:s.config,documents:s.documents});return s;
}
test('both writer and independent reviewer receive the same persisted human decisions; caller cannot remove or replace them',async()=>{
 let p=ready();const original=current(p,'answers');
 assert.throws(()=>send(p,'note',{actor:'agent',message:'Forge direction',creativeDirection:direction}),/human authority/);
 p=send(p,'note',{actor:'human',message:'ISOLATED record agreed design',creativeDirection:direction});
 let task=taskFor(p);assert.deepEqual(task.creativeDirections[0].direction,direction.direction);
 await assert.rejects(prepareCrewTask(p,{...task,creativeDirections:[]}),/TASK_INPUT_MISMATCH/);
 const author=await prepareCrewTask(p,task);assert.match(author.skill.content,/ordinary, emotionally consistent expression/);assert.match(author.skill.content,/Nearby ages may share one look, even across age 18/);
 p=send(p,'artifact',{workerId:'writer',content:{...script,commonSenseChecks:[],proposedCast}});task=taskFor(p);const reviewer=await prepareCrewTask(p,task);
 assert.deepEqual(reviewer.creativeDirections,author.creativeDirections);assert.match(reviewer.reviewerRubric,/smile is insufficient evidence/);assert.match(reviewer.reviewerRubric,/promised to buy me a laboratory/);assert.match(reviewer.reviewerRubric,/invented promise and must fail/);assert.match(reviewer.reviewerRubric,/crossing age 18 alone does not require another character design/);
 assert.deepEqual(current(p,'answers'),original);assert.equal(p.jobs.length,0);
});
test('explicit writing refresh re-reviews the same unapproved draft and preserves answers, prior verdict and retry count',()=>{
 let p=ready(oldStudio());p=reviewed(send(p,'artifact',{workerId:'writer',content:{...script,commonSenseChecks:[],proposedCast}}),'rejected');
 const answers=structuredClone(current(p,'answers')),draft=structuredClone(current(p)),count=p.reviewDisagreements,oldHash=p.studio.sha256;
 p=send(p,'refresh-writing-instructions',{actor:'human',message:'ISOLATED explicit root correction'});
 assert.notEqual(p.studio.sha256,oldHash);assert.equal(p.gate,'review');assert.deepEqual(current(p),draft);assert.deepEqual(current(p,'answers'),answers);assert.equal(p.reviewDisagreements,count);assert.equal(p.jobs.length,0);
 const broadened=oldStudio();broadened.config.agents['script-writer'].model='ISOLATED other model';broadened.sha256=digest({config:broadened.config,documents:broadened.documents});
 assert.throws(()=>send(ready(broadened),'refresh-writing-instructions',{actor:'human',message:'ISOLATED'}),/WRITING_REFRESH_SCOPE/);
 assert.throws(()=>send(ready(oldStudio('orchestrator-voice.md')),'refresh-writing-instructions',{actor:'human',message:'ISOLATED'}),/WRITING_REFRESH_SCOPE/);
 p=reviewed(p);const a=current(p);p=send(p,'approve',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED exact script approved'});
 assert.throws(()=>send(p,'refresh-writing-instructions',{actor:'human',message:'ISOLATED'}),/WRITING_REFRESH_LOCKED/);
 assert.throws(()=>send(p,'note',{actor:'human',message:'ISOLATED silent late change',creativeDirection:direction}),/CREATIVE_DIRECTION_REWIND_REQUIRED/);
});
test('creative decisions survive SQLite restart without changing locks, budget or raw facts',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const dir=await mkdtemp(join(tmpdir(),'review-direction-'));let w=openWorkflow(join(dir,'state.sqlite'));
 try{let s=await w.init('run',inputs);let a=await w.respond('run',{taskId:s.pending.taskId,actor:'agent',action:'artifact',workerId:'writer',content:{inputs,sourceInputDigest:digest(inputs),commonSenseChecks:[]}});let p=reviewed(a.project);s=await w.respond('run',{taskId:a.pending.taskId,actor:'reviewer',action:'review',workerId:'independent-reviewer',artifactId:current(a.project).id,artifactDigest:current(a.project).digest,review:current(p).review});
 const art=current(s.project);s=await w.respond('run',{taskId:s.pending.taskId,actor:'human',action:'approve',artifactId:art.id,artifactDigest:art.digest,message:'ISOLATED exact answers approval'});
 await w.respond('run',{taskId:s.pending.taskId,actor:'human',action:'note',message:'ISOLATED record direction',creativeDirection:direction});w.close();w=openWorkflow(join(dir,'state.sqlite'));s=await w.status('run');assert.equal(s.pending.creativeDirections[0].direction,direction.direction);assert.deepEqual(s.project.inputs,inputs);assert.equal(s.project.budget.maxCostUsd,0);assert.equal(s.project.jobs.length,0);assert.equal(s.project.step,'script');assert.equal(current(s.project,'script'),undefined);
 }finally{w.close();await rm(dir,{recursive:true});}
});

test('completed media history does not prevent recording a new direction after explicit script rewind',async()=>{
 const {supervisedAudio}=await import('./supervised-helpers.mjs');const {revisionImpact}=await import('../runtime/workflow.mjs');
 let p=supervisedAudio(),a=current(p,'script');assert.ok(p.jobs.length);const impact=revisionImpact(p,a.id);
 assert.throws(()=>send(p,'note',{actor:'human',message:'ISOLATED late direction',creativeDirection:direction}),/CREATIVE_DIRECTION_REWIND_REQUIRED/);
 p=send(p,'changes',{actor:'human',artifactId:a.id,artifactDigest:a.digest,impactDigest:impact.impactDigest,message:'ISOLATED human confirms affected narration and cast rewind'});
 const jobs=structuredClone(p.jobs);p=send(p,'note',{actor:'human',message:'ISOLATED record new direction after rewind',creativeDirection:direction});
 assert.equal(p.step,'script');assert.deepEqual(p.jobs,jobs);assert.equal(p.creativeDirections[0].direction,direction.direction);assert.equal(current(p,'script'),undefined);
});

test('a new human creative requirement blocks approval under the previous passing script review',async()=>{
 let p=ready();p=reviewed(send(p,'artifact',{workerId:'writer',content:{...script,commonSenseChecks:[],proposedCast}}));
 const old=structuredClone(current(p));assert.equal(p.gate,'human');
 p=send(p,'note',{actor:'human',message:'ISOLATED change the design requirement',creativeDirection:direction});
 assert.equal(p.gate,'review');assert.deepEqual(current(p),old);
 assert.throws(()=>send(p,'approve',{artifactId:old.id,artifactDigest:old.digest,message:'ISOLATED try approving old verdict'}),/exact current agent-passing artifact/);
 const t=await prepareCrewTask(p,taskFor(p));assert.equal(t.actor,'reviewer');assert.equal(t.creativeDirections[0].direction,direction.direction);
 assert.equal(p.jobs.length,0);assert.equal(current(p,'answers').approvedBy.message,'ISOLATED approve exact memories');
});
