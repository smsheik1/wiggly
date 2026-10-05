# Memoir studio — remaining work

Last updated: October 4, 2026. Owner: Shaz + implementing agent.

[The living spec](memoir-system-living-spec.md) is the design authority; this checklist records implementation and evidence. The operator explicitly authorized **human-supervised v1** while deferring formal reviewer qualification. That supersedes the old requirement to stop all development for human-labelled media. It does not certify reviewers or authorize paid media, AI video or a real production film test.

**Current boundary:** Supervised v1 core is implemented through private finalization. New projects default supervised; older checkpoints retain qualified mode without migration. Actual media perception/measurements and exact human approval still control locks. Source and fresh-package checks pass; the final package/commit evidence appears below. No existing rehearsal, approvals or provider jobs were changed by this work.

## Core implementation

- [x] **Joint operator debug mode:** Opt-in SQLite pause, genuine human one-step continuation, operator-only rejected/raw output and receipt inspection, error stops with stable task IDs, guarded worker/provider/render side effects, safe submitted-job collection, unchanged approvals/budgets/profile pinning. Free isolated protocol and CLI tests; real production rehearsal remains outstanding.

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

## October 3 crew instruction organization

- [x] Runtime-loaded skill for each named crew member; independent text/audio/visual rubrics; scoped shared recipes.
- [x] One validated studio config separates role models, generation services, retry/default dispatch limits and $0 initial budget. Actual human-approved model bindings/budgets remain per-project.
- [x] Exact instruction/config/rubric/recipe/voice snapshot in new project SQLite; template edits do not change active runs. Historical path preserved; pristine-only explicit upgrade; no active approval migration.
- [x] Current task/input version checks and verified handoff checklist stop missing, stale or substituted context before dispatch.
- [x] Friendly producer file loaded into status/work/presentation, with a brief derived stage/next-decision update and no extra model call.
- [x] Source check/smoke, 161 tests and 14 skill validations pass. Fresh package npm ci/check/smoke and independent 161-test suite pass; final-byte evidence: `proofs/memoir-studio-instructions-release.json`.

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

## Operator debug release

- [x] Persistent debug pauses and genuine human one-step continuation; current operator can inspect each output above the orchestrator. Full source suite: 170/170, nine debug regression checks.
- [x] Fresh-package audit: check/parent+grandparent smoke, 18 focused tests and five independent probes. The audit's missing-reference completion/recovery defect is fixed at the dispatcher and covered for old cached receipts too. Async job-ID submission pauses; safe collection preserves existing outcomes.
- [x] Evidence: [debug release](proofs/memoir-debug-mode-release.json) and [package audit](proofs/memoir-debug-mode-package-audit.md). Final archive differs from the independently tested code archive only by proof metadata.
- [ ] Real joint debugging rehearsal with consented media, account estimates and separate actual paid generation authorization. Round 1 used genuine input and actual native crew; an accepted answers packet received an independent rejection. A separate rehearsal now pins the agreed intake relevance rule and remains paused before authoring. No answer/script/media lock or media generation yet.
- [x] First observed live handoff root fix: supply the exact questionnaire fingerprint and raw-copy requirement to the answers author; validate both before dispatch without weakening source/clarification guards. Native transport and canonical-task regressions added; subsequent real retry passed and independent questionnaire review completed. See [handoff release checkpoint](proofs/memoir-round1-source-binding-release.json).
- [x] Real source-binding retry passed; Sage reviewed and rejected the answers packet. Repair routing worked. The review exposed unnecessary blocking questions about optional anecdotes.
- [x] Agreed intake relevance rule supplied to Leo and Sage: only missing facts necessary for understanding/staging block. Optional prompts may remain unanswered; no invented facts or bypassed consent/reference/approval gates.
- [ ] Verify the new intake rule with the next actual author/reviewer pair in a separate instruction-pinned rehearsal using the same raw answers. Preserve the original run and review; no silent snapshot migration.

## 2026-10-04: script-led cast correction

Workflow revision 4 supersedes earlier requirements to freeze cast/photos at ANSWERS LOCK. Intake confirms usable memories; Leo proposes the script and necessary on-screen cast together; Sage reviews both and the human approves them. After narration lock, Cleo collects only needed references and presents rights/guardian authority or interpreted/omitted likeness decisions at roster approval. The runtime binds that roster to the approved script proposal and exact references. Essential factual blockers, independent review, narration-first visuals and exact paid-video approval remain enforced. Revisions 2/3 retain their historical gates; active runs are never silently migrated.

Root cause observed in Round 1: freezing the character inventory before writing prompted the operator to ask Shaz to design the cast. Automated regression checks cover both parent/grandparent inputs, missing cast proposals, essential factual blockers and later reference/rights enforcement. This is a runtime correction, not proof of creative quality or a real production film.

## 2026-10-04: expressive latitude and shared project decisions

