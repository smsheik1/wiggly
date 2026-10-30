import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { crewPhotoReferences, questionnaireFromStoryboard, studioForFormat, type CrewPhoto } from "./draft-worker";
import { MemoryFilmLedger, type Storyboard } from "./film-ledger";

export const WRITING_JOBS = ["story-director", "character-architect", "location-scout", "storyboard-artist", "seedance-compiler"] as const;
export type WritingJob = (typeof WRITING_JOBS)[number];
const MAX_ATTEMPTS = 3;

const TOOL_NAME: Record<WritingJob, string> = {
  "story-director": "wiggly_story_director",
  "character-architect": "wiggly_character_architect",
  "location-scout": "wiggly_location_scout",
  "storyboard-artist": "wiggly_storyboard_artist",
  "seedance-compiler": "wiggly_seedance_compiler",
};

type Issue = { severity?: string; code?: string; path?: string; message?: string };
type Gate = { isValid?: boolean; issues?: Issue[] };
type CrewSpec = {
  select: (state: Record<string, unknown>) => unknown;
  parse: (raw: unknown) => unknown;
  gate: (out: unknown, input: unknown, state: Record<string, unknown>) => Gate;
  write: (out: unknown, input: unknown) => Record<string, unknown>;
};
type Crew = {
  specs: Record<WritingJob, CrewSpec>;
  retryNotes: (issues: Issue[]) => string;
  reviewerNotes: (state: Record<string, unknown>, agent: string) => string;
  keepValidCharacters: (out: unknown, issues: Issue[]) => Record<string, unknown>;
  mergeCharacters: (kept: Record<string, unknown> | null, out: unknown, state: Record<string, unknown>) => unknown;
  requiredAssetTags: (state: Record<string, unknown>) => string[];
  photoFilesFor: (agent: string, input: unknown, state: Record<string, unknown>) => Record<string, string>;
  loadSkill: (agent: string) => string;
};

export type GateImage = { mimeType: string; data: string };
export type GateResult = {
  ok: boolean;
  message?: string;
  data?: Record<string, unknown>;
  images?: GateImage[];
};

let loaded: { directory: string; crew: Crew } | undefined;

export async function loadCrewGates(formatId = "my-pixar-story"): Promise<Crew> {
  const studio = studioForFormat(formatId);
  if (loaded?.directory === studio.directory) return loaded.crew;
  const graphUrl = pathToFileURL(path.join(studio.directory, "graph/graph.mjs")).href;
  const modelsUrl = pathToFileURL(path.join(studio.directory, "config/models.mjs")).href;
  const photosUrl = pathToFileURL(path.join(studio.directory, "graph/deep-agent-node.mjs")).href;
  const graph = await import(graphUrl);
  const models = await import(modelsUrl);
  const photos = await import(photosUrl);
  const crew: Crew = {
    specs: graph.AGENT_SPECS,
    retryNotes: graph.retryNotes,
    reviewerNotes: graph.reviewerNotes,
    keepValidCharacters: graph.keepValidCharacters,
    mergeCharacters: graph.mergeCharacters,
    requiredAssetTags: graph.requiredAssetTags,
    photoFilesFor: photos.photoFilesFor,
    loadSkill: models.loadSkill,
  };
  loaded = { directory: studio.directory, crew };
  return crew;
}

