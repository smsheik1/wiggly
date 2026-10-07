# Wiggly Agent Studio — Architecture Specification v5

**Status:** Phases 1–4 completed in isolation. Phase 5 local concurrency checks pass, but the live acceptance gate stopped after three distinct NVIDIA/Kimi diagnostic configurations failed. Phase 5 is incomplete and awaits the director’s provider decision. Fresh paid-test allowance: $5; estimated Muse consumption: $0.02, verified charges unknown. Full studio production remains paused.
**Objective:** Build an agent-operated animation studio with shared materials, autonomous specialists, independent review, and clear director control.

---

## 1. Foundation and ownership

**Core rule:** Reuse mature infrastructure. Build only studio-specific assignments, asset contracts, dependencies, and production policies.

| Component | Responsibility |
|---|---|
| **Deep Agents + LangGraph, TypeScript first** | Worker tool use, context management, skills, checkpoints, and execution recovery |
| **SQLite production records** | Authoritative assignments, scheduling eligibility, leases, versions, approvals, provider operations, and budget allowances |
| **Filesystem artifact storage** | Drafts, references, and immutable published media |
| **LangSmith** | Tracing, evaluations, debugging, and reported usage analysis |
| **Existing Wiggly validators and renderer** | Deterministic checks and complete `AdScene` rendering through `AdRenderSurface` |

TypeScript is the first harness candidate. Evaluate Python only if the spike demonstrates a required capability or reliability gap that warrants another runtime.

Preserve existing validators, provider integrations, approved artifacts, and production checkpoints. Do not rewrite working infrastructure merely to accommodate a new framework.

Creative work remains authored by an active operating agent (`AGENTS.md` Rule 13). In this studio, the autonomous Deep Agents specialists act as operating creative agents authoring scripts, staging, and prompts; the renderer (`AdRenderSurface`) remains strictly passive. Headless integration outside autonomous runs must use Wiggly’s host agent bridge.

### One authority for production state

Production records own the assignment lifecycle:

$$\text{Ready} \longrightarrow \text{Working} \longrightarrow \text{Submitted} \longrightarrow \text{Reviewing} \longrightarrow \text{Awaiting Approval} \longrightarrow \text{Approved}$$

Exceptional states are `Changes Requested`, `Blocked`, and `Cancelled`.

LangGraph checkpoints describe **worker execution**, not a second authoritative assignment lifecycle.

- An author run ends after successful candidate submission.
- Independent review runs separately.
- Director approval updates production records atomically.
- The scheduler dispatches subsequent eligible work from those records.
- Production approval does not require resuming a suspended author graph.

Worker checkpoints remain useful for recovering interrupted investigation and tool execution.

**Operator pause is durable:** paused projects dispatch no new work after restart. Running workers stop at safe boundaries; uncertain external operations remain recorded for reconciliation. Only explicit operator resume releases the pause.

---

## 2. Assignments, workspace, and review

### Outcome-based assignments

Each assignment contains:

- Project, ticket, role profile, and current attempt identifiers.
- Desired outcome and creative direction.
- Exact input versions and relevant references.
- Permitted tools and writable workspace.
- Deliverable and verification criteria.
- Authorized allowance and configurable attempt/turn limits.
- Applicable review and approval policy.

Workers own investigation, planning, drafting, inspection, and repair within that authority. They submit a complete candidate or an evidenced blocker.

Specialist profiles and skills are configurable. Writer, visual artist, audio engineer, and reviewer are starting profiles, not mandatory daemon processes.

The producer uses deterministic code for readiness, claiming, and dispatch. An LLM assists with creative planning, consequential summaries, and repair options.

### Workspace and publication

Materials are organized by production purpose: scripts, storyboards, cast, props, backgrounds, audio, shots, compositions, and working notes.

- Each assignment has a separate writable draft area.
- Relevant references and published versions are readable.
- Workers cannot mutate production records, credentials, or published versions directly.
- Existing Deep Agents filesystem permissions are used before adding custom enforcement.
- M0 exposes no unrestricted shell tool. Later shell access requires demonstrated need and isolation; constrained media tools remain available.

