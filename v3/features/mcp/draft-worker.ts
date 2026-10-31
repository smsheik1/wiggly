import { access, lstat, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runtimeImport } from "./runtime-import";
import { INSTALLED_FORMAT_IDS, MemoryFilmLedger, type Account, type Storyboard } from "./film-ledger";
import { namedSecret } from "./named-secret";
import { AwaitingCredits, chargeThenRender, clipCredits, stillCredits } from "./render-charge";

export function bundledStudiosRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../studios");
}

const FORMAT_CREWS: Record<string, { folder: string; entry: string }> = {
  "my-pixar-story": { folder: "my-pixar-story-v2", entry: "scripts/run-customer.mjs" },
};

export function studiosRoot() {
  const configured = process.env.WIGGLY_FORMAT_STUDIOS?.trim();
  return configured || bundledStudiosRoot();
}

export function studioForFormat(formatId: string, root = studiosRoot()) {
  const crew = FORMAT_CREWS[formatId];
  if (!crew) {
    throw new Error([
      `No crew is installed for format "${formatId}".`,
      `Installed formats: ${INSTALLED_FORMAT_IDS.join(", ")}.`,
      `Each installed format lives in studios/<folder> inside the release.`,
      "1. Register the folder in FORMAT_CREWS in v3/features/mcp/draft-worker.ts.",
      "2. Restart wiggly-v3-mcp-draft.",
    ].join("\n"));
  }
  return { directory: path.join(root, crew.folder), entry: crew.entry, formatId };
}

export function openRouterSetupError() {
  return [
    "OpenRouter is not connected. OPENROUTER_API_KEY is missing, so the draft worker cannot start a crew.",
    "1. Open https://openrouter.ai/settings/keys",
    "2. Copy the API key.",
    "3. Open secrets.env at the Wiggly repo root.",
    "4. Add a line: OPENROUTER_API_KEY=sk-or-...",
    "5. Save the file and restart wiggly-v3-mcp-draft.",
  ].join("\n");
}

export async function assertRealNodeModules(directory: string) {
  const modules = path.join(directory, "node_modules");
  let info;
  try {
    info = await lstat(modules);
  } catch {
    throw new Error([
      `node_modules is missing at ${modules}.`,
      `1. In ${directory}, run npm ci from the bundled lockfile.`,
      "2. Restart wiggly-v3-mcp-draft.",
      "3. Do not point node_modules at a Mac folder.",
    ].join("\n"));
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error([
      `node_modules at ${modules} is not a real directory installed on this machine.`,
      `1. Remove that link.`,
      `2. In ${directory}, run npm ci from the bundled lockfile.`,
      "3. Restart wiggly-v3-mcp-draft.",
    ].join("\n"));
  }
}

export async function releasePreflight(input: {
  studioDir: string;
  studioEntry: string;
  appDir: string;
  openRouterKey: string;
  replicateKey: string;
}) {
  const problems: string[] = [];
  try {
    await access(path.join(input.studioDir, input.studioEntry));
  } catch {
    problems.push(missingStudioError("my-pixar-story", input.studioDir));
  }
  for (const directory of [input.studioDir, input.appDir]) {
    try {
      await assertRealNodeModules(directory);
    } catch (error) {
      problems.push(error instanceof Error ? error.message : "node_modules check failed.");
    }
  }
  if (!input.replicateKey.trim()) problems.push(replicateSetupError());
  if (problems.length > 0) throw new Error(problems.join("\n\n"));
}

export function missingStudioError(formatId: string, directory: string) {
  return [
    `The ${formatId} studio is not in this release at ${directory}.`,
    `1. The release must include ${directory}/scripts/run-customer.mjs.`,
    "2. On this Mac, set WIGGLY_FORMAT_STUDIOS to the parent of that studio folder and restart wiggly-v3-mcp-draft.",
  ].join("\n");
}

export type CrewPhoto = { label: string; path: string; url?: string };

