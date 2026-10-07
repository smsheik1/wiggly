import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { StudioProduction, type WorkerLease, type TicketLimits } from "../../lib/studio-production.js";
import { provisionLocalOperator, signLocalOperator } from "../../lib/studio-operator.js";
import { assignmentAgent } from "./production-tools.js";
import { hash } from "./harness.js";
import { ScriptedModel, call } from "./offline-model.js";
import { AIMessage } from "@langchain/core/messages";
const exec = promisify(execFile);
const BAD = "EXPLICIT_MOCK_BACKGROUND_WITH_FIGURE", GOOD = "EXPLICIT_MOCK_EMPTY_BACKGROUND";
const details = { runId: "mock-run", model: "explicit-local-mock", modality: "text", coverage: "complete fixture" };
async function isolated(run: (root: string) => Promise<void> | void) { const root = mkdtempSync(join(tmpdir(), "wiggly-phase4-")); try { await run(root); } finally { rmSync(root, { recursive: true, force: true }); } }
function setup(root: string, limits: Partial<TicketLimits> = {}) {
  const store = new StudioProduction(root, () => 1000), principal = provisionLocalOperator(store.root);
  store.createProject("project", 1000000);
  store.authenticatedProjectCommand(signLocalOperator(store.root, { id: "resume", principal, project_id: "project", action: "resume" as const, value: 0, reason: "Explicit isolated test operator" }));
  store.setInput("project", "script", "script-v1"); store.createTicket("author", "project", "visual-artist", { script: "script-v1" }, 1000000, "AUTHOR", limits);
  return { store, principal };
}
function candidate(store: StudioProduction, ctx: WorkerLease, bytes = BAD) {
  writeFileSync(join(store.draftDirectory(ctx), "plate.txt"), bytes);
  const evidence = store.mediaSupplied(ctx, Buffer.from(bytes), details);
  store.inspectionCompleted(ctx, evidence, "Explicit local mock author inspection of the complete fixture.");
  return store.publish(ctx, { draft_path: "plate.txt", evidence_references: [evidence] });
}
function reviewing(store: StudioProduction, name: string, worker = `worker-${name}`) {
  const review = store.startReview("author", name, "independent-reviewer", { criteria: ["Empty background with clear center"], modality: "text", coverage: "complete fixture" });
  return { ...review, ctx: store.claim(name, worker, 1000) };
}
function verdict(store: StudioProduction, ctx: WorkerLease, decision: "PASS" | "CHANGES_REQUESTED") {
  const packet = store.reviewPacket(ctx.ticketId), bytes = readFileSync(packet.candidate_path);
  const evidence = store.mediaSupplied(ctx, bytes, details);
  store.inspectionCompleted(ctx, evidence, "Explicit local mock independent inspection of exact candidate bytes.");
  return { verdict: decision, findings: decision === "PASS" ? "Explicit mock review: empty background and clear center satisfy the packet." : "Explicit mock review: central human figure violates the empty background criterion.", defects: decision === "PASS" ? [] : [{ criterion: "Empty background", region: "center", evidence: "Explicit fixture contains a human figure" }], evidence_references: [evidence] };
}
function pass(store: StudioProduction, name = "review") { const r = reviewing(store, name); store.submitReview(r.ctx, verdict(store, r.ctx, "PASS")); return store.approvalCard("author"); }
function signedDecision(store: StudioProduction, principal: string, commandId: string, card = store.approvalCard("author"), decision: "APPROVE" | "REJECT" = "APPROVE") {
  return signLocalOperator(store.root, { id: commandId, principal, action: "decide" as const, ...card, decision, ...(decision === "REJECT" ? { feedback: "Explicit test director requests a revised version." } : {}) });
}