Observed failure: Sage rejected a smile used to express sourced maternal excitement/pride while incorrectly approving separate looks based on nearby birthdays. The text rubric now distinguishes ordinary emotionally faithful expression from material invented events, promises, quotes and contradictory motives. Writer and reviewer both receive persisted, source-backed human creative directions, separately from immutable memory facts. Narrative ages remain factual while shared appearance designs may span age 18; a design used in a minor scene keeps minor=true for conservative reference-rights checks.

During unapproved script work before media, an explicitly authorized writing-instruction refresh may update only Leo’s skill and the text rubric and requires a fresh independent review of the unchanged draft. Existing answers approval, previous review evidence, retry counts, tools, config, budgets and recipes remain intact. Locked script decisions require the usual impact-confirmed rewind. Static regression tests check the task propagation, permissions, persistence and rubric distinction; they do not prove model semantic reliability.

## 2026-10-04 — Producer handoff correction

- [x] Runtime-generated updates distinguish completed work with exact provenance, a named next worker and a human request. Assignment is never reported as execution. Older history is preserved without invented attribution.
- [x] Human voice-sample gate supplies recording instructions and its drop-folder path. Packaged input-folder prepares/opens that folder without changing the checkpoint, reading credentials or calling providers. Debug continuation no longer obscures a human decision/input.
- [x] Actual Round 1 now has ANSWERS LOCK and SCRIPT LOCK including the shared late-teen cast. Leo authored and Sage reviewed the revised script; the human approved story/cast. This supersedes earlier historical checklist statements that no text lock existed.
- [ ] Actual audition, narration and later media rehearsal remain pending. An existing verified clone is supplied; a new recording is needed only for new-clone creation. No provider/media generation or media-quality certification follows from the reporting fix.
## Existing own-voice reuse (2026-10-04)

Implemented: human-selected existing Cartesia voice, authenticated read-only lookup, persisted metadata/provenance, guarded reuse directly to audition without a mandatory recording, and unchanged audition/narration/human/spend gates. Default new-clone path remains available when no existing voice is selected. Remaining real validation: authorized audition generation, Ava's direct listening/measurements, and human identity approval. A successful owned/active metadata lookup alone is not that validation.


## October 4 actual audition-planning debug rehearsal

- [x] Native driver dispatches Max at generation planning; human, provider-execution, qualification and local film-assembly gates remain separate.
- [x] Canonical audition text comes from the first locked story beat; narration text comes from all four. No separate audition-text approval or new recording for an existing verified clone.
- [x] Assigned planner can return an evidenced `planning-blocked`; graph records it and pauses without jobs, spend or fabricated prices. Resolving a pricing blocker retains approved visual prompts and retry counters.
- [ ] Verify the actual Cartesia account rate/estimate for Round 1, supply it to the planner, and obtain an explicit human project ceiling and exact audition request authorization. Actual Max is paused on this missing input at audition/escalate; no audio generated.
- [x] Require Max’s structured problem/solution/steps, preserve full internal diagnostics, and display a brief producer STOP alert. Account guidance is canonical; missing-input guidance remains specific to the worker’s evidence. Offline suite passes 226 cases; actual new Max output under this contract remains to be rehearsed.

## October 4 grounded-writing safeguards

- [x] Agreed hard rules reach Leo's skill and Sage's independent rubric: no material invented facts, exact selected direct quotations, semantic grounding for names, faithful paraphrase/gestures allowed.
- [x] New pinned `grounded-v1` projects reject altered or unbound direct quotes before script acceptance; native script schemas include citations. Existing project snapshots/locks are unchanged.
- [x] Fear/cost, chronology and a concrete closing image stay optional guidance; essential gaps alone justify blocking follow-ups.
- [x] Four additional regression cases cover quotation binding, human-confirmed source clarification, historical-state preservation, worker handoff and honest semantic evaluation.
- [x] Fourteen invented persona cases with good/broken controls are packaged with the independent rubric, unconfirmed labels and an inconclusive/unscored local baseline.
- [ ] Human-adjudicated labels, additional separated holdouts and genuine reviewer predictions are still needed before claiming semantic-review accuracy. This is calibration work, not a blocker to supervised human approval in v1.

