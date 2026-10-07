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
