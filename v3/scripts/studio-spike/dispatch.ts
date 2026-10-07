import { StudioProduction, type WorkerLease } from "../../lib/studio-production.js";
import { randomUUID } from "node:crypto";

/** A bounded producer batch, not a daemon or a second workflow state machine. */
export async function dispatchAssignments(store: StudioProduction, projectId: string, ticketIds: string[], run: (ctx: WorkerLease) => Promise<void>, concurrency = 2) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > store.project(projectId).max_workers) throw new Error("INVALID_DISPATCH_CONCURRENCY");
  if (new Set(ticketIds).size !== ticketIds.length || ticketIds.some(id => store.ticket(id).project_id !== projectId)) throw new Error("INVALID_DISPATCH_BATCH");
  const pending = [...ticketIds], receipts: { ticket: string; status: string }[] = [];
  let failure: unknown;
  await Promise.all(Array.from({ length: concurrency }, async (_, index) => {
    while (pending.length && !failure && !store.project(projectId).paused) {
      const ticket = pending.shift()!;
      let ctx: WorkerLease;
      try { ctx = store.claim(ticket, `batch-${randomUUID()}-${index}`, 300000); }
      catch (error: any) {
        if (["TICKET_ALREADY_CLAIMED", "WORKER_CAPACITY_BUSY", "STALE_INPUTS", "UNCERTAIN_OPERATION", "PROJECT_PAUSED"].includes(error.message)) { receipts.push({ ticket, status: error.message }); continue; }
        failure = error; break;
      }
      try { await run(ctx); receipts.push({ ticket, status: store.ticket(ticket).status }); }
      catch (error) {
        if (!failure) failure = error;
        // Stop new work immediately; in-flight workers stop at their next fenced boundary.
        store.operator(projectId, "pause", 1, { id: randomUUID(), actor: "trusted-producer", reason: "STOP: assignment execution failed" });
      }
    }
  }));
  if (failure) throw failure;
  return { receipts, undispatched: pending };
}
