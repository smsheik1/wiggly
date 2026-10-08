import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {StudioProduction,type WorkerLease} from '../../lib/studio-production.js';
import {provisionLocalOperator,signLocalOperator} from '../../lib/studio-operator.js';
import {hash} from './harness.js';
import {rehearsalProject,assertPreserved} from './rehearsal.js';
import {loadMemoirFormat,createMemoirAssignment,candidateValidator,startMemoirReview,runMemoirReviewer,runMemoirAuthor,approvedProjection} from './memoir-format.js';
import {rehearsalWorker,referencedMedia} from './rehearsal-worker.js';
import {executeAuthorizedMedia} from './media-transport.js';
import {createSQLPerception} from './media-perception.js';
import {tracing,namedSecret,secretsPath} from './tracing.js';

/** Continue the exact authorized batch after source acceptance; stop at the audition director gate. */
export async function runAudition(root:string,kit:string){
 const dir=join(root,'story-narration'),started=JSON.parse(readFileSync(join(dir,'started.json'),'utf8')),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8'));
 if(started.authorization.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||started.authorization.allowance_micros!==2000000)throw new Error('EXACT_BATCH_AUTHORIZATION_REQUIRED');
 const marker=join(dir,'audition-started.json'),continuation=existsSync(marker),authorContinuation=existsSync(join(dir,'audition-continued-inspection.json'));
 const continuationTag=authorContinuation?'audition-author-path-continuation':'audition-inspection-continuation';
 if(continuation){const proof=JSON.parse(readFileSync(join(dir,authorContinuation?'audition-continuation-proof.json':'audition-proof.json'),'utf8'));if(proof.diagnostic!==(authorContinuation?'Error: DRAFT_PATH_REQUIRED':'Error: INSPECTION_REQUIRED')||existsSync(join(dir,continuationTag+'-started.json')))throw new Error('AUDITION_ALREADY_STARTED_NO_AUTOMATIC_RETRY');}
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));assertPreserved(manifest.source,manifest.saved_production_hashes);
 const format=await loadMemoirFormat(kit),providers=await import(pathToFileURL(join(kit,'runtime/providers.mjs')).href),store=new StudioProduction(root),principal=provisionLocalOperator(root);
 const findings:any[]=[];let errorText:string|undefined;
 try{
  const answer=store.ticket('rehearsal-answers');store.acceptedVersion(rehearsalProject,answer.candidate_id);
  if(store.project(rehearsalProject).paused!==1)throw new Error('REHEARSAL_MUST_BE_PAUSED');
  writeFileSync(continuation?join(dir,authorContinuation?continuationTag+'-started.json':'audition-continued-inspection.json'):marker,JSON.stringify({at:new Date().toISOString(),quote_hash:hash(Buffer.from(JSON.stringify(quote))),reason:continuation?'Local missing-inspection submission guard correction; no external call failure or generation retry':''}),{flag:'wx',mode:0o600});
  store.authenticatedProjectCommand(signLocalOperator(root,{id:continuation?continuationTag+'-resume':'audition-stage-resume',principal,project_id:rehearsalProject,action:'resume' as const,value:0,reason:'Continue explicitly approved story/narration batch after source review passed'}));
  const traces=await tracing(),key=await namedSecret('OPENROUTER_API_KEY');
  const inputs:Record<string,string>={answers:answer.candidate_id};
  async function live(ctx:WorkerLease,invoke:()=>Promise<any>){let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(ctx,300000);}catch(e){leaseError=e;}},30000);try{const result=await invoke();if(leaseError)throw leaseError;return result;}finally{clearInterval(timer);}}
  for(const item of [{kind:'script',file:'script.json',outcome:'Preserve the preferred Kimi narration exactly, including every night as director-authorized family ritual language, and one minor late-teen design for factual ages 17 and 19. Independently judge grounding, clarity, emotional purpose and feasible voice pacing; actual voice duration is measured next.',authorFinding:'The active Codex inspected every preferred narration beat and repaired cast entry. Wording is unchanged; the shared late-teen design, childhood sibling ages and period car direction match the approved brief.',approval:'Director selected Kimi Script 1 and explicitly authorized preserving narration with shared late-teen metadata repair in the rehearsal plan.'},{kind:'clone',file:'existing-voice-provenance.json',outcome:'Verify consent and existing selected Shaz voice provenance. No new cloning. A fresh metadata lookup is supplied separately below; actual identity/performance must be recognized by the director in the audition.',authorFinding:'The active Codex inspected the exact previously selected Shaz voice provenance and explicit own-voice consent. No new voice clone is requested. Current metadata must verify the same owned active voice before synthesis.',approval:'Reuse the existing Cartesia voice selection and explicit Shaz own-voice consent, as directed in the approved live rehearsal plan.'}]){
   const id='rehearsal-'+item.kind;let prior:any;try{prior=store.ticket(id);}catch(e){if(!String(e).includes('TICKET_NOT_FOUND'))throw e;}
   if(prior?.status==='APPROVED'){store.acceptedVersion(rehearsalProject,prior.candidate_id);inputs[item.kind]=prior.candidate_id;continue;}
   if(prior&&(!continuation||item.kind!=='clone'||prior.status!=='REVIEWING'))throw new Error('UNAUTHORIZED_STAGE_REPLAY');
   const bytes=readFileSync(join(dir,item.file)),content=JSON.parse(bytes.toString());
   if(item.kind==='script'&&hash(Buffer.from(JSON.stringify(content)))!==quote.script_hash)throw new Error('AUTHORIZED_SCRIPT_CHANGED');
   let fresh:any;
   if(!prior){createMemoirAssignment(format,store,{id,projectId:rehearsalProject,kind:item.kind,role:'script-writer',inputs:{...inputs},allowanceMicros:0,limits:{maxTurns:12,maxAttempts:3},outcome:item.outcome,...(item.kind==='clone'?{existingVoice:content}:{preferredScript:JSON.parse(readFileSync(join(root,'references/preferred-script.json'),'utf8'))})});
   const ctx=store.claim(id,'active-operating-codex',300000);
   if(item.kind==='clone'){
    const receipt=join(dir,'fresh-voice-lookup.json'),operationId='rehearsal-voice-metadata';
    await store.executeOperation(ctx,{operationId,provider:'cartesia',estimateMicros:0,requestHash:hash(Buffer.from(JSON.stringify({voiceId:quote.voice_id,apiVersion:content.origin.lookup.apiVersion})))},async()=>{
     fresh=await providers.lookupExistingVoice({studio:format.snapshot,voiceChoice:{voiceId:quote.voice_id,name:content.origin.lookup.name}},secretsPath);
     writeFileSync(receipt,JSON.stringify(fresh,null,2),{flag:'wx',mode:0o600});
     return{completed:{result:{artifactReferences:[],receiptReference:receipt},actualAllowanceMicros:0,providerUsage:{basis:'Metadata GET only; no synthesis or clone'}}};
    },e=>`${e}\n${providers.remediation('cartesia',secretsPath)}`);
   }
   writeFileSync(join(store.draftDirectory(ctx),'candidate.json'),bytes,{flag:'wx',mode:0o600});
   const evidence=store.mediaSupplied(ctx,bytes,{runId:'active-codex-preserved-contract',model:'active-operating-Codex',modality:'text',coverage:'entire preserved authored contract'});store.inspectionCompleted(ctx,evidence,item.authorFinding);
   store.publish(ctx,{draft_path:'candidate.json',evidence_references:[evidence],validated_hash:await candidateValidator(format,store,id)(bytes)});
   }
   if(prior)fresh=JSON.parse(readFileSync(join(dir,'fresh-voice-lookup.json'),'utf8'));
   const reviewerId=id+'-review';if(!prior)startMemoirReview(store,id,reviewerId,quote.ticket_caps_micros[item.kind+'_review'],undefined,{maxTurns:12,maxAttempts:3});
   const existingReview=prior?store.ticket(reviewerId):null;
   const reviewCtx=existingReview&&existingReview.lease_until>Date.now()?{ticketId:reviewerId,workerId:existingReview.worker_id,token:existingReview.token,attemptId:existingReview.attempt_id}:store.claim(reviewerId,'independent-'+item.kind+'-reviewer',300000);store.heartbeat(reviewCtx,300000);const worker=rehearsalWorker(store,reviewCtx,{key});
   await live(reviewCtx,()=>runMemoirReviewer(format,store,reviewCtx,worker.model,worker.tools,{callbacks:[traces.tracer],metadata:{batch:quote.id,candidate_kind:item.kind}},worker.evidenceReferences,fresh?`${prior?'Continue the same candidate and review attempt after a local missing-receipt rejection; the four prior calls are retained and only eight turns remain. The previous verdict was rejected before any review was recorded. Call inspect_candidate with no arguments, then submit_review. Do not repeat filesystem searches. ':''}Fresh Cartesia GET metadata, verified by the trusted transport for the same selected ID/name, active ownership and language: ${JSON.stringify(fresh)}. Historical selection/consent stays intact; do not mistake this provenance review for audible identity approval.`:''));
   if(store.ticket(id).status!=='AWAITING_APPROVAL')throw new Error('INDEPENDENT_REVIEW_DID_NOT_PASS:'+item.kind+':'+store.ticket(id).status);
   const card=store.approvalCard(id);store.directorDecision(signLocalOperator(root,{id:'reuse-director-'+item.kind,principal,action:'decide' as const,...card,decision:'APPROVE' as const,feedback:item.approval}));store.setInput(rehearsalProject,item.kind,card.candidate_version_id);inputs[item.kind]=card.candidate_version_id;
   findings.push({kind:item.kind,reviewer:reviewCtx.workerId,card});console.log(JSON.stringify({kind:item.kind,status:'INDEPENDENT_REVIEW_PASS'}));
  }
  const id='rehearsal-audition';const oldAudition=authorContinuation?store.ticket(id):null;
  if(oldAudition&&(oldAudition.status!=='WORKING'||store.operation('rehearsal-audition-generation').state!=='COMPLETED'))throw new Error('UNSAFE_AUDITION_RECOVERY');
  if(!oldAudition)createMemoirAssignment(format,store,{id,projectId:rehearsalProject,kind:'audition',role:'film-editor',inputs,allowanceMicros:quote.ticket_caps_micros.audition_author,limits:{maxTurns:12,maxAttempts:3},outcome:'Audition the existing Shaz clone on preferred Kimi beat 1. Preserve the exact approved words. Inspect the actual source audio for natural, affectionate delivery, no rushed speech, audible seams or clipped endings. Use the already generated /drafts/candidate.json; do not generate or invent files. Inspect then finish_inspection and submit_candidate. Human voice recognition remains pending.'});
  const ctx=oldAudition&&oldAudition.lease_until>Date.now()?{ticketId:id,workerId:oldAudition.worker_id,token:oldAudition.token,attemptId:oldAudition.attempt_id}:store.claim(id,'deepagents-audition-author',300000);store.heartbeat(ctx,300000);const projection=approvedProjection(format,store,rehearsalProject,inputs,'audition');
  const estimate=providers.generationEstimate(projection,'audition'),plan={provider:'cartesia',operation:'audition',estimatedCostUsd:estimate.estimatedCostUsd,parameters:{model:format.config.generation.voice.model,cartesiaVersion:format.config.generation.voice.apiVersion}};
  const candidate=await executeAuthorizedMedia(format,store,ctx,{operationId:'rehearsal-audition-generation',provider:'cartesia',estimateMicros:Math.ceil(plan.estimatedCostUsd*1e6),plan,request:providers.requestDescriptor(projection,plan)});
  const draft=join(store.draftDirectory(ctx),'candidate.json');if(existsSync(draft)){if(format.contracts.digest(JSON.parse(readFileSync(draft,'utf8')))!==format.contracts.digest(candidate))throw new Error('EXISTING_AUDITION_DRAFT_CHANGED');}else writeFileSync(draft,JSON.stringify(candidate),{flag:'wx',mode:0o600});
  async function inspection(ctx:WorkerLease,content:any){if(format.contracts.digest(content)!==format.contracts.digest(candidate))throw new Error('AUTHORIZED_AUDITION_MEDIA_CHANGED');const files=referencedMedia(content),tools=await createSQLPerception({kit,store,ctx,files,criteria:format.contracts.criteria.audition,maxCalls:files.length,estimateMicros:60000});const results=[];for(const file of files){store.heartbeat(ctx,300000);results.push(await tools.inspect('audio',file.sha256));}return results;}
  const author=rehearsalWorker(store,ctx,{key,inspectMedia:content=>inspection(ctx,content)});
  await live(ctx,()=>runMemoirAuthor(format,store,ctx,author.model,author.tools,{callbacks:[traces.tracer],metadata:{batch:quote.id,candidate_kind:'audition',stage:'owner-inspection'}},author.evidenceReferences));
  if(store.ticket(id).status!=='SUBMITTED')throw new Error('AUDITION_AUTHOR_DID_NOT_SUBMIT');
  const reviewerId=id+'-review';startMemoirReview(store,id,reviewerId,quote.ticket_caps_micros.audition_review,undefined,{maxTurns:12,maxAttempts:3});
  const reviewCtx=store.claim(reviewerId,'independent-audition-reviewer',300000),reviewer=rehearsalWorker(store,reviewCtx,{key,inspectMedia:content=>inspection(reviewCtx,content)});
  await live(reviewCtx,()=>runMemoirReviewer(format,store,reviewCtx,reviewer.model,reviewer.tools,{callbacks:[traces.tracer],metadata:{batch:quote.id,candidate_kind:'audition',stage:'independent-inspection'}},reviewer.evidenceReferences,'Existing clone has no original recording for automated speaker similarity; do not fabricate that measurement. Assess the actual audible performance and transcript; director recognition is the explicit next gate.'));
  if(store.ticket(id).status!=='AWAITING_APPROVAL')throw new Error('AUDITION_REVIEW_DID_NOT_PASS:'+store.ticket(id).status);
  await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
  const card=store.approvalCard(id);findings.push({kind:'audition',status:'AWAITING_DIRECTOR',card,files:candidate.files,reviewer:reviewCtx.workerId});console.log(JSON.stringify({status:'AWAITING_DIRECTOR',files:candidate.files,card},null,2));
 }catch(error:any){let e=error;while(e?.cause)e=e.cause;errorText=String(e);throw new Error(errorText);}
 finally{
  store.authenticatedProjectCommand(signLocalOperator(root,{id:continuation?continuationTag+'-pause':'audition-stage-pause',principal,project_id:rehearsalProject,action:'pause' as const,value:1,reason:'End audition stage; no four-beat generation before exact voice audition approval'}));
  writeFileSync(join(dir,continuation?(authorContinuation?'audition-author-path-proof.json':'audition-continuation-proof.json'):'audition-proof.json'),JSON.stringify({status:errorText?'BLOCKED':'AWAITING_DIRECTOR',diagnostic:errorText??null,findings,allowance:store.allowance(rehearsalProject),invoice_charges:null,paused:true},null,2),{flag:'wx',mode:0o600});store.close();assertPreserved(manifest.source,manifest.saved_production_hashes);
 }
 return findings;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){if(process.argv.length!==4)throw new Error('Use rehearsal-audition.ts ROOT KIT');await runAudition(resolve(process.argv[2]),resolve(process.argv[3]));}
