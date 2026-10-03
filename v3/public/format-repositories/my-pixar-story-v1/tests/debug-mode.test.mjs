import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openWorkflow,initialProject,applyEvent,taskFor} from '../runtime/workflow.mjs';
import {crewRoles,runCrewTask} from '../runtime/crew.mjs';
import {driveCrew} from '../runtime/codex-host.mjs';
import {debugSnapshot} from '../runtime/debug.mjs';
import {executeJob} from '../runtime/providers.mjs';
import {renderFilm} from '../runtime/assemble.mjs';
import {verifyFiles} from '../runtime/media.mjs';
import {inputs,script,event,intakeFixture,authored,reviewed,approved,send,file} from './helpers.mjs';
import {producerUpdate} from '../runtime/presentation.mjs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`isolated-debug-${role}`,name,role,modelVersion:'isolated-debug-model',capabilityVersion:'isolated-debug-tools',execution:'host'}))};
const control=(p,action,extra={})=>event(p,action,{actor:'human',message:'ISOLATED operator instruction',...extra});
const author=(task,worker,content=script)=>({taskId:task.taskId,actor:'agent',workerId:worker.workerId,action:'artifact',content});
const review=(task,worker,decision='approved')=>({taskId:task.taskId,actor:'reviewer',workerId:worker.workerId,action:'review',artifactId:task.artifact.id,artifactDigest:task.artifact.digest,review:{decision,perception:'direct-text',modelVersion:worker.modelVersion,capabilityVersion:worker.capabilityVersion,checks:task.criteria.map((criterion,i)=>({criterion,status:decision==='rejected'&&i===0?'fail':'pass',location:'ISOLATED beat 1',evidence:decision==='rejected'?'ISOLATED planted unsupported detail.':'ISOLATED fixture checked.',repair:decision==='rejected'?'Remove the planted unsupported detail.':''}))}});

test('debug controls require human authority and preserve creative task identity and legacy checkpoints',()=>{
 const p=initialProject('isolated-debug',inputs,{workflowRevision:2});assert.equal(p.debug,undefined);
 assert.throws(()=>applyEvent(p,control(p,'configure-debug',{actor:'agent',debugEnabled:true})),/human authority/);
 assert.throws(()=>applyEvent(p,control(p,'configure-debug',{debugEnabled:true,message:undefined})),/instruction/);
 const paused=applyEvent(p,control(p,'configure-debug',{debugEnabled:true}));
 assert.deepEqual(paused.debug,{enabled:true,paused:true});assert.equal(paused.sequence,p.sequence);assert.equal(taskFor(paused).taskId,taskFor(p).taskId);
 assert.throws(()=>applyEvent(paused,event(paused,'artifact',{workerId:'isolated',content:script})),/DEBUG_PAUSED/);
 const next=applyEvent(paused,control(paused,'debug-next'));assert.equal(taskFor(next).taskId,taskFor(paused).taskId);
 assert.throws(()=>applyEvent(next,control(next,'debug-next')),/NOT_PAUSED/);
 const off=applyEvent(paused,control(paused,'configure-debug',{debugEnabled:false}));assert.deepEqual(off.debug,{enabled:false,paused:false});assert.deepEqual(off.artifacts,p.artifacts);
});

