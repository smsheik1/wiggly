import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { StudioProduction } from "../../lib/studio-production.js";
import { hash } from "./harness.js";
import { dispatchAssignments } from "./dispatch.js";
const exec = promisify(execFile);
async function fixture(run: (s: StudioProduction, root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), "wiggly-phase5-")), s = new StudioProduction(root);
  try { s.createProject("p", 1000); s.operator("p", "resume", 0, { id: "resume", actor: "mock-director", reason: "Isolated mock test" }); s.configureConcurrency("p", 2, { mock: 1 });
    for (const id of ["a", "b", "c", "d"]) s.createTicket(id, "p", "author", {}, 1000);
    await run(s, root);
  } finally { s.close(); rmSync(root, { recursive: true, force: true }); }
}
const request = (id: string, estimateMicros = 100) => ({ operationId: id, provider: "mock", requestHash: hash(Buffer.from(id)), estimateMicros });
async function processes(root: string, ids: string[], action: string, estimate = "100") {
  return Promise.all(ids.map(async id => JSON.parse((await exec(process.execPath, ["--import", "tsx", join(import.meta.dirname, "phase5-process.ts"), root, id, action, estimate])).stdout)));
}

test("two worker slots are exclusive across four independent SQLite processes", async () => fixture(async (s, root) => {
  const results = await processes(root, ["a", "b", "c", "d"], "claim");
  assert.equal(results.filter(r => r.success).length, 2); assert.equal(results.filter(r => r.error === "WORKER_CAPACITY_BUSY").length, 2);
}));

test("concurrent reservations cannot exceed the shared project cap", async () => fixture(async (s, root) => {
  const results = await processes(root, ["a", "b"], "reserve", "600");
  assert.equal(results.filter(r => r.success).length, 1); assert.equal(results.filter(r => r.error === "ALLOWANCE_EXCEEDED").length, 1);
  assert.equal(s.allowance("p").used, 600);
}));

test("atomic provider slots survive restart and uncertainty; confirmed settlement releases them", async () => fixture(async (s, root) => {
  const results = await processes(root, ["a", "b"], "start");
  assert.equal(results.filter(r => r.success).length, 1); assert.equal(results.filter(r => r.error === "PROVIDER_CAPACITY_BUSY").length, 1);
  const running = results.find(r => r.success)!;
  assert.equal(s.providerCapacity("mock").used, 1);
  const reopened = new StudioProduction(root);
  try {
    reopened.recoveryAction(running.ticket); assert.equal(reopened.providerCapacity("mock").used, 1);
    reopened.failOperation(running.ticket, "Explicit mock unknown submission"); assert.equal(reopened.providerCapacity("mock").used, 1);
    reopened.settleFailedOperation(running.ticket, 0); assert.equal(reopened.providerCapacity("mock").used, 0);
  } finally { reopened.close(); }
}));

test("provider waiting submits each request once and respects one slot across two workers", async () => fixture(async s => {
  const contexts = [s.claim("a", "one", 60000), s.claim("b", "two", 60000)];
  let active = 0, peak = 0, calls = 0;
  await Promise.all(contexts.map(ctx => s.executeOperation(ctx, request(ctx.ticketId), async () => {
    peak = Math.max(peak, ++active); calls++; await delay(35); active--;
    return { completed: { result: { artifactReferences: ["mock-receipt"] }, actualAllowanceMicros: 100 } };
  }, String, AbortSignal.timeout(5000))));
  assert.equal(peak, 1); assert.equal(calls, 2); assert.equal(s.providerCapacity("mock").used, 0); assert.equal(s.allowance("p").used, 200);
}));

