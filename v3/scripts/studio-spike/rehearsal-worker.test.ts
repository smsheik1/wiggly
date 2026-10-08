import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { StudioProduction } from '../../lib/studio-production.js';
import { rehearsalWorker } from './rehearsal-worker.js';
import { workspaceAgent } from './harness.js';
import { productionMiddleware, publicationTool } from './production-tools.js';
function fixture(allowance=100000, inputs:Record<string,string>={}) {
  const root = mkdtempSync(join(tmpdir(), 'wiggly-explicit-rehearsal-worker-mock-')), store = new StudioProduction(root);
  store.createProject('mock', allowance); store.operator('mock','resume',0,{id:'resume',actor:'isolated-test',reason:'No real provider or creative acceptance'});
  for(const [name,version] of Object.entries(inputs))store.setInput('mock',name,version);
  store.createTicket('author','mock','test-author',inputs,100000,'AUTHOR',{maxTurns:12});
  const ctx = store.claim('author','mock-author',300000);
  return { store,ctx,close(){store.close();rmSync(root,{recursive:true,force:true});} };
}
function reply(name: string, args: any, cost = .0001) {
  return new Response(JSON.stringify({ id:'mock-response-'+name, model:'deepseek/deepseek-v4.1-flash', usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200,cost}, choices:[{index:0,finish_reason:'tool_calls',message:{role:'assistant',content:null,tool_calls:[{id:'call-'+name,type:'function',function:{name,arguments:JSON.stringify(args)}}]}}] }),{headers:{'Content-Type':'application/json'}});
}
test('native bounded agent publishes only runtime-bound completed inspection; every model call settles reported usage', async () => {
  const f=fixture(); let calls=0;
  try {
    writeFileSync(join(f.store.draftDirectory(f.ctx),'candidate.json'),JSON.stringify({story:'Explicit isolated mock contract'}));
    const worker=rehearsalWorker(f.store,f.ctx,{key:'EXPLICIT_MOCK_KEY',fetcher:async (_url, init)=>{
      const body=JSON.parse(String(init?.body)); assert.equal(body.reasoning.effort,"low"); assert.equal(body.provider.allow_fallbacks,true); assert.equal(body.provider.only,undefined); assert.deepEqual(body.provider.max_price,{prompt:.3,completion:1.2}); assert.equal(body.provider.require_parameters,true); assert.equal(body.model,'deepseek/deepseek-v4.1-flash');
      calls++; return calls===1?reply('inspect_candidate',{draft_path:'/drafts/candidate.json'}):calls===2?reply('finish_inspection',{findings:'Explicit mock contract was read completely for receipt mechanics.'}):reply('submit_candidate',{draft_path:'/drafts/candidate.json',evidence_references:['invented-by-model']});
    }});
    const agent=workspaceAgent(worker.model,dirname(f.store.draftDirectory(f.ctx)),'explicit-mock','mock-author',[...worker.tools,publicationTool(f.store,f.ctx,undefined,worker.evidenceReferences)],'Explicit isolated protocol test',[productionMiddleware(f.store,f.ctx)]);
    try { await agent.invoke({messages:[{role:'user',content:'Run the explicit mock.'}]}); } catch(error: any) { let cause=error; while(cause.cause) cause=cause.cause; throw cause; }
    assert.equal(calls,3); assert.equal(f.store.ticket('author').status,'SUBMITTED'); assert.equal(f.store.allowance('mock').used,300); assert.equal(worker.receipts.length,3);
  } finally {f.close();}
});
test('missing actual-media perception prevents an author from publishing metadata as inspection',async()=>{
  const f=fixture(); try {
    writeFileSync(join(f.store.draftDirectory(f.ctx),'candidate.json'),JSON.stringify({files:[{path:'/not-inspected.wav',sha256:'a'.repeat(64),bytes:123}]}));
    const worker=rehearsalWorker(f.store,f.ctx,{key:'EXPLICIT_MOCK_KEY'});
    await assert.rejects((worker.tools[0] as any).invoke({draft_path:'/drafts/candidate.json'}),/ACTUAL_MEDIA_INSPECTION_REQUIRED/);
    assert.deepEqual(worker.evidenceReferences(),[]);
  } finally {f.close();}
});
test('missing or foreign media findings fail exact candidate coverage',async()=>{
  const f=fixture(); try {
    writeFileSync(join(f.store.draftDirectory(f.ctx),'candidate.json'),JSON.stringify({files:[{path:'/not-inspected.wav',sha256:'a'.repeat(64),bytes:123}]}));
    const worker=rehearsalWorker(f.store,f.ctx,{key:'EXPLICIT_MOCK_KEY',inspectMedia:async()=>[{file_sha256:'b'.repeat(64),report:{perceptible:true,fullMediaInspected:true},evidence_references:['explicit-mock']}]});
    await assert.rejects((worker.tools[0] as any).invoke({draft_path:'/drafts/candidate.json'}),/COVERAGE_MISMATCH/);
  } finally {f.close();}
});
test('exhausted OpenRouter routing stops the ticket without blind transport retries',async()=>{
  const f=fixture();let calls=0;try{
    const worker=rehearsalWorker(f.store,f.ctx,{key:'EXPLICIT_MOCK_KEY',fetcher:async()=>{calls++;return new Response('explicit mock rate limit',{status:429});}});
    await assert.rejects(worker.model.bindTools(worker.tools).invoke('Explicit mock'),(error: any)=>String(error.cause).includes('429'));assert.equal(calls,1);assert.equal(f.store.ticket('author').status,'BLOCKED');
  }finally{f.close();}
});

