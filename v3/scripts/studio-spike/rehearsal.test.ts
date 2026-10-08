import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { StudioProduction } from "../../lib/studio-production.js";
import { hash } from "./harness.js";
import { createSQLPerception } from "./media-perception.js";
import { executeAuthorizedMedia } from "./media-transport.js";
import { Client } from "langsmith";
import { assertCapability, traceCapability } from "./rehearsal-capability.js";
import { assertPreserved, directoryHashes, prepareRehearsal } from "./rehearsal.js";
import { redact } from "./tracing.js";
const kit = resolve("../../public/format-repositories/my-pixar-story-v1");
function fixture(allowance = 100000) {
  const root = mkdtempSync(join(tmpdir(), "wiggly-rehearsal-explicit-mock-")), store = new StudioProduction(root);
  store.createProject("mock", allowance); store.operator("mock", "resume", 0, { id: "resume", actor: "explicit-isolated-test", reason: "Isolated mock, no production authority" });
  store.createTicket("worker", "mock", "inspector", {}, allowance, "AUTHOR", { maxTurns: 12, maxAttempts: 3 });
  const ctx = store.claim("worker", "mock-inspector", 300000), path = join(root, "image.png");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=red:s=320x180", "-frames:v", "1", path]);
  const bytes = readFileSync(path); const file = { path, bytes: bytes.length, sha256: hash(bytes), width: 320, height: 180 };
  const key = join(root, "mock-secrets.env"); writeFileSync(key, "GEMINI_API_KEY=EXPLICIT_MOCK_KEY\n");
  return { root, store, ctx, file, key, close: () => { store.close(); rmSync(root, { recursive: true, force: true }); } };
}
const report = { perceptible: true, fullMediaInspected: true, summary: "Explicit mock: red left and blue right.", observations: [{ startSeconds: 0, endSeconds: 0, finding: "Explicit mock protocol observation.", repair: "", severity: "info" }], limitations: ["Explicit isolated mock; not a creative-quality qualification"] };
function response(value = report) { return new Response(JSON.stringify({ model: "gemini-3.8-flash", status: "completed", usage: { total_input_tokens: 100, total_output_tokens: 100 }, steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify(value) }] }] })); }
function perception(f: ReturnType<typeof fixture>, fetcher: typeof fetch) { return createSQLPerception({ kit, store: f.store, ctx: f.ctx, files: [f.file], criteria: ["Explicit mock"], maxCalls: 1, estimateMicros: 60000, mockSecretsPath: f.key, fetcher }); }
test("SQL image inspection binds actual supplied bytes and reuses completed evidence", async () => {
  const f = fixture(); let calls = 0;
  try {
    const tools = await perception(f, async (_url, init) => { calls++; const body = JSON.parse(String(init?.body)); assert.equal(body.input[0].type, "image"); assert.deepEqual(Buffer.from(body.input[0].data, "base64"), readFileSync(f.file.path)); return response(); });
    const first = await tools.inspect("image", f.file.sha256), again = await tools.inspect("image", f.file.sha256);
    assert.deepEqual(again.evidence_references, first.evidence_references); assert.equal(calls, 1); assert.equal(first.evidence_references.length, 1); assertCapability("image", first); assert.equal(f.store.allowance("mock").used, 450);
    await assert.rejects(tools.inspect("image", "0".repeat(64)), /SCOPE_DENIED/); writeFileSync(f.file.path, "changed"); await assert.rejects(tools.inspect("image", f.file.sha256), /MEDIA_CHANGED/);
  } finally { f.close(); }
});
test("zero allowance blocks perception before network; partial inspection never passes", async () => {
  for (const partial of [false, true]) {
    const f = fixture(partial ? 100000 : 0); let calls = 0;
    try { const tools = await perception(f, async () => { calls++; return response({ ...report, fullMediaInspected: false }); }); await assert.rejects(tools.inspect("image", f.file.sha256), partial ? /INCONCLUSIVE/ : /ALLOWANCE_EXCEEDED/); assert.equal(calls, partial ? 1 : 0); assert.throws(() => assertCapability("image", { report: { ...report, fullMediaInspected: false }, evidence_references: ["mock"] }), /INCONCLUSIVE/); } finally { f.close(); }
  }
});
test("uploaded media retains byte bindings and permits an empty upload-session response", async () => {
  const f = fixture(); let submissions = 0;
  try {
    const bytes = Buffer.concat([readFileSync(f.file.path), Buffer.alloc(8 * 1024 * 1024 + 1)]); writeFileSync(f.file.path, bytes); f.file.sha256 = hash(bytes); f.file.bytes = bytes.length;
    const tools = await perception(f, async (url, init) => {
      if (String(url).includes("/upload/")) return new Response(null, { headers: { "x-goog-upload-url": "https://generativelanguage.googleapis.com/mock-session" } });
      if (String(url).endsWith("mock-session")) { assert.deepEqual(init?.body, bytes); return new Response(JSON.stringify({ file: { name: "files/mock", uri: "https://generativelanguage.googleapis.com/v1beta/files/mock", state: "ACTIVE" } })); }
      submissions++; assert.equal(JSON.parse(String(init?.body)).input[0].data, undefined); return response();
    });
    const result = await tools.inspect("image", f.file.sha256); assert.equal(result.evidence_references.length, 1); assert.equal(submissions, 1);
  } finally { f.close(); }
});
async function transportFixture(f: ReturnType<typeof fixture>) {
  const mockKit = join(f.root, "mock-kit"); mkdirSync(join(mockKit, "runtime"), { recursive: true });
  writeFileSync(join(mockKit, "runtime/providers.mjs"), `export const loadKey=async()=>"EXPLICIT_MOCK_KEY"; export const remediation=()=>"Explicit mock; stop"; export const executeMediaRequest=async(job,root,key,fetcher,collectOnly,onJobId)=>{ const value=await (await fetcher("https://explicit.invalid",{body:JSON.stringify({collectOnly})})).json(); if(value.providerJobId) onJobId(value.providerJobId); return value; };`);
  return { kit: mockKit, media: { verifyFiles: async (value: any) => { if (hash(readFileSync(value.file.path)) !== value.file.sha256) throw new Error("MEDIA_CHANGED"); } } };
}
test("SQL media publication is immutable and completed replay never resubmits", async () => {
  const f = fixture(); let calls = 0;
  try {
    const format = await transportFixture(f), request = { operationId: "mock-generation", provider: "cartesia" as const, estimateMicros: 1000, plan: { provider: "cartesia" }, request: { explicit_mock: true } };
    const fetcher: typeof fetch = async () => { calls++; return new Response(JSON.stringify({ file: f.file })); };
    const first = await executeAuthorizedMedia(format, f.store, f.ctx, request, fetcher), again = await executeAuthorizedMedia(format, f.store, f.ctx, request, fetcher);
    assert.deepEqual(again, first); assert.equal(calls, 1); assert.ok(first.file.path.startsWith(join(f.store.root, "versions"))); assert.equal(f.store.operation(request.operationId).state, "COMPLETED");
  } finally { f.close(); }
});
test("known media jobs poll; unknown outcomes cannot cause another submission", async () => {
  const f = fixture(); const modes: boolean[] = [];
  try {
    const format = await transportFixture(f), request = { operationId: "mock-queued", provider: "replicate" as const, estimateMicros: 1000, plan: { provider: "replicate" }, request: { explicit_mock: true } };
    const fetcher: typeof fetch = async (_url, init) => { modes.push(JSON.parse(String(init?.body)).collectOnly); return new Response(JSON.stringify(modes.length === 1 ? { pending: true, providerJobId: "known-mock-id" } : { file: f.file })); };
    await executeAuthorizedMedia(format, f.store, f.ctx, request, fetcher); await executeAuthorizedMedia(format, f.store, f.ctx, request, fetcher); assert.deepEqual(modes, [false, true]);
    const uncertain = { ...request, operationId: "unknown" }; f.store.prepareOperation(f.ctx, { operationId: "unknown", provider: "replicate", requestHash: hash(Buffer.from(JSON.stringify({ plan: uncertain.plan, request: uncertain.request }))), estimateMicros: 1000 }); f.store.startOperation(f.ctx, "unknown");
    await assert.rejects(executeAuthorizedMedia(format, f.store, f.ctx, uncertain, fetcher), /RECONCILE/); assert.equal(modes.length, 2);
  } finally { f.close(); }
});
test("zero allowance and mismatched provider block media requests", async () => {
  const f = fixture(0); let calls = 0;
  try { const format = await transportFixture(f), request = { operationId: "denied", provider: "cartesia" as const, estimateMicros: 1, plan: { provider: "cartesia" }, request: {} }; await assert.rejects(executeAuthorizedMedia(format, f.store, f.ctx, request, async () => { calls++; return new Response(); }), /ALLOWANCE_EXCEEDED/); await assert.rejects(executeAuthorizedMedia(format, f.store, f.ctx, { ...request, plan: { provider: "replicate" } }), /PROVIDER_BINDING/); assert.equal(calls, 0); } finally { f.close(); }
});
test("saved-source changes fail preservation checks; all media types are redacted", () => {
  const root = mkdtempSync(join(tmpdir(), "wiggly-preserve-test-"));
  try { writeFileSync(join(root, "original"), "saved"); const expected = directoryHashes(root); assertPreserved(root, expected); writeFileSync(join(root, "original"), "changed"); assert.throws(() => assertPreserved(root, expected), /SAVED_PRODUCTION_CHANGED/); } finally { rmSync(root, { recursive: true, force: true }); }
  for (const type of ["image", "video", "audio"]) { const value = redact({ type, data: Buffer.from("explicit mock media").toString("base64"), apiKey: "never upload" }); assert.equal(value.data.media_omitted, true); assert.equal(JSON.stringify(value).includes("never upload"), false); }
});