test("full rejection→repair→review→restart→authenticated exact-version approval preserves history", async () => isolated(root => {
  let { store, principal } = setup(root); const originalLease = store.claim("author", "artist", 1000), original = candidate(store, originalLease);
  const first = reviewing(store, "review-one"), rejection = verdict(store, first.ctx, "CHANGES_REQUESTED");
  store.submitReview(first.ctx, rejection); store.submitReview(first.ctx, rejection);
  assert.equal(store.ticket("author").status, "CHANGES_REQUESTED"); assert.equal(store.ticket("author").strike_count, 1);
  store.queueRepair("author"); const repairLease = store.claim("author", "artist-repair", 1000), repaired = candidate(store, repairLease, GOOD);
  assert.notEqual(original.id, repaired.id); assert.notEqual(original.path, repaired.path); assert.equal(store.ticket("author").attempt_count, 2);
  const card = pass(store, "review-two"); assert.equal(store.ticket("author").status, "AWAITING_APPROVAL");
  const decision = signedDecision(store, principal, "approve-repaired", card);
  store.authenticatedProjectCommand(signLocalOperator(store.root, { id: "pause-before-restart", principal, project_id: "project", action: "pause" as const, value: 1, reason: "Keep dispatch paused during director review" })); store.close();
  store = new StudioProduction(root, () => 1000); assert.deepEqual(store.approvalCard("author"), card);
  const approval = store.directorDecision(decision); assert.equal(store.project("project").paused, 1); assert.equal(approval.status, "APPROVED"); assert.equal(approval.candidate_version_id, repaired.id);
  assert.deepEqual(store.directorDecision(decision), approval); assert.equal(store.ticket("author").revision, approval.revision);
  assert.equal(readFileSync(store.version(original.id).path, "utf8"), BAD); assert.equal(readFileSync(store.version(repaired.id).path, "utf8"), GOOD);
  assert.throws(() => store.queueRepair("author"), /REPAIR_NOT_ELIGIBLE/); assert.throws(() => store.publish(originalLease, { draft_path: "plate.txt", evidence_references: [] }), /STALE_WORKER/); store.close();
}));

test("reviewer ownership, completed perception, modality, and full coverage are required", async () => isolated(root => {
  const { store } = setup(root), author = store.claim("author", "artist", 1000); candidate(store, author);
  store.startReview("author", "review", "independent-reviewer", { criteria: ["Empty background"], modality: "text", coverage: "complete fixture" });
  assert.throws(() => store.claim("review", "artist", 1000), /AUTHOR_CANNOT_REVIEW_OWN_WORK/);
  const reviewer = store.claim("review", "separate-reviewer", 1000), result = verdict(store, reviewer, "PASS");
  assert.throws(() => store.submitReview(author, result), /TICKET_NOT_WORKING|REVIEWER_ASSIGNMENT_REQUIRED/);
  const supplied = store.mediaSupplied(reviewer, readFileSync(store.reviewPacket("review").candidate_path), details);
  assert.throws(() => store.submitReview(reviewer, { ...result, evidence_references: [supplied] }), /INVALID_INSPECTION_EVIDENCE/);
  const partial = store.mediaSupplied(reviewer, readFileSync(store.reviewPacket("review").candidate_path), { ...details, coverage: "left half" });
  store.inspectionCompleted(reviewer, partial, "Explicit mock findings for only the left half of the candidate.");
  assert.throws(() => store.submitReview(reviewer, { ...result, evidence_references: [partial] }), /REVIEW_COVERAGE_MISMATCH/);
  assert.equal(store.ticket("author").status, "REVIEWING"); store.submitReview(reviewer, result); store.close();
}));

test("stale inputs invalidate review and approval without granting acceptance", async () => isolated(root => {
  const { store, principal } = setup(root); candidate(store, store.claim("author", "artist", 1000), GOOD);
  const r = reviewing(store, "review"), result = verdict(store, r.ctx, "PASS"); store.setInput("project", "script", "script-v2");
  assert.throws(() => store.submitReview(r.ctx, result), /STALE_INPUTS/);
  store.setInput("project", "script", "script-v1"); store.submitReview(r.ctx, result); const command = signedDecision(store, principal, "approve");
  store.setInput("project", "script", "script-v2"); assert.throws(() => store.directorDecision(command), /STALE_INPUTS/);
  assert.equal(store.ticket("author").status, "AWAITING_APPROVAL"); store.close();
}));

test("old approval cards, conflicting commands, and concurrent decisions cannot approve newer work", async () => isolated(root => {
  const { store, principal } = setup(root); candidate(store, store.claim("author", "artist", 1000), GOOD); const oldCard = pass(store, "review-one");
  const oldApproval = signedDecision(store, principal, "old-approval", oldCard), rejection = signedDecision(store, principal, "director-reject", oldCard, "REJECT");
  store.directorDecision(rejection); store.queueRepair("author"); candidate(store, store.claim("author", "new-artist", 1000), GOOD + "_REVISED");
  const newCard = pass(store, "review-two"); assert.throws(() => store.directorDecision(oldApproval), /STALE_DIRECTOR_DECISION/);
  const approve = signedDecision(store, principal, "new-approval", newCard), competing = signedDecision(store, principal, "competing", newCard, "REJECT");
  const secondConnection = new StudioProduction(root, () => 1000); const applied = store.directorDecision(approve);
  assert.throws(() => secondConnection.directorDecision(competing), /STALE_DIRECTOR_DECISION/);
  const conflict = signLocalOperator(store.root, { ...approve.payload, decision: "REJECT" as const, feedback: "Changed duplicate payload" });
  assert.throws(() => store.directorDecision(conflict), /CONFLICTING_DIRECTOR_COMMAND/); assert.deepEqual(store.directorDecision(approve), applied); secondConnection.close(); store.close();
}));

