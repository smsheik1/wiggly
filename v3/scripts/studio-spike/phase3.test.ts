import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, symlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { StudioProduction, type WorkerLease, type KillPoint } from "../../lib/studio-production.js";
import { publicationTool } from "./production-tools.js";
import { workspaceAgent, hash } from "./harness.js";
import { ScriptedModel, call } from "./offline-model.js";
const exec = promisify(execFile);
const details = { runId: "mock-run", model: "explicit-local-mock", modality: "text", coverage: "complete fixture" };
const fixture = "EXPLICIT_LOCAL_MOCK_DRAFT";
const request = { operationId: "op", provider: "explicit-mock", requestHash: hash(Buffer.from("request")), estimateMicros: 300000 };
function temp() { return mkdtempSync(join(tmpdir(), "wiggly-phase3-")); }
function setup(root: string, now = () => 1000, kill?: (point: KillPoint) => void) {
  const store = new StudioProduction(root, now, kill);
  store.createProject("project", 1000000);
  store.operator("project", "resume", 0, { id: "resume", actor: "test-operator", reason: "Isolated local test" });
  store.setInput("project", "script", "script-v1");
  store.createTicket("ticket", "project", "author", { script: "script-v1" }, 1000000);
  return store;
}
function inspect(store: StudioProduction, ctx: WorkerLease, file = "plate.txt", bytes = fixture) {
  writeFileSync(join(store.draftDirectory(ctx), file), bytes);
  const evidence = store.mediaSupplied(ctx, Buffer.from(bytes), details);
  store.inspectionCompleted(ctx, evidence, "Explicit local mock findings for the complete fixture.");
  return { draft_path: file, evidence_references: [evidence] };
}
async function isolated(run: (root: string) => Promise<void> | void) { const root = temp(); try { await run(root); } finally { rmSync(root, { recursive: true, force: true }); } }

test("projects start paused; restart preserves pause and expired workers are fenced", async () => isolated(root => {
  let time = 1000; let store = new StudioProduction(root, () => time);
  store.createProject("project", 1000000);
  assert.throws(() => store.operator("project", "invalid" as any, 0, { id: "bad", actor: "director", reason: "Invalid action" }), /INVALID_OPERATOR_ACTION/);
  store.createTicket("ticket", "project", "author", {}, 1000000);
  assert.throws(() => store.claim("ticket", "old", 100), /PROJECT_PAUSED/);
  store.operator("project", "resume", 0, { id: "resume", actor: "director", reason: "Explicit test authorization" });
  const old = store.claim("ticket", "old", 100), candidate = inspect(store, old);
  assert.throws(() => store.claim("ticket", "other", 100), /TICKET_ALREADY_CLAIMED/);
  time = 1100; const current = store.claim("ticket", "new", 100);
  assert.equal(current.attemptId, old.attemptId); assert.equal(current.token, old.token + 1);
  for (const action of [() => store.heartbeat(old, 100), () => store.prepareOperation(old, request), () => store.publish(old, candidate)]) assert.throws(action, /STALE_WORKER/);
  store.operator("project", "pause", 1, { id: "pause", actor: "director", reason: "Stop at safe boundaries" }); store.close();
  store = new StudioProduction(root, () => time);
  assert.equal(store.project("project").paused, 1);
  assert.throws(() => store.prepareOperation(current, request), /PROJECT_PAUSED/);
  assert.throws(() => store.publish(current, candidate), /PROJECT_PAUSED/);
  assert.throws(() => store.heartbeat(current, 100), /PROJECT_PAUSED/);
  store.operator("project", "pause", 1, { id: "pause", actor: "director", reason: "Stop at safe boundaries" });
  assert.throws(() => store.operator("project", "resume", 0, { id: "pause", actor: "director", reason: "Changed decision" }), /CONFLICTING_OPERATOR_DECISION/); store.close();
}));

test("two independent processes cannot claim the same assignment", async () => isolated(async root => {
  const store = setup(root, Date.now); store.close();
  const results = await Promise.all(["one", "two"].map(worker => exec(process.execPath, ["--import", "tsx", join(import.meta.dirname, "phase3-crash.ts"), root, "claim", worker])));
  const receipts = results.map(r => JSON.parse(r.stdout));
  assert.equal(receipts.filter(r => r.lease).length, 1); assert.equal(receipts.filter(r => r.error === "TICKET_ALREADY_CLAIMED").length, 1);
}));

