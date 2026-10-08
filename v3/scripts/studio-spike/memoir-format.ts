import { cpSync, realpathSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { pathToFileURL } from "node:url";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { askActiveAgent } from "../../lib/agent-bridge.js";
import { StudioProduction, memoirReviewModality, memoirReviewCoverage, memoirFilmReviewCriteria, type InputVersions, type WorkerLease, type TicketLimits } from "../../lib/studio-production.js";
import { workspaceAgent, hash } from "./harness.js";
import { publicationTool, productionMiddleware, reviewTool } from "./production-tools.js";

export const MEMOIR_PACKAGE_SHA256 = "bb325df5475617628394527945b215de6d92334fb5459ddfeea289530d7a8724";
export const memoirModels = { writer: "moonshotai/kimi-k3", execution: "deepseek/deepseek-v4.1-flash", imageProvider: "decart/fp4", textBackup: "sail-research/fp4" } as const;

/** Reuse the installed official Format. Never apply events to its legacy coordinator. */
export async function loadMemoirFormat(kit: string) {
  const load = (name: string) => import(pathToFileURL(join(kit, "runtime", `${name}.mjs`)).href);
  const [contracts, studio, media, remotion, workflow, assemble, instructions] = await Promise.all([load("contracts"), load("studio"), load("media"), load("remotion"), load("workflow"), load("assemble"), load("instructions")]);
  if (contracts.VERSION !== "2.0.0") throw new Error("UNSUPPORTED_MEMOIR_FORMAT");
  await remotion.verifyRenderer();
  const source_digest = hash(Buffer.concat(["runtime/contracts.mjs", "runtime/workflow.mjs", "runtime/gates.mjs", "runtime/studio.mjs", "runtime/media.mjs", "runtime/remotion.mjs", "runtime/assemble.mjs", "studio.json"].map(path => readFileSync(join(kit, path)))));
  const snapshot = instructions.loadStudio(new URL("./", pathToFileURL(join(kit, "studio.json"))));
  const config = snapshot.config;
  return { kit, contracts, studio, media, remotion, workflow, assemble, config, snapshot, source_digest };
}

/** JSON contracts can reference only trusted immutable media, never a writable draft. */
export function requirePinnedMedia(store: StudioProduction, value: any): void {
  if (!value || typeof value !== "object") return;
  if (value.path && value.sha256 && value.bytes) {
    if (value.path !== join(store.root, "versions", basename(value.path)) || realpathSync(value.path) !== value.path || !new RegExp("^" + value.sha256 + "\\.(png|jpg|jpeg|webp|wav|mp3|m4a|flac|ogg|mp4|mov)$").test(basename(value.path))) throw new Error("IMMUTABLE_MEDIA_REQUIRED");
    return;
  }
  for (const child of Object.values(value)) requirePinnedMedia(store, child);
}

type Format = Awaited<ReturnType<typeof loadMemoirFormat>>;

function referenceFile(root: string, name: string, bytes: Buffer) {
  const path = join(root, "references", name);
  if (existsSync(path)) { if (hash(readFileSync(path)) !== hash(bytes)) throw new Error("WORKER_REFERENCE_CHANGED"); }
  else writeFileSync(path, bytes, { mode: 0o400, flag: "wx" });
}

/** Input names encode scoped Format keys: video__clip-a denotes video:clip-a. */
function assetKey(name: string) { return name.replaceAll("__", ":"); }
export function approvedProjection(format: Format, store: StudioProduction, projectId: string, inputs: InputVersions, step: string, selectors: Record<string, string> = {}) {
  store.assertCurrentInputs(projectId, inputs);
  const policy = store.memoirPolicy(projectId);
  const sourceInputs = format.contracts.Inputs.parse(policy.source_inputs);
  const artifacts = Object.entries(inputs).map(([name, versionId]) => {
    const version = store.acceptedVersion(projectId, versionId), binding = store.memoirAssignment(version.ticket_id);
    if (assetKey(name).split(":")[0] !== binding?.kind) throw new Error("MEMOIR_INPUT_KEY_MISMATCH");
    if (!binding) throw new Error("MEMOIR_INPUT_BINDING_REQUIRED");
    const boundKey = JSON.parse(binding.packet).asset_key;
    if (boundKey && boundKey !== assetKey(name)) throw new Error("MEMOIR_INPUT_SCOPE_MISMATCH");
    const content = format.contracts.Content[binding.kind].parse(JSON.parse(readFileSync(version.path, "utf8")));
    requirePinnedMedia(store, content);
    return { id: version.id, key: assetKey(name), kind: binding.kind, digest: format.contracts.digest(content), content, valid: true, authoredBy: store.ticket(version.ticket_id).worker_id, sqlAcceptanceVerified: true, selection: binding.selection ?? 0 };
  });
  // This read-only shape exists only to reuse validators; it is never a second workflow record.
  const clone = artifacts.find(a => a.kind === "clone")?.content;
  const voiceChoice = clone?.origin?.kind === "existing" ? existingVoiceChoice(clone.origin) : undefined;
  return { voiceChoice, id: projectId, formatVersion: "2.0.0", step, productionProfile: "seedance-mini-480p", reviewMode: "supervised", workflowRevision: 4, gate: "produce", lifecycle: "active", inputs: sourceInputs, studio: format.snapshot, sqlValidationView: true, feedback: [], artifacts, ...selectors };
}
export function createMemoirAssignment(format: Format, store: StudioProduction, options: { id: string; projectId: string; kind: string; role: string; outcome: string; inputs: InputVersions; selectors?: Record<string, string>; allowanceMicros?: number; limits?: Partial<TicketLimits>; existingVoice?: any; preferredScript?: any }) {
  const { id, projectId, kind, role, outcome, inputs } = options;
  for (const [key, value] of Object.entries(options.selectors ?? {})) if (!["characterId", "locationId", "angleId", "shotId", "clipId", "effectId"].includes(key) || !/^[a-z][a-z0-9-]*$/.test(value)) throw new Error("INVALID_MEMOIR_SELECTOR");
  if (!format.contracts.Content[kind] || !format.contracts.criteria[kind] || !outcome.trim()) throw new Error("INVALID_MEMOIR_ASSIGNMENT");
  const projection = approvedProjection(format, store, projectId, inputs, kind, options.selectors);
  if (options.existingVoice) {
    if (kind !== "clone") throw new Error("EXISTING_VOICE_SCOPE_DENIED");
    format.contracts.Content.clone.parse(options.existingVoice);
    if (options.existingVoice.origin?.kind !== "existing") throw new Error("EXISTING_VOICE_PROVENANCE_REQUIRED");
  }
  const worker = format.config.agents[role];
  if (!worker) throw new Error("UNKNOWN_MEMOIR_ROLE");
  const skill = readFileSync(join(format.kit, worker.skill), "utf8");
  store.createMemoirTicket(id, projectId, role, inputs, options.allowanceMicros ?? 0, kind, format.contracts.criteria[kind], { outcome, asset_key: format.workflow.keyFor(projection), selectors: options.selectors ?? {}, skill, skill_sha256: hash(Buffer.from(skill)), skill_name: basename(dirname(worker.skill)), tools: worker.tools, model: role === "script-writer" ? memoirModels.writer : memoirModels.execution, lip_sync: false, ...(options.preferredScript ? { preferred_script: options.preferredScript } : {}), ...(options.existingVoice ? { existing_voice: options.existingVoice } : {}) }, options.limits);
  return store.ticket(id);
}
export function candidateValidator(format: Format, store: StudioProduction, ticketId: string) {
  return async (bytes: Buffer) => {
    const ticket = store.ticket(ticketId), binding = store.memoirAssignment(ticketId);
    if (!binding) throw new Error("MEMOIR_INPUT_BINDING_REQUIRED");
    const packet = JSON.parse(binding.packet), content = format.contracts.Content[binding.kind].parse(JSON.parse(bytes.toString()));
    const projection = approvedProjection(format, store, ticket.project_id, JSON.parse(ticket.inputs), binding.kind, packet.selectors);
    if (binding.kind === "narration" && content.audioEdits?.length) {
      const parentIds = new Set(content.audioEdits.map((e: any) => e.parentArtifactId));
      if (parentIds.size !== 1) throw new Error("REPAIR_PARENT_MISMATCH");
      const parent = store.rejectedVersion([...parentIds][0] as string, ticketId), previous = JSON.parse(readFileSync(parent.path, "utf8"));
      Object.assign(projection, { gate: "author", sequence: 0, jobs: [], history: [], reviewDisagreements: 0 });
      projection.artifacts.push({ id: parent.id, key: "narration", kind: "narration", digest: format.contracts.digest(previous), content: previous, valid: true, review: { decision: "rejected", checks: JSON.parse(parent.rejection!.defects).map((d: any) => ({ ...d, status: "fail" })) } } as any);
    }
    if (binding.kind === "clone" && packet.existing_voice) {
      if (format.contracts.digest(content) !== format.contracts.digest(packet.existing_voice)) throw new Error("EXISTING_VOICE_CANDIDATE_CHANGED");
      projection.voiceChoice = existingVoiceChoice(packet.existing_voice.origin);
    }
    format.workflow.assertAllowed(projection, binding.kind);
    format.workflow.validateArtifactContent(projection, content, ticket.worker_id);
    await format.media.verifyFiles(projection.artifacts);
    await format.media.verifyFiles(content);
    requirePinnedMedia(store, content);
    return hash(bytes);
  };
}
export async function acceptMemoirCandidate(format: Format, store: StudioProduction, ticketId: string) {
  const ticket = store.ticket(ticketId), version = store.version(ticket.candidate_id), bytes = readFileSync(version.path);
  const artifact_hash = await candidateValidator(format, store, ticketId)(bytes);
  return store.acceptMemoirIntermediate(ticketId, current => {
    if (hash(current) !== artifact_hash) throw new Error("VALIDATED_CANDIDATE_CHANGED");
    return { validator: `memoir-2.0.0/contracts+studio+measured-media:${format.source_digest}`, artifact_hash };
  });
}

/** Model and inspection tools must be the producer's already budgeted, traced adapters. */
export async function runMemoirAuthor(format: Format, store: StudioProduction, ctx: WorkerLease, model: BaseChatModel, inspectionTools: any[], invokeConfig: RunnableConfig = {}, evidenceReferences?: () => string[]) {
  const binding = store.memoirAssignment(ctx.ticketId);
  if (!binding) throw new Error("MEMOIR_INPUT_BINDING_REQUIRED");
  const packet = JSON.parse(binding.packet), root = dirname(store.draftDirectory(ctx));
  for (const dir of ["references", "versions", `skills/${packet.skill_name}`]) mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, "skills", packet.skill_name, "SKILL.md"), packet.skill);
  const ticket = store.ticket(ctx.ticketId);
  for (const [name, versionId] of Object.entries(JSON.parse(ticket.inputs) as InputVersions)) {
    referenceFile(root, `${name}.json`, readFileSync(store.acceptedVersion(ticket.project_id, versionId).path));
  }
  const system = `Author the declarative ${binding.kind} JSON contract from the exact reference versions. ${packet.outcome} Inspect the actual draft and submit its evidence. No phoneme lip-sync. No approval authority. Read the role skill from /skills/. Write only to /drafts/; references are in /references/. Do not list / or /tmp, which are intentionally inaccessible. Use the loaded role skill. Submission ends this run.`;
  const agent = workspaceAgent(model, root, `memoir-${ctx.ticketId}-${ctx.token}`, ctx.workerId, [...inspectionTools, publicationTool(store, ctx, candidateValidator(format, store, ctx.ticketId), evidenceReferences)], system, [productionMiddleware(store, ctx)]);
  return askActiveAgent(system, { operatingAgent: async prompt => agent.invoke({ messages: [{ role: "user", content: prompt }] }, invokeConfig) });
}

