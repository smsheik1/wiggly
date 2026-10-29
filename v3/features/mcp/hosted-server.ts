import { McpServer, createMcpHandler, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { requireBearerAuth } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MCP_RESOURCE_URL, PROTECTED_RESOURCE_METADATA_URL } from "./hosted-auth";
import { approveDraft, studioStatusFromFile, type StudioState } from "./draft-worker";
import { MemoryFilmLedger, type Account, type LedgerResult, type Storyboard } from "./film-ledger";

type FilmLedger = {
  openUpload(accountId: string): { uploadUrl: string; expiresAt: string } | Promise<{ uploadUrl: string; expiresAt: string }>;
  submitDraft(accountId: string, input: { storyboard: Storyboard; confirm?: boolean; quoteId?: string }): LedgerResult | Promise<LedgerResult>;
  getDraft(accountId: string, jobId?: string): LedgerResult | Promise<LedgerResult>;
};
import { workosTokenVerifier } from "./workos-verifier";

const storyboardSchema = z.object({
  format: z.string().optional().describe("Format id. Defaults to my-pixar-story. The worker starts that format's studio on the server."),
  title: z.string(),
  subject: z.string(),
  beats: z.array(z.object({
    duration_sec: z.number(),
    action: z.string(),
    camera: z.string(),
    narration_line: z.string().optional(),
  })).describe("Exactly 7 beats. Wiggly does not add or remove beats."),
  characters: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
  })).describe("Names must match the photo labels exactly after trimming. The v2 crew writes the character prompts from these names and the photos."),
  hero_props: z.array(z.object({ name: z.string() })).default([]),
});

const UPLOAD_DESCRIPTION = "Open a page where the person labels each photo. Returns uploadUrl and expiresAt. It does not open a window and it spends no credits. The person tells you when the upload is done. Call this before wiggly_submit_draft.";
const SUBMIT_DESCRIPTION = "Start one film. The person buys credits and creates. Each Nano Banana 2.1 still costs 8 credits and each Seedance 2.5 second at 480p costs 21 credits, taken when that call happens. Voice costs 1 credit per 100 characters. $19 grants 1900 credits. There is no quote. One job runs at a time. If the balance hits zero, the run pauses and the result is a top-up link.";
const DRAFT_DESCRIPTION = "Read the latest draft, or the job_id you pass. The status comes from the v2 run's outputs/state.json. Poll no faster than retryAfterSec and never faster than every 15 seconds. Speak up only when the stage changes. awaiting-approval is a pause for the person. ready includes the video URL. failed includes an error you can repeat. A job that never reaches ready returns the credits it spent.";
const APPROVE_DESCRIPTION = "Approve the paused v2 gate. Pass job_id and the gate decision. An asset approval sends approvedAssets. An animatic or production approval sends decision approve. The same run resumes. If the balance cannot cover the next stills or Seedance seconds, the run stays paused and the result is the top-up link.";

function toolResult(ok: boolean, payload: Record<string, unknown> | string) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    content: [{ type: "text" as const, text }],
    ...(typeof payload === "string" ? {} : { structuredContent: payload }),
    ...(ok ? {} : { isError: true as const }),
  };
}

export function createHostedMcp(ledger: FilmLedger, hooks?: {
  resumeGraph?: (resume: { runId: string; decision: Record<string, unknown> }) => Promise<{ state: StudioState }>;
  loadAccount?: (accountId: string) => Promise<Account>;
  saveAccount?: (accountId: string, account: Account) => Promise<void>;
}) {
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
      if (!result.ok) return toolResult(false, result.message);
      return toolResult(true, { ...result.data, ...(await studioStatusFromFile(result.data.state_file)) });
    });
    server.registerTool("wiggly_approve_draft", {
      description: APPROVE_DESCRIPTION,
      inputSchema: z.object({
        job_id: z.string(),
        decision: z.record(z.string(), z.unknown()),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    }, async ({ job_id, decision }) => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      const memory = new MemoryFilmLedger();
      const direct = ledger as MemoryFilmLedger;
      if (typeof direct.exportState === "function") {
        memory.importState(accountId, direct.exportState(accountId));
      } else if (hooks?.loadAccount) {
        memory.importState(accountId, await hooks.loadAccount(accountId));
      } else {
        return toolResult(false, "This server cannot load the film account to approve it.");
      }
      const result = await approveDraft({
        ledger: memory,
        accountId,
        jobId: job_id,
        decision,
        ...(hooks?.resumeGraph ? { resumeGraph: hooks.resumeGraph } : {}),
      });
      if (typeof direct.importState === "function") direct.importState(accountId, memory.exportState(accountId));
      else if (hooks?.saveAccount) await hooks.saveAccount(accountId, memory.exportState(accountId));
      return result.ok ? toolResult(true, result.data) : toolResult(false, result.message);
    });
    return server;
  }, { legacy: "reject" });
}

export function createMcpRoute(options?: {
  verifier?: OAuthTokenVerifier;
  ledger?: FilmLedger;
  resumeGraph?: (resume: { runId: string; decision: Record<string, unknown> }) => Promise<{ state: StudioState }>;
  loadAccount?: (accountId: string) => Promise<Account>;
  saveAccount?: (accountId: string, account: Account) => Promise<void>;
}) {
  const ledger = options?.ledger ?? new MemoryFilmLedger();
  const handler = createHostedMcp(ledger, options);
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