Only the trusted publication tool writes immutable versions.

The runtime injects the assignment identity and active lease token into the tool execution context. The worker supplies only the `draft_path` and its `evidence_references`. The publication tool computes `sha256(draft_path)` directly on disk, verifies the draft bytes and current inputs, publishes the immutable artifact to `/versions/`, records the candidate, and terminates the author run.

Publication must recover safely if filesystem publication succeeds before its database record commits. Replays reuse or verify the published artifact rather than overwrite it.

### Perception evidence

A file path or successful generation receipt does not prove inspection.

Record two distinct facts:

1. **Media supplied:** exact artifact bytes were included in a model request.
2. **Inspection completed:** a successful model response produced findings about that artifact.

Evidence identifies the artifact hash, inspecting role/run, modality, model/tool, inspected coverage, and findings. A dedicated perception call or the worker’s own multimodal turn may produce completed inspection evidence.

Draft evidence is bound to the content hash before publication. Changing the draft invalidates that evidence. Publication links matching evidence to the resulting version.

M0 must verify the exact model, SDK, and adapter combination supports the required media workflow.

### Independent review

Authors inspect and improve their own drafts. They cannot issue their own independent acceptance verdict.

The producer assembles a review packet containing:

- Exact candidate version.
- Relevant approved references.
- Script, storyboard, staging, and director decisions.
- Completion criteria and required inspection coverage.

The independent reviewer inspects that packet and submits a verdict with findings. Defects may use timestamps, coarse spatial regions, or bounding boxes when useful; exact pixel coordinates are not mandatory.

Reviewer findings and deterministic validation do not confer director approval authority.

### Director decisions

Approval is an authenticated, atomic production-record transition bound to:

`project_id`, `ticket_id`, `candidate_version_id`, `content_hash`, `expected_revision`, `decision`, and optional feedback.

Reject stale candidates, outdated inputs, unauthorized callers, and conflicting decisions. Repeated delivery of the same decision is idempotent.

For the prototype, approval may use the existing operator interface. A new dashboard or budget button is not a prerequisite.

**Director-authorized policy (October 7, 2026):** the director approves character/style direction, storyboard/animatic, narration performance, and the final film. Intermediate backgrounds, props, individual shots, and technical audio preparation may proceed after deterministic validation and independent review pass. Changes contradicting approved direction return to the director. Activate this policy through explicit format criteria during Phase 6 integration; Phase 5 fixtures confer no production approvals or cutover authority.

---

## 3. Dependencies, execution safety, and usage

### Precise dependencies

Published assets record the exact versioned inputs they consume.

Separate:

- Requested timing and cadence constraints.
- Generated audio.
- Measured duration and any required word/phoneme alignment.
- Generated footage.
- Timeline placement, captions, and final composition.

The screenplay author maintains explicit narration and visual direction fields. Hash comparisons detect field changes; they do not determine semantic compatibility.

Memoir Film v1 initially excludes phoneme lip-sync. Word timings are required only where captions or synchronized actions consume them.

Timing tolerance is recipe configuration, with **200 ms as a provisional test value**. A timing change may invalidate the edit/composition while preserving generated footage.

Before revisions, show definitely affected assets and those awaiting measured compatibility checks. Preserve unaffected versions; record compatibility decisions rather than rewriting historical dependencies.

### Claims and operation recovery

Assignments are claimed atomically with expiring leases and monotonically increasing lease tokens. Stale workers cannot submit artifacts or initiate new provider operations.

Each logical operation receives a persisted unique `operation_id`; its request hash is stored separately.

- Replay reuses the same operation ID.
- An intentional additional generation gets a new operation ID.
- Provider-supported idempotency is used where available.
- Provider request IDs are recorded as soon as received.
- Known requests are reconciled or polled instead of resubmitted.
- Unknown submission outcomes block further potentially duplicate calls.

Verify each provider’s actual synchronous, queue, and reconciliation capabilities. Do not assume Muse or another provider exposes a queue API.