test("publication requires completed exact-byte inspection and refuses other tickets or paths", async () => isolated(root => {
  const store = setup(root), ctx = store.claim("ticket", "author", 1000);
  writeFileSync(join(store.draftDirectory(ctx), "plate.txt"), fixture);
  const evidence = store.mediaSupplied(ctx, Buffer.from(fixture), details), candidate = { draft_path: "plate.txt", evidence_references: [evidence] };
  assert.throws(() => store.publish(ctx, candidate), /INVALID_INSPECTION_EVIDENCE/);
  store.inspectionCompleted(ctx, evidence, "Explicit mock findings after a successful response.");
  writeFileSync(join(store.draftDirectory(ctx), "plate.txt"), "CHANGED_BYTES");
  assert.throws(() => store.publish(ctx, candidate), /INVALID_INSPECTION_EVIDENCE/);
  const transmitted = store.mediaSupplied(ctx, Buffer.from(fixture), details);
  store.inspectionCompleted(ctx, transmitted, "Actual transmitted bytes remain original despite a draft change.");
  assert.throws(() => store.publish(ctx, { ...candidate, evidence_references: [transmitted] }), /INVALID_INSPECTION_EVIDENCE/);
  writeFileSync(join(store.draftDirectory(ctx), "plate.txt"), fixture);
  store.createTicket("review-ticket", "project", "reviewer", {}, 1000000, "REVIEWER"); const reviewer = store.claim("review-ticket", "reviewer", 1000);
  const wrong = inspect(store, reviewer);
  assert.throws(() => store.publish(reviewer, wrong), /AUTHOR_ASSIGNMENT_REQUIRED/);
  assert.throws(() => store.publish(ctx, { ...candidate, evidence_references: wrong.evidence_references }), /INVALID_INSPECTION_EVIDENCE/);
  assert.throws(() => store.inspectionCompleted(reviewer, evidence, "Forged completed author inspection findings."), /WRONG_INSPECTION_OWNER/);
  symlinkSync(join(store.draftDirectory(reviewer), "plate.txt"), join(store.draftDirectory(ctx), "alias.txt"));
  assert.throws(() => store.publish(ctx, { ...candidate, draft_path: "alias.txt" }), /DRAFT_PATH_ESCAPE/);
  assert.throws(() => store.publish(ctx, { ...candidate, draft_path: "../drafts/plate.txt" }), /DRAFT_PATH_ESCAPE/);
  const v = store.publish(ctx, candidate); assert.equal(v.content_hash, hash(Buffer.from(fixture))); assert.equal(store.ticket("ticket").status, "SUBMITTED");
  assert.equal(store.publish(ctx, candidate).id, v.id); assert.equal(readdirSync(join(root, "versions")).length, 1); store.close();
}));

test("consumed input revisions reject stale publication; unrelated changes preserve it", async () => isolated(root => {
  const store = setup(root), ctx = store.claim("ticket", "author", 1000), candidate = inspect(store, ctx);
  store.setInput("project", "unconsumed_background", "background-v2");
  const v = store.publish(ctx, candidate); assert.equal(v.inputs, JSON.stringify({ script: "script-v1" }));
  store.createTicket("next-ticket", "project", "author", { script: "script-v1" }, 1000000); const next = store.claim("next-ticket", "author", 1000), draft = inspect(store, next);
  store.setInput("project", "script", "script-v2");
  assert.throws(() => store.publish(next, draft), /STALE_INPUTS/); assert.throws(() => store.prepareOperation(next, { ...request, operationId: "new-op" }), /STALE_INPUTS/);
  assert.equal(readFileSync(v.path, "utf8"), fixture); store.close();
}));

test("pause between filesystem publication and database commit leaves a recoverable exact version", async () => isolated(root => {
  let stopped = false; let store: StudioProduction;
  store = setup(root, () => 1000, point => { if (point === "after_publish_before_record" && !stopped) { stopped = true; store.operator("project", "pause", 1, { id: "pause", actor: "director", reason: "Concurrent pause at boundary" }); } });
  const ctx = store.claim("ticket", "author", 1000), candidate = inspect(store, ctx);
  assert.throws(() => store.publish(ctx, candidate), /PROJECT_PAUSED/); assert.equal(store.ticket("ticket").candidate_id, null);
  assert.equal(readdirSync(join(root, "versions")).length, 1);
  store.operator("project", "resume", 0, { id: "resume-again", actor: "director", reason: "Explicit recovery authorization" });
  const v = store.publish(ctx, candidate); assert.equal(readFileSync(v.path, "utf8"), fixture); assert.equal(store.publish(ctx, candidate).id, v.id); store.close();
}));

