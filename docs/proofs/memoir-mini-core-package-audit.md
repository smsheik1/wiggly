# Blind offline package audit — My Pixar Story v2.0.0

- Archive: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`
- SHA-256: `8d051679b6dbb672401b059a39d74e06799c5c139de0cedaab917cfa05674eff`
- Clean extraction: `/tmp/memoir-mini-audit.ib8NYP`
- Audit date: 2026-10-03
- Scope: shipped archive only; no source checkout, prior audit, production secret, saved run, provider/model call, AI video, mutation, push, or source change.

## Result

PASS for the requested offline orchestration proof. No blocking correctness issue or material instruction/runtime contradiction was found.

The package can orchestrate the supplied parent and grandparent questionnaires as a 60-second memoir with four fixed 15-second beats. Runtime gates enforce answers/script and cloned-voice narration before visual production; all current scene keyframes require agent review and exact human confirmation before video. Fresh projects bind `seedance-mini-480p`; checkpoints without a production profile parse as `legacy-seedance-hd`. Mini requests bind the approved keyframe, fixed Seedance 2.0 Mini endpoint, 480p/16:9, `generate_audio:false`, and measured 864x496 output.

Rejected visual media creates localized `repairNotices`, returns work to the responsible prompt author, excludes the failed asset from presentation, and preserves attempt limits across prompt revisions. Every Mini video generation and repair creates a new exact-version authorization gate; a repair allowance cannot authorize it. Narration-only completion requires an explicit reviewed and human-approved `music:null` decision plus nonempty no-music/no-effects reasons, skips music/effect jobs, and still requires distinct Vera visual and Ava audio film reviews before final human approval.

## Commands and results

- `npm ci` — PASS; 241 packages installed, 0 vulnerabilities. npm reported install-script policy notices for `better-sqlite3` and `esbuild`, but both loaded and all checks passed.
- `npm run check` — PASS on Node v26.8.1; LangGraph/SQLite and ffmpeg/ffprobe/tar available; `credentialsRead:false`.
- `npm run smoke` — PASS for both `parent` and `grandparent`; persistent answers/script loops and audio-first gates passed using isolated fixtures.
- `npm test` — PASS, 153 tests, 0 failures/skips/cancellations. Coverage observed for Mini/legacy profiles, keyframe-before-video gating, exact fresh video authorization, defect routing, SQLite restart behavior, narration-only mixing/final review, provider request recovery, and invented protocol regression cases.
- `node runner.mjs schema answers|script|event|soundPlan` — PASS; schemas emitted locally.
- Independent Node probe — PASS: new project `{productionProfile:"seedance-mini-480p", reviewMode:"supervised", step:"answers"}`; deleting the saved profile and parsing yields `legacy-seedance-hd`; narration-only content is rejected unless both omission reasons are nonempty.
- Direct contract inspection — PASS: `assertAllowed` requires narration and all approved keyframes before studio/video stages; provider descriptor fixes Mini model/resolution and rejects overrides; film lock requires separate visual/audio passing reviews from different workers.

## Findings and limitations

- No release-blocking defect found.
- `format.json` intentionally remains `supervised-v1-production-proof-pending`, and `proof.json` intentionally says the fresh blind package audit is pending. This matches the requested handoff: metadata closure occurs after this audit rather than inside it.
- The archive proves orchestration and offline contract enforcement, not real media quality, provider entitlement/pricing, reviewer qualification, voice likeness, defect-detection reliability, or a finished production film.
- Supervised mode uses actual-media advisory reviewers plus exact human confirmation; calibrated speaker comparison and genuine human-labelled reviewer qualification remain explicitly deferred. Qualified mode cannot be claimed from the invented fixtures.
- Test media, labels, approvals, authorizations, and provider responses are invented protocol observations only. They are not genuine human decisions or provider evidence.
- The Remotion test downloaded Chrome Headless Shell as a test dependency. No provider endpoint or model inference was invoked.

Installed temporary `node_modules` was removed after testing; the extraction and this report were retained for review.

## Final-byte closeout

- Final archive SHA-256: `f4aa36173a67a79e3440fefc098d7e68144eb812f4d2b76b9d262f68f72f9c4d` (matches the announced closeout hash).
- Fresh final extraction: `/tmp/memoir-mini-final.gj8801`.
- `npm ci` — PASS; 241 packages installed, 0 vulnerabilities.
- `npm run check` — PASS; `credentialsRead:false`.
- `npm run smoke` — PASS for parent and grandparent isolated fixtures; no model, provider-generation, or credential calls.
- `node --test tests/mini-core-flow.test.mjs` — PASS, 9/9 tests, 0 failures/skips/cancellations.
- Metadata inspection confirms `proof.json` now records the passing fresh-package audit and retains the audited pre-closeout archive hash `8d051679b6dbb672401b059a39d74e06799c5c139de0cedaab917cfa05674eff`.
- Conclusion: final metadata/import-cleanup bytes preserve the audited Mini core behavior. No new blocker or contradiction found.
- The final extraction's temporary `node_modules` was removed after this focused check.
