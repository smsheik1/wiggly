import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {StudioProduction} from '../../lib/studio-production.js';
import {provisionLocalOperator,signLocalOperator} from '../../lib/studio-operator.js';
import {hash} from './harness.js';
import {loadMemoirFormat,createMemoirAssignment,runMemoirAuthor,startMemoirReview,candidateValidator} from './memoir-format.js';
import {rehearsalWorker} from './rehearsal-worker.js';
import {runGeminiMediaReviewer} from './gemini-reviewer-agent.js';
import {tracing,namedSecret} from './tracing.js';
import {assertPreserved,rehearsalProject} from './rehearsal.js';
import {z} from 'zod';

/** One bounded stage. Author owns roster content; SQL owns dispatch and publication. */
export async function runCharacterRoster(root:string,kit:string) {
 const dir=join(root,'character-style'),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8')),auth=JSON.parse(readFileSync(join(dir,'authorization.json'),'utf8'));
 if(auth.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||auth.allowance_micros!==2000000||!auth.confirmed_reference_crops||!auth.operator_message?.trim())throw new Error('EXACT_CHARACTER_BATCH_AUTHORIZATION_REQUIRED');
 const marker=join(dir,'roster-started.json');if(existsSync(marker))throw new Error('ROSTER_ALREADY_STARTED_RECONCILE_NO_AUTOMATIC_RETRY');
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
 const preserved=existsSync(manifest.source)?manifest.source:'/Users/shaz/Documents/wiggly-private-backups/agent-runs-backup/debug-round-1-20261004-script-led-v3';assertPreserved(preserved,manifest.saved_production_hashes);
 const group=JSON.parse(readFileSync(join(dir,'group-reference-selection.json'),'utf8'));
 if(hash(readFileSync(group.source))!==group.sha256||!group.age_direction_confirmed)throw new Error('CONFIRMED_REFERENCE_CHANGED');
 const format=await loadMemoirFormat(kit),store=new StudioProduction(root),principal=provisionLocalOperator(root);let failure:string|undefined,result:any;
 try {
  if(store.project(rehearsalProject).paused!==1)throw new Error('REHEARSAL_MUST_BE_PAUSED');
  writeFileSync(marker,JSON.stringify({auth,at:new Date().toISOString()}),{flag:'wx',mode:0o600});
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'character-style-allowance',principal,project_id:rehearsalProject,action:'extend_allowance',value:store.project(rehearsalProject).allowance+2000000,reason:auth.operator_message}));
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'character-roster-resume',principal,project_id:rehearsalProject,action:'resume',value:0,reason:auth.operator_message}));
  const inputs=Object.fromEntries(['answers','script','narration'].map(k=>[k,store.ticket('rehearsal-'+k).candidate_id]));
  const script=JSON.parse(readFileSync(store.acceptedVersion(rehearsalProject,inputs.script).path,'utf8'));
  createMemoirAssignment(format,store,{id:'rehearsal-roster',projectId:rehearsalProject,kind:'roster',role:'cast-designer',inputs,allowanceMicros:200000,limits:{maxTurns:12,maxAttempts:3},outcome:'Read /references/cast-contract.json for the exact contract and confirmed mapping. Bind the six approved screenplay cast entries to director-selected real-person photos and age direction. No new people, no invented source ages, no reference substitutions. Inspect actual photos, preserve shared teen design for 17 and 19. Sister is +7 years, brother approximately -2. Source photo is a teen family snapshot; sister likeness applies at age 15 and brother likeness at age 6 by explicit director direction. Author roster.json data only; generate no images yet.'});
  const ctx=store.claim('rehearsal-roster','deepagents-cast-designer',300000);
  const raw:any[]=quote.reference_selections.map((r:any)=>({id:r.look==='childhood'?'shaz-child':r.look==='late-teens'?'shaz-late-teen':r.look==='adult'?'shaz-adult':'mia-mother',file:r.file,direction:'Director-selected source reference, keep exact screenplay age variant.'}));
  const crops=join(dir,'reference-crops');mkdirSync(crops,{recursive:true});
  for(const entry of group.people.filter((p:any)=>['B','C'].includes(p.label))){
   const [x,y,w,h]=entry.proposed_crop;
   if(![x,y,w,h].every(Number.isInteger)||x<0||y<0||w<=0||h<=0||x+w>group.dimensions[0]||y+h>group.dimensions[1])throw new Error('INVALID_CONFIRMED_CROP');
   const path=join(crops,entry.character_id+'.png');
   // Exact source-pixel crops authorized by director; no generative edits or face enhancement.
   if(!existsSync(path))execFileSync('ffmpeg',['-v','error','-n','-i',group.source,'-vf',`crop=${w}:${h}:${x}:${y}`,'-frames:v','1',path]);
   const file=await format.media.importMedia(path,root);raw.push({id:entry.character_id,file,direction:entry.age_direction});
  }
  const confirmed=script.proposedCast.map((c:any)=>{const ref=raw.find(r=>r.id===c.id);if(!ref)throw new Error('MISSING_CAST_REFERENCE');const bytes=readFileSync(ref.file.path);if(hash(bytes)!==ref.file.sha256)throw new Error('CAST_REFERENCE_CHANGED');return {character_id:c.id,direction:ref.direction,file:{...ref.file,...store.pinMedia(ctx,bytes,extname(ref.file.path))}};});
  const expected={characters:script.proposedCast.map((c:any)=>({id:c.id,name:c.name,ageVariant:c.ageVariant,important:true,references:[confirmed.find((r:any)=>r.character_id===c.id).file],notes:'Author concrete source-grounded notes here; preserve director age direction.'}))};
  writeFileSync(join(dir,'confirmed-references.json'),JSON.stringify({authorization:auth,source_group_hash:group.sha256,crops:group.people.filter((p:any)=>['B','C'].includes(p.label)),references:confirmed},null,2),{flag:'wx',mode:0o600});
  const packet=JSON.parse(store.memoirAssignment(ctx.ticketId)!.packet);
  // Producer context is trusted and copied as outcome. Content and visual findings remain authored by the worker.
  const assignment=join(store.draftDirectory(ctx),'../references');mkdirSync(assignment,{recursive:true});
  writeFileSync(join(assignment,'cast-contract.json'),JSON.stringify({schema:z.toJSONSchema(format.contracts.Content.roster),exactIdentityAndReferenceTemplate:expected,direction:confirmed.map((r:any)=>({id:r.character_id,direction:r.direction})),instructions:'Read this exact schema/template. Replace only notes with your observations, never change references/IDs/names/ages. Use inspect_cast_references then record_reference_findings, write /drafts/candidate.json, inspect_candidate, finish_inspection, submit_candidate.'},null,2),{mode:0o400});
  const traces=await tracing(),worker=rehearsalWorker(store,ctx,{key:await namedSecret('OPENROUTER_API_KEY'),confirmedReferences:confirmed});
  let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(ctx,300000);}catch(e){leaseError=e;}},30000);
  try{await runMemoirAuthor(format,store,ctx,worker.model,worker.tools,{callbacks:[traces.tracer],metadata:{stage:'character-roster',reference_count:6}},worker.evidenceReferences);}finally{clearInterval(timer);}
  if(leaseError)throw leaseError;if(store.ticket(ctx.ticketId).status!=='SUBMITTED')throw new Error('CAST_AUTHOR_DID_NOT_SUBMIT');
  const content=JSON.parse(readFileSync(store.version(store.ticket(ctx.ticketId).candidate_id).path,'utf8'));
  for(const [i,c] of content.characters.entries()){const e=expected.characters[i];if(!e||c.id!==e.id||c.name!==e.name||c.ageVariant!==e.ageVariant||format.contracts.digest(c.references)!==format.contracts.digest(e.references))throw new Error('DIRECTOR_CAST_BINDING_CHANGED');}
  if(content.characters.length!==6)throw new Error('DIRECTOR_CAST_BINDING_CHANGED');
  startMemoirReview(store,ctx.ticketId,'rehearsal-roster-review',120000,undefined,{maxTurns:12,maxAttempts:3});
  const reviewer=store.claim('rehearsal-roster-review','independent-gemini-cast-reviewer',300000);
  result=await runGeminiMediaReviewer(store,reviewer,{key:await namedSecret('GEMINI_API_KEY'),references:{approvedScript:script,confirmedDirectorDirection:confirmed.map((r:any)=>({id:r.character_id,direction:r.direction})),outcome:packet.outcome},traceClient:traces.client});
  if(store.ticket(ctx.ticketId).status!=='AWAITING_APPROVAL')throw new Error('ROSTER_REVIEW_DID_NOT_PASS');
  const card=store.approvalCard(ctx.ticketId);await candidateValidator(format,store,ctx.ticketId)(readFileSync(store.version(card.candidate_version_id).path));
  store.directorDecision(signLocalOperator(root,{id:'confirmed-director-cast-bindings',principal,action:'decide',...card,decision:'APPROVE',feedback:'Director explicitly approved these existing references, sibling crop selections and age handling. Exact cast/reference binding verified; no additional design approval conferred.'}));store.setInput(rehearsalProject,'roster',card.candidate_version_id);
  await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
  console.log(JSON.stringify({stage:'ROSTER_APPROVED',author:ctx.workerId,reviewer:reviewer.workerId,version:card.candidate_version_id,allowance:store.allowance(rehearsalProject)}));
 }catch(error:any){let cause=error;while(cause?.cause)cause=cause.cause;failure=String(cause);throw new Error(failure);}
 finally{store.authenticatedProjectCommand(signLocalOperator(root,{id:'character-roster-pause',principal,project_id:rehearsalProject,action:'pause',value:1,reason:'End bounded cast reference stage; preserve progress'}));writeFileSync(join(dir,'roster-proof.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',diagnostic:failure??null,result,allowance:store.allowance(rehearsalProject),paused:true,invoice_charges:null},null,2),{flag:'wx',mode:0o600});store.close();assertPreserved(preserved,manifest.saved_production_hashes);}
}
if(process.argv[1]&&resolve(process.argv[1])===import.meta.filename)await runCharacterRoster(resolve(process.argv[2]),resolve(process.argv[3]));

