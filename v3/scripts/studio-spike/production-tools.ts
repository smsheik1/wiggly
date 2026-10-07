import { tool } from "langchain";
import { z } from "zod";
import { StudioProduction, type WorkerLease } from "../../lib/studio-production.js";

/** Producer binds the lease; the model supplies only draft selection and evidence pointers. */
export function publicationTool(store: StudioProduction, ctx: WorkerLease) {
  return tool(({ draft_path, evidence_references }) => {
    if (!draft_path.startsWith("/drafts/")) throw new Error("DRAFT_PATH_REQUIRED");
    return store.publish(ctx, { draft_path: draft_path.slice("/drafts/".length), evidence_references });
  }, { name: "submit_candidate", description: "Publish your inspected exact draft candidate and end this author run. This is not director approval.", schema: z.object({ draft_path: z.string(), evidence_references: z.array(z.string()).min(1) }).strict(), returnDirect: true });
}
