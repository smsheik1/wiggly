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
