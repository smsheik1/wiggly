import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CodexHost,driveCrew,DEFAULT_WORKER_MODEL} from '../runtime/codex-host.mjs';
import {openWorkflow,initialProject,taskFor,applyEvent} from '../runtime/workflow.mjs';
import {inputs,intakeFixture,script,event,send,authored,reviewed,approved} from './helpers.mjs';
import {crewRoles,runCrewTask} from '../runtime/crew.mjs';

function fixture({respondTool=false,toolName='generateVideo',failTurn=false,wrongModel=false,failStartAt=0}={}){
 const requests=[],child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};
 let id=0,active;const persisted=new Set();
 const emit=value=>child.stdout.write(JSON.stringify(value)+'\n');
 const finish=()=>{const task=active.task;const result={taskId:task.taskId,actor:task.actor,workerId:task.worker.workerId,action:'artifact',content:script};emit({method:'item/completed',params:{threadId:active.threadId,turnId:'turn-isolated',item:{type:'agentMessage',text:JSON.stringify({eventJson:JSON.stringify(result)})}}});emit({method:'turn/completed',params:{threadId:active.threadId,turn:{id:'turn-isolated',status:failTurn?'failed':'completed',error:failTurn?{message:'ISOLATED provider unavailable'}:null}}});};
 child.stdin=new Writable({write(chunk,_encoding,callback){for(const line of chunk.toString().trim().split('\n')){const request=JSON.parse(line);requests.push(request);
  if(request.id===999){finish();continue;}
  if(request.method==='initialized')continue;
  if(request.method==='initialize'){emit({id:request.id,result:{platformFamily:'unix'}});continue;}
  if(request.method==='thread/start'&&id+1===failStartAt){failStartAt=0;emit({id:request.id,error:{message:'ISOLATED startup failure'}});continue;}
  if(request.method==='thread/start'){emit({id:request.id,result:{model:wrongModel?'wrong-model':request.params.model,thread:{id:`isolated-${++id}`}}});continue;}
  if(request.method==='thread/resume'){if(!persisted.has(request.params.threadId)){emit({id:request.id,error:{message:'no rollout found'}});continue;}emit({id:request.id,result:{model:request.params.model,thread:{id:request.params.threadId}}});continue;}
  if(request.method==='turn/start'){persisted.add(request.params.threadId);
   if(request.params.input[0].text.startsWith('Initialization only:')){emit({id:request.id,result:{turn:{id:'init-turn'}}});emit({method:'item/completed',params:{threadId:request.params.threadId,turnId:'init-turn',item:{type:'agentMessage',text:'READY'}}});emit({method:'turn/completed',params:{threadId:request.params.threadId,turn:{id:'init-turn',status:'completed'}}});continue;}
   active={threadId:request.params.threadId,task:JSON.parse(request.params.input[0].text).task};
   // Early notifications and stale turns cannot substitute for this current turn.
   emit({method:'turn/completed',params:{threadId:active.threadId,turn:{id:'stale-turn',status:'completed'}}});
   emit({id:request.id,result:{turn:{id:'turn-isolated'}}});
   if(respondTool)emit({id:999,method:'item/tool/call',params:{threadId:active.threadId,turnId:'turn-isolated',tool:'wiggly_tool',arguments:{name:toolName,sha256:'unscoped',referenceSha256:null}}});else finish();
  }
 }callback();}});
 return {child,requests,spawnProcess:()=>child};
}

