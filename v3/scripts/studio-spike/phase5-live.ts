import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tool } from 'langchain';
import { Command } from '@langchain/langgraph';
import { ToolMessage, HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { provisionLocalOperator, signLocalOperator } from '../../lib/studio-operator.js';
import { StudioProduction, type WorkerLease } from '../../lib/studio-production.js';
import { askActiveAgent } from '../../lib/agent-bridge.js';
import { publicationTool, productionMiddleware } from './production-tools.js';
import { workspaceAgent, hash } from './harness.js';
import { dispatchAssignments } from './dispatch.js';
import { NimModel } from './nim-model.js';
import { nimTransport, chatCompletionsTransport } from './nim-transport.js';
import { tracing, namedSecret, secretsPath } from './tracing.js';
import { assertBackgroundDimensions } from './phase2.js';
export const deepseekProviders = { order: ['decart/fp4', 'sail-research/fp4'], only: ['decart/fp4', 'sail-research/fp4'], allow_fallbacks: true, require_parameters: true, max_price: { prompt: .3, completion: 1.2 } };
export function deepseekRouting(hasImages:boolean){return hasImages?{...deepseekProviders,order:['decart/fp4'],only:['decart/fp4'],allow_fallbacks:false}:deepseekProviders;}
const kit='/Users/shaz/Projects/wiggly/v3/public/format-repositories/my-pixar-story-v1';
const retained=join(import.meta.dirname,'output/phase2/e9be30f5-54ca-4612-8951-56315e7c90bf/candidate-b8dfeaa58674840103a270fa0d9798fa71aa2298c00c7fab952bb58973d7d45b.webp');
const routedRecovery = process.argv.find(arg=>arg.startsWith('--phase5-routed-root='))?.slice('--phase5-routed-root='.length);
const openRouterRecovery = routedRecovery ?? process.argv.find(arg=>arg.startsWith('--phase5-openrouter-root='))?.slice('--phase5-openrouter-root='.length);
const recovery = openRouterRecovery ?? process.argv.find(arg=>arg.startsWith('--phase5-recover-root='))?.slice('--phase5-recover-root='.length);
const repair = Number(process.argv.find(arg=>arg.startsWith('--repair='))?.slice(9) ?? (recovery?2:1));
assert.ok([1,2,3].includes(repair), 'At most three distinct repair attempts');
const root=recovery?join(import.meta.dirname,'output/phase5',recovery):join(import.meta.dirname,'output/phase5',randomUUID()), exec=promisify(execFile);
assert.ok(!recovery || /^[a-f0-9-]{36}$/.test(recovery), 'Invalid isolated recovery ID');
const criteria='Empty stylized 3D family kitchen background, usable 16:9 landscape, believable counter/sink/stove placement, clear central floor space for character staging. No people, animals, human figures or faces anywhere, captions, logos or watermarks. Invented test scene, not a memoir location.';
const mediaFix=process.argv.includes('--media-fix');
const packetFix=process.argv.includes('--packet-fix');
const directorRecovery=process.argv.includes('--director-recovery');
const reviewBackup=process.argv.includes('--review-backup');
export function workerReviewPacket(packet:any){return {...packet,candidate_path:'/references/candidate.webp'};}
export function inspectionResult(bytes:Buffer, text:string, toolCallId:string){return new Command({update:{messages:[new ToolMessage({content:text,tool_call_id:toolCallId}),new HumanMessage({content:[{type:'text',text:'Actual candidate image returned by inspect_candidate.'},{type:'image_url',image_url:{url:'data:image/webp;base64,'+bytes.toString('base64')}}]})]}});}
const receipts:any[]=[], wire:any[]=[];let store:StudioProduction;
async function worker(ctx:WorkerLease, reviewer:boolean, openRouter = false){
 const modelName=openRouter?'deepseek/deepseek-v4.1-flash':'moonshotai/kimi-k3', provider=openRouter?'openrouter':'nvidia-nim';
 const mount=dirname(store.draftDirectory(ctx)),runId=randomUUID(),name=reviewer?'independent-review':'background-author';
 for(const dir of ['references','versions',`skills/${name}`])await mkdir(join(mount,dir),{recursive:true});
 const direction=reviewer?(directorRecovery?'Review the authoritative packet supplied in the user request. Inspect':'Read /references/packet.json. Inspect')+' the actual image using inspect_candidate, then submit_review with detailed findings and observable defects with coarse regions.':`${criteria} Read /references/recipe.md. Author your own complete prompt, generate_background once, inspect_candidate, finish_inspection with detailed visual findings, then submit_candidate with /drafts/candidate.webp and the evidence reference returned by finish_inspection. ${ctx.ticketId.endsWith('author-a')?'Soft morning lighting.':'Cozy evening lighting with warm practical lights.'}`;
 await writeFile(join(mount,`skills/${name}/SKILL.md`),`---\nname: ${name}\ndescription: Complete this isolated Phase 5 assignment.\n---\n${direction}\n`);
 await copyFile(join(kit,'background-prompter.md'),join(mount,'references/recipe.md'));
 if(recovery&&!reviewer) await copyFile(join(mount,'generation-prompt.json'),join(mount,'references/prior-generation.json'));
 if(reviewer){const packet=store.reviewPacket(ctx.ticketId);const destination=join(mount,'references/candidate.webp');try{assert.equal(hash(await readFile(destination)),packet.content_hash,'REVIEW_REFERENCE_CHANGED');}catch(error:any){if(error.code!=='ENOENT')throw error;await copyFile(packet.candidate_path,destination);}await writeFile(join(mount,'references/packet.json'),JSON.stringify(workerReviewPacket(packet)));}
 const key=await namedSecret(openRouter?'OPENROUTER_API_KEY':'NVIDIA_API_KEY'),{client,tracer,failures}=await tracing();
 let evidence:string|undefined,source:string|undefined,generated=false;const usage:any[]=[],delivered=new Set<string>();
 const send:typeof fetch=async(input,init)=>{
  const body=JSON.parse(String(init?.body)),op=randomUUID();let response!:Response;
  const images=body.messages.flatMap((m:any)=>Array.isArray(m.content)?m.content:[]).filter((b:any)=>b.type==='image_url');
  if(openRouter&&!reviewBackup&&!directorRecovery){body.provider=deepseekRouting(images.length>0);init={...init,body:JSON.stringify(body)};}
  if(source&&images.length){const bytes=await readFile(source);assert.ok(images.some((b:any)=>hash(Buffer.from(b.image_url.url.split(',')[1],'base64'))===hash(bytes)),'Actual candidate missing from outbound request');for(const b of images)delivered.add(b.image_url.url.split(',')[1]);evidence=store.mediaSupplied(ctx,bytes,{runId,model:modelName,modality:'image',coverage:'complete frame'});}
  await store.executeOperation(ctx,{operationId:op,provider,requestHash:hash(Buffer.from(String(init?.body))),estimateMicros:openRouter?Math.ceil(Buffer.byteLength(String(init?.body))*.3+4096*1.2):0},async()=>{
   const started=Date.now();response=await fetch(input,{...init,signal:AbortSignal.timeout(120000)});
   if(!response.ok)throw new Error(`${provider} HTTP ${response.status}: ${(await response.text()).replaceAll(key,'[REDACTED]').slice(0,500)}`);
   const result=await response.clone().json();usage.push({...result.usage,provider:result.provider});await writeFile(join(mount,`nim-response-${op}.json`),JSON.stringify(result));
   // Preserve the known provider request before any fenced inspection update can fail on pause.
   if(result.id)store.recordRequestId(op,result.id);
   const message=result.choices?.[0]?.message,findingCall=message?.tool_calls?.find((c:any)=>['finish_inspection','submit_review'].includes(c.function?.name));
   const findings=findingCall?JSON.parse(findingCall.function.arguments).findings:message?.content;
   if(evidence&&typeof findings==='string'&&findings.trim().length>=20)store.inspectionCompleted(ctx,evidence,findings);
   wire.push({ticket:ctx.ticketId,provider,operation_id:op,started,ended:Date.now()});
   if(openRouter)assert.ok(typeof result.usage?.cost==='number'&&result.usage.cost>=0,'OPENROUTER_USAGE_REQUIRED');
   return {...(result.id?{requestId:result.id}:{}),completed:{result:{artifactReferences:[],receiptReference:join(mount,`nim-response-${op}.json`)},actualAllowanceMicros:openRouter?Math.ceil(result.usage.cost*1e6):0,providerUsage:result.usage,...(openRouter?{}:{includedCredits:{basis:'NVIDIA free prototype endpoint'}})}};
  },error=>`${String(error).replaceAll(key,'[REDACTED]')}\n${openRouter?'Open https://openrouter.ai/settings/keys and verify this key; check https://openrouter.ai/activity for the request. Credentials: OPENROUTER_API_KEY in '+secretsPath:'Open https://build.nvidia.com/moonshotai/kimi-k3 and check availability. Credentials: NVIDIA_API_KEY in '+secretsPath}`, AbortSignal.timeout(180000));return response;
 };
 const transport=openRouter?chatCompletionsTransport('https://openrouter.ai',send):nimTransport(send);
 const model=new NimModel({model:modelName,apiKey:key,maxRetries:0,maxTokens:openRouter?4096:(repair===3?4096:8192),temperature:openRouter?1:(repair===3?0:1),disableStreaming:true,useResponsesApi:false,modelKwargs:openRouter?{tool_choice:'required',reasoning:{effort:'medium'},provider:directorRecovery?{...deepseekProviders,order:['decart/fp4'],only:['decart/fp4'],allow_fallbacks:false}:reviewBackup?{...deepseekProviders,order:['sail-research/fp4'],only:['sail-research/fp4'],allow_fallbacks:false}:deepseekProviders}:{reasoning_effort:repair===3?'high':'max',tool_choice:'required',...(repair===3?{seed:0}:{})},configuration:{baseURL:openRouter?'https://openrouter.ai/api/v1':'https://integrate.api.nvidia.com/v1',fetch:transport}});
 const inspect=tool(async(_input,runtime)=>{source=join(mount,reviewer?'references/candidate.webp':'drafts/candidate.webp');const bytes=await readFile(source);return inspectionResult(bytes,`Inspect the complete actual image. SHA256: ${hash(bytes)}. Next call ${reviewer?'submit_review':'finish_inspection'} with detailed findings.`,(runtime as any).toolCall?.id ?? (runtime as any).toolCallId);},{name:'inspect_candidate',description:'View the actual assigned candidate image.',schema:z.object({}).strict()});
 const finishInspection=tool(({findings})=>{assert.ok(evidence&&findings.trim().length>=20,'Actual inspection required');return {evidence_reference:evidence};},{name:'finish_inspection',description:'Record detailed findings after viewing the image; receive evidence reference.',schema:z.object({findings:z.string().min(20).max(10000)}).strict()});
 const reviewFinish=tool(result=>{assert.ok(evidence,'REVIEW_INSPECTION_REQUIRED');return store.submitReview(ctx,{...result,evidence_references:[evidence]});},{name:'submit_review',description:'End independent review with findings and defects; no director approval.',schema:z.object({verdict:z.enum(['PASS','CHANGES_REQUESTED','INCONCLUSIVE']),findings:z.string().min(20),defects:z.array(z.object({criterion:z.string(),region:z.string(),evidence:z.string()}).strict())}).strict(),returnDirect:true});
 const generate=tool(async({prompt})=>{
  assert.ok(!generated,'One generation per assignment');generated=true;
  const providers=await import(`${kit}/runtime/providers.mjs`),meta=await namedSecret('META_API_KEY');
  const planning={locationId:'phase5-kitchen',artifacts:[{key:'backgroundCandidates:phase5-kitchen',valid:true,selection:0,content:{files:[{path:retained}]}}]};
  const request=providers.requestDescriptor(planning,{operation:'backgroundAngle',estimatedCostUsd:.01,parameters:{prompt}});assert.equal(request.n,1);assert.equal(new URL(request.endpoint).origin,'https://api.meta.ai');
  const {endpoint,images:refs,...body}=request,images=await Promise.all(refs.map(async(file:any)=>({image_url:`data:image/webp;base64,${(await readFile(file.path)).toString('base64')}`})));
  const serialized=JSON.stringify({...body,images}),operationId=randomUUID(),path=join(mount,'drafts/candidate.webp');
  await writeFile(join(mount,'generation-prompt.json'),JSON.stringify({prompt,operation_id:operationId,authored_by:ctx.workerId,reference_sha256:hash(await readFile(retained))}));
  await store.executeOperation(ctx,{operationId,provider:'meta-muse',requestHash:hash(Buffer.from(serialized)),estimateMicros:10000},async()=>{
   const started=Date.now(),response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${meta}`,'Content-Type':'application/json'},body:serialized,signal:AbortSignal.timeout(180000),redirect:'error'});
   if(!response.ok)throw new Error(`Muse HTTP ${response.status}: ${(await response.text()).replaceAll(meta,'[REDACTED]').slice(0,500)}`);
   const result=await response.json();await writeFile(join(mount,'muse-response.json'),JSON.stringify(result));assert.ok(result.data?.length===1&&result.data[0].b64_json,'Exact base64 image required');
   await writeFile(path,Buffer.from(result.data[0].b64_json,'base64'),{flag:'wx'});
   const {stdout}=await exec('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',path]);assertBackgroundDimensions(JSON.parse(stdout).streams[0]);
   wire.push({ticket:ctx.ticketId,provider:'meta-muse',operation_id:operationId,started,ended:Date.now()});
   return {completed:{result:{artifactReferences:[path],receiptReference:join(mount,'muse-response.json')}}};
  },error=>`${String(error).replaceAll(meta,'[REDACTED]')}\n${providers.remediation('meta-muse',secretsPath)}`,AbortSignal.timeout(180000));
  return {draft_path:'/drafts/candidate.webp',sha256:hash(await readFile(path))};
 },{name:'generate_background',description:'Generate one Muse candidate from your authored prompt; one authorized call.',schema:z.object({prompt:z.string().min(50).max(5000)}).strict()});
 const agent=workspaceAgent(model,mount,modelName,ctx.workerId,reviewer?[inspect,reviewFinish]:[...(recovery?[]:[generate]),inspect,finishInspection,publicationTool(store,ctx)],'Operate only this assignment. Load its skill. Inspect actual bytes. No shell, delegation, substitute providers or director approval.',[productionMiddleware(store,ctx)]);
 const started=Date.now();
 try{
  await askActiveAgent(reviewer?'Independently review the exact candidate. The authoritative packet is supplied here; load your skill and inspect actual bytes before submitting findings: '+JSON.stringify(workerReviewPacket(store.reviewPacket(ctx.ticketId))):recovery?'Recover the already generated /drafts/candidate.webp: load the skill and /references/prior-generation.json, inspect_candidate, finish_inspection and submit_candidate. Generation is not exposed or authorized again.':'Create the background according to your skill. One image call is authorized within the isolated $5 test allowance.',{operatingAgent:prompt=>agent.invoke({messages:[{role:'user',content:prompt}]},{runId,callbacks:[tracer],recursionLimit:40,signal:AbortSignal.timeout(240000),metadata:{phase:5,ticket:ctx.ticketId,production:false,repair_attempt:repair,reasoning_effort:repair===3?'high':'max'}})});
  assert.equal(store.ticket(ctx.ticketId).status,'SUBMITTED','Worker did not submit');await client.awaitPendingTraceBatches();assert.deepEqual(failures,[]);
  const trace=await client.readRun(runId,{loadChildRuns:true});for(const media of delivered)assert.ok(!JSON.stringify(trace).includes(media),'Media leaked into LangSmith');
  const receipt={ticket:ctx.ticketId,run_id:runId,elapsed_ms:Date.now()-started,usage,trace_url:await client.getRunUrl({run:trace}),submitted:true};receipts.push(receipt);await writeFile(join(mount,'worker-receipt.json'),JSON.stringify(receipt,null,2));
 }catch(error:any){const causes:string[]=[];for(let e=error;e;e=e.cause)causes.push(String(e.message).replaceAll(key,'[REDACTED]'));const message=causes.join(' → ');await writeFile(join(mount,'worker-blocker-'+repair+'.json'),JSON.stringify({ticket:ctx.ticketId,run_id:runId,error:message}));throw new Error(message);}
}
export async function admitLiveTrial(output:string,runRoot:string,attempt:number,recover:boolean){
 assert.ok([1,2,3].includes(attempt),'At most three distinct repair attempts');
 const admission=join(output,'authorized-run.json');
 if(!recover) await writeFile(admission,JSON.stringify({root:runRoot,allowance_usd:5}),{flag:'wx'});
 else assert.equal(JSON.parse(await readFile(admission,'utf8')).root,runRoot,'Recovery must use the one authorized allowance ledger');
 await writeFile(join(runRoot,`diagnostic-${attempt}-execution.json`),JSON.stringify({repair:attempt,started_at:Date.now()}),{flag:'wx'});
}
async function main(){
 await mkdir(root,{recursive:true});
 await admitLiveTrial(join(import.meta.dirname,'output/phase5'),root,repair,!!recovery);
 await Promise.all(['NVIDIA_API_KEY','META_API_KEY','LANGSMITH_API_KEY'].map(namedSecret));
 assert.equal(hash(await readFile(retained)),'b8dfeaa58674840103a270fa0d9798fa71aa2298c00c7fab952bb58973d7d45b');
 store=new StudioProduction(root);if(!recovery)store.createProject('phase5',5000000);store.configureConcurrency('phase5',2,{'meta-muse':1,'nvidia-nim':1},{'nvidia-nim':repair===3?15000:6000});store.operator('phase5','resume',0,{id:recovery?'diagnostic-'+repair+'-resume-'+randomUUID():'isolated-resume',actor:'director-authorized-phase5',reason:'Explicit Phase 5 test authorization; saved production stays paused'});
 if(!recovery)for(const id of ['author-a','author-b'])store.createTicket(id,'phase5','background-author',{},2500000,'AUTHOR',{maxTurns:8,maxAttempts:1});
 await writeFile(join(root,recovery?'diagnostic-'+repair+'-authorization.json':'authorization.json'),JSON.stringify({paid_test_allowance_usd:5,planned_muse_estimate_usd:.02,nvidia_expected_cost_usd:0,verified_charges_usd:null,reliability_repair_attempt:repair,no_automatic_retries:true,production_paused:true},null,2));
 if(recovery){
  // HTTP 429 is an explicit refusal at the free endpoint, not an unknown paid generation.
  const { DatabaseSync }=await import('node:sqlite');const db=new DatabaseSync(join(root,'studio.sqlite'));
  const failed=db.prepare("SELECT * FROM operations WHERE provider='nvidia-nim' AND state='FAILED'").all() as any[];db.close();
  for(const op of failed){assert.match(op.diagnostic,/NIM HTTP 429/);store.settleFailedOperation(op.id,0);}
  for(const id of ['author-a','author-b']){
   const t=store.ticket(id);assert.ok(['WORKING','BLOCKED'].includes(t.status));assert.ok(await readFile(join(root,'assignments',id,t.attempt_id,'drafts/candidate.webp')));
   // Restart fresh bounded inspection assignments; preserve failed attempts/history and reuse bytes.
   const fresh='recovered-'+id;let existing:any;try{existing=store.ticket(fresh);}catch(error:any){if(error.message!=='TICKET_NOT_FOUND')throw error;}
   if(!existing)store.createTicket(fresh,'phase5','background-author',{},0,'AUTHOR',{maxTurns:8,maxAttempts:1});
   const ctx=existing?.status==='WORKING'&&existing.lease_until>Date.now()?{ticketId:fresh,workerId:existing.worker_id,token:existing.token,attemptId:existing.attempt_id}:store.claim(fresh,fresh,300000),mount=dirname(store.draftDirectory(ctx));await mkdir(join(mount,'references'),{recursive:true});
   await copyFile(join(root,'assignments',id,t.attempt_id,'drafts/candidate.webp'),join(mount,'drafts/candidate.webp'));
   await copyFile(join(root,'assignments',id,t.attempt_id,'generation-prompt.json'),join(mount,'generation-prompt.json'));
  }
  const contexts=['recovered-author-a','recovered-author-b'].map(id=>{const t=store.ticket(id);return {ticketId:id,workerId:t.worker_id,token:t.token,attemptId:t.attempt_id};});
  // These already claimed assignments still execute together while the provider gate serializes requests.
  const results=await Promise.allSettled(contexts.map(async ctx=>{try{await worker(ctx,false);}catch(error){store.operator('phase5','pause',1,{id:randomUUID(),actor:'trusted-producer',reason:'Diagnostic worker failed'});throw error;}}));
  const failure=results.find(r=>r.status==='rejected'&&!String(r.reason?.message).includes('PROJECT_PAUSED'))??results.find(r=>r.status==='rejected');if(failure?.status==='rejected')throw failure.reason;
 }else await dispatchAssignments(store,'phase5',['author-a','author-b'],ctx=>worker(ctx,false));
 const authors=recovery?['recovered-author-a','recovered-author-b']:['author-a','author-b'];
 for(const [author,reviewer]of [[authors[0],'review-a'],[authors[1],'review-b']])store.startReview(author,reviewer,'independent-reviewer',{criteria:[criteria],modality:'image',coverage:'complete frame'},0,{maxTurns:4,maxAttempts:1});
 await dispatchAssignments(store,'phase5',['review-a','review-b'],ctx=>worker(ctx,true));
 assert.ok(authors.every(id=>store.ticket(id).status==='AWAITING_APPROVAL'),'Both positive trial backgrounds must independently pass');
 store.operator('phase5','pause',1,{id:'end-test-pause',actor:'trusted-producer',reason:'End isolated trial; no production approval or resume'});
 const report={status:'PHASE5_LIVE_PASSED',root,receipts,wire,allowance:store.allowance('phase5'),candidates:authors.map(id=>store.version(store.ticket(id).candidate_id)),no_director_approvals:true,saved_production_paused:true,reliability:'Four bounded workers completed; provider corruption cannot be declared permanently fixed.'};await writeFile(join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,root,workers:receipts.length,allowance:report.allowance}));store.close();
}
async function directorRecoveryMain(){
 assert.ok(openRouterRecovery,'EXISTING_ISOLATED_ROOT_REQUIRED');
 assert.equal(JSON.parse(await readFile(join(import.meta.dirname,'output/phase5/authorized-run.json'),'utf8')).root,root);
 await writeFile(join(root,'director-decart-recovery-execution.json'),JSON.stringify({authorization:'Director approved 6 turns and one Decart recovery',candidate_unchanged:true,budget_usd:5}),{flag:'wx'});
 store=new StudioProduction(root);assert.equal(store.project('phase5').allowance,5000000);
 const t=store.ticket('packet-review-0');assert.equal(t.status,'BLOCKED');assert.equal(t.max_turns,4);
 const evidence=join(root,'sail-rejected-request-evidence.json');await writeFile(evidence,JSON.stringify({source:'https://openrouter.ai/workspaces/default/logs',request_id:'gen-1791406012-s1nZHWf9o6Xxl9xb7s9R',provider:'Sail Research',status:400,reason:'model does not support image input',billing_cost:null,billing_api_result:'Generation not found; reservation retained',observed_by:'active host operator using logged-in OpenRouter upstream log'}));
 const principal=provisionLocalOperator(root);
 const command=signLocalOperator(root,{id:'director-six-turn-decart-recovery',principal,project_id:'phase5',action:'extend_limits' as const,ticket_id:t.id,expected_revision:t.revision,max_turns:6,reason:'User explicitly approved six turns and one Decart recovery on the same candidate and original $5 ledger',recover_rejected_operation:{operation_id:'6f277016-9813-4555-b5b5-a9d92f4bbe82',request_id:'gen-1791406012-s1nZHWf9o6Xxl9xb7s9R',evidence_reference:evidence}});
 const authorization=store.authorizeLimits(command);await writeFile(join(root,'director-review-recovery-authorization.json'),JSON.stringify({command,result:authorization},null,2));
 store.operator('phase5','resume',0,{id:'director-decart-resume',actor:principal,reason:'One explicitly authorized Decart recovery; saved production never resumed'});
 const ctx=store.claim(t.id,'director-recovered-reviewer',300000);assert.equal(ctx.attemptId,t.attempt_id);
 await worker(ctx,true,true);
 assert.ok(['packet-author-a','packet-author-b'].every(id=>store.ticket(id).status==='AWAITING_APPROVAL'));
 store.operator('phase5','pause',1,{id:'director-recovery-end',actor:'trusted-producer',reason:'Phase 5 isolated test finished; saved production remains paused'});
 const allReceipts=[];for(const id of ['packet-author-a','packet-author-b','packet-review-0','packet-review-1']){const ticket=store.ticket(id);allReceipts.push(JSON.parse(await readFile(join(root,'assignments',id,ticket.attempt_id,'worker-receipt.json'),'utf8')));}
 const report={status:'PHASE5_OPENROUTER_LIVE_PASSED',root,receipts:allReceipts,wire,allowance:store.allowance('phase5'),candidates:['packet-author-a','packet-author-b'].map(id=>store.version(store.ticket(id).candidate_id)),no_images_regenerated:true,no_director_approvals:true,saved_production_paused:true,primary:'decart/fp4',text_backup:'sail-research/fp4',image_backup:null,recovery_authorization:authorization,unknown_reservations_retained:true};
 await writeFile(join(root,'openrouter-final-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,workers:allReceipts.length,allowance:report.allowance}));store.close();
}
async function reviewBackupMain(){
 assert.ok(openRouterRecovery,'EXISTING_ISOLATED_ROOT_REQUIRED');
 assert.equal(JSON.parse(await readFile(join(import.meta.dirname,'output/phase5/authorized-run.json'),'utf8')).root,root);
 await writeFile(join(root,process.argv.includes('--setup-repair')?'openrouter-review-backup-admission-fix.json':'openrouter-review-backup-execution.json'),JSON.stringify({route:'sail-research/fp4',reason:'Director authorized tested backups; Decart returned malformed truncated output',same_ticket:true,no_limit_extension:true}),{flag:'wx'});
 store=new StudioProduction(root);assert.equal(store.project('phase5').allowance,5000000);
 store.operator('phase5','resume',0,{id:process.argv.includes('--setup-repair')?'review-backup-admission-fix-resume':'review-backup-resume',actor:'director-authorized-phase5',reason:'Intentional use of authorized Sail backup for unfinished exact-version review'});
 const ticket=store.ticket('packet-review-0');assert.equal(ticket.status,'WORKING');
 const ctx=ticket.lease_until>Date.now()?{ticketId:ticket.id,workerId:ticket.worker_id,token:ticket.token,attemptId:ticket.attempt_id}:store.claim(ticket.id,'backup-review-worker',300000);
 await worker(ctx,true,true);
 assert.ok(['packet-author-a','packet-author-b'].every(id=>store.ticket(id).status==='AWAITING_APPROVAL'));
 store.operator('phase5','pause',1,{id:'review-backup-end',actor:'trusted-producer',reason:'Phase 5 isolated live gate complete; saved production remains paused'});
 const allReceipts=[];for(const id of ['packet-author-a','packet-author-b','packet-review-0','packet-review-1']){const t=store.ticket(id);allReceipts.push(JSON.parse(await readFile(join(root,'assignments',id,t.attempt_id,'worker-receipt.json'),'utf8')));}
 const report={status:'PHASE5_OPENROUTER_LIVE_PASSED',root,receipts:allReceipts,wire,allowance:store.allowance('phase5'),candidates:['packet-author-a','packet-author-b'].map(id=>store.version(store.ticket(id).candidate_id)),no_images_regenerated:true,no_director_approvals:true,saved_production_paused:true,primary:'decart/fp4',backup:'sail-research/fp4',backup_used_for:'packet-review-0',malformed_primary_response_rejected:true};
 await writeFile(join(root,'openrouter-final-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,workers:allReceipts.length,allowance:report.allowance}));store.close();
}
async function openRouterMain(){
 assert.ok(openRouterRecovery&&/^[a-f0-9-]{36}$/.test(openRouterRecovery),'ISOLATED_RECOVERY_ID_REQUIRED');
 assert.equal(JSON.parse(await readFile(join(import.meta.dirname,'output/phase5/authorized-run.json'),'utf8')).root,root,'ONE_ORIGINAL_ALLOWANCE_REQUIRED');
 await writeFile(join(root,routedRecovery?(packetFix?'openrouter-packet-execution.json':mediaFix?'openrouter-media-execution.json':'openrouter-routed-execution.json'):'openrouter-execution.json'),JSON.stringify({started_at:Date.now(),model:'deepseek/deepseek-v4.1-flash',authorization:'Director approved remaining existing $5 for Phase 5 OpenRouter tests; no production resume',no_nim_retry:true}),{flag:'wx'});
 const catalog=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(15000)});assert.ok(catalog.ok);const entry=(await catalog.json()).data.find((m:any)=>m.id==='deepseek/deepseek-v4.1-flash');assert.ok(entry?.architecture.input_modalities.includes('image')&&entry.supported_parameters.includes('tools'),'MODEL_CAPABILITY_CHANGED');
 store=new StudioProduction(root);assert.equal(store.project('phase5').allowance,5000000,'NO_BUDGET_RESET');
 // Uncertain earlier calls retain slots; add exactly two live slots for this explicitly authorized recovery.
 const priorCapacity=store.providerCapacity('openrouter');
 store.configureConcurrency('phase5',2,{'openrouter':routedRecovery?priorCapacity.used+2:2,'meta-muse':1});store.operator('phase5','resume',0,{id:routedRecovery?(packetFix?'openrouter-packet-resume':mediaFix?'openrouter-media-resume':'openrouter-routed-resume'):'openrouter-isolated-resume',actor:'director-authorized-phase5',reason:'Resume isolated test only after approved provider change'});
 // Import the already executed capability trials into this original allowance ledger.
 // The failed connection has no billing receipt; its conservative reservation and slot remain.
 for(const [name,trial,unknown]of [['unknown','25572b68-ea79-4af8-83df-37c9092cc821',true],['passed','d597c077-5045-4556-8366-bb8974c00a3d',false]] as const){
  if(routedRecovery)continue;
  const report=JSON.parse(await readFile(join(import.meta.dirname,'output/deepseek-phase5-probe',trial,'report.json'),'utf8')),ticket='openrouter-probe-'+name;
  store.createTicket(ticket,'phase5','capability-probe',{},750000,'AUTHOR');const ctx=store.claim(ticket,ticket,300000),op='openrouter-probe-'+trial;
  store.prepareOperation(ctx,{operationId:op,provider:'openrouter',requestHash:hash(Buffer.from(JSON.stringify(report))),estimateMicros:750000});store.startOperation(ctx,op);
  if(unknown)store.failOperation(op,'Imported actual connection-error trial: billing unknown; retain reservation and provider slot');
  else{store.completeOperation(op,{result:{artifactReferences:[join(import.meta.dirname,'output/deepseek-phase5-probe',trial,'report.json')]},actualAllowanceMicros:Math.ceil(report.reported_cost_usd*1e6),providerUsage:report.usage});
   const bytes=Buffer.from(JSON.stringify(report));await writeFile(join(store.draftDirectory(ctx),'report.json'),bytes);const e=store.mediaSupplied(ctx,bytes,{runId:trial,model:'host-evidence-audit',modality:'text',coverage:'complete receipt'});store.inspectionCompleted(ctx,e,'Actual receipt reports four tool turns, correct four colors, successful submission and linked LangSmith trace.');store.publish(ctx,{draft_path:'report.json',evidence_references:[e]});}
 }
 if(routedRecovery){const waiting=store.operation('613fab0d-9a27-403e-89b2-d89bcae38198');if(waiting.state==='INTENT')store.failOperation(waiting.id,'Unsent intent cancelled before fresh routed worker recovery',true);}
 const prefix=packetFix?'packet':mediaFix?'media':'routed';
 const authors=routedRecovery?[prefix+'-author-a',prefix+'-author-b']:['deepseek-author-a','deepseek-author-b'];
 for(const [i,id]of authors.entries()){
  const original=store.ticket(i?'author-b':'author-a'),old=join(root,'assignments',original.id,original.attempt_id);store.createTicket(id,'phase5','background-author',{},1500000,'AUTHOR',{maxTurns:8,maxAttempts:1});
  const ctx=store.claim(id,id,300000),mount=dirname(store.draftDirectory(ctx));await copyFile(join(old,'drafts/candidate.webp'),join(mount,'drafts/candidate.webp'));await copyFile(join(old,'generation-prompt.json'),join(mount,'generation-prompt.json'));
 }
 const contexts=authors.map(ticketId=>{const t=store.ticket(ticketId);return{ticketId,workerId:t.worker_id,token:t.token,attemptId:t.attempt_id};});
 const outcomes=await Promise.allSettled(contexts.map(async ctx=>{try{await worker(ctx,false,true);}catch(e){store.operator('phase5','pause',1,{id:randomUUID(),actor:'trusted-producer',reason:'OpenRouter author failed'});throw e;}}));
 const failure=outcomes.find(r=>r.status==='rejected'&&!String(r.reason?.message).includes('PROJECT_PAUSED'))??outcomes.find(r=>r.status==='rejected');if(failure?.status==='rejected')throw failure.reason;
 for(const [i,author]of authors.entries())store.startReview(author,(routedRecovery?prefix+'-review-':'deepseek-review-')+i,'independent-reviewer',{criteria:[criteria],modality:'image',coverage:'complete frame'},1500000,{maxTurns:4,maxAttempts:1});
 await dispatchAssignments(store,'phase5',routedRecovery?[prefix+'-review-0',prefix+'-review-1']:['deepseek-review-0','deepseek-review-1'],ctx=>worker(ctx,true,true));
 assert.ok(authors.every(id=>store.ticket(id).status==='AWAITING_APPROVAL'),'Both retained backgrounds must independently pass');
 store.operator('phase5','pause',1,{id:routedRecovery?(packetFix?'openrouter-packet-end-test':mediaFix?'openrouter-media-end-test':'openrouter-routed-end-test'):'openrouter-end-test',actor:'trusted-producer',reason:'Test finished; production remains paused'});
 const report={status:'PHASE5_OPENROUTER_LIVE_PASSED',root,receipts,wire,allowance:store.allowance('phase5'),candidates:authors.map(id=>store.version(store.ticket(id).candidate_id)),unknown_probe_reservation_retained:true,no_images_regenerated:true,no_director_approvals:true,saved_production_paused:true,scope:'Concurrent author publication and independent reviews using retained generation receipts; original two Muse generations and exhausted NIM diagnostics preserved'};
 await writeFile(join(root,routedRecovery?(packetFix?'openrouter-packet-report.json':mediaFix?'openrouter-media-report.json':'openrouter-routed-report.json'):'openrouter-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,root,workers:receipts.length,allowance:report.allowance}));store.close();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))(directorRecovery?directorRecoveryMain():reviewBackup?reviewBackupMain():openRouterRecovery?openRouterMain():main()).catch(async(error:any)=>{await mkdir(root,{recursive:true});await writeFile(join(root,'blocker-'+repair+'-'+Date.now()+'.json'),JSON.stringify({status:'STOPPED',error:error.message,repair_attempt:repair,receipts,wire},null,2));console.error(`STOP: Phase 5 live: ${error.message}\nEvidence: ${root}`);if(store){store.operator('phase5','pause',1,{id:randomUUID(),actor:'trusted-producer',reason:'STOP: live trial failed'});store.close();}process.exitCode=1;});
