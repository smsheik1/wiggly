import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { StudioProduction } from '../../lib/studio-production.js';
import { provisionLocalOperator, signLocalOperator } from '../../lib/studio-operator.js';
import { hash } from './harness.js';
import { rehearsalProject, assertPreserved } from './rehearsal.js';
import { loadMemoirFormat, createMemoirAssignment, candidateValidator, startMemoirReview, runMemoirReviewer } from './memoir-format.js';
import { rehearsalWorker } from './rehearsal-worker.js';
import { tracing, namedSecret } from './tracing.js';

/** Mechanical publication/review of contracts already authored and inspected by the active Codex.
 * This command does not write or rewrite creative content or resume the old coordinator. */
export async function runStory(root: string, kit: string, authorizationPath: string) {
  const dir=join(root,'story-narration'), quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8'));
  const authorization=JSON.parse(readFileSync(authorizationPath,'utf8'));
  if(authorization.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||authorization.allowance_micros!==2000000||!authorization.operator_message?.trim())throw new Error('EXACT_BATCH_AUTHORIZATION_REQUIRED');
  if(Object.values(quote.ticket_caps_micros).reduce((a:any,b:any)=>a+b,0)!==2000000)throw new Error('BATCH_CAP_MISMATCH');
  const marker=join(dir,'started.json');if(existsSync(marker))throw new Error('BATCH_ALREADY_STARTED_NO_AUTOMATIC_RETRY');
  const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));assertPreserved(manifest.source,manifest.saved_production_hashes);
  const format=await loadMemoirFormat(kit), store=new StudioProduction(root),principal=provisionLocalOperator(root);
  const results:any[]=[];let failure:string|undefined;
  try{
    if(store.project(rehearsalProject).paused!==1)throw new Error('REHEARSAL_MUST_BE_PAUSED');
    writeFileSync(marker,JSON.stringify({authorization,quote,started_at:new Date().toISOString()}),{flag:'wx',mode:0o600});
    store.authenticatedProjectCommand(signLocalOperator(root,{id:'story-narration-allowance',principal,project_id:rehearsalProject,action:'extend_allowance' as const,value:store.project(rehearsalProject).allowance+quote.allowance_micros,reason:authorization.operator_message}));
    store.authenticatedProjectCommand(signLocalOperator(root,{id:'story-reviews-resume',principal,project_id:rehearsalProject,action:'resume' as const,value:0,reason:'Approved isolated story/narration batch only'}));
    const traces=await tracing(),key=await namedSecret('OPENROUTER_API_KEY');
    const inputs:Record<string,string>={};
    const assignments=[
      {kind:'answers',role:'script-writer',file:'answers.json',findings:'The active Codex inspected all five source answers and identity fields. The exact source digest and human approval match; sibling ages, coupe ownership, engineering salary and long-distance weekly FaceTime facts remain intact.',approval:'Reuse exact previously human-approved intake under the explicit live rehearsal plan.'},
      {kind:'script',role:'script-writer',file:'script.json',findings:'The active Codex inspected every beat and cast entry. All preferred Kimi narration is unchanged including every night; the repaired cast uses one minor late-teen design for ages seventeen and nineteen. Actual timing remains subject to measured voice delivery.',approval:'The director selected Kimi Script 1 and explicitly instructed preservation of its narration plus shared late-teen metadata repair in the approved rehearsal plan.'},
    ];
    for(const item of assignments){
      const id='rehearsal-'+item.kind,bytes=readFileSync(join(dir,item.file));
      if(item.kind==='script'&&hash(Buffer.from(JSON.stringify(JSON.parse(bytes.toString()))))!==quote.script_hash)throw new Error('AUTHORIZED_SCRIPT_CHANGED');
      createMemoirAssignment(format,store,{id,projectId:rehearsalProject,kind:item.kind,role:item.role,inputs:{...inputs},allowanceMicros:0,limits:{maxTurns:12,maxAttempts:3},outcome:item.kind==='script'?'Review and preserve the preferred Kimi narration exactly, including every night as director-authorized family ritual language. Preserve the shared late-teen design at factual ages 17 and 19. Judge narrative clarity, factual grounding and emotional purpose; actual timing is tested by synthesis next.':'Confirm the exact approved source answers without adding or paraphrasing facts.'});
      const author=store.claim(id,'active-operating-codex',300000);
      writeFileSync(join(store.draftDirectory(author),'candidate.json'),bytes,{flag:'wx',mode:0o600});
      const evidence=store.mediaSupplied(author,bytes,{runId:'active-codex-story-inspection',model:'active-operating-Codex',modality:'text',coverage:'entire authored contract'});
      store.inspectionCompleted(author,evidence,item.findings);
      const validated_hash=await candidateValidator(format,store,id)(bytes);
      store.publish(author,{draft_path:'candidate.json',evidence_references:[evidence],validated_hash});
      const reviewId=id+'-review';startMemoirReview(store,id,reviewId,quote.ticket_caps_micros[item.kind+'_review'],undefined,{maxTurns:12,maxAttempts:3});
      const ctx=store.claim(reviewId,'independent-'+item.kind+'-reviewer',300000),worker=rehearsalWorker(store,ctx,{key});
      let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(ctx,300000);}catch(e){leaseError=e;}},30000);
      try{await runMemoirReviewer(format,store,ctx,worker.model,worker.tools,{callbacks:[traces.tracer],metadata:{batch:'story-narration-v1',original_writer:'Kimi K3',candidate_kind:item.kind}},worker.evidenceReferences);}finally{clearInterval(timer);}
      if(leaseError)throw leaseError;
      if(store.ticket(id).status!=='AWAITING_APPROVAL')throw new Error('INDEPENDENT_STORY_REVIEW_DID_NOT_PASS:'+store.ticket(id).status);
      const card=store.approvalCard(id);
      store.directorDecision(signLocalOperator(root,{id:'reuse-director-'+item.kind,principal,action:'decide' as const,...card,decision:'APPROVE' as const,feedback:item.approval}));
      store.setInput(rehearsalProject,item.kind,card.candidate_version_id);inputs[item.kind]=card.candidate_version_id;
      results.push({kind:item.kind,status:'APPROVED_REUSED_DIRECTION',card,reviewer:ctx.workerId,receipt_count:worker.receipts.length});
      console.log(JSON.stringify({kind:item.kind,status:'INDEPENDENT_REVIEW_PASS',reported_batch_allowance:store.allowance(rehearsalProject)}));
    }
    await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
    return results;
  }catch(error:any){let cause=error;while(cause?.cause)cause=cause.cause;failure=String(cause);throw new Error(failure);}
  finally{
    store.authenticatedProjectCommand(signLocalOperator(root,{id:'story-reviews-pause',principal,project_id:rehearsalProject,action:'pause' as const,value:1,reason:'End isolated story review stage; retain exact approvals before voice audition'}));
    writeFileSync(join(dir,'story-review-proof.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',diagnostic:failure??null,results,allowance:store.allowance(rehearsalProject),paused:true,production_audio_generated:false,verified_cash_charges:null},null,2),{flag:'wx',mode:0o600});store.close();assertPreserved(manifest.source,manifest.saved_production_hashes);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){if(process.argv.length!==5)throw new Error('Use rehearsal-story.ts ROOT KIT AUTHORIZATION');console.log(JSON.stringify(await runStory(resolve(process.argv[2]),resolve(process.argv[3]),resolve(process.argv[4])),null,2));}