test("different version records share immutable bytes without sharing dependency history", async () => isolated(root => {
  const store = setup(root), one = store.claim("ticket", "one", 1000), v1 = store.publish(one, inspect(store, one));
  store.setInput("project", "script", "script-v2"); store.createTicket("second", "project", "author", { script: "script-v2" }, 1000000);
  const two = store.claim("second", "two", 1000), v2 = store.publish(two, inspect(store, two));
  assert.notEqual(v1.id, v2.id); assert.equal(v1.path, v2.path); assert.notEqual(v1.inputs, v2.inputs);
  assert.equal(store.version(v1.id).inputs, JSON.stringify({ script: "script-v1" })); store.close();
}));

test("allowances atomically cover project and ticket caps; replay cannot reserve twice", async () => isolated(root => {
  const store = setup(root); const other = new StudioProduction(root, () => 1000);
  store.createTicket("second", "project", "author", {}, 1000000);
  const one = store.claim("ticket", "one", 1000), two = other.claim("second", "two", 1000);
  const prepared = { ...request, estimateMicros: 600000 }; store.prepareOperation(one, prepared); store.prepareOperation(one, prepared);
  assert.equal(store.allowance("project").used, 600000);
  assert.throws(() => other.prepareOperation(two, { ...prepared, operationId: "second-op" }), /ALLOWANCE_EXCEEDED/);
  assert.throws(() => store.prepareOperation(one, { ...prepared, requestHash: hash(Buffer.from("changed request")) }), /OPERATION_REPLAY_CONFLICT/);
  store.failOperation("op", "Explicit mock confirmed non-billing", true); assert.equal(store.allowance("project").used, 0);
  other.prepareOperation(two, { ...prepared, operationId: "second-op" });
  store.createTicket("tiny", "project", "author", {}, 100000); const tiny = store.claim("tiny", "tiny", 1000);
  assert.throws(() => store.prepareOperation(tiny, { ...request, operationId: "tiny-op", estimateMicros: 200000 }), /ALLOWANCE_EXCEEDED/); other.close(); store.close();
}));

test("completion settles once, separates billing/credits, and records overruns before blocking spend", async () => isolated(root => {
  const store = setup(root), ctx = store.claim("ticket", "author", 1000); store.prepareOperation(ctx, request); store.startOperation(ctx, "op");
  assert.throws(() => store.completeOperation("op", { result: { artifactReferences: ["data:image/png;base64,AAAA"] } }), /ARTIFACT_REFERENCES_REQUIRED/);
  const receipt = { result: { artifactReferences: ["mock-output"] }, actualAllowanceMicros: 1200000, providerUsage: { images: 1 }, includedCredits: { plan: "operator-subscription", applicable: true }, verifiedChargeMicros: 0 };
  const done = store.completeOperation("op", receipt); store.completeOperation("op", receipt);
  assert.equal(done.allowance_used, 1200000); assert.equal(done.verified_charge, 0); assert.equal(JSON.parse(done.included_credits).applicable, true);
  assert.equal(store.allowance("project").used, 1200000); assert.equal(store.allowance("project").overrunMicros, 200000); assert.throws(() => store.completeOperation("op", { ...receipt, actualAllowanceMicros: 1 }), /SETTLEMENT_CONFLICT/);
  assert.throws(() => store.prepareOperation(ctx, { ...request, operationId: "new" }), /ALLOWANCE_EXCEEDED/);
  store.operator("project", "extend_allowance", 2000000, { id: "extend", actor: "director", reason: "Explicit mock increase" });
  assert.throws(() => store.prepareOperation(ctx, { ...request, operationId: "new" }), /ALLOWANCE_EXCEEDED/); // Ticket cap still applies.
  store.createTicket("second", "project", "author", {}, 1000000); const second = store.claim("second", "second", 1000); store.prepareOperation(second, { ...request, operationId: "second-op" }); store.startOperation(second, "second-op");
  const estimated = store.completeOperation("second-op", { result: { artifactReferences: ["another-output"] } });
  assert.equal(estimated.allowance_basis, "ESTIMATE"); assert.equal(estimated.verified_charge, null); store.close();
}));