### Allowances and reservations

Before external execution, atomically create the operation intent and reserve its allowance. Enforce both ticket and project caps.

Keep separate:

- Estimated allowance consumption.
- Provider-reported usage.
- Included subscription credits, when known.
- Verified charges, when available.

Reservations settle exactly once. Release them only when non-billing is confirmed. Unknown outcomes retain their reservation. Record overruns and block additional spend when the applicable cap is exhausted.

Only explicit director authorization extends allowance or attempt limits; authorization may arrive through the existing interface.

Provider errors immediately stop affected execution and produce actionable diagnostics under `AGENTS.md` Rule 12. No silent retries, substitute providers, or synthetic media.

Attempt, strike, and turn limits are configurable. Limits stop automatic redispatch and surface evidence with repair options.

### Observability and rendering

Use LangSmith for linked worker/tool/reviewer traces and evaluation history. Production records retain the decisions necessary to operate the studio.

Exclude large media payloads and secrets from trace uploads while preserving useful instructions, findings, artifact references, and usage metadata.

Final output is a complete `AdScene`. Preview, export, and share use the existing `AdRenderSurface` path (`AGENTS.md` Rule 1 & Rule 9).

---

## 4. Milestones and acceptance

### M0 — Harness capability spike

Run separately from saved production using one visual assignment: produce an empty kitchen background candidate, then independently review it.

Use the existing configured model and image-provider integration. Verify their required capabilities before paid execution. Any paid trial requires an explicit test allowance.

Prove:

- TypeScript skills load and influence the assignment.
- Workers discover references and inspect actual images.
- Multimodal inspection produces correctly bound evidence.
- Draft-only filesystem permissions hold across exposed tools.
- Successful submission reliably ends the author run.
- Independent review receives the authoritative packet.
- LangSmith shows useful linked execution and usage.
- Existing creative authoring/host-bridge boundaries remain intact.

**Fail Condition for TypeScript Harness:** Switch to Python if the spike demonstrates that TypeScript Deep Agents cannot reliably support:
1. Multimodal media in tool inspection results,
2. Scoped draft-only filesystem permissions across exposed tools, or
3. Bounded termination of the author run upon submission.

Use a figure-containing fixture to test rejection. Measure turns, latency, cost estimates, and checkpoint growth. Initial targets are eight author turns, four reviewer turns, three minutes, and a $1 estimated allowance per complete trial. These are empirical targets, not correctness invariants.

Do not embed media bytes in checkpoint state. Checkpoint size is a measurement, not a fixed 500 KB correctness requirement.

### M1 — Production safety and complete assignment lifecycle

Prove with deterministic tests and named failure-injection points:

- Exclusive claiming and rejection of expired-worker actions.
- Replay-safe operations and publication.
- Recovery before and after provider request-ID recording.
- Atomic reservations, settlement, unknown outcomes, and overruns.
- Changed draft bytes invalidate inspection evidence.
- Stale inputs and stale approval cards cannot approve current work.
- Successful rejection $\to$ repair $\to$ review $\to$ exact-version director approval.
- Separate repeated-failure escalation and authorized-extension tests.
- Restart while working, awaiting approval, and operator-paused.
- Duplicate approval requests have no duplicate effects.

Mandatory safety tests must all pass. Use isolated mocks for reproducible failure windows; bounded live trials verify provider integration without manufacturing billable crashes.

### M2 — Bounded concurrent production

Start with two independent assignments.

Verify claim ownership, shared budget reservations, provider concurrency limits, and SQLite contention. Add external queues or additional services only after demonstrated operational need.

### Rollout

Keep the existing runtime operational throughout M0 and M1. Commit and push clean implementation phases after checks pass. No automatic migration or production resume.

Expand to composition and director UI only after the assignment lifecycle works reliably. Any later migration must preserve approved versions, decisions, provider receipts, and saved progress.

---

## 5. Migration and replacement plan

