import { McpServer, createMcpHandler, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { requireBearerAuth } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MCP_RESOURCE_URL, PROTECTED_RESOURCE_METADATA_URL } from "./hosted-auth";
import { MemoryFilmLedger, type LedgerResult, type Storyboard } from "./film-ledger";

type FilmLedger = {
  openUpload(accountId: string): { uploadUrl: string; expiresAt: string } | Promise<{ uploadUrl: string; expiresAt: string }>;
  submitDraft(accountId: string, input: { storyboard: Storyboard; confirm?: boolean; quoteId?: string }): LedgerResult | Promise<LedgerResult>;
  getDraft(accountId: string, jobId?: string): LedgerResult | Promise<LedgerResult>;
};
import { workosTokenVerifier } from "./workos-verifier";

const storyboardSchema = z.object({
  title: z.string(),
  subject: z.string(),
  beats: z.array(z.object({
    duration_sec: z.number(),
    action: z.string(),
    camera: z.string(),
    narration_line: z.string().optional(),
  })).describe("Exactly 7 beats. Wiggly does not add or remove beats."),
  characters: z.array(z.object({ name: z.string() })).describe("Names must match the photo labels exactly after trimming."),
  hero_props: z.array(z.object({ name: z.string() })).default([]),
});

const UPLOAD_DESCRIPTION = "Open a page where the person labels each photo. Returns uploadUrl and expiresAt. It does not open a window and it spends no credits. The person tells you when the upload is done. Call this before wiggly_submit_draft.";
const SUBMIT_DESCRIPTION = "Quote or start one 7-beat draft. Video is Seedance 2.5 at 480p and costs 21 credits per second. Each still costs 8 credits. Voice costs 1 credit per 100 characters. $19 grants 1900 credits. Omit confirm to get quote_id and the credit cost. Send confirm true with that quote_id only after the person says yes. A quote lasts 24 hours and is bound to this storyboard and the current photo labels. The same quote returns the same job. One job runs at a time. If the balance is short, the result is a purchase link and nothing renders.";
const DRAFT_DESCRIPTION = "Read the latest draft, or the job_id you pass. Stages are queued, lineup, beats, assembly, ready, and failed. Poll no faster than retryAfterSec and never faster than every 15 seconds. Speak up only when the stage changes. After two hours still running, tell the person the job_id and stage and stop. ready includes the video URL. failed includes an error you can repeat. A job that never reaches ready returns its credits.";

function toolResult(ok: boolean, payload: Record<string, unknown> | string) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    content: [{ type: "text" as const, text }],
    ...(typeof payload === "string" ? {} : { structuredContent: payload }),
    ...(ok ? {} : { isError: true as const }),
  };
}

export function createHostedMcp(ledger: FilmLedger) {
  return createMcpHandler(({ authInfo }) => {
    const accountId = String(authInfo?.extra?.sub ?? "");
    const server = new McpServer({ name: "wiggly", version: "1.0.0" });
    server.registerTool("wiggly_open_upload", {
      description: UPLOAD_DESCRIPTION,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    }, async () => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      return toolResult(true, await ledger.openUpload(accountId));
    });
    server.registerTool("wiggly_submit_draft", {
      description: SUBMIT_DESCRIPTION,
      inputSchema: z.object({
        storyboard: storyboardSchema,
        confirm: z.boolean().optional(),
        quote_id: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    }, async ({ storyboard, confirm, quote_id }) => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      const result = await ledger.submitDraft(accountId, {
        storyboard: storyboard as Storyboard,
        confirm,
        quoteId: quote_id,
      });
      return result.ok ? toolResult(true, result.data) : toolResult(false, result.message);
    });
    server.registerTool("wiggly_get_draft", {
      description: DRAFT_DESCRIPTION,
      inputSchema: z.object({ job_id: z.string().optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async ({ job_id }) => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      const result = await ledger.getDraft(accountId, job_id);
      return result.ok ? toolResult(true, result.data) : toolResult(false, result.message);
    });
    return server;
  }, { legacy: "reject" });
}

export function createMcpRoute(options?: { verifier?: OAuthTokenVerifier; ledger?: FilmLedger }) {
  const ledger = options?.ledger ?? new MemoryFilmLedger();
  const handler = createHostedMcp(ledger);
  const gate = requireBearerAuth({
    verifier: options?.verifier ?? workosTokenVerifier(),
    expectedResource: new URL(MCP_RESOURCE_URL),
    resourceMetadataUrl: PROTECTED_RESOURCE_METADATA_URL,
  });
  return {
    ledger,
    POST(request: Request) {
      return gate(request).then((auth) => {
        if (auth instanceof Response) return auth;
        return handler.fetch(request, { authInfo: auth });
      });
    },
  };
}