export function crewPhotoReferences(storyboard: Storyboard, photos: CrewPhoto[]) {
  return storyboard.characters.map((character) => {
    const name = character.name.trim();
    const photo = photos.find((item) => item.label.trim() === name);
    if (!photo?.path) throw new Error(`No photo file for ${name}. Call wiggly_list_uploads after the upload is done.`);
    return {
      id: name,
      name,
      realPerson: name,
      skinTone: character.skinTone?.trim() ?? "",
      description: character.description?.trim() ?? "",
      path: photo.path,
      ...(photo.url ? { url: photo.url } : {}),
    };
  });
}

export function requireFormatId(format: string | undefined) {
  const formatId = format?.trim() ?? "";
  if (!formatId) throw new Error(`storyboard.format is required. Installed formats: ${INSTALLED_FORMAT_IDS.join(", ")}.`);
  return formatId;
}

async function loadStudio(formatId: string) {
  const studio = studioForFormat(formatId);
  const entry = path.join(studio.directory, studio.entry);
  try {
    await access(entry);
  } catch {
    throw new Error(missingStudioError(formatId, studio.directory));
  }
  return runtimeImport(pathToFileURL(entry).href);
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
  credits?: number;
  creditItemId?: string;
  renderStage?: string;
  passed?: Record<string, boolean>;
  assetFiles?: Record<string, string>;
  approvedAssets?: Record<string, unknown>;
};

function billRender(input: { ledger: MemoryFilmLedger; accountId: string; jobId: string; runDir: string }) {
  return async (item: { kind: string; request: { itemId?: string; duration?: number }; render: () => Promise<{ dest?: string; videoPath?: string }> }) => {
    const itemId = item.request.itemId;
    if (!itemId) throw new Error("A render has no item id, so it was not charged and it was not started.");
    const credits = item.kind === "clip" ? clipCredits(item.request.duration ?? 10) : stillCredits();
    return chargeThenRender({ ...input, itemId, credits, render: item.render });
  };
}

export type GraphStart = {
  runId: string;
  stateFile: string;
  state: StudioState;
};