test("preparation rejects child names and symlinked destinations before writing saved production", async () => {
  const root = mkdtempSync(join(tmpdir(), "wiggly-isolation-test-")), source = join(root, "saved"); mkdirSync(source); writeFileSync(join(source, "saved.txt"), "original");
  const expected = directoryHashes(source); symlinkSync(source, join(root, "alias"));
  try {
    for (const destination of [join(source, "..rehearsal"), join(root, "alias"), join(root, "alias", "new-child"), root]) {
      await assert.rejects(prepareRehearsal({ root: destination, source, kit, preferredScript: "unused", authoredScript: "unused" }), /ISOLATED_REHEARSAL_REQUIRED/); assertPreserved(source, expected);
    }
    assert.equal(existsSync(join(source, "preparation-started.json")), false);
    const separate = join(root, "separate"); mkdirSync(separate); writeFileSync(join(separate, "preparation-started.json"), "already started");
    await assert.rejects(prepareRehearsal({ root: separate, source, kit, preferredScript: "unused", authoredScript: "unused" }), /ALREADY_PREPARED_NO_RESET/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("capability tracing is explicitly enabled and records saved receipts without another perception call", async () => {
  const uploads: any[] = [];
  const client = new Client({ apiKey: "EXPLICIT_ISOLATED_MOCK", autoBatchTracing: false, callerOptions: { maxRetries: 0 }, fetchImplementation: async () => { throw new Error("No network in this isolated test"); } });
  client.createRun = async value => { uploads.push(value); };
  client.updateRun = async (_id, value) => { uploads.push(value); };
  const id = "11111111-1111-4111-8111-111111111111"; let localReads = 0;
  const result = await traceCapability(client, "image", id, async () => { localReads++; return { saved_receipt: true }; }, true)({ modality: "image", media_hash: "0".repeat(64) });
  await client.awaitPendingTraceBatches(); assert.equal(localReads, 1); assert.deepEqual(result, { saved_receipt: true }); assert.ok(uploads.length > 0); assert.ok(uploads.some(p => p.id === id && p.extra.metadata.recovered_after_execution === true));
});