test('Codex bridge uses the explicitly selected model, real role threads and scoped dynamic tools',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-codex-protocol-')),mock=fixture({respondTool:true}),host=new CodexHost({cwd:dir,spawnProcess:mock.spawnProcess});host.profile=async()=> 'isolated-host-profile';
 try{
  await host.initialize();const crew=await host.startCrew();assert.equal(DEFAULT_WORKER_MODEL,'gpt-5.6-sol');assert.equal(crew.workers.length,Object.keys(crewRoles).length);assert.equal(new Set(crew.workers.map(w=>w.workerId)).size,crew.workers.length);
  const p=send(initialProject('bridge',inputs,{workflowRevision:2}),'configure-crew',{actor:'human',message:'ISOLATED bridge',crew});const task=taskFor(p);
  const result=await runCrewTask(p,task,host);assert.equal(result.workerId,crew.workers[0].workerId);assert.deepEqual(result.content,script);
  const payload=JSON.parse(mock.requests.findLast(r=>r.method==='turn/start').params.input[0].text);
  const quotes=payload.contentSchema.properties.beats.items.properties.directQuotes;assert.equal(quotes.type,'array');assert.ok(quotes.items.properties.sourceAnswer.enum.includes('scene1Childhood'));assert.ok(quotes.items.properties.sourceField);
  assert.equal(payload.task.studioConfig.writingPolicy,'grounded-v1');assert.match(payload.task.skill.content,/Direct quotations must keep the selected source words exactly/);
  const start=mock.requests.find(r=>r.method==='thread/start');assert.equal(start.params.allowProviderModelFallback,false);assert.equal(start.params.sandbox,'read-only');assert.equal(start.params.dynamicTools[0].name,'wiggly_tool');
  assert.match(mock.requests.find(r=>r.id===999).result.contentItems[0].text,/TOOL_PERMISSION_DENIED/);
  assert.equal(mock.requests.filter(r=>r.method==='turn/start').length,crew.workers.length+1);
 }finally{host.close();await rm(dir,{recursive:true});}
});

test('model/profile changes and failed host turns stop without fallback or retry',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-codex-error-'));
 for(const options of [{wrongModel:true},{failTurn:true}]){
  const mock=fixture(options),host=new CodexHost({cwd:dir,spawnProcess:mock.spawnProcess});host.profile=async()=> 'isolated-host-profile';
  try{await host.initialize();if(options.wrongModel){await assert.rejects(host.startCrew(),/MODEL_CHANGED/);continue;}
   const crew=await host.startCrew(),worker=crew.workers[0];await assert.rejects(host.runTask({step:'script',taskId:'isolated',actor:'agent'},{worker:{...worker,capabilityVersion:'stale'},callTool:async()=>{}}),/PROFILE_CHANGED/);
   await assert.rejects(host.runTask({step:'script',taskId:'isolated',actor:'agent'},{worker,callTool:async()=>{}}),/TURN_FAILED/);assert.equal(mock.requests.filter(r=>r.method==='turn/start').length,crew.workers.length+1);
  }finally{host.close();await rm(join(dir,'crew-startup.json'),{force:true});}
 }
 await rm(dir,{recursive:true});
});

test('native answers task sends the exact source fingerprint and raw-copy rule to the worker',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-native-answers-')),mock=fixture(),host=new CodexHost({cwd:dir,spawnProcess:mock.spawnProcess});host.profile=async()=> 'isolated-host-profile';
 try{
  await host.initialize();const crew=await host.startCrew(),p=send(initialProject('native-answers',inputs,{workflowRevision:3}),'configure-crew',{actor:'human',message:'ISOLATED native source binding',crew}),task=taskFor(p);
  await host.runTask(task,{worker:task.crewWorker,callTool:async()=>{throw new Error('No tools needed for answers.');}});
  const payload=JSON.parse(mock.requests.findLast(r=>r.method==='turn/start').params.input[0].text);
  assert.equal(payload.task.sourceInputDigest,task.sourceInputDigest);assert.deepEqual(payload.task.sourceInputs,inputs);
  assert.equal(payload.contentSchema.properties.sourceInputDigest.const,task.sourceInputDigest);assert.match(payload.contentSchema.properties.inputs.description,/copy task.sourceInputs exactly/);
 }finally{host.close();await rm(dir,{recursive:true});}
});

test('fatal external perception failures terminate the host turn before a worker can return a verdict',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-gemini-fatal-')),mock=fixture({respondTool:true,toolName:'listenAudio'}),host=new CodexHost({cwd:dir,spawnProcess:mock.spawnProcess});host.profile=async()=> 'isolated';
 try{await host.initialize();const crew=await host.startCrew(),worker=crew.workers.find(w=>w.role==='audio-reviewer');
  await assert.rejects(host.runTask({step:'music',taskId:'isolated',actor:'reviewer'},{worker,callTool:async()=>{throw Object.assign(new Error('STOP: Gemini HTTP 401 ISOLATED'),{stopDispatch:true});}}),/STOP: Gemini/);
  assert.equal(mock.requests.filter(r=>r.method==='turn/start').length,crew.workers.length+1);
 }finally{host.close();await rm(dir,{recursive:true});}
});

