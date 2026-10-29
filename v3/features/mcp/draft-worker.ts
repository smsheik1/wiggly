import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { IMAGE_CREDITS, VIDEO_CREDITS_PER_SECOND } from "./credits";
import { MemoryFilmLedger, type Account, type Storyboard } from "./film-ledger";

export const DEFAULT_FORMAT_ID = "my-pixar-story";
export const SERVER_STUDIOS_ROOT = "/home/ubuntu/wiggly-format-studios";

const FORMAT_CREWS: Record<string, { folder: string; entry: string }> = {
  "my-pixar-story": { folder: "my-pixar-story-v2", entry: "scripts/run-customer.mjs" },
};

export function studiosRoot() {
  const configured = process.env.WIGGLY_FORMAT_STUDIOS?.trim();
  return configured || SERVER_STUDIOS_ROOT;
}

export function studioForFormat(formatId: string, root = studiosRoot()) {
  const crew = FORMAT_CREWS[formatId];
  if (!crew) {
    throw new Error([
      `No crew is installed for format "${formatId}".`,
      `Studios live on the server under ${root}, one folder per format.`,
      `1. On the server, open ${root}.`,
      "2. Check out that format's studio into its own folder.",
      "3. Register the folder in FORMAT_CREWS in v3/features/mcp/draft-worker.ts.",
      "4. Restart wiggly-v3-mcp-draft.",
    ].join("\n"));
  }
  return { directory: path.join(root, crew.folder), entry: crew.entry, formatId };
}

export function missingStudioError(formatId: string, directory: string) {
  return [
    `The ${formatId} studio is not on this machine at ${directory}.`,
    "A customer film starts from a studio checked out on the server.",
    `1. On the server, create ${studiosRoot()} if it is missing.`,
    `2. Clone the ${formatId} studio so ${directory}/scripts/run-customer.mjs exists.`,
    "3. If the studios live in another parent directory, set WIGGLY_FORMAT_STUDIOS to that directory and restart wiggly-v3-mcp-draft.",
  ].join("\n");
}

async function loadStudio(formatId: string) {
  const studio = studioForFormat(formatId);
  const entry = path.join(studio.directory, studio.entry);
  try {
    await access(entry);
  } catch {
    throw new Error(missingStudioError(formatId, studio.directory));
  }
  return import(pathToFileURL(entry).href);
}

export function replicateSetupError() {
  return [
    "Replicate is not connected. REPLICATE_API_TOKEN is missing, so the draft worker cannot render.",
    "1. Open https://replicate.com/account/api-tokens",
    "2. Copy the API token.",
    "3. Open secrets.env at the Wiggly repo root.",
    "4. Add a line: REPLICATE_API_TOKEN=r8_...",
    "5. Save the file and run the worker again.",
  ].join("\n");
}

export function questionnaireFromStoryboard(storyboard: Storyboard) {
  return {
    subject: storyboard.subject,
    answers: {
      title: storyboard.title,
      memories: storyboard.beats.map((beat) => beat.action),
      people: storyboard.characters.map((character) => character.name),
    },
  };
}

export type StudioState = {
  status?: string;
  pendingApproval?: string[];
  videoUrl?: string;
};

export type GraphStart = {
  runId: string;
  stateFile: string;
  state: StudioState;
};

export async function startV2Run(input: {
  jobId: string;
  storyboard: Storyboard;
  imageUrls: string[];
  runsRoot: string;
  formatId?: string;
}): Promise<GraphStart> {
  const formatId = input.formatId ?? (input.storyboard.format?.trim() || DEFAULT_FORMAT_ID);
  const { runCustomer } = await loadStudio(formatId);
  const names = input.storyboard.characters.map((character) => character.name);
  const started = await runCustomer({
    runId: input.jobId,
    runsRoot: input.runsRoot,
    photoRefsPath: null,
    project: {
      inputs: {
        ...questionnaireFromStoryboard(input.storyboard),
        photoReferences: input.imageUrls.map((url, index) => ({
          id: `photo-${index + 1}`,
          name: names[index] ?? input.storyboard.subject,
          url,
        })),
      },
    },
  });
  return { runId: started.runId, stateFile: started.stateFile, state: started.state };
}

export async function resumeV2Run(input: { runId: string; decision: Record<string, unknown>; runsRoot: string; formatId?: string }) {
  const { resumeCustomer } = await loadStudio(input.formatId ?? DEFAULT_FORMAT_ID);
  const resumed = await resumeCustomer({ runId: input.runId, decision: input.decision, runsRoot: input.runsRoot });
  return { state: resumed.state as StudioState };
}

