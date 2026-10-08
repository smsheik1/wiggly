import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StudioProduction, memoirReviewModality, memoirReviewCoverage, memoirFilmReviewCriteria } from "../../lib/studio-production.js";
import { provisionLocalOperator, signLocalOperator } from "../../lib/studio-operator.js";
import { hash } from "./harness.js";
const details = { runId: "explicit-mock-phase6", model: "isolated-local-fixture", modality: "text", coverage: "entire candidate" };
function fixture(run: (store: StudioProduction, principal: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "wiggly-phase6-policy-"));
  const store = new StudioProduction(root, () => 1000), principal = provisionLocalOperator(root);
  try {
    store.createProject("film", 0);
    store.authenticatedProjectCommand(signLocalOperator(root, { id: "resume-mock", principal, project_id: "film", action: "resume" as const, value: 0, reason: "Explicit isolated fixture; no production resume" }));
    run(store, principal);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
}
function policy(store: StudioProduction, principal: string) {
  return signLocalOperator(store.root, { id: "policy", principal, project_id: "film", action: "activate_memoir_policy" as const, source_inputs: { explicit_mock: true } });
}
function publish(store: StudioProduction, id = "plate", kind = "backgroundAngle", inputs = {}) {
  store.createTicket(id, "film", "artist", inputs, 0); store.bindMemoirAssignment(id, kind, ["continuity"]);
  const lease = store.claim(id, `author-${id}`, 1000), bytes = Buffer.from(`EXPLICIT MOCK ${id}`);
  writeFileSync(join(store.draftDirectory(lease), "candidate.json"), bytes);
  const evidence = store.mediaSupplied(lease, bytes, details); store.inspectionCompleted(lease, evidence, "Explicit fixture author inspection; no creative-quality claim.");
  const version = store.publish(lease, { draft_path: "candidate.json", evidence_references: [evidence], validated_hash: hash(bytes) });
  return { lease, bytes, version };
}
function review(store: StudioProduction, id = "plate", compatible?: boolean) {
  const film = store.memoirAssignment(id)!.kind === "film";
  for (const modality of film ? ["video", "audio"] : [memoirReviewModality(store.memoirAssignment(id)!.kind)]) {
    const reviewer = `${id}-review-${modality}`; store.startReview(id, reviewer, "reviewer", { criteria: film ? memoirFilmReviewCriteria[modality as "video" | "audio"] : ["continuity"], modality, coverage: memoirReviewCoverage });
    const lease = store.claim(reviewer, `independent-${id}-${modality}`, 1000), packet = store.reviewPacket(reviewer), bytes = readFileSync(packet.candidate_path);
    const evidence = store.mediaSupplied(lease, bytes, { ...details, modality: packet.modality, coverage: packet.coverage }); store.inspectionCompleted(lease, evidence, "Explicit independent fixture inspection of the exact version.");
    store.submitReview(lease, { verdict: "PASS", findings: "Explicit isolated fixture passes continuity; no production creative approval.", defects: [], evidence_references: [evidence], ...(compatible === undefined ? {} : { direction_compatible: compatible }) });
  }
}
function accept(store: StudioProduction, id = "plate") { return store.acceptMemoirIntermediate(id, bytes => ({ validator: "EXPLICIT MOCK deterministic validator", artifact_hash: hash(bytes) })); }

