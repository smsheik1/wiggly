import { ConvexHttpClient } from "convex/browser";
import { internal } from "../../convex/_generated/api";
import type { Storyboard, LedgerResult } from "./film-ledger";

function convexClient() {
  const url = process.env.V3_CONVEX_URL || process.env.NEXT_PUBLIC_V3_CONVEX_URL;
  const key = process.env.V3_CONVEX_DEPLOY_KEY;
  if (!url || !key) {
    throw new Error(
      "The MCP ledger cannot reach Convex. In the Convex dashboard for the v3 deployment, open Settings, create a deploy key, and set V3_CONVEX_URL and V3_CONVEX_DEPLOY_KEY on the server. Do not run npx convex deploy while convex/schema.ts is the discovery-only schema.",
    );
  }
  const client = new ConvexHttpClient(url) as ConvexHttpClient & {
    setAdminAuth(token: string): void;
  };
  client.setAdminAuth(key);
  return client;
}

function callInternal<T>(kind: "mutation" | "query", ref: unknown, args: Record<string, unknown>) {
  const client = convexClient();
  const run = client[kind] as (reference: unknown, arguments_: Record<string, unknown>) => Promise<T>;
  return run(ref, args);
}

export class ConvexFilmLedger {
  openUpload(accountId: string) {
    return callInternal<{ uploadUrl: string; expiresAt: string }>("mutation", internal.mcpFilm.openUpload, { workosUserId: accountId });
  }

  submitDraft(accountId: string, input: { storyboard: Storyboard; confirm?: boolean; quoteId?: string }) {
    return callInternal<LedgerResult>("mutation", internal.mcpFilm.submitDraft, {
      workosUserId: accountId,
      storyboard: input.storyboard,
      confirm: input.confirm,
      quoteId: input.quoteId,
    });
  }

  getDraft(accountId: string, jobId?: string) {
    return callInternal<LedgerResult>("query", internal.mcpFilm.getDraft, { workosUserId: accountId, jobId });
  }
}

export function getUploadSession(uploadId: string) {
  return callInternal<{ accountId: string; expiresAt: string } | null>("query", internal.mcpFilm.getUpload, { uploadId });
}

export function listActiveJobs() {
  return callInternal<Array<{ workosUserId: string; jobId: string; stage: string }>>("query", internal.mcpFilm.listActiveJobs, {});
}

export function exportAccount(workosUserId: string) {
  return callInternal<import("./film-ledger").Account>("query", internal.mcpFilm.exportAccount, { workosUserId });
}

export function importAccount(workosUserId: string, account: import("./film-ledger").Account) {
  return callInternal<null>("mutation", internal.mcpFilm.importAccount, { workosUserId, account });
}

export function saveUploadLabels(uploadId: string, labels: string[]) {
  return callInternal<null>("mutation", internal.mcpFilm.setPhotoLabels, { uploadId, labels });
}