test('bounded driver preserves SQLite task state and stops for human and production gates',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-codex-drive-'));const workflow=openWorkflow(join(dir,'checkpoints.sqlite'));
 const crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`isolated-${role}`,name,role,modelVersion:'isolated-host',capabilityVersion:'isolated-tools',execution:'host'}))};let calls=0;
 const host={runTask:async(task,{worker})=>{calls++;return task.gate==='author'?{taskId:task.taskId,actor:'agent',workerId:worker.workerId,action:'artifact',content:script}:{taskId:task.taskId,actor:'reviewer',workerId:worker.workerId,action:'review',artifactId:task.artifact.id,artifactDigest:task.artifact.digest,review:{decision:'approved',perception:'direct-text',modelVersion:worker.modelVersion,capabilityVersion:worker.capabilityVersion,checks:task.criteria.map(criterion=>({criterion,status:'pass',location:'ISOLATED script fixture',evidence:'ISOLATED fixture comparison',repair:''}))}};}};
 try{let status=await workflow.init('run',inputs,{workflowRevision:2});await workflow.respond('run',event(status.project,'configure-crew',{actor:'human',message:'ISOLATED configure',crew}));const result=await driveCrew(workflow,'run',host,{receiptDirectory:join(dir,'dispatch')});assert.equal(result.completed,2);assert.equal(result.status.project.gate,'human');assert.equal((await driveCrew(workflow,'run',host,{receiptDirectory:join(dir,'dispatch')})).completed,0);assert.equal(calls,2);
  const current=result.status.pending.artifact;await workflow.respond('run',{taskId:result.status.pending.taskId,actor:'human',action:'approve',artifactId:current.id,artifactDigest:current.digest,message:'ISOLATED fixture approval',intakeConfirmation:intakeFixture(result.status.project)});assert.equal((await driveCrew(workflow,'run',host,{receiptDirectory:join(dir,'dispatch')})).completed,0);assert.equal(calls,2);
  await assert.rejects(driveCrew(workflow,'run',host,{maxTasks:100,receiptDirectory:join(dir,'dispatch')}),/bounded/);
 }finally{workflow.close();await rm(dir,{recursive:true});}
});

test('partial crew initialization retains durable roles and never blindly repeats uncertain initialization',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-crew-partial-')),mock=fixture({failStartAt:15}),host=new CodexHost({cwd:dir,spawnProcess:mock.spawnProcess});host.profile=async()=> 'isolated-host-profile';
 try{await host.initialize();await assert.rejects(host.startCrew(),/startup failure/);const draft=JSON.parse(await readFile(join(dir,'crew-startup.json'),'utf8'));assert.equal(draft.workers.length,14);assert.equal(draft.pending,null);
  const crew=await host.startCrew();assert.equal(crew.workers.length,15);assert.deepEqual(crew.workers.slice(0,14),draft.workers);assert.equal(mock.requests.filter(r=>r.method==='turn/start').length,15);
  assert.deepEqual(await host.refreshCrew(crew),crew);assert.equal(mock.requests.filter(r=>r.method==='turn/start').length,15);
  await writeFile(join(dir,'crew-startup.json'),JSON.stringify({...draft,pending:{role:'generation-planner',workerId:'uncertain'}}));const before=mock.requests.length;await assert.rejects(host.startCrew(),/STARTUP_UNCERTAIN/);assert.equal(mock.requests.length,before);
 }finally{host.close();await rm(dir,{recursive:true});}
});