async function readRunState(runDir: string): Promise<{ stateFile: string; state: StudioState; broken?: boolean } | null> {
  const stateFile = path.join(runDir, "outputs", "state.json");
  let raw: string;
  try {
    raw = await readFile(stateFile, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return null;
    throw error;
  }
  try {
    return { stateFile, state: JSON.parse(raw) as StudioState };
  } catch {
    return { stateFile, state: { status: "failed" }, broken: true };
  }
}

function graphPause(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const named = error as { name?: string; interrupts?: Array<{ value?: { kind?: string } }> };
  if (named.name !== "GraphInterrupt" && named.name !== "NodeInterrupt") return null;
  return named.interrupts?.[0]?.value?.kind === "credits" ? "awaiting-credits" as const : "awaiting-approval" as const;
}

export async function startV2Run(input: {
  jobId: string;
  storyboard: Storyboard;
  imageUrls: string[];
  photos?: CrewPhoto[];
  runsRoot: string;
  formatId?: string;
  ledger: MemoryFilmLedger;
  accountId: string;
  feeCredits?: number | null;
  persist?: () => Promise<void | null> | void;
}): Promise<GraphStart> {
  const formatId = input.formatId ?? requireFormatId(input.storyboard.format);
  crewPhotoReferences(input.storyboard, input.photos ?? []);
  const studio = studioForFormat(formatId);
  try {
    await access(path.join(studio.directory, studio.entry));
  } catch {
    throw new Error(missingStudioError(formatId, studio.directory));
  }
  const { ensureWritingState } = await import("./gate-tools");
  const stateFile = await ensureWritingState({
    ledger: input.ledger,
    accountId: input.accountId,
    jobId: input.jobId,
    runsRoot: input.runsRoot,
    photos: input.photos,
  });
  await input.persist?.();
  const existing = await readRunState(path.join(input.runsRoot, input.jobId));
  if (!existing || existing.broken) throw new Error("The film state could not be read.");
  return { runId: input.jobId, stateFile, state: existing.state };
}

export async function resumeV2Run(input: { runId: string; decision: Record<string, unknown>; runsRoot: string; formatId?: string; ledger: MemoryFilmLedger; accountId: string; jobId: string }) {
  const { resumeCustomer } = await loadStudio(requireFormatId(input.formatId));
  const runDir = path.join(input.runsRoot, input.runId);
  const resumed = await resumeCustomer({
    runId: input.runId,
    decision: input.decision,
    runsRoot: input.runsRoot,
    chargeRender: billRender({ ledger: input.ledger, accountId: input.accountId, jobId: input.jobId, runDir }),
  });
  return { state: resumed.state as StudioState };
}

function recordedStage(ledger: MemoryFilmLedger, accountId: string, jobId: string) {
  return ledger.exportState(accountId).jobs.find((item) => item.jobId === jobId)?.stage;
}

function applyStudioState(ledger: MemoryFilmLedger, accountId: string, jobId: string, state: StudioState) {
  if (state.status === "failed") {
    ledger.markFailed(accountId, jobId, "The v2 run failed.");
    return recordedStage(ledger, accountId, jobId) ?? "failed";
  }
  if (state.status === "done") {
    ledger.setStage(accountId, jobId, "ready", state.videoUrl);
    return recordedStage(ledger, accountId, jobId) ?? "ready";
  }
  if (state.status === "awaiting-credits") {
    ledger.setStage(accountId, jobId, "awaiting-credits");
    return recordedStage(ledger, accountId, jobId) ?? "awaiting-credits";
  }
  if (state.status === "awaiting-approval" || state.status === "awaiting-production") {
    ledger.setStage(accountId, jobId, "awaiting-approval");
    return recordedStage(ledger, accountId, jobId) ?? state.status;
  }
  ledger.setStage(accountId, jobId, "running");
  return recordedStage(ledger, accountId, jobId) ?? state.status ?? "running";
}

export async function stepDraftJob(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  imageUrls: string[];
  photos?: CrewPhoto[];
  token?: string;
  runsRoot?: string;
  startGraph?: (start: { jobId: string; storyboard: Storyboard; imageUrls: string[]; photos: CrewPhoto[]; runsRoot: string; formatId: string }) => Promise<GraphStart>;
  resumeGraph?: (resume: { runId: string; decision: Record<string, unknown> }) => Promise<{ state: StudioState }>;
  feeCredits?: number | null;
  persist?: () => Promise<void | null> | void;
  renderStill?: (request: { prompt?: string; dest?: string; itemId?: string; referencePaths?: string[] }) => Promise<{ dest?: string }>;
  renderClip?: (request: { itemId?: string; duration?: number }) => Promise<{ dest?: string; videoPath?: string }>;
}) {
  const job = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId);
  if (!job?.storyboard) throw new Error("This job has no storyboard.");
  const formatId = requireFormatId(job.storyboard.format);
  studioForFormat(formatId);
  const runsRoot = input.runsRoot ?? path.join(process.cwd(), "data", "format-runs");
  if (!job.stateFile) {
    const start = input.startGraph ?? ((start) => startV2Run({
      ...start,
      ledger: input.ledger,
      accountId: input.accountId,
      feeCredits: input.feeCredits,
      persist: input.persist,
    }));
    try {
      const started = await start({ jobId: input.jobId, storyboard: job.storyboard, imageUrls: input.imageUrls, photos: input.photos ?? [], runsRoot, formatId });
      input.ledger.setRun(input.accountId, input.jobId, { runId: started.runId, stateFile: started.stateFile });
      return applyStudioState(input.ledger, input.accountId, input.jobId, started.state);
    } catch (error) {
      const runDir = path.join(runsRoot, input.jobId);
      const existing = await readRunState(runDir);
      const pause = error instanceof AwaitingCredits ? "awaiting-credits" : graphPause(error);
      if (pause) {
        if (existing) input.ledger.setRun(input.accountId, input.jobId, { runId: input.jobId, stateFile: existing.stateFile });
        input.ledger.setStage(input.accountId, input.jobId, pause);
        return pause;
      }
      if (existing) {
        input.ledger.setRun(input.accountId, input.jobId, { runId: input.jobId, stateFile: existing.stateFile });
        input.ledger.markFailed(input.accountId, input.jobId, "The v2 run failed.");
        return "failed";
      }
      throw error;
    }
  }
  const state = JSON.parse(await readFile(job.stateFile, "utf8")) as StudioState;
  const runDir = path.dirname(path.dirname(job.stateFile));
  if (state.status === "awaiting-credits") {
    const cost = Number(state.credits ?? 0);
    const account = input.ledger.exportState(input.accountId);
    const covered = account.monthlyCredits + account.purchasedCredits >= cost && cost > 0;
    if (!covered) {
      input.ledger.setStage(input.accountId, input.jobId, "awaiting-credits");
      return "awaiting-credits";
    }
    if (state.renderStage) {
      const { advanceRender } = await import("./render-stage");
      await rm(path.join(runDir, "outputs", "checkpoint.json"), { force: true });
      const merged = await advanceRender({
        state: { ...(state as Record<string, unknown>), status: "writing" },
        runDir,
        formatId,
        ledger: input.ledger,
        accountId: input.accountId,
        jobId: input.jobId,
        renderStill: input.renderStill ?? (await defaultStill(formatId)),
        renderClip: input.renderClip ?? (await defaultClip(formatId)),
      });
      if (merged) {
        await writeFile(job.stateFile, JSON.stringify(merged));
        return applyStudioState(input.ledger, input.accountId, input.jobId, merged as StudioState);
      }
    }
    if (!job.runId) throw new Error("This paused film has no run to resume.");
    const resume = input.resumeGraph ?? ((item: { runId: string; decision: Record<string, unknown> }) => resumeV2Run({
      ...item,
      runsRoot,
      formatId,
      ledger: input.ledger,
      accountId: input.accountId,
      jobId: input.jobId,
    }));
    const resumed = await resume({ runId: job.runId, decision: { kind: "credits" } });
    return applyStudioState(input.ledger, input.accountId, input.jobId, resumed.state);
  }
  const { advanceRender, dueStage } = await import("./render-stage");
  if (await dueStage(state as Record<string, unknown>, formatId)) {
    const merged = await advanceRender({
      state: state as Record<string, unknown>,
      runDir,
      formatId,
      ledger: input.ledger,
      accountId: input.accountId,
      jobId: input.jobId,
      renderStill: input.renderStill ?? (await defaultStill(formatId)),
      renderClip: input.renderClip ?? (await defaultClip(formatId)),
    });
    if (merged) {
      await writeFile(job.stateFile, JSON.stringify(merged));
      return applyStudioState(input.ledger, input.accountId, input.jobId, merged as StudioState);
    }
  }
  return applyStudioState(input.ledger, input.accountId, input.jobId, state);
}

