import path from "node:path";
import { McpServer, createMcpHandler, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { requireBearerAuth } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MCP_RESOURCE_URL, PROTECTED_RESOURCE_METADATA_URL } from "./hosted-auth";
import { approveDraft, studioStatusFromFile, type CrewPhoto, type StudioState } from "./draft-worker";
import { draftMedia } from "./render-stage";
import { ensureWritingState, runWritingJob, WRITING_JOBS, type GateImage, type WritingJob } from "./gate-tools";
import { MemoryFilmLedger, type Account, type LedgerResult, type Storyboard } from "./film-ledger";

type FilmLedger = {
  openUpload(accountId: string): { uploadUrl: string; expiresAt: string } | Promise<{ uploadUrl: string; expiresAt: string }>;
  submitDraft(accountId: string, input: { storyboard: Storyboard; confirm?: boolean; quoteId?: string }): LedgerResult | Promise<LedgerResult>;
  getDraft(accountId: string, jobId?: string): LedgerResult | Promise<LedgerResult>;
};
import { workosTokenVerifier } from "./workos-verifier";

const storyboardSchema = z.object({
  format: z.string().min(1).describe("Required format id. Installed formats: my-pixar-story."),
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
    skinTone: z.string().min(3).describe("Skin tone you write after looking at the photo. At least 3 characters. Do not ask the person to type this."),
    description: z.string().min(10).describe("Look you write after looking at the photo. At least 10 characters. Do not ask the person to type this."),
  })).describe("Names must match the photo labels exactly after trimming. The v2 crew writes the character prompts from these names, skin tones, descriptions, and photos."),
  hero_props: z.array(z.object({ name: z.string() })).default([]),
});

const UPLOAD_DESCRIPTION = "Open a page where the person labels each photo. Returns uploadUrl and expiresAt. It does not open a window and it spends no credits. The person tells you when the upload is done. Then call wiggly_list_uploads.";
const LIST_UPLOADS_DESCRIPTION = "After the person says the upload is done, return each label and a signed URL. Look at each photo. You write skinTone and description. Do not ask the person to type them. Then call wiggly_submit_draft.";
const SUBMIT_DESCRIPTION = "Start one film. The person buys credits and creates. Each Nano Banana 2.1 still costs 8 credits and each Seedance 2.5 second at 480p costs 21 credits, taken when that call happens. Voice costs 1 credit per 100 characters. $19 grants 1900 credits. There is no quote. One job runs at a time. If the balance hits zero, the run pauses and the result is a top-up link.";
const DRAFT_DESCRIPTION = "Read the latest draft, or the job_id you pass. The status comes from the v2 run's outputs/state.json. Poll no faster than retryAfterSec and never faster than every 15 seconds. Speak up only when the stage changes. awaiting-approval is a pause for the person. ready includes the video URL. failed includes an error you can repeat. A job that never reaches ready returns the credits it spent.";
const APPROVE_DESCRIPTION = "Approve the paused v2 gate. Pass job_id and the gate decision. An asset approval sends approvedAssets. An animatic or production approval sends decision approve. The same run resumes. If the balance cannot cover the next stills or Seedance seconds, the run stays paused and the result is the top-up link.";

const WRITING_DESCRIPTIONS: Record<WritingJob, string> = {
  "story-director": "Write the stage play. Call with no draft first. The result is the skill and the input packet. Send the full JSON back as draft. Fix every gate error and resend. Three tries. This spends no credits.",
  "character-architect": "Write the character sheets after the story director passes. Call with no draft first. Look at the image block. Send the full JSON back as draft. A retry keeps characters that already passed. This spends no credits.",
  "location-scout": "Write the location plates after the story director passes. Call with no draft first. Send the full JSON back as draft. Either this or the character architect may go first. This spends no credits.",
  "storyboard-artist": "Write the storyboard after both look jobs pass and the person approves the sheet assets. Call with no draft first. A rejected animatic reopens this tool with the notes. This spends no credits.",
  "seedance-compiler": "Write the clip prompts after the person approves the animatic. Call with no draft first. A rejected animatic locks this tool. This spends no credits.",
};

function writingToolName(job: WritingJob) {
  return `wiggly_${job.replaceAll("-", "_")}`;
}

async function accountMemory(ledger: FilmLedger, hooks: {
  loadAccount?: (accountId: string) => Promise<Account>;
  saveAccount?: (accountId: string, account: Account) => Promise<void>;
} | undefined, accountId: string) {
  const memory = new MemoryFilmLedger();
  const direct = ledger as MemoryFilmLedger;
  if (typeof direct.exportState === "function") {
    memory.importState(accountId, direct.exportState(accountId));
    return { memory, save: () => { direct.importState(accountId, memory.exportState(accountId)); } };
  }
  if (!hooks?.loadAccount) return null;
  memory.importState(accountId, await hooks.loadAccount(accountId));
  return { memory, save: async () => { await hooks.saveAccount?.(accountId, memory.exportState(accountId)); } };
}

