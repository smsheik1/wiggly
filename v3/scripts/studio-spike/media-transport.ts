import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { StudioProduction, type WorkerLease } from "../../lib/studio-production.js";
import { hash } from "./harness.js";
import { secretsPath } from "./tracing.js";

type Format = { kit: string; media: any };
export type AuthorizedMediaRequest = {
  operationId: string; provider: "cartesia" | "meta-muse" | "replicate";
  estimateMicros: number; plan: any; request: any;
};

/** Host-only adapter: SQL owns authorization; the shared transport owns provider bytes. */
export async function executeAuthorizedMedia(format: Format, store: StudioProduction, ctx: WorkerLease, authorized: AuthorizedMediaRequest, fetcher: typeof fetch = fetch) {
  if (authorized.plan.provider !== authorized.provider) throw new Error("PROVIDER_BINDING_MISMATCH");
  const transport = await import(pathToFileURL(join(format.kit, "runtime/providers.mjs")).href);
  const requestHash = hash(Buffer.from(JSON.stringify({ plan: authorized.plan, request: authorized.request })));
  const directory = join(store.root, "provider-media"); mkdirSync(directory, { recursive: true });
  const job = { id: authorized.operationId, digest: requestHash, plan: authorized.plan, request: authorized.request };
  const pin = (value: any): any => {
    if (!value || typeof value !== "object") return value;
    if (value.path && value.sha256 && value.bytes) {
      const bytes = readFileSync(value.path); if (hash(bytes) !== value.sha256) throw new Error("PROVIDER_MEDIA_CHANGED");
      return { ...value, ...store.pinMedia(ctx, bytes, extname(value.path)) };
    }
    return Array.isArray(value) ? value.map(pin) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, pin(child)]));
  };
  const receiptPath = join(directory, "receipts", job.id, "sql-result.json");
  const settlement = (result: any) => ({ result: { artifactReferences: [...mediaPaths(result)], receiptReference: receiptPath }, providerUsage: { reported: null, basis: "provider did not report currency usage; allowance retains request estimate" } });
  const requestId = (value: string) => store.recordRequestId(job.id, value);
  const invoke = async (collectOnly: boolean) => {
    // Keys are read only after the SQL gate permits this call.
    const key = await transport.loadKey(authorized.provider, secretsPath);
    try { store.heartbeat(ctx, 300000); return await transport.executeMediaRequest(job, directory, key, fetcher, collectOnly, requestId); }
    catch (error) { throw new Error(String(error).replaceAll(key, "[REDACTED]")); }
  };
  let result: any;
  let leaseError: unknown;
  const timer = setInterval(() => { try { store.heartbeat(ctx, 300000); } catch (error) { leaseError = error; } }, 30000);
  try {
    let existing;
    try { existing = store.operation(job.id); } catch (error) { if (!String(error).includes("OPERATION_NOT_FOUND")) throw error; }
    if (existing) {
      if (existing.request_hash !== requestHash || existing.ticket_id !== ctx.ticketId || existing.attempt_id !== ctx.attemptId || existing.provider !== authorized.provider || existing.estimate !== authorized.estimateMicros) throw new Error("OPERATION_REPLAY_CONFLICT");
      if (existing.state === "COMPLETED") { const saved = readFileSync(receiptPath); const value = JSON.parse(saved.toString()); if (value.operation_id !== job.id || value.request_hash !== requestHash || value.result_hash !== hash(Buffer.from(JSON.stringify(value.result)))) throw new Error("MEDIA_RECEIPT_CHANGED"); await format.media.verifyFiles(value.result); return value.result; }
      if (!existing.request_id || existing.state !== "SUBMITTED") throw new Error("RECONCILE_INSTEAD_OF_RESUBMIT");
      store.heartbeat(ctx, 300000);
      try {
        result = await invoke(true);
        if (!result.pending) { if (leaseError) throw leaseError; result = pin(result); save(result); store.completeOperation(job.id, settlement(result)); }
      } catch (error) { store.failOperation(job.id, String(error)); throw error; }
      return result;
    } else {
      await store.executeOperation(ctx, { operationId: job.id, provider: authorized.provider, requestHash, estimateMicros: authorized.estimateMicros }, async () => {
        result = await invoke(false);
        if (result.pending) return { requestId: result.providerJobId };
        if (leaseError) throw leaseError; result = pin(result); save(result);
        return { completed: settlement(result) };
      }, error => `${error}\n${transport.remediation(authorized.provider, secretsPath)}`);
      return result;
    }
  } finally { clearInterval(timer); }
  function save(result: any) { mkdirSync(dirname(receiptPath), { recursive: true }); const value = JSON.stringify({ operation_id: job.id, request_hash: requestHash, result_hash: hash(Buffer.from(JSON.stringify(result))), result }); if (existsSync(receiptPath)) { if (readFileSync(receiptPath, "utf8") !== value) throw new Error("MEDIA_RECEIPT_CHANGED"); } else writeFileSync(receiptPath, value, { mode: 0o600, flag: "wx" }); }
}
function* mediaPaths(value: any): Generator<string> {
  if (!value || typeof value !== "object") return;
  if (value.path && value.sha256 && value.bytes) { yield value.path; return; }
  for (const child of Object.values(value)) yield* mediaPaths(child);
}