async function defaultStill(formatId: string) {
  const studio = studioForFormat(formatId);
  const stills = await runtimeImport(pathToFileURL(path.join(studio.directory, "graph/stills.mjs")).href);
  const token = process.env.REPLICATE_API_TOKEN?.trim() || await namedSecret("REPLICATE_API_TOKEN");
  return stills.nanoBananaStill({ apiKey: token }) as (request: { prompt?: string; dest?: string; itemId?: string; referencePaths?: string[] }) => Promise<{ dest?: string }>;
}

async function defaultClip(formatId: string) {
  const studio = studioForFormat(formatId);
  const customer = await runtimeImport(pathToFileURL(path.join(studio.directory, "scripts/run-customer.mjs")).href);
  const token = process.env.REPLICATE_API_TOKEN?.trim() || await namedSecret("REPLICATE_API_TOKEN");
  return customer.seedance480pRenderer({ apiKey: token }) as (request: { itemId?: string; duration?: number }) => Promise<{ dest?: string; videoPath?: string }>;
}

export async function approveDraft(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  decision: Record<string, unknown>;
  seconds?: number;
  resumeGraph?: (resume: { runId: string; decision: Record<string, unknown> }) => Promise<{ state: StudioState }>;
  renderStill?: (request: { prompt?: string; dest?: string; itemId?: string; referencePaths?: string[] }) => Promise<{ dest?: string }>;
  renderClip?: (request: { itemId?: string; duration?: number }) => Promise<{ dest?: string; videoPath?: string }>;
}) {
  const job = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId);
  if (!job?.stateFile || !job.runId) return { ok: false as const, message: "This job has no v2 run to approve." };
  const state = JSON.parse(await readFile(job.stateFile, "utf8")) as StudioState;
  if (state.status === "awaiting-credits") {
    return { ok: false as const, message: "This run is paused for credits. Top up, then the worker resumes it. Do not call wiggly_approve_draft." };
  }
  const rawApproved = input.decision?.approvedAssets;
  let normalizedDecision = input.decision;
  if (Array.isArray(rawApproved)) {
    const assetFiles = (state.assetFiles ?? {}) as Record<string, string>;
    const approvedMap = Object.fromEntries(rawApproved.map((tag) => [tag, assetFiles[tag] ?? true]));
    normalizedDecision = { ...input.decision, approvedAssets: approvedMap };
  }
  if (state.renderStage) {
    const { advanceRender, picturesReady } = await import("./render-stage");
    if (!(await picturesReady(job.stateFile))) {
      return { ok: false as const, message: "The pictures are not ready to show. Call wiggly_get_draft." };
    }
    const formatId = requireFormatId(job.storyboard?.format);
    const runDir = path.dirname(path.dirname(job.stateFile));
    const merged = await advanceRender({
      state: state as Record<string, unknown>,
      runDir,
      formatId,
      ledger: input.ledger,
      accountId: input.accountId,
      jobId: input.jobId,
      renderStill: input.renderStill ?? (await defaultStill(formatId)),
      renderClip: input.renderClip ?? (await defaultClip(formatId)),
      resume: normalizedDecision,
    });
    if (!merged) return { ok: false as const, message: "This approval did not resume the film." };
    await writeFile(job.stateFile, JSON.stringify(merged));
    const stage = applyStudioState(input.ledger, input.accountId, input.jobId, merged as StudioState);
    return { ok: true as const, data: { stage, status: String(merged.status ?? stage) } };
  }
  const runsRoot = path.dirname(path.dirname(path.dirname(job.stateFile)));
  const formatId = requireFormatId(job.storyboard?.format);
  const resume = input.resumeGraph ?? ((item: { runId: string; decision: Record<string, unknown> }) => resumeV2Run({
    ...item,
    runsRoot,
    formatId,
    ledger: input.ledger,
    accountId: input.accountId,
    jobId: input.jobId,
  }));
  const resumed = await resume({ runId: job.runId, decision: normalizedDecision });
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
  jobs: Array<{ accountId: string; jobId: string; imageUrls: string[]; photos?: CrewPhoto[] }>;
  loadAccount: (accountId: string) => Promise<Account> | Account;
  saveAccount: (accountId: string, account: Account) => Promise<void | null> | void;
  runsRoot?: string;
  startGraph?: (start: { jobId: string; storyboard: Storyboard; imageUrls: string[]; photos: CrewPhoto[]; runsRoot: string; formatId: string }) => Promise<GraphStart>;
  feeCredits?: number | null;
  renderStill?: (request: { prompt?: string; dest?: string; itemId?: string; referencePaths?: string[] }) => Promise<{ dest?: string }>;
  renderClip?: (request: { itemId?: string; duration?: number }) => Promise<{ dest?: string; videoPath?: string }>;
}) {
  const lines: string[] = [];
  for (const job of input.jobs) {
    const ledger = new MemoryFilmLedger();
    ledger.importState(job.accountId, await input.loadAccount(job.accountId));
    const persist = () => input.saveAccount(job.accountId, ledger.exportState(job.accountId));
    try {
      const stage = await stepDraftJob({
        ledger,
        accountId: job.accountId,
        jobId: job.jobId,
        imageUrls: job.imageUrls,
        photos: job.photos,
        runsRoot: input.runsRoot,
        startGraph: input.startGraph,
        feeCredits: input.feeCredits,
        persist,
        renderStill: input.renderStill,
        renderClip: input.renderClip,
      });
      lines.push(`${job.jobId} -> ${stage}`);
    } finally {
      await persist();
    }
  }
  return lines;
}
