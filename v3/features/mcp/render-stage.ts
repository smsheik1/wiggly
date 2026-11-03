import { access, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runtimeImport } from "./runtime-import";
import { signRender } from "./photo-store";
import { publicOrigin } from "./public-origin";
import { defaultClip, defaultStill, requireFormatId, studioForFormat } from "./draft-worker";
import { chargeThenRender, clipCredits, dropChargeKey, paidItemsPath, stillCredits } from "./render-charge";
import type { MemoryFilmLedger } from "./film-ledger";

type Stage = "sheets" | "panels" | "clips";
type RenderStill = (request: { prompt?: string; dest?: string; itemId?: string; aspectRatio?: string; resolution?: string; referencePaths?: string[] }) => Promise<{ dest?: string }>;
type RenderClip = (request: { itemId?: string; duration?: number; dest?: string; videoPath?: string; clip?: unknown; state?: unknown; runDir?: string; engine?: string }) => Promise<{ dest?: string; videoPath?: string }>;

async function studioModules(formatId: string) {
  const studio = studioForFormat(formatId);
  const file = (name: string) => runtimeImport(pathToFileURL(path.join(studio.directory, name)).href);
  const [graph, stills, producer, state, checkpoint, langgraph] = await Promise.all([
    file("graph/graph.mjs"),
    file("graph/stills.mjs"),
    file("graph/producer.mjs"),
    file("graph/state.mjs"),
    file("graph/file-checkpointer.mjs"),
    runtimeImport(pathToFileURL(path.join(studio.directory, "node_modules/@langchain/langgraph/dist/index.js")).href),
  ]);
  return { graph, stills, producer, state, checkpoint, langgraph, directory: studio.directory };
}

function passedJobs(state: Record<string, unknown>) {
  return (state.passed ?? {}) as Record<string, boolean>;
}

export async function dueStage(state: Record<string, unknown>, formatId = "my-pixar-story"): Promise<Stage | null> {
  const status = String(state.status ?? "");
  if (["awaiting-credits", "awaiting-production", "failed", "done"].includes(status)) return null;
  const passed = passedJobs(state);
  const { graph } = await studioModules(formatId);
  if (passed["character-architect"] && passed["location-scout"]) {
    const approved = (state.approvedAssets ?? {}) as Record<string, unknown>;
    const missing = (graph.requiredAssetTags(state, { includeProps: true }) as string[]).filter((tag) => !approved[tag]);
    if (missing.length > 0) {
      if (status === "awaiting-approval") {
        const assetFiles = (state.assetFiles ?? {}) as Record<string, string>;
        const hasAllFiles = missing.every((tag) => Boolean(assetFiles[tag]));
        if (!hasAllFiles) return "sheets";
        return null;
      }
      return "sheets";
    }
  }
  if (status === "awaiting-approval") return null;
  if (passed["storyboard-artist"] && !(state.approvedShotTimings as unknown[] | undefined)?.length) return "panels";
  if (passed["seedance-compiler"] && (state.productionApproval as { decision?: string } | undefined)?.decision !== "approve" && !state.masterVideo) return "clips";
  return null;
}

function interruptStatus(value: { kind?: string; itemId?: string; credits?: number; missing?: string[] } = {}) {
  if (value.kind === "credits") return { status: "awaiting-credits", pendingApproval: [], creditItemId: value.itemId, credits: value.credits };
  if (value.kind === "production-approval") return { status: "awaiting-production", pendingApproval: ["production"] };
  if (value.kind === "animatic-approval") return { status: "awaiting-approval", pendingApproval: ["animatic"] };
  return { status: "awaiting-approval", pendingApproval: value.missing ?? [value.kind ?? "gate"] };
}