export async function prepareMemoirComposition(format: Format, store: StudioProduction, projectId: string, inputs: InputVersions, destination: string) {
  const projection = approvedProjection(format, store, projectId, inputs, "film");
  format.workflow.assertAllowed(projection, "film");
  const manifest = format.studio.assemblyManifest(projection);
  await format.media.verifyFiles(manifest);
  const prepared = await format.remotion.prepareComposition(manifest, destination);
  // Preparation can outlive an operator edit. Recheck authoritative inputs before exposing output.
  approvedProjection(format, store, projectId, inputs, "film");
  return { ...prepared, manifest, exact_inputs: inputs, director_approved: false };
}

export function startMemoirReview(store: StudioProduction, authorId: string, reviewerId: string, allowanceMicros = 0, filmModality?: "video" | "audio", limits: Partial<TicketLimits> = {}) {
  const assignment = store.memoirAssignment(authorId);
  if (!assignment) throw new Error("MEMOIR_INPUT_BINDING_REQUIRED");
  const kind = assignment.kind;
  if (kind === "film" && !filmModality) throw new Error("FILM_REVIEW_MODALITY_REQUIRED");
  const modality = kind === "film" ? filmModality! : memoirReviewModality(kind);
  return store.startReview(authorId, reviewerId, "independent-reviewer", { criteria: kind === "film" ? memoirFilmReviewCriteria[filmModality!] : JSON.parse(assignment.criteria), modality, coverage: memoirReviewCoverage }, allowanceMicros, limits);
}

