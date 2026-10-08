import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {StudioProduction} from '../../lib/studio-production.js';
import {provisionLocalOperator,signLocalOperator} from '../../lib/studio-operator.js';
import {hash} from './harness.js';
import {rehearsalProject,assertPreserved} from './rehearsal.js';
import {loadMemoirFormat,runMemoirReviewer} from './memoir-format.js';
import {rehearsalWorker,referencedMedia} from './rehearsal-worker.js';
import {tracing,namedSecret} from './tracing.js';

export async function recoverAudition(root:string,kit:string,authorizationPath:string){
 const dir=join(root,'story-narration'),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8')),auth=JSON.parse(readFileSync(authorizationPath,'utf8'));
 if(auth.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||auth.review_id!=='rehearsal-audition-review'||!auth.operator_message?.trim())throw new Error('EXACT_REVIEW_RECOVERY_AUTHORIZATION_REQUIRED');
 const marker=join(dir,'audition-review-recovery-started.json');if(existsSync(marker))throw new Error('RECOVERY_ALREADY_STARTED_NO_RETRY');
 const receiptPath=join(dir,'audition-timeout-reconciliation.json'),receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
 if(receipt.provider_status!==499||receipt.output_available!==false||receipt.operation_id!=='3028ec7d-0d33-4f59-86f9-3ca72204eca8')throw new Error('TERMINAL_TIMEOUT_RECEIPT_REQUIRED');
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));assertPreserved(manifest.source,manifest.saved_production_hashes);
 const format=await loadMemoirFormat(kit),store=new StudioProduction(root),principal=provisionLocalOperator(root),db=new DatabaseSync(join(root,'studio.sqlite'),{readOnly:true});
 let failure:string|undefined,result:any;
 try{
  const ticket=store.ticket(auth.review_id),packet=store.reviewPacket(ticket.id),turns=(db.prepare('SELECT COUNT(*) AS n FROM worker_turns WHERE ticket_id=? AND attempt_id=?').get(ticket.id,ticket.attempt_id) as any).n;
  const op=store.operation(receipt.operation_id);
  if(ticket.status!=='BLOCKED'||ticket.max_turns!==12||turns!==5||store.project(rehearsalProject).paused!==1||op.settled_at===null)throw new Error('RECOVERY_STATE_CHANGED');
  const candidate=JSON.parse(readFileSync(packet.candidate_path,'utf8')),files=referencedMedia(candidate),perceptionDir=join(root,'perception',ticket.attempt_id);
  const inspections=readdirSync(perceptionDir).filter(name=>name.endsWith('-inspection.json')).map(name=>JSON.parse(readFileSync(join(perceptionDir,name),'utf8')));
  const completed=files.map(file=>{
   if(hash(readFileSync(file.path))!==file.sha256)throw new Error('INSPECTION_MEDIA_CHANGED');
   const evidence=inspections.find(r=>r.file_sha256===file.sha256&&r.report?.perceptible===true&&r.report?.fullMediaInspected===true);
   if(!evidence)throw new Error('COMPLETED_REVIEW_AUDIO_INSPECTION_REQUIRED');
   for(const id of evidence.evidence_references){const binding=db.prepare('SELECT * FROM inspections WHERE id=?').get(id) as any;if(binding?.ticket_id!==ticket.id||binding.attempt_id!==ticket.attempt_id||binding.content_hash!==file.sha256||binding.status!=='INSPECTION_COMPLETED')throw new Error('INVALID_CACHED_INSPECTION');}
   return evidence;
  });
  const previousCalls=db.prepare('SELECT id,state,result FROM operations WHERE ticket_id=? ORDER BY rowid').all(ticket.id);
  writeFileSync(marker,JSON.stringify({auth,previous_attempt:ticket.attempt_id,used_turns:turns,remaining_turns:7,previousCalls}),{flag:'wx',mode:0o600});
  store.recoverSettledFailure(signLocalOperator(root,{id:'audition-review-timeout-recovery',principal,project_id:rehearsalProject,action:'recover_settled_failure' as const,ticket_id:ticket.id,operation_id:op.id,expected_revision:ticket.revision,request_id:receipt.generation_id,evidence_reference:receiptPath,reason:auth.operator_message}));
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'audition-review-recovery-resume',principal,project_id:rehearsalProject,action:'resume' as const,value:0,reason:auth.operator_message}));
  const ctx=store.claim(ticket.id,ticket.worker_id,300000);if(ctx.attemptId!==ticket.attempt_id)throw new Error('RECOVERY_ATTEMPT_CHANGED');
  const traces=await tracing(),worker=rehearsalWorker(store,ctx,{key:await namedSecret('OPENROUTER_API_KEY'),inspectMedia:async content=>{if(hash(Buffer.from(JSON.stringify(content)))!==hash(Buffer.from(JSON.stringify(candidate))))throw new Error('RECOVERY_CANDIDATE_CHANGED');return completed;}});
  const context=`RECOVERY: five prior turns and all provider receipts remain recorded in the same attempt; seven turns remain. The last call timed out before submitting a verdict. The independent reviewer's dedicated Gemini audio inspection completed for the same exact clip and will be reused by inspect_candidate without another perception or synthesis call. Read candidate and approved script directly, call inspect_candidate once, assess the returned audible findings, and submit_review. Do not search for private recordings or preferred writer drafts; the accepted script reference is authoritative. Automated speaker similarity is unavailable and is explicitly reserved for the director's next audition approval; do not fabricate it or make it an extra automated prerequisite. Preserve every packet criterion. Prior operation history: ${JSON.stringify(previousCalls)}.`;
  let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(ctx,300000);}catch(e){leaseError=e;}},30000);
  try{await runMemoirReviewer(format,store,ctx,worker.model,worker.tools,{callbacks:[traces.tracer],metadata:{batch:quote.id,recovery:true,previous_turns:turns,candidate_kind:'audition'}},worker.evidenceReferences,context);}finally{clearInterval(timer);}
  if(leaseError)throw leaseError;
  if(store.ticket('rehearsal-audition').status!=='AWAITING_APPROVAL')throw new Error('AUDITION_RECOVERY_DID_NOT_PASS:'+store.ticket(ticket.id).status);
  await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
  result={card:store.approvalCard('rehearsal-audition'),files,used_turns:(db.prepare('SELECT COUNT(*) AS n FROM worker_turns WHERE ticket_id=? AND attempt_id=?').get(ticket.id,ticket.attempt_id) as any).n,new_call_receipts:worker.receipts};
 }catch(error:any){let e=error;while(e?.cause)e=e.cause;failure=String(e);throw new Error(failure);}
 finally{
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'audition-review-recovery-pause',principal,project_id:rehearsalProject,action:'pause' as const,value:1,reason:'End one authorized review recovery; await exact audition director decision'}));
  writeFileSync(join(dir,'audition-review-recovery-proof.json'),JSON.stringify({status:failure?'BLOCKED':'AWAITING_DIRECTOR',diagnostic:failure??null,result,allowance:store.allowance(rehearsalProject),paused:true,invoice_charges:null},null,2),{flag:'wx',mode:0o600});db.close();store.close();assertPreserved(manifest.source,manifest.saved_production_hashes);
 }
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){if(process.argv.length!==5)throw new Error('Use rehearsal-audition-recovery.ts ROOT KIT AUTHORIZATION');console.log(JSON.stringify(await recoverAudition(resolve(process.argv[2]),resolve(process.argv[3]),resolve(process.argv[4])),null,2));}