test("unsigned, modified, foreign-principal and wrong-hash commands cannot approve", async () => isolated(root => {
  const { store, principal } = setup(root); candidate(store, store.claim("author", "artist", 1000), GOOD); pass(store);
  const command = signedDecision(store, principal, "approve");
  assert.throws(() => store.directorDecision({ payload: command.payload } as any), /UNAUTHENTICATED_OPERATOR/);
  assert.throws(() => store.directorDecision({ ...command, payload: { ...command.payload, decision: "REJECT", feedback: "Tampered" } }), /UNAUTHENTICATED_OPERATOR/);
  assert.throws(() => store.directorDecision({ ...command, payload: { ...command.payload, principal: "pretend-director" } }), /UNAUTHENTICATED_OPERATOR/);
  const wrong = signLocalOperator(store.root, { ...command.payload, content_hash: hash(Buffer.from("wrong bytes")) });
  assert.throws(() => store.directorDecision(wrong), /STALE_DIRECTOR_DECISION/); assert.equal(store.ticket("author").status, "AWAITING_APPROVAL"); store.close();
}));

test("inconclusive reviewer blocks progress without penalizing author or creating approval card", async () => isolated(root => {
  const { store } = setup(root); candidate(store, store.claim("author", "artist", 1000)); const r = reviewing(store, "review");
  store.submitReview(r.ctx, { verdict: "INCONCLUSIVE", findings: "Explicit mock reviewer lacks the required perception capability.", defects: [], evidence_references: [] });
  assert.equal(store.ticket("author").status, "BLOCKED"); assert.equal(store.ticket("author").blocked_reason, "REVIEW_INCONCLUSIVE"); assert.equal(store.ticket("author").strike_count, 0);
  assert.throws(() => store.approvalCard("author"), /NOT_AWAITING_APPROVAL/); assert.throws(() => store.queueRepair("author"), /REPAIR_NOT_ELIGIBLE/); store.close();
}));

test("repeated failures escalate separately from successful repair; signed extensions preserve counts", async () => isolated(root => {
  const { store, principal } = setup(root, { maxStrikes: 2, maxAttempts: 4 });
  for (const n of [1, 2]) { candidate(store, store.claim("author", `artist-${n}`, 1000)); const r = reviewing(store, `review-${n}`); store.submitReview(r.ctx, verdict(store, r.ctx, "CHANGES_REQUESTED")); if (n === 1) store.queueRepair("author"); }
  const blocked = store.ticket("author"); assert.equal(blocked.status, "BLOCKED"); assert.equal(blocked.blocked_reason, "REPEATED_FAILURE");
  assert.throws(() => store.claim("author", "automatic-retry", 1000), /TICKET_ALREADY_CLAIMED/);
  const extension = signLocalOperator(store.root, { id: "extend-strikes", principal, project_id: "project", action: "extend_limits" as const, ticket_id: "author", expected_revision: blocked.revision, reason: "Explicit test director authorizes one more failure allowance", max_strikes: 3 });
  assert.throws(() => store.authorizeLimits({ ...extension, signature: "0".repeat(64) }), /UNAUTHENTICATED_OPERATOR/);
  const extended = store.authorizeLimits(extension); assert.deepEqual(store.authorizeLimits(extension), extended);
  assert.equal(store.ticket("author").strike_count, 2); store.queueRepair("author"); candidate(store, store.claim("author", "artist-final", 1000), GOOD); pass(store, "review-final");
  assert.equal(store.directorDecision(signedDecision(store, principal, "approve-final")).status, "APPROVED"); store.close();
}));