export async function runMemoirReviewer(format: Format, store: StudioProduction, ctx: WorkerLease, model: BaseChatModel, inspectionTools: any[], invokeConfig: RunnableConfig = {}, evidenceReferences?: () => string[], continuationContext = "") {
  const packet = store.reviewPacket(ctx.ticketId), root = dirname(store.draftDirectory(ctx));
  for (const dir of ["references", "versions", "skills/memoir-reviewer"]) mkdirSync(join(root, dir), { recursive: true });
  const sourceInputs = store.memoirPolicy(packet.project_id).source_inputs;
  referenceFile(root, "source-inputs.json", Buffer.from(JSON.stringify(sourceInputs)));
  const candidate = readFileSync(packet.candidate_path);
  if (hash(candidate) !== packet.content_hash) throw new Error("REVIEW_CANDIDATE_CHANGED");
  referenceFile(root, "candidate.json", candidate);
  const authorAssignment = store.memoirAssignment(packet.ticket_id);
  const authorPacket = authorAssignment ? JSON.parse(authorAssignment.packet) : null;
  if (authorPacket?.preferred_script) referenceFile(root, "preferred-script.json", Buffer.from(JSON.stringify(authorPacket.preferred_script)));
  const workerPacket = { ...packet, candidate_path: "/references/candidate.json" };
  referenceFile(root, "packet.json", Buffer.from(JSON.stringify(workerPacket)));
  for (const [name, versionId] of Object.entries(packet.exact_inputs as InputVersions)) referenceFile(root, `${name}.json`, readFileSync(store.acceptedVersion(packet.project_id, versionId).path));
  const rubric = readFileSync(join(format.kit, "evaluation/rubrics", packet.modality === "text" ? "text.md" : packet.modality === "audio" ? "audio.md" : "visual.md"), "utf8");
  writeFileSync(join(root, "skills/memoir-reviewer/SKILL.md"), `---\nname: memoir-reviewer\ndescription: Independently inspect the authoritative Memoir assignment packet.\n---\n${rubric}`);
  const authorizedOutcome = authorAssignment ? JSON.parse(authorAssignment.packet).outcome : null;
  const availableReferences = ["/references/packet.json", "/references/candidate.json", "/references/source-inputs.json", ...Object.keys(packet.exact_inputs).map(name => `/references/${name}.json`), ...(authorPacket?.preferred_script ? ["/references/preferred-script.json"] : [])];
  const preferredDirection = authorPacket?.preferred_script ? "Compare narration against /references/preferred-script.json while honoring the requested metadata/cast repair." : "";
  const mediaDirection = packet.modality === "text" ? "" : "inspect_candidate invokes a dedicated multimodal model on the pinned media bytes and returns its findings. Evaluate those actual inspection findings; do not read raw audio/video through the text filesystem tool. If the inspection is complete, use it to submit your verdict; do not repeat inspection or search for nonexistent references.";
  const system = `Independently review /references/packet.json and its exact candidate and relevant approved references. Call inspect_candidate with no arguments before submit_review; read_file alone does not create the runtime inspection receipt required for acceptance. Use the native inspection tools to actually inspect the required ${packet.modality} coverage. Do not infer seeing or hearing from metadata. If any required perception is unavailable submit INCONCLUSIVE. Evaluate the packet criteria; if all pass, report whether the candidate preserves approved creative direction. You cannot approve or generate media. ${preferredDirection} ${mediaDirection} Available reference files: ${JSON.stringify(availableReferences)}. These are the complete supplied reference inventory; do not search for additional source files. The immutable original questionnaire is /references/source-inputs.json; compare candidate facts against it. Read exact files directly; listing /, /drafts, or /large_tool_results is unnecessary and may be denied. End with submit_review. Authoritative packet: ${JSON.stringify(workerPacket)}. The author assignment requested this outcome: ${JSON.stringify(authorizedOutcome)}. Evaluate that requested revision; a specifically requested change from an older approved reference is not itself a defect. Retain all other criteria and approved-direction constraints. ${continuationContext}`;
  const agent = workspaceAgent(model, root, `memoir-review-${ctx.ticketId}-${ctx.token}`, ctx.workerId, [...inspectionTools, reviewTool(store, ctx, evidenceReferences)], system, [productionMiddleware(store, ctx)]);
  return askActiveAgent(system, { operatingAgent: prompt => agent.invoke({ messages: [{ role: "user", content: prompt }] }, invokeConfig) });
}


