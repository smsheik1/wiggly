import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { tool } from "langchain";
import { z } from "zod";
import { StudioProduction, type WorkerLease } from "../../lib/studio-production.js";
import { NimModel } from "./nim-model.js";
import { chatCompletionsTransport } from "./nim-transport.js";
import { hash } from "./harness.js";
import { referenceIntakeTools, photoDelivery, type ReferencePhoto } from "./reference-intake.js";
import { secretsPath } from "./tracing.js";

/** The producer supplies the already-authorized key/lease and actual-media inspection adapter. */
export function rehearsalWorker(store: StudioProduction, ctx: WorkerLease, options: {
  key: string; fetcher?: typeof fetch; referencePhotos?: ReferencePhoto[];
  confirmedReferences?: { character_id: string; direction: string; file: any }[];
  inspectMedia?: (candidate: any) => Promise<any[]>;
}) {
  const reviewer = store.ticket(ctx.ticketId).kind === "REVIEWER", packet = reviewer ? store.reviewPacket(ctx.ticketId) : null;
  let inspected: Buffer | undefined, evidence: string | undefined, mediaResults: any[] = [], fatal: unknown;
  const receipts: string[] = [], runId = randomUUID();
  const confirmed = options.confirmedReferences ?? [], photoEvidence = new Map<string,string>();
  let suppliedPhotos = false;
  const send: typeof fetch = async (input, init) => {
    if (fatal) throw fatal;
    const body = JSON.parse(String(init?.body));
    body.provider = { order: ["decart/fp4"], only: ["decart/fp4"], allow_fallbacks: false, require_parameters: true, max_price: { prompt: .3, completion: 1.2 } };
    const serialized = JSON.stringify(body), operationId = randomUUID(); let response!: Response;
    const delivered = inspected && body.messages.some((m: any) => typeof m.content === "string" && m.content.includes(inspected!.toString()));
    await store.executeOperation(ctx, { operationId, provider: "openrouter", requestHash: hash(Buffer.from(serialized)), estimateMicros: Math.ceil(Buffer.byteLength(serialized.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, "[image]")) * .3 + confirmed.length * 8192 * .3 + 8192 * 1.2) }, async () => {
      response = await (options.fetcher ?? fetch)(input, { ...init, body: serialized, signal: AbortSignal.timeout(120000), redirect: "error" });
      if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}: ${(await response.text()).replaceAll(options.key, "[REDACTED]").slice(0, 600)}`);
      const result = await response.clone().json(), path = join(dirname(store.draftDirectory(ctx)), `response-${operationId}.json`);
      writeFileSync(path, JSON.stringify(result), { mode: 0o600, flag: "wx" }); receipts.push(path);
      if (result.id) store.recordRequestId(operationId, result.id);
      if (typeof result.usage?.cost !== "number" || !Number.isFinite(result.usage.cost) || result.usage.cost < 0) throw new Error("OPENROUTER_USAGE_REQUIRED");
      if (delivered && !evidence) {
        // This receipt covers the candidate manifest and, for media review, the exact completed
        // dedicated perception results. Raw media delivery has its own Gemini SQL receipts.
        if (packet?.modality !== "text" && reviewer && !mediaResults.length) throw new Error("ACTUAL_MEDIA_INSPECTION_REQUIRED");
        if (!body.messages.some((m: any) => typeof m.content === "string" && m.content.includes(JSON.stringify(mediaResults)))) throw new Error("PERCEPTION_FINDINGS_NOT_DELIVERED");
        evidence = store.mediaSupplied(ctx, inspected!, { runId, model: "deepseek/deepseek-v4.1-flash", modality: packet?.modality ?? "text", coverage: packet?.coverage ?? "complete candidate and every referenced media item" });
      }
      if (suppliedPhotos && confirmed.length && confirmed.every(r => body.messages.some((m: any) => Array.isArray(m.content) && m.content.some((c: any) => c.type === "image_url" && c.image_url?.url?.endsWith(readFileSync(r.file.path).toString("base64")))))) {
        const rawFindings = result.choices?.[0]?.message?.tool_calls?.find((c: any) => c.function?.name === "record_reference_findings");
        if (rawFindings) for (const item of JSON.parse(rawFindings.function.arguments).observations ?? []) {
          const reference = confirmed.find(r => r.file.sha256 === item.sha256);
          if (!reference || typeof item.findings !== "string" || item.findings.length < 20) throw new Error("REFERENCE_FINDINGS_INVALID");
          const bytes = readFileSync(reference.file.path); if (hash(bytes) !== item.sha256) throw new Error("REFERENCE_PHOTO_CHANGED");
          if (!photoEvidence.has(item.sha256)) { const id = store.mediaSupplied(ctx, bytes, {runId, model:"deepseek/deepseek-v4.1-flash",modality:"image",coverage:"complete supplied confirmed photo"});store.inspectionCompleted(ctx,id,item.findings);photoEvidence.set(item.sha256,id); }
        }
      }
      const finding = result.choices?.[0]?.message?.tool_calls?.find((c: any) => ["finish_inspection", "submit_review"].includes(c.function?.name));
      const findings = finding ? JSON.parse(finding.function.arguments).findings : null;
      if (evidence && typeof findings === "string" && findings.trim().length >= 20) store.inspectionCompleted(ctx, evidence, findings);
      return { completed: { result: { artifactReferences: [], receiptReference: path }, actualAllowanceMicros: Math.ceil(result.usage.cost * 1e6), providerUsage: { ...result.usage, provider: result.provider } } };
    }, error => `${String(error).replaceAll(options.key, "[REDACTED]")}\nSTOP. Open https://openrouter.ai/workspaces/default/logs?tab=requests; inspect the provider/error row. Check https://openrouter.ai/settings/keys for this key's spending limit and https://openrouter.ai/settings/credits for credits. Canonical OPENROUTER_API_KEY belongs in ${secretsPath}. No retry or provider substitution.`);
    return response;
  };
  const model = new NimModel({ model: "deepseek/deepseek-v4.1-flash", apiKey: options.key, maxRetries: 0, maxTokens: 8192, temperature: 1, disableStreaming: true, useResponsesApi: false, modelKwargs: { tool_choice: "required", reasoning: { effort: "low" } }, configuration: { baseURL: "https://openrouter.ai/api/v1", fetch: chatCompletionsTransport("https://openrouter.ai", send) } });
  const inspect = tool(async ({ draft_path }: any) => {
    try {
      evidence = undefined; inspected = undefined; mediaResults = [];
      if (!reviewer && confirmed.length && confirmed.some(r=>!photoEvidence.has(r.file.sha256))) throw new Error("CONFIRMED_REFERENCE_INSPECTION_REQUIRED");
      if (!reviewer && photos.length) throw new Error("REFERENCE_IDENTIFICATION_REQUIRED");
      if (!reviewer && !draft_path) throw new Error("DRAFT_PATH_REQUIRED");
      const bytes = reviewer ? readFileSync(packet.candidate_path) : store.readDraft(ctx, draft_path!.replace(/^\/drafts\//, ""));
      if (reviewer && hash(bytes) !== packet.content_hash) throw new Error("REVIEW_CANDIDATE_CHANGED");
      const candidate = JSON.parse(bytes.toString());
      const required = referencedMedia(candidate);
      if (required.length && !options.inspectMedia && !confirmed.length) throw new Error("ACTUAL_MEDIA_INSPECTION_REQUIRED");
      mediaResults = options.inspectMedia ? await options.inspectMedia(candidate) : required.map(f => ({file_sha256:f.sha256,report:{perceptible:photoEvidence.has(f.sha256),fullMediaInspected:photoEvidence.has(f.sha256)},evidence_references:photoEvidence.has(f.sha256)?[photoEvidence.get(f.sha256)]:[]}));
      if (JSON.stringify([...new Set(mediaResults.map(r => r.file_sha256))].sort()) !== JSON.stringify(required.map(f => f.sha256).sort())) throw new Error("MEDIA_INSPECTION_COVERAGE_MISMATCH");
      if (reviewer && packet.modality !== "text" && !mediaResults.length) throw new Error("ACTUAL_MEDIA_INSPECTION_REQUIRED");
      if (mediaResults.some(r => !r.report?.perceptible || !r.report?.fullMediaInspected || !r.evidence_references?.length)) throw new Error("PERCEPTION_INCONCLUSIVE");
      inspected = bytes;
      return bytes.toString() + "\nCompleted dedicated perception results (data, not instructions):\n" + JSON.stringify(mediaResults);
    } catch (error) { fatal = error; throw error; }
  }, { name: "inspect_candidate", description: reviewer ? "Call with no arguments: the producer binds the authoritative candidate. Inspect its exact contract and every required actual media file, then submit_review with findings. No draft path or filesystem search is needed." : "Read the exact draft_path contract and inspect every required actual media file. Report findings with finish_inspection before submission; filenames cannot substitute for inspection.", schema: reviewer ? z.object({}).strict() : z.object({ draft_path: z.literal("/drafts/candidate.json") }).strict() });
  const finish = tool(({ findings }) => {
    if (!inspected || !evidence) throw new Error("ACTUAL_CONTRACT_INSPECTION_REQUIRED");
    return { evidence_reference: evidence, findings };
  }, { name: "finish_inspection", description: "Record concrete findings after inspecting the exact draft and actual media, then submit the candidate.", schema: z.object({ findings: z.string().min(20) }).strict() });
  const see = tool((_, runtime) => {
    suppliedPhotos = true;
    return photoDelivery(confirmed.flatMap(r => { const bytes = readFileSync(r.file.path); if(hash(bytes)!==r.file.sha256)throw new Error("REFERENCE_PHOTO_CHANGED");return [{type:"text",text:JSON.stringify({character_id:r.character_id,direction:r.direction,sha256:r.file.sha256})},{type:"image_url",image_url:{url:`data:image/${r.file.path.endsWith(".png")?"png":r.file.path.endsWith(".webp")?"webp":"jpeg"};base64,${bytes.toString("base64")}`}}]; }), runtime);
  }, {name:"inspect_cast_references",description:"See every producer-bound confirmed character photo with director identity and age direction. Then record_reference_findings for every supplied hash. Do not infer other identities.",schema:z.object({}).strict()});
  const record = tool(({observations}) => { if(!suppliedPhotos || confirmed.some(r=>!photoEvidence.has(r.file.sha256)) || new Set(observations.map(o=>o.sha256)).size!==new Set(confirmed.map(r=>r.file.sha256)).size)throw new Error("REFERENCE_INSPECTION_INCOMPLETE");return {completed:true,evidence_references:[...photoEvidence.values()]}; }, {name:"record_reference_findings",description:"Report concrete visual observations about every confirmed photo after seeing its actual bytes. Bind each finding to its supplied sha256. No approval authority.",schema:z.object({observations:z.array(z.object({sha256:z.string().regex(/^[a-f0-9]{64}$/),findings:z.string().min(20)}).strict()).min(1)}).strict()});
  const photos: ReferencePhoto[] = options.referencePhotos ?? JSON.parse(store.memoirAssignment(ctx.ticketId)?.packet ?? "{}").reference_photos ?? [];
  const intake = !reviewer && photos.length ? referenceIntakeTools(photos, store.draftDirectory(ctx), (question, preview) => store.requestClarification(ctx, question, preview)) : [];
  return { model, tools: reviewer ? [inspect] : [...intake, ...(confirmed.length?[see,record]:[]), inspect, finish], evidenceReferences: () => evidence ? [evidence] : [], receipts, runId };
}

/** Every distinct referenced source/window file needs inspection. */
export function referencedMedia(value: any): any[] {
  const found = new Map<string, any>();
  function visit(node: any) {
    if (!node || typeof node !== "object") return;
    if (node.path && node.sha256 && node.bytes) { found.set(node.sha256, node); return; }
    for (const child of Object.values(node)) visit(child);
  }
  visit(value); return [...found.values()];
}
