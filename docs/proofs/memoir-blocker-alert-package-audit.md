# Blind packaged blocker-alert audit

Result: PASS for isolated contract/persistence mechanics. No release-blocking production-code failure was identified. This is not a real-account, media-quality, or clean-install proof.

## Artifact and isolation

- Archive tested: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`.
- Archive SHA256 at extraction: `cbea842cd44b9a66c6d1e13dcd555e41d499a891dcfb0263f0be041f980ef216`.
- Extraction: `/private/tmp/memoir-blocker-audit.gjkdrB`.
- Runtime: macOS, Node `v26.8.1`.
- Read packaged `AGENTS.md`, `SKILL.md`, `README.md`, Max's skill, requirements/scene/quality contracts and relevant packaged runtime/test files. All workflow evidence comes from the extracted package.
- No source code was edited. No credentials were opened or loaded. No real project was operated. No provider, model, or media-generation call was deliberately executed. Synthetic human instructions, approval records, file metadata, worker identities and a fictional failed job exist only in isolated audit fixtures.
- Dependencies reused by symlink from the provided archive directory's `node_modules`, after `cmp` proved byte-identical package locks. Both lock SHA256 values: `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`. This is NOT a clean `npm ci` installation.

## Commands and counts

1. `npm run check`: PASS. LangGraph/SQLite, packaged instruction inventory, renderer manifest and ffmpeg/ffprobe/tar checks succeeded; `credentialsRead: false`.
2. `npm run smoke`: PASS for 2/2 examples: parent and grandparent. Persistent answers/script author/reviewer/human loops and audio-first gates; explicit free isolated fixtures.
3. `npm test`: PASS, 226 tests, 226 passed, 0 failed/cancelled/skipped/todo. Reported duration 28,793.088291 ms. Full output: extraction directory `audit-npm-test.log`.
4. `node --test audit-probes.test.mjs`: PASS, 2 independent tests, 2 passed, 0 failed/cancelled/skipped/todo. Final reported duration 578.798083 ms. Source and output are retained as `audit-probes.test.mjs` and `audit-probes.log` in the extraction directory.

## Independent findings

- All four canonical account guides (Cartesia, Muse Image, Replicate, ElevenLabs) parse as strict `PlanningBlocker` data. All contain four concrete steps and conditional account/payment instructions. Invalid zero/six step counts, oversized problem/solution/step text and an extra unrecognized URL field are rejected by the schema.
- Current revision-4 SQLite fixture reaches Max's generation planning using actual runtime semantic events with an isolated configured crew. Missing blocker data is rejected with `PLANNING_HELP_REQUIRED`. Altered problem, solution, or steps are rejected with `PLANNING_HELP_BINDING`.
- Unassigned and wrong-role workers are rejected with `CREW_PERMISSION_DENIED`; stale task IDs are rejected with `STALE_TASK`; a human impersonating the agent action is rejected with `planning-blocked requires agent authority.` Task-packet guide mutation is refused by `prepareCrewTask` with `TASK_INPUT_MISMATCH`.
- The saved blocker pauses at escalation. Producer reports `Max (Generation Planner)`, STOP severity, canonical problem/solution/numbered steps, and no new generation. Technical diagnostic markers remain in `diagnostic`; they are absent from the concise operator alert message. No next worker is reported during escalation.
- Invalid submissions leave the SQLite project unchanged. Blocking, closing/reopening SQLite, and human resolution preserve approved artifacts byte-for-byte, the fictional failed historical generation job, existing exact request authorization/history, and the compute reservation. Reserved estimate remains $0.08 ($0.05 historical generation + $0.03 inference), against a $0.50 ceiling; these are estimates, not invoices.
- Human resolution returns to `produce`, names Max as ready for dispatch, clears the active alert, retains the blocker record, and does not submit or authorize another job. A separately probed fresh plan still pauses at `authorize` with a new planned job; it does not reuse the old authorization.
- A second `missing-input` blocker gives input restoration steps without invented credits/subscription guidance. Both blocker records survive another SQLite restart.
- Historical blocker data without `blocker` or worker provenance remains parseable, escalated and diagnostic-only. Presentation is read-only and does not invent canonical help, worker identities, jobs or approvals.
- Independent probe `globalThis.fetch` is replaced with a throwing guard: 0 attempted network calls. Runtime begin/error/reconcile operations in the fixture are pure checkpoint events; no provider executor is invoked.

## Exact audit-fixture failures and corrections

Three initial independent-probe runs failed due to overly specific expected error strings in the audit harness, not production behavior:

1. Expected `/CREW_PERMISSION_DENIED|STALE_TASK|Expected agent actor/`; actual `planning-blocked requires agent authority.` Corrected the audit assertion to match the actual refusal.
2. Expected `/TASK_BINDING/`; actual `TASK_INPUT_MISMATCH: planningGuide is missing, changed or stale; read the current task packet.` Corrected the audit assertion.
3. Expected `/Generation planning is not allowed/` for a plan during escalation; actual `CREW_PERMISSION_DENIED: only the assigned worker may submit this task.` Expanded the audit assertion to allow this earlier, stronger refusal.

The temporary fixture also moved from a fixed SQLite filename to timestamped filenames after the first failed run so a retained prior fixture could not collide with init. No packaged production code, instructions or packaged tests were patched. All independent assertions pass in the final run.

## Limits

- No clean installation was performed. Native dependency portability is unproven outside this reused local environment.
- Full packaged tests use isolated mocked/synthetic mechanics. Their passing results do not establish actual billing, current website navigation accuracy, model entitlement, API availability, voice identity, or generated media quality.
- Guide contents were checked offline for schema fit and guarded canonical binding; no account website was opened.
- Host worker IDs in this audit are explicitly fictional fixtures; genuine independence/host enforcement is not certified.
- The worker-assignment guard applies to configured crews. Historical trusted-operator projects without a crew retain the package's compatible manual-authority path; this audit does not treat that historical mode as a multi-user authorization service.
- Global fetch interception applies to independent probes. No OS-wide network sandbox was applied to the packaged suite; no live provider/model execution was requested, and the suite's evidence is isolated mechanics only.
- This report binds the exact archive hash above; a later archive rebuild, including proof-metadata-only changes, has a different hash and is not the exact artifact tested here.
