import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { join, basename, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { tool } from "langchain";
import { z } from "zod";
import { askActiveAgent } from "../../lib/agent-bridge.js";
import { workspaceAgent, hash } from "./harness.js";
import { NimModel } from "./nim-model.js";
import { nimTransport } from "./nim-transport.js";
import { namedSecret, tracing, redact, secretsPath } from "./tracing.js";

const canonicalKit = "/Users/shaz/Projects/wiggly/v3/public/format-repositories/my-pixar-story-v1";
const modelName = "moonshotai/kimi-k3";
const output = join(import.meta.dirname, "output/phase2");
const reviewExisting = process.argv.includes("--review-existing");
const recoveryRoot = process.argv.find(arg => arg.startsWith("--recover-root="))?.slice(15);
const runRoot = recoveryRoot ? resolve(recoveryRoot) : join(output, randomUUID());
assert.ok(runRoot.startsWith(output + "/"), "Recovery must stay in the isolated Phase 2 output workspace");
const exec = promisify(execFile);

// Producer-authored test direction, unrelated to the paused memoir's facts/assets.
const criteria = "Create an empty, warm stylized 3D family kitchen background, 16:9, with believable room geography, readable counter/sink/stove placement and clear central floor space for later character staging. Soft morning light. No people, animals, human figures, faces in artwork/reflections, captions, logos or watermarks. This is an invented capability fixture, not a real memoir location.";
const reviewSchema = z.object({ verdict: z.enum(["PASS", "CHANGES_REQUESTED", "INCONCLUSIVE"]), findings: z.string().min(30), defects: z.array(z.object({ criterion: z.string(), region: z.string(), evidence: z.string() })) });

async function skill(root: string, name: string, body: string) {
  for (const dir of ["drafts", "references", "versions", `skills/${name}`]) await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, `skills/${name}/SKILL.md`), `---\nname: ${name}\ndescription: Complete this Phase 2 ${name} assignment.\n---\n${body}\n`);
}

// Thin isolated execution envelope around the existing kit's authoritative request builder.
// It never invokes or edits its production scheduler/checkpoints.
async function generate(prompt: string, root: string, reference?: string) {
  const { requestDescriptor, remediation } = await import("../../lib/memoir-policy.js");
  const n = reference ? 1 : 3;
  const planning = { locationId: "spike-kitchen", artifacts: [reference
    ? { key: "backgroundCandidates:spike-kitchen", valid: true, selection: 0, content: { files: [{ path: reference }] } }
    : { key: "backgroundBrief:spike-kitchen", valid: true, content: { references: [] } }] };
  const request = requestDescriptor(planning, { operation: reference ? "backgroundAngle" : "backgroundCandidates", estimatedCostUsd: n * .01, parameters: { prompt } });
  assert.equal(request.n, n);
  assert.equal(new URL(request.endpoint).origin, "https://api.meta.ai");
  const key = await namedSecret("META_API_KEY");
  const intent = { operation_id: randomUUID(), provider: "meta-muse", model: request.model, prompt, reference_sha256: reference ? hash(await readFile(reference)) : null, image_count: n, estimated_allowance_usd: n * .01, verified_charge_usd: null, price_source: "https://dev.meta.ai/models/muse-image" };
  await writeFile(join(root, "generation-intent.json"), JSON.stringify(intent, null, 2), { flag: "wx" });
  const { endpoint, images: references, ...body } = request;
  const images = await Promise.all(references.map(async (file: any) => ({ image_url: `data:image/webp;base64,${(await readFile(file.path)).toString("base64")}` })));
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...(images.length ? { images } : {}) }), signal: AbortSignal.timeout(180000), redirect: "error" });
  if (!response.ok) throw new Error(`Muse HTTP ${response.status}: ${(await response.text()).replaceAll(key, "[REDACTED]").slice(0, 500)}\n${remediation("meta-muse", secretsPath)}`);
  const result = await response.json();
  await writeFile(join(root, "provider-response.json"), JSON.stringify(result), { flag: "wx" });
  assert.ok(result.data?.length === n && result.data.every((item: any) => item.b64_json), "Muse must return exact base64 images; no remote fallback");
  const files = [];
  for (const [index, item] of result.data.entries()) {
    const path = join(root, `drafts/generated-${index}.webp`);
    const bytes = Buffer.from(item.b64_json, "base64");
    await writeFile(path, bytes, { flag: "wx" });
    const { stdout } = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", path]);
    const size = JSON.parse(stdout).streams[0];
    assertBackgroundDimensions(size);
    files.push({ path, sha256: hash(bytes), ...size });
  }
  await writeFile(join(root, "generation-result.json"), JSON.stringify({ ...intent, status: "COMPLETE", files, provider_request_id: response.headers.get("x-request-id") }, null, 2));
  return files;
}