test('SQL validation uses the official complete studio snapshot and accepted existing-voice language', async()=>{
  const {loadMemoirFormat,existingVoiceChoice,approvedProjection}=await import('./memoir-format.js');
  const {pathToFileURL}=await import('node:url'); const {resolve}=await import('node:path');
  const kit=resolve('../../public/format-repositories/my-pixar-story-v1'),format=await loadMemoirFormat(kit);
  const instructions=await import(pathToFileURL(join(kit,'runtime/instructions.mjs')).href);
  const providers=await import(pathToFileURL(join(kit,'runtime/providers.mjs')).href);
  const helpers=await import(pathToFileURL(join(kit,'tests/studio-helpers.mjs')).href),p=helpers.renderReady();
  const origin={kind:'existing',lookup:{voiceId:'11111111-1111-4111-8111-111111111111',language:'en',checkedAt:'2026-10-07T00:00:00.000Z'},selectionMessage:'Explicit mock selection',consentMessage:'Explicit mock consent'};
  p.artifacts=p.artifacts.filter((a:any)=>a.kind!=='voiceSample');p.artifacts.findLast((a:any)=>a.kind==='clone').content={voiceId:origin.lookup.voiceId,origin};p.voiceChoice=existingVoiceChoice(origin);p.studio=format.snapshot;
  const estimate=providers.generationEstimate(p,'audition');
  const request=providers.requestDescriptor(p,{provider:'cartesia',operation:'audition',estimatedCostUsd:estimate.estimatedCostUsd,parameters:{}});
  assert.equal(request.language,'en');assert.equal(request.voice,origin.lookup.voiceId);assert.ok(instructions.StudioSnapshot.safeParse(format.snapshot).success);
  assert.throws(()=>existingVoiceChoice({...origin,selectionMessage:''}),/PROVENANCE_REQUIRED/);
  // Empty accepted-input projection must retain the validated instruction bundle, not config alone.
  const mockStore={assertCurrentInputs(){},memoirPolicy(){return{source_inputs:p.inputs};}} as any;
  const projection=approvedProjection(format,mockStore,'isolated',{},'answers');
  assert.ok(instructions.StudioSnapshot.safeParse(projection.studio).success);
});