test("format policy requires operator authentication and exact idempotent activation", () => fixture((store, principal) => {
  const signed = policy(store, principal);
  assert.throws(() => store.activateMemoirPolicy({ ...signed, signature: "forged" }), /AUTH|SIGNATURE/);
  store.activateMemoirPolicy(signed); store.activateMemoirPolicy(signed);
  assert.throws(() => store.activateMemoirPolicy(signLocalOperator(store.root, { ...signed.payload, id: "different" })), /ALREADY_ACTIVATED/);
}));
test("four director checkpoint groups never accept automatically", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal));
  for (const [kind, checkpoint] of Object.entries({ sheet: "character_style", shots: "storyboard", narration: "narration_performance", film: "final_film" })) {
    publish(store, kind, kind); review(store, kind, true);
    assert.equal(store.memoirAssignment(kind)?.checkpoint, checkpoint);
    assert.throws(() => accept(store, kind), /DIRECTOR_CHECKPOINT_REQUIRED/);
    assert.equal(store.ticket(kind).status, "AWAITING_APPROVAL");
  }
}));
test("intermediate acceptance needs independent pass, direction compatibility and exact validation", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal)); publish(store);
  assert.throws(() => accept(store), /NOT_AWAITING_APPROVAL/); review(store);
  assert.throws(() => accept(store), /DIRECTION_COMPATIBILITY_REQUIRED/);
  publish(store, "compatible"); review(store, "compatible", true);
  assert.throws(() => store.acceptMemoirIntermediate("compatible", () => ({ validator: "mock", artifact_hash: "0".repeat(64) })), /VALIDATION_HASH_MISMATCH/);
  assert.throws(() => store.acceptMemoirIntermediate("compatible", () => { throw new Error("DETERMINISTIC_FAILURE"); }), /DETERMINISTIC_FAILURE/);
  assert.equal(store.ticket("compatible").status, "AWAITING_APPROVAL");
  const result = accept(store, "compatible"); assert.deepEqual(accept(store, "compatible"), result);
  assert.equal(store.ticket("compatible").status, "APPROVED");
  store.setInput("film", "backgroundAngle", result.version_id);
  assert.equal(store.acceptedVersion("film", result.version_id).id, result.version_id);
}));
test("incompatible direction stays with the director rather than silently proceeding", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal)); publish(store); review(store, "plate", false);
  assert.throws(() => accept(store), /DIRECTION_COMPATIBILITY_REQUIRED/);
  assert.equal(store.approvalCard("plate").ticket_id, "plate");
}));
test("format publication rejects a draft changed after validation", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal));
  store.createTicket("plate", "film", "artist", {}, 0); store.bindMemoirAssignment("plate", "backgroundAngle", ["continuity"]);
  const lease = store.claim("plate", "author", 1000), bytes = Buffer.from("EXPLICIT changed draft");
  writeFileSync(join(store.draftDirectory(lease), "candidate"), bytes);
  const evidence = store.mediaSupplied(lease, bytes, details); store.inspectionCompleted(lease, evidence, "Explicit fixture inspection of changed bytes.");
  assert.throws(() => store.publish(lease, { draft_path: "candidate", evidence_references: [evidence] }), /FORMAT_VALIDATION_REQUIRED/);
  assert.throws(() => store.publish(lease, { draft_path: "candidate", evidence_references: [evidence], validated_hash: hash(Buffer.from("older draft")) }), /FORMAT_VALIDATION_REQUIRED|DRAFT_CHANGED/);
  assert.equal(store.ticket("plate").status, "WORKING");
}));
test("transitive input edits invalidate accepted descendants while unrelated changes do not", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal)); store.setInput("film", "source", "source-v1");
  const a = publish(store, "a", "backgroundAngle", { source: "source-v1" }); review(store, "a", true); accept(store, "a"); store.setInput("film", "parent", a.version.id);
  const b = publish(store, "b", "backgroundAngle", { parent: a.version.id }); review(store, "b", true); accept(store, "b"); store.setInput("film", "child", b.version.id);
  const c = publish(store, "c", "backgroundAngle", { child: b.version.id }); review(store, "c", true); accept(store, "c");
  store.setInput("film", "unrelated", "unrelated-v2"); assert.equal(store.acceptedVersion("film", c.version.id).id, c.version.id);
  store.setInput("film", "source", "source-v2"); assert.throws(() => store.acceptedVersion("film", c.version.id), /STALE_INPUTS/);
}));
test("durable pause blocks automatic acceptance and survives restart", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal)); publish(store); review(store, "plate", true);
  store.authenticatedProjectCommand(signLocalOperator(store.root, { id: "pause", principal, project_id: "film", action: "pause" as const, value: 1, reason: "Explicit fixture pause" }));
  assert.throws(() => accept(store), /PROJECT_PAUSED/);
  const restarted = new StudioProduction(store.root, () => 1000);
  try { assert.equal(restarted.project("film").paused, 1); assert.throws(() => accept(restarted), /PROJECT_PAUSED/); } finally { restarted.close(); }
}));

