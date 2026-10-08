import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify, parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import type { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import { StudioProduction } from "../../lib/studio-production.js";
import { provisionLocalOperator, signLocalOperator } from "../../lib/studio-operator.js";
import { createSQLPerception } from "./media-perception.js";
import { capabilityQuote, rehearsalProject, assertPreserved } from "./rehearsal.js";
import { hash } from "./harness.js";
import { tracing } from "./tracing.js";
const exec = promisify(execFile);
export function traceCapability(client: Client, kind: string, runId: string, invoke: (input: { modality: string; media_hash: string }) => Promise<any>, recovery = false) {
  return traceable(invoke, { id: runId, client, tracingEnabled: true, project_name: "wiggly-memoir-rehearsal", name: recovery ? `saved-capability-receipt-${kind}` : `capability-${kind}`, run_type: "tool", metadata: { production: false, modality: kind, recovered_after_execution: recovery, perception_repeated: false } });
}
export function assertCapability(kind: string, result: any) {
  if (!result.report?.perceptible || !result.report?.fullMediaInspected || !result.evidence_references?.length) throw new Error("PERCEPTION_INCONCLUSIVE");
  const text = [result.report.summary, ...result.report.observations.map((o: any) => o.finding)].join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const image = /red.{0,30}left|left.{0,30}red/.test(text) && /blue.{0,30}right|right.{0,30}blue/.test(text);
  const video = /blue/.test(text) && /left.{0,30}right|mov.{0,25}rightward|mov.{0,25}to the right/.test(text) && !/right to left/.test(text);
  const audio = text.includes("the copper kettle is beside the window");
  if (!(kind === "image" ? image : kind === "video" ? video : kind === "audio" ? audio : false)) throw new Error(`CAPABILITY_OBSERVATION_MISMATCH_${kind}`);
}
export async function prepareCapability(root: string, kit: string) {
  const directory = join(root, "capability-fixtures"); mkdirSync(directory, { recursive: true });
  const media = await import(pathToFileURL(join(kit, "runtime/media.mjs")).href);
  if (existsSync(join(directory, "fixtures.json"))) {
    const value = JSON.parse(readFileSync(join(directory, "fixtures.json"), "utf8")); await media.verifyFiles(value); return value;
  }
  const image = join(directory, "image.png"), video = join(directory, "video.mp4"), aiff = join(directory, "spoken.aiff"), audio = join(directory, "audio.wav");
  await exec("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=red:s=320x180,drawbox=x=160:y=0:w=160:h=180:color=blue:t=fill", "-frames:v", "1", image]);
  await exec("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=white:s=320x180:r=30:d=4", "-f", "lavfi", "-i", "color=c=blue:s=60x60:r=30:d=4", "-filter_complex", "[0:v][1:v]overlay=x='20+t*45':y=60:shortest=1[v]", "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", video]);
  await exec("say", ["-r", "140", "-o", aiff, "The copper kettle is beside the window."]);
  await exec("ffmpeg", ["-v", "error", "-i", aiff, "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", audio]);
  const value = { image: await media.importMedia(image, directory), video: await media.importMedia(video, directory), audio: await media.importMedia(audio, directory) };
  writeFileSync(join(directory, "fixtures.json"), JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" });
  writeFileSync(join(directory, "heldout-controls.json"), JSON.stringify({ image: "red left, blue right", video: "blue square moves left to right", audio: "The copper kettle is beside the window.", disclosure: "These are explicit local capability fixtures, never production film media. Controls are not sent to the perception model." }), { mode: 0o600, flag: "wx" });
  return value;
}
export async function runCapability(root: string, kit: string, authorizationPath: string) {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")); assertPreserved(manifest.source, manifest.saved_production_hashes);
  const quote = JSON.parse(readFileSync(join(root, "capability-batch.json"), "utf8")), authorization = JSON.parse(readFileSync(authorizationPath, "utf8"));
  if (JSON.stringify(quote) !== JSON.stringify(capabilityQuote)) throw new Error("CAPABILITY_QUOTE_CHANGED");
  const perceptionModule = await import(pathToFileURL(join(kit, "runtime/gemini-review.mjs")).href);
  if (perceptionModule.GEMINI_REVIEW_MODEL !== quote.model) throw new Error("CAPABILITY_MODEL_CHANGED");
  if (authorization.quote_sha256 !== hash(Buffer.from(JSON.stringify(quote))) || authorization.allowance_micros !== capabilityQuote.allowance_micros || !authorization.operator_message?.trim()) throw new Error("EXACT_BATCH_AUTHORIZATION_REQUIRED");
  const started = join(root, "capability-started.json");
  if (existsSync(started)) throw new Error("CAPABILITY_ALREADY_STARTED_NO_AUTOMATIC_RETRY");
  const fixtures = await prepareCapability(root, kit), store = new StudioProduction(root), principal = provisionLocalOperator(root), traces = await tracing();
  if (store.project(rehearsalProject).allowance !== 0 || store.project(rehearsalProject).paused !== 1) { store.close(); throw new Error("CAPABILITY_SCOPE_OR_BUDGET_RESET"); }
  const records: any[] = []; let errorText: string | undefined;
  writeFileSync(started, JSON.stringify({ at: new Date().toISOString(), authorization, quote }), { flag: "wx", mode: 0o600 });
  try {
    store.authenticatedProjectCommand(signLocalOperator(root, { id: "capability-allowance", principal, project_id: rehearsalProject, action: "extend_allowance" as const, value: quote.allowance_micros, reason: authorization.operator_message }));
    store.authenticatedProjectCommand(signLocalOperator(root, { id: "capability-resume", principal, project_id: rehearsalProject, action: "resume" as const, value: 0, reason: "Only the explicitly authorized three perception fixtures" }));
    store.createTicket("perception-capability", rehearsalProject, "capability-inspector", {}, quote.allowance_micros, "AUTHOR", { maxTurns: 12, maxAttempts: 1 });
    const ctx = store.claim("perception-capability", "live-perception-inspector", 300000);
    const tools = await createSQLPerception({ kit, store, ctx, files: Object.values(fixtures), criteria: ["Describe visible spatial relationships, temporal motion, and any actual spoken words. Do not infer from filenames or invent unavailable perception."], maxCalls: quote.max_calls, estimateMicros: quote.estimate_micros_per_call });
    for (const kind of ["image", "video", "audio"] as const) {
      store.heartbeat(ctx, 300000); const runId = randomUUID(), start = Date.now();
      const invoke = traceCapability(traces.client, kind, runId, async () => tools.inspect(kind, fixtures[kind].sha256));
      const result = await invoke({ modality: kind, media_hash: fixtures[kind].sha256 });
      records.push({ kind, run_id: runId, elapsed_ms: Date.now() - start, result });
      assertCapability(kind, result);
    }
    await traces.client.awaitPendingTraceBatches(); if (traces.failures.length) throw new Error("LANGSMITH_TRACE_UPLOAD_FAILED");
    // Give asynchronous ingestion time before the single verification read; no failed API read is retried.
    await new Promise(resolve => setTimeout(resolve, 3000));
    for (const record of records) record.trace_url = await traces.client.getRunUrl({ run: await traces.client.readRun(record.run_id) });
  } catch (error) { errorText = String(error); throw error; }
  finally {
    store.authenticatedProjectCommand(signLocalOperator(root, { id: "capability-pause", principal, project_id: rehearsalProject, action: "pause" as const, value: 1, reason: "End capability test paused; no production media authority" }));
    writeFileSync(join(root, "capability-proof.json"), JSON.stringify({ status: errorText ? "BLOCKED" : "PASS", diagnostic: errorText ?? null, records, allowance: store.allowance(rehearsalProject), production_media_calls: 0, paused: true, verified_invoice_charges: null }, null, 2), { mode: 0o600, flag: "wx" });
    store.close(); assertPreserved(manifest.source, manifest.saved_production_hashes);
  }
  return { status: "PASS", modalities: records.map(r => r.kind), root };
}
export async function recoverCapabilityTraces(root: string) {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")); assertPreserved(manifest.source, manifest.saved_production_hashes);
  const proof = JSON.parse(readFileSync(join(root, "capability-proof.json"), "utf8"));
  if (proof.status !== "BLOCKED" || proof.diagnostic !== "Error: LANGSMITH_HTTP_404" || proof.records.length !== 3) throw new Error("EXACT_TRACE_RECOVERY_REQUIRED");
  const target = join(root, "capability-trace-recovery.json"); if (existsSync(target)) throw new Error("TRACE_RECOVERY_ALREADY_RECORDED");
  const store = new StudioProduction(root);
  try {
    if (store.project(rehearsalProject).paused !== 1 || JSON.stringify(store.allowance(rehearsalProject)) !== JSON.stringify(proof.allowance)) throw new Error("TRACE_RECOVERY_STATE_CHANGED");
    const fixtures = JSON.parse(readFileSync(join(root, "capability-fixtures/fixtures.json"), "utf8")), traces = await tracing();
    for (const record of proof.records) {
      assertCapability(record.kind, record.result);
      await traceCapability(traces.client, record.kind, record.run_id, async () => record.result, true)({ modality: record.kind, media_hash: fixtures[record.kind].sha256 });
    }
    await traces.client.awaitPendingTraceBatches(); if (traces.failures.length) throw new Error("LANGSMITH_TRACE_UPLOAD_FAILED");
    await new Promise(resolve => setTimeout(resolve, 3000));
    for (const record of proof.records) record.trace_url = await traces.client.getRunUrl({ run: await traces.client.readRun(record.run_id) });
    writeFileSync(target, JSON.stringify({ status: "PASS_WITH_TRACE_RECOVERY", original_diagnostic: proof.diagnostic, traces_recorded_after_execution: true, additional_perception_calls: 0, records: proof.records, allowance: store.allowance(rehearsalProject), paused: true, verified_invoice_charges: null }, null, 2), { mode: 0o600, flag: "wx" });
    return { status: "PASS_WITH_TRACE_RECOVERY", additional_perception_calls: 0, paused: true };
  } finally { store.close(); assertPreserved(manifest.source, manifest.saved_production_hashes); }
}
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { root: { type: "string" }, kit: { type: "string" }, authorization: { type: "string" } } });
  if (!values.root || !values.kit) throw new Error("Use prepare or run with --root --kit; run also needs --authorization.");
  const result = positionals[0] === "recover-traces" ? await recoverCapabilityTraces(resolve(values.root)) : positionals[0] === "prepare" ? await prepareCapability(resolve(values.root), resolve(values.kit)) : positionals[0] === "run" && values.authorization ? await runCapability(resolve(values.root), resolve(values.kit), resolve(values.authorization)) : (() => { throw new Error("NO_PAID_CALL_WITHOUT_AUTHORIZATION"); })();
  console.log(JSON.stringify(result, null, 2));
}