/** Finish an already authored/inspected draft after a deterministic validator fix; no reauthoring or replayed media calls. */
export async function finishCharacterRoster(root:string,kit:string) {
 const {DatabaseSync}=await import('node:sqlite');const dir=join(root,'character-style'),auth=JSON.parse(readFileSync(join(dir,'authorization.json'),'utf8')),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8'));
 if(auth.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||auth.allowance_micros!==2000000)throw new Error('EXACT_CHARACTER_BATCH_AUTHORIZATION_REQUIRED');
 const marker=join(dir,'roster-validation-finish-started.json');if(existsSync(marker))throw new Error('ROSTER_FINISH_ALREADY_STARTED');
 const format=await loadMemoirFormat(kit),store=new StudioProduction(root),principal=provisionLocalOperator(root);let failure:string|undefined,result:any;
 try {
  const t=store.ticket('rehearsal-roster');if(t.status!=='WORKING')throw new Error('EXISTING_UNFINISHED_ROSTER_REQUIRED');
  let ctx={ticketId:t.id,workerId:t.worker_id,token:t.token,attemptId:t.attempt_id};
  const bytes=readFileSync(join(store.draftDirectory(ctx),'candidate.json')),sha256=hash(bytes),validated_hash=await candidateValidator(format,store,t.id)(bytes);
  const confirmed=JSON.parse(readFileSync(join(dir,'confirmed-references.json'),'utf8'));
  const script=JSON.parse(readFileSync(store.acceptedVersion(rehearsalProject,JSON.parse(t.inputs).script).path,'utf8')),content=JSON.parse(bytes.toString());
  if(content.characters.length!==script.proposedCast.length)throw new Error('DIRECTOR_CAST_BINDING_CHANGED');
  for(const [i,c] of content.characters.entries()){const expected=script.proposedCast[i],reference=confirmed.references.find((r:any)=>r.character_id===c.id);if(c.id!==expected.id||c.name!==expected.name||c.ageVariant!==expected.ageVariant||format.contracts.digest(c.references)!==format.contracts.digest([reference.file]))throw new Error('DIRECTOR_CAST_BINDING_CHANGED');}
  const db=new DatabaseSync(join(root,'studio.sqlite'),{readOnly:true});let evidence:string[];try{evidence=(db.prepare("SELECT id FROM inspections WHERE ticket_id=? AND attempt_id=? AND content_hash=? AND status='INSPECTION_COMPLETED'").all(t.id,t.attempt_id,sha256) as any[]).map(r=>r.id);}finally{db.close();}if(!evidence.length)throw new Error('EXISTING_COMPLETED_INSPECTION_REQUIRED');
  writeFileSync(marker,JSON.stringify({at:new Date().toISOString(),candidate_hash:sha256,author:t.worker_id,mechanical_fix_only:true}),{flag:'wx',mode:0o600});
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'character-roster-validation-resume',principal,project_id:rehearsalProject,action:'resume',value:0,reason:'Finish unchanged agent-authored, already inspected roster after deterministic inherited-input validator fix; no additional author calls'}));
  if(t.lease_until<=Date.now())ctx=store.claim(t.id,t.worker_id,300000);else store.heartbeat(ctx,300000);
  store.publish(ctx,{draft_path:'candidate.json',evidence_references:evidence,validated_hash});
  startMemoirReview(store,t.id,'rehearsal-roster-review',120000,undefined,{maxTurns:12,maxAttempts:3});const reviewer=store.claim('rehearsal-roster-review','independent-gemini-cast-reviewer',300000),traces=await tracing();
  result=await runGeminiMediaReviewer(store,reviewer,{key:await namedSecret('GEMINI_API_KEY'),references:{approvedScript:script,confirmedDirectorDirection:confirmed.references.map((r:any)=>({id:r.character_id,direction:r.direction})),outcome:JSON.parse(store.memoirAssignment(t.id)!.packet).outcome},traceClient:traces.client});
  if(store.ticket(t.id).status!=='AWAITING_APPROVAL')throw new Error('ROSTER_REVIEW_DID_NOT_PASS');
  const card=store.approvalCard(t.id);store.directorDecision(signLocalOperator(root,{id:'confirmed-director-cast-bindings',principal,action:'decide',...card,decision:'APPROVE',feedback:'Director-approved references, crops and age direction; exact binding and separate actual-image review verified. No design selection approval conferred.'}));store.setInput(rehearsalProject,'roster',card.candidate_version_id);
  await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');console.log(JSON.stringify({status:'ROSTER_APPROVED',author:ctx.workerId,reviewer:reviewer.workerId,version:card.candidate_version_id,allowance:store.allowance(rehearsalProject)}));
 }catch(e){failure=String(e);throw e;}
 finally{store.authenticatedProjectCommand(signLocalOperator(root,{id:'character-roster-validation-pause',principal,project_id:rehearsalProject,action:'pause',value:1,reason:'End exact-draft roster completion'}));writeFileSync(join(dir,'roster-validation-finish-proof.json'),JSON.stringify({status:failure?'BLOCKED':'PASS',diagnostic:failure??null,result,allowance:store.allowance(rehearsalProject),paused:true},null,2),{flag:'wx',mode:0o600});store.close();}
}