test("failed format binding rolls back the ticket and stale selected input heads reject", () => fixture((store, principal) => {
  assert.throws(() => store.createMemoirTicket("orphan", "film", "artist", {}, 0, "backgroundAngle", ["continuity"], {}), /NOT_AUTHORIZED/);
  assert.throws(() => store.ticket("orphan"), /NOT_FOUND/);
  store.activateMemoirPolicy(policy(store, principal));
  store.setInput("film", "script", "v1"); store.assertCurrentInputs("film", { script: "v1" });
  store.setInput("film", "script", "v2"); assert.throws(() => store.assertCurrentInputs("film", { script: "v1" }), /STALE_INPUTS/);
}));
test("format reviews cannot downgrade media coverage to a text-only pass", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal)); publish(store);
  assert.throws(() => store.startReview("plate", "bad-review", "reviewer", { criteria: ["continuity"], modality: "text", coverage: "entire candidate" }), /FORMAT_REVIEW_SCOPE_REQUIRED/);
  assert.equal(store.ticket("plate").status, "SUBMITTED");
  assert.throws(() => store.ticket("bad-review"), /NOT_FOUND/);
}));
test("trusted media pinning preserves bytes and rejects expired workers", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal));
  store.createMemoirTicket("media", "film", "artist", {}, 0, "backgroundAngle", ["continuity"], {});
  const lease = store.claim("media", "artist", 1000), original = Buffer.from("EXPLICIT media pin fixture");
  const pinned = store.pinMedia(lease, original, ".png"); original.fill(0);
  assert.equal(hash(readFileSync(pinned.path)), pinned.sha256);
  assert.deepEqual(store.pinMedia(lease, readFileSync(pinned.path), ".png"), pinned);
  assert.throws(() => store.pinMedia(lease, original, "/../escape"), /UNSUPPORTED_MEDIA/);
  assert.throws(() => store.pinMedia({ ...lease, token: lease.token + 1 }, original, ".png"), /LEASE|STALE/);
}));
test("submission binds runtime receipt when a model invents one in a parallel tool call", async () => {
  const { publicationTool } = await import("./production-tools.js");
  const root = mkdtempSync(join(tmpdir(), "wiggly-phase6-receipt-")), store = new StudioProduction(root);
  try {
    store.createProject("fixture", 0); store.operator("fixture", "resume", 0, { id: "resume", actor: "explicit-local-mock", reason: "Local regression" });
    store.createTicket("author", "fixture", "editor", {}, 0);
    const ctx = store.claim("author", "editor", 10000), bytes = Buffer.from("Actual inspected mock contract");
    writeFileSync(join(store.draftDirectory(ctx), "candidate.json"), bytes);
    const evidence = store.mediaSupplied(ctx, bytes, details); store.inspectionCompleted(ctx, evidence, "Actual completed runtime receipt for this local regression.");
    const result = await publicationTool(store, ctx, undefined, () => [evidence]).invoke({ draft_path: "/drafts/candidate.json", evidence_references: ["model-invented-receipt"] });
    assert.ok(result); assert.equal(store.ticket("author").status, "SUBMITTED");
    assert.deepEqual(JSON.parse(store.version(store.ticket("author").candidate_id).evidence), [evidence]);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test("final film cannot advance on visual review alone or reuse its visual reviewer for audio", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal)); publish(store, "film-ticket", "film");
  function pass(modality: "video" | "audio", worker: string) {
    const reviewer = `film-${modality}`;
    store.startReview("film-ticket", reviewer, "reviewer", { criteria: memoirFilmReviewCriteria[modality], modality, coverage: memoirReviewCoverage });
    const ctx = store.claim(reviewer, worker, 1000), packet = store.reviewPacket(reviewer);
    const evidence = store.mediaSupplied(ctx, readFileSync(packet.candidate_path), { ...details, modality, coverage: memoirReviewCoverage });
    store.inspectionCompleted(ctx, evidence, "EXPLICIT MOCK full-film modality receipt for this safety test.");
    return () => store.submitReview(ctx, { verdict: "PASS", findings: "EXPLICIT MOCK modality verdict, not real audiovisual perception.", defects: [], evidence_references: [evidence], direction_compatible: true });
  }
  pass("video", "same-reviewer")();
  assert.equal(store.ticket("film-ticket").status, "SUBMITTED");
  assert.throws(() => store.approvalCard("film-ticket"), /NOT_AWAITING_APPROVAL/);
  assert.throws(pass("audio", "same-reviewer"), /FILM_REVIEWERS_MUST_DIFFER/);
  assert.equal(store.ticket("film-ticket").status, "REVIEWING");
}));