test('completed worker receipts survive a checkpoint failure; uncertain turns are never redispatched',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-dispatch-recovery-')),workflow=openWorkflow(join(dir,'state.sqlite'));
 const crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`isolated-${role}`,name,role,modelVersion:'isolated-host',capabilityVersion:'isolated-tools',execution:'host'}))};let calls=0;
 const host={runTask:async(task,{worker})=>{calls++;return {taskId:task.taskId,actor:'agent',action:'artifact',workerId:worker.workerId,content:script};}},options={maxTasks:1,receiptDirectory:join(dir,'dispatch')};
 try{const init=await workflow.init('run',inputs,{workflowRevision:2});await workflow.respond('run',event(init.project,'configure-crew',{actor:'human',message:'ISOLATED',crew}));
  await assert.rejects(driveCrew({status:workflow.status,respond:async()=>{throw new Error('ISOLATED checkpoint unavailable');}},'run',host,options),/checkpoint unavailable/);assert.equal(calls,1);
  const result=await driveCrew(workflow,'run',host,options);assert.equal(calls,1);assert.equal(result.status.project.gate,'review');
  const task=result.status.pending;await writeFile(join(options.receiptDirectory,task.taskId+'.json'),JSON.stringify({status:'started',taskId:task.taskId,workerDigest:(await import('../runtime/contracts.mjs')).digest(task.crewWorker)}));
  await assert.rejects(driveCrew(workflow,'run',host,options),/DISPATCH_UNCERTAIN/);assert.equal(calls,1);
 }finally{workflow.close();await rm(dir,{recursive:true});}
});

test('permitted reference images travel as native image inputs associated with their scoped hashes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-native-image-')),mock=fixture(),host=new CodexHost({cwd:dir,spawnProcess:mock.spawnProcess});host.profile=async()=> 'isolated-host-profile';
 try{await host.initialize();const crew=await host.startCrew(),worker=crew.workers.find(w=>w.role==='cast-designer');const file={path:'/isolated-test/reference.png',sha256:'a'.repeat(64),bytes:100,width:100,height:100};const calls=[];
  await host.runTask({step:'roster',taskId:'isolated',actor:'agent',references:[{file}]},{worker,callTool:async(name,params)=>{calls.push({name,params});return {imageUrl:'data:image/png;base64,ISOLATED'};}});
  assert.deepEqual(calls,[{name:'viewImage',params:{sha256:file.sha256}}]);const input=mock.requests.findLast(r=>r.method==='turn/start').params.input;assert.equal(input[2].type,'image');assert.equal(input[2].url,'data:image/png;base64,ISOLATED');assert.match(input[1].text,/aaaaaaaa/);
 }finally{host.close();await rm(dir,{recursive:true});}
});

test('known malformed finished output stays inspectable and can receive a bounded evidenced repair',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-invalid-repair-')),workflow=openWorkflow(join(dir,'state.sqlite'));
 const crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`isolated-${role}`,name,role,modelVersion:'isolated-host',capabilityVersion:'isolated-tools',execution:'host'}))};let calls=0,repair;
 const host={runTask:async(task,{worker})=>{calls++;repair=task.repairFeedback;return {taskId:task.taskId,actor:'agent',action:'artifact',workerId:worker.workerId,content:calls===1?{beats:[]}:script};}},options={maxTasks:1,receiptDirectory:join(dir,'dispatch')};
 try{const init=await workflow.init('run',inputs,{workflowRevision:2});await workflow.respond('run',event(init.project,'configure-crew',{actor:'human',message:'ISOLATED',crew}));
  await assert.rejects(driveCrew(workflow,'run',host,options),/RESULT_REJECTED/);assert.equal((await workflow.status('run')).project.gate,'author');
  await assert.rejects(driveCrew(workflow,'run',host,options),/RESULT_REJECTED/);assert.equal(calls,1);
  const result=await driveCrew(workflow,'run',host,{...options,repairInvalid:true});assert.equal(calls,2);assert.ok(repair.error);assert.deepEqual(repair.previousEvent.content,{beats:[]});assert.equal(result.status.project.gate,'review');
 }finally{workflow.close();await rm(dir,{recursive:true});}
});