/** Passive official rendering only; the operating agent has already authored the edit. */
export async function renderMemoirFilm(format: Format, store: StudioProduction, ctx: WorkerLease) {
  const ticket = store.ticket(ctx.ticketId), binding = store.memoirAssignment(ctx.ticketId);
  if (binding?.kind !== "film") throw new Error("FILM_ASSIGNMENT_REQUIRED");
  const inputs = JSON.parse(ticket.inputs), projection = approvedProjection(format, store, ticket.project_id, inputs, "film");
  const directory = dirname(store.draftDirectory(ctx));
  store.heartbeat(ctx, 120000);
  let leaseError: unknown;
  const heartbeat = setInterval(() => { try { store.heartbeat(ctx, 120000); } catch (error) { leaseError = error; } }, 30000);
  let result: any;
  try { result = await format.assemble.renderFilm(projection, directory); if (leaseError) throw leaseError; store.heartbeat(ctx, 120000); } finally { clearInterval(heartbeat); }
  const pin = async (file: any) => ({ ...file, ...store.pinMedia(ctx, readFileSync(file.path), extname(file.path)) });
  result.files = await Promise.all(result.files.map(pin)); result.contactSheet = await pin(result.contactSheet);
  const bytes = Buffer.from(JSON.stringify(result)); await candidateValidator(format, store, ctx.ticketId)(bytes);
  writeFileSync(join(store.draftDirectory(ctx), "film.json"), bytes, { mode: 0o600, flag: "wx" });
  return { draft_path: "/drafts/film.json", result };
}