function mimeType(file: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function schemaIssues(error: unknown): Issue[] {
  const zod = error as { issues?: Array<{ path?: Array<string | number>; message?: string }> };
  if (Array.isArray(zod.issues) && zod.issues.length > 0) {
    return zod.issues.map((issue) => {
      const joined = (issue.path ?? []).join(".");
      return {
        severity: "error",
        code: "SCHEMA_REJECTED",
        message: joined ? `${joined}: ${issue.message}` : String(issue.message ?? "The draft did not match the schema."),
        ...(joined ? { path: joined } : {}),
      };
    });
  }
  const message = error instanceof Error ? error.message : "The draft did not parse.";
  return [{ severity: "error", code: "SCHEMA_REJECTED", message }];
}

function rejectionTarget(state: Record<string, unknown>) {
  const approval = state.animaticApproval as { decision?: string; target?: string } | undefined;
  if (approval?.decision !== "reject") return null;
  return approval.target === "story-director" ? "story-director" : "storyboard-artist";
}

function nextTool(job: WritingJob, state: Record<string, unknown>) {
  const passed = (state.passed ?? {}) as Record<string, boolean>;
  if (job === "story-director") return "Call wiggly_character_architect and wiggly_location_scout, in either order.";
  if (job === "character-architect" && !passed["location-scout"]) return "wiggly_location_scout";
  if (job === "location-scout" && !passed["character-architect"]) return "wiggly_character_architect";
  return "wiggly_get_draft";
}

function lockReason(job: WritingJob, state: Record<string, unknown>, crew: Crew) {
  const passed = (state.passed ?? {}) as Record<string, boolean>;
  const target = rejectionTarget(state);
  if (target) {
    if (job === "seedance-compiler") return `The animatic was rejected. Call ${TOOL_NAME[target]}. Seedance stays locked until a later animatic approval passes.`;
    if (job !== target) return `The animatic was sent back to ${TOOL_NAME[target]}.`;
    return null;
  }
  if ((job === "character-architect" || job === "location-scout") && !passed["story-director"]) {
    return "Call wiggly_story_director first. A passed story director is the only thing that unlocks the character architect and the location scout.";
  }
  if (job === "storyboard-artist") {
    if (!passed["character-architect"] || !passed["location-scout"]) {
      return "Call wiggly_character_architect and wiggly_location_scout first. Both look jobs have to pass before the storyboard.";
    }
    const missing = crew.requiredAssetTags(state).filter((tag) => !(state.approvedAssets as Record<string, unknown> | undefined)?.[tag]);
    if (missing.length > 0) return `Approve the sheet assets first: ${missing.join(", ")}. Call wiggly_approve_draft.`;
  }
  if (job === "seedance-compiler") {
    const timings = state.approvedShotTimings as unknown[] | undefined;
    if (!timings?.length) return "The animatic is not approved yet. Call wiggly_get_draft, then wiggly_approve_draft.";
  }
  return null;
}

async function photoImages(job: WritingJob, input: unknown, state: Record<string, unknown>, crew: Crew) {
  if (job !== "character-architect") return [];
  const files = crew.photoFilesFor(job, input, state);
  const images: GateImage[] = [];
  for (const hostPath of Object.values(files)) {
    await access(hostPath);
    const bytes = await readFile(hostPath);
    images.push({ mimeType: mimeType(hostPath), data: bytes.toString("base64") });
  }
  return images;
}

export async function ensureWritingState(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  runsRoot: string;
  photos?: CrewPhoto[];
}) {
  const job = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId);
  if (!job?.storyboard) throw new Error("This job has no storyboard. Call wiggly_submit_draft first.");
  const runDir = path.join(input.runsRoot, input.jobId);
  const stateFile = job.stateFile ?? path.join(runDir, "outputs", "state.json");
  if (job.stateFile) return job.stateFile;
  try {
    await access(stateFile);
    input.ledger.setRun(input.accountId, input.jobId, { runId: input.jobId, stateFile });
    return stateFile;
  } catch {
    // A new film gets a writing shell.
  }
  await mkdir(path.dirname(stateFile), { recursive: true });
  const storyboard = job.storyboard as Storyboard;
  const state = {
    status: "writing",
    inputs: {
      ...questionnaireFromStoryboard(storyboard),
      photoReferences: crewPhotoReferences(storyboard, input.photos ?? []),
    },
    attempts: {},
    passed: {},
    pendingApproval: [],
  };
  await writeFile(stateFile, JSON.stringify(state));
  input.ledger.setRun(input.accountId, input.jobId, { runId: input.jobId, stateFile });
  return stateFile;
}