test('independent reviewer receives the signed original questionnaire, not only its candidate',async()=>{
  const f=fixture();try{
    const {resolve}=await import('node:path');const {readFileSync}=await import('node:fs');
    const {loadMemoirFormat,runMemoirReviewer}=await import('./memoir-format.js');const {ScriptedModel,call}=await import('./offline-model.js');
    const {provisionLocalOperator,signLocalOperator}=await import('../../lib/studio-operator.js');const {hash}=await import('./harness.js');
    const kit=resolve('../../public/format-repositories/my-pixar-story-v1'),format=await loadMemoirFormat(kit),source=JSON.parse(readFileSync(join(kit,'examples/parent.json'),'utf8'));
    const principal=provisionLocalOperator(f.store.root);f.store.activateMemoirPolicy(signLocalOperator(f.store.root,{id:'mock-policy',principal,project_id:'mock',action:'activate_memoir_policy',source_inputs:source}));
    const bytes=Buffer.from(JSON.stringify({explicitMockCandidate:true}));writeFileSync(join(f.store.draftDirectory(f.ctx),'candidate.json'),bytes);
    const evidence=f.store.mediaSupplied(f.ctx,bytes,{runId:'mock',model:'mock',modality:'text',coverage:'mock'});f.store.inspectionCompleted(f.ctx,evidence,'Explicit isolated candidate inspection for source-packet regression.');f.store.publish(f.ctx,{draft_path:'candidate.json',evidence_references:[evidence]});
    f.store.startReview('author','review','mock-reviewer',{criteria:['source-grounding'],modality:'text',coverage:'complete candidate and every referenced media item'});
    const ctx=f.store.claim('review','mock-independent',300000),model=new ScriptedModel([messages=>{
      const briefing=JSON.stringify(messages.map(m=>m.content));
      assert.ok(briefing.includes('/references/source-inputs.json'));
      assert.ok(briefing.includes('complete supplied reference inventory'));
      assert.ok(!briefing.includes('preferred-script.json'));
      assert.deepEqual(JSON.parse(readFileSync(join(dirname(f.store.draftDirectory(ctx)),'references/source-inputs.json'),'utf8')),source);
      return call('submit_review',{verdict:'INCONCLUSIVE',findings:'Explicit isolated regression ends without production acceptance.',defects:[]});
    }]);await runMemoirReviewer(format,f.store,ctx,model,[]);assert.equal(model.calls.length,1);
  }finally{f.close();}
});

