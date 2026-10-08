import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {StudioProduction} from '../../lib/studio-production.js';
import {provisionLocalOperator,signLocalOperator} from '../../lib/studio-operator.js';
import {hash} from './harness.js';
import {rehearsalProject,assertPreserved} from './rehearsal.js';
import {loadMemoirFormat,runMemoirReviewer} from './memoir-format.js';
import {rehearsalWorker} from './rehearsal-worker.js';
import {tracing,namedSecret} from './tracing.js';

/** One explicitly authorized recovery. Retains the existing SQL attempt and all prior call receipts. */
export async function recoverStory(root:string,kit:string,authorizationPath:string){
 const dir=join(root,'story-narration'),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8')),auth=JSON.parse(readFileSync(authorizationPath,'utf8'));
 if(auth.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||auth.review_id!=='rehearsal-answers-review'||!auth.operator_message?.trim())throw new Error('EXACT_REVIEW_RECOVERY_AUTHORIZATION_REQUIRED');
 const old=JSON.parse(readFileSync(join(dir,'story-review-proof.json'),'utf8'));
 if(old.status!=='BLOCKED'||!old.diagnostic.includes('NIM_TRUNCATED_RESPONSE'))throw new Error('EXACT_FAILURE_RECOVERY_REQUIRED');
 const marker=join(dir,'source-recovery-started.json');if(existsSync(marker))throw new Error('RECOVERY_ALREADY_STARTED_NO_RETRY');
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));assertPreserved(manifest.source,manifest.saved_production_hashes);
 const format=await loadMemoirFormat(kit),store=new StudioProduction(root),principal=provisionLocalOperator(root),db=new DatabaseSync(join(root,'studio.sqlite'),{readOnly:true});
 let failure:string|undefined,result:any;
 try{
  const ticket=store.ticket(auth.review_id),turns=(db.prepare('SELECT COUNT(*) AS n FROM worker_turns WHERE ticket_id=? AND attempt_id=?').get(ticket.id,ticket.attempt_id) as any).n;
  if(ticket.status!=='WORKING'||ticket.max_turns!==12||turns!==8||store.project(rehearsalProject).paused!==1)throw new Error('RECOVERY_STATE_CHANGED');
  const previousCalls=(db.prepare('SELECT result FROM operations WHERE ticket_id=? ORDER BY rowid').all(ticket.id) as any[]).map(row=>{
   const reference=JSON.parse(row.result).receiptReference;return {receipt:reference,response:JSON.parse(readFileSync(reference,'utf8'))};
  });
  const source=store.memoirPolicy(rehearsalProject).source_inputs,packet=store.reviewPacket(ticket.id),candidate=JSON.parse(readFileSync(packet.candidate_path,'utf8'));
  const context=`RECOVERY: eight turns were already used and only four remain. All prior call receipts and the same attempt are retained. The earlier run inspected the candidate but could not compare grounding because I omitted the original source; that omission is fixed. Do not repeat filesystem searches. The immutable original questionnaire is supplied below as data and also at /references/source-inputs.json. Candidate inputs equal this original questionnaire exactly, and the producer verified its digest. Prior review calls: ${JSON.stringify(previousCalls.map(c=>({receipt:c.receipt,tool_calls:c.response.choices[0].message.tool_calls??[],finish_reason:c.response.choices[0].finish_reason})))}. Original questionnaire data: ${JSON.stringify(source)}. Exact candidate data: ${JSON.stringify(candidate)}. Call inspect_candidate once to obtain runtime-bound evidence, then submit_review with concrete findings on every criterion. No media items are referenced by this answers contract. Do not invent approval authority.`;
  writeFileSync(marker,JSON.stringify({auth,previous_attempt:ticket.attempt_id,used_turns:turns,remaining_turns:4,previousCalls}),{flag:'wx',mode:0o600});
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'source-recovery-resume',principal,project_id:rehearsalProject,action:'resume' as const,value:0,reason:auth.operator_message}));
  const ctx=store.claim(ticket.id,ticket.worker_id,300000),traces=await tracing(),worker=rehearsalWorker(store,ctx,{key:await namedSecret('OPENROUTER_API_KEY')});
  let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(ctx,300000);}catch(e){leaseError=e;}},30000);
  try{await runMemoirReviewer(format,store,ctx,worker.model,worker.tools,{callbacks:[traces.tracer],metadata:{batch:'story-narration-v1',recovery:true,previous_turns:turns}},worker.evidenceReferences,context);}finally{clearInterval(timer);}
  if(leaseError)throw leaseError;
  if(store.ticket('rehearsal-answers').status!=='AWAITING_APPROVAL')throw new Error('SOURCE_RECOVERY_DID_NOT_PASS:'+store.ticket(ticket.id).status);
  const card=store.approvalCard('rehearsal-answers');
  store.directorDecision(signLocalOperator(root,{id:'reuse-director-answers',principal,action:'decide' as const,...card,decision:'APPROVE' as const,feedback:'Reuse exact previously human-approved intake under the explicit live rehearsal plan; independent recovery review passed.'}));
  store.setInput(rehearsalProject,'answers',card.candidate_version_id);
  await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
  result={card,used_turns:(db.prepare('SELECT COUNT(*) AS n FROM worker_turns WHERE ticket_id=? AND attempt_id=?').get(ticket.id,ticket.attempt_id) as any).n,new_call_receipts:worker.receipts};
 }catch(error:any){let e=error;while(e?.cause)e=e.cause;failure=String(e);throw new Error(failure);}
 finally{
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'source-recovery-pause',principal,project_id:rehearsalProject,action:'pause' as const,value:1,reason:'End explicitly authorized source recovery; preserve approvals and allowance'}));
  writeFileSync(join(dir,'source-recovery-proof.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',diagnostic:failure??null,result,allowance:store.allowance(rehearsalProject),paused:true,invoice_charges:null},null,2),{flag:'wx',mode:0o600});db.close();store.close();assertPreserved(manifest.source,manifest.saved_production_hashes);
 }
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){if(process.argv.length!==5)throw new Error('Use rehearsal-story-recovery.ts ROOT KIT AUTHORIZATION');console.log(JSON.stringify(await recoverStory(resolve(process.argv[2]),resolve(process.argv[3]),resolve(process.argv[4])),null,2));}