export async function runWritingJob(input: {
  job: WritingJob;
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId?: string;
  draft?: unknown;
  photos?: CrewPhoto[];
  runsRoot: string;
  loadCrew?: (formatId: string) => Promise<Crew>;
}): Promise<GateResult> {
  const account = input.ledger.exportState(input.accountId);
  const jobRow = input.jobId
    ? account.jobs.find((item) => item.jobId === input.jobId)
    : [...account.jobs].reverse().find((item) => item.storyboard);
  if (!jobRow?.storyboard) return { ok: false, message: "No draft job yet. Call wiggly_submit_draft first." };
  const formatId = jobRow.storyboard.format?.trim() || "my-pixar-story";
  const crew = await (input.loadCrew ?? loadCrewGates)(formatId);
  const spec = crew.specs[input.job];
  let stateFile: string;
  try {
    stateFile = await ensureWritingState({
      ledger: input.ledger,
      accountId: input.accountId,
      jobId: jobRow.jobId,
      runsRoot: input.runsRoot,
      photos: input.photos,
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The film state could not be opened." };
  }
  const state = JSON.parse(await readFile(stateFile, "utf8")) as Record<string, unknown>;
  const passed = { ...((state.passed ?? {}) as Record<string, boolean>) };
  const attempts = { ...((state.attempts ?? {}) as Record<string, number>) };
  const target = rejectionTarget(state);
  const reopened = target === input.job;
  if (reopened) {
    const notes = crew.reviewerNotes(state, input.job);
    const round = `${input.job}:${notes}`;
    if (state.revisionRound !== round) {
      attempts[input.job] = 0;
      delete passed[input.job];
      state.revisionRound = round;
    }
  }
  state.passed = passed;
  state.attempts = attempts;
  if (passed[input.job] && !reopened) {
    return { ok: true, data: { passed: true, attempt: attempts[input.job] ?? 1, next: nextTool(input.job, state) } };
  }
  const locked = lockReason(input.job, state, crew);
  if (locked) return { ok: false, message: locked };
  let selected: unknown;
  try {
    selected = spec.select(state);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The input selector failed." };
  }
  const images = await photoImages(input.job, selected, state, crew);
  const notes = crew.reviewerNotes(state, input.job);
  if (input.draft === undefined) {
    await writeFile(stateFile, JSON.stringify(state));
    return {
      ok: true,
      images,
      data: {
        skill: crew.loadSkill(input.job),
        input: selected,
        attempt: (attempts[input.job] ?? 0) + 1,
        ...(notes ? { retryNotes: notes } : {}),
      },
    };
  }
  const used = attempts[input.job] ?? 0;
  if (used >= MAX_ATTEMPTS) {
    state.status = "failed";
    await writeFile(stateFile, JSON.stringify(state));
    input.ledger.markFailed(input.accountId, jobRow.jobId, `${TOOL_NAME[input.job]} failed the gate 3 times.`);
    return { ok: false, message: `${TOOL_NAME[input.job]} failed the gate 3 times. The film is stopped.` };
  }
  const attempt = used + 1;
  let parsed: unknown;
  try {
    parsed = spec.parse(input.draft);
  } catch (error) {
    const issues = schemaIssues(error);
    attempts[input.job] = attempt;
    state.attempts = attempts;
    state.gateIssues = { ...((state.gateIssues ?? {}) as Record<string, Issue[]>), [input.job]: issues };
    await writeFile(stateFile, JSON.stringify(state));
    return { ok: false, message: crew.retryNotes(issues), data: { attempt, retryNotes: crew.retryNotes(issues) } };
  }
  if (input.job === "character-architect" && state.keptCharacters) {
    parsed = crew.mergeCharacters(state.keptCharacters as Record<string, unknown>, parsed, state);
  }
  const gate = spec.gate(parsed, selected, state) ?? {};
  const issues = gate.issues ?? [];
  if (!gate.isValid) {
    attempts[input.job] = attempt;
    state.attempts = attempts;
    state.gateIssues = { ...((state.gateIssues ?? {}) as Record<string, Issue[]>), [input.job]: issues };
    if (input.job === "character-architect") {
      state.keptCharacters = { ...((state.keptCharacters ?? {}) as Record<string, unknown>), ...crew.keepValidCharacters(parsed, issues) };
    }
    await writeFile(stateFile, JSON.stringify(state));
    const retry = crew.retryNotes(issues);
    return { ok: false, message: retry, data: { attempt, retryNotes: retry } };
  }
  const written = spec.write(parsed, selected);
  attempts[input.job] = attempt;
  passed[input.job] = true;
  const saved: Record<string, unknown> = {
    ...state,
    ...written,
    attempts,
    passed,
    gateIssues: { ...((state.gateIssues ?? {}) as Record<string, Issue[]>), [input.job]: issues },
  };
  if (input.job === "character-architect") delete saved.keptCharacters;
  if (reopened) {
    saved.animaticApproval = null;
    saved.revisionNotes = { ...((state.revisionNotes ?? {}) as Record<string, string>), "story-director": "", "storyboard-artist": "" };
  }
  await writeFile(stateFile, JSON.stringify(saved));
  return { ok: true, data: { passed: true, attempt, next: nextTool(input.job, saved) } };
}
