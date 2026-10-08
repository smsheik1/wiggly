import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { StudioProduction } from '../../lib/studio-production.js';
import { rehearsalWorker } from './rehearsal-worker.js';
import { workspaceAgent } from './harness.js';
import { productionMiddleware, publicationTool } from './production-tools.js';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'wiggly-explicit-rehearsal-worker-mock-')), store = new StudioProduction(root);
  store.createProject('mock', 100000); store.operator('mock','resume',0,{id:'resume',actor:'isolated-test',reason:'No real provider or creative acceptance'});
  store.createTicket('author','mock','test-author',{},100000,'AUTHOR',{maxTurns:12});
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
      const body=JSON.parse(String(init?.body)); assert.equal(body.reasoning.effort,"low"); assert.equal(body.provider.allow_fallbacks,false); assert.deepEqual(body.provider.only,['decart/fp4']);
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
test('HTTP failure stops the ticket and never retries or changes provider',async()=>{
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
