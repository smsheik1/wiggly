import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {StudioProduction,type WorkerLease} from '../../lib/studio-production.js';
import {provisionLocalOperator,signLocalOperator} from '../../lib/studio-operator.js';
import {hash} from './harness.js';
import {rehearsalProject,assertPreserved} from './rehearsal.js';
import {loadMemoirFormat,createMemoirAssignment,startMemoirReview,runMemoirAuthor,approvedProjection} from './memoir-format.js';
import {rehearsalWorker,referencedMedia} from './rehearsal-worker.js';
import {executeAuthorizedMedia} from './media-transport.js';
import {createSQLPerception} from './media-perception.js';
import {tracing,namedSecret} from './tracing.js';
import {directAudioReview} from './gemini-audio-review.js';

/** One director-approved four-beat batch, with separate native author/reviewer inspection. */
export async function runNarration(root:string,kit:string,authorizationPath:string){
 const dir=join(root,'story-narration'),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8')),auth=JSON.parse(readFileSync(authorizationPath,'utf8'));
 if(auth.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||auth.ticket_id!=='rehearsal-audition'||!auth.operator_message?.trim())throw new Error('EXACT_AUDITION_APPROVAL_REQUIRED');
 const marker=join(dir,'four-beats-started.json');if(existsSync(marker))throw new Error('NARRATION_ALREADY_STARTED_NO_RETRY');
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));assertPreserved(manifest.source,manifest.saved_production_hashes);
 const format=await loadMemoirFormat(kit),providers=await import(pathToFileURL(join(kit,'runtime/providers.mjs')).href),store=new StudioProduction(root),principal=provisionLocalOperator(root);
 let failure:string|undefined,result:any;
 try{
  if(store.project(rehearsalProject).paused!==1)throw new Error('REHEARSAL_MUST_BE_PAUSED');
  const card=store.approvalCard(auth.ticket_id);if(card.content_hash!==auth.content_hash||card.candidate_version_id!==auth.candidate_version_id)throw new Error('APPROVED_AUDITION_CHANGED');
  writeFileSync(marker,JSON.stringify({auth,card,at:new Date().toISOString()}),{flag:'wx',mode:0o600});
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'four-beats-stage-resume',principal,project_id:rehearsalProject,action:'resume' as const,value:0,reason:auth.operator_message}));
  store.directorDecision(signLocalOperator(root,{id:'director-audition-approval',principal,action:'decide' as const,...card,decision:'APPROVE' as const,feedback:auth.operator_message}));store.setInput(rehearsalProject,'audition',card.candidate_version_id);
  const inputs=Object.fromEntries(['answers','script','clone','audition'].map(kind=>[kind,store.ticket('rehearsal-'+kind).candidate_id]));
  const id='rehearsal-narration';createMemoirAssignment(format,store,{id,projectId:rehearsalProject,kind:'narration',role:'film-editor',inputs,allowanceMicros:quote.ticket_caps_micros.narration_author,limits:{maxTurns:12,maxAttempts:3},outcome:'Produce four intact preferred Kimi narration beats in the approved Shaz voice. Preserve every word including every night. Inspect each actual source and presentation clip for natural affectionate delivery, complete words, no rush, clipping or audible seams. Inspect the already generated /drafts/candidate.json then finish_inspection and submit_candidate; do not generate additional media or invent files. Target four 15-second windows; report measured timing incompatibility honestly.'});
  const ctx=store.claim(id,'deepagents-narration-author',300000),projection=approvedProjection(format,store,rehearsalProject,inputs,'narration'),estimate=providers.generationEstimate(projection,'narration');
  const plan={provider:'cartesia',operation:'narration',estimatedCostUsd:estimate.estimatedCostUsd,parameters:{model:format.config.generation.voice.model,cartesiaVersion:format.config.generation.voice.apiVersion}};
  const candidate=await executeAuthorizedMedia(format,store,ctx,{operationId:'rehearsal-four-beats-generation',provider:'cartesia',estimateMicros:Math.ceil(plan.estimatedCostUsd*1e6),plan,request:providers.requestDescriptor(projection,plan)});
  writeFileSync(join(store.draftDirectory(ctx),'candidate.json'),JSON.stringify(candidate),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'FOUR_BEATS_GENERATED',files:candidate.files,sourceFiles:candidate.sourceFiles}));
  const traces=await tracing(),key=await namedSecret('OPENROUTER_API_KEY'),geminiKey=await namedSecret('GEMINI_API_KEY');
  async function inspection(lease:WorkerLease,content:any){
   if(format.contracts.digest(content)!==format.contracts.digest(candidate))throw new Error('AUTHORIZED_NARRATION_MEDIA_CHANGED');
   const files=referencedMedia(content),tools=await createSQLPerception({kit,store,ctx:lease,files,criteria:[...format.contracts.criteria.narration,'Inspect actual spoken words; quote audible deviations, missing words and seams with timestamps. Assess pacing and report uncertainty rather than assuming the transcript metadata proves spoken words.'],maxCalls:files.length,estimateMicros:60000});
   const results=[];for(const file of files){store.heartbeat(lease,300000);results.push(await tools.inspect('audio',file.sha256));}return results;
  }
  async function live(lease:WorkerLease,invoke:()=>Promise<any>){let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(lease,300000);}catch(e){leaseError=e;}},30000);try{const value=await invoke();if(leaseError)throw leaseError;return value;}finally{clearInterval(timer);}}
  const author=rehearsalWorker(store,ctx,{key,inspectMedia:content=>inspection(ctx,content)});
  await live(ctx,()=>runMemoirAuthor(format,store,ctx,author.model,author.tools,{callbacks:[traces.tracer],metadata:{batch:quote.id,candidate_kind:'narration',stage:'owner-inspection'}},author.evidenceReferences));
  if(store.ticket(id).status!=='SUBMITTED')throw new Error('NARRATION_AUTHOR_DID_NOT_SUBMIT');
  const reviewerId=id+'-review';startMemoirReview(store,id,reviewerId,quote.ticket_caps_micros.narration_review,undefined,{maxTurns:12,maxAttempts:3});
  const reviewCtx=store.claim(reviewerId,'independent-gemini-audio-reviewer',300000),packet=store.reviewPacket(reviewerId),references=Object.fromEntries(Object.entries(packet.exact_inputs as Record<string,string>).map(([name,v])=>[name,JSON.parse(readFileSync(store.acceptedVersion(rehearsalProject,v).path,'utf8'))]));
  await live(reviewCtx,()=>directAudioReview(store,reviewCtx,{key:geminiKey,references,traceClient:traces.client}));
  if(store.ticket(id).status!=='AWAITING_APPROVAL')throw new Error('NARRATION_REVIEW_DID_NOT_PASS:'+store.ticket(id).status);
  await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
  result={card:store.approvalCard(id),files:candidate.files,sourceFiles:candidate.sourceFiles,tailSilenceSeconds:candidate.tailSilenceSeconds};
 }catch(error:any){let e=error;while(e?.cause)e=e.cause;failure=String(e);throw new Error(failure);}
 finally{
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'four-beats-stage-pause',principal,project_id:rehearsalProject,action:'pause' as const,value:1,reason:'End bounded narration batch; retain exact clips and await director review'}));
  writeFileSync(join(dir,'four-beats-proof.json'),JSON.stringify({status:failure?'BLOCKED':'AWAITING_DIRECTOR',diagnostic:failure??null,result,allowance:store.allowance(rehearsalProject),paused:true,invoice_charges:null},null,2),{flag:'wx',mode:0o600});store.close();assertPreserved(manifest.source,manifest.saved_production_hashes);
 }
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){if(process.argv.length!==5)throw new Error('Use rehearsal-narration-live.ts ROOT KIT AUTHORIZATION');console.log(JSON.stringify(await runNarration(resolve(process.argv[2]),resolve(process.argv[3]),resolve(process.argv[4])),null,2));}
