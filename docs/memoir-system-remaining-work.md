# Memoir studio — remaining work

Last updated: October 2, 2026. Owner: Shaz + the implementing agent.

This is the execution checklist for the packaged Wiggly memoir format. [The living system spec](memoir-system-living-spec.md) remains the single source of design decisions. This file tracks work and evidence; it does not authorize new providers, spending, production generation, or changes to saved projects. Proposed changes below need a recorded decision before implementation.

**Current position:** the LangGraph/SQLite workflow reaches private film finalization mechanically. Real Codex crew dispatch, Gemini listening/video transport at 4 FPS, independent Cartesia transcription, scoped tools, provider-job recovery, and the shared Remotion renderer are connected. Production audio/visual reviewers are not qualified. We can improve the implementation while qualification is deferred; deferral must not turn an unqualified review into approval.

**Standing limits:** no AI video generation or real end-to-end production film test during this work. Preserve saved state and real human approvals. Music work is deferred. No silent provider/model fallback. Four 15-second beats, natural-rate narration, and narration lock before any generated image remain required.

Use `[ ]` for unfinished work and `[x]` only after linking evidence that covers the actual requirement. Record the commit/proof beside each completed item. Do not close a creative-quality item using synthetic fixtures or a passing unit test.

## 1. Work we can tackle before reviewer qualification

### A. Shot intentions before background production — proposed change; recommended first

- [ ] Record the two-pass planning decision in the living spec. Current runtime completes backgrounds before its detailed shot plan.
- [ ] Have **Sam** author reviewed, human-approved shot intentions from the locked narration and established cast: immediate scene, action, framing, timing, props, continuity, and required space. This initial plan must not require background images that do not exist yet.
- [ ] Have **Beau** derive the necessary locations and angles from those intentions. Questionnaire answers remain supporting references; immediate scene and locked script lead. Keep Beau's plain-language direction separate from **Pia's** technical prompts.
- [ ] After background approval, have Sam check and bind staging to the actual approved masters/angles. Resolve an impossible action or contradictory layout before **Cam** composes keyframes.
- [ ] Decide whether an illustrated cheap storyboard adds value in v1. Text shot planning can proceed without one; any generated storyboard image requires narration lock and cannot become an enlarged production keyframe.
- [ ] Update dependencies, role tasks, human gates, schemas, operator instructions, and offline regression tests together. Explicitly handle older checkpoints; never silently migrate approvals.

Proposed order: **narration lock → character lock → shot intentions → backgrounds/angles → staging confirmation → composed keyframes → video**. Every new deliverable follows independent review → human approval → evidenced revision.

### B. Mandatory confirmation before rewinding locked work

Existing `impact` calculates affected artifacts and preserves unrelated work; a human `changes` event currently can reopen an artifact without a separately enforced impact acknowledgement.

- [ ] Present affected shots/assets, approvals reopening, assets remaining valid, and known rerun estimates before changing locked work. Label unknown costs/times honestly.
- [ ] Require a human acknowledgement bound to the exact proposed revision and current dependency state. Refuse stale acknowledgements or agent impersonation.
- [ ] Apply only the confirmed scope and retain old versions, receipts, and review evidence. In-flight/uncertain jobs must be reconciled first.
- [ ] Cover script, clone, narration, character designs/sheets, backgrounds/angles, shots, clips, sound, and final-edit rewinds. Keep localized review repairs distinct from human changes to approved creative intent.
- [ ] Prove impact preview itself changes nothing; confirmed changes invalidate precisely the recorded dependencies; a restart or delayed reply cannot apply the wrong rewind.

### C. Project-wide spending ceiling and loop limits

Generation attempt caps, bounded operation allowances, bounded host dispatch, and per-invocation review/transcription call caps exist. They are not one cumulative project budget.

- [ ] Decide the v1 project budget and who may explicitly increase it. Approval of an output must not implicitly authorize another paid request.
- [ ] Enforce a durable project-wide ceiling across media generation and separately billed review/transcription. Track estimates/reservations, confirmed charges where available, and unknown outcomes without pretending estimates are actual charges.
- [ ] Make reservation safe across concurrent work and restart; uncertain requests retain their reservation until reconciled. Repeated commands must not reset the ceiling or double-charge a recovered result.
- [ ] Bound creative text/owner/reviewer repair cycles per deliverable, in addition to existing media attempt limits. At the limit, escalate with evidence and a concrete repair choice; never advance a failed artifact.
- [ ] Show used/reserved/remaining budget and remaining attempts alongside the next action. Test that no provider request starts beyond the ceiling.

