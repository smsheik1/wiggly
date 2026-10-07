# Studio M0 harness spike

Isolated TypeScript Deep Agents capability tests. This is not a new Format,
production scheduler, renderer, or migration. The saved Memoir production stays paused.

## Local checks

From this directory, run `npm ci --ignore-scripts`, `npm run check`, and `npm test`.
The tests use the installed Deep Agents implementation and an explicitly scripted
model. They prove skills, image tool-result transport, protected-path permissions,
symlink/traversal rejection, trace sanitization, and `returnDirect` termination.
They do not prove model perception or creative quality.

`npm run trace` uploads an explicitly marked mock trace to the
`wiggly-studio-phase1` LangSmith project and reads it back. It verifies linked
model/tool nodes and removal of image payloads. It calls no inference provider.

## Live perception check

The director selected TypeScript Deep Agents with `moonshotai/kimi-k3` through
NVIDIA NIM on October 7, 2026. Production configuration remains unchanged.

`npm run live`

It inspects the included four-color PNG, writes observed colors in its draft
workspace, and calls `submit_probe`. The skill contains a marker not provided
in the user assignment. The expected colors are checked locally after the run,
not placed in the model's instructions. This is a test fixture, not generated
production media; no Muse image generation occurs in Phase 1.

The runner loads only named keys from `/Users/shaz/Projects/wiggly/secrets.env`
in memory. It never copies credentials to this directory. LangSmith requires
`LANGSMITH_API_KEY`; the NIM trial additionally requires `NVIDIA_API_KEY`.

Each live trial conservatively holds $1 of the existing $5 M0 allowance before model
execution, with eight model calls maximum, bounded input/output, no provider
retries, and a three-minute invocation limit. Unknown outcomes retain the
reservation; another trial is intentional and never automatic. The hold is an allowance control, not a claimed charge. The NVIDIA prototype endpoint
is advertised as free; report tokens and leave unverified charges/tariffs unknown. This sequential trial bookkeeping is not the
M1 transactional allowance implementation.

Outputs and detailed receipts live in the ignored `output/` directory. Formal
publication, lease recovery, independent creative review, and approval gates
belong to later phases. `submit_probe` demonstrates termination only; it does
not publish or approve a production artifact. This inspection-only command
authors no screenplay, staging, or generation prompt and does not bypass the
required host-agent bridge for creative work.

## Remaining limits

- Native filesystem mounts and permission rules cover all exposed file tools;
  workers receive no shell or delegation tools.
- No checkpointer is attached in this Phase 1 transport test. Later recovery
  must keep large media bytes outside persisted worker state.
- The pinned package currently has a transitive `braces` nesting-denial-of-service
  advisory. Do not deploy this spike as an untrusted-input service. Reassess
  the upstream fix before production adoption; do not downgrade the harness
  automatically to satisfy an audit recommendation.

## NIM compatibility and current result

The pinned ChatOpenAI adapter drops reasoning history on outbound requests and
cannot send vision inside Chat Completions tool messages. The isolated NIM adapter
preserves reasoning and transports actual tool images as user media without changing
persisted graph messages. A local mock endpoint tests the real serializer and complete
skill/read-image/write/submit sequence. It is non-streaming and sequential; its
reasoning cache is not a durable recovery solution for M1.

Six local tests and typecheck pass. The verified live configuration uses high
reasoning and required tool calling, with temperature 1, at most 4,096 output tokens
per call and eight model turns. Kimi completed the full native Deep Agents probe in
four turns / 19.595 seconds: skill load, actual image read, draft observations, submit.
It correctly identified red/blue/green/yellow and the skill-only marker. Receipts bind
the actual provider image bytes and successful findings to the fixture hash. LangSmith
readback shows four model nodes and the four tool calls without image bytes.