test('live story and recovery commands reject unbound authorization before credentials, leases or paid calls',async()=>{
 const {mkdirSync}=await import('node:fs'),{runStory}=await import('./rehearsal-story.js'),{recoverStory}=await import('./rehearsal-story-recovery.js'),{recoverAudition}=await import('./rehearsal-audition-recovery.js'),{runNarration}=await import('./rehearsal-narration-live.js');
 const root=mkdtempSync(join(tmpdir(),'wiggly-explicit-authorization-mock-'));try{
  const dir=join(root,'story-narration');mkdirSync(dir);writeFileSync(join(dir,'quote.json'),JSON.stringify({allowance_micros:2000000}));const auth=join(root,'not-authorized.json');writeFileSync(auth,JSON.stringify({quote_sha256:'wrong',allowance_micros:2000000,operator_message:'EXPLICIT MOCK INVALID'}));
  await assert.rejects(runStory(root,'never-load-this-kit',auth),/EXACT_BATCH_AUTHORIZATION_REQUIRED/);
  await assert.rejects(recoverStory(root,'never-load-this-kit',auth),/EXACT_REVIEW_RECOVERY_AUTHORIZATION_REQUIRED/);
  await assert.rejects(recoverAudition(root,'never-load-this-kit',auth),/EXACT_REVIEW_RECOVERY_AUTHORIZATION_REQUIRED/);
  await assert.rejects(runNarration(root,'never-load-this-kit',auth),/EXACT_AUDITION_APPROVAL_REQUIRED/);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('authenticated settled-failure recovery retains attempt and turn limits and rejects uncertain billing',async()=>{
 const f=fixture();try{
  const {provisionLocalOperator,signLocalOperator}=await import('../../lib/studio-operator.js');
  const principal=provisionLocalOperator(f.store.root);
  f.store.beginTurn(f.ctx,'initial-turn');
  f.store.prepareOperation(f.ctx,{operationId:'failed',provider:'mock',requestHash:'a'.repeat(64),estimateMicros:100});f.store.startOperation(f.ctx,'failed');f.store.failOperation('failed','EXPLICIT MOCK timeout');
  const payload=()=>({id:'recover',principal,project_id:'mock',action:'recover_settled_failure' as const,ticket_id:'author',operation_id:'failed',expected_revision:f.store.ticket('author').revision,request_id:'mock-terminal-request',evidence_reference:'mock-terminal-receipt',reason:'Explicit isolated mock recovery authority'});
  assert.throws(()=>f.store.recoverSettledFailure(signLocalOperator(f.store.root,payload())),/SETTLED_FAILURE_REQUIRED/);
  f.store.settleFailedOperation('failed',25);const command=signLocalOperator(f.store.root,payload());
  const result=f.store.recoverSettledFailure(command);assert.deepEqual(f.store.recoverSettledFailure(command),result);
  const ctx=f.store.claim('author',f.ctx.workerId,300000);assert.equal(ctx.attemptId,f.ctx.attemptId);assert.ok(ctx.token>f.ctx.token);assert.equal(f.store.ticket('author').max_turns,12);
  f.store.beginTurn(ctx,'continued-turn');assert.equal(f.store.ticket('author').attempt_count,1);
  assert.throws(()=>f.store.heartbeat(f.ctx,300000),/STALE/);
 }finally{f.close();}
});


test('direct Gemini binds audio bytes and approved script to its verdict; missing coverage cannot pass',async()=>{
 const {directAudioReview}=await import('./gemini-audio-review.js'),{hash}=await import('./harness.js');
 for(const incomplete of [false,true]){
  const f=fixture(1000000);try{
   const audio=Buffer.from('EXPLICIT ISOLATED MOCK AUDIO'),file={...f.store.pinMedia(f.ctx,audio,'.wav'),durationSeconds:15};
   const candidate=Buffer.from(JSON.stringify({files:[file],transcripts:['EXPLICIT APPROVED MOCK WORDS']}));writeFileSync(join(f.store.draftDirectory(f.ctx),'candidate.json'),candidate);
   const e=f.store.mediaSupplied(f.ctx,candidate,{runId:'mock',model:'mock',modality:'text',coverage:'mock'});f.store.inspectionCompleted(f.ctx,e,'Explicit mock author candidate inspection before independent review.');f.store.publish(f.ctx,{draft_path:'candidate.json',evidence_references:[e]});
   f.store.startReview('author','review','audio-reviewer',{criteria:['transcript','duration'],modality:'audio',coverage:'complete candidate and every referenced media item'},500000,{maxTurns:12});const ctx=f.store.claim('review','independent-gemini',300000);let calls=0;
   const run=()=>directAudioReview(f.store,ctx,{key:'EXPLICIT_MOCK_KEY',references:{script:'EXPLICIT APPROVED MOCK WORDS'},fetcher:async(url,init)=>{
    calls++;assert.equal(String(url),'https://generativelanguage.googleapis.com/v1beta/interactions');const body=JSON.parse(String(init?.body));assert.ok(body.input[0].text.includes('EXPLICIT APPROVED MOCK WORDS'));assert.ok(body.input[0].text.includes('200 ms'));assert.equal(Buffer.from(body.input.find((p:any)=>p.type==='audio').data,'base64').toString(),audio.toString());
    const report={verdict:'PASS',findings:'Explicit isolated mock review finds approved words and timing compliant.',direction_compatible:true,defects:[],coverage:[{sha256:hash(audio),perceptible:true,complete:!incomplete,findings:'Explicit isolated complete audio inspection for regression testing.',heard_words:'EXPLICIT APPROVED MOCK WORDS'}]};
    return new Response(JSON.stringify({model:'gemini-3.8-flash',status:'completed',usage:{total_input_tokens:100,total_output_tokens:100},steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(report)}]}]}),{headers:{'Content-Type':'application/json'}});
   }});
   if(incomplete){await assert.rejects(run(),/COVERAGE_INCONCLUSIVE/);assert.notEqual(f.store.ticket('author').status,'AWAITING_APPROVAL');}else{const result=await run();assert.equal(result.report.verdict,'PASS');assert.equal(f.store.ticket('author').status,'AWAITING_APPROVAL');assert.notEqual(f.store.ticket('author').status,'APPROVED');}
   assert.equal(calls,1);
  }finally{f.close();}
 }
});