test("attempt cap stops repair scheduling until an exact authenticated extension", async () => isolated(root => {
  const { store, principal } = setup(root, { maxAttempts: 1, maxStrikes: 5 }); candidate(store, store.claim("author", "artist", 1000)); const r = reviewing(store, "review"); store.submitReview(r.ctx, verdict(store, r.ctx, "CHANGES_REQUESTED"));
  assert.equal(store.queueRepair("author").blocked_reason, "ATTEMPT_LIMIT"); const blocked = store.ticket("author");
  const extension = signLocalOperator(store.root, { id: "extend-attempt", principal, project_id: "project", action: "extend_limits" as const, ticket_id: "author", expected_revision: blocked.revision, reason: "Explicitly authorize another attempt", max_attempts: 2 });
  store.authorizeLimits(extension); store.queueRepair("author"); store.claim("author", "repair", 1000); assert.equal(store.ticket("author").attempt_count, 2);
  assert.throws(() => store.authorizeLimits(signLocalOperator(store.root, { ...extension.payload, id: "stale-extension" })), /STALE_LIMIT_EXTENSION/); store.close();
}));

test("native model turn limit stops execution before an extra model call; extension preserves usage", async () => isolated(async root => {
  const { store, principal } = setup(root, { maxTurns: 1 }); const ctx = store.claim("author", "artist", 1000), work = dirname(store.draftDirectory(ctx));
  for (const dir of ["references", "versions", "skills"]) mkdirSync(join(work, dir));
  const model = new ScriptedModel([() => call("write_file", { file_path: "/drafts/notes.txt", content: "mock notes" }), () => new AIMessage("This call should never run")]);
  const agent = assignmentAgent(model, store, ctx, "openai:isolated-scripted-model", "Explicit isolated local mock turn-limit test.");
  await assert.rejects(agent.invoke({ messages: [{ role: "user", content: "Write notes then finish." }] }, { recursionLimit: 20 }), /TURN_LIMIT/);
  assert.equal(model.calls.length, 1); assert.equal(store.ticket("author").blocked_reason, "TURN_LIMIT"); const blocked = store.ticket("author");
  store.authorizeLimits(signLocalOperator(store.root, { id: "extend-turns", principal, project_id: "project", action: "extend_limits" as const, ticket_id: "author", expected_revision: blocked.revision, reason: "Explicit test turn extension", max_turns: 2 }));
  store.beginTurn(ctx, "new-turn"); assert.equal(store.beginTurn(ctx, "new-turn").replayed, true);
  assert.throws(() => store.beginTurn(ctx, "third-turn"), /TURN_LIMIT/); store.close();
}));

test("authenticated ticket allowance extension cannot silently raise the project cap or resume pause", async () => isolated(root => {
  const { store, principal } = setup(root); const t = store.ticket("author");
  store.authenticatedProjectCommand(signLocalOperator(store.root, { id: "pause", principal, project_id: "project", action: "pause" as const, value: 1, reason: "Explicit test pause" }));
  store.authorizeLimits(signLocalOperator(store.root, { id: "extend-budget", principal, project_id: "project", action: "extend_limits" as const, ticket_id: "author", expected_revision: t.revision, reason: "Explicit ticket-only allowance extension", allowance_micros: 2000000 }));
  assert.equal(store.ticket("author").allowance, 2000000); assert.equal(store.project("project").allowance, 1000000); assert.equal(store.project("project").paused, 1); store.close();
}));

test("local operator CLI applies one signed exact-version decision and keeps capability outside worker tools", async () => isolated(async root => {
  const { store } = setup(root); candidate(store, store.claim("author", "artist", 1000), GOOD); const card = pass(store);
  const file = join(root, "operator-command.json"); writeFileSync(file, JSON.stringify({ id: "cli-approve", action: "decide", ...card, decision: "APPROVE" }));
  const script = join(import.meta.dirname, "operator-cli.ts");
  const result = await exec(process.execPath, ["--import", "tsx", script, root, "apply", file]); assert.equal(JSON.parse(result.stdout).status, "APPROVED");
  const replay = await exec(process.execPath, ["--import", "tsx", script, root, "apply", file]); assert.deepEqual(JSON.parse(replay.stdout), JSON.parse(result.stdout));
  assert.throws(() => store.claim("review", "nobody", 1000), /TICKET_ALREADY_CLAIMED/);
  store.createTicket("isolated-reviewer", "project", "reviewer", {}, 0, "REVIEWER"); const ctx = store.claim("isolated-reviewer", "separate-worker", 1000);
  const work = dirname(store.draftDirectory(ctx)); for (const dir of ["references", "versions", "skills"]) mkdirSync(join(work, dir));
  const privateKey = JSON.parse(readFileSync(join(store.root, "operator-auth.json"), "utf8")).key;
  const model = new ScriptedModel([() => call("read_file", { file_path: "/operator-auth.json" }), messages => { assert.ok(!JSON.stringify(messages).includes(privateKey)); return new AIMessage("Explicit mock test finished"); }]);
  const agent = assignmentAgent(model, store, ctx, "openai:isolated-scripted-model", "Explicit isolated auth-file permission test.");
  await agent.invoke({ messages: [{ role: "user", content: "Probe the protected operator file." }] }, { recursionLimit: 16 });
  assert.ok(!model.toolNames.some(name => /operator|approve|execute|task/.test(name))); store.close();
}));

