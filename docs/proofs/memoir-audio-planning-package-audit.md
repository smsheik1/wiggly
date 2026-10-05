# Fresh-agent audio planning package audit

Date: 2026-10-05. Result: PASS for offline packaging and workflow mechanics, with limitations below. No remaining defect found within the audited scope.

## Scope and isolation

Desired outcome: Max can plan a short Cartesia story sample from an existing clone without account-balance proof, using a sourced conservative estimate, while budget/authorization, debug and video guards remain enforced.

Only the delivered archive and allowed dependencies were inspected. No product source, production run, genuine credentials, actual Codex worker, authenticated metadata lookup or real provider call was accessed. Packaged tests use explicitly isolated mock HTTP handlers, synthetic test keys and temporary media. No mock evidence was promoted to production.

- Delivered archive: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`
- Final archive SHA-256: `a978793cdd6bb3097caab20af5ee9ddadf741eb79c540078a05b3b14857ceb82`
- Initial isolated extraction: `/tmp/memoir-audio-package-audit.xAf9Vy`
- Final archive freshly extracted to: `/tmp/memoir-audio-final-audit.gfCnGY`
- Node: `v26.8.1`; `ffprobe`, `ffmpeg`, `tar` available.
- Final package check reports format 2.0.0 and studio SHA-256 `6aa725cf89906076ce82ed021d6efce30030e7c158111402bf1099face2d2fe9`.

Packaged `SKILL.md` and Max's skill were read. Dependencies were reused only after exact SHA-256 comparison of the extracted `package-lock.json` and the allowed source dependency lock. Both hashes: `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`. Each extraction's `node_modules` is a symlink to the preinstalled source dependencies. This does not prove a clean `npm ci` or dependency installation on a fresh machine; it proves execution with the preinstalled lock-matching dependency tree.

## Defect found and corrected

The initial archive's general paid-plan instructions still said “Positive account-verified per-request estimates are required” and required Cartesia estimates verified for the operator's account. That contradicted Max's new sourced-estimate planning instructions and could send a fresh operator back to unnecessary account proof.

This defect was promptly reported to the parent operator. The parent corrected and repacked the source; this auditor did not edit source. Final-byte extraction confirms the general instructions now require positive sourced estimates, use runtime `generationEstimate` for Cartesia speech, distinguish clone creation's separate sourced rate, and state unknown credit balance alone does not block an authorized speech request. Recursive comparison of initial and final extracted packages found only `SKILL.md` changed (apart from the audit-created dependency symlink). No runtime or tests changed between these extracts.

## Actual checks

Final archive:

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run check` | Pass; `credentialsRead:false`; LangGraph + SQLite loaded | `/tmp/memoir-audio-final-check.log` |
| `npm run smoke` | Pass for both supplied questionnaire examples; no model/media-generation/credential calls | `/tmp/memoir-audio-final-smoke.log` |
| `node --test tests/codex-host.test.mjs tests/providers.test.mjs tests/studio-providers.test.mjs tests/producer-handoff.test.mjs` | 41 passed, 0 failed | `/tmp/memoir-audio-final-focused.log` |
| Independent adversarial harness against final extraction | 25 passed | `/tmp/memoir-audio-final-adversarial.log`; harness `/tmp/memoir-audio-final-adversarial.mjs` |

Initial archive's identical runtime/test bytes additionally passed `node --test tests/debug-mode.test.mjs tests/mini-core-flow.test.mjs`: 18 passed, 0 failed. Evidence: `/tmp/memoir-audio-package-guards.log`. These were not rerun after the two prose corrections because recursive package comparison proved all runtime/test/dependency files unchanged.

Independent adversarial coverage:

1. Existing owned clone reaches short-sample planning without an original recording and with a zero project budget. The sample text is exactly the first locked script beat.
2. Estimate character count uses the locked text, the packaged $65/million-credit Pro overage basis, upward cent rounding and a $0.01 minimum. Narration binds all four locked texts and their summed count.
3. Omitting estimate, generation texts, voice choice, voice basis or planning guide is rejected before worker execution. Tampering characters, rate, source or estimate is likewise rejected.
4. A request below the canonical estimate is rejected. A valid plan persists the canonical cost basis in the exact request and stops at `authorize` while budget remains zero.
5. Exact human authorization cannot bypass zero budget. Wrong job ID/digest and agent-authored spending authorization are rejected. Exact scoped authorization creates no broader allowance.
6. Calling the provider adapter directly before graph authorization is rejected before its mock fetcher runs.
7. Debug pause blocks planner execution and even an otherwise authorized provider submission.
8. Historical Max instructions stay pinned until explicit human refresh. Agent refresh is rejected. Human refresh replaces only Max's document, retaining config/models/tools, every other skill/rubric, approved artifacts, voice, crew, budget, jobs and allowances. Debug stays paused. Refresh is refused after a plan exists or outside eligible audio planning.
9. A generic video allowance cannot autoauthorize a supervised video request; it still stops with a planned job at the exact human authorization gate.

One initial adversarial harness attempt changed a legacy fixture to supervised mode after it had legacy-only audio approvals; the runtime correctly rejected it with `NARRATION_LOCK_REQUIRED`. The harness was corrected to use the packaged genuine supervised fixture, then all 25 independent checks passed. This was a harness setup error, not a package defect.

## Limits

This is offline packaging proof, not creative-quality or production proof. No live Max dispatch, Cartesia account balance, generation entitlement, final invoice, clone identity, listening quality, actual story sample or final film was verified. The packaged estimate clearly marks current balance and final billing unverified and points to `https://cartesia.ai/pricing`; its published rate was inspected as package data, not revalidated online during this offline audit. Native host behavior was exercised through isolated protocol mocks. Actual human consent/approval messages remain trusted local attestations. Dependency reuse does not prove a clean install. The independent harness used isolated workflow fixtures and did not access or mutate a production checkpoint.