test('pause repair can reference only an immutable rejected version from its own author ticket',async()=>{
 const f=fixture();try{
  const bytes=Buffer.from(JSON.stringify({explicitMock:'repair source'}));writeFileSync(join(f.store.draftDirectory(f.ctx),'candidate.json'),bytes);
  const e=f.store.mediaSupplied(f.ctx,bytes,{runId:'mock',model:'mock',modality:'text',coverage:'complete'});f.store.inspectionCompleted(f.ctx,e,'Explicit isolated source contract inspection for repair provenance.');const version=f.store.publish(f.ctx,{draft_path:'candidate.json',evidence_references:[e]});
  assert.throws(()=>f.store.rejectedVersion(version.id,'author'),/REJECTED_REPAIR_SOURCE_REQUIRED/);
  f.store.startReview('author','review','mock-reviewer',{criteria:['duration'],modality:'text',coverage:'complete'});const ctx=f.store.claim('review','independent',300000);
  const inspected=f.store.mediaSupplied(ctx,bytes,{runId:'review',model:'mock',modality:'text',coverage:'complete'});f.store.inspectionCompleted(ctx,inspected,'Explicit mock measured duration defect in the original candidate.');f.store.submitReview(ctx,{verdict:'CHANGES_REQUESTED',findings:'Explicit mock requires a localized timing correction before approval.',defects:[{criterion:'duration',region:'beat 2',evidence:'EXPLICIT MOCK measured duration exceeds target'}],evidence_references:[inspected],direction_compatible:false});
  const rejected=f.store.rejectedVersion(version.id,'author');assert.equal(rejected.content_hash,version.content_hash);assert.equal(JSON.parse(rejected.rejection!.defects)[0].criterion,'duration');assert.throws(()=>f.store.rejectedVersion(version.id,'foreign-author'),/REJECTED_REPAIR_SOURCE_REQUIRED/);
 }finally{f.close();}
});


test('agent receives actual photo and terminates with labelled clarification, without publication',async()=>{
 const f=fixture();try{
  const {hash}=await import('./harness.js'),{readFileSync}=await import('node:fs');
  const bytes=Buffer.from('EXPLICIT MOCK PHOTO'),path=join(f.store.draftDirectory(f.ctx),'photo.jpg');writeFileSync(path,bytes);let calls=0;
  const worker=rehearsalWorker(f.store,f.ctx,{key:'EXPLICIT_MOCK_KEY',referencePhotos:[{id:'upload',path,sha256:hash(bytes),width:400,height:300,mime:'image/jpeg'}],fetcher:async(_url,init)=>{
   const body=JSON.parse(String(init?.body));calls++;
   if(calls===1)return reply('inspect_reference_photo',{photo_id:'upload'});
   assert.ok(body.messages.some((m:any)=>Array.isArray(m.content)&&m.content.some((c:any)=>c.type==='image_url'&&c.image_url.url.endsWith(bytes.toString('base64')))));
   return reply('ask_reference_identities',{photo_id:'upload',people:[{label:'A',description:'Left person',region:{x:10,y:20,width:100,height:200}},{label:'B',description:'Right person',region:{x:200,y:20,width:100,height:200}}]});
  }});
  const agent=workspaceAgent(worker.model,dirname(f.store.draftDirectory(f.ctx)),'mock-photo-intake','mock-photo-intake',worker.tools,'Explicit isolated intake test',[productionMiddleware(f.store,f.ctx)]);
  const result=await agent.invoke({messages:[{role:'user',content:'Inspect uploaded reference.'}]});
  assert.equal(calls,2);assert.equal(f.store.ticket('author').status,'BLOCKED');assert.equal(f.store.ticket('author').blocked_reason,'DIRECTOR_CLARIFICATION');const final=JSON.parse(String(result.messages.at(-1)!.content));assert.equal(final.generation_allowed,false);assert.match(final.question,/A, B/);
  const svg=readFileSync(final.preview_path,'utf8');assert.ok(svg.includes(bytes.toString('base64')));assert.ok(svg.includes('>A</text>'));assert.ok(svg.includes('>B</text>'));
  await assert.rejects((worker.tools.find(t=>t.name==='inspect_candidate')! as any).invoke({draft_path:'/drafts/candidate.json'}),/REFERENCE_IDENTIFICATION_REQUIRED/);
 }finally{f.close();}
});