test("expired intent can be adopted; uncertain submissions retain allowance and forbid duplicate calls", async () => isolated(root => {
  let time = 1000; const store = setup(root, () => time), old = store.claim("ticket", "old", 10); store.prepareOperation(old, request);
  time = 1010; const current = store.claim("ticket", "new", 100); store.prepareOperation(current, request);
  assert.equal(store.allowance("project").used, 300000); assert.throws(() => store.startOperation(old, "op"), /STALE_WORKER/);
  store.startOperation(current, "op"); assert.equal(store.recoveryAction("op").action, "MANUAL_RECONCILIATION");
  assert.throws(() => store.prepareOperation(current, { ...request, operationId: "duplicate" }), /UNRESOLVED_OPERATION/);
  time = 1110; assert.throws(() => store.claim("ticket", "another", 100), /UNCERTAIN_OPERATION/);
  store.recordRequestId("op", "recovered-original-request"); assert.equal(store.recoveryAction("op").action, "RECONCILE_KNOWN_REQUEST");
  const recovered = store.claim("ticket", "another", 100); assert.throws(() => store.prepareOperation(recovered, request), /RECONCILE_INSTEAD_OF_RESUBMIT/);
  assert.equal(store.allowance("project").used, 300000); store.close();
}));

test("external failure stops dispatch, keeps uncertain reservation, and requires billing reconciliation", async () => isolated(async root => {
  const store = setup(root), ctx = store.claim("ticket", "worker", 1000); let calls = 0;
  await assert.rejects(store.executeOperation(ctx, request, async () => { calls++; throw new Error("HTTP 503 explicit mock"); }, error => `${error}; check https://dev.meta.ai → Billing/Usage and API Keys; canonical /Users/shaz/Projects/wiggly/secrets.env: META_API_KEY=<your-key>`), /STOP: explicit-mock.*HTTP 503/);
  assert.equal(calls, 1); assert.equal(store.ticket("ticket").status, "BLOCKED"); assert.equal(store.allowance("project").used, 300000);
  assert.equal(store.recoveryAction("op").action, "MANUAL_RECONCILIATION"); assert.throws(() => store.claim("ticket", "retry", 1000), /TICKET_ALREADY_CLAIMED/);
  store.settleFailedOperation("op", 0); store.settleFailedOperation("op", 0); assert.equal(store.allowance("project").used, 0);
  assert.throws(() => store.settleFailedOperation("op", 100), /SETTLEMENT_CONFLICT/); store.close();
}));

test("known requests survive execution failure and settle while operator-paused", async () => isolated(root => {
  const store = setup(root), ctx = store.claim("ticket", "worker", 1000);
  store.prepareOperation(ctx, request); store.startOperation(ctx, "op"); store.recordRequestId("op", "original-job");
  store.failOperation("op", "Explicit mock polling HTTP 503: retain original paid job");
  assert.equal(store.recoveryAction("op").action, "RECONCILE_KNOWN_REQUEST");
  store.operator("project", "pause", 1, { id: "pause", actor: "director", reason: "Pause affected execution" });
  store.completeOperation("op", { result: { artifactReferences: ["recovered-output"] }, actualAllowanceMicros: 200000 });
  assert.equal(store.operation("op").request_id, "original-job"); assert.equal(store.allowance("project").used, 200000);
  assert.equal(store.ticket("ticket").status, "BLOCKED"); assert.equal(store.project("project").paused, 1); store.close();
}));

test("publication never overwrites corrupt published bytes or accepts changed inputs at commit", async () => isolated(root => {
  let changed = false; let store: StudioProduction;
  store = setup(root, () => 1000, point => { if (point === "after_publish_before_record" && !changed) { changed = true; store.setInput("project", "script", "script-v2"); } });
  const ctx = store.claim("ticket", "worker", 1000), candidate = inspect(store, ctx);
  assert.throws(() => store.publish(ctx, candidate), /STALE_INPUTS/); assert.equal(store.ticket("ticket").candidate_id, null);
  store.createTicket("fresh", "project", "author", { script: "script-v2" }, 1000000);
  const fresh = store.claim("fresh", "worker", 1000), another = inspect(store, fresh, "changed.txt", "ANOTHER_EXPLICIT_FIXTURE");
  const path = join(root, "versions", hash(Buffer.from("ANOTHER_EXPLICIT_FIXTURE"))); writeFileSync(path, "CORRUPT_TEST_BYTES");
  assert.throws(() => store.publish(fresh, another), /PUBLISHED_BYTES_CORRUPT/); assert.equal(readFileSync(path, "utf8"), "CORRUPT_TEST_BYTES");
  assert.equal(store.ticket("fresh").candidate_id, null); store.close();
}));

