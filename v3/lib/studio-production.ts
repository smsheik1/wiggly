import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { constants, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, fsyncSync, linkSync, unlinkSync, realpathSync, fstatSync } from "node:fs";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { authenticateOperator, commandJSON, type SignedOperatorCommand, type OperatorPayload } from "./studio-operator.js";

export type WorkerLease = { ticketId: string; workerId: string; token: number; attemptId: string };
export type OperatorDecision = { id: string; actor: string; reason: string };
export type InputVersions = Record<string, string>;
export type KillPoint = "after_intent" | "after_dispatch_before_call" | "after_submit_before_request_id" | "after_request_id" | "after_publish_before_record" | "after_publication_commit";
export type TicketLimits = { maxAttempts: number; maxStrikes: number; maxTurns: number };
export type DirectorDecision = OperatorPayload & { action: "decide"; ticket_id: string; candidate_version_id: string; content_hash: string; expected_revision: number; decision: "APPROVE" | "REJECT"; selection?: number; feedback?: string };
export type LimitExtension = OperatorPayload & { action: "extend_limits"; ticket_id: string; expected_revision: number; reason: string; max_attempts?: number; max_strikes?: number; max_turns?: number; allowance_micros?: number; recover_rejected_operation?: { operation_id: string; request_id: string; evidence_reference: string } };
export const memoirReviewModality = (kind: string) => ["candidates", "sheet", "backgroundCandidates", "backgroundAngle", "keyframe"].includes(kind) ? "image" : ["voiceSample", "audition", "narration", "music", "effect"].includes(kind) ? "audio" : kind === "video" ? "video" : kind === "film" ? "audiovisual" : "text";
export const memoirFilmReviewCriteria = { video: ["technical", "story", "visual-continuity", "motion", "safety", "provenance"], audio: ["narration", "mix", "safety", "provenance"] };
export const memoirReviewCoverage = "complete candidate and every referenced media item";
export type ReviewDirection = { criteria: string[]; modality: string; coverage: string };
export type ReviewVerdict = { verdict: "PASS" | "CHANGES_REQUESTED" | "INCONCLUSIVE"; findings: string; defects: { criterion: string; region: string; evidence: string }[]; evidence_references: string[]; direction_compatible?: boolean };
type Row = Record<string, any>;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const requireThat = (condition: unknown, code: string): void => { if (!condition) throw new Error(code); };
const money = (n: number) => requireThat(Number.isSafeInteger(n) && n >= 0, "INVALID_MICRO_USD");
const id = (s: string) => requireThat(typeof s === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(s), "INVALID_ID");
const json = (value: unknown) => { const text = JSON.stringify(value); requireThat(text !== undefined && Buffer.byteLength(text) <= 65536, "RECORD_TOO_LARGE"); return text; };
const inputsJSON = (value: InputVersions) => { for (const [key, version] of Object.entries(value)) { id(key); requireThat(typeof version === "string" && version.length > 0 && version.length <= 256, "INVALID_INPUT_VERSION"); } return json(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))); };

/** Trusted Node runtime only. Workers receive bound tools, never this store or SQL access.
 * ponytail: one SQLite writer per transaction; add a service only after contention is measured.
 * Amounts are integer micro-USD allowances, separate from verified billing and subscription credits.
 */