test('reference tools reject unseen, foreign, changed or out-of-bounds photos',async()=>{
 const f=fixture();try{
  const {referenceIntakeTools}=await import('./reference-intake.js'),{hash}=await import('./harness.js');const bytes=Buffer.from('MOCK'),path=join(f.store.draftDirectory(f.ctx),'photo.jpg');writeFileSync(path,bytes);
  const [inspect,clarify]=referenceIntakeTools([{id:'upload',path,sha256:hash(bytes),width:100,height:100,mime:'image/jpeg'}],f.store.draftDirectory(f.ctx));
  const input={photo_id:'upload',people:[{label:'A',description:'Person',region:{x:90,y:0,width:20,height:50}}]};
  await assert.rejects(clarify.invoke(input),/INSPECTION_REQUIRED/);await inspect.invoke({photo_id:'upload'});await assert.rejects(clarify.invoke(input),/OUTSIDE_PHOTO/);await assert.rejects(inspect.invoke({photo_id:'foreign'}),/NOT_IN_ASSIGNMENT/);writeFileSync(path,'CHANGED');await assert.rejects(inspect.invoke({photo_id:'upload'}),/PHOTO_CHANGED/);
 }finally{f.close();}
});

test('confirmed cast author receives actual bytes and records successful model findings before publication',async()=>{
 const f=fixture();try{
  const {hash}=await import('./harness.js');const bytes=Buffer.alloc(300000,65),file={...f.store.pinMedia(f.ctx,bytes,'.jpg'),width:100,height:100};
  writeFileSync(join(f.store.draftDirectory(f.ctx),'candidate.json'),JSON.stringify({characters:[{references:[file]}]}));let calls=0;
  const worker=rehearsalWorker(f.store,f.ctx,{key:'EXPLICIT_MOCK_KEY',confirmedReferences:[{character_id:'mock-person',direction:'Explicit director mapping, not inferred',file}],fetcher:async(_url,init)=>{
   calls++;const body=JSON.parse(String(init?.body));
   if(calls===1)return reply('inspect_cast_references',{});
   assert.ok(body.messages.some((m:any)=>Array.isArray(m.content)&&m.content.some((c:any)=>c.type==='image_url'&&c.image_url.url.endsWith(bytes.toString('base64')))));
   return calls===2?reply('record_reference_findings',{observations:[{sha256:hash(bytes),findings:'Explicit isolated mock observed photo finding for transport regression.'}]}):calls===3?reply('inspect_candidate',{draft_path:'/drafts/candidate.json'}):calls===4?reply('finish_inspection',{findings:'Explicit isolated mock contract binds the confirmed observed reference.'}):reply('submit_candidate',{draft_path:'/drafts/candidate.json'});
  }});
  const agent=workspaceAgent(worker.model,dirname(f.store.draftDirectory(f.ctx)),'mock-confirmed-cast','mock-confirmed-cast',[...worker.tools,publicationTool(f.store,f.ctx,undefined,worker.evidenceReferences)],'Explicit isolated cast author test',[productionMiddleware(f.store,f.ctx)]);
  try{await agent.invoke({messages:[{role:'user',content:'Inspect the confirmed reference.'}]});}catch(error:any){let cause=error;while(cause?.cause)cause=cause.cause;throw cause;}assert.equal(calls,5);assert.equal(f.store.ticket('author').status,'SUBMITTED');
 }finally{f.close();}
});

