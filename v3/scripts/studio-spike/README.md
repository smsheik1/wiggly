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

The existing production worker is `gpt-5.6-sol`; its model is not changed by this
spike. The optional live runner uses the already configured `gemini-3.8-flash`
only after the director chooses it for this trial:

`npm run live -- --gemini-authorized`

It inspects the included four-color PNG, writes observed colors in its draft
workspace, and calls `submit_probe`. The skill contains a marker not provided
in the user assignment. The expected colors are checked locally after the run,
not placed in the model's instructions. This is a test fixture, not generated
production media; no Muse image generation occurs in Phase 1.

The runner loads only named keys from `/Users/shaz/Projects/wiggly/secrets.env`
in memory. It never copies credentials to this directory. LangSmith requires
`LANGSMITH_API_KEY`; the Gemini trial additionally requires `GEMINI_API_KEY`.

Each live trial reserves $1 of the $5 total M0 estimated allowance before model
execution, with eight model calls maximum, bounded input/output, no provider
retries, and a three-minute invocation limit. Unknown outcomes retain the
reservation; another trial is intentional and never automatic. Usage-derived
cost estimates are not invoices. This sequential trial bookkeeping is not the
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
