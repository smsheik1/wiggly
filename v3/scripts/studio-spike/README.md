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

Run `npm run check` and `npm run test:phase3` (or `npm test` for the current complete suite).
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
gates. The Phase 2 NVIDIA response reliability issue is still unresolved. Phase 4 was subsequently authorized after the successful Phase 3 goal; its isolated lifecycle proof follows. Production remains paused.


## Phase 4: repair, independent review, and director approval

The director authorized Phase 4 after the successful Phase 3 goal. Run
`npm run check` and `npm run test:phase4`; `npm test` passes all 41 checks,
including 14 new lifecycle checks. No inference/media provider calls or provider
credentials are used. The artifacts and inspection findings are explicit mocks;
Phase 2 remains the actual visual perception evidence.

Separate reviewer assignments receive the producer's exact-version packet. Authors
cannot review their own attempt. PASS requires completed hash-bound inspection
with the requested modality and coverage; an inconclusive result blocks progress
without penalizing the author. Rejection records feedback and permits a new draft
attempt without changing old versions. A local published version must be approved
before the trusted producer makes it a downstream input.

Approval cards carry project, ticket, candidate version, hash, and ticket revision.
The authenticated transition rejects stale inputs/cards, conflicting commands,
and modified published bytes. Identical command delivery returns the original
receipt. Restart while awaiting approval preserves the card and project pause;
approval does not resume production.

The prototype operator surface is a local CLI, not a new dashboard or web identity
service. Its OS-owned 0600 `operator-auth.json` stores a signing capability outside
all worker mounts and is ignored by Git. Workers have neither that file nor signing,
SQL, approval, or shell tools. This protects the exposed worker harness; it does not
isolate arbitrary processes running under the operator's OS account.

From this directory, use an explicitly provisioned isolated workspace:

```sh
npm run operator -- /absolute/isolated/workspace init
npm run operator -- /absolute/isolated/workspace card ticket-id
npm run operator -- /absolute/isolated/workspace apply /absolute/operator-command.json
```

A decision file contains the exact card fields plus `id`, `action: "decide"`,
`decision: "APPROVE"` or `"REJECT"`, and rejection feedback when applicable.
The CLI supplies the authenticated local principal and signs that explicit command.
`extend_limits` requires project/ticket, expected revision, a reason, and increased
limits; project `pause`, `resume`, and `extend_allowance` require an explicit ID,
project, value, and reason. Ticket allowance extensions never raise the project cap.
Do not point the CLI at saved production; no migration or cutover is authorized.

Attempt, strike, and per-attempt turn counts survive restart and are not reset by
an extension. Native Deep Agents middleware records and checks each model turn
before invocation. A real regression test showed callback errors can be swallowed
by LangChain, so telemetry callbacks are not used for enforcement. Native author
and reviewer finishing tools end their separate runs. The owned v1→v2 SQL schema
upgrade is tested on an isolated fixture, not the legacy studio database.

All 313 saved production files still match the baseline. See
`docs/proofs/studio-phase4-lifecycle.json`. Full LangGraph checkpoint recovery,
NVIDIA response reliability, concurrent dispatch, film integration, and migration
remain unproven gates. Phase 5 was subsequently authorized; its checkpoint follows. Production remains paused.


## Phase 5: bounded concurrency checkpoint — live gate stopped

`npm run check` and `npm test` pass all 54 checks: 13 new Phase 5 checks plus
41 previous checks. Phase 5 is **not complete**. Its local safety checks pass;
NVIDIA/Kimi failed the live acceptance gate after three distinct configurations.
No fourth diagnostic or Phase 6 run is authorized by that escalation rule.

`dispatchAssignments` is a bounded trusted-producer batch. It claims explicit
eligible tickets through the existing SQL authority, runs at most the configured
worker count, and stops new work on failure. Claimed, stale, paused, or capacity-
limited tickets remain governed by SQL; another batch can reconsider eligibility.
It adds no daemon, queue service, or second workflow state machine.

Worker admission, shared reservations, provider slot claims, and minimum request
intervals are transactional and apply across independent processes. Unknown
submissions and unsettled failures retain provider slots; only confirmed settlement
releases them. Intent waiting is local scheduling, not an external API retry.
Each wake rechecks lease and pause, and dispatch rechecks allowance so an overrun
cannot allow a previously reserved call to start. SQL pacing survives restart.
Defaults are eight worker slots and one provider slot; the isolated trial explicitly
sets two workers, one Muse call, and the tested NVIDIA limits.