test('debug persists across SQLite restart and stops after each worker, even with a batch request',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-debug-step-')),database=join(dir,'state.sqlite');let workflow=openWorkflow(database),calls=0;
 const host={runTask:async(task,{worker})=>{calls++;return task.gate==='author'?author(task,worker):review(task,worker);}};
 const options={maxTasks:8,receiptDirectory:join(dir,'host-dispatch')};
 try{
  let status=await workflow.init('run',inputs,{workflowRevision:2});status=await workflow.respond('run',control(status.project,'configure-crew',{crew}));
  status=await workflow.respond('run',control(status.project,'configure-debug',{debugEnabled:true}));
  assert.equal((await driveCrew(workflow,'run',host,options)).completed,0);assert.equal(calls,0);
  await workflow.respond('run',control(status.project,'debug-next'));
  const first=await driveCrew(workflow,'run',host,options);assert.equal(first.completed,1);assert.equal(first.stop,'debug-pause');assert.equal(first.status.pending.gate,'review');assert.equal(calls,1);
  workflow.close();workflow=openWorkflow(database);status=await workflow.status('run');assert.equal(status.project.debug.paused,true);
  await workflow.respond('run',control(status.project,'debug-next'));
  const second=await driveCrew(workflow,'run',host,options);assert.equal(second.completed,1);assert.equal(second.status.pending.gate,'human');assert.equal(calls,2);
  const a=second.status.pending.artifact;
  status=await workflow.respond('run',event(second.status.project,'approve',{artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED approved actual fixture',intakeConfirmation:intakeFixture(second.status.project)}));
  assert.equal(status.project.step,'voiceSample');assert.equal(status.project.debug.paused,true);
  assert.equal((await driveCrew(workflow,'run',host,options)).completed,0);assert.equal(calls,2);
 }finally{workflow.close();await rm(dir,{recursive:true});}
});

test('rejected work remains inspectable and cannot automatically proceed to the repair author',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-debug-rejected-')),workflow=openWorkflow(join(dir,'state.sqlite'));let calls=0;
 const host={runTask:async(task,{worker})=>{calls++;return task.gate==='author'?author(task,worker):review(task,worker,'rejected');}},options={maxTasks:8,receiptDirectory:join(dir,'host-dispatch')};
 try{
  let status=await workflow.init('run',inputs,{workflowRevision:2});status=await workflow.respond('run',control(status.project,'configure-crew',{crew}));status=await workflow.respond('run',control(status.project,'configure-debug',{debugEnabled:true}));
  await workflow.respond('run',control(status.project,'debug-next'));status=(await driveCrew(workflow,'run',host,options)).status;
  await workflow.respond('run',control(status.project,'debug-next'));status=(await driveCrew(workflow,'run',host,options)).status;
  assert.equal(calls,2);assert.equal(status.pending.gate,'author');assert.equal(status.project.debug.paused,true);
  const snapshot=await debugSnapshot(status,dir);assert.equal(snapshot.latestArtifact.review.decision,'rejected');assert.deepEqual(snapshot.latestArtifact.content,script);assert.equal(snapshot.providerCalls,0);assert.equal(snapshot.approvesNothing,true);
  assert.equal((await driveCrew(workflow,'run',host,options)).completed,0);assert.equal(calls,2);
 }finally{workflow.close();await rm(dir,{recursive:true});}
});

test('malformed finished output pauses without changing its recoverable receipt or task ID',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-debug-invalid-')),workflow=openWorkflow(join(dir,'state.sqlite'));let calls=0;
 const host={runTask:async(task,{worker})=>author(task,worker,++calls===1?{beats:[]}:script)},options={maxTasks:8,receiptDirectory:join(dir,'host-dispatch')};
 try{
  let status=await workflow.init('run',inputs,{workflowRevision:2});status=await workflow.respond('run',control(status.project,'configure-crew',{crew}));status=await workflow.respond('run',control(status.project,'configure-debug',{debugEnabled:true}));status=await workflow.respond('run',control(status.project,'debug-next'));const taskId=status.pending.taskId;
  await assert.rejects(driveCrew(workflow,'run',host,options),/RESULT_REJECTED/);status=await workflow.status('run');assert.equal(status.pending.taskId,taskId);assert.equal(status.project.debug.paused,true);
  const snapshot=await debugSnapshot(status,dir);assert.equal(snapshot.currentDispatch.status,'rejected');assert.deepEqual(snapshot.currentDispatch.event.content,{beats:[]});
  assert.equal((await driveCrew(workflow,'run',host,{...options,repairInvalid:true})).completed,0);assert.equal(calls,1);
  await workflow.respond('run',control(status.project,'debug-next'));
  const repaired=await driveCrew(workflow,'run',host,{...options,repairInvalid:true});assert.equal(calls,2);assert.equal(repaired.completed,1);assert.equal(repaired.status.project.debug.paused,true);
 }finally{workflow.close();await rm(dir,{recursive:true});}
});

