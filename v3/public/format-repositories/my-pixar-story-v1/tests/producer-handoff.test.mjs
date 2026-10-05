import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {initialProject,taskFor,openWorkflow,current,revisionImpact} from '../runtime/workflow.mjs';
import {crewRoles} from '../runtime/crew.mjs';
import {producerUpdate} from '../runtime/presentation.mjs';
import {Project,digest} from '../runtime/contracts.mjs';
import {inputs,script,event,send,intakeFixture,file} from './helpers.mjs';

const crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`ISOLATED-producer-${role}`,name,role,modelVersion:'ISOLATED-model',capabilityVersion:'ISOLATED-tools',execution:'host'}))};
const bind=p=>send(p,'configure-crew',{actor:'human',message:'ISOLATED configure test workers',crew});
const status=p=>({project:p,pending:taskFor(p)});
const author=p=>send(p,'artifact',{workerId:taskFor(p).crewWorker.workerId,content:script});
function review(p,decision='provisional'){
 const task=taskFor(p),worker=task.crewWorker;
 return send(p,'review',{workerId:worker.workerId,artifactId:task.artifact.id,artifactDigest:task.artifact.digest,review:{decision,perception:'direct-text',modelVersion:worker.modelVersion,capabilityVersion:worker.capabilityVersion,checks:task.criteria.map((criterion,i)=>({criterion,status:decision==='rejected'&&i===0?'fail':'pass',evidence:'ISOLATED source comparison',location:'ISOLATED Beat 1',repair:decision==='rejected'&&i===0?'ISOLATED repair the unsupported event.':''}))}});
}
const start=()=>bind(initialProject('ISOLATED-producer',inputs,{workflowRevision:2}));

test('producer names the completed author and next reviewer without claiming assigned work is running',()=>{
 let p=start();
 p=send(p,'configure-debug',{actor:'human',message:'ISOLATED enable debug',debugEnabled:true});
 p=send(p,'debug-next',{actor:'human',message:'ISOLATED continue'});p=author(p);
 const before=JSON.stringify(p),u=producerUpdate(status(p));
 assert.equal(u.reporter,'Orchestrator (Producer)');assert.match(u.message,/Leo \(Script Engineer\) submitted/);
 assert.match(u.message,/Sage \(Script Reviewer\) is next to review/);assert.match(u.message,/Waiting for your debug check/);assert.doesNotMatch(u.message,/paused/i);
 assert.equal(u.completion.artifactDigest,current(p).digest);assert.equal(u.completion.worker.workerId,current(p).authoredBy);
 assert.equal(u.nextWorker.status,'waiting-for-debug-continuation');assert.match(u.nextDecision,/approves nothing/);
 assert.doesNotMatch(u.message,/is preparing|is reviewing|is running/);assert.equal(JSON.stringify(p),before);
});

test('passing review is reported as a review result and human approval remains the next decision in debug mode',()=>{
 let p=review(author(start()));p=send(p,'configure-debug',{actor:'human',message:'ISOLATED enable debug',debugEnabled:true});
 const u=producerUpdate(status(p));assert.match(u.message,/Sage \(Script Reviewer\) completed the review: 6 checks passed/);
 assert.equal(u.nextWorker,null);assert.match(u.nextDecision,/Review this version/);assert.doesNotMatch(u.nextDecision,/continue|release/);
 assert.equal(current(p).approvedBy,undefined);assert.equal(u.completion.actor,'reviewer');
});

test('repair output names the actual reviewer and routes evidenced notes to the author, never previewing failed media',()=>{
 const p=review(author(start()),'rejected'),u=producerUpdate(status(p));
 assert.match(u.message,/Sage \(Script Reviewer\).*rejected with repair notes/);
 assert.match(u.message,/Leo \(Script Engineer\) is next to write/);assert.equal(u.nextWorker.status,'ready-for-dispatch');
 assert.equal(u.completion.findings[0].repair,'ISOLATED repair the unsupported event.');
 assert.equal(u.completion.findings[0].location,'ISOLATED Beat 1');assert.equal(current(p).approvedBy,undefined);
});