test("pause prevents waiting operation from starting while retaining its intent", async () => fixture(async s => {
  const a = s.claim("a", "one", 60000), b = s.claim("b", "two", 60000);
  s.prepareOperation(a, request("a")); s.startOperation(a, "a"); let calls = 0;
  const waiting = s.executeOperation(b, request("b"), async () => { calls++; return { completed: { result: { artifactReferences: [] } } }; }, String, AbortSignal.timeout(5000));
  s.operator("p", "pause", 1, { id: "pause", actor: "mock-director", reason: "Pause local test" });
  await assert.rejects(waiting, /PROJECT_PAUSED/); assert.equal(calls, 0); assert.equal(s.operation("b").state, "INTENT");
}));

test("bounded dispatch overlaps two independent publications and preserves their separate drafts", async () => fixture(async s => {
  let active = 0, peak = 0;
  const result = await dispatchAssignments(s, "p", ["a", "b", "c", "d"], async ctx => {
    peak = Math.max(peak, ++active); await delay(20);
    const bytes = Buffer.from(`EXPLICIT_MOCK_${ctx.ticketId}`); writeFileSync(join(s.draftDirectory(ctx), "plate.txt"), bytes);
    const e = s.mediaSupplied(ctx, bytes, { runId: ctx.ticketId, model: "mock", modality: "text", coverage: "complete" });
    s.inspectionCompleted(ctx, e, `Explicit mock complete findings for assignment ${ctx.ticketId}`);
    s.publish(ctx, { draft_path: "plate.txt", evidence_references: [e] }); active--;
  });
  assert.equal(peak, 2); assert.equal(result.receipts.length, 4); assert.ok(result.receipts.every(r => r.status === "SUBMITTED"));
  assert.equal(new Set(result.receipts.map(r => s.ticket(r.ticket).candidate_id)).size, 4);
}));

test("dispatch failure pauses immediately and never starts pending work", async () => fixture(async s => {
  const started: string[] = [];
  await assert.rejects(dispatchAssignments(s, "p", ["a", "b", "c", "d"], async ctx => {
    started.push(ctx.ticketId); if (ctx.ticketId === "a") throw new Error("EXPLICIT_MOCK_PROVIDER_FAILURE"); await delay(25);
  }), /EXPLICIT_MOCK_PROVIDER_FAILURE/);
  assert.deepEqual(started, ["a", "b"]); assert.equal(s.project("p").paused, 1); assert.equal(s.ticket("c").status, "READY");
}));

test("SQLite transaction contention waits instead of failing startup", async () => fixture(async (s, root) => {
  const holder = spawn(process.execPath, ["--input-type=module", "-e", `import {DatabaseSync} from 'node:sqlite';import {existsSync} from 'node:fs'; const root=process.argv[1],d=new DatabaseSync(root+'/studio.sqlite');d.exec('BEGIN IMMEDIATE');console.log('LOCKED'); const deadline=Date.now()+5000;while(!['a','b'].every(id=>existsSync(root+'/'+id+'.starting'))){if(Date.now()>deadline)throw Error('BARRIER_TIMEOUT');await new Promise(r=>setTimeout(r,10));} await new Promise(r=>setTimeout(r,200));d.exec('COMMIT');d.close();`, root]);
  await new Promise<void>((resolve, reject) => { holder.stdout.once("data", data => { if (String(data).includes("LOCKED")) resolve(); else reject(new Error("LOCK_BARRIER_FAILED")); }); holder.once("error", reject); });
  const ended = new Promise<void>((resolve, reject) => { holder.once("close", code => code === 0 ? resolve() : reject(new Error("LOCK_HOLDER_FAILED"))); });
  const receipts = await processes(root, ["a", "b"], "contention"); await ended;
  assert.ok(receipts.every(r => r.success && r.elapsed_ms >= 150));
}));

