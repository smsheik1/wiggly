import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { signRender } from "./photo-store";
import { studioForFormat } from "./draft-worker";
import { chargeThenRender, clipCredits, stillCredits } from "./render-charge";
import type { MemoryFilmLedger } from "./film-ledger";

type Stage = "sheets" | "panels" | "clips";
type RenderStill = (request: { prompt?: string; dest?: string; itemId?: string; aspectRatio?: string; resolution?: string; referencePaths?: string[] }) => Promise<{ dest?: string }>;
type RenderClip = (request: { itemId?: string; duration?: number; dest?: string; videoPath?: string }) => Promise<{ dest?: string; videoPath?: string }>;

async function studioModules(formatId: string) {
  const studio = studioForFormat(formatId);
  const file = (name: string) => import(pathToFileURL(path.join(studio.directory, name)).href);
  const [graph, stills, producer, state, checkpoint, langgraph] = await Promise.all([
    file("graph/graph.mjs"),
    file("graph/stills.mjs"),
    file("graph/producer.mjs"),
    file("graph/state.mjs"),
    file("graph/file-checkpointer.mjs"),
    import(pathToFileURL(path.join(studio.directory, "node_modules/@langchain/langgraph/dist/index.js")).href),
  ]);
  return { graph, stills, producer, state, checkpoint, langgraph, directory: studio.directory };
}

function passedJobs(state: Record<string, unknown>) {
  return (state.passed ?? {}) as Record<string, boolean>;
}

export async function dueStage(state: Record<string, unknown>, formatId = "my-pixar-story"): Promise<Stage | null> {
  if (["awaiting-credits", "awaiting-approval", "awaiting-production", "failed", "done"].includes(String(state.status ?? ""))) return null;
  const passed = passedJobs(state);
  const { graph } = await studioModules(formatId);
  if (passed["character-architect"] && passed["location-scout"]) {
    const approved = (state.approvedAssets ?? {}) as Record<string, unknown>;
    const missing = (graph.requiredAssetTags(state) as string[]).filter((tag) => !approved[tag]);
    if (missing.length > 0) return "sheets";
  }
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
  let graph = new StateGraph(modules.state.PipelineAnnotation);
  if (stage === "sheets") {
    graph = graph
      .addNode("render-sheets", modules.stills.makeSheetStillNode({ renderStill: billStill, runDir: input.runDir }))
      .addNode("asset-approval", modules.graph.makeApprovalNode({ useInterrupt: true }))
      .addEdge(START, "render-sheets")
      .addEdge("render-sheets", "asset-approval")
      .addEdge("asset-approval", END);
  } else if (stage === "panels") {
    graph = graph
      .addNode("render-panels", modules.stills.makePanelStillNode({ renderStill: billStill, runDir: input.runDir }))
      .addNode("animatic-editor", modules.graph.makeAnimaticEditorNode())
      .addNode("animatic-approval", modules.graph.makeAnimaticApprovalNode({ useInterrupt: true }))
      .addEdge(START, "render-panels")
      .addEdge("render-panels", "animatic-editor")
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
  const checkpointer = new modules.checkpoint.FileMemorySaver(path.join(input.runDir, "outputs", "checkpoint.json"));
  const compiled = graph.compile({ checkpointer });
  const config = { configurable: { thread_id: input.jobId } };
  const seed = { ...input.state, status: input.state.status === "writing" ? "running" : input.state.status, renderStage: stage };
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
  const merged = { ...input.state, ...last, ...pause, renderStage: interrupts.length ? stage : undefined };
  const master = merged.masterVideo as { videoPath?: string } | string | undefined;
  const masterPath = typeof master === "string" ? master : master?.videoPath;
  if (!interrupts.length && stage === "clips" && masterPath) {
    try {
      await access(masterPath);
      merged.videoUrl = masterPath;
      merged.status = "done";
    } catch {
      merged.status = "failed";
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
  const state = JSON.parse(await readFile(stateFile, "utf8")) as { assetFiles?: Record<string, string>; videoUrl?: string };
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
  const stills: Array<{ tag: string; url: string }> = [];
  const images: Array<{ mimeType: string; data: string }> = [];
  for (const [tag, file] of Object.entries(state.assetFiles ?? {})) {
    try {
      const bytes = await readFile(file);
      stills.push({ tag, url: signRender(secret, jobId, tag, expiresAt) });
      if (mimeType(file).startsWith("image/")) images.push({ mimeType: mimeType(file), data: bytes.toString("base64") });
    } catch {
      // A missing file is not a picture the person can approve.
    }
  }
  return { stills, images, videoUrl: state.videoUrl };
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