test('script approval requests the actual voice sample, not approval of a nonexistent deliverable or another debug continue',()=>{
 let p=review(author(start()));p=send(p,'configure-debug',{actor:'human',message:'ISOLATED enable debug',debugEnabled:true});
 p=send(p,'approve',{actor:'human',artifactId:current(p).id,artifactDigest:current(p).digest,message:'ISOLATED approve actual script',intakeConfirmation:intakeFixture(p)});
 const before=JSON.stringify(p),u=producerUpdate(status(p),'/isolated-test/run');
 assert.equal(u.stage,'voiceSample');assert.equal(u.completion.actor,'human');assert.match(u.message,/locked by your approval/);
 assert.match(u.nextDecision,/Record 20–30 seconds/);assert.match(u.message,/no background music/);
 assert.equal(u.inputRequest.minimumDurationSeconds,10);assert.equal(u.inputRequest.folder,'/isolated-test/run/incoming-voice');
 assert.equal(u.nextWorker,null);assert.doesNotMatch(u.nextDecision,/Review this version|continue|approve/i);
 assert.equal(p.jobs.length,0);assert.equal(JSON.stringify(p),before);
});

test('historical checkpoints receive actionable current-stage guidance without invented worker provenance',()=>{
 const p=review(author(start()));p.history=p.history.map(({sequence,action,actor,message,at})=>({sequence,action,actor,message,at}));
 const parsed=Project.parse(p),u=producerUpdate(status(parsed));assert.equal(u.completion,null);
 assert.doesNotMatch(u.message,/Sage.*completed|Leo.*submitted/);assert.equal(parsed.studio.sha256,p.studio.sha256);
 parsed.lifecycle='abandoned';const abandoned=producerUpdate(status(parsed));assert.equal(abandoned.message,'Project abandoned. No new production will run.');assert.equal(abandoned.nextWorker,null);assert.equal(abandoned.inputRequest,null);
});