export async function advanceRender(input: {
  state: Record<string, unknown>;
  runDir: string;
  formatId?: string;
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  renderStill: RenderStill;
  renderClip: RenderClip;
  resume?: Record<string, unknown>;
}) {
  const formatId = input.formatId ?? "my-pixar-story";
  const stage = (input.state.renderStage as Stage | undefined) ?? await dueStage(input.state, formatId);
  if (!stage) return null;
  const modules = await studioModules(formatId);
  const { StateGraph, START, END, Command } = modules.langgraph;
  const billStill = (request: { itemId?: string }) => chargeThenRender({
    ledger: input.ledger,
    accountId: input.accountId,
    jobId: input.jobId,
    runDir: input.runDir,
    itemId: String(request.itemId ?? ""),
    credits: stillCredits(),
    render: () => input.renderStill(request),
  });
  const billClip = async (request: { itemId?: string; duration?: number }) => {
    const saved = await chargeThenRender({
      ledger: input.ledger,
      accountId: input.accountId,
      jobId: input.jobId,
      runDir: input.runDir,
      itemId: String(request.itemId ?? ""),
      credits: clipCredits(request.duration ?? 1),
      render: () => input.renderClip(request),
    });
    const file = saved.dest ?? saved.videoPath;
    return { ...saved, dest: file, videoPath: file, clipId: request.itemId };
  };
  const halted = (s: Record<string, unknown>) => ["escalated", "failed", "awaiting-approval", "awaiting-production"].includes(String(s.status ?? ""));
  let graph = new StateGraph(modules.state.PipelineAnnotation);
  if (stage === "sheets") {
    graph = graph
      .addNode("render-sheets", modules.stills.makeSheetStillNode({ renderStill: billStill, runDir: input.runDir }))
      .addNode("asset-approval", modules.graph.makeApprovalNode({ useInterrupt: true, includeProps: true }))
      .addEdge(START, "render-sheets")
      .addConditionalEdges("render-sheets", (s: Record<string, unknown>) => (halted(s) ? END : "asset-approval"), ["asset-approval", END])
      .addEdge("asset-approval", END);
  } else if (stage === "panels") {
    graph = graph
      .addNode("render-panels", modules.stills.makePanelStillNode({ renderStill: billStill, runDir: input.runDir }))
      .addNode("animatic-editor", modules.graph.makeAnimaticEditorNode({ runDir: input.runDir }))
      .addNode("animatic-approval", modules.graph.makeAnimaticApprovalNode({ useInterrupt: true }))
      .addEdge(START, "render-panels")
      .addConditionalEdges("render-panels", (s: Record<string, unknown>) => (halted(s) ? END : "animatic-editor"), ["animatic-editor", END])
      .addEdge("animatic-editor", "animatic-approval")
      .addEdge("animatic-approval", END);
  } else {
    graph = graph
      .addNode("production-approval", modules.producer.makeProductionApprovalNode({ useInterrupt: true }))
      .addNode("producer", modules.producer.makeProducerNode({ renderClip: billClip, runDir: input.runDir }))
      .addNode("assembly", modules.producer.makeAssemblyNode({ runDir: input.runDir }))
      .addEdge(START, "production-approval")
      .addEdge("production-approval", "producer")
      .addEdge("producer", "assembly")
      .addEdge("assembly", END);
  }
  if (!input.resume) {
    const checkpointPath = path.join(input.runDir, "outputs", "checkpoint.json");
    await rm(checkpointPath, { force: true });
  }
  const checkpointer = new modules.checkpoint.FileMemorySaver(path.join(input.runDir, "outputs", "checkpoint.json"));
  const compiled = graph.compile({ checkpointer });
  const config = { configurable: { thread_id: input.jobId } };
  const status = input.state.status === "writing" || (input.state.status === "awaiting-approval" && !input.resume)
    ? "running"
    : input.state.status;
  const seed = { ...input.state, status, renderStage: stage };
  const payload = input.resume ? new Command({ resume: input.resume }) : seed;
  let last = seed;
  try {
    last = await compiled.invoke(payload, config);
  } catch (error) {
    const named = error as { name?: string; interrupts?: Array<{ value?: { kind?: string } }> };
    if (named.name !== "GraphInterrupt" && named.name !== "NodeInterrupt") throw error;
  }
  const snap = await compiled.getState(config);
  const interrupts = (snap?.tasks ?? []).flatMap((task: { interrupts?: Array<{ value?: { kind?: string; itemId?: string; credits?: number; missing?: string[] } }> }) => task.interrupts ?? []);
  const pause = interrupts[0]?.value ? interruptStatus(interrupts[0].value) : {};
  const currentValues = (snap?.values ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {
    ...input.state,
    ...currentValues,
    ...(last !== seed ? last : {}),
    ...pause,
    assetFiles: {
      ...((input.state.assetFiles ?? {}) as Record<string, string>),
      ...((currentValues.assetFiles ?? {}) as Record<string, string>),
      ...(last !== seed ? (((last as Record<string, unknown>).assetFiles ?? {}) as Record<string, string>) : {}),
    },
    renderStage: interrupts.length ? stage : undefined,
  };
  const master = merged.masterVideo as { videoPath?: string } | string | undefined;
  const masterPath = typeof master === "string" ? master : master?.videoPath;
  if (!interrupts.length) {
    if (stage === "clips" && masterPath) {
      try {
        await access(masterPath);
        const secret = process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET || "wiggly-draft";
        const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
        merged.videoUrl = `${publicOrigin()}${signRender(secret, input.jobId, "master-video", expiresAt)}`;
        const assetFiles = { ...((merged.assetFiles ?? {}) as Record<string, string>), "master-video": masterPath };
        merged.assetFiles = assetFiles;
        merged.status = "done";
      } catch {
        merged.status = "failed";
      }
    } else if (merged.status === "awaiting-production" || merged.status === "awaiting-approval") {
      merged.renderStage = stage;
      const clipTags = Object.keys((merged.assetFiles ?? {}) as Record<string, string>).filter((k) => k.startsWith("clip-"));
      const latestClipTag = clipTags.sort().pop();
      if (latestClipTag) {
        const secret = process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET || "wiggly-draft";
        const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
        merged.videoUrl = `${publicOrigin()}${signRender(secret, input.jobId, latestClipTag, expiresAt)}`;
      }
    } else if (input.resume) {
      merged.status = "running";
      merged.pendingApproval = [];
    }
  }
  return merged;
}

export async function readAssetFiles(stateFile: string) {
  const state = JSON.parse(await readFile(stateFile, "utf8")) as { assetFiles?: Record<string, string> };
  return state.assetFiles ?? {};
}

function mimeType(file: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp4") return "video/mp4";
  return "image/jpeg";
}

export async function draftMedia(stateFile: string, jobId: string, secret: string) {
  const state = JSON.parse(await readFile(stateFile, "utf8")) as {
    assetFiles?: Record<string, string>;
    videoUrl?: string;
    masterVideo?: { videoPath?: string } | string;
    animaticVideo?: string;
  };
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
  const stills: Array<{ tag: string; url: string }> = [];
  const images: Array<{ mimeType: string; data: string }> = [];
  const origin = publicOrigin();
  for (const [tag, file] of Object.entries(state.assetFiles ?? {})) {
    if (tag === "master-video" || tag === "animatic-video" || tag.startsWith("clip-")) continue;
    try {
      const bytes = await readFile(file);
      stills.push({ tag, url: `${origin}${signRender(secret, jobId, tag, expiresAt)}` });
      if (mimeType(file).startsWith("image/")) images.push({ mimeType: mimeType(file), data: bytes.toString("base64") });
    } catch {
      // A missing file is not a picture the person can approve.
    }
  }
  let videoUrl = state.videoUrl;
  const master = typeof state.masterVideo === "string" ? state.masterVideo : state.masterVideo?.videoPath;
  const masterPath = state.assetFiles?.["master-video"] ?? master;
  if (masterPath) {
    if (!videoUrl || (!videoUrl.startsWith("http://") && !videoUrl.startsWith("https://"))) {
      videoUrl = `${origin}${signRender(secret, jobId, "master-video", expiresAt)}`;
    }
  } else {
    const clipTags = Object.keys(state.assetFiles ?? {}).filter((k) => k.startsWith("clip-"));
    const latestClipTag = clipTags.sort().pop();
    if (latestClipTag && state.assetFiles?.[latestClipTag]) {
      if (!videoUrl || (!videoUrl.startsWith("http://") && !videoUrl.startsWith("https://"))) {
        videoUrl = `${origin}${signRender(secret, jobId, latestClipTag, expiresAt)}`;
      }
    } else {
      const animaticPath = state.assetFiles?.["animatic-video"] ?? state.animaticVideo;
      if (animaticPath) {
        if (!videoUrl || (!videoUrl.startsWith("http://") && !videoUrl.startsWith("https://"))) {
          videoUrl = `${origin}${signRender(secret, jobId, "animatic-video", expiresAt)}`;
        }
      }
    }
  }
  return { stills, images, videoUrl };
}

export function normalizeShotId(raw: string): string {
  return raw.trim().replace(/^(shot|frame|panel)\s*/i, "").replace("-", ".");
}

export async function rerollPanel(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  shotId: string;
  promptNotes?: string;
  renderStill?: RenderStill;
}) {
  const job = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId);
  if (!job?.stateFile) return { ok: false, message: "This job has no state file to reroll." };

  const state = JSON.parse(await readFile(job.stateFile, "utf8")) as Record<string, unknown>;
  const formatId = requireFormatId(job.storyboard?.format);
  const runDir = path.dirname(path.dirname(job.stateFile));

  const shotId = normalizeShotId(input.shotId);
  const validShots = ((state.approvedShotTimings as Array<{ shotId?: string }> | undefined) ?? [])
    .map((s) => s.shotId)
    .filter(Boolean) as string[];

  if (validShots.length > 0 && !validShots.includes(shotId)) {
    return {
      ok: false,
      message: `Shot "${input.shotId}" does not exist. Available shots in this film: ${validShots.join(", ")}.`,
    };
  }

  // 1. Invalidate item from paid-items.json and charges.json
  const paidFile = paidItemsPath(runDir);
  try {
    const paid = JSON.parse(await readFile(paidFile, "utf8")) as Record<string, string>;
    delete paid[shotId];
    await writeFile(paidFile, JSON.stringify(paid));
  } catch {
    // Paid file may not exist yet
  }
  await dropChargeKey(runDir, shotId);

  // Remove the old image file from disk
  const oldPath = path.join(runDir, "storyboard-panels", `${shotId}.png`);
  await rm(oldPath, { force: true });

  // 2. Persist prompt notes
  if (input.promptNotes?.trim()) {
    const panelNotes = { ...((state.panelNotes as Record<string, string> | undefined) ?? {}) };
    panelNotes[shotId] = input.promptNotes.trim();
    state.panelNotes = panelNotes;
  }

  // 3. Compile panel prompt and references
  const modules = await studioModules(formatId);
  const output = (state.storyboardArtist as { output?: unknown } | undefined)?.output;
  if (!output) return { ok: false, message: "This job has no storyboard output to render panels from." };

  const studioDir = modules.directory;
  const inputModule = await runtimeImport(pathToFileURL(path.join(studioDir, "crew/storyboard-artist/input.mjs")).href);
  const compileModule = await runtimeImport(pathToFileURL(path.join(studioDir, "crew/storyboard-artist/compile.mjs")).href);

  const storyboardInput = inputModule.selectStoryboardArtistInput(state);
  const panels = compileModule.compilePanels(output, storyboardInput) as Array<{
    shotId: string;
    file: string;
    fullPrompt: string;
    aspect?: string;
    resolution?: string;
    references?: Array<{ tag?: string; imageTag?: string }>;
  }>;

  const targetPanel = panels.find((p) => p.shotId === shotId);
  if (!targetPanel) return { ok: false, message: `Could not find panel configuration for shot ${shotId}.` };

  const known = { ...((state.assetFiles as Record<string, string> | undefined) ?? {}) };
  const referencePaths = (targetPanel.references ?? []).map((ref) => known[ref.imageTag ?? ""] || known[ref.tag ?? ""]).filter(Boolean);

  let promptText = targetPanel.fullPrompt;
  const note = (state.panelNotes as Record<string, string> | undefined)?.[shotId];
  if (note) {
    promptText += ` DIRECTIVE: ${note}`;
  }

  // 4. Render and charge only that one still (8 credits)
  const stillRenderer = input.renderStill ?? (await defaultStill(formatId));
  const saved = await chargeThenRender({
    ledger: input.ledger,
    accountId: input.accountId,
    jobId: input.jobId,
    runDir,
    itemId: shotId,
    credits: stillCredits(),
    render: () => stillRenderer({
      prompt: promptText,
      aspectRatio: targetPanel.aspect || "16:9",
      resolution: targetPanel.resolution || "2K",
      dest: path.join(runDir, "storyboard-panels", targetPanel.file),
      referencePaths,
    }),
  });

  const destFile = saved.dest;
  if (!destFile) return { ok: false, message: `Render failed for shot ${shotId}.` };

  const assetFiles = { ...known, [shotId]: destFile };
  state.assetFiles = assetFiles;

  // 5. Recompile animatic preview video with the new frame in place
  if (typeof modules.graph.buildAnimatic === "function") {
    try {
      const outPath = path.join(runDir, "animatic_preview.mp4");
      const anim = await modules.graph.buildAnimatic({
        sd: state.storyDirector,
        runDir,
        outPath,
        framesDir: path.join(runDir, "storyboard-panels"),
        framePaths: assetFiles,
        allowMissingFrames: true,
      });
      if (anim?.outPath) {
        state.assetFiles = { ...assetFiles, "animatic-video": anim.outPath };
        state.animaticVideo = anim.outPath;
      }
      if (anim?.approvedShotTimings?.length) {
        state.approvedShotTimings = anim.approvedShotTimings;
      }
    } catch (err) {
      console.warn(`[rerollPanel] Warning: animatic video re-stitch failed (${(err as Error).message})`);
    }
  }

  await writeFile(job.stateFile, JSON.stringify(state, null, 2));

  return {
    ok: true,
    data: {
      shotId,
      creditsSpent: stillCredits(),
      file: destFile,
      message: `Rerolled shot ${shotId} successfully for ${stillCredits()} credits.`,
    },
  };
}