test('direct visual reviewer sees candidate and reference bytes and independently issues verdict',async()=>{
 const f=fixture(1000000,{script:'explicit-mock-approved-script'});try{
  const scriptPath=join(f.store.draftDirectory(f.ctx),'approved-script.json');writeFileSync(scriptPath,JSON.stringify({storyProp:'EXPLICIT APPROVED MOCK STORY PROP'}));f.store.acceptedVersion=(()=>({path:scriptPath})) as any;
  const {directMediaReview}=await import('./gemini-audio-review.js'),{hash}=await import('./harness.js');const bytes=Buffer.from('EXPLICIT MOCK IMAGE'),file={...f.store.pinMedia(f.ctx,bytes,'.png'),width:100,height:100};const candidate=Buffer.from(JSON.stringify({files:[file]}));writeFileSync(join(f.store.draftDirectory(f.ctx),'candidate.json'),candidate);
  const e=f.store.mediaSupplied(f.ctx,candidate,{runId:'mock',model:'mock',modality:'text',coverage:'all'});f.store.inspectionCompleted(f.ctx,e,'Explicit isolated candidate inspection before direct visual review.');f.store.publish(f.ctx,{draft_path:'candidate.json',evidence_references:[e]});f.store.startReview('author','review','visual-reviewer',{criteria:['likeness'],modality:'image',coverage:'all'},500000);const ctx=f.store.claim('review','independent',300000);
  const result=await directMediaReview(f.store,ctx,{key:'EXPLICIT_MOCK_KEY',references:{direction:'Exact director-selected identity'},fetcher:async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.input.find((p:any)=>p.type==='image').data,bytes.toString('base64'));assert.ok(body.input[0].text.includes('EXPLICIT APPROVED MOCK STORY PROP'));return new Response(JSON.stringify({model:'gemini-3.8-flash',status:'completed',usage:{total_input_tokens:100,total_output_tokens:100},steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({verdict:'PASS',findings:'Explicit isolated visual review inspected the correct exact image.',direction_compatible:true,defects:[],coverage:[{sha256:hash(bytes),perceptible:true,complete:true,findings:'Explicit mock image inspection verifies transport and bindings.'}]})}]}]}),{headers:{'Content-Type':'application/json'}});}});
  assert.equal(result.report.verdict,'PASS');assert.equal(f.store.ticket('author').status,'AWAITING_APPROVAL');
 }finally{f.close();}
});


