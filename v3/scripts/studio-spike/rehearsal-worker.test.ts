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
      const body=JSON.parse(String(init?.body)); assert.equal(body.provider.allow_fallbacks,false); assert.deepEqual(body.provider.only,['decart/fp4']);
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
