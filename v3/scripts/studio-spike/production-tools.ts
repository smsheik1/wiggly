import { tool, createMiddleware } from "langchain";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { workspaceAgent } from "./harness.js";
import { z } from "zod";
import { StudioProduction, type WorkerLease } from "../../lib/studio-production.js";

/** Producer binds the lease; the model supplies only draft selection and evidence pointers. */
export function publicationTool(store: StudioProduction, ctx: WorkerLease, validate?: (bytes: Buffer) => Promise<string>, evidenceReferences?: () => string[]) {
  return tool(async ({ draft_path, evidence_references }) => {
    if (!draft_path.startsWith("/drafts/")) throw new Error("DRAFT_PATH_REQUIRED");
    const relative = draft_path.slice("/drafts/".length);
    const validated_hash = validate ? await validate(store.readDraft(ctx, relative)) : undefined;
    return store.publish(ctx, { draft_path: relative, evidence_references: evidenceReferences ? evidenceReferences() : evidence_references ?? [], validated_hash });
  }, { name: "submit_candidate", description: "Publish your inspected exact draft candidate and end this author run. This is not director approval.", schema: z.object({ draft_path: z.string(), evidence_references: z.array(z.string()).optional() }).strict(), returnDirect: true });
}

/** A separate reviewer run receives only its producer packet and this finishing tool. */
export function reviewTool(store: StudioProduction, ctx: WorkerLease, evidenceReferences?: () => string[]) {
  return tool(result => store.submitReview(ctx, { ...result, evidence_references: evidenceReferences ? evidenceReferences() : result.evidence_references ?? [] }), {
    name: "submit_review", description: "Finish independent review with findings and inspection evidence. Does not confer director approval.",
    schema: z.object({ verdict: z.enum(["PASS", "CHANGES_REQUESTED", "INCONCLUSIVE"]), findings: z.string().min(20), defects: z.array(z.object({ criterion: z.string().min(1), region: z.string().min(1), evidence: z.string().min(1) }).strict()), evidence_references: z.array(z.string()).optional(), direction_compatible: z.boolean().optional() }).strict(), returnDirect: true,
  });
}

/** Safety gates use native middleware; telemetry callbacks may swallow errors. */
export function productionMiddleware(store: StudioProduction, ctx: WorkerLease) {
  return createMiddleware({ name: "StudioProductionGuard", wrapModelCall: async (request, handler) => {
    store.beginTurn(ctx, randomUUID());
    return handler(request);
  } });
}

/** Bind the complete assignment harness so callers cannot omit its safety middleware. */
export function assignmentAgent(model: BaseChatModel, store: StudioProduction, ctx: WorkerLease, profileKey: string, systemPrompt: string) {
  const kind = store.ticket(ctx.ticketId).kind;
  const finish = kind === "AUTHOR" ? publicationTool(store, ctx) : reviewTool(store, ctx);
  return workspaceAgent(model, dirname(store.draftDirectory(ctx)), profileKey, ctx.workerId, [finish], systemPrompt, [productionMiddleware(store, ctx)]);
}