export class StudioProduction {
  readonly root: string;
  #db: DatabaseSync;
  constructor(root: string, private now: () => number = Date.now, private kill: (point: KillPoint) => void = () => {}) {
    mkdirSync(root, { recursive: true }); this.root = realpathSync(root);
    this.#db = new DatabaseSync(join(this.root, "studio.sqlite"));
    this.#db.exec("PRAGMA busy_timeout=5000");
    requireThat([0, 1, 2, 3, 4, 5].includes(this.#get("PRAGMA user_version")!.user_version), "UNSUPPORTED_STUDIO_SCHEMA");
    this.#db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, paused INTEGER NOT NULL DEFAULT 1 CHECK(paused IN (0,1)), allowance INTEGER NOT NULL CHECK(allowance>=0)) STRICT;
      CREATE TABLE IF NOT EXISTS operator_decisions(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), actor TEXT NOT NULL, action TEXT NOT NULL, value INTEGER NOT NULL, reason TEXT NOT NULL, at INTEGER NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS input_heads(project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL, version TEXT NOT NULL, PRIMARY KEY(project_id,name)) STRICT;
      CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), role TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'AUTHOR' CHECK(kind IN ('AUTHOR','REVIEWER')), status TEXT NOT NULL CHECK(status IN ('READY','WORKING','SUBMITTED','REVIEWING','AWAITING_APPROVAL','APPROVED','CHANGES_REQUESTED','BLOCKED','CANCELLED')), inputs TEXT NOT NULL, allowance INTEGER NOT NULL CHECK(allowance>=0), revision INTEGER NOT NULL DEFAULT 0, token INTEGER NOT NULL DEFAULT 0, worker_id TEXT, attempt_id TEXT, lease_until INTEGER, candidate_id TEXT) STRICT;
      CREATE TABLE IF NOT EXISTS inspections(id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), attempt_id TEXT NOT NULL, role TEXT NOT NULL, run_id TEXT NOT NULL, model TEXT NOT NULL, modality TEXT NOT NULL, coverage TEXT NOT NULL, content_hash TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('MEDIA_SUPPLIED','INSPECTION_COMPLETED')), findings TEXT, supplied_at INTEGER NOT NULL, completed_at INTEGER) STRICT;
      CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), attempt_id TEXT NOT NULL, token INTEGER NOT NULL, provider TEXT NOT NULL, request_hash TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('INTENT','SUBMITTING','SUBMITTED','UNKNOWN','COMPLETED','FAILED')), estimate INTEGER NOT NULL CHECK(estimate>=0), reservation INTEGER NOT NULL CHECK(reservation>=0), settled_at INTEGER, allowance_used INTEGER CHECK(allowance_used>=0), allowance_basis TEXT, request_id TEXT, result TEXT, provider_usage TEXT, included_credits TEXT, verified_charge INTEGER CHECK(verified_charge>=0), diagnostic TEXT) STRICT;
      CREATE TABLE IF NOT EXISTS publication_intents(ticket_id TEXT NOT NULL REFERENCES tickets(id), attempt_id TEXT NOT NULL, version_id TEXT NOT NULL UNIQUE, content_hash TEXT NOT NULL, inputs TEXT NOT NULL, evidence TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('INTENT','COMMITTED')), PRIMARY KEY(ticket_id,attempt_id)) STRICT;
      CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES tickets(id), attempt_id TEXT NOT NULL, content_hash TEXT NOT NULL, path TEXT NOT NULL, inputs TEXT NOT NULL, evidence TEXT NOT NULL, published_at INTEGER NOT NULL, UNIQUE(ticket_id,attempt_id)) STRICT;
      CREATE INDEX IF NOT EXISTS operations_ticket ON operations(ticket_id,state);
      CREATE INDEX IF NOT EXISTS tickets_project ON tickets(project_id,status);`);
    this.#tx(() => {
      if (this.#get("PRAGMA user_version")!.user_version < 2) {
        this.#db.exec(`ALTER TABLE tickets ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts>0);
          ALTER TABLE tickets ADD COLUMN max_strikes INTEGER NOT NULL DEFAULT 3 CHECK(max_strikes>0);
          ALTER TABLE tickets ADD COLUMN max_turns INTEGER NOT NULL DEFAULT 8 CHECK(max_turns>0);
          ALTER TABLE tickets ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0);
          ALTER TABLE tickets ADD COLUMN strike_count INTEGER NOT NULL DEFAULT 0 CHECK(strike_count>=0);
          ALTER TABLE tickets ADD COLUMN blocked_reason TEXT;
          ALTER TABLE tickets ADD COLUMN blocked_from TEXT;
          ALTER TABLE tickets ADD COLUMN feedback TEXT;
          CREATE TABLE assignment_claims(ticket_id TEXT NOT NULL REFERENCES tickets(id),attempt_id TEXT NOT NULL,token INTEGER NOT NULL,worker_id TEXT NOT NULL,PRIMARY KEY(ticket_id,token)) STRICT;
          CREATE TABLE worker_turns(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL REFERENCES tickets(id),attempt_id TEXT NOT NULL,at INTEGER NOT NULL) STRICT;
          CREATE TABLE reviews(id TEXT PRIMARY KEY,author_ticket TEXT NOT NULL REFERENCES tickets(id),reviewer_ticket TEXT NOT NULL UNIQUE REFERENCES tickets(id),version_id TEXT NOT NULL REFERENCES versions(id),author_revision INTEGER NOT NULL,packet TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('OPEN','FINISHED')),verdict TEXT,findings TEXT,defects TEXT,evidence TEXT) STRICT;
          CREATE TABLE director_commands(id TEXT PRIMARY KEY,action TEXT NOT NULL,project_id TEXT NOT NULL REFERENCES projects(id),ticket_id TEXT NOT NULL REFERENCES tickets(id),principal TEXT NOT NULL,payload_hash TEXT NOT NULL,payload TEXT NOT NULL,auth_hash TEXT NOT NULL,result TEXT NOT NULL,at INTEGER NOT NULL) STRICT;
          UPDATE tickets SET attempt_count=1 WHERE attempt_id IS NOT NULL;
          INSERT INTO assignment_claims SELECT id,attempt_id,token,worker_id FROM tickets WHERE attempt_id IS NOT NULL AND worker_id IS NOT NULL;
          PRAGMA user_version=2;`);
      }
    });
    this.#tx(() => {
      if (this.#get("PRAGMA user_version")!.user_version < 3) {
        this.#db.exec(`ALTER TABLE projects ADD COLUMN max_workers INTEGER NOT NULL DEFAULT 8 CHECK(max_workers>0);
          CREATE TABLE provider_limits(provider TEXT PRIMARY KEY,max_inflight INTEGER NOT NULL CHECK(max_inflight>0)) STRICT;
          CREATE INDEX operations_provider ON operations(provider,state);
          PRAGMA user_version=3;`);
      }
    });
    this.#tx(() => {
      if (this.#get("PRAGMA user_version")!.user_version < 4) this.#db.exec(`ALTER TABLE provider_limits ADD COLUMN min_interval_ms INTEGER NOT NULL DEFAULT 0 CHECK(min_interval_ms>=0);
        ALTER TABLE provider_limits ADD COLUMN next_allowed_at INTEGER NOT NULL DEFAULT 0;
        PRAGMA user_version=4;`);
    });
    this.#tx(() => {
      if (this.#get("PRAGMA user_version")!.user_version < 5) this.#db.exec(`
        ALTER TABLE versions ADD COLUMN validation_hash TEXT;
        ALTER TABLE reviews ADD COLUMN direction_compatible INTEGER CHECK(direction_compatible IN (0,1));
        CREATE TABLE format_policies(project_id TEXT PRIMARY KEY REFERENCES projects(id),policy TEXT NOT NULL,authorization TEXT NOT NULL) STRICT;
        CREATE TABLE format_assignments(ticket_id TEXT PRIMARY KEY REFERENCES tickets(id),kind TEXT NOT NULL,checkpoint TEXT,criteria TEXT NOT NULL,packet TEXT NOT NULL,selection INTEGER) STRICT;
        CREATE TABLE policy_acceptances(version_id TEXT PRIMARY KEY REFERENCES versions(id),policy TEXT NOT NULL,validation TEXT NOT NULL,at INTEGER NOT NULL) STRICT;
        PRAGMA user_version=5;`);
    });
    for (const dir of ["assignments", "versions", "publication-staging"]) { mkdirSync(join(this.root, dir), { recursive: true }); requireThat(realpathSync(join(this.root, dir)) === join(this.root, dir), "WORKSPACE_SYMLINK"); }
  }
  close() { this.#db.close(); }
  #get(sql: string, ...args: SQLInputValue[]) { return this.#db.prepare(sql).get(...args) as Row | undefined; }
  #run(sql: string, ...args: SQLInputValue[]) { return this.#db.prepare(sql).run(...args); }
  #tx<T>(body: () => T): T { this.#db.exec("BEGIN IMMEDIATE"); try { const result = body(); this.#db.exec("COMMIT"); return result; } catch (error) { this.#db.exec("ROLLBACK"); throw error; } }
  project(projectId: string) { const row = this.#get("SELECT * FROM projects WHERE id=?", projectId); requireThat(row, "PROJECT_NOT_FOUND"); return row!; }
  ticket(ticketId: string) { const row = this.#get("SELECT * FROM tickets WHERE id=?", ticketId); requireThat(row, "TICKET_NOT_FOUND"); return row!; }
  operation(operationId: string) { const row = this.#get("SELECT * FROM operations WHERE id=?", operationId); requireThat(row, "OPERATION_NOT_FOUND"); return row!; }
  version(versionId: string) { const row = this.#get("SELECT * FROM versions WHERE id=?", versionId); requireThat(row, "VERSION_NOT_FOUND"); return row!; }
  createProject(projectId: string, allowanceMicros: number) { id(projectId); money(allowanceMicros); this.#run("INSERT INTO projects(id,allowance) VALUES (?,?)", projectId, allowanceMicros); }
  // Operator authentication belongs at the host boundary. These methods must never be worker tools.
  operator(projectId: string, action: "pause" | "resume" | "extend_allowance", value: number, decision: OperatorDecision) {
    requireThat(["pause", "resume", "extend_allowance"].includes(action), "INVALID_OPERATOR_ACTION");
    id(decision.id); requireThat(decision.actor.trim() && decision.reason.trim(), "OPERATOR_AUTHORIZATION_REQUIRED"); money(value);
    return this.#tx(() => {
      const previous = this.#get("SELECT * FROM operator_decisions WHERE id=?", decision.id);
      if (previous) { requireThat(previous.project_id === projectId && previous.action === action && previous.value === value && previous.actor === decision.actor && previous.reason === decision.reason, "CONFLICTING_OPERATOR_DECISION"); return; }
      const project = this.project(projectId);
      if (action === "extend_allowance") { requireThat(value > project.allowance, "ALLOWANCE_MUST_INCREASE"); this.#run("UPDATE projects SET allowance=? WHERE id=?", value, projectId); }
      else { requireThat(value === (action === "pause" ? 1 : 0), "INVALID_PAUSE_DECISION"); this.#run("UPDATE projects SET paused=? WHERE id=?", value, projectId); }
      this.#run("INSERT INTO operator_decisions VALUES (?,?,?,?,?,?,?)", decision.id, projectId, decision.actor, action, value, decision.reason, this.now());
    });
  }
  authenticatedProjectCommand(command: SignedOperatorCommand<OperatorPayload & { action: "pause" | "resume" | "extend_allowance"; value: number; reason: string }>) {
    const p = authenticateOperator(this.root, command);
    this.operator(p.project_id, p.action, p.value, { id: p.id, actor: p.principal, reason: p.reason });
    return { command_id: p.id, project: this.project(p.project_id) };
  }
  setInput(projectId: string, name: string, version: string) {
    inputsJSON({ [name]: version });
    this.#tx(() => {
      const local = this.#get("SELECT * FROM versions WHERE id=?", version);
      if (local) requireThat(this.ticket(local.ticket_id).project_id === projectId && (this.#get("SELECT id FROM director_commands WHERE project_id=? AND action='decide' AND json_extract(result,'$.candidate_version_id')=? AND json_extract(result,'$.status')='APPROVED'", projectId, version) || this.#get("SELECT version_id FROM policy_acceptances WHERE version_id=?", version)), "UNAPPROVED_INPUT_VERSION");
      // Opaque external version IDs remain a trusted producer/import boundary; no legacy migration here.
      this.#run("INSERT INTO input_heads VALUES (?,?,?) ON CONFLICT(project_id,name) DO UPDATE SET version=excluded.version", projectId, name, version);
    });
  }
  createTicket(ticketId: string, projectId: string, role: string, inputs: InputVersions, allowanceMicros: number, kind: "AUTHOR" | "REVIEWER" = "AUTHOR", limits: Partial<TicketLimits> = {}) {
    id(ticketId); id(role); money(allowanceMicros);
    const cap = { maxAttempts: 3, maxStrikes: 3, maxTurns: kind === "REVIEWER" ? 4 : 8, ...limits };
    requireThat(Object.values(cap).every(n => Number.isSafeInteger(n) && n > 0), "INVALID_TICKET_LIMITS");
    this.#run("INSERT INTO tickets(id,project_id,role,kind,status,inputs,allowance,max_attempts,max_strikes,max_turns) VALUES (?,?,?,?,'READY',?,?,?,?,?)", ticketId, projectId, role, kind, inputsJSON(inputs), allowanceMicros, cap.maxAttempts, cap.maxStrikes, cap.maxTurns);
  }
  // Trusted producer configuration, never a worker tool. Limits apply across processes.
  configureConcurrency(projectId: string, maxWorkers: number, providers: Record<string, number>, intervals: Record<string, number> = {}) {
    requireThat(Number.isSafeInteger(maxWorkers) && maxWorkers > 0, "INVALID_WORKER_LIMIT");
    for (const [provider, cap] of Object.entries(providers)) { id(provider); requireThat(Number.isSafeInteger(cap) && cap > 0, "INVALID_PROVIDER_LIMIT"); }
    for (const [provider, ms] of Object.entries(intervals)) requireThat(provider in providers && Number.isSafeInteger(ms) && ms >= 0, "INVALID_PROVIDER_INTERVAL");
    this.#tx(() => { this.project(projectId); this.#run("UPDATE projects SET max_workers=? WHERE id=?", maxWorkers, projectId);
      for (const [provider, cap] of Object.entries(providers)) this.#run("INSERT INTO provider_limits(provider,max_inflight,min_interval_ms) VALUES (?,?,?) ON CONFLICT(provider) DO UPDATE SET max_inflight=excluded.max_inflight,min_interval_ms=excluded.min_interval_ms", provider, cap, intervals[provider] ?? 0);
    });
  }
  providerCapacity(provider: string) {
    const policy = this.#get("SELECT * FROM provider_limits WHERE provider=?", provider), limit = policy?.max_inflight ?? 1;
    const used = this.#get("SELECT COUNT(*) AS used FROM operations WHERE provider=? AND (state IN ('SUBMITTING','SUBMITTED','UNKNOWN') OR (state='FAILED' AND settled_at IS NULL))", provider)!.used;
    return { limit, used, nextAllowedAt: policy?.next_allowed_at ?? 0 };
  }
  assertCurrentInputs(projectId: string, inputs: InputVersions) { this.#currentInputs({ project_id: projectId, inputs: inputsJSON(inputs) }); }
  #currentInputs(ticket: Row) {
    const binding = ticket.id ? this.memoirAssignment(ticket.id) : undefined;
    const ownKey = binding ? JSON.parse(binding.packet).asset_key?.replaceAll(":", "__") : undefined;
    for (const [name, version] of Object.entries(JSON.parse(ticket.inputs))) {
      // An approved revision may keep its previous output as immutable reference history.
      // Before publication/approval the prior head remains strictly fenced like every input.
      if (ticket.status === "APPROVED" && name === ownKey) continue;
      requireThat(this.#get("SELECT version FROM input_heads WHERE project_id=? AND name=?", ticket.project_id, name)?.version === version, "STALE_INPUTS");
    }
  }
  #lease(ctx: WorkerLease, submittedReplay = false) {
    const t = this.ticket(ctx.ticketId);
    requireThat(t.worker_id === ctx.workerId && t.token === ctx.token && t.attempt_id === ctx.attemptId && t.lease_until > this.now(), "STALE_WORKER");
    requireThat(t.status === "WORKING" || (submittedReplay && t.status === "SUBMITTED"), "TICKET_NOT_WORKING");
    requireThat(!this.project(t.project_id).paused, "PROJECT_PAUSED"); this.#currentInputs(t); return t;
  }
  claim(ticketId: string, workerId: string, leaseMs: number): WorkerLease {
    id(workerId); requireThat(Number.isSafeInteger(leaseMs) && leaseMs > 0, "INVALID_LEASE_DURATION");
    const result = this.#tx(() => {
      const t = this.ticket(ticketId); requireThat(!this.project(t.project_id).paused, "PROJECT_PAUSED"); this.#currentInputs(t);
      requireThat(t.status === "READY" || (t.status === "WORKING" && t.lease_until <= this.now()), "TICKET_ALREADY_CLAIMED");
      const active = this.#get("SELECT COUNT(*) AS used FROM tickets WHERE project_id=? AND status='WORKING' AND lease_until>? AND id<>?", t.project_id, this.now(), ticketId)!.used;
      requireThat(active < this.project(t.project_id).max_workers, "WORKER_CAPACITY_BUSY");
      requireThat(!this.#get("SELECT id FROM operations WHERE ticket_id=? AND state IN ('SUBMITTING','UNKNOWN')", ticketId), "UNCERTAIN_OPERATION");
      const review = this.#get("SELECT * FROM reviews WHERE reviewer_ticket=?", ticketId);
      if (review) requireThat(!this.#get("SELECT worker_id FROM assignment_claims WHERE ticket_id=? AND attempt_id=? AND worker_id=?", review.author_ticket, this.version(review.version_id).attempt_id, workerId), "AUTHOR_CANNOT_REVIEW_OWN_WORK");
      if (t.status === "READY" && t.attempt_count >= t.max_attempts) { this.#block(ticketId, "ATTEMPT_LIMIT", "READY"); return { limitError: "ATTEMPT_LIMIT" }; }
      const attemptId = t.status === "WORKING" ? t.attempt_id : randomUUID();
      this.#run("UPDATE tickets SET status='WORKING',worker_id=?,attempt_id=?,token=token+1,lease_until=?,revision=revision+1 WHERE id=?", workerId, attemptId, this.now() + leaseMs, ticketId);
      if (t.status === "READY") this.#run("UPDATE tickets SET attempt_count=attempt_count+1 WHERE id=?", ticketId);
      this.#run("INSERT INTO assignment_claims VALUES (?,?,?,?)", ticketId, attemptId, t.token + 1, workerId);
      mkdirSync(join(this.root, "assignments", ticketId, attemptId, "drafts"), { recursive: true });
      return { ticketId, workerId, token: t.token + 1, attemptId };
    });
    if ("limitError" in result) throw new Error(result.limitError);
    return result;
  }
  #block(ticketId: string, reason: string, from: string) {
    this.#run("UPDATE tickets SET status='BLOCKED',blocked_reason=?,blocked_from=?,revision=revision+1 WHERE id=?", reason, from, ticketId);
  }
  beginTurn(ctx: WorkerLease, turnId: string) {
    id(turnId);
    const result = this.#tx(() => {
      const t = this.#lease(ctx), prior = this.#get("SELECT * FROM worker_turns WHERE id=?", turnId);
      if (prior) { requireThat(prior.ticket_id === ctx.ticketId && prior.attempt_id === ctx.attemptId, "TURN_REPLAY_CONFLICT"); return { replayed: true }; }
      const used = this.#get("SELECT COUNT(*) AS count FROM worker_turns WHERE ticket_id=? AND attempt_id=?", ctx.ticketId, ctx.attemptId)!.count;
      if (used >= t.max_turns) { this.#block(ctx.ticketId, "TURN_LIMIT", "WORKING"); return { limitError: "TURN_LIMIT" }; }
      this.#run("INSERT INTO worker_turns VALUES (?,?,?,?)", turnId, ctx.ticketId, ctx.attemptId, this.now()); return { replayed: false };
    });
    if (result.limitError) throw new Error(result.limitError); return result;
  }
  #verifyVersion(version: Row) { requireThat(realpathSync(version.path) === version.path && sha(readFileSync(version.path)) === version.content_hash, "PUBLISHED_BYTES_CORRUPT"); }
  startReview(authorTicket: string, reviewerTicket: string, role: string, direction: ReviewDirection, allowanceMicros = 0, limits: Partial<TicketLimits> = {}) {
    requireThat(direction.criteria.length > 0 && direction.criteria.every(c => typeof c === "string" && c.trim()) && direction.coverage.trim() && direction.modality.trim(), "REVIEW_CRITERIA_REQUIRED");
    return this.#tx(() => {
      const author = this.ticket(authorTicket); requireThat(author.kind === "AUTHOR" && author.status === "SUBMITTED", "AUTHOR_NOT_SUBMITTED");
      requireThat(!this.project(author.project_id).paused, "PROJECT_PAUSED"); this.#currentInputs(author);
      const binding = this.memoirAssignment(authorTicket);
      if (binding) {
        const filmCriteria = binding.kind === "film" ? memoirFilmReviewCriteria[direction.modality as "video" | "audio"] : undefined;
        requireThat(json(direction.criteria) === (binding.kind === "film" ? json(filmCriteria ?? []) : binding.criteria) && (binding.kind === "film" ? !!filmCriteria : direction.modality === memoirReviewModality(binding.kind)) && direction.coverage === memoirReviewCoverage, "FORMAT_REVIEW_SCOPE_REQUIRED");
        if (binding.kind === "film") requireThat(!this.#get("SELECT id FROM reviews WHERE author_ticket=? AND version_id=? AND verdict='PASS' AND json_extract(packet,'$.modality')=?", author.id, author.candidate_id, direction.modality), "FILM_MODALITY_ALREADY_REVIEWED");
      }
      const candidate = this.version(author.candidate_id); this.#verifyVersion(candidate);
      this.createTicket(reviewerTicket, author.project_id, role, JSON.parse(author.inputs), allowanceMicros, "REVIEWER", limits);
      const packet = { project_id: author.project_id, ticket_id: authorTicket, candidate_version_id: candidate.id, content_hash: candidate.content_hash, candidate_path: candidate.path, exact_inputs: JSON.parse(candidate.inputs), ...(binding ? { assignment: { kind: binding.kind, outcome: JSON.parse(binding.packet).outcome ?? null, selectors: JSON.parse(binding.packet).selectors ?? {} } } : {}), criteria: direction.criteria, modality: direction.modality, coverage: direction.coverage, director_approved: false };
      const reviewId = randomUUID();
      this.#run("UPDATE tickets SET status='REVIEWING',revision=revision+1 WHERE id=?", authorTicket);
      this.#run("INSERT INTO reviews(id,author_ticket,reviewer_ticket,version_id,author_revision,packet,state) VALUES (?,?,?,?,?,?,'OPEN')", reviewId, authorTicket, reviewerTicket, candidate.id, author.revision + 1, json(packet));
      return { reviewId, packet };
    });
  }
  reviewPacket(reviewerTicket: string) { const review = this.#get("SELECT * FROM reviews WHERE reviewer_ticket=?", reviewerTicket); requireThat(review, "REVIEW_NOT_FOUND"); return JSON.parse(review!.packet); }
  #reviewCurrent(review: Row) {
    const author = this.ticket(review.author_ticket);
    requireThat(author.status === "REVIEWING" && author.candidate_id === review.version_id && author.revision === review.author_revision, "STALE_REVIEW");
    this.#currentInputs(author); this.#verifyVersion(this.version(review.version_id)); return author;
  }
  submitReview(ctx: WorkerLease, result: ReviewVerdict) {
    requireThat(["PASS", "CHANGES_REQUESTED", "INCONCLUSIVE"].includes(result.verdict) && result.findings.trim().length >= 20 && result.findings.length <= 20000, "INVALID_REVIEW_VERDICT");
    requireThat(result.direction_compatible === undefined || typeof result.direction_compatible === "boolean", "INVALID_DIRECTION_COMPATIBILITY");
    requireThat(Array.isArray(result.defects) && result.defects.every(d => d.criterion.trim() && d.region.trim() && d.evidence.trim()), "REVIEW_DEFECT_EVIDENCE_REQUIRED");
    requireThat(result.verdict !== "PASS" || result.defects.length === 0, "PASS_CANNOT_HAVE_DEFECTS");
    requireThat(result.verdict !== "CHANGES_REQUESTED" || result.defects.length > 0, "DEFECTS_REQUIRED");
    return this.#tx(() => {
      const reviewer = this.#lease(ctx, true); requireThat(reviewer.kind === "REVIEWER", "REVIEWER_ASSIGNMENT_REQUIRED");
      const review = this.#get("SELECT * FROM reviews WHERE reviewer_ticket=?", ctx.ticketId); requireThat(review, "REVIEW_NOT_FOUND");
      const evidence = json([...result.evidence_references].sort()), defects = json(result.defects);
      if (review!.state === "FINISHED") { requireThat(review!.verdict === result.verdict && review!.findings === result.findings && review!.defects === defects && review!.evidence === evidence && review!.direction_compatible === (result.direction_compatible === undefined ? null : Number(result.direction_compatible)), "REVIEW_REPLAY_CONFLICT"); return { review_id: review!.id, verdict: review!.verdict, candidate_version_id: review!.version_id }; }
      const author = this.#reviewCurrent(review!), version = this.version(review!.version_id), packet = JSON.parse(review!.packet);
      requireThat(!this.#get("SELECT worker_id FROM assignment_claims WHERE ticket_id=? AND attempt_id=? AND worker_id=?", author.id, version.attempt_id, ctx.workerId), "AUTHOR_CANNOT_REVIEW_OWN_WORK");
      if (result.verdict !== "INCONCLUSIVE") {
        this.#evidence(ctx, result.evidence_references, version.content_hash);
        for (const evidenceId of result.evidence_references) { const e = this.#get("SELECT * FROM inspections WHERE id=?", evidenceId)!; requireThat(e.coverage === packet.coverage && e.modality === packet.modality, "REVIEW_COVERAGE_MISMATCH"); }
      }
      let status = "AWAITING_APPROVAL", reason: string | null = null, from: string | null = null;
      if (result.verdict === "PASS" && this.memoirAssignment(author.id)?.kind === "film") {
        const other = packet.modality === "video" ? "audio" : "video";
        const previous = this.#get("SELECT r.id,t.worker_id FROM reviews r JOIN tickets t ON t.id=r.reviewer_ticket WHERE r.author_ticket=? AND r.version_id=? AND r.verdict='PASS' AND json_extract(r.packet,'$.modality')=?", author.id, version.id, other);
        if (previous) requireThat(previous.worker_id !== ctx.workerId, "FILM_REVIEWERS_MUST_DIFFER");
        else status = "SUBMITTED";
      }
      if (result.verdict === "CHANGES_REQUESTED") { const strikes = author.strike_count + 1; this.#run("UPDATE tickets SET strike_count=? WHERE id=?", strikes, author.id); status = strikes >= author.max_strikes ? "BLOCKED" : "CHANGES_REQUESTED"; if (status === "BLOCKED") { reason = "REPEATED_FAILURE"; from = "CHANGES_REQUESTED"; } }
      if (result.verdict === "INCONCLUSIVE") { status = "BLOCKED"; reason = "REVIEW_INCONCLUSIVE"; from = "SUBMITTED"; }
      this.#run("UPDATE reviews SET state='FINISHED',verdict=?,findings=?,defects=?,evidence=?,direction_compatible=? WHERE id=?", result.verdict, result.findings, defects, evidence, result.direction_compatible === undefined ? null : Number(result.direction_compatible), review!.id);
      this.#run("UPDATE tickets SET status=?,feedback=?,blocked_reason=?,blocked_from=?,revision=revision+1 WHERE id=?", status, result.findings, reason, from, author.id);
      this.#run("UPDATE tickets SET status='SUBMITTED',revision=revision+1 WHERE id=?", ctx.ticketId);
      return { review_id: review!.id, verdict: result.verdict, candidate_version_id: version.id };
    });
  }
  queueRepair(ticketId: string, revisedInputs?: InputVersions) {
    return this.#tx(() => {
      const t = this.ticket(ticketId); requireThat(t.kind === "AUTHOR" && t.status === "CHANGES_REQUESTED", "REPAIR_NOT_ELIGIBLE");
      requireThat(!this.project(t.project_id).paused, "PROJECT_PAUSED");
      const inputs = revisedInputs ? inputsJSON(revisedInputs) : t.inputs; this.#currentInputs({ ...t, inputs });
      requireThat(!this.#get("SELECT id FROM operations WHERE ticket_id=? AND (state IN ('INTENT','SUBMITTING','SUBMITTED','UNKNOWN') OR settled_at IS NULL)", ticketId), "UNRESOLVED_OPERATION");
      if (t.strike_count >= t.max_strikes || t.attempt_count >= t.max_attempts) { this.#block(ticketId, t.strike_count >= t.max_strikes ? "REPEATED_FAILURE" : "ATTEMPT_LIMIT", "CHANGES_REQUESTED"); return this.ticket(ticketId); }
      this.#run("UPDATE tickets SET status='READY',inputs=?,worker_id=NULL,attempt_id=NULL,lease_until=NULL,token=token+1,revision=revision+1 WHERE id=?", inputs, ticketId); return this.ticket(ticketId);
    });
  }
  /** Trusted producer API only: workers cannot activate policies or accept versions. */
  activateMemoirPolicy(command: SignedOperatorCommand<OperatorPayload & { action: "activate_memoir_policy"; source_inputs?: unknown }>) {
    const p = authenticateOperator(this.root, command); id(p.id);
    requireThat(p.action === "activate_memoir_policy", "INVALID_FORMAT_POLICY");
    const authorization = commandJSON(p);
    return this.#tx(() => {
      this.project(p.project_id);
      const previous = this.#get("SELECT * FROM format_policies WHERE project_id=?", p.project_id);
      if (previous) { requireThat(previous.authorization === authorization, "FORMAT_POLICY_ALREADY_ACTIVATED"); return; }
      this.#run("INSERT INTO format_policies VALUES (?,'memoir-v1-four-checkpoints',?)", p.project_id, authorization);
    });
  }
  createMemoirTicket(ticketId: string, projectId: string, role: string, inputs: InputVersions, allowanceMicros: number, kind: string, criteria: string[], packet: unknown, limits: Partial<TicketLimits> = {}) {
    return this.#tx(() => { this.createTicket(ticketId, projectId, role, inputs, allowanceMicros, "AUTHOR", limits); this.#bindMemoirAssignment(ticketId, kind, criteria, packet); return this.ticket(ticketId); });
  }
  bindMemoirAssignment(ticketId: string, kind: string, criteria: string[], packet: unknown = {}) { return this.#tx(() => this.#bindMemoirAssignment(ticketId, kind, criteria, packet)); }
  #bindMemoirAssignment(ticketId: string, kind: string, criteria: string[], packet: unknown) {
    const checkpoints: Record<string, string> = { answers: "storyboard", voiceSample: "narration_performance", clone: "narration_performance", script: "storyboard", roster: "character_style", candidates: "character_style", sheet: "character_style", shotIntentions: "storyboard", shots: "storyboard", narration: "narration_performance", audition: "narration_performance", film: "final_film" };
    const automatic = ["backgrounds", "backgroundBrief", "backgroundPrompt", "backgroundCandidates", "backgroundAngleBrief", "backgroundAnglePrompt", "backgroundAngle", "keyframePrompt", "keyframe", "videoPrompt", "video", "soundPlan", "music", "effect", "editPlan", "videoPlan", "characterPrompt", "sheetPrompt"];
    requireThat(kind in checkpoints || automatic.includes(kind), "UNKNOWN_MEMOIR_ASSIGNMENT");
    requireThat(criteria.length > 0 && criteria.every(c => c.trim()), "REVIEW_CRITERIA_REQUIRED");
    {
      const t = this.ticket(ticketId); requireThat(t.kind === "AUTHOR" && t.status === "READY", "FORMAT_BINDING_REQUIRES_READY_AUTHOR");
      requireThat(this.#get("SELECT project_id FROM format_policies WHERE project_id=?", t.project_id), "FORMAT_POLICY_NOT_AUTHORIZED");
      this.#run("INSERT INTO format_assignments(ticket_id,kind,checkpoint,criteria,packet) VALUES (?,?,?,?,?)", ticketId, kind, checkpoints[kind] ?? null, json(criteria), json(packet));
    }
  }
  memoirPolicy(projectId: string) { const row = this.#get("SELECT * FROM format_policies WHERE project_id=?", projectId); requireThat(row, "FORMAT_POLICY_NOT_AUTHORIZED"); return JSON.parse(row!.authorization); }
  acceptedVersion(projectId: string, versionId: string) {
    return this.#tx(() => {
      const seen = new Set<string>();
      const verify = (candidate: string): Row => {
        requireThat(!seen.has(candidate), "CYCLIC_ASSET_DEPENDENCY"); seen.add(candidate);
        const v = this.version(candidate), t = this.ticket(v.ticket_id);
        requireThat(t.project_id === projectId && t.status === "APPROVED" && t.candidate_id === v.id, "ACCEPTED_VERSION_REQUIRED");
        this.#currentInputs(t); this.#verifyVersion(v);
        requireThat(!this.memoirAssignment(t.id) || v.validation_hash === v.content_hash, "FORMAT_VALIDATION_REQUIRED");
        requireThat(this.#get("SELECT version_id FROM policy_acceptances WHERE version_id=?", v.id) || this.#get("SELECT id FROM director_commands WHERE project_id=? AND action='decide' AND json_extract(result,'$.candidate_version_id')=? AND json_extract(result,'$.status')='APPROVED'", projectId, v.id), "ACCEPTANCE_PROVENANCE_REQUIRED");
        for (const parent of Object.values(JSON.parse(v.inputs)) as string[]) if (this.#get("SELECT id FROM versions WHERE id=?", parent)) verify(parent);
        seen.delete(candidate); return v;
      };
      return verify(versionId);
    });
  }
  memoirAssignment(ticketId: string) { return this.#get("SELECT * FROM format_assignments WHERE ticket_id=?", ticketId); }
  acceptMemoirIntermediate(ticketId: string, validate: (bytes: Buffer, kind: string) => { validator: string; artifact_hash: string }) {
    return this.#tx(() => {
      const t = this.ticket(ticketId), assignment = this.memoirAssignment(ticketId);
      requireThat(assignment && assignment.checkpoint === null, "DIRECTOR_CHECKPOINT_REQUIRED");
      requireThat(!this.project(t.project_id).paused, "PROJECT_PAUSED"); this.#currentInputs(t);
      const v = this.version(t.candidate_id); this.#verifyVersion(v);
      const previous = this.#get("SELECT * FROM policy_acceptances WHERE version_id=?", v.id);
      if (previous) { requireThat(t.status === "APPROVED", "POLICY_ACCEPTANCE_CONFLICT"); return previous; }
      requireThat(t.status === "AWAITING_APPROVAL", "NOT_AWAITING_APPROVAL");
      const review = this.#get("SELECT * FROM reviews WHERE author_ticket=? AND version_id=? AND state='FINISHED' AND verdict='PASS'", t.id, v.id);
      requireThat(review && review.direction_compatible === 1, "DIRECTION_COMPATIBILITY_REQUIRED");
      requireThat(json(JSON.parse(review!.packet).criteria) === assignment!.criteria, "FORMAT_REVIEW_CRITERIA_MISMATCH");
      const validation = validate(readFileSync(v.path), assignment!.kind);
      requireThat(validation.validator.trim() && validation.artifact_hash === v.content_hash, "VALIDATION_HASH_MISMATCH");
      this.#currentInputs(t); this.#verifyVersion(v);
      this.#run("INSERT INTO policy_acceptances VALUES (?,'memoir-v1-four-checkpoints',?,?)", v.id, json(validation), this.now());
      this.#run("UPDATE tickets SET status='APPROVED',revision=revision+1 WHERE id=?", t.id);
      return this.#get("SELECT * FROM policy_acceptances WHERE version_id=?", v.id)!;
    });
  }
  approvalCard(ticketId: string) {
    return this.#tx(() => { const t = this.ticket(ticketId); requireThat(t.status === "AWAITING_APPROVAL", "NOT_AWAITING_APPROVAL"); this.#currentInputs(t); const v = this.version(t.candidate_id); this.#verifyVersion(v); return { project_id: t.project_id, ticket_id: t.id, candidate_version_id: v.id, content_hash: v.content_hash, expected_revision: t.revision }; });
  }
  memoirDirectorQueue(projectId: string) {
    this.project(projectId);
    const tickets = this.#db.prepare("SELECT t.id,f.checkpoint,f.kind FROM tickets t JOIN format_assignments f ON f.ticket_id=t.id WHERE t.project_id=? AND t.status='AWAITING_APPROVAL' ORDER BY f.checkpoint,t.id").all(projectId) as Row[];
    return tickets.map(t => ({ checkpoint: t.checkpoint ?? "direction_exception", kind: t.kind, ...this.approvalCard(t.id) }));
  }
  #commandReplay(payload: OperatorPayload, serialized: string) { const previous = this.#get("SELECT * FROM director_commands WHERE id=?", payload.id); if (!previous) return; requireThat(previous.payload_hash === sha(Buffer.from(serialized)) && previous.principal === payload.principal, "CONFLICTING_DIRECTOR_COMMAND"); return JSON.parse(previous.result); }
  #saveCommand(command: SignedOperatorCommand<OperatorPayload & { ticket_id: string }>, serialized: string, result: unknown) {
    const p = command.payload; this.#run("INSERT INTO director_commands VALUES (?,?,?,?,?,?,?,?,?,?)", p.id, p.action, p.project_id, p.ticket_id, p.principal, sha(Buffer.from(serialized)), serialized, sha(Buffer.from(command.signature)), json(result), this.now());
  }
  directorDecision(command: SignedOperatorCommand<DirectorDecision>) {
    const p = authenticateOperator(this.root, command), serialized = commandJSON(p); id(p.id);
    requireThat(p.action === "decide" && ["APPROVE", "REJECT"].includes(p.decision) && Number.isSafeInteger(p.expected_revision) && /^[a-f0-9]{64}$/.test(p.content_hash), "INVALID_DIRECTOR_DECISION");
    requireThat(p.decision !== "REJECT" || (typeof p.feedback === "string" && p.feedback.trim()), "REJECTION_FEEDBACK_REQUIRED");
    return this.#tx(() => {
      const previous = this.#commandReplay(p, serialized); if (previous) return previous;
      const t = this.ticket(p.ticket_id);
      requireThat(t.project_id === p.project_id && t.status === "AWAITING_APPROVAL" && t.revision === p.expected_revision && t.candidate_id === p.candidate_version_id, "STALE_DIRECTOR_DECISION");
      this.#currentInputs(t); const v = this.version(p.candidate_version_id); this.#verifyVersion(v); requireThat(v.content_hash === p.content_hash, "STALE_DIRECTOR_DECISION");
      requireThat(this.#get("SELECT id FROM reviews WHERE author_ticket=? AND version_id=? AND state='FINISHED' AND verdict='PASS'", t.id, v.id), "INDEPENDENT_PASS_REQUIRED");
      const binding = this.memoirAssignment(t.id);
      if (binding) requireThat(v.validation_hash === v.content_hash, "FORMAT_VALIDATION_REQUIRED");
      if (binding?.kind === "film") {
        const passes = this.#db.prepare("SELECT DISTINCT json_extract(r.packet,'$.modality') AS modality,t.worker_id FROM reviews r JOIN tickets t ON t.id=r.reviewer_ticket WHERE r.author_ticket=? AND r.version_id=? AND r.verdict='PASS'").all(t.id, v.id) as Row[];
        requireThat(passes.some(a => a.modality === "video" && passes.some(b => b.modality === "audio" && b.worker_id !== a.worker_id)), "SEPARATE_FILM_REVIEWS_REQUIRED");
      }
      if (binding?.kind === "candidates" && p.decision === "APPROVE") {
        const files = JSON.parse(readFileSync(v.path, "utf8")).files;
        requireThat(Number.isSafeInteger(p.selection) && p.selection! >= 0 && p.selection! < files.length, "EXPLICIT_CHARACTER_SELECTION_REQUIRED");
        this.#run("UPDATE format_assignments SET selection=? WHERE ticket_id=?", p.selection!, t.id);
      } else requireThat(p.selection === undefined, "SELECTION_NOT_APPLICABLE");
      const strikes = t.strike_count + (p.decision === "REJECT" ? 1 : 0), status = p.decision === "APPROVE" ? "APPROVED" : strikes >= t.max_strikes ? "BLOCKED" : "CHANGES_REQUESTED";
      const changed = this.#run("UPDATE tickets SET status=?,strike_count=?,feedback=?,blocked_reason=?,blocked_from=?,revision=revision+1 WHERE id=? AND status='AWAITING_APPROVAL' AND revision=? AND candidate_id=?", status, strikes, p.feedback ?? t.feedback, status === "BLOCKED" ? "REPEATED_FAILURE" : null, status === "BLOCKED" ? "CHANGES_REQUESTED" : null, t.id, p.expected_revision, p.candidate_version_id);
      requireThat(changed.changes === 1, "STALE_DIRECTOR_DECISION");
      const result = { decision_id: p.id, ticket_id: t.id, candidate_version_id: v.id, content_hash: v.content_hash, status, revision: t.revision + 1, ...(p.selection === undefined ? {} : { selection: p.selection }) };
      this.#saveCommand(command, serialized, result); return result;
    });
  }
  authorizeLimits(command: SignedOperatorCommand<LimitExtension>) {
    const p = authenticateOperator(this.root, command), serialized = commandJSON(p); id(p.id);
    requireThat(p.action === "extend_limits" && p.reason.trim() && Number.isSafeInteger(p.expected_revision), "INVALID_LIMIT_EXTENSION");
    return this.#tx(() => {
      const previous = this.#commandReplay(p, serialized); if (previous) return previous;
      const t = this.ticket(p.ticket_id); requireThat(t.project_id === p.project_id && t.revision === p.expected_revision, "STALE_LIMIT_EXTENSION");
      const limits = { max_attempts: p.max_attempts ?? t.max_attempts, max_strikes: p.max_strikes ?? t.max_strikes, max_turns: p.max_turns ?? t.max_turns, allowance: p.allowance_micros ?? t.allowance };
      for (const [key, value] of Object.entries(limits)) requireThat(Number.isSafeInteger(value) && value >= t[key] && (key === "allowance" ? value >= 0 : value > 0), "LIMITS_CANNOT_DECREASE");
      requireThat(Object.entries(limits).some(([key, value]) => value > t[key]), "EXTENSION_MUST_INCREASE");
      let status = t.status;
      if (t.status === "BLOCKED" && ((t.blocked_reason === "TURN_LIMIT" && limits.max_turns > t.max_turns) || (t.blocked_reason === "ATTEMPT_LIMIT" && limits.max_attempts > t.attempt_count) || (t.blocked_reason === "REPEATED_FAILURE" && limits.max_strikes > t.strike_count))) status = t.blocked_from;
      // An authenticated operator may recover a definitively rejected request while billing remains reserved.
      const recovery = p.recover_rejected_operation;
      if (recovery) {
        const op = this.operation(recovery.operation_id);
        requireThat(t.status === "BLOCKED" && t.blocked_reason === null && op.ticket_id === t.id && op.state === "FAILED" && /HTTP (400|404|429):/.test(op.diagnostic ?? ""), "REJECTED_OPERATION_REQUIRED");
        requireThat(recovery.request_id.trim() && recovery.evidence_reference.trim() && (!op.request_id || op.request_id === recovery.request_id), "REJECTION_RECEIPT_REQUIRED");
        requireThat(!this.#get("SELECT id FROM operations WHERE ticket_id=? AND state IN ('SUBMITTING','SUBMITTED','UNKNOWN')", t.id), "UNCERTAIN_OPERATION");
        this.#run("UPDATE operations SET request_id=? WHERE id=?", recovery.request_id, op.id);
        this.#run("UPDATE tickets SET lease_until=0,token=token+1 WHERE id=?", t.id);
        status = "WORKING"; // claim keeps this attempt and its existing turn history, and fences the old worker.
      }
      this.#run("UPDATE tickets SET max_attempts=?,max_strikes=?,max_turns=?,allowance=?,status=?,blocked_reason=?,blocked_from=?,revision=revision+1 WHERE id=?", limits.max_attempts, limits.max_strikes, limits.max_turns, limits.allowance, status, status === "BLOCKED" ? t.blocked_reason : null, status === "BLOCKED" ? t.blocked_from : null, t.id);
      const result = { command_id: p.id, ticket_id: t.id, status, revision: t.revision + 1, limits, ...(recovery ? { recovered_operation_id: recovery.operation_id, billing_reservation_retained: this.operation(recovery.operation_id).settled_at === null } : {}) }; this.#saveCommand(command, serialized, result); return result;
    });
  }
  /** Resume an operator-authorized, reconciled failure without resetting limits or history. */
  recoverSettledFailure(command: SignedOperatorCommand<OperatorPayload & { action: "recover_settled_failure"; ticket_id: string; operation_id: string; expected_revision: number; request_id: string; evidence_reference: string; reason: string }>) {
    const p = authenticateOperator(this.root, command), serialized = commandJSON(p); id(p.id);
    requireThat(p.action === "recover_settled_failure" && p.reason.trim() && p.request_id.trim() && p.evidence_reference.trim(), "RECOVERY_AUTHORIZATION_REQUIRED");
    return this.#tx(() => {
      const previous = this.#commandReplay(p, serialized); if (previous) return previous;
      const t = this.ticket(p.ticket_id), op = this.operation(p.operation_id);
      requireThat(t.project_id === p.project_id && t.revision === p.expected_revision, "STALE_RECOVERY");
      requireThat(t.status === "BLOCKED" && t.blocked_reason === null && op.ticket_id === t.id && op.attempt_id === t.attempt_id && op.state === "FAILED" && op.settled_at !== null, "SETTLED_FAILURE_REQUIRED");
      requireThat(!op.request_id || op.request_id === p.request_id, "REQUEST_ID_CONFLICT");
      requireThat(!this.#get("SELECT id FROM operations WHERE ticket_id=? AND (state IN ('SUBMITTING','SUBMITTED','UNKNOWN') OR (state='FAILED' AND settled_at IS NULL))", t.id), "UNCERTAIN_OPERATION");
      this.#run("UPDATE operations SET request_id=? WHERE id=?", p.request_id, op.id);
      this.#run("UPDATE tickets SET status='WORKING',lease_until=0,token=token+1,revision=revision+1 WHERE id=?", t.id);
      const result = { command_id: p.id, ticket_id: t.id, status: "WORKING", attempt_id: t.attempt_id, recovered_operation_id: op.id, evidence_reference: p.evidence_reference };
      this.#saveCommand(command, serialized, result); return result;
    });
  }
  heartbeat(ctx: WorkerLease, leaseMs: number) { requireThat(Number.isSafeInteger(leaseMs) && leaseMs > 0, "INVALID_LEASE_DURATION"); this.#tx(() => { this.#lease(ctx); this.#run("UPDATE tickets SET lease_until=? WHERE id=?", this.now() + leaseMs, ctx.ticketId); }); }
  draftDirectory(ctx: WorkerLease) { id(ctx.ticketId); id(ctx.attemptId); return join(this.root, "assignments", ctx.ticketId, ctx.attemptId, "drafts"); }
  #draftBytes(ctx: WorkerLease, draftPath: string) {
    requireThat(draftPath.length > 0 && !isAbsolute(draftPath), "DRAFT_PATH_REQUIRED");
    requireThat(!draftPath.split(/[\\/]/).includes(".."), "DRAFT_PATH_ESCAPE");
    const base = this.draftDirectory(ctx), path = resolve(base, draftPath), rel = relative(base, path);
    requireThat(rel !== "" && rel !== ".." && !rel.startsWith("../") && realpathSync(path) === path && path.startsWith(base + "/"), "DRAFT_PATH_ESCAPE");
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { requireThat(fstatSync(fd).isFile(), "DRAFT_NOT_FILE"); return readFileSync(fd); } finally { closeSync(fd); }
  }
  // Transport calls this with the bytes actually included in the model request, not a pathname reread.
  mediaSupplied(ctx: WorkerLease, transmittedBytes: Buffer, details: { runId: string; model: string; modality: string; coverage: string }) {
    return this.#tx(() => { const t = this.#lease(ctx); requireThat(Object.values(details).every(v => typeof v === "string" && v.trim()), "INSPECTION_METADATA_REQUIRED"); const evidenceId = randomUUID(), contentHash = sha(transmittedBytes); this.#run("INSERT INTO inspections(id,ticket_id,attempt_id,role,run_id,model,modality,coverage,content_hash,status,supplied_at) VALUES (?,?,?,?,?,?,?,?,?,'MEDIA_SUPPLIED',?)", evidenceId, ctx.ticketId, ctx.attemptId, t.role, details.runId, details.model, details.modality, details.coverage, contentHash, this.now()); return evidenceId; });
  }
  inspectionCompleted(ctx: WorkerLease, evidenceId: string, findings: string) {
    requireThat(typeof findings === "string" && findings.trim().length >= 20 && findings.length <= 20000, "INSPECTION_FINDINGS_REQUIRED");
    this.#tx(() => { this.#lease(ctx); const e = this.#get("SELECT * FROM inspections WHERE id=?", evidenceId); requireThat(e?.ticket_id === ctx.ticketId && e.attempt_id === ctx.attemptId, "WRONG_INSPECTION_OWNER"); if (e!.status === "INSPECTION_COMPLETED") { requireThat(e!.findings === findings, "INSPECTION_CONFLICT"); return; } this.#run("UPDATE inspections SET status='INSPECTION_COMPLETED',findings=?,completed_at=? WHERE id=?", findings, this.now(), evidenceId); });
  }
  #evidence(ctx: WorkerLease, evidenceIds: string[], contentHash: string) {
    requireThat(evidenceIds.length > 0 && new Set(evidenceIds).size === evidenceIds.length, "INSPECTION_REQUIRED");
    const t = this.ticket(ctx.ticketId);
    for (const evidenceId of evidenceIds) { const e = this.#get("SELECT * FROM inspections WHERE id=?", evidenceId); requireThat(e?.ticket_id === ctx.ticketId && e.attempt_id === ctx.attemptId && e.role === t.role && e.status === "INSPECTION_COMPLETED" && e.content_hash === contentHash, "INVALID_INSPECTION_EVIDENCE"); }
  }
  /** Trusted provider/import adapter only. Workers never receive arbitrary-path publication. */
  pinMedia(ctx: WorkerLease, bytes: Buffer, extension: string) {
    this.#lease(ctx); requireThat(/^\.(png|jpg|jpeg|webp|wav|mp3|m4a|flac|ogg|mp4|mov)$/.test(extension), "UNSUPPORTED_MEDIA_EXTENSION");
    const content_hash = sha(bytes), path = join(this.root, "versions", content_hash + extension);
    this.#publishBytes(path, bytes); this.#lease(ctx); return { path, sha256: content_hash, bytes: bytes.length };
  }
  readDraft(ctx: WorkerLease, draftPath: string) { this.#lease(ctx); return this.#draftBytes(ctx, draftPath); }
  publish(ctx: WorkerLease, request: { draft_path: string; evidence_references: string[]; validated_hash?: string }) {
    let bytes: Buffer, intent: Row;
    this.#tx(() => {
      const t = this.#lease(ctx, true); requireThat(t.kind === "AUTHOR", "AUTHOR_ASSIGNMENT_REQUIRED"); bytes = this.#draftBytes(ctx, request.draft_path); const contentHash = sha(bytes); requireThat(!this.memoirAssignment(t.id) || request.validated_hash === contentHash, "FORMAT_VALIDATION_REQUIRED"); requireThat(request.validated_hash === undefined || request.validated_hash === contentHash, "DRAFT_CHANGED_AFTER_VALIDATION"); this.#evidence(ctx, request.evidence_references, contentHash);
      const evidence = json([...request.evidence_references].sort());
      const previous = this.#get("SELECT * FROM publication_intents WHERE ticket_id=? AND attempt_id=?", ctx.ticketId, ctx.attemptId);
      if (previous) { requireThat(previous.content_hash === contentHash && previous.inputs === t.inputs && previous.evidence === evidence, "PUBLICATION_REPLAY_CONFLICT"); intent = previous; }
      else { requireThat(t.status === "WORKING", "TICKET_NOT_WORKING"); intent = { version_id: randomUUID(), content_hash: contentHash, inputs: t.inputs, evidence }; this.#run("INSERT INTO publication_intents VALUES (?,?,?,?,?,?,'INTENT')", ctx.ticketId, ctx.attemptId, intent.version_id, contentHash, t.inputs, evidence); }
    });
    const path = join(this.root, "versions", intent!.content_hash);
    this.#publishBytes(path, bytes!); this.kill("after_publish_before_record");
    const version = this.#tx(() => {
      this.#lease(ctx, true); this.#evidence(ctx, request.evidence_references, intent!.content_hash);
      requireThat(realpathSync(path) === path && sha(readFileSync(path)) === intent!.content_hash, "PUBLISHED_BYTES_CORRUPT");
      const previous = this.#get("SELECT * FROM versions WHERE id=?", intent!.version_id); if (previous) return previous;
      this.#run("INSERT INTO versions(id,ticket_id,attempt_id,content_hash,path,inputs,evidence,published_at,validation_hash) VALUES (?,?,?,?,?,?,?,?,?)", intent!.version_id, ctx.ticketId, ctx.attemptId, intent!.content_hash, path, intent!.inputs, intent!.evidence, this.now(), request.validated_hash ?? null);
      this.#run("UPDATE publication_intents SET state='COMMITTED' WHERE version_id=?", intent!.version_id);
      this.#run("UPDATE tickets SET status='SUBMITTED',candidate_id=?,revision=revision+1 WHERE id=?", intent!.version_id, ctx.ticketId);
      return this.version(intent!.version_id);
    }); this.kill("after_publication_commit"); return version;
  }
  #publishBytes(path: string, bytes: Buffer) {
    const temp = join(this.root, "publication-staging", randomUUID()), fd = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o400);
    try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    try { try { linkSync(temp, path); } catch (error: any) { if (error.code !== "EEXIST") throw error; } requireThat(realpathSync(path) === path && sha(readFileSync(path)) === sha(bytes), "PUBLISHED_BYTES_CORRUPT"); const dir = openSync(dirname(path), constants.O_RDONLY); try { fsyncSync(dir); } finally { closeSync(dir); } } finally { unlinkSync(temp); }
  }
  allowance(projectId: string, ticketId?: string) {
    const scope = ticketId ? "o.ticket_id=?" : "t.project_id=?";
    const value = ticketId ?? projectId;
    const used = this.#get(`SELECT COALESCE(SUM(CASE WHEN o.settled_at IS NULL THEN o.reservation ELSE o.allowance_used END),0) AS used FROM operations o JOIN tickets t ON t.id=o.ticket_id WHERE ${scope}`, value)!.used;
    const limit = ticketId ? this.ticket(ticketId).allowance : this.project(projectId).allowance;
    return { limit, used, remaining: Math.max(0, limit - used), overrunMicros: Math.max(0, used - limit) };
  }
  prepareOperation(ctx: WorkerLease, request: { operationId: string; provider: string; requestHash: string; estimateMicros: number }) {
    id(request.operationId); id(request.provider); requireThat(/^[a-f0-9]{64}$/.test(request.requestHash), "INVALID_REQUEST_HASH"); money(request.estimateMicros);
    const result = this.#tx(() => {
      const t = this.#lease(ctx); const prior = this.#get("SELECT * FROM operations WHERE id=?", request.operationId);
      if (prior) { requireThat(prior.ticket_id === ctx.ticketId && prior.attempt_id === ctx.attemptId && prior.provider === request.provider && prior.request_hash === request.requestHash && prior.estimate === request.estimateMicros, "OPERATION_REPLAY_CONFLICT"); requireThat(prior.state === "INTENT", "RECONCILE_INSTEAD_OF_RESUBMIT"); this.#run("UPDATE operations SET token=? WHERE id=?", ctx.token, request.operationId); return this.operation(request.operationId); }
      requireThat(!this.#get("SELECT id FROM operations WHERE ticket_id=? AND (state IN ('INTENT','SUBMITTING','SUBMITTED','UNKNOWN') OR (settled_at IS NULL AND NOT (state='FAILED' AND EXISTS (SELECT 1 FROM director_commands d WHERE d.project_id=? AND d.action='extend_limits' AND json_extract(d.result,'$.recovered_operation_id')=operations.id))))", ctx.ticketId, t.project_id), "UNRESOLVED_OPERATION");
      for (const cap of [this.allowance(t.project_id), this.allowance(t.project_id, ctx.ticketId)]) requireThat(cap.used + request.estimateMicros <= cap.limit, "ALLOWANCE_EXCEEDED");
      this.#run("INSERT INTO operations(id,ticket_id,attempt_id,token,provider,request_hash,state,estimate,reservation) VALUES (?,?,?,?,?,?,'INTENT',?,?)", request.operationId, ctx.ticketId, ctx.attemptId, ctx.token, request.provider, request.requestHash, request.estimateMicros, request.estimateMicros); return this.operation(request.operationId);
    }); this.kill("after_intent"); return result;
  }
  startOperation(ctx: WorkerLease, operationId: string) {
    this.#tx(() => { this.#lease(ctx); const op = this.operation(operationId); requireThat(op.ticket_id === ctx.ticketId && op.attempt_id === ctx.attemptId && op.token === ctx.token && op.state === "INTENT", "RECONCILE_INSTEAD_OF_RESUBMIT"); const capacity = this.providerCapacity(op.provider); requireThat(capacity.used < capacity.limit && this.now() >= capacity.nextAllowedAt, "PROVIDER_CAPACITY_BUSY");
      this.#run("UPDATE provider_limits SET next_allowed_at=?+min_interval_ms WHERE provider=?", this.now(), op.provider);
      const t = this.ticket(ctx.ticketId); for (const cap of [this.allowance(t.project_id), this.allowance(t.project_id, t.id)]) requireThat(cap.used <= cap.limit, "ALLOWANCE_EXCEEDED");
      this.#run("UPDATE operations SET state='SUBMITTING' WHERE id=?", operationId); }); this.kill("after_dispatch_before_call");
  }
  // Called by trusted provider transport, even if its old worker expired: never lose a paid receipt.
  recordRequestId(operationId: string, requestId: string) {
    requireThat(typeof requestId === "string" && requestId.trim().length > 0 && requestId.length <= 512, "INVALID_PROVIDER_REQUEST_ID");
    this.#tx(() => { const op = this.operation(operationId); requireThat(!op.request_id || op.request_id === requestId, "REQUEST_ID_CONFLICT"); requireThat(["SUBMITTING", "SUBMITTED", "UNKNOWN"].includes(op.state) || (op.state === "FAILED" && op.settled_at === null), "INVALID_OPERATION_STATE"); this.#run("UPDATE operations SET state='SUBMITTED',request_id=? WHERE id=?", requestId, operationId); }); this.kill("after_request_id");
  }
  recoveryAction(operationId: string) {
    return this.#tx(() => {
      const op = this.operation(operationId);
      if (op.state === "INTENT") return { action: "RESUME_INTENT", operation: op };
      if (op.state === "FAILED" && op.settled_at === null) return { action: op.request_id ? "RECONCILE_KNOWN_REQUEST" : "MANUAL_RECONCILIATION", operation: op };
      if (op.state === "SUBMITTING" || op.state === "UNKNOWN") {
        this.#run("UPDATE operations SET state='UNKNOWN' WHERE id=?", operationId);
        return { action: "MANUAL_RECONCILIATION", operation: this.operation(operationId) };
      }
      if (op.state === "SUBMITTED") return { action: "RECONCILE_KNOWN_REQUEST", operation: op };
      return { action: "TERMINAL", operation: op };
    });
  }
  completeOperation(operationId: string, receipt: { result: { artifactReferences: string[]; receiptReference?: string }; actualAllowanceMicros?: number; providerUsage?: unknown; includedCredits?: unknown; verifiedChargeMicros?: number }) {
    requireThat(receipt.result && Object.keys(receipt.result).every(key => ["artifactReferences", "receiptReference"].includes(key)) && Array.isArray(receipt.result.artifactReferences) && receipt.result.artifactReferences.every(ref => typeof ref === "string" && ref.length > 0 && !ref.startsWith("data:")) && (receipt.result.receiptReference === undefined || (typeof receipt.result.receiptReference === "string" && !receipt.result.receiptReference.startsWith("data:"))), "ARTIFACT_REFERENCES_REQUIRED");
    if (receipt.actualAllowanceMicros !== undefined) money(receipt.actualAllowanceMicros); if (receipt.verifiedChargeMicros !== undefined) money(receipt.verifiedChargeMicros);
    return this.#tx(() => {
      const op = this.operation(operationId), used = receipt.actualAllowanceMicros ?? op.estimate, result = json(receipt.result), usage = json(receipt.providerUsage ?? null), credits = json(receipt.includedCredits ?? null), charge = receipt.verifiedChargeMicros ?? null;
      if (op.state === "COMPLETED") { requireThat(op.result === result && op.allowance_used === used && op.provider_usage === usage && op.included_credits === credits && op.verified_charge === charge, "SETTLEMENT_CONFLICT"); return op; }
      requireThat(["SUBMITTING", "SUBMITTED", "UNKNOWN"].includes(op.state) || (op.state === "FAILED" && op.settled_at === null), "INVALID_OPERATION_STATE");
      this.#run("UPDATE operations SET state='COMPLETED',settled_at=?,allowance_used=?,allowance_basis=?,result=?,provider_usage=?,included_credits=?,verified_charge=? WHERE id=?", this.now(), used, receipt.actualAllowanceMicros === undefined ? "ESTIMATE" : "REPORTED_ALLOWANCE", result, usage, credits, charge, operationId); return this.operation(operationId);
    });
  }
  async executeOperation(ctx: WorkerLease, request: Parameters<StudioProduction["prepareOperation"]>[1], submit: (operationId: string) => Promise<{ requestId?: string; completed?: Parameters<StudioProduction["completeOperation"]>[1] }>, diagnostic: (error: unknown) => string, signal?: AbortSignal) {
    this.prepareOperation(ctx, request);
    // Waiting for a local slot is not retrying an external request. Each wake rechecks the lease/pause.
    for (;;) {
      signal?.throwIfAborted();
      try { this.startOperation(ctx, request.operationId); break; }
      catch (error: any) { if (error.message !== "PROVIDER_CAPACITY_BUSY" || !signal) throw error; await delay(20, undefined, { signal }); }
    }
    try {
      const response = await submit(request.operationId); this.kill("after_submit_before_request_id");
      requireThat(response.requestId || response.completed, "PROVIDER_RECEIPT_REQUIRED");
      if (response.requestId) this.recordRequestId(request.operationId, response.requestId);
      if (response.completed) this.completeOperation(request.operationId, response.completed);
      return this.operation(request.operationId);
    } catch (error) {
      const details = diagnostic(error); this.failOperation(request.operationId, details);
      throw new Error(`STOP: ${request.provider}: ${details}\nNo retry or provider substitution. Reservation retained until non-billing or actual usage is confirmed.`);
    }
  }
  settleFailedOperation(operationId: string, actualAllowanceMicros: number, verifiedChargeMicros?: number) {
    money(actualAllowanceMicros); if (verifiedChargeMicros !== undefined) money(verifiedChargeMicros);
    this.#tx(() => { const op = this.operation(operationId); requireThat(op.state === "FAILED", "INVALID_OPERATION_STATE");
      if (op.settled_at !== null) { requireThat(op.allowance_used === actualAllowanceMicros && op.verified_charge === (verifiedChargeMicros ?? null), "SETTLEMENT_CONFLICT"); return; }
      this.#run("UPDATE operations SET settled_at=?,allowance_used=?,allowance_basis='RECONCILED_FAILURE',verified_charge=? WHERE id=?", this.now(), actualAllowanceMicros, verifiedChargeMicros ?? null, operationId);
    });
  }
  failOperation(operationId: string, diagnostic: string, confirmedNonBilling = false) {
    requireThat(typeof diagnostic === "string" && diagnostic.trim().length > 0, "PROVIDER_DIAGNOSTIC_REQUIRED");
    this.#tx(() => { const op = this.operation(operationId); requireThat(!["COMPLETED", "FAILED"].includes(op.state), "INVALID_OPERATION_STATE"); this.#run("UPDATE operations SET state='FAILED',diagnostic=?,settled_at=?,allowance_used=?,allowance_basis=? WHERE id=?", diagnostic, confirmedNonBilling ? this.now() : null, confirmedNonBilling ? 0 : null, confirmedNonBilling ? "CONFIRMED_NON_BILLING" : null, operationId); this.#run("UPDATE tickets SET status='BLOCKED',revision=revision+1 WHERE id=?", op.ticket_id); });
  }
}
