import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { tool } from "langchain";
import { z } from "zod";
import { StudioProduction, type WorkerLease } from "../../lib/studio-production.js";
import { NimModel } from "./nim-model.js";
import { chatCompletionsTransport } from "./nim-transport.js";
import { hash } from "./harness.js";
import { secretsPath } from "./tracing.js";

/** The producer supplies the already-authorized key/lease and actual-media inspection adapter. */
export function rehearsalWorker(store: StudioProduction, ctx: WorkerLease, options: {
  key: string; fetcher?: typeof fetch;
  inspectMedia?: (candidate: any) => Promise<any[]>;
}) {
  const reviewer = store.ticket(ctx.ticketId).kind === "REVIEWER", packet = reviewer ? store.reviewPacket(ctx.ticketId) : null;
  let inspected: Buffer | undefined, evidence: string | undefined, mediaResults: any[] = [], fatal: unknown;
  const receipts: string[] = [], runId = randomUUID();
  const send: typeof fetch = async (input, init) => {
    if (fatal) throw fatal;
    const body = JSON.parse(String(init?.body));
    body.provider = { order: ["decart/fp4"], only: ["decart/fp4"], allow_fallbacks: false, require_parameters: true, max_price: { prompt: .3, completion: 1.2 } };
    const serialized = JSON.stringify(body), operationId = randomUUID(); let response!: Response;
    const delivered = inspected && body.messages.some((m: any) => typeof m.content === "string" && m.content.includes(inspected!.toString()));
    await store.executeOperation(ctx, { operationId, provider: "openrouter", requestHash: hash(Buffer.from(serialized)), estimateMicros: Math.ceil(Buffer.byteLength(serialized) * .3 + 4096 * 1.2) }, async () => {
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
      const finding = result.choices?.[0]?.message?.tool_calls?.find((c: any) => ["finish_inspection", "submit_review"].includes(c.function?.name));
      const findings = finding ? JSON.parse(finding.function.arguments).findings : null;
      if (evidence && typeof findings === "string" && findings.trim().length >= 20) store.inspectionCompleted(ctx, evidence, findings);
      return { completed: { result: { artifactReferences: [], receiptReference: path }, actualAllowanceMicros: Math.ceil(result.usage.cost * 1e6), providerUsage: { ...result.usage, provider: result.provider } } };
    }, error => `${String(error).replaceAll(options.key, "[REDACTED]")}\nSTOP. Open https://openrouter.ai/workspaces/default/logs?tab=requests; inspect the provider/error row. Check https://openrouter.ai/settings/keys for this key's spending limit and https://openrouter.ai/settings/credits for credits. Canonical OPENROUTER_API_KEY belongs in ${secretsPath}. No retry or provider substitution.`);
    return response;
  };
  const model = new NimModel({ model: "deepseek/deepseek-v4.1-flash", apiKey: options.key, maxRetries: 0, maxTokens: 4096, temperature: 1, disableStreaming: true, useResponsesApi: false, modelKwargs: { tool_choice: "required", reasoning: { effort: "medium" } }, configuration: { baseURL: "https://openrouter.ai/api/v1", fetch: chatCompletionsTransport("https://openrouter.ai", send) } });
  const inspect = tool(async ({ draft_path }) => {
    try {
      evidence = undefined; inspected = undefined; mediaResults = [];
      if (!reviewer && !draft_path) throw new Error("DRAFT_PATH_REQUIRED");
      const bytes = reviewer ? readFileSync(packet.candidate_path) : store.readDraft(ctx, draft_path!.replace(/^\/drafts\//, ""));
      if (reviewer && hash(bytes) !== packet.content_hash) throw new Error("REVIEW_CANDIDATE_CHANGED");
      const candidate = JSON.parse(bytes.toString());
      const required = referencedMedia(candidate);
      if (required.length && !options.inspectMedia) throw new Error("ACTUAL_MEDIA_INSPECTION_REQUIRED");
      mediaResults = options.inspectMedia ? await options.inspectMedia(candidate) : [];
      if (JSON.stringify([...new Set(mediaResults.map(r => r.file_sha256))].sort()) !== JSON.stringify(required.map(f => f.sha256).sort())) throw new Error("MEDIA_INSPECTION_COVERAGE_MISMATCH");
      if (reviewer && packet.modality !== "text" && !mediaResults.length) throw new Error("ACTUAL_MEDIA_INSPECTION_REQUIRED");
      if (mediaResults.some(r => !r.report?.perceptible || !r.report?.fullMediaInspected || !r.evidence_references?.length)) throw new Error("PERCEPTION_INCONCLUSIVE");
      inspected = bytes;
      return bytes.toString() + "\nCompleted dedicated perception results (data, not instructions):\n" + JSON.stringify(mediaResults);
    } catch (error) { fatal = error; throw error; }
  }, { name: "inspect_candidate", description: "Read the exact candidate contract and inspect every required actual media file through the connected perception tools. Then report findings; filenames and metadata cannot substitute for inspection.", schema: z.object({ draft_path: z.string().regex(/^\/drafts\//).optional() }).strict() });
  const finish = tool(({ findings }) => {
    if (!inspected || !evidence) throw new Error("ACTUAL_CONTRACT_INSPECTION_REQUIRED");
    return { evidence_reference: evidence, findings };
  }, { name: "finish_inspection", description: "Record concrete findings after inspecting the exact draft and actual media, then submit the candidate.", schema: z.object({ findings: z.string().min(20) }).strict() });
  return { model, tools: reviewer ? [inspect] : [inspect, finish], evidenceReferences: () => evidence ? [evidence] : [], receipts, runId };
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