function applyStudioState(ledger: MemoryFilmLedger, accountId: string, jobId: string, state: StudioState) {
  if (state.status === "failed") {
    ledger.failJob(accountId, jobId, "The v2 run failed.");
    return "failed";
  }
  if (state.status === "done") {
    ledger.setStage(accountId, jobId, "ready", state.videoUrl);
    return "ready";
  }
  if (state.status === "awaiting-approval" || state.status === "awaiting-production") {
    ledger.setStage(accountId, jobId, "awaiting-approval");
    return state.status;
  }
  ledger.setStage(accountId, jobId, "running");
  return state.status ?? "running";
}

export async function stepDraftJob(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  imageUrls: string[];
  token?: string;
  runsRoot?: string;
  startGraph?: (start: { jobId: string; storyboard: Storyboard; imageUrls: string[]; runsRoot: string; formatId: string }) => Promise<GraphStart>;
}) {
  const job = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId);
  if (!job?.storyboard) throw new Error("This job has no storyboard.");
  const formatId = job.storyboard.format?.trim() || DEFAULT_FORMAT_ID;
  studioForFormat(formatId);
  const runsRoot = input.runsRoot ?? path.join(process.cwd(), "data", "format-runs");
  if (!job.stateFile) {
    const start = input.startGraph ?? startV2Run;
    const started = await start({ jobId: input.jobId, storyboard: job.storyboard, imageUrls: input.imageUrls, runsRoot, formatId });
    input.ledger.setRun(input.accountId, input.jobId, { runId: started.runId, stateFile: started.stateFile });
    return applyStudioState(input.ledger, input.accountId, input.jobId, started.state);
  }
  const state = JSON.parse(await readFile(job.stateFile, "utf8")) as StudioState;
  return applyStudioState(input.ledger, input.accountId, input.jobId, state);
}

export async function approveDraft(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  decision: Record<string, unknown>;
  seconds?: number;
  resumeGraph: (resume: { runId: string; decision: Record<string, unknown> }) => Promise<{ state: StudioState }>;
}) {
  const job = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId);
  if (!job?.stateFile || !job.runId) return { ok: false as const, message: "This job has no v2 run to approve." };
  const state = JSON.parse(await readFile(job.stateFile, "utf8")) as StudioState;
  const pending = state.pendingApproval ?? [];
  const stills = pending.filter((tag) => tag.startsWith("@")).length;
  const credits = state.status === "awaiting-production"
    ? (input.seconds ?? 10) * VIDEO_CREDITS_PER_SECOND
    : stills * IMAGE_CREDITS;
  if (credits > 0) {
    const spent = input.ledger.spendCredits(input.accountId, input.jobId, credits);
    if (!spent.ok) return spent;
  }
  const runsRoot = path.dirname(path.dirname(path.dirname(job.stateFile)));
  const formatId = job.storyboard?.format?.trim() || DEFAULT_FORMAT_ID;
  const resume = input.resumeGraph ?? ((item: { runId: string; decision: Record<string, unknown> }) => resumeV2Run({ ...item, runsRoot, formatId }));
  const resumed = await resume({ runId: job.runId, decision: input.decision });
  const stage = applyStudioState(input.ledger, input.accountId, input.jobId, resumed.state);
  return { ok: true as const, data: { stage, status: resumed.state.status ?? stage } };
}

export async function studioStatusFromFile(stateFile: unknown) {
  if (typeof stateFile !== "string" || stateFile.length === 0) return {};
  try {
    const state = JSON.parse(await readFile(stateFile, "utf8")) as StudioState;
    return {
      studio_status: state.status ?? "running",
      pending_approval: state.pendingApproval ?? [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The state file could not be read.";
    return { studio_status: "missing", pending_approval: [] as string[], state_error: message };
  }
}

export async function runDraftTick(input: {
  jobs: Array<{ accountId: string; jobId: string; imageUrls: string[] }>;
  loadAccount: (accountId: string) => Promise<Account> | Account;
  saveAccount: (accountId: string, account: Account) => Promise<void> | void;
  runsRoot?: string;
  startGraph?: (start: { jobId: string; storyboard: Storyboard; imageUrls: string[]; runsRoot: string; formatId: string }) => Promise<GraphStart>;
}) {
  const lines: string[] = [];
  for (const job of input.jobs) {
    const ledger = new MemoryFilmLedger();
    ledger.importState(job.accountId, await input.loadAccount(job.accountId));
    const stage = await stepDraftJob({
      ledger,
      accountId: job.accountId,
      jobId: job.jobId,
      imageUrls: job.imageUrls,
      runsRoot: input.runsRoot,
      startGraph: input.startGraph,
    });
    await input.saveAccount(job.accountId, ledger.exportState(job.accountId));
    lines.push(`${job.jobId} -> ${stage}`);
  }
  return lines;
}
