# Studio Phase 1 harness spike

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
Phase 2 and full production remain unstarted/paused. This success establishes harness
capabilities on a fixture, not production reliability or animation quality.