### D. Intake references, permissions, and missing-age policy

The existing questionnaire and script common-sense checks are built; a consented voice sample and measured character photos are required later. A complete structured upfront rights/reference checklist is still missing.

- [ ] Extend the existing intake with a people/age/location/prop reference inventory and focused follow-ups. Avoid a duplicate questionnaire.
- [ ] Record permission to use the supplied photos and clone the storyteller's voice, including the responsible adult's authority for children's photos. Preserve the selected provider's actual consent requirements.
- [ ] Flag essential unavailable photos, age variants, locations, and difficult actions before script lock. Early collection/planning does not permit early image generation.
- [ ] Decide the no-photo policy per character/age: user-approved interpreted likeness, alternative staging, revised story, or wait for a reference. Record uncertainty; never claim invented geometry is verified likeness.
- [ ] Make unresolved essential findings block script approval or require an explicit recorded resolution. The current checks' free-text `resolution` alone is not a complete reference-availability gate.

### E. Localized narration repair and dependency precision

Four separately playable narration files exist, but they are currently one reviewed/approved deliverable. Per-beat regeneration and approval are not implemented; narration changes can conservatively reopen downstream visuals.

- [ ] Decide whether v1 retains whole-set approval or adds individual beat approvals plus a final four-beat sequence check.
- [ ] Regenerate only an affected beat when its script/clone dependencies permit; preserve valid stems and their evidence. Never speed up or clip speech to fit.
- [ ] Make narration/shot dependencies precise enough to show truthful localized rewind impact; retain broader invalidation when the full story arc or clone changes.
- [ ] Handle STT/listening disagreement as inconclusive with localized evidence. Existing independent STT transport made an observed word error; do not force the planned script into its output or pay to regenerate good speech solely because ASR disagrees.
- [ ] Verify active-speech timing and rate measurement policy, rather than treating whole-file words per minute including pauses as proof of natural delivery. Set thresholds through evidence, not arbitrary numbers.

### F. Chat operation and worker boundaries

Native crew tools are restricted and task/hash scoped; `present` and explicit human events exist. Broader app integration and other hosts' ambient permissions are separate from these verified boundaries.

- [ ] Rehearse ordinary chat feedback across stages: approval, complaint/change request, complete rejection, unrelated idea, pause, cancellation, and revisit. Ambiguous messages cannot advance a gate.
- [ ] Verify the operator adapter records the original human message and exact deliverable/task bindings. Store unrelated ideas without rewriting approved creative inputs.
- [ ] Decide the supported v1 host list and document/enforce its actual permissions. Codex has a real connection; another host's generic adapter contract is not a verified shipped host integration.
- [ ] Keep workers unable to read secrets, submit provider calls, write project state, or approve as the human. Audit any new tool against those existing limits.
- [ ] Decide the family-media lifecycle: local storage, external uploads, retention, export/delete, and clone deletion. Implement required behavior with visible scope; preserve essential qualification/audit evidence while it is still authorizing work.

### G. Documentation and package consistency

- [ ] Finish reconciling superseded “to be designed/not implemented” passages with current runtime stages. The main stage sequence and background/video summaries were corrected on October 2; retain older dated checkpoint limits as history and check the remaining tables/open questions.
- [ ] Refresh historical `proof.json` remaining-work summaries so completed connections are not mistaken for current gaps. Keep historical proof results identified by phase/date.
- [ ] Carry adopted changes through packaged instructions/contracts/requirements and distribution archive. Run appropriate offline regression, check, smoke, and clean-extraction checks; keep one renderer.
- [ ] Decide release support for Windows/Linux. Current native-install/recovery evidence is macOS; either verify additional platforms or state the support boundary clearly.

### H. Narration lock and distinct human choices — agreed October 2