test('SQL validation view carries exact transitive voice/audition inputs into downstream cast checks',async()=>{
 const {approvedProjection,loadMemoirFormat}=await import('./memoir-format.js'),{resolve}=await import('node:path'),{readFileSync,mkdirSync,realpathSync}=await import('node:fs'),{pathToFileURL}=await import('node:url'),{hash}=await import('./harness.js');const kit=resolve('../../public/format-repositories/my-pixar-story-v1'),format=await loadMemoirFormat(kit),helpers=await import(pathToFileURL(join(kit,'tests/studio-helpers.mjs')).href),p=helpers.renderReady();
 const root=realpathSync(mkdtempSync(join(tmpdir(),'wiggly-transitive-mock-')));try{
  if(!p.artifacts.some((a:any)=>a.key==='answers'))p.artifacts.push({key:'answers',content:{inputs:p.inputs,sourceInputDigest:format.contracts.digest(p.inputs),commonSenseChecks:[]}});
  mkdirSync(join(root,'versions'));const versions=new Map<string,any>();
  function pin(node:any){if(!node||typeof node!=='object')return;if(node.path&&node.sha256&&node.bytes){const bytes=Buffer.from('EXPLICIT MOCK '+node.sha256),sha256=hash(bytes),path=join(root,'versions',sha256+'.png');writeFileSync(path,bytes);Object.assign(node,{path,sha256,bytes:bytes.length});return;}Object.values(node).forEach(pin);}
  for(const a of p.artifacts){pin(a.content);const path=join(root,a.key.replaceAll(':','_')+'.json');writeFileSync(path,JSON.stringify(a.content));versions.set(a.key,{id:a.key,ticket_id:a.key,path,inputs:JSON.stringify(a.key==='narration'?{answers:'answers',script:'script',clone:'clone',audition:'audition'}:{})});}
  const mock={assertCurrentInputs(){},memoirPolicy(){return{source_inputs:p.inputs};},acceptedVersion(_project:string,id:string){return versions.get(id);},memoirAssignment(id:string){return{kind:id,packet:JSON.stringify({asset_key:id})};},ticket(){return{worker_id:'explicit-mock'};},root} as any;
  const view=approvedProjection(format,mock,'mock',{narration:'narration'},'roster');assert.deepEqual(view.artifacts.map((a:any)=>a.kind).sort(),['answers','audition','clone','narration','script']);format.workflow.assertAllowed(view,'roster');
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('character batch rejects changed authorization before provider keys or paid calls',async()=>{
 const {runCharacterRoster,runCharacterCandidates}=await import('./rehearsal-characters.js'),{mkdirSync}=await import('node:fs');const root=mkdtempSync(join(tmpdir(),'wiggly-character-auth-mock-'));try{const dir=join(root,'character-style');mkdirSync(dir);writeFileSync(join(dir,'quote.json'),'{}');writeFileSync(join(dir,'authorization.json'),JSON.stringify({quote_sha256:'wrong',allowance_micros:2000000}));writeFileSync(join(dir,'batch-budget.json'),JSON.stringify({allowance_micros:2000000}));await assert.rejects(runCharacterRoster(root,'never-load-this-kit'),/EXACT_CHARACTER_BATCH_AUTHORIZATION_REQUIRED/);await assert.rejects(runCharacterCandidates(root,'never-load-this-kit'),/EXACT_CHARACTER_BATCH_AUTHORIZATION_REQUIRED/);}finally{rmSync(root,{recursive:true,force:true});}
});


test('producer can bind an explicit backup route while automatic fallback stays disabled',async()=>{
 const f=fixture();try{let calls=0;const worker=rehearsalWorker(f.store,f.ctx,{key:'EXPLICIT_MOCK_KEY',providerRoute:'parasail/fp8',fetcher:async(_url,init)=>{calls++;const body=JSON.parse(String(init?.body));assert.equal(body.provider.only,undefined);assert.deepEqual(body.provider.order,['parasail/fp8']);assert.equal(body.provider.allow_fallbacks,true);assert.deepEqual(body.provider.max_price,{prompt:.3,completion:1.2});return reply('inspect_candidate',{draft_path:'/drafts/candidate.json'});}});await worker.model.bindTools(worker.tools).invoke('Explicit isolated route binding test');assert.equal(calls,1);}finally{f.close();}
});


test('batch continuation verifies existing reviewed outputs instead of regenerating them',async()=>{
 const {verifyCompletedCharacter}=await import('./rehearsal-characters.js'),{hash}=await import('./harness.js');const root=mkdtempSync(join(tmpdir(),'wiggly-completed-candidate-mock-'));
 try{const path=join(root,'candidate.json'),image=join(root,'image.webp'),bytes=Buffer.from('explicit mock candidate'),media=Buffer.from('explicit mock image');writeFileSync(path,bytes);writeFileSync(image,media);
 const candidate={card:{ticket_id:'a',candidate_version_id:'v',content_hash:hash(bytes)},files:[{path:image,sha256:hash(media)}]};let status='AWAITING_APPROVAL';const store={ticket:()=>({status,candidate_id:'v'}),version:()=>({path,content_hash:hash(bytes)})} as any;
 verifyCompletedCharacter(store,candidate);status='APPROVED';verifyCompletedCharacter(store,candidate);status='BLOCKED';assert.throws(()=>verifyCompletedCharacter(store,candidate),/STATE_CHANGED/);status='APPROVED';writeFileSync(image,'changed');assert.throws(()=>verifyCompletedCharacter(store,candidate),/BYTES_CHANGED/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
