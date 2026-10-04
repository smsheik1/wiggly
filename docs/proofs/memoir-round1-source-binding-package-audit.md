# Fresh package audit

Package: `@wiggly/my-pixar-story-format` 2.0.0. Reviewed the shipped SKILL, requirements, questionnaire snapshot, scene contract, quality contract, and relevant runtime/tests. Source artifact: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`.

Final artifact SHA256: `ccf0b0a2687badbaa5f36161c26a4de0207b406d55b966b785f4f0a17924f9f1`.

Executed artifact SHA256: `a3746a0ebe03c2eea5ff368ed587bca796ee181711d8271a46178f92f616813d`. The coordinator subsequently repacked historical handoff metadata in `proof.json`. Extracted the final archive again and compared every other packaged file byte-for-byte against the executed extraction, excluding `node_modules` and `proof.json`: all identical. Final comparison evidence is in `final-package-comparison.json`; tests were not repeated for this metadata-only repack.

Extraction: `/tmp/wiggly-package-audit.0vI6jv`. All execution used extracted packaged runtime. This was a local isolated fixture proof, with no live model/worker dispatch, credential reads, provider calls, or AI media generation. No private user story or primary-run data was read or included.

## Results

- `npm run check`: PASS; Node v26.8.1, ffmpeg/ffprobe/tar available, LangGraph/SQLite loaded, packaged instruction inventory validated, credentialsRead false.
- `npm run smoke`: PASS for packaged parent and grandparent fixtures; persistent answers/script author-reviewer-user loops and audio-first gates.
- `node --test tests/studio-instructions.test.mjs tests/codex-host.test.mjs tests/debug-mode.test.mjs`: 28 tests, 28 pass, 0 fail/skipped/cancelled. The original estimate of 29 was corrected by the coordinating agent; no missing-test failure claimed.
- `node audit-rehearsal.mjs`: PASS for both shipped public examples using packaged official revision-3 runtime and isolated fixture adapter. Exact source inputs/digest survived author handoff, persisted answers, review handoff, and SQLite restart. Four tampered/missing task-field probes were rejected before fixture dispatch. Unconfirmed answer rewriting and a substituted task ID as source digest were rejected.
- Debug paused before work; workers/provider submissions/local render were refused. Each isolated author/reviewer result paused again despite maxTasks 8. Continue alone did not approve the answers. An explicitly isolated fixture human lock advanced to script/author and left debug paused, zero jobs, and $0 provider budget. Four total local fixture tasks across the two rehearsals; zero live workers/network attempts.
- `node runner.mjs schema answers`: PASS; required `inputs`, `sourceInputDigest`, `commonSenseChecks`. Metadata/schema output saved separately. The generic schema has a string fingerprint; the native host task specializes its schema with the exact source digest constant.

## Independent binding inspection

- `runtime/workflow.mjs:220`: answers task supplies `sourceInputs: p.inputs`, `sourceInputDigest: digest(p.inputs)`, and canonical `originalInputsRequired` derived from recorded human clarification.
- `runtime/crew.mjs:60`: canonical packet comparison includes both new fields, as well as source inputs; substituted, omitted, and stale values stop before host dispatch.
- `runtime/codex-host.mjs:103`: native answers content schema receives the exact fingerprint `const` and an explicit raw-copy rule including all source keys/wording. Existing isolated native-protocol test verifies the serialized worker packet. This audit did not start the signed-in CLI.
- `runtime/workflow.mjs:122`: artifact validation independently enforces the immutable digest and rejects changed answers absent recorded human clarification; storyteller change requires a new project.
- `runtime/debug.mjs:5`, `runtime/crew.mjs:76`, and debug workflow controls: paused execution stops before side effects; operator continuation is separate from approval/spend, and controls preserve the creative task identity.

The immutable source here is the validated persisted `project.inputs` contract, not the raw input file bytes. The runtime input schema trims string boundaries; this audit verifies byte-identical semantic JSON content for the packaged examples, which need no trimming. No broader byte-preservation claim is made.

## Limits

To avoid a redundant dependency install, compared the exact extracted/source package-lock bytes with `cmp` (identical) and linked source kit `node_modules`. Both lockfiles SHA256: `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`. Package code/assets/contracts are extracted; dependency installation itself is not a clean-install proof. Relevant extracted runtime files also compare identical to the corrected source snapshot.

This proof does not qualify a real reviewer, demonstrate live native model obedience, establish media quality, or approve production work. Synthetic events remain exclusively in `/tmp` rehearsal fixtures. No runtime failure or blocker was observed within this authorized scope.

## Scoped ponytail review

Reviewed only the correction's canonical fields, native schema specialization, and focused guardrail tests. It reuses the existing digest, task packet, schema, and runtime rejection path. No new dependency, abstraction, renderer, or state store was introduced. No meaningful bloat found. Lean already. Ship.

## Evidence files

- `check.log`
- `smoke.log`
- `focused-tests.log`
- `rehearsal.log`, `rehearsal-results.json`, `audit-rehearsal.mjs`
- `answers-schema.json`, `metadata-schema.log`
- `final-package-comparison.json`, `final-package/`
- `isolated-rehearsals/parent/state.sqlite` and isolated receipts
- `isolated-rehearsals/grandparent/state.sqlite` and isolated receipts
