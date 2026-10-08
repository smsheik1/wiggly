import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { tool } from "langchain";
import { z } from "zod";
import { StudioProduction, memoirReviewModality, memoirReviewCoverage, memoirFilmReviewCriteria } from "../../lib/studio-production.js";
import { provisionLocalOperator, signLocalOperator } from "../../lib/studio-operator.js";
import { hash } from "./harness.js";
import { ScriptedModel, call } from "./offline-model.js";
import { acceptMemoirCandidate, createMemoirAssignment, loadMemoirFormat, prepareMemoirComposition, renderMemoirFilm, finalizeMemoirFilm, runMemoirAuthor } from "./memoir-format.js";

// Explicit free integration fixtures. Neither reviews nor decisions below are creative acceptance.
const kit = resolve("../../public/format-repositories/my-pixar-story-v1");
const format = await loadMemoirFormat(kit);
const helpers = await import(pathToFileURL(join(kit, "tests/studio-helpers.mjs")).href);
const original = helpers.renderReady();
const root = resolve("output/phase6", `proof-${Date.now()}`); mkdirSync(root, { recursive: true });
const store = new StudioProduction(root), principal = provisionLocalOperator(root);
const details = { runId: "explicit-mock-phase6", model: "isolated-scripted-model", modality: "text", coverage: "entire fixture envelope" };
const results: any[] = [];
function inspect(lease: any, bytes: Buffer, inspectionDetails = details) {
  const evidence = store.mediaSupplied(lease, bytes, inspectionDetails);
  store.inspectionCompleted(lease, evidence, "EXPLICIT LOCAL MOCK: integration receipt only; no creative perception claim."); return evidence;
}
function review(ticketId: string) {
  const binding = store.memoirAssignment(ticketId)!, film = binding.kind === "film";
  for (const modality of film ? ["video", "audio"] : [memoirReviewModality(binding.kind)]) {
    const reviewerId = `${ticketId}-review-${modality}`;
    store.startReview(ticketId, reviewerId, "fixture-reviewer", { criteria: film ? memoirFilmReviewCriteria[modality as "video" | "audio"] : JSON.parse(binding.criteria), modality, coverage: memoirReviewCoverage });
    const lease = store.claim(reviewerId, reviewerId, 60000), packet = store.reviewPacket(reviewerId);
    store.submitReview(lease, { verdict: "PASS", findings: "EXPLICIT LOCAL MOCK verdict for integration mechanics, not creative acceptance.", defects: [], evidence_references: [inspect(lease, readFileSync(packet.candidate_path), { ...details, modality: packet.modality, coverage: packet.coverage })], direction_compatible: true });
  }
}
async function seed(projectId: string, key: string, kind: string, content: any, inputs: Record<string, string>) {
  const id = `${projectId}-seed-${key.replaceAll(":", "_")}`;
  store.createTicket(id, projectId, "explicit-fixture-import", {}, 0);
  store.bindMemoirAssignment(id, kind, format.contracts.criteria[kind]);
  const lease = store.claim(id, id, 60000);
  function pin(value: any): any {
    if (!value || typeof value !== "object") return value;
    if (value.path && value.sha256 && value.bytes) return { ...value, ...store.pinMedia(lease, readFileSync(value.path), value.path.slice(value.path.lastIndexOf("."))) };
    return Array.isArray(value) ? value.map(pin) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, pin(child)]));
  }
  const bytes = Buffer.from(JSON.stringify(pin(content)));
  writeFileSync(join(store.draftDirectory(lease), "candidate.json"), bytes);
  const version = store.publish(lease, { draft_path: "candidate.json", evidence_references: [inspect(lease, bytes)], validated_hash: hash(bytes) });
  review(id);
  // Mock seed approvals are intentionally isolated and bypass no real film state.
  const card = store.approvalCard(id);
  store.directorDecision(signLocalOperator(root, { id: `fixture-decision-${id}`, principal, action: "decide" as const, ...card, decision: "APPROVE" as const, feedback: "EXPLICIT MOCK initial accepted-input fixture", ...(kind === "candidates" ? { selection: 0 } : {}) }));
  const name = key.replaceAll(":", "__"); store.setInput(projectId, name, version.id); inputs[name] = version.id;
}
try {
  for (const scenario of [{ id: "parent", clipsPerShot: 3, trim: 0, colors: ["red", "blue"] }, { id: "grandparent", clipsPerShot: 1, trim: 0.5, colors: ["green", "yellow"] }]) {
    const projectId = scenario.id, dir = join(root, projectId); mkdirSync(dir, { recursive: true });
    const source = JSON.parse(readFileSync(join(kit, "examples", `${projectId}.json`), "utf8"));
    store.createProject(projectId, 0);
    store.activateMemoirPolicy(signLocalOperator(root, { id: `fixture-policy-${projectId}`, principal, project_id: projectId, action: "activate_memoir_policy" as const, source_inputs: source }));
    store.authenticatedProjectCommand(signLocalOperator(root, { id: `fixture-resume-${projectId}`, principal, project_id: projectId, action: "resume" as const, value: 0, reason: "Explicit isolated free integration fixture" }));
    const imagePath = join(dir, "fixture.png"), audioPath = join(dir, "fixture.wav");
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=white:s=1600x900", "-frames:v", "1", imagePath]);
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `sine=frequency=${projectId === "parent" ? 330 : 550}:duration=15`, audioPath]);
    const image = await format.media.importMedia(imagePath, dir), audio = await format.media.importMedia(audioPath, dir);
    const videos: any[] = [];
    for (const [index, color] of scenario.colors.entries()) {
      const path = join(dir, `fixture-${index}.mp4`);
      execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `color=c=${color}:s=864x496:r=30:d=16`, "-c:v", "libx264", "-preset", "ultrafast", path]);
      videos.push(await format.media.importMedia(path, dir));
    }
    function actualFiles(value: any): any {
      if (!value || typeof value !== "object") return value;
      if (value.path && value.sha256 && value.bytes) return value.path.endsWith(".mp4") ? videos[0] : value.durationSeconds ? audio : image;
      return Array.isArray(value) ? value.map(actualFiles) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, actualFiles(child)]));
    }
    const artifacts = original.artifacts.filter((a: any) => a.valid && !a.kind.endsWith("Qualification") && !["videoPrompt", "video", "music", "effect", "editPlan", "soundPlan", "videoPlan"].includes(a.kind));
    const inputs: Record<string, string> = {};
    await seed(projectId, "answers", "answers", { inputs: source, sourceInputDigest: format.contracts.digest(source), commonSenseChecks: [] }, inputs);
    for (const artifact of artifacts) await seed(projectId, artifact.key, artifact.kind, actualFiles(artifact.content), inputs);
    const shots = original.artifacts.findLast((a: any) => a.kind === "shots").content.shots;
    const clips = shots.flatMap((shot: any) => Array.from({ length: scenario.clipsPerShot }, (_, index) => ({ id: `${shot.id}-${index}`, shotId: shot.id, startSeconds: index * 15 / scenario.clipsPerShot, durationSeconds: 15 / scenario.clipsPerShot, generationSeconds: 15, camera: "EXPLICIT fixture camera", action: "EXPLICIT static fixture", anchors: "EXPLICIT frame trim fixture", atmosphere: "EXPLICIT local test" })));
    await seed(projectId, "videoPlan", "videoPlan", { resolution: "480p", clips }, inputs);
    for (const [index, clip] of clips.entries()) await seed(projectId, `video:${clip.id}`, "video", { files: [videos[index % 2]], prompt: "EXPLICIT local fixture", keyframeSha256: image.sha256, providerJobId: "NO_PROVIDER_CALL" }, inputs);
    const soundPlan = { music: null, effects: [], noMusicReason: "EXPLICIT free fixture", noEffectsReason: "EXPLICIT free fixture" };
    await seed(projectId, "soundPlan", "soundPlan", soundPlan, inputs);
    const edit = { ...helpers.editPlan({ artifacts: [{ key: "videoPlan", valid: true, content: { clips } }] }), clips: clips.map((clip: any) => ({ clipId: clip.id, sourceOffsetSeconds: scenario.trim })) };
    const ticketId = `${projectId}-editor`;
    createMemoirAssignment(format, store, { id: ticketId, projectId, kind: "editPlan", role: "film-editor", outcome: "Produce the explicit local test edit preserving each measured source trim and all narration stems.", inputs });
    const lease = store.claim(ticketId, "fixture-operating-editor", 60000);
    const inspectTool = tool(() => ({ evidence: inspect(lease, store.readDraft(lease, "edit.json")) }), { name: "inspect_fixture", description: "EXPLICIT isolated inspection mock", schema: z.object({}).strict() });
    const model = new ScriptedModel([
      () => call("read_file", { file_path: "/skills/eli/SKILL.md" }),
      () => call("write_file", { file_path: "/drafts/edit.json", content: JSON.stringify(edit) }),
      () => call("inspect_fixture", {}),
      messages => { const result = JSON.parse(String(messages.at(-1)!.content)); return call("submit_candidate", { draft_path: "/drafts/edit.json", evidence_references: [result.evidence] }); },
    ]);
    await runMemoirAuthor(format, store, lease, model, [inspectTool]); assert.equal(model.calls.length, 4); assert.equal(store.ticket(ticketId).status, "SUBMITTED");
    review(ticketId); await acceptMemoirCandidate(format, store, ticketId);
    const editVersion = store.ticket(ticketId).candidate_id; store.setInput(projectId, "editPlan", editVersion); inputs.editPlan = editVersion;
    const prepared = await prepareMemoirComposition(format, store, projectId, inputs, join(dir, "assembly"));
    assert.equal(prepared.scene.format, "memoir-film"); assert.equal(prepared.scene.layout.clips.length, clips.length); assert.equal(prepared.scene.layout.clips[0].sourceOffsetSeconds, scenario.trim);
    assert.equal(prepared.scene.layout.clips.reduce((sum: number, c: any) => sum + c.durationFrames, 0), 1800);
    const out = join(dir, "component.mp4");
    await format.remotion.renderComposition(prepared, out, () => {}, [120, 179]);
    const file = await format.media.importMedia(out, dir); assert.equal(file.durationSeconds, 2); assert.equal(file.hasAudio, true);
    const filmTicket = `${projectId}-final-film`;
    createMemoirAssignment(format, store, { id: filmTicket, projectId, kind: "film", role: "film-editor", inputs, outcome: "Render the existing fixture edit using the passive official renderer; no creative acceptance." });
    const filmLease = store.claim(filmTicket, "fixture-operating-film-editor", 120000);
    const rendered = await renderMemoirFilm(format, store, filmLease), filmBytes = store.readDraft(filmLease, "film.json");
    const filmVersion = store.publish(filmLease, { draft_path: "film.json", validated_hash: await (await import("./memoir-format.js")).candidateValidator(format, store, filmTicket)(filmBytes), evidence_references: [inspect(filmLease, filmBytes)] });
    review(filmTicket);
    await assert.rejects(() => acceptMemoirCandidate(format, store, filmTicket), /DIRECTOR_CHECKPOINT_REQUIRED/);
    await assert.rejects(() => finalizeMemoirFilm(format, store, projectId, filmVersion.id, join(dir, "unapproved-share")), /ACCEPTED_VERSION_REQUIRED/);
    const filmCard = store.approvalCard(filmTicket);
    store.directorDecision(signLocalOperator(root, { id: `fixture-final-decision-${projectId}`, principal, action: "decide" as const, ...filmCard, decision: "APPROVE" as const, feedback: "EXPLICIT LOCAL MOCK: finalization mechanics only, no creative acceptance" }));
    const finalized = await finalizeMemoirFilm(format, store, projectId, filmVersion.id, join(dir, "approved-portable-share"));
    assert.deepEqual(finalized.scene, prepared.scene); assert.equal(hash(readFileSync(finalized.export_path)), rendered.result.files[0].sha256);
    const sharedPreview = await format.remotion.servePreview(finalized);
    const preview = await format.remotion.servePreview(prepared);
    results.push({ scenario, author_turns: model.calls.length, candidate_version_id: editVersion, renderer_digest: prepared.rendererDigest, scene_digest: format.contracts.digest(prepared.scene), component: file, full_film: rendered.result.files[0], technical_inspection: rendered.result.inspection, portable_share_url: sharedPreview.url, finalization_receipt: finalized.receipt, preview_url: preview.url, exact_inputs: inputs, creative_review: "NOT_PERFORMED; explicit mocks only", director_approved: false });
    writeFileSync(join(dir, "prepared.json"), JSON.stringify({ ...prepared, preview_url: preview.url }, null, 2));
    store.authenticatedProjectCommand(signLocalOperator(root, { id: `fixture-pause-${projectId}`, principal, project_id: projectId, action: "pause" as const, value: 1, reason: "End isolated integration proof paused" }));
  }
  writeFileSync(join(root, "proof.json"), JSON.stringify({ status: "LOCAL_INTEGRATION_PASS", root, paid_calls: 0, results }, null, 2));
  console.log(JSON.stringify({ root, status: "LOCAL_INTEGRATION_PASS", previews: results.map(r => r.preview_url) }));
  // Keep the two local previews alive for real browser validation; Ctrl-C after inspection.
} catch (error) { store.close(); throw error; }