test('paused debug refuses workers, provider submissions and rendering before side effects',async()=>{
 let p=initialProject('isolated-debug-guards',inputs,{workflowRevision:2});p=applyEvent(p,control(p,'configure-debug',{debugEnabled:true}));let calls=0;
 await assert.rejects(runCrewTask(p,taskFor(p),{runTask:async()=>{calls++;}}),/DEBUG_PAUSED/);
 await assert.rejects(executeJob(p,{},'/isolated-test','',async()=>{calls++;}),/DEBUG_PAUSED/);
 await assert.rejects(renderFilm(p,'/isolated-test'),/DEBUG_PAUSED/);assert.equal(calls,0);
 const ready=applyEvent(p,control(p,'debug-next'));
 assert.throws(()=>applyEvent(ready,event(ready,'plan',{plan:{provider:'replicate',operation:'video',estimatedCostUsd:1,parameters:{}}})),/generation|plan|stage|NARRATION/i);
 assert.equal(ready.artifacts.length,0);assert.equal(ready.jobs.length,0);
});

test('debug may collect a submitted job while paused, but cannot submit it again',()=>{
 let p=approved(reviewed(authored(initialProject('isolated-debug-collect',inputs,{workflowRevision:2,reviewMode:'qualified'}))));
 p=send(p,'artifact',{actor:'human',workerId:'human',content:{files:[file()],consent:true,language:'en'}});
 p=send(p,'plan',{plan:{provider:'cartesia',operation:'clone',estimatedCostUsd:.05,parameters:{}}});const job=p.jobs.at(-1);
 p=send(p,'authorize',{jobId:job.id,artifactDigest:job.digest,message:'ISOLATED exact authorization'});
 p=applyEvent(p,control(p,'configure-debug',{debugEnabled:true}));p=applyEvent(p,control(p,'debug-next'));
 p=send(p,'begin',{jobId:job.id,artifactDigest:job.digest});assert.equal(p.debug.paused,false);
 p=send(p,'job-id',{jobId:job.id,artifactDigest:job.digest,providerJobId:'isolated-submitted-job'});assert.equal(p.debug.paused,true);
 assert.throws(()=>send(p,'begin',{jobId:job.id,artifactDigest:job.digest}),/DEBUG_PAUSED/);
 const collected=send(p,'receipt',{jobId:job.id,artifactDigest:job.digest,result:{provider:'cartesia',voiceId:'isolated-clone',receiptId:job.id}});
 assert.equal(collected.jobs[0].status,'ready');assert.equal(collected.debug.paused,true);assert.equal(collected.artifacts.at(-1).kind,'clone');
 const ready=applyEvent(collected,control(collected,'debug-next'));
 assert.throws(()=>send(ready,'begin',{jobId:job.id,artifactDigest:job.digest}),/current authorized|ALREADY_SUBMITTED/);
});