export async function runCharacterCandidates(root:string,kit:string, repairTicket?:string, resumeTicket?:string) {
 const {approvedProjection,acceptMemoirCandidate}=await import('./memoir-format.js'),{executeAuthorizedMedia}=await import('./media-transport.js'),{pathToFileURL}=await import('node:url');
 const dir=join(root,'character-style'),quote=JSON.parse(readFileSync(join(dir,'quote.json'),'utf8')),auth=JSON.parse(readFileSync(join(dir,'authorization.json'),'utf8')),budget=JSON.parse(readFileSync(join(dir,'batch-budget.json'),'utf8'));
 if(auth.quote_sha256!==hash(Buffer.from(JSON.stringify(quote)))||auth.allowance_micros!==budget.allowance_micros||auth.allowance_micros!==2000000)throw new Error('EXACT_CHARACTER_BATCH_AUTHORIZATION_REQUIRED');
 const format=await loadMemoirFormat(kit),providers=await import(pathToFileURL(join(kit,'runtime/providers.mjs')).href),store=new StudioProduction(root),principal=provisionLocalOperator(root),id='rehearsal-roster';let failure:string|undefined;const results:any[]=[];const claimed:any[]=[];
 const marker=join(dir,'candidates-started.json');if(existsSync(marker)&&!(resumeTicket&&['WORKING','APPROVED'].includes(store.ticket(resumeTicket).status))&&(!repairTicket||store.ticket(repairTicket).status!=='CHANGES_REQUESTED')){store.close();throw new Error('CANDIDATES_ALREADY_STARTED_NO_AUTOMATIC_RETRY');}
 const stageSuffix=resumeTicket?'-continuation-'+store.ticket(resumeTicket).revision:repairTicket?'-creative-repair-'+store.ticket(repairTicket).attempt_count:'';
 const resultsPath=join(dir,'candidate-results.json');if(existsSync(resultsPath))results.push(...JSON.parse(readFileSync(resultsPath,'utf8')));
 try {
  const rosterVersion=store.acceptedVersion(rehearsalProject,store.ticket(id).candidate_id),roster=JSON.parse(readFileSync(rosterVersion.path,'utf8'));
  const confirmed=JSON.parse(readFileSync(join(dir,'confirmed-references.json'),'utf8'));
  if(store.project(rehearsalProject).paused!==1)throw new Error('REHEARSAL_MUST_BE_PAUSED');writeFileSync(repairTicket||resumeTicket?join(dir,'candidates'+stageSuffix+'-started.json'):marker,JSON.stringify({auth,roster_version:rosterVersion.id,started_at:new Date().toISOString(),repair_ticket:repairTicket??null,resume_ticket:resumeTicket??null}),{flag:'wx',mode:0o600});
  store.authenticatedProjectCommand(signLocalOperator(root,{id:'character-candidates-resume'+stageSuffix,principal,project_id:rehearsalProject,action:'resume',value:0,reason:auth.operator_message}));
  const traces=await tracing(),key=await namedSecret('OPENROUTER_API_KEY'),geminiKey=await namedSecret('GEMINI_API_KEY');
  const remaining=()=>{const amount=budget.allowance_micros-(store.allowance(rehearsalProject).used-budget.baseline_used_micros);if(amount<=0)throw new Error('CHARACTER_BATCH_CAP_EXHAUSTED');return amount;};
  const baseInputs=Object.fromEntries(['answers','script','narration','roster'].map(k=>[k,store.ticket('rehearsal-'+k).candidate_id]));
  const approvedScript=JSON.parse(readFileSync(store.acceptedVersion(rehearsalProject,baseInputs.script).path,'utf8'));
  async function review(ticketId:string,photos:any[],references:any){const reviewId=ticketId+'-review-'+store.ticket(ticketId).attempt_count;startMemoirReview(store,ticketId,reviewId,Math.min(120000,remaining()),undefined,{maxTurns:12,maxAttempts:3});const ctx=store.claim(reviewId,'independent-gemini-character-reviewer',300000);const result=await runGeminiMediaReviewer(store,ctx,{key:geminiKey,references:{...references,approvedScript},inspectionFiles:photos.map(p=>p.file),traceClient:traces.client});if(store.ticket(ticketId).status!=='AWAITING_APPROVAL')throw new Error('CHARACTER_REVIEW_REQUIRES_REPAIR:'+ticketId);return result;}
  for(const character of roster.characters){
   const completed=results.find(r=>r.character_id===character.id);
   if(completed){verifyCompletedCharacter(store,completed);continue;}
   const photos=confirmed.references.filter((r:any)=>r.character_id===character.id),promptId='rehearsal-character-prompt-'+character.id;
   const selector={characterId:character.id},recipe=readFileSync(join(kit,'character-prompter.md'),'utf8');
   const template={prompt:'AUTHOR the concrete full-body production CG character design here, grounded in actual photos and director age direction.',characterDigest:format.contracts.digest(character),referenceHashes:character.references.map((f:any)=>f.sha256),recipeSha256:format.workflow.characterPromptRecipeSha256};
   let existingPrompt:any;try{existingPrompt=store.ticket(promptId);}catch(e){if(!String(e).includes('TICKET_NOT_FOUND'))throw e;}
   let previousPrompt:any;if(existingPrompt?.status==='CHANGES_REQUESTED'){if(repairTicket!==promptId)throw new Error('EXPLICIT_CREATIVE_REPAIR_SCOPE_REQUIRED');previousPrompt=JSON.parse(readFileSync(store.version(existingPrompt.candidate_id).path,'utf8'));store.queueRepair(promptId);}
   if(!existingPrompt)createMemoirAssignment(format,store,{id:promptId,projectId:rehearsalProject,kind:'characterPrompt',role:'cast-designer',inputs:baseInputs,selectors:selector,allowanceMicros:Math.min(120000,remaining()),limits:{maxTurns:12,maxAttempts:3},outcome:`Read /references/character-contract.json. Author the initial character prompt for ${character.id}, not a turnaround. Follow the packaged recipe, inspect actual confirmed photos, preserve the director age direction and copy binding fields exactly. Then write /drafts/candidate.json, inspect_candidate, finish_inspection and submit_candidate.`});
   // Prepare the reference alongside the native assignment workspace before the author runs.
   if(existingPrompt?.status!=='APPROVED'){
   const ctx=store.claim(promptId,'deepagents-cast-designer',300000);claimed.push(ctx);const referenceDir=join(store.draftDirectory(ctx),'../references');mkdirSync(referenceDir,{recursive:true});writeCharacterReference(join(referenceDir,'character-contract.json'),JSON.stringify({schema:z.toJSONSchema(format.contracts.Content.characterPrompt),template,castEntry:character,direction:photos.map((p:any)=>p.direction),approvedScript,recipe,...(previousPrompt?{previousRejectedPrompt:previousPrompt,requestedRepair:existingPrompt.feedback,repairDirection:'Address the actual reviewer findings using inspected photos and the approved screenplay. Distinguish explicitly approved story props from traits observed in a source photo. Preserve unaffected bindings and direction; do not invent unrelated fixes.'}:{})},null,2));
   const worker=rehearsalWorker(store,ctx,{key,confirmedReferences:photos});let leaseError:unknown;const timer=setInterval(()=>{try{store.heartbeat(ctx,300000);}catch(e){leaseError=e;}},30000);try{await runMemoirAuthor(format,store,ctx,worker.model,worker.tools,{callbacks:[traces.tracer],metadata:{stage:'character-design-prompt',character_id:character.id}},worker.evidenceReferences);}finally{clearInterval(timer);}if(leaseError)throw leaseError;if(store.ticket(promptId).status!=='SUBMITTED')throw new Error('CHARACTER_PROMPT_NOT_SUBMITTED');
   await review(promptId,photos,{castEntry:character,directorDirection:photos.map((p:any)=>p.direction),recipe});await acceptMemoirCandidate(format,store,promptId);}
   const promptVersion=store.ticket(promptId).candidate_id;store.setInput(rehearsalProject,'characterPrompt__'+character.id,promptVersion);
   const prompt=JSON.parse(readFileSync(store.acceptedVersion(rehearsalProject,promptVersion).path,'utf8')),candidateId='rehearsal-character-candidates-'+character.id,inputs={...baseInputs,['characterPrompt__'+character.id]:promptVersion};
   createMemoirAssignment(format,store,{id:candidateId,projectId:rehearsalProject,kind:'candidates',role:'cast-designer',inputs,selectors:selector,allowanceMicros:Math.min(180000,remaining()),limits:{maxTurns:12,maxAttempts:3},outcome:'Inspect the three already generated candidate images and the exact confirmed source reference. Do not generate replacements or rewrite the reviewed prompt. Call inspect_cast_references for supplied source and candidates, record observations by exact hash, inspect /drafts/candidate.json, finish_inspection then submit_candidate. Flag observed defects honestly; independent reviewer decides acceptance.'});
   const generation=store.claim(candidateId,'deepagents-cast-designer',300000),projection=approvedProjection(format,store,rehearsalProject,inputs,'candidates',selector),plan={provider:'meta-muse',operation:'candidates',estimatedCostUsd:.03,parameters:{prompt:prompt.prompt}};
   if(remaining()<30000)throw new Error('CHARACTER_BATCH_CAP_EXHAUSTED');const candidate=await executeAuthorizedMedia(format,store,generation,{operationId:'character-candidates-'+character.id+'-attempt-1',provider:'meta-muse',estimateMicros:30000,plan,request:providers.requestDescriptor(projection,plan)});
   if(candidate.pending)throw new Error('KNOWN_CHARACTER_JOB_PENDING_COLLECT_SAME_OPERATION');writeFileSync(join(store.draftDirectory(generation),'candidate.json'),JSON.stringify(candidate),{flag:'wx',mode:0o600});
   const inspectionPhotos=[...photos,...candidate.files.map((file:any,i:number)=>({character_id:character.id+'-candidate-'+(i+1),direction:'Generated candidate '+(i+1)+'. Inspect against the supplied source and approved age/style direction; do not mistake it for a source photo.',file}))],candidateWorker=rehearsalWorker(store,generation,{key,confirmedReferences:inspectionPhotos});
   let candidateLeaseError:unknown;const heartbeat=setInterval(()=>{try{store.heartbeat(generation,300000);}catch(e){candidateLeaseError=e;}},30000);try{await runMemoirAuthor(format,store,generation,candidateWorker.model,candidateWorker.tools,{callbacks:[traces.tracer],metadata:{stage:'character-candidate-inspection',character_id:character.id}},candidateWorker.evidenceReferences);}finally{clearInterval(heartbeat);}if(candidateLeaseError)throw candidateLeaseError;
   const verdict=await review(candidateId,photos,{castEntry:character,approvedPrompt:prompt,directorDirection:photos.map((p:any)=>p.direction)});const card=store.approvalCard(candidateId);results.push({character_id:character.id,files:candidate.files,card,review:verdict.report});writeFileSync(join(dir,'candidate-results.json'),JSON.stringify(results,null,2),{mode:0o600});console.log(JSON.stringify({character_id:character.id,status:'REVIEWED_CANDIDATES_READY_FOR_DIRECTOR',files:candidate.files,batch_used_micros:budget.allowance_micros-remaining()}));
  }
  await traces.client.awaitPendingTraceBatches();if(traces.failures.length)throw new Error('LANGSMITH_TRACE_UPLOAD_FAILED');
 }catch(e:any){let cause=e;while(cause?.cause)cause=cause.cause;failure=String(cause);throw new Error(failure);}
 finally{for(const ctx of claimed){const ticket=store.ticket(ctx.ticketId);if(ticket.status==='WORKING'&&ticket.token===ctx.token)store.releaseLease(ctx);}store.authenticatedProjectCommand(signLocalOperator(root,{id:'character-candidates-pause'+stageSuffix,principal,project_id:rehearsalProject,action:'pause',value:1,reason:'End bounded candidate batch; sheets require director selections'}));writeFileSync(join(dir,'candidate-batch'+stageSuffix+'-proof.json'),JSON.stringify({status:failure?'BLOCKED':'AWAITING_DIRECTOR_SELECTIONS',diagnostic:failure??null,results,batch_used_or_reserved_micros:store.allowance(rehearsalProject).used-budget.baseline_used_micros,allowance_cap_micros:budget.allowance_micros,paused:true},null,2),{flag:'wx',mode:0o600});store.close();}
}

/** Continuation reuses exact reviewed outputs; changed state or bytes never trigger regeneration. */
export function verifyCompletedCharacter(store:StudioProduction,completed:any) {
 const ticket=store.ticket(completed.card.ticket_id);
 if(!['AWAITING_APPROVAL','APPROVED'].includes(ticket.status)||ticket.candidate_id!==completed.card.candidate_version_id)throw new Error('COMPLETED_CHARACTER_STATE_CHANGED');
 const version=store.version(ticket.candidate_id);
 if(version.content_hash!==completed.card.content_hash||hash(readFileSync(version.path))!==version.content_hash||completed.files.some((f:any)=>hash(readFileSync(f.path))!==f.sha256))throw new Error('COMPLETED_CHARACTER_BYTES_CHANGED');
}

export function writeCharacterReference(path:string,content:string) {
 if(existsSync(path)){if(readFileSync(path,'utf8')!==content)throw new Error('CHARACTER_REFERENCE_CHANGED_DURING_RECOVERY');return;}
 writeFileSync(path,content,{flag:'wx',mode:0o400});
}