- [x] Rename the design term to **narration lock** in this tracker and the living spec, and distinguish it from final mixed-audio review. Evidence: the October 2 decision entry and current stage sequence in the linked living spec.
- [ ] Carry the name through packaged user-facing tasks, messages, instructions and schemas. Handle existing `audioLocked` / `AUDIO_LOCK_REQUIRED` identifiers compatibly; naming changes must not reset checkpoints or weaken the gate.
- [x] Define human choices as approve, change a detail, redo the current deliverable from scratch, or abandon the project. Evidence: the living spec's Human response semantics table.
- [ ] Implement separate persisted detail-change/redo/abandon actions. Existing `changes` and `reject` both reopen authoring; abandonment is not implemented.
- [ ] Ensure redo preserves facts, immutable history, independent valid assets, budget and attempt consumption. Define any explicit allowance extension at the attempt ceiling rather than resetting it.
- [ ] Ensure abandonment stops new dispatch and paid submissions while tracking/reconciling already-started work. Deletion and refunds are separate, explicit matters. Test all choices across restart and stale user responses.

### I. Measurable visual review and invented-persona regression — agreed October 2

- [x] Define qualified visual review in the living spec: versioned rubric, actual perception, reference-bound measurements, held-out misses/false-rejections, and profile-specific evidence. This is a documented requirement, not completed qualification.
- [ ] Connect actual face/identity similarity against the appropriate approved character-sheet views, with method/hash/score evidence and calibrated thresholds. Stylized faces and different ages/views need explicit limits; an arbitrary score must not become approval.
- [ ] Connect measurable hand/anatomy/prop-contact and OCR/text-artifact checks. Report observed locations/timestamps, uncertainty and known blind spots; avoid false failures on scenes with no intended readable text.
- [ ] Extend criteria, qualification coverage, reviewer tools and retained evidence consistently. Decide whether qualified-review gates should cover all still-image stages as well as the current pre-video boundary.
- [ ] Build a fixed regression corpus of **invented personas**, good controls and planted traps: identity/age swaps, third hands, broken contact, changed geography, malformed text, short temporal defects, and stale/wrong references. Keep source/expected-trap provenance explicit; do not invent human adjudication.
- [ ] Run free deterministic regression on every pipeline change and report detection misses/false rejections/inconclusive results. Recorded model outputs must be labelled replay; fresh model-based media checks require an explicitly authorized bounded evaluation. Offline plumbing tests cannot certify fresh perception.
- [ ] Add a release/check command that fails on regressions without silently making paid calls or generating AI video. Preserve the separate real-media qualification requirement in section 2.

## 2. Deferred production-readiness work — needs real evidence/input

These can wait while section 1 progresses. They remain required before claiming trustworthy autonomous production review.

- [ ] **Speaker-comparison connection:** select and implement an actual comparison adapter, bind sample/stem hashes and exact model/tool profile, and retain measurements/limitations. SpeechBrain ECAPA-TDNN is only a researched candidate; it is not installed or qualified. A raw embedding score alone is not calibrated clone acceptance.
- [ ] **Voice calibration data:** obtain consented original/generated voice pairs and different-speaker negatives with genuine human identity judgements. Calibrate acceptance and uncertainty on development data; do not tune on holdout.
- [ ] **Ava audio qualification:** collect human-labelled actual usable/broken audio for integrity, transcript, natural rate, voice match, mix, and safety. Current gate requires at least two passing and two defective distinct held-out examples per criterion and zero prediction errors. Files may support multiple criteria, but repeated files cannot inflate coverage within a criterion. Keep source families/derivatives/references out of cross-split leakage.
- [ ] **Vera visual qualification:** collect human-labelled actual images/videos for anatomy, identity, and continuity, with independent reference media. Current gate requires at least two passing and two defective distinct held-out examples per image/video criterion and zero prediction errors. At 4 FPS, measure missed short-lived defects and false rejections explicitly.
- [ ] Freeze calibration/holdout splits; run genuinely independent worker predictions; save and verify actual evidence. Changing the model, rubric, or tool profile reopens qualification. These sample minimums are v1 gate policy, not statistical proof of universal reliability.
- [ ] Verify provider inference entitlement, available funds, and account-specific estimates. Authenticated metadata checks for Cartesia/Muse/Replicate/Gemini do not establish all of these.
- [ ] Perform separately authorized, staged real-media checks: ordinary-person clone/audition, four natural-rate narration beats, photo-grounded candidate/sheet, environment/angle, and composed keyframe. Review the outputs honestly; stop on failures. No AI video is authorized by this checklist.
- [ ] Rehearse production media presentation and exact human decisions with restart/recovery, once valid media and qualified reviewers exist. Synthetic player and receipt tests prove mechanics only.