test('file verification errors stay repairable, including old completed receipts',async()=>{
 for(const cached of [false,true]){
  const dir=await mkdtemp(join(tmpdir(),'memoir-debug-files-')),workflow=openWorkflow(join(dir,'state.sqlite'));let calls=0;
  const missing={path:join(dir,'missing.json'),sha256:'a'.repeat(64),bytes:99};
  const bad={...script,commonSenseChecks:[{category:'fact',finding:'ISOLATED bad optional reference',resolution:'ISOLATED reference',file:missing}]};
  // Script strips unrecognized fields; use the event's optional content reference
  // to test the actual submission verifier without manufacturing a bad schema.
  const host={runTask:async(task,{worker})=>{calls++;return author(task,worker,calls===1?bad:script);}},options={maxTasks:8,receiptDirectory:join(dir,'host-dispatch'),verifySubmission:async(_status,e)=>verifyFiles(e.content)};
  try{
   let status=await workflow.init('run',inputs,{workflowRevision:2});status=await workflow.respond('run',control(status.project,'configure-crew',{crew}));status=await workflow.respond('run',control(status.project,'configure-debug',{debugEnabled:true}));status=await workflow.respond('run',control(status.project,'debug-next'));
   const path=join(options.receiptDirectory,status.pending.taskId+'.json');
   if(cached){await mkdir(options.receiptDirectory,{recursive:true});await writeFile(path,JSON.stringify({status:'completed',taskId:status.pending.taskId,workerDigest:(await import('../runtime/contracts.mjs')).digest(status.pending.crewWorker),attempt:1,event:author(status.pending,status.pending.crewWorker,bad)}));calls=1;}
   await assert.rejects(driveCrew(workflow,'run',host,options),/RESULT_REJECTED.*ENOENT/);
   const receipt=JSON.parse(await readFile(path,'utf8'));assert.equal(receipt.status,'rejected');assert.equal(calls,1);
   status=await workflow.status('run');assert.equal(status.project.debug.paused,true);assert.equal(status.project.artifacts.length,0);
   await workflow.respond('run',control(status.project,'debug-next'));
   const repaired=await driveCrew(workflow,'run',host,{...options,repairInvalid:true});assert.equal(repaired.completed,1);assert.equal(calls,2);assert.equal(repaired.status.project.debug.paused,true);
  }finally{workflow.close();await rm(dir,{recursive:true});}
 }
});

test('unknown worker outcomes remain unrepeated even after explicit debug continue',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-debug-uncertain-')),workflow=openWorkflow(join(dir,'state.sqlite'));let calls=0;
 const host={runTask:async()=>{calls++;throw new Error('ISOLATED timeout; outcome unknown');}},options={maxTasks:8,receiptDirectory:join(dir,'host-dispatch')};
 try{
  let status=await workflow.init('run',inputs,{workflowRevision:2});status=await workflow.respond('run',control(status.project,'configure-crew',{crew}));status=await workflow.respond('run',control(status.project,'configure-debug',{debugEnabled:true}));await workflow.respond('run',control(status.project,'debug-next'));
  await assert.rejects(driveCrew(workflow,'run',host,options),/outcome unknown/);status=await workflow.status('run');assert.equal(status.project.debug.paused,true);
  assert.equal((await debugSnapshot(status,dir)).currentDispatch.status,'started');await workflow.respond('run',control(status.project,'debug-next'));
  await assert.rejects(driveCrew(workflow,'run',host,{...options,repairInvalid:true}),/DISPATCH_UNCERTAIN/);assert.equal(calls,1);
 }finally{workflow.close();await rm(dir,{recursive:true});}
});

test('CLI debug control and read-only inspector use the real saved project without provider calls',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-debug-cli-')),runner=fileURLToPath(new URL('../runner.mjs',import.meta.url));
 const invoke=(...args)=>JSON.parse(execFileSync(process.execPath,[runner,...args,'--run',dir],{encoding:'utf8'}));
 try{
  const init=invoke('init',fileURLToPath(new URL('../examples/parent.json',import.meta.url)));
  const paused=invoke('debug','on','--message','ISOLATED debug instruction');assert.equal(paused.pending.taskId,init.pending.taskId);assert.equal(paused.debug.paused,true);
  assert.match(paused.producer.message,/Debug paused/);const snapshot=invoke('debug-inspect');assert.equal(snapshot.providerCalls,0);assert.equal(snapshot.operatorOnly,true);
  const after=invoke('status');assert.equal(after.checkpointId,snapshot.checkpointId);assert.equal(after.sequence,snapshot.sequence);
  const ready=invoke('debug-next','--message','ISOLATED continue one step');assert.equal(ready.debug.paused,false);
  const off=invoke('debug','off','--message','ISOLATED disable');assert.equal(off.debug.enabled,false);assert.equal(off.pending.taskId,init.pending.taskId);
  assert.match(producerUpdate({project:{step:'script',debug:{enabled:true,paused:true}},pending:{step:'script',gate:'review'}}).nextDecision,/Inspect/);
 }finally{await rm(dir,{recursive:true});}
});