test("NIM rejects missing required tool, truncation, and unknown/invalid tool calls without retry", async () => {
  const { nimTransport } = await import("./nim-transport.js");
  const fixtures = [
    { finish_reason: "stop", message: { role: "assistant", content: "<|close|>garbled" } },
    { finish_reason: "length", message: { role: "assistant", tool_calls: [] } },
    { finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: "x", type: "function", function: { name: "unapproved", arguments: "{}" } }] } },
    { finish_reason: "tool_calls", message: { role: "assistant", tool_calls: [{ id: "x", type: "function", function: { name: "inspect", arguments: "{" } }] } },
  ];
  for (const choice of fixtures) { let calls = 0;
    const transport = nimTransport(async () => { calls++; return new Response(JSON.stringify({ choices: [choice] })); });
    await assert.rejects(transport("https://integrate.api.nvidia.com/v1/chat/completions", { body: JSON.stringify({ messages: [], tool_choice: "required", tools: [{ type: "function", function: { name: "inspect" } }] }) }));
    assert.equal(calls, 1);
  }
});

test("provider pacing is durable across connections and cannot be bypassed by another worker", async () => fixture(async (s, root) => {
  s.configureConcurrency("p", 2, { mock: 2 }, { mock: 10000 });
  const a = s.claim("a", "one", 60000), b = s.claim("b", "two", 60000);
  s.prepareOperation(a, request("a")); s.prepareOperation(b, request("b")); s.startOperation(a, "a");
  s.completeOperation("a", { result: { artifactReferences: [] } });
  const next = s.providerCapacity("mock").nextAllowedAt; assert.ok(next > Date.now());
  const reopened = new StudioProduction(root);
  try { assert.equal(reopened.providerCapacity("mock").nextAllowedAt, next); assert.throws(() => reopened.startOperation(b, "b"), /PROVIDER_CAPACITY_BUSY/); assert.equal(reopened.operation("b").state, "INTENT"); }
  finally { reopened.close(); }
}));

test("a reserved waiting operation cannot start after another operation overruns the project cap", async () => fixture(async s => {
  const a = s.claim("a", "one", 60000), b = s.claim("b", "two", 60000);
  s.prepareOperation(a, request("a")); s.prepareOperation(b, request("b")); s.startOperation(a, "a");
  s.completeOperation("a", { result: { artifactReferences: [] }, actualAllowanceMicros: 1000 });
  assert.throws(() => s.startOperation(b, "b"), /ALLOWANCE_EXCEEDED/); assert.equal(s.operation("b").state, "INTENT");
}));

test("the first provider error remains visible when another worker hits the resulting pause", async () => fixture(async s => {
  await assert.rejects(dispatchAssignments(s, "p", ["a", "b"], async ctx => {
    if (ctx.ticketId === "a") throw new Error("ROOT_MOCK_RATE_LIMIT");
    await delay(20); s.beginTurn(ctx, "other-turn");
  }), /ROOT_MOCK_RATE_LIMIT/);
  assert.equal(s.project("p").paused, 1);
}));


test("live admission cannot reset the shared allowance or repeat an exhausted diagnostic", async () => fixture(async (_s, root) => {
  const { admitLiveTrial } = await import("./phase5-live.js");
  await admitLiveTrial(root, root, 1, false);
  await assert.rejects(admitLiveTrial(root, root, 1, true), /EEXIST/);
  await assert.rejects(admitLiveTrial(root, root, 1, false), /EEXIST/);
  await assert.rejects(admitLiveTrial(root, root + "-other", 2, true), /one authorized allowance/);
  await admitLiveTrial(root, root, 2, true); await admitLiveTrial(root, root, 3, true);
  await assert.rejects(admitLiveTrial(root, root, 4, true), /three distinct/);
}));