test("published-byte tampering prevents approval; only approved local versions become inputs", async () => isolated(root => {
  const { store, principal } = setup(root); const v = candidate(store, store.claim("author", "artist", 1000), GOOD);
  assert.throws(() => store.setInput("project", "background", v.id), /UNAPPROVED_INPUT_VERSION/);
  pass(store); const command = signedDecision(store, principal, "approve");
  chmodSync(v.path, 0o600); writeFileSync(v.path, "CORRUPTED_MOCK_BYTES");
  assert.throws(() => store.directorDecision(command), /PUBLISHED_BYTES_CORRUPT/); assert.equal(store.ticket("author").status, "AWAITING_APPROVAL");
  writeFileSync(v.path, GOOD); chmodSync(v.path, 0o400); store.directorDecision(command); store.setInput("project", "background", v.id);
  store.createTicket("dependent", "project", "author", { background: v.id }, 1000000); store.claim("dependent", "next-artist", 1000); store.close();
}));

test("native independent reviewer submission ends its separate assignment without director approval", async () => isolated(async root => {
  const { store } = setup(root); candidate(store, store.claim("author", "artist", 1000), GOOD); const r = reviewing(store, "review");
  const result = verdict(store, r.ctx, "PASS"), work = dirname(store.draftDirectory(r.ctx)); for (const dir of ["references", "versions", "skills"]) mkdirSync(join(work, dir));
  const model = new ScriptedModel([() => call("submit_review", result)]);
  const agent = assignmentAgent(model, store, r.ctx, "openai:isolated-scripted-model", "Explicit mock reviewer finishing an already-inspected fixture.");
  await agent.invoke({ messages: [{ role: "user", content: "Submit the explicit local mock review." }] }, { recursionLimit: 16 });
  assert.equal(model.calls.length, 1); assert.equal(store.ticket("author").status, "AWAITING_APPROVAL"); assert.equal(store.ticket("review").status, "SUBMITTED"); store.close();
}));

test("schema v1 upgrade preserves published versions and pause", async () => isolated(root => {
  // A real v1-shaped SQLite fixture reproduces the Phase 3 schema upgrade boundary.
  const db = new DatabaseSync(join(root, "studio.sqlite"));
  db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY,paused INTEGER NOT NULL DEFAULT 1 CHECK(paused IN (0,1)),allowance INTEGER NOT NULL CHECK(allowance>=0)) STRICT;
    CREATE TABLE tickets(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),role TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'AUTHOR',status TEXT NOT NULL,inputs TEXT NOT NULL,allowance INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 0,token INTEGER NOT NULL DEFAULT 0,worker_id TEXT,attempt_id TEXT,lease_until INTEGER,candidate_id TEXT) STRICT;
    CREATE TABLE versions(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES tickets(id),attempt_id TEXT NOT NULL,content_hash TEXT NOT NULL,path TEXT NOT NULL,inputs TEXT NOT NULL,evidence TEXT NOT NULL,published_at INTEGER NOT NULL,UNIQUE(ticket_id,attempt_id)) STRICT;
    INSERT INTO projects VALUES ('project',1,1000000); INSERT INTO tickets VALUES ('author','project','author','AUTHOR','SUBMITTED','{}',1000000,1,1,'old-worker','old-attempt',2000,'old-version'); PRAGMA user_version=1;`);
  mkdirSync(join(root, "versions")); const path = join(root, "versions", hash(Buffer.from(GOOD))); writeFileSync(path, GOOD);
  db.prepare("INSERT INTO versions VALUES (?,?,?,?,?,?,?,?)").run("old-version", "author", "old-attempt", hash(Buffer.from(GOOD)), path, "{}", "[]", 1000); db.close();
  const store = new StudioProduction(root, () => 1000); assert.equal(store.project("project").paused, 1); assert.equal(store.ticket("author").attempt_count, 1); assert.equal(store.ticket("author").token, 1); assert.equal(readFileSync(store.version("old-version").path, "utf8"), GOOD); store.close();
  const reopened = new StudioProduction(root, () => 1000); assert.equal(reopened.ticket("author").attempt_count, 1); reopened.close();
}));