This is a substantial orchestration replacement, not a rewrite of Wiggly's media engine. M0 adds an isolated harness spike; it does not tear out the current runtime. The director subsequently authorized Phase 3 after M0 passed and Phase 4 after the successful Phase 3 goal. Phases 3–4 build and test the SQL safety and assignment lifecycle in isolation. Full worker checkpoint recovery, M2, production cutover, and retirement remain later gates.

### Replacement map

The paths below refer to the existing `v3/public/format-repositories/my-pixar-story-v1/` kit. They identify responsibilities to migrate, not files to delete wholesale.

| Existing responsibility | Planned treatment | Replacement gate |
|---|---|---|
| Central project `step`/`gate` progression and approval interrupts in `runtime/workflow.mjs` | Replace production coordination with authoritative assignment records, deterministic readiness/dispatch, and atomic director decisions. Keep LangGraph for recoverable worker execution. | M1 lifecycle, pause/restart, stale approval, and replay tests pass before cutover. |
| Restricted host dispatch in `runtime/codex-host.mjs`, `runtime/crew.mjs`, and related `runner.mjs` commands | If M0 passes, replace the tightly scoped task/event wrapper with the selected outcome-based worker harness. Preserve role instructions, useful skills, authority boundaries, and independent review requirements. | M0 proves capabilities; M1 proves safe submission, recovery, and repair before production replacement. |
| Broad dependency bindings and revision handling in `runtime/workflow.mjs` and `runtime/studio.mjs` | Restructure around exact consumed inputs and recipe-specific compatibility checks. Separate generated footage from timing, captions, and composition. | Regression checks show unaffected assets are preserved and affected downstream work is reopened correctly. |
| Candidate submission, review gates, approvals, and repair handoffs | Restructure into exact-byte publication, producer-assembled review packets, independent findings, and explicit assignment transitions. | Successful rejection-to-repair-to-approval, changed-byte rejection, stale decision, and bounded escalation tests pass. |
| Budget reservations, provider jobs, and dispatch receipts | Move coordination records into transactional production storage with operation identities, lease checks, atomic reservations, settlement, and reconciliation. Retain working provider request implementations. | M1 recovery and settlement tests pass; M2 verifies concurrent reservations and claims. |
| Perception evidence and evaluation wiring | Retain working image/audio/video inspection adapters and useful evaluation criteria; correct evidence timing and artifact binding, and connect worker/tool/reviewer traces to LangSmith. | M0 demonstrates actual inspection and useful traces; M1 verifies evidence cannot authorize changed bytes or the wrong role's verdict. |

### Retain and adapt

- Retain working provider integrations, canonical credential loading, actionable provider diagnostics, media probing/verification, local audio editing/mixing, and creative recipes.
- Retain deterministic validation rules and behavior-protecting tests. Extract or adapt reusable checks when their current functions also enforce old workflow routing; replace tests tied only to superseded orchestration.
- Retain complete `AdScene` contracts, the passive `AdRenderSurface`, and preview/export/share parity. Integration changes must not introduce a second renderer.
- Keep the existing host-agent authoring boundary. A harness change must integrate with that boundary rather than move creative generation into passive scripts or rendering code.

### Phase checkpoints

| Phase | Deliverable | Acceptance gate |
|---|---|---|
| 0 — Preserve and prepare | Record the saved production baseline and isolate the spike configuration, workspace, and test allowance. | Existing production is intact and paused; the spike cannot write its checkpoints or approvals. |
| 1 — Harness capabilities | Verify skills, media inspection, restricted writes, submission termination, and LangSmith tracing. | Each required capability has evidence or a diagnosed blocker. |
| 2 — M0 assignment | Complete the background author/reviewer trial and figure-containing negative fixture. | Publish the M0 suitability report with usage, latency, autonomy, and review findings. Stop at this gate; do not automatically start M1. |
| 3 — Production safety | Implement assignment records, claims, publication, provider-operation recovery, reservations, and durable pause. | Relevant M1 safety tests pass. |
| 4 — Repair and approval | Complete successful repair and director approval, including restart and stale-action checks. | One complete assignment passes the remaining M1 lifecycle criteria. |
| 5 — Concurrent dispatch | Run two independent assignments under shared allowance and provider limits. | M2 concurrency tests pass. |
| 6 — Film integration | Connect proven assignments to format recipes, composition, and director review. | Preview/export/share parity and the affected film flow pass their checks. |