test('OpenRouter preserves native reasoning details and rejects malformed tools without retries', async () => {
  const { chatCompletionsTransport } = await import('./nim-transport.js');
  const message={role:'assistant',content:null,reasoning_details:[{type:'reasoning.text',text:'Explicit mock reasoning'}],tool_calls:[{id:'call-one',type:'function',function:{name:'inspect',arguments:'{}'}}]};
  const tools=[{type:'function',function:{name:'inspect'}}];let calls=0;
  const transport=chatCompletionsTransport('https://openrouter.ai',async(_input,init)=>{
    const body=JSON.parse(String(init?.body));calls++;
    if(calls===2)assert.deepEqual(body.messages[0],message);
    return new Response(JSON.stringify({choices:[{finish_reason:'tool_calls',message}]}));
  });
  await transport('https://openrouter.ai/api/v1/chat/completions',{body:JSON.stringify({messages:[],tools,tool_choice:'required'})});
  await transport('https://openrouter.ai/api/v1/chat/completions',{body:JSON.stringify({messages:[{role:'assistant',tool_calls:message.tool_calls}],tools,tool_choice:'required'})});
  assert.equal(calls,2);await assert.rejects(transport('https://unapproved.example/api',{body:'{}'}));assert.equal(calls,2);
  for(const choice of [{finish_reason:'stop',message:{role:'assistant',content:'tool command as text'}},{finish_reason:'length',message}]){
    let requests=0;const invalid=chatCompletionsTransport('https://openrouter.ai',async()=>{requests++;return new Response(JSON.stringify({choices:[choice]}));});
    await assert.rejects(invalid('https://openrouter.ai/api/v1/chat/completions',{body:JSON.stringify({messages:[],tools,tool_choice:'required'})}));assert.equal(requests,1);
  }
});


test("director-authorized DeepSeek routing uses only tested primary and backup providers", async () => {
  const { deepseekProviders } = await import("./phase5-live.js");
  assert.deepEqual(deepseekProviders.order, ["decart/fp4", "sail-research/fp4"]);
  assert.deepEqual(deepseekProviders.only, deepseekProviders.order);
  assert.equal(deepseekProviders.allow_fallbacks, true);
  assert.equal(deepseekProviders.require_parameters, true);
  assert.deepEqual(deepseekProviders.max_price, { prompt: .3, completion: 1.2 });
});


test("large candidate images remain multimodal instead of becoming offloaded text", async () => {
  const { inspectionResult } = await import("./phase5-live.js");
  const { ScriptedModel, call } = await import("./offline-model.js");
  const { workspaceAgent } = await import("./harness.js");
  const { tool } = await import("langchain");
  const { z } = await import("zod");
  const root=mkdtempSync(join(tmpdir(),"inspection-media-")),bytes=Buffer.alloc(360010,7);
  try {const inspect=tool((_input,runtime)=>inspectionResult(bytes,"Inspect exact candidate bytes",(runtime as any).toolCall.id),{name:"inspect_candidate",description:"Inspect image",schema:z.object({})});
    const finish=tool(()=>"complete",{name:"finish",description:"Finish",schema:z.object({}),returnDirect:true});
    const model=new ScriptedModel([()=>call("inspect_candidate",{}),messages=>{
      const blocks=messages.at(-1)?.content;assert.ok(Array.isArray(blocks));
      const image=blocks.find((b:any)=>b.type==="image_url") as any;assert.ok(image);
      assert.equal(hash(Buffer.from(image.image_url.url.split(",")[1],"base64")),hash(bytes));
      assert.ok(!JSON.stringify(messages).includes("large_tool_results"));return call("finish",{});
    }]);
    await workspaceAgent(model,root,"openai:isolated-scripted-model","media-regression",[inspect,finish],"Isolated mock image delivery test").invoke({messages:[{role:"user",content:"inspect"}]});
    assert.equal(model.calls.length,2);
  }finally{rmSync(root,{recursive:true,force:true});}
});


test("review packet maps host paths into worker workspace without changing version identity", async () => {
 const { workerReviewPacket }=await import("./phase5-live.js");
 const packet={candidate_path:"/host/private/versions/hash",candidate_version_id:"version",content_hash:"hash",exact_inputs:{script:"approved-script"},criteria:["empty kitchen"]};
 const mounted=workerReviewPacket(packet);
 assert.equal(mounted.candidate_path,"/references/candidate.webp");
 const {candidate_path:originalPath,...identity}=packet;const {candidate_path:mountedPath,...mountedIdentity}=mounted;
 assert.deepEqual(mountedIdentity,identity);assert.equal(packet.candidate_path,originalPath);
});