async function runWorker(root: string, role: string, assignment: string, tools: any[], turnLimit: number, controller = new AbortController()) {
  const apiKey = await namedSecret("NVIDIA_API_KEY");
  const { client, tracer, failures } = await tracing();
  const id = randomUUID(), events: any[] = [], usage: any[] = [];
  let turns = 0, supplied: string[] = [];
  const deliveredMedia = new Set<string>();
  const transport = nimTransport(async (input, init) => {
    const request = JSON.parse(String(init?.body));
    supplied = request.messages.flatMap((m: any) => Array.isArray(m.content) ? m.content : []).filter((b: any) => b.type === "image_url").map((b: any) => hash(Buffer.from(b.image_url.url.split(",")[1], "base64")));
    for (const message of request.messages) for (const block of Array.isArray(message.content) ? message.content : []) if (block.type === "image_url") deliveredMedia.add(block.image_url.url.split(",")[1]);
    if (supplied.length) events.push({ status: "MEDIA_SUPPLIED", sha256: supplied });
    return fetch(input, init);
  });
  const model = new NimModel({ model: modelName, apiKey, maxRetries: 0, maxTokens: 4096, temperature: 1, disableStreaming: true, useResponsesApi: false, modelKwargs: { reasoning_effort: "high", tool_choice: "required" }, configuration: { baseURL: "https://integrate.api.nvidia.com/v1", fetch: transport } });
  const agent = workspaceAgent(model, root, `openai:${modelName}`, role, tools, "Operate only this assignment. Load the relevant skill. Inspect actual image bytes with read_file before submitting. No shell, delegation, production mutation, or director approval. Submit a complete outcome using the assigned finishing tool.");
  const start = Date.now();
  const callbacks = { name: "phase2-evidence", raiseError: true,
    handleChatModelStart() { assert.ok(++turns <= turnLimit, `${role} turn limit`); },
    handleLLMEnd(result: any) { const m = result.generations[0]?.[0]?.message; if (m?.usage_metadata) usage.push(m.usage_metadata); if (supplied.length) events.push({ status: "INSPECTION_RESPONSE", sha256: supplied, findings: m?.content, tool_calls: m?.tool_calls }); },
  };
  try {
    await askActiveAgent(assignment, { operatingAgent: prompt => agent.invoke({ messages: [{ role: "user", content: prompt }] }, { runId: id, callbacks: [tracer, callbacks], recursionLimit: 30, signal: AbortSignal.any([AbortSignal.timeout(180000), controller.signal]), metadata: { phase: 2, role, production: false, inference_provider: "NVIDIA NIM" } }) });
    await client.awaitPendingTraceBatches(); assert.deepEqual(failures, []);
    const trace = await client.readRun(id, { loadChildRuns: true });
    const serializedTrace = JSON.stringify(trace);
    for (const media of deliveredMedia) assert.ok(!serializedTrace.includes(media), "Raw inspected media leaked into LangSmith trace");
    const receipt = { id, role, model: modelName, turns, elapsed_ms: Date.now() - start, events, usage, url: await client.getRunUrl({ run: trace }), checkpoint_growth: "No checkpointer; not a persistence/recovery proof" };
    await writeFile(join(root, "worker-receipt.json"), JSON.stringify(receipt, null, 2));
    return receipt;
  } catch (error: any) {
    const causes: string[] = []; for (let e = error; e; e = e.cause) causes.push(String(e.message).replaceAll(apiKey, "[REDACTED]"));
    await writeFile(join(root, "worker-blocker.json"), JSON.stringify({ id, role, turns, usage, events, causes }, null, 2));
    throw new Error(causes.join(" → "));
  }
}

