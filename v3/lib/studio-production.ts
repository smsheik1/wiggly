import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { constants, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, fsyncSync, linkSync, unlinkSync, realpathSync, fstatSync } from "node:fs";
import { join, resolve, dirname, relative, isAbsolute } from "node:path";

export type WorkerLease = { ticketId: string; workerId: string; token: number; attemptId: string };
export type OperatorDecision = { id: string; actor: string; reason: string };
export type InputVersions = Record<string, string>;
export type KillPoint = "after_intent" | "after_dispatch_before_call" | "after_submit_before_request_id" | "after_request_id" | "after_publish_before_record" | "after_publication_commit";
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
    requireThat([0, 1].includes(this.#get("PRAGMA user_version")!.user_version), "UNSUPPORTED_STUDIO_SCHEMA");
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
      CREATE INDEX IF NOT EXISTS tickets_project ON tickets(project_id,status); PRAGMA user_version=1;`);
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
  setInput(projectId: string, name: string, version: string) { inputsJSON({ [name]: version }); this.#run("INSERT INTO input_heads VALUES (?,?,?) ON CONFLICT(project_id,name) DO UPDATE SET version=excluded.version", projectId, name, version); }
  createTicket(ticketId: string, projectId: string, role: string, inputs: InputVersions, allowanceMicros: number, kind: "AUTHOR" | "REVIEWER" = "AUTHOR") { id(ticketId); id(role); money(allowanceMicros); this.#run("INSERT INTO tickets(id,project_id,role,kind,status,inputs,allowance) VALUES (?,?,?,?,'READY',?,?)", ticketId, projectId, role, kind, inputsJSON(inputs), allowanceMicros); }
  #currentInputs(ticket: Row) { for (const [name, version] of Object.entries(JSON.parse(ticket.inputs))) requireThat(this.#get("SELECT version FROM input_heads WHERE project_id=? AND name=?", ticket.project_id, name)?.version === version, "STALE_INPUTS"); }
  #lease(ctx: WorkerLease, submittedReplay = false) {
    const t = this.ticket(ctx.ticketId);
    requireThat(t.worker_id === ctx.workerId && t.token === ctx.token && t.attempt_id === ctx.attemptId && t.lease_until > this.now(), "STALE_WORKER");
    requireThat(t.status === "WORKING" || (submittedReplay && t.status === "SUBMITTED"), "TICKET_NOT_WORKING");
    requireThat(!this.project(t.project_id).paused, "PROJECT_PAUSED"); this.#currentInputs(t); return t;
  }
  claim(ticketId: string, workerId: string, leaseMs: number): WorkerLease {
    id(workerId); requireThat(Number.isSafeInteger(leaseMs) && leaseMs > 0, "INVALID_LEASE_DURATION");
    return this.#tx(() => {
      const t = this.ticket(ticketId); requireThat(!this.project(t.project_id).paused, "PROJECT_PAUSED"); this.#currentInputs(t);
      requireThat(t.status === "READY" || (t.status === "WORKING" && t.lease_until <= this.now()), "TICKET_ALREADY_CLAIMED");
      requireThat(!this.#get("SELECT id FROM operations WHERE ticket_id=? AND state IN ('SUBMITTING','UNKNOWN')", ticketId), "UNCERTAIN_OPERATION");
      const attemptId = t.status === "WORKING" ? t.attempt_id : randomUUID();
      this.#run("UPDATE tickets SET status='WORKING',worker_id=?,attempt_id=?,token=token+1,lease_until=?,revision=revision+1 WHERE id=?", workerId, attemptId, this.now() + leaseMs, ticketId);
      mkdirSync(join(this.root, "assignments", ticketId, attemptId, "drafts"), { recursive: true });
      return { ticketId, workerId, token: t.token + 1, attemptId };
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
  publish(ctx: WorkerLease, request: { draft_path: string; evidence_references: string[] }) {
    let bytes: Buffer, intent: Row;
    this.#tx(() => {
      const t = this.#lease(ctx, true); requireThat(t.kind === "AUTHOR", "AUTHOR_ASSIGNMENT_REQUIRED"); bytes = this.#draftBytes(ctx, request.draft_path); const contentHash = sha(bytes); this.#evidence(ctx, request.evidence_references, contentHash);
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
      this.#run("INSERT INTO versions VALUES (?,?,?,?,?,?,?,?)", intent!.version_id, ctx.ticketId, ctx.attemptId, intent!.content_hash, path, intent!.inputs, intent!.evidence, this.now());
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
      requireThat(!this.#get("SELECT id FROM operations WHERE ticket_id=? AND (state IN ('INTENT','SUBMITTING','SUBMITTED','UNKNOWN') OR settled_at IS NULL)", ctx.ticketId), "UNRESOLVED_OPERATION");
      for (const cap of [this.allowance(t.project_id), this.allowance(t.project_id, ctx.ticketId)]) requireThat(cap.used + request.estimateMicros <= cap.limit, "ALLOWANCE_EXCEEDED");
      this.#run("INSERT INTO operations(id,ticket_id,attempt_id,token,provider,request_hash,state,estimate,reservation) VALUES (?,?,?,?,?,?,'INTENT',?,?)", request.operationId, ctx.ticketId, ctx.attemptId, ctx.token, request.provider, request.requestHash, request.estimateMicros, request.estimateMicros); return this.operation(request.operationId);
    }); this.kill("after_intent"); return result;
  }
  startOperation(ctx: WorkerLease, operationId: string) {
    this.#tx(() => { this.#lease(ctx); const op = this.operation(operationId); requireThat(op.ticket_id === ctx.ticketId && op.attempt_id === ctx.attemptId && op.token === ctx.token && op.state === "INTENT", "RECONCILE_INSTEAD_OF_RESUBMIT"); this.#run("UPDATE operations SET state='SUBMITTING' WHERE id=?", operationId); }); this.kill("after_dispatch_before_call");
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
  async executeOperation(ctx: WorkerLease, request: Parameters<StudioProduction["prepareOperation"]>[1], submit: (operationId: string) => Promise<{ requestId?: string; completed?: Parameters<StudioProduction["completeOperation"]>[1] }>, diagnostic: (error: unknown) => string) {
    this.prepareOperation(ctx, request); this.startOperation(ctx, request.operationId);
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
