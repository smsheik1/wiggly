# Memoir Film Live Rehearsal Plan & Audit Track

> **Living Operational Plan** | **Companion to:** [`docs/studio-spike-learnings-and-caveats.md`](file:///Users/shaz/Documents/wiggly/docs/studio-spike-learnings-and-caveats.md)  
> Tracks the 8 live rehearsal phases for producing the official Memoir Film under the SQLite-authoritative studio architecture. Zero synthetic mock data in production; strictly bounded allowances; verified independent reviews.

---

## Live Rehearsal Phase Matrix

| Phase | Milestone / Focus | Status | Primary Proof / Output |
|---|---|---|---|
| **Rehearsal 1** | **Preparation & Capability Checks** | **VERIFIED** | [`docs/proofs/memoir-live-rehearsal-capability.json`](file:///Users/shaz/Documents/wiggly/docs/proofs/memoir-live-rehearsal-capability.json) |
| **Rehearsal 2** | **Story & Narration** | *PENDING* | Kimi script review, voice audition, 4 clean narration beats |
| **Rehearsal 3** | **Character & Style** | *PENDING* | Character designs & approved sheets (late-teen look) |
| **Rehearsal 4** | **Storyboard** | *PENDING* | 4-beat shot plan, staging & continuity vs. narration |
| **Rehearsal 5** | **First Beat Visuals** | *PENDING* | Backgrounds, keyframes & moving footage for Beat 1 |
| **Rehearsal 6** | **Complete Film** | *PENDING* | Remaining visuals, audio mix, rendered 60s film |
| **Rehearsal 7** | **Revision & Recovery Test** | *PENDING* | "no AC" $\to$ "no air-conditioning" fine invalidation test |
| **Rehearsal 8** | **Evaluate & Deliver** | *PENDING* | Both films, cost/time ledger, revision analysis |

---

## Rehearsal Phase 1 Audit: Preparation & Capability Checks

### Objective
Connect provider tools and prove agents can inspect real multimodal assets (images, video, and audio) through the SQLite-authoritative perception pipeline without modifying saved production data or exceeding authorized budget caps.

### Executed Verification
- **Test Command:** `npm test` & `rehearsal-capability.ts run` in `v3/scripts/studio-spike/`
- **Authorized Cap:** \$0.20 (`200,000` micro-USD) explicitly approved by human operator via `capability-batch.json`
- **Actual Consumption:** \$0.00819 (`8,190` micro-USD) across 3 perception calls; 0 production media generation calls
- **Provider / Model:** Gemini (`gemini-3.8-flash`) via `gemini-review.mjs`

### Tested Media Capabilities & Observations
1. **Spatial Image Inspection:**
   - *Fixture:* Synthetic 320x180 image split vertically (red on left, blue on right).
   - *Observation:* Passed held-out control check. Verified left/right color field boundaries without prompt leaking.
   - *Trace:* Run `3f8a8564-d719-4d6f-9ef4-b299a898a3ab`.
2. **Temporal Video Motion Inspection:**
   - *Fixture:* 4-second 320x180 30fps video of a blue square moving from left to right.
   - *Observation:* Correctly detected starting left coordinate, stationary dwell, rightward translation, and final right-half positioning. Sampled at 4 FPS.
   - *Trace:* Run `f388a575-c37d-4abc-8a64-d6c2b2d83aca`.
3. **Spoken Audio Phrase Perception:**
   - *Fixture:* Synthetic 48kHz mono WAV spoken phrase ("The copper kettle is beside the window.") generated via macOS speech synthesis and FFmpeg.
   - *Observation:* Correctly transcribed exact phrase; verified absence of acoustic distortion.
   - *Trace:* Run `9fffe241-ff3d-4ac6-b943-87f429fe3c02`.

### Postmortems & Recoveries in Phase 1
- **LangSmith Tracing HTTP 404:**
  - *Failure:* The new `traceable` wrapper omitted explicit `tracingEnabled: true`, causing initial trace queries to fail.
  - *Fix:* Enforced explicit `tracingEnabled: true` in the harness wrapper.
  - *Recovery:* Implemented `recoverCapabilityTraces` to post-upload saved inspection receipts to LangSmith under labeled recovery runs without re-executing model perception or re-billing API quotas. Original failure receipt preserved.
- **Safety & Baseline Preservation:**
  - All 313 saved production files preserved identical hashes (`assertPreserved`).
  - Project paused on completion (`paused: true`). Remaining capability allowance does not permit production generation.

---

## Next Up: Rehearsal Phase 2 — Story & Narration

1. **Review Selected Kimi Script:** Authoritatively evaluate against story intentions and intake answers.
2. **Audition Existing Voice Clone:** Run voice clone matching against reference samples.
3. **Produce 4 Narration Beats:** Generate and inspect the 4 audio narration segments with strict duration constraints.
4. **Director Checkpoint:** Pass to manual director review before proceeding to visual character design.
