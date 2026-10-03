# Memoir studio — remaining work

Last updated: October 3, 2026. Owner: Shaz + implementing agent.

[The living spec](memoir-system-living-spec.md) is the design authority; this checklist records implementation and evidence. The operator explicitly authorized **human-supervised v1** while deferring formal reviewer qualification. That supersedes the old requirement to stop all development for human-labelled media. It does not certify reviewers or authorize paid media, AI video or a real production film test.

**Current boundary:** Supervised v1 core is implemented through private finalization. New projects default supervised; older checkpoints retain qualified mode without migration. Actual media perception/measurements and exact human approval still control locks. Source and fresh-package checks pass; the final package/commit evidence appears below. No existing rehearsal, approvals or provider jobs were changed by this work.

## Core implementation

- [x] **Narration-first:** Four 15-second beats and natural-rate storyteller narration; narration lock before any generated image/video. Compatibility APIs remain. Tests: `workflow`, `supervised-v1`.
- [x] **Supervised review:** Actual direct listening/viewing, independent transcription, duration/silence/rate evidence; no fabricated speaker score. Human confirms every media criterion against actual media/reference. Qualified mode remains stricter. Tests: `supervised-v1`, `crew`, `gemini-review`, `cartesia-stt`.
- [x] **Human responses:** Approve, detail change, redo current deliverable, abandon whole project. Redo preserves source facts/history/jobs/budget; abandon blocks production and retains exact human reconciliation. Phase 1: commit `6d0b4885`.
- [x] **Confirmed rewind:** Current impact digest required before reopening human-locked dependencies. Stale acknowledgement refused; unrelated assets retained; unknown rerun prices/times disclosed. Tests: `supervised-v1`, `studio`.
- [x] **Shots before backgrounds:** Sam authors reviewed/human-approved intentions and required scenes/locations/angles; Beau/Pia produce those references one location at a time; Sam confirms staging without silently changing action/timing/cast/camera. Tests: `supervised-v1`, `backgrounds`, `keyframes`.
- [x] **Character gates:** Inventory-bound person/age references, reviewed/human-approved character design prompt, three Muse designs, human selection, reviewed/human-approved sheet prompt, actual selected image conditioning, every required sheet approved before backgrounds. Tests: `supervised-v1`, `workflow`, `providers`.
- [x] **Budget and bounded loops:** $0 initial aggregate provider ceiling, explicit human set/increase, positive account estimates, reservation before generation/Gemini/STT, conservative failed/uncertain consumption, cache/restart preservation. Exact authorization for every supervised video repair. Existing two-rejection escalation, three generation attempts and bounded dispatch remain. Tests: `supervised-v1`, `studio`, `codex-host`, perception adapters.
- [x] **Intake rights/references:** Extend the existing questionnaire flow with human-confirmed answers lock before script writing: voice consent, photo rights, responsible-adult authority for minors, character/age references, explicitly unverified interpretation/omission and exact common-sense finding resolutions. Await-reference blocks lock; later roster cannot substitute identities/ages. Tests: `supervised-v1`.
- [x] **Chat operation:** Original human messages/task/version bindings; unrelated notes preserve stage; changes/redo/abandon persisted; failed media not presented as usable. Original sample player accompanies audition/narration and four stems remain separately playable. Tests: `workflow`, `readiness`, `supervised-v1`.
- [x] **Crew/tool boundary:** Shipped macOS local Codex, GPT-5.6 Sol workers, role/hash tools, actual Gemini 3.8 Flash review at 4 FPS, independent Cartesia STT. No secrets/provider generation/human approval via worker broker. Supervised reviewer bindings pinned after approved media. Other hosts are adapters, not verified integrations.
- [x] **Invented regression foundation:** Fixed good controls and planted identity/age/stale-reference, extra-hand/contact/geography/text and missing-perception observations. Free deterministic tests run under npm test; packaging fails on regression. These test binding/routing, **not live defect detection**. Full-video coverage refusal tested independently. See packaged `evaluation/invented-regression.json`.
- [x] **Complete offline protocol:** Isolated supervised answers → script → narration → cast/sheets → intentions/backgrounds → compositions → video receipts → sound imports/edit → separate film reviews/human → complete. SQLite reopened after every event; no network or generated film. Test: `supervised-studio`.
- [x] **Private lifecycle:** Document local immutable run/media/receipts, authorized provider uploads, no automatic publish/retention/deletion/refunds; abandon retains existing jobs for provider reconciliation. Copy the full run folder and preserve absolute asset paths.
- [x] **Narration windows:** Four exact 15.0-second deliverables with recorded silence-only tails and untouched originals; overlong speech returns to script approval. Unpadded rate measurement and digital-sample preservation tested in `refined-flow`.
- [x] **Core source checks:** 144 tests, check and parent/grandparent smoke pass after answers/character/narration refinements. Logs `/tmp/memoir-refined-finaltests.log`, `/tmp/memoir-refined-check.log`, `/tmp/memoir-refined-smoke.log`. These prove mechanics, not creative production quality.
- [x] **Earlier supervised release package (before these refinements):** Clean npm ci/check/test/smoke and fresh-agent refusal/recovery proof pass: 137 tests, 10 invented regression cases, zero dependency advisories; report `/tmp/my-pixar-story-v2-audit.sOvGNX/AUDIT-REPORT.md`. Stale proof marker and video-key classification fixed. Ponytail review: Lean already. Ship; no dependency/framework/renderer added. Implementation commit `146e77ae` pushed on `codex/memoir-supervised-v1`; verified kit/archive synchronized to `/Users/shaz/Projects/wiggly` after baseline comparison and backup; primary check/smoke pass. Final-byte recheck confirms the archive. See [release evidence](proofs/memoir-supervised-v1-release.json) and [blind audit](proofs/memoir-supervised-v1-package-audit.md). No app renderer changes.