Current checkpoint (October 7, 2026): Phases 1–4 are complete. M0 proved TypeScript Deep Agents authorship, actual image inspection, and independent positive/negative review. Phase 3 adds isolated SQLite safety and six named child-process SIGKILL checks. Phase 4 adds rejection→repair→independent review→exact-version director approval, authenticated local operator commands, stale/conflicting decision rejection, idempotent delivery, restart while awaiting approval, and separate attempt/strike/turn limits with authorized extensions. All 41 checks pass (14 new Phase 4 checks). Native middleware enforces turn limits before model invocation; telemetry callbacks are not safety gates. Evidence is in `docs/proofs/studio-phase1-harness.json`, `docs/proofs/studio-phase2-suitability.json`, `docs/proofs/studio-phase3-safety.json`, and `docs/proofs/studio-phase4-lifecycle.json`. All 313 saved production files remain unchanged and paused. The new core is not routed to production. Phase 4 uses explicit mock artifacts and test operator decisions, not creative acceptance of a real film. NVIDIA response reliability and full LangGraph checkpoint recovery remain unresolved. Phase 5 was subsequently authorized with a fresh $5 paid-test allowance and a three-distinct-repair-attempt escalation rule for inference reliability. Phase 5 passes 13 local concurrency checks (54 total). Its live gate stopped after NVIDIA HTTP 429, a garbled response, and an empty required-tool response across three distinct configurations. The malformed-response guard worked, but inference reliability is not fixed. Two generated images are retained without regeneration. Evidence: `docs/proofs/studio-phase5-concurrency.json`. Phase 5 is incomplete; Phase 6 and production cutover are not authorized.

Commit and push each clean completed phase after its checks pass. Track the current phase, deliverable, evidence, blockers, and next gate. Phase checkpoints do not expand authorization or resume production.

### Cutover and retirement gates

1. Prove the replacement behavior before routing production to it. M0 success alone does not authorize teardown or migration.
2. Demonstrate migration on a separate copy of saved production. Verify exact approved artifact hashes, director decisions, dependencies, source facts, provider request IDs, uncertain outcomes, allowance history, and durable pause. Unsupported historical state blocks migration rather than being reset or guessed.
3. Provide a verified rollback path to the original runtime and saved state. Cutover requires explicit director authorization and reconciliation of in-flight provider work; never allow both runtimes to mutate the same project.
4. After replacement acceptance and verified migration, retire superseded orchestration in a focused, reversible phase. Do not retain two permanent production coordinators. Preserve historical records and rollback material; deletion of legacy/reference code requires explicit authorization under the repo guardrails.

---

## 6. Explicit defaults

- M0 was authorized with a $5 test allowance and 2-day timebox. The director subsequently authorized Phase 3 after the successful Phase 2 goal and Phase 4 after the successful Phase 3 goal; Phases 3–4 use free isolated mock tests. Phase 5 was subsequently authorized with a fresh $5 paid-test allowance. Phase 6, migration, and production resume require later authorization. Implementation is delegated to OpenAI Codex. Full studio production remains paused.
- Director decision, October 7, 2026: use TypeScript Deep Agents with `moonshotai/kimi-k3` through NVIDIA NIM for the isolated M0 spike. Saved production remains unchanged.
- TypeScript Deep Agents is the primary candidate; the spike determines whether it passes or fails to Python.
- SQLite owns production state; LangGraph owns recoverable worker execution.
- The director authorized four major creative approval checkpoints; intermediate automatic acceptance requires the explicit format policy and verification gates during Phase 6 integration.
- Credentials come only from the canonical repo-root `secrets.env`, loaded in memory.
- Existing validators, format boundaries, host-agent authoring, and renderer parity remain authoritative.
- **Further architecture changes must address a demonstrated test failure or production requirement.**