test('known finished role and JSON errors permit evidenced repair; unknown transport failures never do',async()=>{
 for(const kind of ['role','json','transport']){
  const dir=await mkdtemp(join(tmpdir(),'memoir-invalid-'+kind+'-')),workflow=openWorkflow(join(dir,'state.sqlite'));
  const crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`isolated-${role}`,name,role,modelVersion:'isolated-host',capabilityVersion:'isolated-tools',execution:'host'}))};let calls=0,repair;
  const host={runTask:async(task,{worker})=>{calls++;repair=task.repairFeedback;if(calls===1&&kind==='json')throw Object.assign(new Error('INVALID_WORKER_EVENT: ISOLATED finished JSON'),{knownFinished:true,finishedResult:'malformed JSON'});if(kind==='transport')throw new Error('ISOLATED timeout, outcome unknown');return {taskId:task.taskId,actor:'agent',action:calls===1?'approve':'artifact',workerId:worker.workerId,content:script};}},options={maxTasks:1,receiptDirectory:join(dir,'dispatch')};
  try{const init=await workflow.init('run',inputs,{workflowRevision:2});await workflow.respond('run',event(init.project,'configure-crew',{actor:'human',message:'ISOLATED',crew}));
   await assert.rejects(driveCrew(workflow,'run',host,options),kind==='transport'?/timeout/:/RESULT_REJECTED/);
   if(kind==='transport'){await assert.rejects(driveCrew(workflow,'run',host,{...options,repairInvalid:true}),/DISPATCH_UNCERTAIN/);assert.equal(calls,1);}
   else{const result=await driveCrew(workflow,'run',host,{...options,repairInvalid:true});assert.ok(repair.error);assert.equal(calls,2);assert.equal(result.status.project.gate,'review');}
  }finally{workflow.close();await rm(dir,{recursive:true});}
 }
});


function existingClonePlanFixture(){
 let p=approved(reviewed(authored(initialProject('isolated-plan',inputs,{workflowRevision:2}))));
 const voiceId='00000000-0000-4000-8000-000000000003';
 p=send(p,'choose-voice',{actor:'human',message:'ISOLATED existing clone',content:{voiceId,name:'ISOLATED clone',consentMessage:'ISOLATED own voice',reuseWithoutSample:true}});
 p=send(p,'voice-verified',{actor:'runtime',content:{voiceId,name:'ISOLATED clone',language:'en',isOwner:true,status:'active',access:'private',apiVersion:'2026-08-14',checkedAt:'2026-10-04T00:00:00Z',endpoint:`https://api.cartesia.ai/voices/${voiceId}`,httpStatus:200}});
 p=send(p,'configure-crew',{actor:'human',message:'ISOLATED bind planner',crew:{workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`isolated-${role}`,name,role,modelVersion:'isolated-host',capabilityVersion:'isolated-tools',execution:'host'}))}});
 return p;
}

test('driver dispatches Max to plan an existing-clone audition and stops before authorization or media',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-planner-drive-'));let p=existingClonePlanFixture(),calls=0;
 const workflow={status:async()=>({project:p,pending:taskFor(p)}),respond:async(_id,e)=>{p=applyEvent(p,e);return workflow.status();}};
 const host={runTask:async(task,{worker,callTool})=>{calls++;assert.equal(worker.role,'generation-planner');assert.equal(task.voiceBasis.kind,'existing-clone');assert.equal(task.voiceReference,null);
  await assert.rejects(callTool('generateAudio',{}),/TOOL_PERMISSION_DENIED/);
  return {taskId:task.taskId,actor:'agent',workerId:worker.workerId,action:'plan',plan:{provider:'cartesia',operation:'audition',estimatedCostUsd:.05,parameters:{}}};}};
 try{
  const result=await driveCrew(workflow,'run',host,{maxTasks:4,receiptDirectory:dir});assert.equal(result.completed,1);assert.equal(result.stop,'graph-gate');assert.equal(calls,1);assert.equal(p.gate,'authorize');
  const job=p.jobs[0];assert.equal(job.status,'planned');assert.equal(job.request.voice,p.voiceChoice.voiceId);assert.deepEqual(job.request.transcripts,[script.beats[0].narration]);assert.equal(job.request.generation_config.speed,1);assert.equal(p.artifacts.some(a=>a.kind==='audition'),false);assert.equal(p.budget.maxCostUsd,0);
  assert.throws(()=>send(p,'authorize',{actor:'human',jobId:job.id,artifactDigest:job.digest,message:'ISOLATED approval without ceiling'}),/BUDGET_EXCEEDED/);
  assert.equal((await driveCrew(workflow,'run',host,{receiptDirectory:dir})).completed,0);assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true});}
});

