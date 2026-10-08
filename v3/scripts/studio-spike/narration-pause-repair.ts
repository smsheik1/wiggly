import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {StudioProduction} from '../../lib/studio-production.js';
import {provisionLocalOperator,signLocalOperator} from '../../lib/studio-operator.js';
import {loadMemoirFormat,approvedProjection,candidateValidator,startMemoirReview} from './memoir-format.js';
import {createSQLPerception} from './media-perception.js';
import {directAudioReview} from './gemini-audio-review.js';
import {tracing,namedSecret} from './tracing.js';
import {hash} from './harness.js';
import {assertPreserved,rehearsalProject} from './rehearsal.js';

/** Active Codex authored this pause-only edit after actual inspection, under the approved batch repair scope. */
export async function repairNarration(root:string,kit:string,savedSource?:string){
 const dir=join(root,'story-narration'),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8')),approval=JSON.parse(readFileSync(join(dir,'started.json'),'utf8'));
 if(approval.authorization.quote_sha256!==hash(Buffer.from(JSON.stringify(quote))))throw new Error('EXACT_BATCH_AUTHORIZATION_REQUIRED');
 const marker=join(dir,'narration-pause-repair-started.json'),continuation=existsSync(marker),tag=continuation?'narration-pause-validation-continuation':'narration-pause-repair';
 if(continuation){const old=JSON.parse(readFileSync(join(dir,'narration-pause-repair-proof.json'),'utf8'));if(old.diagnostic!=="TypeError: Cannot read properties of undefined (reading 'filter')"||existsSync(join(dir,tag+'-started.json')))throw new Error('REPAIR_ALREADY_STARTED_NO_RETRY');}
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8')),preservedSource=savedSource??manifest.source;assertPreserved(preservedSource,manifest.saved_production_hashes);
 const format=await loadMemoirFormat(kit),store=new StudioProduction(root),principal=provisionLocalOperator(root),id='rehearsal-narration';let failure:string|undefined,result:any;
 try{
  const ticket=store.ticket(id);if(ticket.status!==(continuation?'WORKING':'CHANGES_REQUESTED')||store.project(rehearsalProject).paused!==1)throw new Error('REPAIR_NOT_ELIGIBLE');
  const parent=store.rejectedVersion(ticket.candidate_id,id),content=JSON.parse(readFileSync(parent.path,'utf8'));
  if(content.files[1].sha256!=='d174206955e3f1604b0f494c43081d3d7d6cadcfdb30762832fd44140d58697c'||content.files[1].durationSeconds!==16.24)throw new Error('EXACT_REPAIR_SOURCE_CHANGED');
  const edit={kind:'pause-shortening',keepRanges:[{startSeconds:.081565,endSeconds:6.82},{startSeconds:7.38,endSeconds:10.13},{startSeconds:10.64,endSeconds:16.129565}],reason:'Remove 1.262 seconds only from measured quiet intervals, preserving all spoken words and voice speed. Keep brief breathing gaps; use the existing three-millisecond boundary fades.'};
  writeFileSync(continuation?join(dir,tag+'-started.json'):marker,JSON.stringify({parent_version:parent.id,parent_hash:parent.content_hash,edit}),{flag:'wx',mode:0o600});
  store.authenticatedProjectCommand(signLocalOperator(root,{id:tag+'-resume',principal,project_id:rehearsalProject,action:'resume' as const,value:0,reason:'Approved batch includes bounded repair of observed timing and seams'}));
  if(!continuation)store.queueRepair(id);const ctx=continuation&&ticket.lease_until>Date.now()?{ticketId:id,workerId:ticket.worker_id,token:ticket.token,attemptId:ticket.attempt_id}:store.claim(id,'active-operating-codex',300000);store.heartbeat(ctx,300000);const p:any=approvedProjection(format,store,rehearsalProject,JSON.parse(ticket.inputs),'narration');Object.assign(p,{gate:'author',sequence:0,jobs:[],history:[],reviewDisagreements:0});
  p.artifacts.push({id:parent.id,key:'narration',kind:'narration',digest:format.contracts.digest(content),content,valid:true,review:{decision:'rejected',checks:[{criterion:'duration',status:'fail',evidence:'Beat 2 exceeds its window by 1.24 seconds'}]}});
  const editor=await import(pathToFileURL(join(kit,'runtime/audio-edit.mjs')).href),tools=editor.createAudioEditTools({runDir:root});
  const rendered=await tools.renderAudioEdit({file:content.files[1],task:format.workflow.taskFor(p),worker:{workerId:ctx.workerId,role:'film-editor'},edit});
  const pin=(file:any)=>({...file,...store.pinMedia(ctx,readFileSync(file.path),extname(file.path))}),receipt={...rendered,editedFile:pin(rendered.editedFile),outputFile:pin(rendered.outputFile)};
  const candidate=structuredClone(content);candidate.files[1]=receipt.outputFile;candidate.sourceFiles[1]=receipt.editedFile;candidate.tailSilenceSeconds[1]=receipt.tailSilenceSeconds;candidate.audioEdits=[receipt];
  for(const i of [0,2,3])if(format.contracts.digest(candidate.files[i])!==format.contracts.digest(content.files[i])||format.contracts.digest(candidate.sourceFiles[i])!==format.contracts.digest(content.sourceFiles[i]))throw new Error('UNRELATED_BEAT_CHANGED');
  const bytes=Buffer.from(JSON.stringify(candidate));const draft=join(store.draftDirectory(ctx),'candidate.json');if(existsSync(draft)){if(hash(readFileSync(draft))!==hash(bytes))throw new Error('REPAIR_DRAFT_CHANGED');}else writeFileSync(draft,bytes,{flag:'wx',mode:0o600});
  const validated=await candidateValidator(format,store,id)(bytes);
  console.log(JSON.stringify({status:'PAUSE_REPAIR_VALIDATED',duration:candidate.files[1].durationSeconds,files:candidate.files}));
  const perception=await createSQLPerception({kit,store,ctx,files:[receipt.editedFile,receipt.outputFile],criteria:['Listen completely; check that all original beat 2 words are preserved, no rushed speech or cut syllables, and pause boundaries sound smooth. Expected words: '+candidate.transcripts[1]],maxCalls:2,estimateMicros:60000});
  const own=[];for(const file of [receipt.editedFile,receipt.outputFile]){const inspected=await perception.inspect('audio',file.sha256);if(inspected.report.observations.some((o:any)=>o.severity==='major'))throw new Error('REPAIR_AUDIO_DEFECT');own.push(inspected);}
  const evidence=store.mediaSupplied(ctx,bytes,{runId:'active-codex-pause-repair',model:'active-operating-Codex',modality:'text',coverage:'complete repair contract, exact immutable parent and actual changed-audio findings'});store.inspectionCompleted(ctx,evidence,JSON.stringify({plan:edit,unchanged_beats:[1,3,4],actual_audio_inspections:own}));store.publish(ctx,{draft_path:'candidate.json',evidence_references:[evidence],validated_hash:validated});
  const previousReviewAllowance=store.allowance(rehearsalProject,'rehearsal-narration-review'),reviewerId='rehearsal-narration-pause-repair-review';
  startMemoirReview(store,id,reviewerId,previousReviewAllowance.remaining,undefined,{maxTurns:12,maxAttempts:3});const reviewCtx=store.claim(reviewerId,'independent-gemini-audio-reviewer',300000),packet=store.reviewPacket(reviewerId),references=Object.fromEntries(Object.entries(packet.exact_inputs as Record<string,string>).map(([name,v])=>[name,JSON.parse(readFileSync(store.acceptedVersion(rehearsalProject,v).path,'utf8'))]));
  const traces=await tracing();let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(reviewCtx,300000);}catch(e){leaseError=e;}},30000);
  try{result=await directAudioReview(store,reviewCtx,{key:await namedSecret('GEMINI_API_KEY'),references,traceClient:traces.client});}finally{clearInterval(timer);}
  if(leaseError)throw leaseError;await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
  result={...result,files:candidate.files,sourceFiles:candidate.sourceFiles,parent_version:parent.id,unchanged_beats:[1,3,4],...(result.report.verdict==='PASS'?{card:store.approvalCard(id)}:{})};
 }catch(error:any){failure=String(error);throw error;}
 finally{store.authenticatedProjectCommand(signLocalOperator(root,{id:tag+'-pause',principal,project_id:rehearsalProject,action:'pause' as const,value:1,reason:'End bounded pause repair; preserve exact versions and await director review'}));writeFileSync(join(dir,tag+'-proof.json'),JSON.stringify({status:failure?'BLOCKED':result.report.verdict,diagnostic:failure??null,result,allowance:store.allowance(rehearsalProject),paused:true,invoice_charges:null,preserved_source:preservedSource},null,2),{flag:'wx',mode:0o600});store.close();assertPreserved(preservedSource,manifest.saved_production_hashes);}
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename){if(process.argv.length!==4&&process.argv.length!==5)throw new Error('Use narration-pause-repair.ts ROOT KIT [SAVED_SOURCE]');console.log(JSON.stringify(await repairNarration(resolve(process.argv[2]),resolve(process.argv[3]),process.argv[4]?resolve(process.argv[4]):undefined),null,2));}
