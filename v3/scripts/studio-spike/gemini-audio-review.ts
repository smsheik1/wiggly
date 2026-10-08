import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {StudioProduction} from '../../lib/studio-production.js';
import {provisionLocalOperator,signLocalOperator} from '../../lib/studio-operator.js';
import {hash} from './harness.js';
import {tracing,namedSecret} from './tracing.js';
import {assertPreserved,rehearsalProject} from './rehearsal.js';
import {runGeminiAudioReviewer} from './gemini-reviewer-agent.js';
export {runGeminiMediaReviewer,runGeminiAudioReviewer} from './gemini-reviewer-agent.js';

export async function recoverNarration(root:string,authorizationPath:string){
 const dir=join(root,'story-narration'),auth=JSON.parse(readFileSync(authorizationPath,'utf8')),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8'));
 if(auth.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||auth.review_id!=='rehearsal-narration-review'||auth.route!=='gemini-direct'||!auth.operator_message?.trim())throw new Error('EXACT_GEMINI_RECOVERY_AUTHORIZATION_REQUIRED');
 const marker=join(dir,'narration-gemini-recovery-started.json');if(existsSync(marker))throw new Error('RECOVERY_ALREADY_STARTED_NO_RETRY');
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));assertPreserved(manifest.source,manifest.saved_production_hashes);
 const store=new StudioProduction(root),principal=provisionLocalOperator(root);let result:any,failure:string|undefined;
 try{
  const ticket=store.ticket(auth.review_id),receiptPath=join(dir,'narration-timeout-reconciliation.json'),receipt=JSON.parse(readFileSync(receiptPath,'utf8'));
  if(ticket.status!=='BLOCKED'||ticket.max_turns!==12||store.project(rehearsalProject).paused!==1||receipt.provider_status!==499)throw new Error('RECOVERY_STATE_CHANGED');
  writeFileSync(marker,JSON.stringify(auth),{flag:'wx',mode:0o600});
  store.recoverSettledFailure(signLocalOperator(root,{id:'narration-gemini-recovery',principal,project_id:rehearsalProject,action:'recover_settled_failure' as const,ticket_id:ticket.id,operation_id:receipt.operation_id,expected_revision:ticket.revision,request_id:receipt.generation_id,evidence_reference:receiptPath,reason:auth.operator_message}));
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'narration-gemini-resume',principal,project_id:rehearsalProject,action:'resume' as const,value:0,reason:auth.operator_message}));
  const ctx=store.claim(ticket.id,ticket.worker_id,300000),packet=store.reviewPacket(ticket.id),references=Object.fromEntries(Object.entries(packet.exact_inputs as Record<string,string>).map(([name,id])=>[name,JSON.parse(readFileSync(store.acceptedVersion(rehearsalProject,id).path,'utf8'))]));
  const traces=await tracing();let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(ctx,300000);}catch(e){leaseError=e;}},30000);
  try{result=await runGeminiAudioReviewer(store,ctx,{key:await namedSecret('GEMINI_API_KEY'),references,traceClient:traces.client});}finally{clearInterval(timer);}
  if(leaseError)throw leaseError;await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
 }catch(error:any){failure=String(error);throw error;}
 finally{store.authenticatedProjectCommand(signLocalOperator(root,{id:'narration-gemini-pause',principal,project_id:rehearsalProject,action:'pause' as const,value:1,reason:'End single authorized direct Gemini review'}));writeFileSync(join(dir,'narration-gemini-recovery-proof.json'),JSON.stringify({status:failure?'BLOCKED':result.report.verdict,diagnostic:failure??null,result,allowance:store.allowance(rehearsalProject),paused:true,invoice_charges:null},null,2),{flag:'wx',mode:0o600});store.close();assertPreserved(manifest.source,manifest.saved_production_hashes);}
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){if(process.argv.length!==4)throw new Error('Use gemini-audio-review.ts ROOT AUTHORIZATION');console.log(JSON.stringify(await recoverNarration(resolve(process.argv[2]),resolve(process.argv[3])),null,2));}