- [x] **Answers/character refinement release:** 144 source and extracted-package tests pass; independent CLI refusal/restart/answers-lock proof and final archive check/smoke/seven focused tests pass. Muse remains the only image provider. See [refinement release evidence](proofs/memoir-answers-character-release.json) and [fresh package audit](proofs/memoir-answers-character-package-audit.md). No existing run changed; no paid generation.

## Deferred evidence before claiming trustworthy autonomous review

These are **not supervised-v1 development blockers**. They remain necessary for qualified-mode/autonomous production claims.

- [ ] Connect and calibrate actual speaker comparison against genuine original/generated samples and different-speaker negatives; retain sample/stem/method/profile hashes and limitations. SpeechBrain ECAPA-TDNN is researched only.
- [ ] Connect measurable stylized-face identity/age/view comparisons, hand/anatomy/prop contact and OCR/text checks; calibrate thresholds and uncertainty. Do not imply image perception already supplies these numerical tools.
- [ ] Obtain genuinely human-labelled usable/broken audio and visual clips, with appropriate independent identity/continuity references. Freeze grouped calibration/holdout splits; don't invent adjudication or leak derivatives across splits.
- [ ] Run independent Ava/Vera qualification for exact model/rubric/tool profiles. Existing gate policy requires two distinct good/two defective held-out files per criterion and zero errors; this small minimum is not universal reliability proof.
- [ ] Measure missed short defects at 4 FPS, false rejections, ASR/listening disagreement and active-speech natural-rate evidence. Whole-stem WPM alone cannot prove natural delivery.

Current seed dataset: 22 cases, no human-confirmed qualification labels. Synthetic transport probes and planted protocol findings remain distinct from real ground truth.

## Real production validation — separately authorized, currently excluded

- [ ] Obtain consented storyteller sample and actual photo/reference inventory; set the project's human budget and account-verified provider estimates. Authenticated provider metadata does not prove funds or inference entitlement.
- [ ] Verify ordinary-person clone/audition, four natural narration beats, photo-grounded character designs/sheets, rooms/angles and composed keyframes through actual human review.
- [ ] **Separate explicit authorization before any AI video generation or real end-to-end production film proof.** Neither this checklist nor implementation authorizes it.
- [ ] Once authorized, inspect actual clips and finished 60-second film for story, likeness, voice, anatomy, spatial/temporal continuity and sound; use the one official Remotion renderer and private finalization.
- [ ] Validate real interruption/uncertain-provider recovery and confirmed localized revisions without duplicate spend. Offline tests establish mechanics only.

## October 3 core-flow refinement

- [x] New projects use fixed Seedance 2.0 Mini/480p silent I2V, actual approved keyframe bytes and documented source dimensions; missing saved profile preserves legacy policy. Shared final export scales source footage; no native HD-detail claim.
- [x] All reviewed/human-approved scene keyframes remain required before video.
- [x] Reviewer reports observed defects → orchestrator exposes repair notices → prompt author repairs → runtime generates → independent review/human. New sheet/background/angle repair paths preserve still-valid selections/briefs. Stable attempt scopes survive prompt changes.
- [x] Every new Mini video request/repair requires fresh exact human authorization; image allowances remain explicit/bounded.
- [x] Explicit reviewed narration-only sound decision removes the mandatory score/import step for new Mini projects. Optional effects still lock; actual local mixing and both final review channels remain required.
- [x] Fresh package npm ci/check/smoke and 153-test audit passed with independent profile/legacy/omission probes; final-byte and primary-sync evidence recorded in `proofs/memoir-mini-core-release.json`.

## Deferred refinements and extras

- [ ] **Per-beat narration repair/approval:** V1 keeps four stems as one deliverable. Narration changes conservatively reopen dependent visuals. More precise beat/shot invalidation needs its own implementation/proof.
- [ ] **Piano/music:** Research deferred. Licensed measured imports and explicit generated sound paths exist; new Mini narration-only completion requires no music asset/key; optional score still requires reviewed provenance and actual listening. No live score-quality proof or silent track choice.
- [ ] **Additional hosts/OSes:** Verify Windows/Linux/other worker integrations before claiming support; current native release evidence is macOS Codex.
- [ ] **Relocation/delete automation:** Explicit local/remote media and provider-clone deletion, portable asset-path rewriting and retention timers are not shipped. Current private run-folder boundary is documented.
- [ ] **Background bank:** Curate rights-cleared ordinary places only if useful; no bank ships or overrides known storyteller details.
- [ ] **LangSmith:** Optional hosted tracing/datasets; offline eval/export exists. Not required for this graph.
- [ ] **Wiggly app integration:** Current deliverable is the packaged agent-operated format; future /create,/builder,/share UX must preserve their boundaries and AdRenderSurface parity.
- [ ] **Further autonomy:** Reduce human decisions only after actual reviewed runs demonstrate reliability. Parallel fan-out, ComfyUI and Dots are not prerequisites.

Historical checkpoints in the living spec and proof.json retain their original dates, tests and limitations. The supervised-v1 section supersedes former qualification stops; it does not relabel those old proofs as production success.
