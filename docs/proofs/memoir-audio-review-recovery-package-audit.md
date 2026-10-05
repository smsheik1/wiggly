# Blind package audit: audio timing and receipt recovery

Date: 2026-10-05. Result: PASS for the requested local mechanics scope, including the final-archive follow-up below. No production-quality claim.

## Final-archive follow-up

The final supplied archive has actual SHA-256 `582299dc9bd494ab85273de1e345c64e08db954ddee7d2e867b42d1c234d17e3`. It was independently extracted fresh into `/tmp/memoir-audio-review-recovery-final.YG0v4k`.

Independent `cmp` commands each exited 0 for:

- Final extracted `package-lock.json` against the source kit's `package-lock.json`, before dependency reuse.
- Final extracted `runtime/gemini-review.mjs` against the initially audited extracted adapter.
- Final extracted `tests/gemini-review.test.mjs` against the initially audited extracted Gemini tests.

The final lock/adapter/Gemini-test SHA-256 values exactly match the initial values in the table below. Only after the exact lockfile comparison did this follow-up symlink source-kit `node_modules` into the fresh extraction.

`diff -u` between the initial and final extracted `runner.mjs` confirms the bounded `timeoutMs:600000` argument to `CodexHost`, plus two explanatory comments. The corresponding `tests/codex-host.test.mjs` diff adds one assertion checking that runner argument. Both files were read from the archives, not edited. Host tests use injected fake subprocesses and local SQLite fixtures; no real Codex worker or model was launched.

Executed final setup commands:

```sh
mktemp -d /tmp/memoir-audio-review-recovery-final.XXXXXX
shasum -a 256 /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz
tar -xzf /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz -C /tmp/memoir-audio-review-recovery-final.YG0v4k
cmp /tmp/memoir-audio-review-recovery-final.YG0v4k/package-lock.json /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/package-lock.json
cmp /tmp/memoir-audio-review-recovery-final.YG0v4k/runtime/gemini-review.mjs /tmp/memoir-audio-review-recovery-package.qnQVWg/runtime/gemini-review.mjs
cmp /tmp/memoir-audio-review-recovery-final.YG0v4k/tests/gemini-review.test.mjs /tmp/memoir-audio-review-recovery-package.qnQVWg/tests/gemini-review.test.mjs
ln -s /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/node_modules /tmp/memoir-audio-review-recovery-final.YG0v4k/node_modules
```

Executed from the final fresh extraction:

| Command | Actual final result |
| --- | --- |
| `npm run check` | Exit 0; v2.0.0, SQLite/LangGraph and local tools loaded; `credentialsRead: false`; same shared renderer and studio digest. |
| `npm run smoke` | Exit 0; both isolated source examples passed; no model/media-generation/credential calls. |
| `node --test tests/codex-host.test.mjs` | Exit 0; 14 tests passed; 0 failures/cancellations/skips, including the runner timeout assertion, host failure/no-retry behavior, receipt recovery, and planning boundaries. |

Final follow-up verdict: PASS. No problem observed. Gemini behavior conclusions below are carried forward because the audited adapter and focused tests are byte-identical; the 10 Gemini tests and 4 supplemental tests were run on the **initial** extracted archive and were not rerun in this follow-up. This final follow-up does not simulate a ten-minute elapsed timeout or establish that a live four-file review completes in that window. No provider calls, real credentials, model calls, source edits, or git operations occurred.

## Initial artifact and isolation

