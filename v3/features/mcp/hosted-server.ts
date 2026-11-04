import fs from "node:fs";
import path from "node:path";
import { McpServer, createMcpHandler, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { requireBearerAuth } from "@modelcontextprotocol/server";
import { z } from "zod";
import { MCP_RESOURCE_URL, PROTECTED_RESOURCE_METADATA_URL } from "./hosted-auth";
import { approveDraft, studioStatusFromFile, type CrewPhoto, type StudioState } from "./draft-worker";
import { draftMedia } from "./render-stage";
import { ensureWritingState, runWritingJob, WRITING_JOBS, type GateImage, type WritingJob } from "./gate-tools";
import { MemoryFilmLedger, type Account, type LedgerResult, type Storyboard } from "./film-ledger";
import { resizeImageToThumbnail } from "./image-resize";

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
    duration_sec: z.number().positive(),
    action: z.string().min(1),
    camera: z.string().min(1),
    narration_line: z.string().optional(),
  })).length(7, "storyboard.beats must have exactly 7 beats").describe("Exactly 7 beats. Wiggly does not add or remove beats."),
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
const APPROVE_DESCRIPTION = "Approve or reject a human gate. Pass job_id, gate ('sheets' | 'animatic' | 'production'), decision ('approve' | 'reject'), and optional notes, shot_ids, asset_ids, or acknowledged_credits (required for gate 'production'). Legacy decision records are accepted for backward compatibility.";

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
  saveAccount?: (accountId: string, account: Account) => Promise<void | null>;
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
  saveAccount?: (accountId: string, account: Account) => Promise<void | null>;
  listUploads?: (accountId: string) => Promise<Array<{ label: string; url: string }>>;
  runsRoot?: string;
  photoRoot?: string;
  renderStill?: (request: { prompt?: string; dest?: string; itemId?: string; aspectRatio?: string; resolution?: string; referencePaths?: string[] }) => Promise<{ dest?: string }>;
  renderClip?: (request: { itemId?: string; duration?: number; dest?: string; videoPath?: string; clip?: unknown; state?: unknown; runDir?: string; engine?: string }) => Promise<{ dest?: string; videoPath?: string }>;
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
      if (photos.length === 0) {
        const upload = await ledger.openUpload(accountId);
        return toolResult(true, `No photos yet. Open ${upload.uploadUrl} and label each photo, then call wiggly_list_uploads again. It expires at ${upload.expiresAt}.`);
      }
      const images: GateImage[] = [];
      const photoRoot = hooks?.photoRoot ?? path.join(process.cwd(), "data", "mcp-uploads");
      for (const photo of photos.slice(0, 8)) {
        const photoPath = (photo as { path?: string }).path ?? path.join(photoRoot, accountId, photo.filename);
        try {
          const buf = await fs.promises.readFile(photoPath);
          const thumb = resizeImageToThumbnail(buf, 512);
          images.push(thumb);
        } catch {
          // If file not on disk, omit image block
        }
      }
      return toolResult(true, { photos: photos.slice(0, 8).map((photo) => ({ label: photo.label, filename: photo.filename })) }, images);
    });
    server.registerTool("wiggly_submit_draft", {
      description: SUBMIT_DESCRIPTION,
      inputSchema: z.object({
        storyboard: storyboardSchema,
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    }, async (rawArgs) => {
      const args = rawArgs as { storyboard: Storyboard; confirm?: boolean; quote_id?: string };
      const storyboard = args.storyboard;
      const confirm = args.confirm;
      const quote_id = args.quote_id;
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
      const status: {
        studio_status?: string;
        render_stage?: string;
        pending_approval?: string[];
        production_preview?: Record<string, unknown>;
        clip_render_status?: Record<string, unknown>;
        guidance?: string;
      } = await studioStatusFromFile(result.data.state_file);
      const media = typeof result.data.state_file === "string"
        ? await draftMedia(result.data.state_file, String(result.data.job_id ?? job_id ?? ""), process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET || "wiggly-draft")
        : { stills: [], images: [], videoUrl: undefined };

      const direct = ledger as MemoryFilmLedger;
      let account: Account | undefined;
      if (typeof direct.exportState === "function") {
        account = direct.exportState(accountId);
      } else if (hooks?.loadAccount) {
        account = await hooks.loadAccount(accountId);
      }
      const creditsBalance = account ? account.monthlyCredits + account.purchasedCredits : 0;

      let gate: "sheets" | "animatic" | "production" | undefined;
      let nextStepCost: number | undefined;

      const isAwaiting = result.data.stage === "awaiting-approval" || status.studio_status === "awaiting-approval" || status.studio_status === "awaiting-production";
      if (isAwaiting) {
        const pending = Array.isArray(status.pending_approval) ? status.pending_approval : [];
        if (status.render_stage === "sheets" || pending.includes("sheets")) {
          gate = "sheets";
          nextStepCost = 144;
        } else if (status.render_stage === "panels" || pending.includes("animatic")) {
          gate = "animatic";
          nextStepCost = 0;
        } else if (status.render_stage === "clips" || status.studio_status === "awaiting-production" || pending.includes("production")) {
          gate = "production";
          const prodEst = (status.production_preview as { remaining_credits?: number } | undefined)?.remaining_credits
            ?? (result.data.estimatedCredits as { production?: number } | undefined)?.production
            ?? 1512;
          nextStepCost = prodEst;
        }
      }

      return toolResult(true, {
        ...result.data,
        ...status,
        ...(gate ? { gate } : {}),
        ...(typeof nextStepCost === "number" ? { nextStepCost } : {}),
        creditsBalance,
        stills: media.stills,
        ...(media.videoUrl ? { videoUrl: media.videoUrl } : {}),
      }, media.images);
    });
    server.registerTool("wiggly_cancel_draft", {
      description: "Cancel an active draft job (only valid in 'awaiting-approval' or 'awaiting-credits'). Frees the account slot so a new draft can be submitted. In running stage, answers wait for the current step to finish. Refunds 0 credits because generation calls are already billed.",
      inputSchema: z.object({
        job_id: z.string(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    }, async ({ job_id }) => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      const memory = new MemoryFilmLedger();
      const direct = ledger as MemoryFilmLedger;
      if (typeof direct.exportState === "function") {
        memory.importState(accountId, direct.exportState(accountId));
      } else if (hooks?.loadAccount) {
        memory.importState(accountId, await hooks.loadAccount(accountId));
      } else {
        return toolResult(false, "This server cannot load the film account.");
      }
      const result = memory.cancelDraft(accountId, job_id);
      if (result.ok) {
        if (typeof direct.importState === "function") direct.importState(accountId, memory.exportState(accountId));
        else if (hooks?.saveAccount) await hooks.saveAccount(accountId, memory.exportState(accountId));
      }
      return result.ok ? toolResult(true, result.data ?? { message: "Job cancelled." }) : toolResult(false, result.message ?? "Cancel failed.");
    });
    server.registerTool("wiggly_approve_draft", {
      description: APPROVE_DESCRIPTION,
      inputSchema: z.object({
        job_id: z.string().describe("Active draft job id."),
        gate: z.enum(["sheets", "animatic", "production"]).optional().describe("Current gate being approved or rejected."),
        decision: z.union([z.enum(["approve", "reject"]), z.record(z.string(), z.unknown())]).describe("'approve' or 'reject' (or legacy decision record)."),
        notes: z.string().optional().describe("Notes for rejected panels, clips, or storyboard revision."),
        shot_ids: z.array(z.string()).optional().describe("Panel shot IDs to reroll on animatic rejection (e.g. ['2.3'])."),
        asset_ids: z.array(z.string()).optional().describe("Asset tags to approve at sheets gate (optional, all sheets approved by default)."),
        acknowledged_credits: z.number().optional().describe("Required for gate 'production': must match production credit estimate."),
      }).passthrough(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    }, async (rawArgs) => {
      const args = rawArgs as {
        job_id: string;
        gate?: "sheets" | "animatic" | "production";
        decision: "approve" | "reject" | Record<string, unknown>;
        notes?: string;
        shot_ids?: string[];
        asset_ids?: string[];
        acknowledged_credits?: number;
      };
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
        jobId: args.job_id,
        gate: args.gate,
        decision: args.decision,
        notes: args.notes,
        shot_ids: args.shot_ids,
        asset_ids: args.asset_ids,
        acknowledged_credits: args.acknowledged_credits,
        ...(hooks?.resumeGraph ? { resumeGraph: hooks.resumeGraph } : {}),
      });
      if (typeof direct.importState === "function") direct.importState(accountId, memory.exportState(accountId));
      else if (hooks?.saveAccount) await hooks.saveAccount(accountId, memory.exportState(accountId));
      return result.ok ? toolResult(true, result.data ?? {}) : toolResult(false, result.message ?? "Approval failed.");
    });
    server.registerTool("wiggly_reroll_panel", {
      description: "Reroll or adjust a single storyboard panel still that looked bad (costs 8 credits). Pass job_id, shot_id (e.g. '2.3'), and optional prompt_notes. Only that one frame is re-rendered; the other 17 panels remain untouched and cost 0 credits. The animatic preview video is automatically re-stitched with the new frame.",
      inputSchema: z.object({
        job_id: z.string(),
        shot_id: z.string(),
        prompt_notes: z.string().optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    }, async ({ job_id, shot_id, prompt_notes }) => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      const memory = new MemoryFilmLedger();
      const direct = ledger as MemoryFilmLedger;
      if (typeof direct.exportState === "function") {
        memory.importState(accountId, direct.exportState(accountId));
      } else if (hooks?.loadAccount) {
        memory.importState(accountId, await hooks.loadAccount(accountId));
      } else {
        return toolResult(false, "This server cannot load the film account.");
      }
      const { rerollPanel } = await import("./render-stage");
      const result = await rerollPanel({
        ledger: memory,
        accountId,
        jobId: job_id,
        shotId: shot_id,
        promptNotes: prompt_notes,
        ...(hooks?.renderStill ? { renderStill: hooks.renderStill } : {}),
      });
      if (typeof direct.importState === "function") direct.importState(accountId, memory.exportState(accountId));
      else if (hooks?.saveAccount) await hooks.saveAccount(accountId, memory.exportState(accountId));
      return result.ok ? toolResult(true, result.data ?? {}) : toolResult(false, result.message ?? "Reroll failed.");
    });
    server.registerTool("wiggly_render_clip", {
      description: "Render or re-render a single video clip (e.g. clip 1 or 2). Costs duration * 21 credits. Always renders a fresh take unless currently in-flight on GPUs. Returns immediately with status 'rendering' so the tool call never times out. Poll wiggly_get_draft to check when finished. Pass job_id, clip_id (e.g. 1 or 2), optional duration_sec, optional prompt, and optional prompt_notes.",
      inputSchema: z.object({
        job_id: z.string(),
        clip_id: z.union([z.number(), z.string()]).default(1),
        duration_sec: z.number().int().min(3).max(30).optional(),
        force: z.boolean().optional().describe("Force a fresh re-render even if already in-flight."),
        reroll: z.boolean().optional().describe("Alias for force: re-render this clip from scratch."),
        prompt: z.string().optional().describe("Optional prompt override to render this clip with."),
        prompt_notes: z.string().optional().describe("Optional director adjustment notes appended to the clip prompt."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    }, async ({ job_id, clip_id, duration_sec, force, reroll, prompt, prompt_notes }) => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      const memory = new MemoryFilmLedger();
      const direct = ledger as MemoryFilmLedger;
      if (typeof direct.exportState === "function") {
        memory.importState(accountId, direct.exportState(accountId));
      } else if (hooks?.loadAccount) {
        memory.importState(accountId, await hooks.loadAccount(accountId));
      } else {
        return toolResult(false, "This server cannot load the film account.");
      }
      const isTestSync = Boolean(hooks?.renderClip);
      const { renderSingleClip } = await import("./render-stage");
      const result = await renderSingleClip({
        ledger: memory,
        accountId,
        jobId: job_id,
        clipId: clip_id,
        durationSec: duration_sec,
        force,
        reroll,
        prompt,
        promptNotes: prompt_notes,
        async: !isTestSync,
        ...(hooks?.renderClip ? { renderClip: hooks.renderClip } : {}),
        onComplete: async () => {
          if (typeof direct.importState === "function") direct.importState(accountId, memory.exportState(accountId));
          else if (hooks?.saveAccount) await hooks.saveAccount(accountId, memory.exportState(accountId));
        },
      });
      if (typeof direct.importState === "function") direct.importState(accountId, memory.exportState(accountId));
      else if (hooks?.saveAccount) await hooks.saveAccount(accountId, memory.exportState(accountId));
      return result.ok ? toolResult(true, result.data ?? {}) : toolResult(false, result.message ?? "Clip render failed.");
    });
    server.registerTool("wiggly_reroll_clip", {
      description: "Force a fresh re-render of an existing video clip (costs duration * 21 credits). Overwrites any previous take. Returns immediately with status 'rendering'. Poll wiggly_get_draft to check when finished. Pass job_id, clip_id (e.g. 2), optional duration_sec, optional prompt, and optional prompt_notes.",
      inputSchema: z.object({
        job_id: z.string(),
        clip_id: z.union([z.number(), z.string()]),
        duration_sec: z.number().int().min(3).max(30).optional(),
        prompt: z.string().optional().describe("Optional prompt override to render this clip with."),
        prompt_notes: z.string().optional().describe("Optional director adjustment notes appended to the clip prompt."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    }, async ({ job_id, clip_id, duration_sec, prompt, prompt_notes }) => {
      if (!accountId) return toolResult(false, "Authorization needed.");
      const memory = new MemoryFilmLedger();
      const direct = ledger as MemoryFilmLedger;
      if (typeof direct.exportState === "function") {
        memory.importState(accountId, direct.exportState(accountId));
      } else if (hooks?.loadAccount) {
        memory.importState(accountId, await hooks.loadAccount(accountId));
      } else {
        return toolResult(false, "This server cannot load the film account.");
      }
      const isTestSync = Boolean(hooks?.renderClip);
      const { renderSingleClip } = await import("./render-stage");
      const result = await renderSingleClip({
        ledger: memory,
        accountId,
        jobId: job_id,
        clipId: clip_id,
        durationSec: duration_sec,
        force: true,
        reroll: true,
        prompt,
        promptNotes: prompt_notes,
        async: !isTestSync,
        ...(hooks?.renderClip ? { renderClip: hooks.renderClip } : {}),
        onComplete: async () => {
          if (typeof direct.importState === "function") direct.importState(accountId, memory.exportState(accountId));
          else if (hooks?.saveAccount) await hooks.saveAccount(accountId, memory.exportState(accountId));
        },
      });
      if (typeof direct.importState === "function") direct.importState(accountId, memory.exportState(accountId));
      else if (hooks?.saveAccount) await hooks.saveAccount(accountId, memory.exportState(accountId));
      return result.ok ? toolResult(true, result.data ?? {}) : toolResult(false, result.message ?? "Clip reroll failed.");
    });
    return server;
  }, { legacy: "reject" });
}

export function createMcpRoute<T extends FilmLedger = MemoryFilmLedger>(options?: {
  verifier?: OAuthTokenVerifier;
  ledger?: T;
  resumeGraph?: (resume: { runId: string; decision: Record<string, unknown> }) => Promise<{ state: StudioState }>;
  loadAccount?: (accountId: string) => Promise<Account>;
  saveAccount?: (accountId: string, account: Account) => Promise<void | null>;
  listUploads?: (accountId: string) => Promise<Array<{ label: string; url: string }>>;
  runsRoot?: string;
  photoRoot?: string;
  renderStill?: (request: { prompt?: string; dest?: string; itemId?: string; aspectRatio?: string; resolution?: string; referencePaths?: string[] }) => Promise<{ dest?: string }>;
  renderClip?: (request: { itemId?: string; duration?: number; dest?: string; videoPath?: string; clip?: unknown; state?: unknown; runDir?: string; engine?: string }) => Promise<{ dest?: string; videoPath?: string }>;
}) {
  const ledger = (options?.ledger ?? new MemoryFilmLedger()) as T;
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