export async function picturesReady(stateFile: string) {
  const files = await readAssetFiles(stateFile);
  const paths = Object.values(files);
  if (paths.length === 0) return false;
  for (const file of paths) {
    try {
      await access(file);
    } catch {
      return false;
    }
  }
  return true;
}

export async function renderSingleClip(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  clipId: string | number;
  durationSec?: number;
  force?: boolean;
  reroll?: boolean;
  prompt?: string;
  promptNotes?: string;
  renderClip?: RenderClip;
  async?: boolean;
  onComplete?: () => Promise<void> | void;
}): Promise<{ ok: boolean; data?: Record<string, unknown>; message?: string }> {
  const job = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId);
  if (!job?.stateFile) return { ok: false, message: "This job has no state file to render clips from." };
  const stateFile = job.stateFile;

  const state = JSON.parse(await readFile(stateFile, "utf8")) as Record<string, unknown>;
  const formatId = requireFormatId(job.storyboard?.format);
  const runDir = path.dirname(path.dirname(stateFile));

  const compilerOut = (state.seedanceCompiler as { output?: { segments?: Array<{
    segmentId: number | string;
    generationPayload?: { durationSec?: number; engine?: string; prompt?: string };
    totalDurationSec?: number;
    title?: string;
    references?: Array<{ sourceTag?: string; assetKey?: string; tag?: string }>;
  }> } } | undefined)?.output;

  const segments = compilerOut?.segments ?? [];
  if (!segments.length) {
    return { ok: false, message: "This job has no compiled Seedance segments to render clips from. Call wiggly_seedance_compiler first." };
  }

  const normId = String(input.clipId).replace(/^(clip|segment|part)[-_\s]*/i, "").trim();
  const targetSeg = segments.find((s) => String(s.segmentId) === normId);
  if (!targetSeg) {
    const validIds = segments.map((s) => s.segmentId).join(", ");
    return { ok: false, message: `Clip "${input.clipId}" does not exist. Available clips in this film: ${validIds}.` };
  }

  const duration = input.durationSec ?? targetSeg.generationPayload?.durationSec ?? targetSeg.totalDurationSec ?? 10;
  const credits = clipCredits(duration);
  const itemId = String(targetSeg.segmentId);
  const clipTag = `clip-${itemId}`;

  // 1. If clip is currently rendering in background, return progress immediately (prevents duplicate simultaneous renders)
  const active = (state.renderingClip as { clipId?: string | number; startedAt?: number; durationSec?: number; credits?: number } | undefined);
  if (active && String(active.clipId) === itemId && (Date.now() - (active.startedAt ?? 0)) < 15 * 60 * 1000 && !input.force) {
    const elapsedSec = Math.round((Date.now() - (active.startedAt ?? 0)) / 1000);
    return {
      ok: true,
      data: {
        clipId: itemId,
        status: "rendering",
        durationSec: duration,
        elapsedSec,
        retryAfterSec: 15,
        message: `Clip ${itemId} is currently rendering on GPUs (~3-4 min, ${elapsedSec}s elapsed). Poll wiggly_get_draft in 15 seconds.`,
      },
    };
  }

  // 2. Prepare render / re-render: invalidate any previous take on disk and in cache
  const existingPath = (state.assetFiles as Record<string, string> | undefined)?.[clipTag];
  const shouldReroll = Boolean(existingPath || input.reroll || input.force);
  const paidFile = paidItemsPath(runDir);
  try {
    const paid = JSON.parse(await readFile(paidFile, "utf8")) as Record<string, string>;
    delete paid[itemId];
    await writeFile(paidFile, JSON.stringify(paid));
  } catch {}
  await dropChargeKey(runDir, itemId);

  const assetFiles = { ...((state.assetFiles as Record<string, string> | undefined) ?? {}) };
  delete assetFiles[clipTag];
  state.assetFiles = assetFiles;

  const renderedClips = Array.isArray(state.renderedClips)
    ? (state.renderedClips as Array<{ clipId?: string | number }>).filter((c) => String(c.clipId) !== itemId)
    : [];
  state.renderedClips = renderedClips;

  if (existingPath) {
    try {
      await rm(existingPath, { force: true });
    } catch {}
  }

  if (input.prompt?.trim()) {
    (targetSeg as { compiledPrompt?: string }).compiledPrompt = input.prompt.trim();
    targetSeg.generationPayload = {
      ...(targetSeg.generationPayload ?? {}),
      prompt: input.prompt.trim(),
    };
  }

  if (input.promptNotes?.trim()) {
    const clipNotes = { ...((state.clipNotes as Record<string, string> | undefined) ?? {}) };
    clipNotes[itemId] = input.promptNotes.trim();
    state.clipNotes = clipNotes;
    const currentPrompt = (targetSeg as { compiledPrompt?: string }).compiledPrompt ?? "";
    (targetSeg as { compiledPrompt?: string }).compiledPrompt = currentPrompt
      ? `${currentPrompt}\n\n[DIRECTOR NOTES]: ${input.promptNotes.trim()}`
      : input.promptNotes.trim();
  }

  // 3. Check credit balance before starting
  const account = input.ledger.exportState(input.accountId);
  if (account.monthlyCredits + account.purchasedCredits < credits) {
    return {
      ok: false,
      message: `Insufficient credits. Rendering clip ${itemId} (${duration}s) requires ${credits} credits, but current balance is ${account.monthlyCredits + account.purchasedCredits}.`,
    };
  }

  // The actual render execution routine
  const executeRender = async () => {
    // If re-rendering a clip that was previously rendered, drop its paid item and charges
    const paidFile = paidItemsPath(runDir);
    try {
      const paid = JSON.parse(await readFile(paidFile, "utf8")) as Record<string, string>;
      delete paid[itemId];
      await writeFile(paidFile, JSON.stringify(paid));
    } catch {
      // Paid file may not exist yet
    }
    await dropChargeKey(runDir, itemId);

    const clipRenderer = input.renderClip ?? (await defaultClip(formatId));
    const saved = await chargeThenRender({
      ledger: input.ledger,
      accountId: input.accountId,
      jobId: input.jobId,
      runDir,
      itemId,
      credits,
      render: () => clipRenderer({
        clip: targetSeg,
        runDir,
        state,
        itemId,
        engine: targetSeg.generationPayload?.engine ?? "seedance-2.5",
        duration,
      }),
    });

    const destFile = saved.dest ?? saved.videoPath;
    if (!destFile) throw new Error(`Render failed for clip ${itemId}.`);

    let latestState = state;
    try {
      latestState = { ...state, ...(JSON.parse(await readFile(stateFile, "utf8")) as Record<string, unknown>) };
    } catch {}
    delete latestState.renderingClip;
    latestState.seedanceCompiler = state.seedanceCompiler;

    const assetFiles = { ...((latestState.assetFiles as Record<string, string> | undefined) ?? {}), [clipTag]: destFile };
    latestState.assetFiles = assetFiles;

    const renderedClips = Array.isArray(latestState.renderedClips) ? [...(latestState.renderedClips as Array<{ clipId?: string | number }>)] : [];
    const existingIdx = renderedClips.findIndex((c) => String(c.clipId) === itemId);
    const entry = { clipId: targetSeg.segmentId, videoPath: destFile, durationSec: duration };
    if (existingIdx >= 0) renderedClips[existingIdx] = entry;
    else renderedClips.push(entry);
    latestState.renderedClips = renderedClips;

    // Sign URL for immediate viewing
    const secret = process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET || "wiggly-draft";
    const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
    const videoUrl = `${publicOrigin()}${signRender(secret, input.jobId, clipTag, expiresAt)}`;
    latestState.videoUrl = videoUrl;

    if (renderedClips.length < segments.length) {
      latestState.status = "awaiting-production";
      latestState.pendingApproval = ["production"];
      latestState.renderStage = "clips";
    }

    await writeFile(stateFile, JSON.stringify(latestState, null, 2));
    await input.onComplete?.();
    return { destFile, videoUrl };
  };

  if (input.async) {
    state.renderingClip = {
      clipId: itemId,
      startedAt: Date.now(),
      durationSec: duration,
      credits,
    };
    await writeFile(stateFile, JSON.stringify(state, null, 2));

    // Launch in background
    executeRender().catch(async (err) => {
      console.error(`[renderSingleClip] Background render error:`, err);
      try {
        const latest = JSON.parse(await readFile(stateFile, "utf8")) as Record<string, unknown>;
        delete latest.renderingClip;
        await writeFile(stateFile, JSON.stringify(latest, null, 2));
      } catch {}
    });

    return {
      ok: true,
      data: {
        clipId: itemId,
        status: "rendering",
        durationSec: duration,
        creditsReserved: credits,
        retryAfterSec: 15,
        message: shouldReroll
          ? `Clip ${itemId} (${duration}s) re-render started on Replicate GPUs with updated prompt (~3-4 minutes, ${credits} credits). Poll wiggly_get_draft in 15 seconds to check when it completes.`
          : `Clip ${itemId} (${duration}s) render started on Replicate GPUs (~3-4 minutes, ${credits} credits). Poll wiggly_get_draft in 15 seconds to check when it completes.`,
      },
    };
  }

  // Synchronous execution (for tests or explicit sync)
  const result = await executeRender();
  return {
    ok: true,
    data: {
      clipId: itemId,
      status: "ready",
      creditsSpent: credits,
      durationSec: duration,
      videoPath: result.destFile,
      videoUrl: result.videoUrl,
      message: `Rendered clip ${itemId} (${duration}s) successfully for ${credits} credits. Preview URL: ${result.videoUrl}`,
    },
  };
}