test("director chooses an explicit character candidate index and repeated delivery preserves it", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal));
  store.createMemoirTicket("choice", "film", "artist", {}, 0, "candidates", ["continuity"], {});
  const ctx = store.claim("choice", "artist", 1000), bytes = Buffer.from(JSON.stringify({ files: [{ explicit_mock: 1 }, { explicit_mock: 2 }] }));
  writeFileSync(join(store.draftDirectory(ctx), "candidate.json"), bytes);
  const evidence = store.mediaSupplied(ctx, bytes, details); store.inspectionCompleted(ctx, evidence, "EXPLICIT MOCK inspected candidate selection envelope.");
  store.publish(ctx, { draft_path: "candidate.json", evidence_references: [evidence], validated_hash: hash(bytes) });
  review(store, "choice", true);
  const payload = { id: "selection", principal, action: "decide" as const, ...store.approvalCard("choice"), decision: "APPROVE" as const };
  assert.throws(() => store.directorDecision(signLocalOperator(store.root, payload)), /EXPLICIT_CHARACTER_SELECTION_REQUIRED/);
  assert.throws(() => store.directorDecision(signLocalOperator(store.root, { ...payload, selection: 2 })), /EXPLICIT_CHARACTER_SELECTION_REQUIRED/);
  const command = signLocalOperator(store.root, { ...payload, selection: 1 });
  assert.equal(store.directorDecision(command).selection, 1); assert.equal(store.directorDecision(command).selection, 1);
  assert.equal(store.memoirAssignment("choice")!.selection, 1);
}));

test("independent review receives the authorized revision outcome instead of assuming old reference equality", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal));
  const outcome = "Change the first clip trim by exactly one frame; preserve every other field.";
  store.createMemoirTicket("revision", "film", "editor", {}, 0, "editPlan", ["continuity"], { outcome, selectors: { shotId: "shot-one" } });
  const ctx = store.claim("revision", "editor", 1000), bytes = Buffer.from("EXPLICIT MOCK authorized revision");
  writeFileSync(join(store.draftDirectory(ctx), "candidate.json"), bytes);
  const evidence = store.mediaSupplied(ctx, bytes, details); store.inspectionCompleted(ctx, evidence, "Explicit inspected revision envelope for this regression.");
  store.publish(ctx, { draft_path: "candidate.json", evidence_references: [evidence], validated_hash: hash(bytes) });
  store.startReview("revision", "revision-review", "reviewer", { criteria: ["continuity"], modality: "text", coverage: memoirReviewCoverage });
  assert.deepEqual(store.reviewPacket("revision-review").assignment, { kind: "editPlan", outcome, selectors: { shotId: "shot-one" } });
}));

test("publishing a revision head retains its historical starting output without ignoring changed upstream inputs", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal)); store.setInput("film", "source", "source-v1");
  function revision(id: string, inputs: Record<string, string>) {
    store.createMemoirTicket(id, "film", "editor", inputs, 0, "editPlan", ["continuity"], { asset_key: "editPlan" });
    const ctx = store.claim(id, `editor-${id}`, 1000), bytes = Buffer.from(`EXPLICIT mock revision ${id}`);
    writeFileSync(join(store.draftDirectory(ctx), "candidate.json"), bytes);
    const evidence = store.mediaSupplied(ctx, bytes, details); store.inspectionCompleted(ctx, evidence, "Explicit local reference-history regression inspection.");
    const v = store.publish(ctx, { draft_path: "candidate.json", evidence_references: [evidence], validated_hash: hash(bytes) });
    review(store, id, true); accept(store, id); return v;
  }
  const first = revision("first", { source: "source-v1" }); store.setInput("film", "editPlan", first.id);
  const second = revision("second", { source: "source-v1", editPlan: first.id }); store.setInput("film", "editPlan", second.id);
  assert.equal(store.acceptedVersion("film", second.id).id, second.id);
  const third = revision("third", { source: "source-v1", editPlan: second.id }); store.setInput("film", "editPlan", third.id);
  assert.equal(store.acceptedVersion("film", third.id).id, third.id);
  store.setInput("film", "source", "source-v2"); assert.throws(() => store.acceptedVersion("film", third.id), /STALE_INPUTS/);
}));

test("rehearsal author and review limits are explicitly twelve without changing old defaults", () => fixture((store, principal) => {
  store.activateMemoirPolicy(policy(store, principal));
  store.createMemoirTicket("twelve", "film", "artist", {}, 0, "backgroundAngle", ["continuity"], {}, { maxTurns: 12 });
  assert.equal(store.ticket("twelve").max_turns, 12);
  publish(store, "legacy-default");
  assert.equal(store.ticket("legacy-default").max_turns, 8);
  store.startReview("legacy-default", "twelve-review", "reviewer", { criteria: ["continuity"], modality: "image", coverage: memoirReviewCoverage }, 0, { maxTurns: 12 });
  assert.equal(store.ticket("twelve-review").max_turns, 12);
}));