- Only supplied kit used: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`.
- Initial archive SHA-256: `17a786f8568691a67277848fc5a49a0fb5671b0dd695c427af2479a682284679` (superseded by the final archive identified above).
- Fresh extraction: `/tmp/memoir-audio-review-recovery-package.qnQVWg`.
- Extracted package identifies itself as `@wiggly/my-pixar-story-format@2.0.0`.
- Read packaged `AGENTS.md`, `README.md`, `SKILL.md`, `requirements.json`, `scene-contract.json`, `quality.json`, `runtime/gemini-review.mjs`, and `tests/gemini-review.test.mjs`.
- Exact `cmp` of extracted and source-kit `package-lock.json` exited 0 before symlinking the source kit's installed `node_modules` into the fresh extraction. Extracted lock SHA-256: `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`.
- No source edits. No real credentials read. No live provider requests, crew dispatch, production initialization, generation, render, approval, or finalization.
- Tests use local synthetic sine/color media, inert fake-key fixture files, and injected mock fetchers. No genuine key or external network request is involved in these fixtures.

## Initial actual commands and results

Executed from repository cwd for extraction/setup:

```sh
mktemp -d /tmp/memoir-audio-review-recovery-package.XXXXXX
shasum -a 256 /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz
tar -xzf /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz -C /tmp/memoir-audio-review-recovery-package.qnQVWg
cmp /tmp/memoir-audio-review-recovery-package.qnQVWg/package-lock.json /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/package-lock.json
ln -s /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/node_modules /tmp/memoir-audio-review-recovery-package.qnQVWg/node_modules
```

Executed from the fresh extraction:

| Command | Actual result |
| --- | --- |
| `npm run check` | Exit 0; v2.0.0; SQLite/LangGraph loaded; ffprobe, ffmpeg, tar present; `credentialsRead: false`; shared renderer path reported. |
| `npm run smoke` | Exit 0; parent and grandparent persistent answers/script/reviewer/user loops plus audio-first gates passed; `FREE SMOKE PASS. No model, media-generation or credential calls.` |
| `node --test tests/gemini-review.test.mjs` | Exit 0; 10 tests passed; 0 failures/cancellations/skips. |
| `node --test audit-extra.test.mjs` | Exit 0; 4 additional isolated audit tests passed; 0 failures/cancellations/skips. |

Supplemental test file is retained at `/tmp/memoir-audio-review-recovery-package.qnQVWg/audit-extra.test.mjs`. It was added only in the temporary extraction. Its per-case temporary fixtures clean up after each test.

Runtime: Node `v26.8.1`, npm `11.19.0`, FFmpeg/ffprobe `9.0.1` on local macOS.

Relevant extracted bytes:

| File | SHA-256 |
| --- | --- |
| `runtime/gemini-review.mjs` | `c49da31e2c3c387792d175063609ff4a1097d4d3a8b1f9bf4282684d0e0c377a` |
| `tests/gemini-review.test.mjs` | `65d9f326561debefae5143f26d71471264eeaa4f611fcd5ae7597e1f1af9bfc9` |

## Findings

1. **Audio temporal bounds pass.** Reports must start exactly at zero, be perceptible, and end within measured duration minus 0.02 seconds to measured duration plus 0.1 seconds for audio. Returned evidence uses the measured duration; the raw report endpoint is preserved. Video overhang stays limited to 0.02 seconds. Observation timestamps must be nonnegative, ordered, and end no later than measured duration plus 0.02 seconds. Packaged tests reject 0.04-second undercoverage, 0.2-second audio overhang, nonzero start, unavailable perception, out-of-range observation, and 0.04-second video overhang. Supplemental tests accept the audio +0.1 endpoint, reject -0.021 undercoverage and +0.101 overhang, reject +0.001 start, reversed observations, and +0.021 observation endpoints. This is bounded rounding tolerance, not proof of perceptual completeness.

2. **Completed input-equivalent recovery across task IDs preserves the actual paid receipt.** The runtime compares every descriptor binding except `taskId`: tool, media hash, measured duration, worker ID, processing profile, context, scoped reference hashes, and video FPS fields. It integrity-checks the original `started.json` and `response.json`, then validates the completed exact-model response. Returned `requestDigest`, `receiptPath`, and `interactionId` remain the original request's evidence; the new cache records `reusedFrom`. Supplemental tests verify original interaction identity and receipt path survive task refresh, recovery works with the fake credential file deleted, and neither a fresh reservation nor mock network call happens. The packaged test also proves raw-response recovery with `result.json` absent and stateless responses without provider IDs.

3. **Unknown outcomes cannot automatically retry, including refreshed routing.** A started original request without `response.json` blocks new task IDs with equivalent inputs as `GEMINI_REVIEW_UNCERTAIN`. Mock inference failure and unknown upload tests count exactly one prior submission. Supplemental refreshed-task checks pass with positive call allowance, demonstrating that blocking is receipt protection rather than merely zero-budget refusal.

4. **Mismatched, partial, unavailable, malformed, and tampered responses stay blocked.** Wrong-model completed responses revalidate and fail without another request. Partial coverage and unavailable perception cannot yield direct-audio evidence. Raw-response digest tampering is rejected as `GEMINI_RECEIPT_CHANGED` under a refreshed task ID, with the mock call count still one. Changed worker or criteria do not reuse the prior result; packaged zero-allowance checks prove they require separate authorization rather than borrowing unrelated evidence.

5. **Unusable reports do not suggest billing as remediation.** The validator marks `stopDispatch: true`, points at the original `response.json`, asks the operator to inspect coverage/model, preserves original media/receipt, and states that no duplicate request was submitted. Packaged and supplemental incomplete/unavailable/malformed/temporal checks confirm no `Usage/Billing`, payment, or credits direction in report-validation errors. Actual HTTP/provider failures retain the provider remediation path and secret redaction; they are a separate error class.

No blocking defect was observed in the requested audit scope.

## Limits

- This verifies local contracts, receipt identity, failure behavior, and mock HTTP mechanics. It does not establish live Gemini access, actual billing, real listening accuracy, defect recall, voice identity, independent STT accuracy, speaker calibration, qualification, or production film quality.
- The complete suite (`npm test`) and live media/crew workflow were not run; the requested focused suite plus free check/smoke were run.
- Installed dependencies were reused only after exact lockfile comparison; fresh network installation and dependency portability were not tested.
- No source change, push, commit, release, or production checkpoint migration was performed.
- The reused-result path is bound to a trusted local receipt directory; local hashes do not authenticate a malicious operator who rewrites evidence and its digests together.