Canonical policy: [living spec](memoir-system-living-spec.md#2026-10-04--grounded-writing-rules-and-quotation-checks). Verification: [release evidence](proofs/memoir-grounded-writing-release.json).

## Plain producer communication correction

- [x] Distinguish a genuine blockage from waiting for an intentional debug inspection; give the reason and next action.
- [x] Present the voice check as a short sample using the storyteller’s cloned voice; keep internal stage IDs intact.
- [x] Preserve historical diagnostics separately and require the host to explain their actual missing information; avoid a stale current-blocked claim after resolution.
- [x] Rehearse Max with the corrected sourced audio estimate: he returned a $0.02 plan; one real Cartesia request produced the short sample. Ava review and human voice approval remain pending.

## Audio planning root correction and Round 1 retry

- [x] Remove unavailable balance/access checks as speculative planning prerequisites in Max's skill and canonical task.
- [x] Supply a sourced character-based speech estimate; bind it to the task and save it in the exact request.
- [x] Explicitly refresh only Max's saved instructions before provider work, retaining all other pinned state.
- [x] Retry the authorized first-beat sample through the real runtime. Cartesia returned one 14.64-second WAV; locked answers/story and existing clone binding stayed unchanged.
- [x] Ava independently listened through Gemini 3.8 Flash, transcribed through Cartesia Ink-Whisper, measured and reviewed the exact sample. Integrity, delivery and safety passed; existing-clone identity comparison remains honestly unresolved without an original recording.
- [x] Shaz approved the reviewed short sample with “looks great”; VOICE LOCK is now recorded. Narration approval remains separate.
- [x] Explicit same-worker code refresh preserves that approval and historic reviewer evidence. Max prepared the four-beat narration request before generation.
- [x] Generate four narration files through Cartesia at speed 1. Source durations: 14.88, 17.20, 14.40 and 13.28 seconds; Beat 2 remains overlong and cannot lock.
- [x] Ava completed the real independent narration review: Beat 2 exceeds its window and mispronounces A/C; actual rejected Event accepted at sequence 52.
- [ ] Obtain impact confirmation, repair the affected script with human approval, regenerate as authorized and obtain human narration approval before visuals unlock.
- [ ] Improve per-beat dependency granularity: current locked-script repair reopens script, short sample approval and narration as a whole, preserving answers and clone. Do not claim other beat approvals remain independently valid.

### Audio review receipt recovery

- [x] Repair the observed 40-millisecond audio endpoint overestimate false block; retain strict partial/unavailable coverage rejection and raw evidence.
- [x] Reuse completed input-equivalent listening receipts across explicit task refresh, preserving original paid provenance. Unknown outcomes and mismatched inputs remain blocked.
- [x] Replace misleading billing advice on unusable completed reports with report-inspection guidance.
- [x] Fresh agent verified the recovery archive: free check/smoke, 10 Gemini cases and four independent supplemental checks. Final timeout-only follow-up blocked by worker usage limit; final local checks pass, not a fresh final audit.
- [x] Give four-file native reviews a bounded ten-minute window; retain stop-on-timeout and explicit saved-turn reconciliation.

### Reviewer tool connection and spoken-number comparison

- [x] Fix the native tool execution host and verify a real scoped measurement call without provider spend.
- [x] Accept equivalent “eight”/“8” ASR spelling using one shared narrow spoken-number comparison; retain rejection of changed/missing words and preserve the original transcript.
- [x] Revalidate Ava's exact saved completed report through the official event boundary. No duplicate listening/STT/synthesis was needed. See [review release evidence](proofs/memoir-review-tool-host-release.json).

Evidence: [audio planning release](proofs/memoir-audio-planning-release.json). The price is a conservative reservation, not a verified invoice.


### Local narration repair — 2026-10-05 update

- [x] Give Eli scoped pause inspection and fractional-range editing, enforce full source/draft listening and independent review, preserve originals/siblings/script/voice locks.
- [x] Connect a real native editor with the actual edit schema and narrowly adopt instructions in the saved rehearsal, with no provider calls.
- [ ] Attempt actual Beat 2 repair with bounded listening/transcription inference budget, obtain Ava review and human narration approval. Editing is local; listening/STT have separate budgets.
- [ ] If editing proves infeasible, implement targeted single-beat synthesis. Current Cartesia adapter still generates four stems.
- [ ] Improve substantive script-change invalidation granularity; word-preserving editing now retains locks, while actual text changes still use the broader rewind.

The earlier instruction to shorten the locked script is conditional on editing proving infeasible. No script rewind has been applied.


### Audio investigation gate — 2026-10-05

- [x] Fix actual editor Cartesia transcription access, not only the advertised tool list.
- [x] Reject unsupported infeasibility: require captured successful listening, pause inspection and nonempty word timing. Essential tool failures remain tool errors. Preserve evidence and human repair wording.
- [x] Real bounded retry proves editor STT and two immutable 15-second draft renders, without proving a reviewed repair.
- [ ] Resolve the new coverage mismatch: measured second draft 15.00 seconds; listening report 15.23. Preserve response and unfinished native dispatch; reconcile before any retry or worker refresh. Do not loosen bounds merely to accept the draft.
- [ ] Obtain independent Ava review and human narration approval after recovery. Existing inference budget remains authoritative; no new ceiling is assumed.

## Duration review correction — October 5, 2026

- [x] Remove generated coverage endpoints from the shared Gemini audio/video gate. Verified FFprobe duration remains authoritative; explicit full-inspection/perceptibility declarations, observation bounds and fail-stop handling remain. Existing guardrails extended; no new sample-count tool or named test added.
- [ ] Resume the actual narration repair safely: reconcile its unfinished native dispatch, refresh the same worker/model capability binding, then obtain a compatible listening report within the existing authorization. Preserve the old 15.23 report and both edited drafts; no approval or artifact substitution is implied by this code fix.