function toolResult(ok: boolean, payload: Record<string, unknown> | string, images?: GateImage[]) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return {
    content: [
      { type: "text" as const, text },
      ...(images ?? []).map((image) => ({ type: "image" as const, data: image.data, mimeType: image.mimeType })),
    ],
    ...(typeof payload === "string" ? {} : { structuredContent: payload }),
    ...(ok ? {} : { isError: true as const }),
  };
}

export function createHostedMcp(ledger: FilmLedger, hooks?: {
  resumeGraph?: (resume: { runId: string; decision: Record<string, unknown> }) => Promise<{ state: StudioState }>;
  loadAccount?: (accountId: string) => Promise<Account>;
  saveAccount?: (accountId: string, account: Account) => Promise<void>;
  listUploads?: (accountId: string) => Promise<Array<{ label: string; url: string }>>;
  runsRoot?: string;
  photoRoot?: string;
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
    server.registerTool("wiggly_list_uploads", {
      description: LIST_UPLOADS_DESCRIPTION,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async () => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      if (hooks?.listUploads) return toolResult(true, { photos: await hooks.listUploads(accountId) });
      const direct = ledger as MemoryFilmLedger;
      if (typeof direct.exportState !== "function") return toolResult(false, "This server cannot list uploaded photos.");
      const photos = direct.exportState(accountId).photos ?? [];
      return toolResult(true, { photos: photos.map((photo) => ({ label: photo.label, filename: photo.filename })) });
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
      if (result.ok && typeof (ledger as MemoryFilmLedger).exportState === "function") {
        const memory = ledger as MemoryFilmLedger;
        const jobId = String(result.data.job_id ?? "");
        const account = memory.exportState(accountId);
        const photos: CrewPhoto[] = (account.photos ?? []).map((photo) => ({
          label: photo.label,
          path: path.join(hooks?.photoRoot ?? path.join(process.cwd(), "data", "mcp-uploads"), accountId, photo.filename),
        }));
        try {
          await ensureWritingState({
            ledger: memory,
            accountId,
            jobId,
            runsRoot: hooks?.runsRoot ?? path.join(process.cwd(), "data", "format-runs"),
            photos,
          });
        } catch {
          // The first writing tool opens the state when the photo files are ready.
        }
      }
      return result.ok ? toolResult(true, result.data) : toolResult(false, result.message);
    });
    for (const job of WRITING_JOBS) {
      server.registerTool(writingToolName(job), {
        description: WRITING_DESCRIPTIONS[job],
        inputSchema: z.object({
          job_id: z.string().optional(),
          draft: z.unknown().optional(),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      }, async ({ job_id, draft }) => {
        if (!accountId) return toolResult(false, "Authorization needed.");
        const loaded = await accountMemory(ledger, hooks, accountId);
        if (!loaded) return toolResult(false, "This server cannot load the film account.");
        const account = loaded.memory.exportState(accountId);
        const photos: CrewPhoto[] = (account.photos ?? []).map((photo) => ({
          label: photo.label,
          path: path.join(hooks?.photoRoot ?? path.join(process.cwd(), "data", "mcp-uploads"), accountId, photo.filename),
        }));
        const gate = await runWritingJob({
          job,
          ledger: loaded.memory,
          accountId,
          jobId: job_id,
          draft,
          photos,
          runsRoot: hooks?.runsRoot ?? path.join(process.cwd(), "data", "format-runs"),
        });
        await loaded.save();
        return gate.ok ? toolResult(true, gate.data ?? {}, gate.images) : toolResult(false, gate.message ?? "The gate refused this draft.");
      });
    }
    server.registerTool("wiggly_get_draft", {
      description: DRAFT_DESCRIPTION,
      inputSchema: z.object({ job_id: z.string().optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    }, async ({ job_id }) => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      const result = await ledger.getDraft(accountId, job_id);
      if (!result.ok) return toolResult(false, result.message);
      const status = await studioStatusFromFile(result.data.state_file);
      const media = typeof result.data.state_file === "string"
        ? await draftMedia(result.data.state_file, String(result.data.job_id ?? job_id ?? ""), process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET || "wiggly-draft")
        : { stills: [], images: [] };
      return toolResult(true, { ...result.data, ...status, stills: media.stills, ...(media.videoUrl ? { videoUrl: media.videoUrl } : {}) }, media.images);
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
  listUploads?: (accountId: string) => Promise<Array<{ label: string; url: string }>>;
  runsRoot?: string;
  photoRoot?: string;
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
