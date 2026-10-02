import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {z} from 'zod';
import {Content,Event,digest} from './contracts.mjs';
import {applyEvent} from './workflow.mjs';
import {crewRoles,runCrewTask,taskAssets} from './crew.mjs';

export const DEFAULT_WORKER_MODEL='gpt-5.6-sol';
// Explicit host profile: no model fallback, native shell, apps or nested worker dispatch.
const disabled=['shell_tool','unified_exec','apps','plugins','multi_agent','code_mode','code_mode_host','browser_use','computer_use','view_image','image_generation','in_app_browser'];
const tool={type:'function',name:'wiggly_tool',description:'Call an allowed format tool on a hash from the current task. Never read another path or submit a generation.',inputSchema:{type:'object',properties:{name:{type:'string'},sha256:{type:'string'},referenceSha256:{type:['string','null']}},required:['name','sha256','referenceSha256'],additionalProperties:false}};

async function readJson(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function saveJson(path,value){await writeFile(path+'.tmp',JSON.stringify(value)+'\n',{mode:0o600});await rename(path+'.tmp',path);}

export class CodexHost {
 constructor({cwd,spawnProcess=spawn,timeoutMs=180000,onProgress=()=>{},perceptionTools={},perceptionProfile=null}={}){
  this.cwd=cwd;this.timeoutMs=timeoutMs;this.onProgress=onProgress;this.sequence=0;this.pending=new Map();this.active=null;this.perceptionProfile=perceptionProfile;
  this.child=spawnProcess('codex',['app-server','--stdio',...disabled.flatMap(name=>['--disable',name]),'-c','web_search="disabled"'],{stdio:['pipe','pipe','pipe']});
  this.lines=createInterface({input:this.child.stdout});
  this.lines.on('line',line=>{try{this.message(JSON.parse(line));}catch(error){this.fail(error);}});
  // Do not print ambient host logs, credentials or media payloads.
  this.child.stderr.on('data',()=>{});
  this.child.on('error',error=>this.fail(error));
  this.child.on('exit',()=>this.fail(new Error('CODEX_HOST_EXITED: stopped; no task/provider retry was submitted.')));
  this.tools={...perceptionTools,viewImage:async({file})=>({perception:'direct-image',imageUrl:`data:image/${extname(file.path).slice(1).replace('jpg','jpeg')};base64,${(await readFile(file.path)).toString('base64')}`})};
 }
 send(value){this.child.stdin.write(JSON.stringify(value)+'\n');}
 call(method,params){return new Promise((resolve,reject)=>{const id=++this.sequence,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CODEX_TIMEOUT: ${method}; stop and inspect the worker, never resubmit automatically.`));},this.timeoutMs);this.pending.set(id,{resolve,reject,timer});this.send({id,method,params});});}
 fail(error){for(const entry of this.pending.values()){clearTimeout(entry.timer);entry.reject(error);}this.pending.clear();this.active?.reject(error);}
 message(message){
  const entry=this.pending.get(message.id);
  if(entry){clearTimeout(entry.timer);this.pending.delete(message.id);message.error?entry.reject(new Error(`CODEX_HOST_ERROR: ${message.error.message}`)):entry.resolve(message.result);return;}
  if(this.active&&message.params?.threadId===this.active.threadId&&!this.active.turnId){this.active.buffer.push(message);return;}
  if(message.method==='item/tool/call'&&message.id!==undefined){void this.toolCall(message);return;}
  if(message.id!==undefined){this.send({id:message.id,error:{code:-32601,message:'This client only permits the scoped format tool.'}});this.active?.reject(new Error('UNEXPECTED_HOST_REQUEST: human approvals and ambient actions are not delegated.'));return;}
  const active=this.active;if(!active||message.params?.threadId!==active.threadId||message.params?.turnId&&message.params.turnId!==active.turnId)return;
  if(message.method==='item/completed'&&message.params.item?.type==='agentMessage')active.output=message.params.item.text;
  if(message.method==='item/started')this.onProgress({worker:active.worker.name,item:message.params.item?.type});
  if(message.method==='turn/completed'){
   const turn=message.params.turn;
   if(turn.id!==active.turnId)return;
   if(turn.status!=='completed'){active.reject(new Error(`CODEX_TURN_FAILED: ${turn.error?.message??turn.status}. No model/provider fallback was submitted.`));return;}
   active.resolve(active.output);
  }
 }
 async toolCall(message){
  const active=this.active,params=message.params;
  try{
   if(!active||params.threadId!==active.threadId||params.turnId!==active.turnId||params.tool!=='wiggly_tool')throw new Error('TOOL_SCOPE_DENIED');
   const arguments_=z.object({name:z.string(),sha256:z.string(),referenceSha256:z.string().nullable()}).strict().parse(params.arguments);
   const value=await active.callTool(arguments_.name,{sha256:arguments_.sha256,...(arguments_.referenceSha256?{referenceSha256:arguments_.referenceSha256}:{})});
   const contentItems=value.imageUrl?[{type:'inputText',text:JSON.stringify({fileSha256:arguments_.sha256,perception:value.perception})},{type:'inputImage',imageUrl:value.imageUrl}]:[{type:'inputText',text:JSON.stringify(value.bytes?{file:value.file,...(/\.(json|md|txt)$/i.test(value.file.path)?{text:value.bytes.toString('utf8')}:{instruction:'Binary media: use your permitted perception tool.'})}:value)}];
   this.send({id:message.id,result:{success:true,contentItems}});
  }catch(error){if(error.stopDispatch)this.active?.reject(error);this.send({id:message.id,result:{success:false,contentItems:[{type:'inputText',text:error.message}]}});}
 }
 async initialize(){await mkdir(this.cwd,{recursive:true});await this.call('initialize',{clientInfo:{name:'wiggly_memoir',title:'Wiggly memoir studio',version:'2.0.0'},capabilities:{experimentalApi:true}});this.send({method:'initialized',params:{}});}
 async profile(){
  const version=execFileSync('codex',['--version'],{encoding:'utf8'}).trim();
  return `${version}:${digest({sources:await Promise.all(['codex-host.mjs','crew.mjs','media.mjs','contracts.mjs','gemini-review.mjs','cartesia-stt.mjs','providers.mjs','evaluators.mjs','../evaluation/reviewer.md'].map(name=>readFile(new URL(name,import.meta.url),'utf8'))),perception:this.perceptionProfile,disabled,tool})}`;
 }
 async startCrew(model=DEFAULT_WORKER_MODEL){
  const capabilityVersion=await this.profile(),path=join(this.cwd,'crew-startup.json');
  const draft=await readJson(path)??{model,capabilityVersion,workers:[],pending:null};
  if(draft.model!==model||draft.capabilityVersion!==capabilityVersion)throw new Error('CODEX_STARTUP_PROFILE_CHANGED: reconcile the recorded partial crew before changing model/tools.');
  if(draft.pending)throw new Error(`CODEX_STARTUP_UNCERTAIN: inspect ${path} and saved worker ${draft.pending.workerId??draft.pending.role}; initialization will not be repeated automatically.`);
  for(const [role,{name}] of Object.entries(crewRoles)){
   if(draft.workers.some(w=>w.role===role))continue;
   draft.pending={role};await saveJson(path,draft);
   let result;
   try{result=await this.call('thread/start',{model,allowProviderModelFallback:false,cwd:this.cwd,approvalPolicy:'never',sandbox:'read-only',environments:[],serviceName:'wiggly-memoir',dynamicTools:[tool],developerInstructions:`You are ${name}, the ${role} for the Wiggly memoir format. Complete only your assigned task. Use wiggly_tool for granted assets. Return only the requested structured event; never approve for the user, submit provider calls, or claim unavailable perception.`});}
   catch(error){if(error.message.startsWith('CODEX_HOST_ERROR:')){draft.pending=null;await saveJson(path,draft);}throw error;}
   draft.pending.workerId=result.thread.id;await saveJson(path,draft);
   if(result.model!==model)throw new Error('CODEX_MODEL_CHANGED: requested model must be used exactly.');
   const worker={workerId:result.thread.id,name,role,modelVersion:result.model,capabilityVersion,execution:'host'};
   const ready=await this.turn(worker,'Initialization only: acknowledge your assigned role by replying READY. Do not use tools, author a deliverable, or claim perception.');
   if(ready.trim()!=='READY')throw new Error(`CODEX_CREW_NOT_READY: ${name} initialization did not acknowledge the role.`);
   draft.workers.push(worker);draft.pending=null;await saveJson(path,draft);
  }
  return {workers:draft.workers};
 }
 async refreshCrew(crew){
  const capabilityVersion=await this.profile(),workers=[];
  for(const worker of crew.workers){
   const result=await this.call('thread/resume',{threadId:worker.workerId,model:worker.modelVersion,cwd:this.cwd,approvalPolicy:'never',sandbox:'read-only'});
   if(result.model!==worker.modelVersion||result.thread.id!==worker.workerId)throw new Error('CODEX_WORKER_CHANGED');
   workers.push({...worker,capabilityVersion});
  }
  return {workers};
 }

 async runTask(task,{worker,callTool}){
  if(this.active)throw new Error('CODEX_HOST_BUSY: one graph task at a time.');
  if(worker.capabilityVersion!==await this.profile())throw new Error('CODEX_PROFILE_CHANGED: host/tool version differs from the bound crew. Stop for explicit reconfiguration/qualification.');
  const resumed=await this.call('thread/resume',{threadId:worker.workerId,model:worker.modelVersion,cwd:this.cwd,approvalPolicy:'never',sandbox:'read-only'});
  if(resumed.model!==worker.modelVersion||resumed.thread.id!==worker.workerId)throw new Error('CODEX_WORKER_CHANGED');
  const contentSchema=Content[task.step]?z.toJSONSchema(Content[task.step]):null;
  const input=JSON.stringify({instruction:'Complete ONLY this current task. Source facts are in the supplied task. Do not invent facts, approval, tool evidence or perception. For a review, inspect every required criterion and return evidence and repairs, using your exact modelVersion/capabilityVersion. Missing capabilities mean inconclusive. Return eventJson containing the serialized Event object. Do not emit other text.',task:{...task,worker},contentSchema,eventSchema:z.toJSONSchema(Event)});
  const media=[];
  if(crewRoles[worker.role].tools.includes('viewImage'))for(const file of taskAssets(task).values())if(file.width&&!file.durationSeconds){const viewed=await callTool('viewImage',{sha256:file.sha256});media.push({type:'text',text:`Reference image sha256: ${file.sha256}`},{type:'image',url:viewed.imageUrl});}
  const output=await this.turn(worker,[{type:'text',text:input},...media],callTool,{type:'object',properties:{eventJson:{type:'string'}},required:['eventJson'],additionalProperties:false});
  try{return Event.parse(JSON.parse(JSON.parse(output).eventJson));}catch(error){throw Object.assign(new Error(`INVALID_WORKER_EVENT: ${error.message}`),{knownFinished:true,finishedResult:output});}
 }
 async turn(worker,input,callTool=async()=>{throw new Error('No tools are permitted during initialization.');},outputSchema){
  if(this.active)throw new Error('CODEX_HOST_BUSY: one graph task at a time.');
  let resolve,reject;const done=new Promise((yes,no)=>{resolve=yes;reject=no;});
  this.active={threadId:worker.workerId,worker,callTool,resolve,reject,output:'',buffer:[]};
  // Attach a handler immediately; a transport can fail before turn/start returns.
  done.catch(()=>{});
  const timer=setTimeout(()=>reject(new Error('CODEX_TURN_TIMEOUT: inspect saved worker progress; no automatic retry.')),this.timeoutMs);
  try{
   const started=await this.call('turn/start',{threadId:worker.workerId,input:Array.isArray(input)?input:[{type:'text',text:input}],...(outputSchema?{outputSchema}:{})});
   this.active.turnId=started.turn.id;for(const message of this.active.buffer.splice(0))this.message(message);
   return await done;
  }finally{clearTimeout(timer);this.active=null;}
 }
 close(){this.fail(new Error('CODEX_HOST_CLOSED'));this.child.stdin.end();this.child.kill();this.lines.close();}
}

export async function driveCrew(workflow,thread,host,{maxTasks=8,receiptDirectory,repairInvalid=false,verifySubmission=async()=>{},onProgress=()=>{}}={}){
 if(!Number.isInteger(maxTasks)||maxTasks<1||maxTasks>32)throw new Error('Use a bounded maxTasks between 1 and 32.');
 if(!receiptDirectory)throw new Error('DISPATCH_RECEIPTS_REQUIRED: provide the run’s durable dispatch directory.');
 await mkdir(receiptDirectory,{recursive:true});
 let completed=0;
 while(completed<maxTasks){
  const status=await workflow.status(thread),task=status.pending;
  // Provider execution stays in the authorized runner; this loop never generates media.
  if(!['author','owner-review','review'].includes(task.gate)||['audioReviewerQualification','reviewerQualification'].includes(task.step))return {completed,stop:'graph-gate',status};
  onProgress({step:task.step,gate:task.gate});
  const path=join(receiptDirectory,task.taskId+'.json'),receipt=await readJson(path);
  if(receipt&&receipt.workerDigest!==digest(task.crewWorker))throw new Error('DISPATCH_WORKER_CHANGED');
  if(receipt?.status==='started')throw new Error(`CODEX_DISPATCH_UNCERTAIN: inspect ${path} and the saved worker turn before reconciling. No automatic rerun.`);
  const attempt=(receipt?.attempt??0)+(receipt?.status==='rejected'?1:0)||1;
  if(receipt?.status==='rejected'){
   if(!repairInvalid)throw new Error(`CODEX_RESULT_REJECTED: ${receipt.error}; inspect ${path}; --repair-invalid true explicitly requests a bounded repair of the known finished result.`);
   if(attempt>3)throw new Error('CODEX_REPAIR_LIMIT: three finished attempts exhausted; reconcile the deliverable with the operator.');
   const archive=path+`.rejected-${receipt.attempt}.json`,prior=await readJson(archive);
   if(prior&&digest(prior)!==digest(receipt))throw new Error('DISPATCH_RECEIPT_CONFLICT');
   if(!prior)await writeFile(archive,JSON.stringify(receipt)+'\n',{flag:'wx',mode:0o600});
  }
  let event=receipt?.status==='completed'?receipt.event:null;
  if(!event){
   const started={status:'started',taskId:task.taskId,worker:task.crewWorker,workerDigest:digest(task.crewWorker),attempt};
   if(receipt)await saveJson(path,started);else await writeFile(path,JSON.stringify(started)+'\n',{flag:'wx',mode:0o600});
   try{
    event=await runCrewTask(status.project,{...task,...(receipt?.status==='rejected'?{repairFeedback:{error:receipt.error,previousEvent:receipt.event,instruction:'Repair this evidenced validation error. Preserve current source facts and return the current gate Event.'}}:{})},host);
    applyEvent(status.project,event);
   }catch(error){
    if(!event&&!error.knownFinished)throw error;
    await saveJson(path,{...started,status:'rejected',event:event??error.finishedResult,error:error.message});
    throw new Error(`CODEX_RESULT_REJECTED: known finished worker result violates the contract: ${error.message}. Inspect ${path}; use --repair-invalid true for a bounded repair.`);
   }
   await saveJson(path,{...started,status:'completed',event});
  }else event=Event.parse(event);
  await verifySubmission(status,event);await workflow.respond(thread,event);completed++;
 }
 return {completed,stop:'task-limit',status:await workflow.status(thread)};
}