test("native Deep Agents submission binds runtime lease and ends after immutable publication", async () => isolated(async root => {
  const store = setup(root), ctx = store.claim("ticket", "worker", 1000), candidate = inspect(store, ctx);
  const work = dirname(store.draftDirectory(ctx)); for (const name of ["references", "versions", "skills"]) mkdirSync(join(work, name));
  const finish = publicationTool(store, ctx); assert.deepEqual(Object.keys(finish.schema.shape).sort(), ["draft_path", "evidence_references"]);
  await assert.rejects(finish.invoke({ draft_path: "/drafts/plate.txt", evidence_references: candidate.evidence_references, token: 999 } as any));
  const model = new ScriptedModel([() => call("submit_candidate", { draft_path: "/drafts/plate.txt", evidence_references: candidate.evidence_references })]);
  const agent = workspaceAgent(model, work, "openai:isolated-scripted-model", "phase3-mock-author", [finish], "Explicit isolated local mock publication test.");
  await agent.invoke({ messages: [{ role: "user", content: "Submit the existing inspected fixture." }] }, { recursionLimit: 16 });
  assert.equal(model.calls.length, 1); assert.equal(store.ticket("ticket").status, "SUBMITTED"); assert.equal(readFileSync(store.version(store.ticket("ticket").candidate_id).path, "utf8"), fixture); store.close();
}));

for (const point of ["after_intent", "after_dispatch_before_call", "after_submit_before_request_id", "after_request_id", "after_publish_before_record", "after_publication_commit"] as KillPoint[]) {
  test(`SIGKILL at ${point}: restart preserves safety without another provider submission`, async () => isolated(async root => {
    await assert.rejects(exec(process.execPath, ["--import", "tsx", join(import.meta.dirname, "phase3-crash.ts"), root, point]), (error: any) => error.signal === "SIGKILL");
    assert.equal(JSON.parse(readFileSync(join(root, "kill-point.json"), "utf8")).reached, point);
    const store = new StudioProduction(root, () => Date.now() + 120000);
    const prior = JSON.parse(readFileSync(join(root, "lease.json"), "utf8"));
    if (point.startsWith("after_pub")) {
      assert.equal(readdirSync(join(root, "versions")).length, 1);
      const evidence = JSON.parse(readFileSync(join(root, "evidence.json"), "utf8"));
      if (point === "after_publish_before_record") {
        assert.equal(store.ticket("ticket").candidate_id, null);
        const current = store.claim("ticket", "recovery", 1000); assert.ok(current.token > prior.token);
        const v = store.publish(current, { draft_path: "plate.txt", evidence_references: evidence }); assert.equal(readFileSync(v.path, "utf8"), "ORIGINAL_DRAFT_BYTES");
      } else { const v = store.version(store.ticket("ticket").candidate_id); assert.equal(readFileSync(v.path, "utf8"), "ORIGINAL_DRAFT_BYTES"); assert.equal(store.ticket("ticket").status, "SUBMITTED"); }
    } else {
      const recovery = store.recoveryAction("operation");
      assert.equal(store.allowance("project").used, 300000);
      if (point === "after_intent") { assert.equal(recovery.action, "RESUME_INTENT"); const current = store.claim("ticket", "recovery", 1000); store.prepareOperation(current, { ...request, operationId: "operation", requestHash: hash(Buffer.from("mock request")) }); }
      else if (point === "after_request_id") { assert.equal(recovery.action, "RECONCILE_KNOWN_REQUEST"); assert.equal(recovery.operation.request_id, "known-request"); store.completeOperation("operation", { result: { artifactReferences: ["mock-artifact-reference"] }, actualAllowanceMicros: 200000 }); assert.equal(store.allowance("project").used, 200000); }
      else { assert.equal(recovery.action, "MANUAL_RECONCILIATION"); assert.throws(() => store.claim("ticket", "retry", 1000), /UNCERTAIN_OPERATION/); }
      if (["after_submit_before_request_id", "after_request_id"].includes(point)) assert.equal(JSON.parse(readFileSync(join(root, "mock-provider.json"), "utf8")).submissions, 1);
      else assert.throws(() => readFileSync(join(root, "mock-provider.json")));
    }
    store.close();
  }));
}
