# Wiggly Agent Studio — Engineering Learnings & Architecture

> **Target Audience:** Autonomous Agents (Codex, Antigravity) & Human Engineers.
> **Purpose:** Zero-fluff engineering reference for scaling the Wiggly project. Read this before modifying the architecture or integrating new formats.

## 1. The Production Model (What Replaces ComfyUI?)

Instead of visual node builders like ComfyUI, Wiggly operates an **authoritative SQLite database** acting as a high-tech animation studio "production sheet".

1. **SQLite is the Ultimate Authority:** The database (`v3/lib/studio-production.ts`, Schema v5) exclusively controls state via `format_policies`, `format_assignments`, and `policy_acceptances`.
2. **Agents are Just Workers:** LangGraph / Deep Agents manage only the ephemeral inner loop (tool calls, scratchpads, `/drafts/` mounts). They hold NO production authority. Their memory is irrelevant to the system truth.
3. **Termination on Submission:** A worker's run ends permanently upon calling `submit_candidate`. Reviews are dispatched as fresh, isolated runs. No zombie graphs in memory.

## 2. Phase 6 Architecture & Constraints (The 10x Playbook)

Phase 6 finalized the SQLite-authoritative adapters. Codex MUST abide by these invariant constraints:

### Transitive Input Invalidation
- **The Law:** Downstream accepted assets are dynamically invalidated at query time if their *specific* upstream input head changes.
- **Mechanism:** `acceptedVersion` throws `STALE_INPUTS` at commit time if an author consumed an obsolete input.
- **Cost Trap Avoidance:** Inputs must be fine-grained (e.g., `beat_2.text`, `clip_1_offset`), not monolithic documents (`screenplay_v3`). A wording fix in scene 1 must leave `video_shot_02` accepted and untouched. Unrelated asset changes do not trigger false invalidation.

### The Remotion Collision Constraint
- **The Law:** Do not import `runtime/remotion.mjs` directly into the `v3` app runtime.
- **Mechanism:** Format repositories (e.g., `my-pixar-story-v1`) have locked dependencies that clash with the host app (`TypeError: Multiple versions of Remotion detected`). Format-level scene execution MUST be isolated in an external subprocess.
- **Async Execution:** Render operations take minutes. Never use synchronous `execFileSync` as it blocks the Node event loop, causing leases to expire. Treat renders as standalone operations with an `operation_id` using async `execFile` or `spawn`.

### The 4 Manual Director Checkpoints
These four stages **never auto-accept** and require explicit operator/director signatures:
1. `character_style` — Requires explicit character selection index (`selection: number`).
2. `storyboard`
3. `narration_performance`
4. `final_film` — Explicitly requires separate visual and audio review passes from *different* worker IDs before director approval.

### Deterministic Acceptance for Intermediates
Assets without checkpoints (e.g., `keyframe`, `video`, `editPlan`) auto-accept via `acceptMemoirIntermediate` **ONLY IF**:
1. Review verdict is `PASS` and `direction_compatible = 1`.
2. Review packet criteria match assignment criteria exactly.
3. Cryptographic hash verification succeeds (`artifact_hash === content_hash`) with a valid validator signature.
4. Input heads are strictly current.

## 3. Strict Safety & Operation Invariants

1. **Pre-Dispatch Intent (Crash Invariance):**
   - Committing an `INTENT` record in SQLite *before* network dispatch prevents double-billing on external API crashes (`SIGKILL`, network drops). Blind retries are banned.
2. **Two-Phase Receipts (Anti-Hallucination):**
   - Supplying an image to a context window does not prove evaluation. Two-phase receipts (`MEDIA_SUPPLIED` $\to$ `INSPECTION_COMPLETED`) prove exactly which bytes reached the model's perception pipeline.
   - *Note:* This proves the image arrived, not that the model understood it or evaluated it correctly. It is an operational guard, not a quality proof. Model-invented receipts are blocked by trusted runtime callbacks.
3. **Clean-Room Review Separation (But No Blindness):**
   - Reviewers run in isolated processes with decoupled packets. The packets contain the criteria, the candidate bytes, AND the **authoritative references** assembled by the Producer from SQLite (e.g., the script beat, director notes, and approved reference imagery).
   - This prevents confirmation bias (zero author prompt or reasoning history leakage) while giving the reviewer exactly what they need to judge likeness, continuity, and story matching.
   - SQLite enforces `AUTHOR_CANNOT_REVIEW_OWN_WORK`.
4. **Zero Silent Fallbacks ([`AGENTS.md`](file:///Users/shaz/Documents/wiggly/AGENTS.md) Rule 12):**
   - External API errors must throw loud diagnostic exceptions, preserve reservations, log remediation steps, and pause dispatch. Never synthesize fake assets.
5. **One Passive Renderer ([`AGENTS.md`](file:///Users/shaz/Documents/wiggly/AGENTS.md) Rules 1 & 9):**
   - Preview, export, and share consume the exact same `AdScene` contract via `AdRenderSurface`. Studio agents generate data; they never build custom renderers.
6. **The Operating Agent is the Author ([`AGENTS.md`](file:///Users/shaz/Documents/wiggly/AGENTS.md) Rule 13):**
   - Creative authoring (screenplays, prompts) belongs to active operating agents via `agent-bridge.ts`. Passive renderers never author content.

## 4. Phase Proof Records (For Reference)

- **Phase 1 (Node Harness):** [`docs/proofs/studio-phase1-harness.json`](file:///Users/shaz/Documents/wiggly/docs/proofs/studio-phase1-harness.json)
- **Phase 2 (M0 Review):** [`docs/proofs/studio-phase2-suitability.json`](file:///Users/shaz/Documents/wiggly/docs/proofs/studio-phase2-suitability.json)
- **Phase 3 (Safety/Crash):** [`docs/proofs/studio-phase3-safety.json`](file:///Users/shaz/Documents/wiggly/docs/proofs/studio-phase3-safety.json)
- **Phase 4 (Repair Lifecycle):** [`docs/proofs/studio-phase4-lifecycle.json`](file:///Users/shaz/Documents/wiggly/docs/proofs/studio-phase4-lifecycle.json)
- **Phase 5 (Concurrency):** [`docs/proofs/studio-phase5-concurrency.json`](file:///Users/shaz/Documents/wiggly/docs/proofs/studio-phase5-concurrency.json)
- **Phase 6 (Memoir Film):** [`docs/proofs/studio-phase6-film.json`](file:///Users/shaz/Documents/wiggly/docs/proofs/studio-phase6-film.json) *(Target proof structure, currently in branch `codex/studio-phase6-film-integration`)*
