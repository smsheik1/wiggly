import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { StudioProduction, type WorkerLease } from "../../lib/studio-production.js";
import { hash } from "./harness.js";
import { secretsPath } from "./tracing.js";

type MediaFile = { path: string; sha256: string; bytes: number; width?: number; height?: number; durationSeconds?: number; fps?: number };
/** Perception operates on an explicit producer packet, never an agent-supplied host path. */
export async function createSQLPerception(options: {
  kit: string; store: StudioProduction; ctx: WorkerLease; files: MediaFile[];
  criteria: string[]; maxCalls: number; estimateMicros: number;
  fetcher?: typeof fetch; mockSecretsPath?: string;
}) {
  const { store, ctx } = options, module = await import(pathToFileURL(join(options.kit, "runtime/gemini-review.mjs")).href);
  const files = new Map(options.files.map(file => [file.sha256, file]));
  if (options.mockSecretsPath && !options.fetcher) throw new Error("MOCK_TRANSPORT_REQUIRED");
  const directory = join(store.root, "perception", ctx.attemptId); mkdirSync(directory, { recursive: true });
  let busy = false, networkCall = 0;
  const network: typeof fetch = async (url, init) => {
    const parsed = new URL(String(url));
    if (parsed.origin !== "https://generativelanguage.googleapis.com") throw new Error("PERCEPTION_ENDPOINT_DENIED");
    const inference = parsed.pathname === "/v1beta/interactions" && init?.method === "POST";
    const body = String(init?.body ?? ""), requestBytes = Buffer.isBuffer(init?.body) ? init.body : Buffer.from(body);
    const requestHash = hash(Buffer.concat([Buffer.from(`${init?.method ?? "GET"}\n${parsed.href}\n`), requestBytes]));
    const operationId = `perception-${hash(Buffer.from(ctx.attemptId + requestHash + (inference ? "" : `-${networkCall++}`)))}`;
    const path = join(directory, `${operationId}.json`);
    let response!: Response;
    await store.executeOperation(ctx, { operationId, provider: "gemini", requestHash, estimateMicros: inference ? options.estimateMicros : 0 }, async () => {
      response = await (options.fetcher ?? fetch)(url, init);
      const key = new Headers(init?.headers).get("x-goog-api-key") ?? "";
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${(await response.text()).replaceAll(key || "[no-key]", "[REDACTED]").slice(0, 600)}`);
      const responseText = await response.clone().text(), value = responseText ? JSON.parse(responseText) : {};
      writeFileSync(path, JSON.stringify(value), { mode: 0o600, flag: "wx" });
      const usage = value.usage ?? value.usage_metadata ?? value.usageMetadata ?? null;
      const input = usage?.total_input_tokens ?? usage?.input_tokens ?? usage?.promptTokenCount;
      const output = usage?.total_output_tokens ?? usage?.output_tokens;
      const known = inference && Number.isSafeInteger(input) && input >= 0 && Number.isSafeInteger(output) && output >= 0;
      return { ...(inference && value.id ? { requestId: value.id } : {}), completed: {
        result: { artifactReferences: [], receiptReference: path },
        ...(known ? { actualAllowanceMicros: Math.ceil(input * .75 + output * 3.75) } : !inference ? { actualAllowanceMicros: 0 } : {}),
        providerUsage: { reported: usage, cost_basis: known ? "reported tokens at dated published rate; not invoice charge" : inference ? "request estimate; token usage unavailable" : "metadata/upload request; no inference" },
      } };
    }, error => `${error}\nSTOP. Check https://aistudio.google.com/usage for this key's quota/billing and https://aistudio.google.com/api-keys for access. Canonical GEMINI_API_KEY belongs in ${secretsPath}; no fallback or retry.`);
    return response;
  };
  const tools = module.createGeminiReviewTools({ secretsPath: options.mockSecretsPath ?? secretsPath, receiptDirectory: directory, maxCalls: options.maxCalls, fetcher: network, afterResponse: ({ requestDigest, media }: { requestDigest: string; media: { type: string; bytes: Buffer; sha256: string }[] }) => {
    const evidence = media.map(part => ({ sha256: part.sha256, id: store.mediaSupplied(ctx, part.bytes, { runId: requestDigest, model: module.GEMINI_REVIEW_MODEL, modality: part.type, coverage: part.type === "image" ? "complete supplied image" : "complete supplied media at configured sampling profile" }) }));
    const serialized = JSON.stringify({ requestDigest, evidence });
    writeFileSync(join(directory, `${requestDigest}-bindings.json`), JSON.stringify({ serialized, sha256: hash(Buffer.from(serialized)) }), { mode: 0o600, flag: "wx" });
  } });
  return {
    async inspect(kind: "image" | "video" | "audio", sha256: string) {
      const file = files.get(sha256); if (!file) throw new Error("PERCEPTION_SCOPE_DENIED");
      if (hash(readFileSync(file.path)) !== file.sha256) throw new Error("INSPECTION_MEDIA_CHANGED");
      if ((kind === "image" && (!file.width || file.durationSeconds)) || (kind === "video" && (!file.width || !file.durationSeconds)) || (kind === "audio" && (!file.durationSeconds || file.width))) throw new Error("PERCEPTION_MODALITY_MISMATCH");
      if (busy) throw new Error("CONCURRENT_INSPECTION_DENIED");
      busy = true;
      try {
      const fn = kind === "image" ? tools.viewImage : kind === "video" ? tools.watchVideo : tools.listenAudio;
      const result = await fn({ file, worker: { workerId: ctx.workerId, name: ctx.workerId }, task: { taskId: ctx.ticketId, step: kind, artifact: { content: { files: [file] } }, criteria: options.criteria } });
      // A cached response reuses its recorded delivery evidence; it cannot invent a new delivery.
      const binding = JSON.parse(readFileSync(join(directory, `${result.requestDigest}-bindings.json`), "utf8"));
      if (hash(Buffer.from(binding.serialized)) !== binding.sha256) throw new Error("INSPECTION_BINDING_CHANGED");
      const value = JSON.parse(binding.serialized);
      if (value.requestDigest !== result.requestDigest || !value.evidence.some((e: any) => e.sha256 === file.sha256)) throw new Error("INSPECTION_BINDING_MISMATCH");
      const supplied = value.evidence.map((e: any) => e.id);
      for (const id of supplied) store.inspectionCompleted(ctx, id, JSON.stringify(result.report));
      const receipt = { ...result, evidence_references: supplied };
      writeFileSync(join(directory, `${randomUUID()}-inspection.json`), JSON.stringify(receipt), { mode: 0o600, flag: "wx" });
      return receipt;
      } finally { busy = false; }
    },
  };
}