test("image requests exclude the text-only Sail backup", async()=>{
 const {deepseekRouting}=await import("./phase5-live.js");
 assert.deepEqual(deepseekRouting(false).only,["decart/fp4","sail-research/fp4"]);
 assert.deepEqual(deepseekRouting(true).only,["decart/fp4"]);
 assert.equal(deepseekRouting(true).allow_fallbacks,false);
});

test("authenticated rejected-call recovery preserves reservations, turn history, and fencing", async()=>fixture(async(s,root)=>{
 const {provisionLocalOperator,signLocalOperator}=await import('../../lib/studio-operator.js');
 const principal=provisionLocalOperator(root);
 s.createTicket('recovery','p','reviewer',{},1000,'REVIEWER',{maxTurns:4,maxAttempts:1});
 const old=s.claim('recovery','old-reviewer',300000);
 for(let n=1;n<=3;n++)s.beginTurn(old,'turn-'+n);
 s.prepareOperation(old,request('rejected',100));s.startOperation(old,'rejected');s.failOperation('rejected','HTTP 400: image unsupported');
 const payload={id:'authorized-recovery',principal,project_id:'p',action:'extend_limits' as const,ticket_id:'recovery',expected_revision:s.ticket('recovery').revision,reason:'Explicit mock director recovery',max_turns:6,recover_rejected_operation:{operation_id:'rejected',request_id:'gen-rejected',evidence_reference:'isolated mock rejection receipt'}};
 assert.throws(()=>s.authorizeLimits({payload,signature:'0'.repeat(64)}),/UNAUTHENTICATED_OPERATOR/);
 const signed=signLocalOperator(root,payload),result=s.authorizeLimits(signed);
 assert.deepEqual(s.authorizeLimits(signed),result);
 assert.equal(s.allowance('p').used,100);assert.equal(s.operation('rejected').settled_at,null);
 const current=s.claim('recovery','new-reviewer',300000);assert.equal(current.attemptId,old.attemptId);
 assert.throws(()=>s.beginTurn(old,'stale'),/STALE_WORKER/);
 assert.throws(()=>s.prepareOperation(current,request('rejected',100)),/RECONCILE_INSTEAD_OF_RESUBMIT/);
 s.prepareOperation(current,request('intentional-new-call',100));assert.equal(s.allowance('p').used,200);
 for(let n=4;n<=6;n++)s.beginTurn(current,'turn-'+n);
 assert.throws(()=>s.beginTurn(current,'turn-7'),/TURN_LIMIT/);
}));

test("operator recovery cannot declare a connection error a rejected request",async()=>fixture(async(s,root)=>{
 const {provisionLocalOperator,signLocalOperator}=await import('../../lib/studio-operator.js');const principal=provisionLocalOperator(root),ctx=s.claim('a','worker',300000);
 s.prepareOperation(ctx,request('unknown',100));s.startOperation(ctx,'unknown');s.failOperation('unknown','Connection error: submission outcome unknown');
 assert.throws(()=>s.authorizeLimits(signLocalOperator(root,{id:'wrong-recovery',principal,project_id:'p',action:'extend_limits' as const,ticket_id:'a',expected_revision:s.ticket('a').revision,reason:'Explicit isolated mock negative test',max_turns:10,recover_rejected_operation:{operation_id:'unknown',request_id:'invented',evidence_reference:'mock'}})),/REJECTED_OPERATION_REQUIRED/);
 assert.equal(s.ticket('a').status,'BLOCKED');assert.equal(s.operation('unknown').settled_at,null);
}));