The actual trial used two Deep Agents authors through the active host-agent bridge,
the existing Muse request builder, native protected filesystem tools and middleware,
and LangSmith. Both authored prompts and generated one image each. The shared Muse
gate serialized their paid calls. NVIDIA returned HTTP 429 before the authors could
both publish. Recovery retained the exact generated bytes and restarted fresh bounded
inspection workers; it did not regenerate, migrate, or prove graph checkpoint recovery.

The three distinct inference diagnostics were:

1. Maximum reasoning, 16,384 output tokens, two NVIDIA calls in flight: HTTP 429.
2. Maximum reasoning, 8,192 output tokens, one call, six-second pacing: garbled
   HTTP 200 output with no required tool.
3. High reasoning, 4,096 output tokens, temperature zero, seed zero, one call,
   fifteen-second pacing: empty HTTP 200 output with no required tool.

The response guard rejects missing required tools, truncation, unknown functions,
and malformed tool arguments before graph acceptance. It neither repairs corrupted
output nor retries. The third failure was loudly escalated, and all live testing stopped.
A successful model response between failures does not establish provider reliability.
The first provider error is preserved even when another worker subsequently hits pause.

The fresh test cap was $5; two Muse calls consumed an estimated $0.02. Verified invoice
charges remain unknown. NVIDIA's [free prototype endpoint](https://build.nvidia.com/moonshotai/kimi-k3)
has no invented token tariff; the [API contract](https://docs.api.nvidia.com/nim/reference/moonshotai-kimi-k3-infer)
permits the tested reasoning and sampling settings. The live command is `npm run phase5`;
**do not rerun it while this escalation is unresolved**. Its `--phase5-recover-root=<id>`
operator diagnostic mode never exposes generation again. One persistent authorized-run record prevents a fresh workspace from resetting the allowance, and each of the three configurations has an exclusive execution record. Trial outputs and raw provider
responses remain in ignored `output/phase5/`; the committed proof excludes large media.

All 313 saved production files still match the baseline, and both saved production and
the isolated trial remain paused. See `docs/proofs/studio-phase5-concurrency.json`.
The director authorized four major creative approval checkpoints; their explicit format
policy will be integrated during Phase 6, not applied to these test artifacts.

## Phase 6 — opt-in SQL Memoir integration

The director authorized Phase 6 in this chat. Real saved production remains paused;
there is no migration, public upload, or cutover. This integration is a host-operated
API, not a replacement for the historical package's legacy runner.

From this directory, with Node 22.13+ and FFmpeg/ffprobe installed:

```sh
npm ci
npm run phase6:setup
npm run test:phase6
npm run phase6:proof
```

Setup verifies `format-packages/memoir-v2.0.0.tgz` SHA-256, extracts only its official
renderer, installs the Format's locked dependencies, and runs its free packaged smoke.
The proof uses two different example inputs, scripted local operating agents, static
color clips, sine tones, and clearly labeled mock review/director decisions. It makes
zero provider calls. It renders actual 60-second films and exercises the final
approval gate and portable share bundle. These fixtures prove integration and
technical behavior, not story, voice, motion, or creative acceptance. Inspect the
printed localhost previews, exported files and `output/phase6/proof-*/proof.json`;
Ctrl-C closes their servers. Never point these commands at saved production.

`memoir-format.ts` is the trusted producer entry point: explicitly activate the signed
format policy; create assignments from exact accepted input heads; run the bounded
native Deep Agents author; start/run an independent review; accept eligible intermediate
work or present the exact-version director card. Four director groups are character/style,
storyboard, narration performance, and final film. Candidate choices require an explicit
index. Workers receive scoped filesystem mounts and bound tools only. Caller-supplied
inspection/provider tools are trusted adapters and must enforce the declared role's
capabilities, budget, lease and actual-media coverage. `packet.tools` documents the
role profile; it does not authorize arbitrary tools supplied by an untrusted caller.

Media receipts must reference bytes pinned through the trusted `store.pinMedia` adapter
before author inspection. No arbitrary-path pin tool is exposed to workers. Validation
rejects draft paths in media contracts. JSON publication binds the runtime's completed
inspection receipt; model-written receipt labels cannot confer evidence.

`renderMemoirFilm` reuses the official passive renderer and measured technical gate.
`finalizeMemoirFilm` requires an exact accepted final-film version, verifies its scene,
renderer and consumed inputs, and writes an approved export plus a portable official
Player bundle. Preview and portable share use that Player's `RemotionAdScene` /
`AdRenderSurface`; MP4 uses the same renderer and full scene. Uploading this portable
bundle, or wiring Memoir into public `/s`, is a later explicit product integration;
no public link is created here.

The archived v2.0.0 renderer stays byte-identical. SQL adapter changes to validators
are source additions and record their own source digest; the archive hash does not
claim those additions were present in the original package. Existing legacy tests
continue to protect the historical coordinator.

The authorized isolated live test and one recovery completed successfully within the
original $0.10 cap. The first attempt rejected an invented inspection reference;
submission now binds trusted runtime receipts. The recovery author published in seven
turns. Review exposed a missing requested outcome in its briefing; the corrected packet
passed in ten total turns after director-authorized extensions to six, then twelve.
The same candidate, attempt, history and budget were preserved throughout. Combined
reported usage was $0.014838156; conservative allowance consumption was $0.014852.
This proves live text editing and independent review, not creative audiovisual quality
or full LangGraph checkpoint replay. Both isolated projects remain paused. Further
paid trials require authorization.

After a free full proof, run `node --import tsx phase6-render-check.ts <printed-root>`
to inspect actual MP4 frames across every clip and compare portable-share scene/export
bytes. The app renderer guardrail is `cd ../../; node --import tsx tests/memoir-render.test.tsx`.
The archived renderer runs in its own locked dependency process; do not import its
Remotion runtime into the app process, which has a separate existing version.

Final-film review preserves the existing separate audiovisual requirement: call
`startMemoirReview(..., allowance, "video")`, complete its independent review, then
`startMemoirReview(..., allowance, "audio")` with a different worker identity.
A visual-only pass does not produce a director approval card. Unavailable perception
must return INCONCLUSIVE; technical metadata cannot substitute for seeing/hearing.


## Live memoir rehearsal — preparation checkpoint

`rehearsal.ts prepare --root <isolated-private-root> --kit <format-kit> --source
<saved-run> --preferred <selected-Kimi-script> --authored <Codex-repaired-script>`
validates the real inputs and repaired script, requires identical narration, records
source hashes, copies consent/reference evidence, and creates a new paused project
with zero allowance. Imported evidence does not confer new approvals. The command
cannot reset an existing rehearsal and makes no provider calls. Keep personal
answers, photos, scripts, keys and operational SQLite data in ignored `output/`.

`rehearsal-capability.ts prepare --root <root> --kit <kit>` makes explicitly synthetic
local image/video/audio fixtures (Node, FFmpeg/ffprobe and macOS `say` required). These are capability probes, never production
film assets. Held-out controls stay outside model requests.

After explicit human authorization of the exact `capability-batch.json`, a trusted
operator records an authorization file containing `quote_sha256` (the hash of
JSON.stringify(parsed quote)), `allowance_micros` (200000), and the actual
`operator_message`. Run `rehearsal-capability.ts run --root <root> --kit <kit>
--authorization <file>` once. This permits only three configured Gemini perception
calls, keeps unknown billing outcomes reserved, stops on external errors, links
LangSmith traces, verifies held-out observations, and pauses on exit. It does not
permit production generation, additional calls, retries, or migration. Authorization
files are host-only records of a human decision, not worker tools.

`media-transport.ts` reuses the Format's provider transport behind SQLite intent,
allowance, lease, request-ID and immutable-file gates. Legacy execution retains its
original authorization checks. Completed SQL operations reuse verified local results;
known queued jobs collect without submitting again; unknown outcomes block.
`media-perception.ts` confines inspection to the producer's exact media packet and
uses successful provider responses to bind transmitted bytes, including uploaded
media, to SQL evidence. Completed cached inspections reuse their original evidence.
Incomplete perception never produces completed inspection evidence. Media payloads
and secret metadata are omitted from traces.

Rehearsal assignment/review callers explicitly set `maxTurns: 12`; old defaults
remain unchanged. The full real author/reviewer media workflow, director approval,
production generation, film render and measured narration revision are subsequent
priced batches. This checkpoint proves free preparation and isolated integration
checks, not that a real film has been produced or creatively accepted.

Focused checks: `node --import tsx --test rehearsal.test.ts phase6.test.ts` and
`npm run check`. All provider tests use injected isolated mock transports.