async function main() {
  await mkdir(runRoot, { recursive: true });
  await writeFile(join(runRoot, "allowance.json"), JSON.stringify({ authorized_m0_usd: 5, planned_image_allowance_usd: .04, nim_expected_cost_usd: 0, nim_source: "https://build.nvidia.com/moonshotai/kimi-k3", basis: "The Phase 1 five $1 holds were trial controls, not billed consumption. Reconciled against NVIDIA's documented free prototype endpoint and director's explicit free-NIM direction.", verified_provider_charges_usd: null }, null, 2));
  const author = join(runRoot, "author");
  await skill(author, "background-author", `${criteria}\nRead /references/recipe.md. Author your own complete image prompt and call generate_background once. It returns three drafts. Inspect them with read_file, choose the best conforming plate, and submit_candidate with its draft path, complete prompt and inspection findings. No self-issued independent review verdict. Skill marker: BACKGROUND-AUTHOR-204.`);
  await copyFile(join(canonicalKit, "background-prompter.md"), join(author, "references/recipe.md"));
  let generated: any[] = [], candidate: any;
  let priorTurns = 0;
  let authorReceipt: any;
  if (reviewExisting) {
    assert.ok(recoveryRoot, "Review continuation requires an existing isolated run");
    candidate = JSON.parse(await readFile(join(runRoot, "candidate.json"), "utf8"));
    assert.equal(hash(await readFile(candidate.path)), candidate.sha256);
    authorReceipt = JSON.parse(await readFile(join(author, "worker-receipt.json"), "utf8"));
    priorTurns = JSON.parse(await readFile(join(author, "worker-blocker.json"), "utf8")).turns;
  } else {
  if (recoveryRoot) {
    const intent = JSON.parse(await readFile(join(author, "generation-intent.json"), "utf8"));
    const blocker = JSON.parse(await readFile(join(author, "worker-blocker.json"), "utf8")); priorTurns = blocker.turns;
    const path = join(author, "drafts/generated-0.webp"), bytes = await readFile(path);
    const { stdout } = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", path]);
    const size = JSON.parse(stdout).streams[0]; assertBackgroundDimensions(size);
    generated = [{ path, sha256: hash(bytes), ...size }];
    await writeFile(join(author, "references/prior-generation.json"), JSON.stringify({ prompt: intent.prompt, available_drafts: ["/drafts/generated-0.webp"], known_retained_images: 1, requested_images: 3, diagnosis: "Exact-size validator stopped persistence after the first valid 16:9 image. Recover retained bytes only; do not resubmit generation." }, null, 2));
    await skill(author, "background-author", `${criteria}\nResume your previously authored prompt from /references/prior-generation.json. Inspect the available draft with read_file and submit_candidate using the exact prior prompt and your new inspection findings. No new generation is authorized or exposed. Skill marker: BACKGROUND-AUTHOR-204.`);
  }
  const authorController = new AbortController();
  const generation = tool(async ({ prompt }) => { assert.equal(generated.length, 0, "Only one authorized author batch"); try { generated = await generate(prompt, author); } catch (error) { authorController.abort(error); throw error; } return generated.map(f => ({ draft_path: `/drafts/${basename(f.path)}`, sha256: f.sha256 })); }, { name: "generate_background", description: "Generate the authorized three Muse background drafts from your authored prompt. One batch only.", schema: z.object({ prompt: z.string().min(40).max(5000) }) });
  const submit = tool(async ({ draft_path, prompt, findings, skill_marker }) => {
    assert.equal(skill_marker, "BACKGROUND-AUTHOR-204");
    const original = JSON.parse(await readFile(join(author, "generation-intent.json"), "utf8")); assert.equal(prompt, original.prompt, "Submission must retain the exact generation prompt");
    const file = generated.find(f => draft_path === `/drafts/${basename(f.path)}`); assert.ok(file, "Select a generated draft");
    const bytes = await readFile(file.path); assert.equal(hash(bytes), file.sha256, "Generated bytes changed");
    const path = join(runRoot, `candidate-${file.sha256}.webp`); await writeFile(path, bytes, { flag: "wx" });
    candidate = { path, sha256: file.sha256, prompt, findings, status: "CANDIDATE_NOT_DIRECTOR_APPROVED" };
    await writeFile(join(runRoot, "candidate.json"), JSON.stringify(candidate, null, 2)); return candidate;
  }, { name: "submit_candidate", description: "Finish authorship by submitting your inspected exact candidate. Does not approve production.", schema: z.object({ draft_path: z.string(), prompt: z.string(), findings: z.string().min(30), skill_marker: z.string() }), returnDirect: true });
  authorReceipt = await runWorker(author, "background-author", "Produce the background defined by the background-author skill. This isolated M0 test authorizes one three-image batch at an estimated $0.03 within the existing $5 allowance. Submit only after actual inspection.", [...(recoveryRoot ? [] : [generation]), submit], 8 - priorTurns, authorController);
  assert.ok(candidate, "Author did not submit");
  assert.ok(authorReceipt.events.some((e: any) => e.status === "INSPECTION_RESPONSE" && e.sha256.includes(candidate.sha256)), "Candidate was not actually inspected");
  }
  const reviews: any[] = [];
  const review = async (file: string, label: string) => {
    const root = join(runRoot, reviewExisting ? `${label}-diagnostic-${randomUUID().slice(0, 8)}` : label); let verdict: any;
    await skill(root, "background-review", `Independently inspect the producer packet and actual image. Judge the stated criteria, not taste. Defects must name observable evidence and coarse spatial region. Missing perception is INCONCLUSIVE. Submit_review once; PASS requires no defects. Skill marker: REVIEWER-INDEPENDENT-512.`);
    const bytes = await readFile(file), sha256 = hash(bytes);
    await writeFile(join(root, "references/candidate.webp"), bytes);
    await writeFile(join(root, "references/packet.json"), JSON.stringify({ criteria, candidate_sha256: sha256, inspection_coverage: "Complete frame", director_approval: false }, null, 2));
    const finish = tool(async (result) => { assert.ok(result.verdict !== "PASS" || result.defects.length === 0); verdict = { ...result, candidate_sha256: sha256, independently_reviewed: true, director_approved: false }; return verdict; }, { name: "submit_review", description: "Finish independent review of the exact packet candidate.", schema: reviewSchema, returnDirect: true });
    const receipt = await runWorker(root, "independent-background-reviewer", "Load the review skill and /references/packet.json. Inspect /references/candidate.webp and submit your evidence-based verdict. Do not infer the verdict from any filename or author claims.", [finish], 4);
    assert.ok(verdict, "Reviewer ended without submit_review; inspect its trace, do not infer acceptance");
    await writeFile(join(root, "verdict.json"), JSON.stringify(verdict, null, 2));
    assert.ok(receipt.events.some(e => e.status === "INSPECTION_RESPONSE" && e.sha256.includes(sha256)));
    reviews.push({ ...verdict, receipt }); return verdict;
  };
  const positive = await review(candidate.path, "review-A");
  // Operating Codex authored this deliberate negative-test prompt; it is not production repair.
  const negativeRoot = join(runRoot, "negative-fixture"); await mkdir(join(negativeRoot, "drafts"), { recursive: true });
  const negative = (await generate("Preserve this exact stylized kitchen, room layout and camera. Add one clearly visible adult cartoon human standing upright in the open center floor, full body and face visible, about one third of the frame height. This is a deliberate figure-containing test fixture. Keep the rest of the kitchen unchanged.", negativeRoot, candidate.path))[0];
  const rejection = await review(negative.path, "review-B");
  const report = { prior_author_turns: priorTurns, recovered_partial_batch: !!recoveryRoot, status: positive.verdict === "PASS" && rejection.verdict === "CHANGES_REQUESTED" && rejection.defects.some((d: any) => /person|people|human|figure|character/i.test(d.evidence + d.criterion)) ? "M0_ASSIGNMENT_PASSED" : "M0_ASSIGNMENT_FAILED", run_root: runRoot, candidate, negative_fixture: negative, author_receipt: authorReceipt, reviews, estimated_image_allowance_usd: .04, verified_charges_usd: null, production_paused: true, no_director_approval: true, no_m1_started: true };
  await writeFile(join(runRoot, "report.json"), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, run_root: runRoot, candidate: candidate.path, positive: positive.verdict, negative: rejection.verdict }));
}

export function assertBackgroundDimensions(size: { width: number; height: number }) {
  assert.ok(size.width >= 1024 && size.height >= 576 && Math.abs(size.width / size.height - 16 / 9) < .01, "Background must be a usable 16:9 landscape image");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(async (error: Error) => { await mkdir(runRoot, { recursive: true }); await writeFile(join(runRoot, "blocker.json"), JSON.stringify({ status: "STOPPED", error: error.message }, null, 2)); console.error(`STOP: Phase 2: ${error.message}\nNo retry or substitute provider. Evidence: ${runRoot}`); process.exitCode = 1; });