test('input-folder prepares the runtime-provided location and preserves locks and state across CLI restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-producer-cli-')),runner=fileURLToPath(new URL('../runner.mjs',import.meta.url));let w=openWorkflow(join(dir,'checkpoints.sqlite'));
 try{
  let s=await w.init('project',inputs,{workflowRevision:2});s=await w.respond('project',event(s.project,'configure-crew',{actor:'human',message:'ISOLATED crew',crew}));
  s=await w.respond('project',event(s.project,'artifact',{workerId:s.pending.crewWorker.workerId,content:{...script,commonSenseChecks:[]}}));
  const p=review(s.project);s=await w.respond('project',event(s.project,'review',{workerId:s.pending.crewWorker.workerId,artifactId:current(s.project).id,artifactDigest:current(s.project).digest,review:current(p).review}));
  const a=current(s.project);s=await w.respond('project',event(s.project,'approve',{actor:'human',artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED approve script',intakeConfirmation:{voiceConsent:true,characters:[{id:'alex',name:'Alex',ageVariant:'adult',minor:false,photoRights:true,references:[],likeness:'interpreted',decisionNotes:'ISOLATED interpretation'}],resolvedFindings:[]}}));
  const checkpoint=s.checkpointId,sequence=s.project.sequence,digest=a.digest;w.close();w=null;
  const invoke=(...args)=>JSON.parse(execFileSync(process.execPath,[runner,...args,'--run',dir],{encoding:'utf8'}));
  const displayed=invoke('status');assert.match(displayed.producer.message,/Record 20–30 seconds/);
  await assert.rejects(access(join(dir,'incoming-voice'))); // status remains read-only
  const folder=invoke('input-folder');assert.equal(folder.folder,displayed.producer.inputRequest.folder);assert.equal(folder.opened,false);assert.equal(folder.providerCalls,0);
  await access(folder.folder);const after=invoke('status');assert.equal(after.checkpointId,checkpoint);assert.equal(after.sequence,sequence);assert.equal(after.validArtifacts.find(a=>a.kind==='script').digest,digest);
  await writeFile(join(dir,'note.json'),JSON.stringify({taskId:after.pending.taskId,actor:'human',action:'abandon',message:'ISOLATED abandon'}));invoke('respond',join(dir,'note.json'));
  assert.throws(()=>invoke('input-folder'),/INPUT_FOLDER_UNAVAILABLE/);
 }finally{w?.close();await rm(dir,{recursive:true});}
});


test('provider planning and unknown submission outcomes are reported without claiming a finished generation or requesting another plan',()=>{
 let p=review(author(start()));p=send(p,'approve',{actor:'human',artifactId:current(p).id,artifactDigest:current(p).digest,message:'ISOLATED approve script',intakeConfirmation:intakeFixture(p)});
 p=send(p,'artifact',{actor:'human',workerId:crew.workers[0].workerId,content:{files:[file()],consent:true,language:'en'}});
 const sampleUpdate=producerUpdate(status(p));assert.equal(sampleUpdate.completion.worker,null);assert.match(sampleUpdate.completion.message,/You submitted/);
 p=send(p,'set-budget',{actor:'human',message:'ISOLATED budget',budgetLimitUsd:1});
 p=send(p,'plan',{workerId:taskFor(p).crewWorker.workerId,plan:{provider:'cartesia',operation:'clone',estimatedCostUsd:.05,parameters:{}}});
 let u=producerUpdate(status(p));assert.match(u.message,/Max \(Generation Planner\) prepared a request and cost estimate for voice clone/);assert.equal(u.completion.jobId,p.jobs.at(-1).id);assert.match(u.nextDecision,/spend/);
 const job=p.jobs.at(-1);p=send(p,'authorize',{actor:'human',jobId:job.id,artifactDigest:job.digest,message:'ISOLATED authorize exact test request'});
 u=producerUpdate(status(p));assert.match(u.message,/ready for submission/);assert.equal(u.nextWorker,null);assert.doesNotMatch(u.message,/prepare the exact request|clone complete/);
 p=send(p,'begin',{jobId:job.id,artifactDigest:job.digest});u=producerUpdate(status(p));assert.match(u.completion.message,/outcome is not confirmed/);
 p=send(p,'provider-error',{jobId:job.id,artifactDigest:job.digest,message:'ISOLATED submission timeout'});u=producerUpdate(status(p));assert.match(u.message,/execution stopped/);assert.equal(u.completion.diagnostic,'ISOLATED submission timeout');assert.equal(p.jobs.length,1);assert.equal(p.jobs[0].status,'uncertain');
});


test('rewinding an approval or requiring fresh review never reports the old decision as a current lock or pass',()=>{
 let p=review(author(start()));const a=current(p);
 p=send(p,'approve',{actor:'human',artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED approve script',intakeConfirmation:intakeFixture(p)});
 p=send(p,'changes',{actor:'human',artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED change the script',impactDigest:revisionImpact(p,a.id).impactDigest});
 let u=producerUpdate(status(p));assert.equal(u.completion,null);assert.doesNotMatch(u.message,/locked by your approval/);
 p=review(author(p));p=send(p,'note',{actor:'human',message:'ISOLATED new direction',creativeDirection:{scope:'script',direction:'ISOLATED change the emphasis',sourceMessages:['ISOLATED new direction']}});
 u=producerUpdate(status(p));assert.equal(p.gate,'review');assert.equal(u.completion,null);assert.doesNotMatch(u.message,/checks passed/);assert.match(u.message,/Sage.*next to review/);
});


test('a saved worker failure requests diagnosis, not another normal dispatch or a guessed completion',()=>{
 let p=start();p=send(p,'configure-debug',{actor:'human',message:'ISOLATED enable debug',debugEnabled:true});p=send(p,'debug-stop',{actor:'runtime',message:'ISOLATED worker outcome unknown; inspect saved receipt'});
 const before=JSON.stringify(p),u=producerUpdate(status(p));assert.match(u.message,/STOP.*blocked after an error/);assert.match(u.diagnostic,/outcome unknown/);assert.equal(u.nextWorker,null);assert.equal(u.inputRequest,null);assert.equal(u.completion,null);assert.doesNotMatch(u.nextDecision,/say.*continue/);assert.match(u.nextDecision,/Do not repeat an unknown request/);assert.equal(JSON.stringify(p),before);
 p=send(p,'debug-next',{actor:'human',message:'ISOLATED continue'});const continued=producerUpdate(status(p));assert.equal(continued.nextWorker,null);assert.equal(continued.diagnostic,u.diagnostic);assert.match(continued.message,/STOP.*blocked after an error/);
});


test('default revision-4 debug accepts genuine human sample input while keeping workers and provider submission paused',()=>{
 let p=bind(initialProject('ISOLATED-v4-human-sample',inputs));
 p=send(p,'artifact',{workerId:taskFor(p).crewWorker.workerId,content:{inputs:p.inputs,sourceInputDigest:digest(p.inputs),commonSenseChecks:[]}});p=review(p);
 p=send(p,'approve',{actor:'human',artifactId:current(p).id,artifactDigest:current(p).digest,message:'ISOLATED confirm answers'});
 p=send(p,'artifact',{workerId:taskFor(p).crewWorker.workerId,content:{...script,commonSenseChecks:[],proposedCast:[{id:'alex',name:'Alex',ageVariant:'adult',minor:false,storyPurpose:'ISOLATED narrator memories'}]}});p=review(p);
 p=send(p,'configure-debug',{actor:'human',message:'ISOLATED enable debug',debugEnabled:true});
 p=send(p,'approve',{actor:'human',artifactId:current(p).id,artifactDigest:current(p).digest,message:'ISOLATED approve story and cast'});
 assert.equal(p.step,'voiceSample');assert.equal(p.debug.paused,true);assert.match(producerUpdate(status(p)).nextDecision,/Record 20–30 seconds/);
 const content={files:[file()],consent:true,language:'en'};
 assert.throws(()=>send(p,'artifact',{actor:'agent',workerId:crew.workers[0].workerId,content}),/DEBUG_PAUSED|CREW_PERMISSION_DENIED/);
 p=send(p,'artifact',{actor:'human',workerId:'ISOLATED-human',content});assert.equal(p.step,'clone');assert.equal(p.debug.paused,true);assert.equal(p.jobs.length,0);assert.equal(current(p,'script').approvedBy.message,'ISOLATED approve story and cast');
 assert.throws(()=>send(p,'plan',{workerId:taskFor(p).crewWorker.workerId,plan:{provider:'cartesia',operation:'clone',estimatedCostUsd:.05,parameters:{}}}),/DEBUG_PAUSED/);
});

test('authorized submission requires debug continuation but completed reconciliation requests only existing collection or a fresh scoped plan',()=>{
 for(const outcome of ['confirmed-no-result','confirmed-unusable-result','confirmed-completed','collect-existing']){
  let p=review(author(start()));p=send(p,'approve',{actor:'human',artifactId:current(p).id,artifactDigest:current(p).digest,message:'ISOLATED approve script',intakeConfirmation:intakeFixture(p)});
  p=send(p,'artifact',{actor:'human',workerId:'ISOLATED-human',content:{files:[file()],consent:true,language:'en'}});p=send(p,'set-budget',{actor:'human',message:'ISOLATED budget',budgetLimitUsd:1});
  p=send(p,'plan',{workerId:taskFor(p).crewWorker.workerId,plan:{provider:'cartesia',operation:'clone',estimatedCostUsd:.05,parameters:{}}});const job=p.jobs.at(-1);
  p=send(p,'configure-debug',{actor:'human',message:'ISOLATED enable debug',debugEnabled:true});p=send(p,'authorize',{actor:'human',jobId:job.id,artifactDigest:job.digest,message:'ISOLATED authorize exact request'});
  let u=producerUpdate(status(p));assert.equal(p.gate,'collect');assert.match(u.nextDecision,/continue/);assert.equal(u.nextWorker,null);
  assert.throws(()=>send(p,'begin',{jobId:job.id,artifactDigest:job.digest}),/DEBUG_PAUSED/);p=send(p,'debug-next',{actor:'human',message:'ISOLATED continue submission'});p=send(p,'begin',{jobId:job.id,artifactDigest:job.digest});
  p=send(p,'provider-error',{jobId:job.id,artifactDigest:job.digest,message:'ISOLATED response missing'});p=send(p,'reconcile',{actor:'human',jobId:job.id,artifactDigest:job.digest,message:'ISOLATED actual provider outcome/direction',result:{outcome}});
  u=producerUpdate(status(p));assert.equal(u.completion.jobId,job.id);assert.equal(p.jobs.length,1);assert.equal(p.jobs[0].reconciliation.outcome,outcome);assert.doesNotMatch(u.message,/needs reconciliation before any retry/);
  if(['confirmed-no-result','confirmed-unusable-result'].includes(outcome)){assert.equal(p.gate,'produce');assert.match(u.message,/fresh scoped plan/);assert.match(u.nextDecision,/continue/);}
  else {assert.equal(p.gate,'collect');assert.match(u.nextDecision,/Collect the existing/);assert.doesNotMatch(u.nextDecision,/continue|reconcile/);assert.match(u.message,/No replacement request is authorized/);}
 }
});


function blockedPlanning(){
 let p=review(author(start()));p=send(p,'approve',{actor:'human',artifactId:current(p).id,artifactDigest:current(p).digest,message:'ISOLATED story approval',intakeConfirmation:intakeFixture(p)});
 p=send(p,'artifact',{actor:'human',workerId:'human',content:{files:[file()],consent:true,language:'en'}});
 return p;
}

test('billing readiness alert requires problem, solution and canonical baby steps without a fake API failure',()=>{
 const p=blockedPlanning(),task=taskFor(p),message='ISOLATED no account-verified cost; technical identifiers stay internal.',base={actor:'agent',workerId:task.crewWorker.workerId,message};
 assert.throws(()=>send(p,'planning-blocked',base),/PLANNING_HELP_REQUIRED/);
 for(const replacement of [{problem:'No paid plan so this request definitely fails'},{solution:'Pay immediately; free TTS is forbidden'},{steps:['Paste your API key into this chat']}]){
  assert.throws(()=>send(p,'planning-blocked',{...base,blocker:{kind:'account-readiness',...task.planningGuide,...replacement}}),/PLANNING_HELP_BINDING/);
 }
 const q=send(p,'planning-blocked',{...base,blocker:{kind:'account-readiness',...task.planningGuide}}),bytes=JSON.stringify(q),u=producerUpdate(status(q));
 assert.equal(u.alert.severity,'stop');assert.equal(u.alert.reportedBy,'Max (Generation Planner)');assert.equal(u.alert.problem,task.planningGuide.problem);assert.equal(u.alert.solution,task.planningGuide.solution);assert.deepEqual(u.alert.steps,task.planningGuide.steps);assert.match(u.message,/STOP/);assert.match(u.message,/https:\/\/play.cartesia.ai\/subscription/);assert.match(u.message,/Unknown credits alone do not block planning/);assert.doesNotMatch(u.message,/technical identifiers|which plan|HTTP 402|API failed/);assert.equal(u.diagnostic,message);assert.equal(u.nextWorker,null);assert.equal(q.jobs.length,0);assert.equal(JSON.stringify(q),bytes);
 assert.deepEqual(Project.parse(q).history.at(-1).blocker,u.completion.blocker);assert.equal(u.stage,'clone');assert.doesNotMatch(u.message,/paused|audition/i);assert.equal(u.debugNote,null);
});

test('missing-input and historical blockers retain diagnostics without inventing billing evidence or approvals',()=>{
 const p=blockedPlanning(),task=taskFor(p),blocker={kind:'missing-input',problem:'The selected audio source is unavailable.',solution:'Restore the approved source before planning.',steps:['Restore the exact approved source file, then request a file verification.']};
 let q=send(p,'planning-blocked',{actor:'agent',workerId:task.crewWorker.workerId,message:'ISOLATED exact missing file evidence',blocker}),u=producerUpdate(status(q));assert.equal(u.alert.kind,'missing-input');assert.match(u.message,/Restore the approved source/);assert.doesNotMatch(u.message,/Subscription|credits/);
 delete q.history.at(-1).blocker;u=producerUpdate(status(Project.parse(q)));assert.equal(u.alert,undefined);assert.match(u.completion.diagnostic,/exact missing file/);assert.match(u.message,/^STOP.*blocked/);assert.doesNotMatch(u.message,/paused|audition|ISOLATED exact missing file/i);assert.equal(u.diagnostic,'ISOLATED exact missing file evidence');assert.equal(q.gate,'escalate');assert.equal(q.jobs.length,0);
 const before=JSON.stringify(q);producerUpdate(status(q));assert.equal(JSON.stringify(q),before);q=send(q,'resolve',{actor:'human',message:'ISOLATED restored the missing input'});u=producerUpdate(status(q));assert.equal(q.gate,'produce');assert.doesNotMatch(u.message,/is blocked|STOP|paused/i);assert.equal(q.jobs.length,0);
});