/** Exact director-approved final media and portable share use the same canonical scene/bundle. */
export async function finalizeMemoirFilm(format: Format, store: StudioProduction, projectId: string, versionId: string, destination: string) {
  const version = store.acceptedVersion(projectId, versionId), binding = store.memoirAssignment(version.ticket_id);
  if (binding?.kind !== "film" || binding.checkpoint !== "final_film") throw new Error("FINAL_FILM_APPROVAL_REQUIRED");
  const bytes = readFileSync(version.path), film = format.contracts.Content.film.parse(JSON.parse(bytes.toString()));
  await candidateValidator(format, store, version.ticket_id)(bytes);
  if (existsSync(destination)) throw new Error("FINALIZATION_DESTINATION_EXISTS");
  const prepared = await prepareMemoirComposition(format, store, projectId, JSON.parse(version.inputs), destination);
  if (film.rendererDigest !== prepared.rendererDigest || film.sceneDigest !== format.contracts.digest(prepared.scene) || film.manifestDigest !== format.contracts.digest(prepared.manifest)) throw new Error("FINAL_FILM_SCENE_MISMATCH");
  store.acceptedVersion(projectId, versionId);
  cpSync(film.files[0].path, join(prepared.bundle, "film.mp4"), { errorOnExist: true, force: false });
  const receipt = { project_id: projectId, candidate_version_id: versionId, content_hash: version.content_hash, media_sha256: film.files[0].sha256, renderer_digest: prepared.rendererDigest, scene_digest: film.sceneDigest, exact_inputs: JSON.parse(version.inputs), director_approved: true, share_mode: "portable-official-player", public_share_uploaded: false };
  writeFileSync(join(prepared.bundle, "approval.json"), JSON.stringify(receipt, null, 2), { flag: "wx", mode: 0o400 });
  return { ...prepared, receipt, export_path: join(prepared.bundle, "film.mp4") };
}

/** Read-only validation context derived from the producer-bound existing clone provenance. */
export function existingVoiceChoice(origin: any) {
  if (origin?.kind !== "existing" || !origin.lookup || !origin.selectionMessage?.trim() || !origin.consentMessage?.trim()) throw new Error("EXISTING_VOICE_PROVENANCE_REQUIRED");
  return { voiceId: origin.lookup.voiceId, lookup: origin.lookup, reuseWithoutSample: true, selectedBy: { message: origin.selectionMessage, at: origin.lookup.checkedAt }, consentMessage: origin.consentMessage };
}