The current seed dataset has 22 cases and no human-confirmed qualification labels. Transport probes and objective timing labels must not be relabelled as human ground truth.

## 3. Later validation — explicitly excluded from current work

- [ ] Obtain a separate explicit authorization before any real AI-video generation or end-to-end film proof.
- [ ] Once authorized, validate known-good/known-broken video review and bounded technical repair before presenting usable clips. Do not assume concise prompts, physical anchors, or short clips guarantee correct anatomy.
- [ ] Run the ordinary-person 60-second production film through the actual crew/providers and final human review. Check narrative fit, likeness, natural-rate voice, spatial continuity, motion, final sound, and output quality.
- [ ] Rehearse interruption/uncertain-provider recovery using the original job, without duplicate spend, and preserve unrelated assets through a confirmed localized revision.
- [ ] Inspect and deliver the actual finished artifact through the official Remotion path; finalization is private. Publish/share requires its own intended product decision.

## 4. Deferred or optional extras — not core blockers

- [ ] **Piano/music:** revisit source choice later. Generated ElevenLabs music/effects and licensed local imports have runtime paths; no live score-quality proof exists. A missing optional music key is not the current core blocker. Do not silently choose a library track or add a paid service.
- [ ] **Reusable backgrounds bank:** curate ordinary settings with appropriate rights/provenance only if it improves production. No bank is shipped; generic references never override the storyteller's known place.
- [ ] **LangSmith:** optional tracing/dataset integration. Local evaluators/export exist; hosted LangSmith is not implemented or required for the graph to work.
- [ ] **Wiggly app integration:** decide when to expose the packaged format in `/create`, `/builder`, and `/share`. The current deliverable is the agent-operated kit; an app UI is not part of the five-item readiness goal. Preserve surface boundaries and shared renderer parity if added.
- [ ] **Further automation:** reduce human decisions only after the v1 loop is reliable. Parallel fan-out, ComfyUI, Dots, additional model routes, and a separate worker framework are not prerequisites.

## Already implemented — do not rebuild

- LangGraph with durable SQLite state, exact-version approvals, dependency invalidation, and saved provider jobs.
- Audio-first visual guards; per-character designs/sheets; background owner → technical prompter → owner/independent review → human gates; reviewed compositions.
- Named crew and actual 15-worker Codex provisioning/dispatch with subscription-backed GPT-5.6 Sol; scoped tools and bounded dispatch/recovery.
- Selected Gemini 3.8 Flash actual audio/video connection, operator-selected 4 FPS; independent Cartesia Ink-Whisper STT. Transport verified, production quality unqualified.
- Video prompt/request authorization, qualified-review gates, evidenced repair routing, attempt limits, and uncertain-job reconciliation.
- Sound/import/edit/finalization mechanics; shared `RemotionAdScene → AdRenderSurface → memoir-film`, FFmpeg mixing, and technical inspection.
- Agent-passing chat presentation, four separate narration players, offline evaluation harness, and fresh-package mechanics checks. Latest committed connection checkpoint reports 113 passing source/package tests; that is not a real film proof.

## Recommended execution order and handoff

1. Implement H's agreed naming/feedback semantics, then decide and implement A (shot intentions), B (confirmed rewind), C (aggregate budget), and D (intake references).
2. Build I's review/regression foundation; resolve E's beat-level policy; complete F/G's relevant v1 operation and package work.
3. Return to section 2 qualification/provider/media evidence with Shaz. Keep failed or inconclusive reviews gated.
4. Seek separate authorization for section 3. Keep section 4 deferred unless explicitly prioritized.

Existing connected rehearsal: `/tmp/memoir-codex-live-v3-20261002`, sequence 7, script human gate, 15 workers, no media jobs, no voice sample or qualification artifacts as checked October 2. This is a rehearsal checkpoint, not the family's production story. Do not fabricate its approval to advance it. The older readiness goal is blocked on real evidence; documenting new work does not resume it or modify that checkpoint.