test('planning dispatch retains debug pause and cannot dispatch runtime film assembly, human or submission gates',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-plan-gates-'));let p=send(existingClonePlanFixture(),'configure-debug',{actor:'human',debugEnabled:true,message:'ISOLATED one step'}),calls=0;
 const workflow={status:async()=>({project:p,pending:taskFor(p)}),respond:async(_id,e)=>{p=applyEvent(p,e);return workflow.status();}};
 const host={runTask:async(task,{worker})=>{calls++;return {taskId:task.taskId,actor:'agent',workerId:worker.workerId,action:'plan',plan:{provider:'cartesia',operation:'audition',estimatedCostUsd:.05,parameters:{}}};}};
 try{
  assert.equal((await driveCrew(workflow,'run',host,{receiptDirectory:dir})).stop,'debug-pause');assert.equal(calls,0);
  p=send(p,'debug-next',{actor:'human',message:'ISOLATED release planner'});const result=await driveCrew(workflow,'run',host,{receiptDirectory:dir});assert.equal(result.completed,1);assert.equal(result.stop,'debug-pause');assert.equal(p.debug.paused,true);assert.equal(p.gate,'authorize');assert.equal(calls,1);
  for(const [step,gate] of [['film','produce'],['audition','authorize'],['audition','collect'],['audition','human'],['audition','escalate'],['audioReviewerQualification','author'],['reviewerQualification','author']]){
   const guarded={status:async()=>({project:{debug:{enabled:false}},pending:{step,gate}})};
   assert.equal((await driveCrew(guarded,'run',host,{receiptDirectory:dir})).stop,'graph-gate');assert.equal(calls,1);
  }
 }finally{await rm(dir,{recursive:true});}
});

test('Max can report a pricing blocker with canonical audition text without inventing a plan or changing locks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-plan-block-'));let p=send(existingClonePlanFixture(),'configure-debug',{actor:'human',debugEnabled:true,message:'ISOLATED debug'});
 p=send(p,'debug-next',{actor:'human',message:'ISOLATED release'});const prior=p.artifacts.map(a=>JSON.stringify(a)),budget=JSON.stringify(p.budget),task=taskFor(p);
 const message='ISOLATED account-verified Cartesia price is unavailable; operator must verify the account rate.';
 const workflow={status:async()=>({project:p,pending:taskFor(p)}),respond:async(_id,e)=>{p=applyEvent(p,e);return workflow.status();}};
 let calls=0;const host={runTask:async(task,{worker})=>{calls++;assert.deepEqual(task.generationTexts.beats,[{beat:1,text:script.beats[0].narration}]);assert.match(task.instruction,/no separate audition text/);return {taskId:task.taskId,actor:'agent',workerId:worker.workerId,action:'planning-blocked',message};}};
 try{
  await assert.rejects(runCrewTask(p,task,{runTask:async()=>({taskId:task.taskId,actor:'agent',workerId:'not-max',action:'planning-blocked',message})}),/PERMISSION_DENIED/);
  await assert.rejects(runCrewTask(p,{...task,generationTexts:{...task.generationTexts,beats:[]} },host),/TASK_INPUT_MISMATCH/);
  assert.throws(()=>send(p,'planning-blocked',{actor:'human',message}),/agent authority|assigned worker/);
  const result=await driveCrew(workflow,'run',host,{receiptDirectory:dir});assert.equal(result.completed,1);assert.equal(p.gate,'escalate');assert.equal(p.debug.paused,true);assert.equal(p.jobs.length,0);assert.equal(calls,1);assert.deepEqual(p.artifacts.map(a=>JSON.stringify(a)),prior);assert.equal(JSON.stringify(p.budget),budget);
  const {producerUpdate}=await import('../runtime/presentation.mjs');const producer=producerUpdate(await workflow.status());assert.match(producer.message,/Max \(Generation Planner\) paused planning/);assert.match(producer.message,/account-verified Cartesia price/);
  assert.equal((await driveCrew(workflow,'run',host,{receiptDirectory:dir})).completed,0);assert.equal(calls,1);
  p=send(p,'resolve',{actor:'human',message:'ISOLATED verified account pricing supplied'});assert.equal(p.gate,'produce');assert.equal(p.debug.paused,true);assert.equal(p.jobs.length,0);
 }finally{await rm(dir,{recursive:true});}
});
