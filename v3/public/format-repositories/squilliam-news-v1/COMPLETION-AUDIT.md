# Squilliam News completion audit

This audit maps the active Wiggly Repo objective to current, reviewable evidence. A row is complete only when the named artifact or executable check directly proves it.

| Objective requirement | Status | Authoritative evidence |
| --- | --- | --- |
| Work on a fresh, isolated branch | Pass | Branch `codex/feat/squilliam-news-repo`; all branch changes are under this Format root. |
| Do not integrate into `/create`, `/builder`, or `/share` | Pass | `git diff --name-only origin/main...HEAD` contains only `v3/public/format-repositories/squilliam-news-v1/**`. |
| Preserve one official renderer | Pass | `format.json` names `runtime/renderer/app.js`; `composition-contract.json` records the invariant; the test suite asserts that `runtime/renderer/` contains only `app.js` and `index.html`. |
| Separate replaceable promotion content from fixed character-pack/studio mechanics | Pass | The boundary table in `README.md`, `input-contract.json`, `composition-contract.json`, `assets.json`, and the renderer fact-leak test. |
| Admit only render-tested character packs | Pass for corrected v0.2.1 runtime | `assets/character-packs.json` now binds transparent face cutouts by stable Collada material name; contract tests prove every mapping exists; corrected hashed media under `evidence/character-packs/` visibly retains each character's eyes. The rejected v0.2.0 evidence is archived. |
| Package Format-specific agent instructions | Pass | `SKILL.md` gives a complete ordered loop and explicitly forbids rebuilding the renderer. |
| Package input, output, and composition contracts | Pass | `input-contract.json`, `output-contract.json`, and `composition-contract.json`. |
| Declare tools, providers, key names, cost, and approval policy without secret values | Pass | `requirements.json`, `.env.example`, `runner.mjs check`, and the secret scan recorded in `evidence/package-smoke.json`. |
| Preserve assets and provenance | Pass | Fixed assets are listed in `assets.json`; each example and fixture has `asset-sources.json`; generated-provider evidence is sanitized. |
| Support voice and pronunciation configuration | Pass | `SQUILLIAM_VOICE_ID` remains environment-only; each `content.json` carries explicit pronunciation overrides; Fish input is phoneme encoded by the runner. |
| Provide semantic `smoke/check/init/validate/render/inspect/finalize` commands | Pass | `package.json`, `runner.mjs`, and the command-contract test; `package` is included as the archive command. |
| Provide a free local smoke test through the official renderer | Pass | The corrected synthetic fixture passes `npm run smoke` in source, in the blind archive-only handoff, and in an independent clean extraction. |
| Prevent provider calls before validation and approval | Pass | Tests prove `--approve-provider` cannot bypass validation, missing approval cannot create a receipt, and either rejection consumes zero attempts. |
| Limit and preserve attempts | Pass | `input-contract.json` caps attempts at three; run `state.json` records attempt history; the blind proof finished on attempt one. |
| Create two meaningfully different promotional proofs through the current runtime | Pass | Fresh We The Artists and Wiggly Format Lab v0.2.1 quality reports share runtime hash `480d2e91d07b115cb0e161c0d5a2f9e8ec022a49463f8647695575f296662533` while recording different content and video hashes. Both exact 30-second corrected videos are under current example evidence. |
| Inspect real rendered media | Pass | Both corrected full v0.2.1 promotions pass automatic inspection; close samples around both former blink moments retain both yellow eyes and both red pupils. Corrected contact sheets for both promotions and all four presenters were visually inspected, and the user approved the corrected We The Artists review. |
| Reject failed, stale, or unapproved finalization | Pass | Tests prove human approval cannot override failed inspection, stale runtime evidence is rejected, and the explicit human-review flag is mandatory. |
| Finalize human-approved real media | Pass | `examples/we-the-artists/evidence/finalization.json` binds automatic pass, explicit human pass, and the current runtime/content/audio/video hashes to `final.mp4`. |
| Preserve a second creative proof without inventing approval | Pass | The current Wiggly Format Lab v0.2.1 review passes automatic checks on attempt one. It remains a review proof because the user approved the We The Artists video, not this separate creative. |
| Run a blind-agent handoff | Pass | A fresh agent received only candidate ZIP `d652654…`, passed 14/14 tests and the full semantic loop, reproduced the current video/contact hashes on attempt one with zero provider calls and unchanged renderer hashes, inspected six eye-critical timestamps plus thirty one-second samples, and stopped before finalization. Receipts are under `evidence/blind-handoff/v0.2.1/`. |
| Record failures, fixes, and scope of lessons | Pass | `lessons.json` now records the eye-material regression, false automatic/agent pass, user rejection, root cause, shared fix, and corrected evidence alongside earlier lessons. |
| Remove needless machinery | Pass | Ponytail review removed unused renderer debug/rest-pose state and replaced the custom env parser with Node's native `process.loadEnvFile`; no database, marketplace, workflow engine, MCP server, or app integration was added. |
| Produce a downloadable, reviewable runnable kit | Pass | The builder creates a ZIP, SHA-256 sidecar, and in-archive manifest with the required exclusions. The evidence-bearing archive passed clean install, 15/15 tests, check, smoke, dependency audit, ZIP integrity, manifest-size verification, secret scan, and exclusion scan. `evidence/package-smoke.json` records the audit; the final sidecar is authoritative after embedding that receipt. |

The v0.2.0 eye regression and the separate pupil-only fake blink are reproduced, diagnosed, fixed, and covered by corrected v0.2.1 smoke, full-promotion, human-finalization, blind-handoff, and clean-package evidence. All objective requirements are now backed by current artifacts or executable checks.