The investigation used five deliberately recorded trials. Earlier trials found empty
or garbled low-reasoning continuations and an adapter bug: Kimi sometimes omits
`reasoning_content` on a tool-call response with explicitly zero reasoning tokens.
Preserve that complete response; require reasoning when usage is nonzero or unknown.
Tool results must be strings and repeated tool IDs must not overwrite earlier history.
The fifth trial passed; no further live trials are authorized by the current local cap.
The five $1 holds are conservative internal allowance controls, not $5 of NVIDIA spend.
Tokens are reported; provider charges and a per-token tariff remain unverified.

See `docs/proofs/studio-phase1-harness.json` in the repository for the committed
Phase 1 evidence, live trace URL, trial summaries, usage, and remaining limits.
Phase 1 establishes fixture capabilities. Phase 2 results follow; full production stays paused.


## Phase 2: author and independent review

`npm run phase2` creates a separate test workspace. A Deep Agents author loads
the existing background recipe, authors a complete prompt through an explicitly
bound operating worker in `v3/lib/agent-bridge.ts`, uses the existing Muse request
builder, inspects actual images, and submits an exact-byte candidate. A fresh
reviewer receives only the producer packet and candidate bytes. A generated
figure-containing edit is reviewed under the same criteria as a negative test.
No production approvals, checkpoints, scheduler, or renderer are invoked.

The runner depends on the canonical working kit at
`/Users/shaz/Projects/wiggly/v3/public/format-repositories/my-pixar-story-v1`
and loads only `META_API_KEY`, `NVIDIA_API_KEY`, and `LANGSMITH_API_KEY` from the
canonical secrets file. It requests three author images ($0.03 estimated) and
one deliberate negative edit ($0.01 estimated). NVIDIA prototype inference is
advertised as free. Neither estimated consumption nor internal holds are verified
invoice charges. This is sequential spike bookkeeping, not transactional M1 safety.

Phase 2 passed with diagnosed limitations: the empty kitchen received PASS and
the figure-containing fixture received CHANGES_REQUESTED with specific visual
evidence. Successful author recovery took four turns / 52.176 seconds; both
reviewers took three turns / 34.427 and 23.894 seconds. The interrupted author's
three earlier turns bring total author turns to seven.

The initial Muse response returned a usable 2048x1152 image rather than the exact
requested width. A too-strict local assertion stopped persistence after one of
three returned images. The dimension guardrail was fixed and tested; the existing
draft was recovered without regeneration. Two returned images were lost, and
this is not evidence of uninterrupted three-candidate selection. Future calls
persist the raw response before decoding or validating individual images.

The initial reviewer received garbled NVIDIA output and made no tool call. That
attempt was preserved and rejected as incomplete. One explicitly announced
diagnostic review passed. There is no automatic retry or provider substitution.
An intentional continuation can use `--recover-root=<isolated-run-root>`; adding
`--review-existing` skips author execution and verifies the saved candidate hash.
These are operator recovery aids for this spike, not replay-safe M1 workflows.
Never rerun a partially completed trial blindly. Existing operation intents refuse
a second image submission rather than risk duplicate provider work.

Eight local tests and typecheck pass. Actual LangSmith readbacks of the three
successful worker traces contain linked model/tool nodes and no raw media bytes.
All 313 paused production files match the baseline. See
`docs/proofs/studio-phase2-suitability.json` for verdicts, hashes, traces, usage,
failed attempts, and limitations. Retain TypeScript; Python would not resolve
a corrupt inference-provider response. M1 and production adoption require their
own gates, including durable recovery and a reliable inference path.

## Phase 3: isolated production safety core

The director authorized Phase 3 after the successful Phase 2 goal. No production
cutover is authorized. The implementation is `v3/lib/studio-production.ts`; the
Deep Agents publication binding is `production-tools.ts`.

