# Blind packaged measured-duration audit

Verdict: PASS within the offline mechanics scope. No genuine runtime issue found.

- Archive: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`
- Archive SHA256: `1571aeb87fef1c163b86fc90e2d17c3e16bc7dc273b358851e0c0bee14f0726a`
- Fresh extraction: `/tmp/wiggly-measured-duration-audit.1x50oT`
- Runtime: Node `v26.8.1`, npm `11.19.0`; FFprobe/FFmpeg available.
- Read the packaged AGENTS.md, SKILL.md, requirements, scene contract, quality rules, Ava instructions/audio rubric, and relevant packaged implementation/tests. No source repository implementation was inspected or changed.

## Commands and results

1. `shasum -a 256 <archive>` and `tar -tzf <archive>`: archive identified and inventory inspected.
2. `tar -xzf <archive> -C /tmp/wiggly-measured-duration-audit.1x50oT`: fresh extraction succeeded.
3. `cmp package-lock.json /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/package-lock.json`: exact byte match. Both lockfile SHA256 values were `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`.
4. Reused the explicitly permitted installed dependency tree via a local `node_modules` symlink after that comparison. **This is not a clean-install proof**; `npm ci` was not run.
5. `npm run check`: PASS; LangGraph/SQLite, tools and compiled renderer validated; `credentialsRead:false`.
6. `npm run smoke`: PASS for parent/grandparent isolated persistent workflow fixtures; explicitly no model, media-generation or credential calls.
7. `node --test tests/gemini-review.test.mjs`: PASS, 10/10 tests, zero failures/skips. Covers measured duration, incomplete/unavailable reports, legacy-contract refusal, scoped references, receipts, recovery, HTTP failures, unknown upload outcomes, call-cap concurrency and project reservation.
8. `node independent-audit-probe.mjs`: PASS. Independently generated a 15.23-second synthetic sine WAV and verified direct FFprobe equality, forged metadata refusal before fetch, offline routing-refresh receipt recovery, and partial/unavailable/legacy/extra-endpoint response refusal with no automatic inference retry. One mocked complete inference reserved once; zero actual provider requests. Probe fixture/key were removed after completion.

## Findings

`runtime/media.mjs` imports duration from FFprobe and re-probes immutable assets during verification. `runtime/gemini-review.mjs` requires the strict `perceptible` and `fullMediaInspected` booleans, excludes model duration/coverage endpoints, bounds observation timestamps against verified measured duration, and returns `seconds:file.durationSeconds`. The prompt explicitly says that FFprobe supplied duration and the model must not estimate endpoints. A false/missing inspection declaration or unavailable perception stops dispatch without a pass or paid repair.

The report-contract version is part of the receipt profile. Completed responses recover only with matching media/worker/context/profile bindings; routing-only task ID refresh can reuse compatible evidence. Legacy endpoint reports do not become new full-inspection claims. Hash-bound receipts, unknown-request refusal, call caps and in-flight deduplication remain present. The packaged runner wires positive supervised cost estimates and serialized persisted project reservations before network requests; completed caches avoid a second reservation. The free focused tests passed for these protections.

## Limits

This is an isolated mock protocol/mechanics audit, not live Gemini compatibility, actual listening, media-quality qualification, billing accuracy, genuine speaker measurement, a full production rehearsal, or a clean dependency install. The model's full-inspection declaration cannot independently prove real perception; video uses the declared sampled profile, not every source frame. No paid calls, production secrets, real rehearsal media, source changes, archive changes, full-suite rerun or extra infrastructure were used. Only the extracted audit report/probe and permitted dependency symlink were added.