Run `npm run check` and `npm run test:phase3` (or `npm test` for all 27 checks).
This uses Node's built-in SQLite and requires Node 22.13+; the verified environment
is Node 26.8.1 / SQLite 3.53.4. No dependencies, providers, credentials, dashboard,
renderer, or external queue were added. Official references: [Node SQLite](https://nodejs.org/api/sqlite.html)
and [SQLite transactions](https://www.sqlite.org/lang_transaction.html).

Each explicitly provisioned workspace owns `studio.sqlite`, `assignments/`, and
`versions/`. A new project starts paused. SQLite is the sole ticket authority;
LangGraph still owns only worker execution. `BEGIN IMMEDIATE`, foreign keys,
WAL, and FULL synchronization protect mutations. No run opens saved production.

Producer/control-plane methods are trusted APIs, not worker tools. Operator
pause/resume and project allowance increases require an explicit decision record
and reject conflicting replays. Authentication through the existing operator
interface belongs to Phase 4; an actor string by itself is not authentication.
Input heads come from the trusted producer. Ticket input snapshots and immutable
version dependencies preserve exact consumed references.

Claims fence expired workers with an increasing token. A lease reclaim preserves
the attempt and draft workspace; a new creative attempt is a later repair action.
Paused projects block claims, heartbeats, operation starts, and publication. A
provider dispatch already committed before pause is in flight; its receipt and
settlement can still be recorded. This is the safe-boundary meaning of pause.

The publication tool accepts only `draft_path` and `evidence_references`; the
producer binds the ticket/worker/token/attempt. It denies traversal and symlinks,
requires completed inspection of exact transmitted bytes, and rejects reviewer
assignments. Publication snapshots the inspected bytes, persists its intent,
fsyncs a staged file, links it into content-addressed storage without overwrite,
fsyncs the directory, then rechecks lease, pause, inputs, evidence, and published
hash before committing the version and SUBMITTED ticket. Replay verifies the same
intent and bytes. Filesystem permissions at mode 0400 are extra protection;
worker backend restrictions enforce the write boundary.

Only trusted transport callbacks call `mediaSupplied` with the bytes actually
included in the model request and `inspectionCompleted` after a successful response
with findings. The model cannot manufacture these records through a tool. The
Phase 3 tests use explicitly marked mock findings; Phase 2 remains the real visual
perception evidence. SQL stores hashes and references, not media payloads.

Provider execution commits intent plus reservation before dispatch. Requests have
an operation ID and a separately computed request hash; the adapter must hash its
exact serialized request and use that ID for provider idempotency only where
supported. INTENT can resume without another reservation. SUBMITTING/UNKNOWN
requires reconciliation and blocks duplicate calls. A known request ID is recorded
immediately and returned for reconciliation; no queue or polling API is assumed.
Muse remains the verified synchronous integration from Phase 2. The normalized
completion receipt contains artifact/receipt references rather than API media bytes.

Amounts are integer micro-USD allowance consumption, separate from provider usage,
included subscription credits, and verified charges. Unknown outcomes retain their
reservation. Completion settles once, using reported allowance consumption when
available or the explicitly labeled estimate; invoice charges stay unknown unless
verified. Overruns are recorded and block further spend. Failure blocks the ticket;
release requires confirmed non-billing or explicit billing reconciliation. No
provider error triggers retry, fallback, or automatic redispatch. Adapters supply
the existing provider-specific remediation and redact secrets before persistence.

Six child-process SIGKILL tests use named points: `after_intent`,
`after_dispatch_before_call`, `after_submit_before_request_id`, `after_request_id`,
`after_publish_before_record`, and `after_publication_commit`. The mock provider
writes an isolated receipt so tests can prove zero or one submission after restart.
These are process-crash tests, not live billable failures or power-loss tests.

Phase 3 passes 19 safety checks plus the existing eight checks. All 313 saved
production files remain unchanged. See `docs/proofs/studio-phase3-safety.json`.
Full repair/review/director approval, authorization endpoints, attempt escalation,
LangGraph checkpoint recovery, concurrent production, and migration remain later
gates. The Phase 2 NVIDIA response reliability issue is still unresolved. Stop at
Phase 3; do not automatically begin Phase 4 or resume production.
