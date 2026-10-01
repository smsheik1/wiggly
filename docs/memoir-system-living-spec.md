# Personal Animated Memoir — Living System Spec

Status: design in progress; not an implementation claim.  
Last updated: October 1, 2026.  
Scope: the packaged, semi-autonomous workflow through script approval and audio lock. Visual production will be designed next.

## Purpose

Help a parent, grandparent, or spouse turn authentic memories into a theatrical, 60-second, stylized 3D animated short for someone they love. The recipient should feel more connected to the storyteller and understand their life better because the story is told in their own voice.

The intended finished film is 16:9 widescreen, with cinematic lighting and an acoustic piano score. Its emotional truth matters more than spectacle.

We are designing this system from the ground up. The existing Eminem run, five-chapter structure, prompts, provider wrappers, and implementation choices are not design constraints or proof of this system. Existing project rules still govern any later code integration unless explicitly changed.

## How to use this document

- Keep agreed decisions separate from proposals and open questions.
- Update this file as we brainstorm; do not create competing versions of the operating spec.
- A brainstorm is not approval to change a locked production deliverable or implement code.
- Record consequential decisions in the decision log, with their reason.
- Distinguish design intent, implemented behavior, and verified behavior. This document currently describes design intent.

## Agreed decisions

1. Version 1 has **four 15-second beats, totaling 60 seconds**. Future durations may change; the modular beat structure remains.
2. The system supplies a questionnaire and uses the answers to write an intimate narrative for the named recipient.
3. Every deliverable passes agent review before presentation for user approval.
4. Only explicit user approval of the exact deliverable version advances its stage.
5. Revision requests and complaints remain in the current deliverable's loop. Complete rejection returns to its authoring stage without silently discarding the source memories.
6. An orchestrator keeps persistent project state and controls legal stage transitions.
7. The voice must be the storyteller's approved clone. A stock voice is not an acceptable substitute.
8. Gemini 3.8 Flash TTS voice replication is preferred. Cartesia cloning is an explicit alternative; provider changes are visible decisions, never silent fallbacks.
9. **Audio lock is required before any image or video generation, including character sheets and storyboards.**
10. Narration stays at natural speed. Never accelerate, time-compress, truncate spoken words, or silently rewrite approved copy to make it fit.
11. Audio review combines measurements and direct listening; neither replaces the other.
12. User review presents four separately playable audio files with the corresponding script beats in an ordered list.

## Roles and authority

| Role | Responsibility | Authority limit |
| --- | --- | --- |
| Orchestrator | Maintain state, dispatch work, preserve context, route feedback, enforce gates, and report the next decision. | Cannot approve on the user's behalf or treat casual conversation as a stage transition. |
| Script writer | Convert authentic answers into four coherent emotional beats; revise against specific feedback. | Cannot invent personal memories as facts or change an approved script silently. |
| Narrative reviewer | Check factual grounding, emotional connection, relationship/POV consistency, clarity, and timing feasibility. | Approval permits user presentation; it does not lock the script. |
| Voice/audio producer | Validate recordings, create the selected provider's clone, and synthesize approved narration. | Cannot substitute a preset voice or accelerate narration. |
| Audio reviewer | Run measurable checks, directly listen, compare against the approved voice reference, and report localized findings. | Missing evidence yields an inconclusive review, never a fabricated pass. |
| User | Supply memories and recordings; approve, request changes, or reject each deliverable. | Can explicitly redirect or revisit a stage; affected approvals must then be invalidated visibly. |

These are responsibility boundaries. Whether each role needs a separate running agent is an implementation question, not a requirement to build a large agent framework.

## Stage sequence

```text
Questionnaire and follow-up intake
  → script writing ↔ narrative review
  → user script review ↔ revision
  → script lock
  → voice sample validation and clone creation
  → clone review and user audition approval
  → four narration beats ↔ audio review and repair
  → user audio review ↔ revision
  → AUDIO LOCK
  → visual production (to be designed)
```

At every review, the outcome is approved, changes requested, rejected, or inconclusive. Provider failures and missing requirements are blockers, not creative rejection or permission to advance.

## 1. Questionnaire and narrative

Collect the storyteller, recipient, relationship, memories, emotional intent, and any boundaries on what to include. Accept raw spoken memories as well as written answers. The questions and their number are still to be designed; four beats do not require exactly four questions.

Preserve the original answers and any transcripts. Ask focused follow-up questions where a meaningful detail is missing. The writer can shape the language but must not manufacture biographical claims.

The script deliverable contains four ordered beats, their narration text, emotional purpose, and a timing estimate. Narrative review rejects unsupported memories, inconsistent direct address, generic emotional filler, confusing transitions, or copy unlikely to fit naturally.

Rejected drafts return to the writer with specific reasons. Reviewer-approved drafts go to the user. User changes return to the writer and then pass review again. Approved script versions are locked and retained.

## 2. Voice clone

After script lock, collect a clean voice recording from the storyteller and any consent recording required by the selected provider. Validate actual media duration and quality, rather than trusting user-supplied metadata.

Create the clone and retain the provider, model, voice identifier, source recording reference, and creation receipt. Generate an audition for review and user approval before producing the complete narration. The user's judgment of whether it sounds like them remains essential.

Provider requirements verified October 1, 2026:

- **Gemini:** 10–30 seconds of natural reference speech plus a separate consent recording from the same adult speaker. See [Google voice replication requirements](https://ai.google.dev/gemini-api/docs/voice-replication).
- **Cartesia:** 10 seconds is enough to start; Sonic 3.6 and newer accept up to 60 seconds for improved accent retention. See [Cartesia instant voice cloning](https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices).

Requirements must be rechecked when implementing. These providers have separate voice IDs; a clone cannot be assumed portable between them. A celebrity test is not evidence that the ordinary storyteller's recording and consent flow works.

## 3. Four narration beats

Generate each beat from its locked script text using the approved clone. Preserve the raw generated audio and measured speech duration. Each final beat occupies a 15-second timeline window, including deliberate pauses and reaction space; it need not contain 15 seconds of continuous speech.

If speech cannot fit naturally, return the affected text to the writer, repeat narrative and user approval, then regenerate the affected audio. Delivery problems can be repaired through synthesis settings without changing the words, but still require audio review and user approval.

Intentional holds are recorded explicitly. Avoid padding every beat with arbitrary dead air. The final composition must preserve the approved narration timing; visual transitions must not inadvertently shorten the 60-second timeline.

## 4. Audio review: measure, then listen

Review each beat and the combined four-beat listening sequence. Reports identify the exact file/version, method, measured values, finding timestamps, verdict, and proposed repair.

| Check | Evidence and method | Interpretation |
| --- | --- | --- |
| File integrity and duration | FFprobe stream/container data plus a decode check. | Detect missing, corrupt, empty, or unexpected audio and measure actual duration. |
| Silence and pauses | FFmpeg `silencedetect` and/or voice activity detection, compared with the intended hold plan. | Detect excessive gaps, unintended silence, and insufficient room for complete speech. Silence can be intentional. |
| Script fidelity | Speech-to-text with timestamps; normalized diff against the locked narration. | Flag omitted, inserted, repeated, or substituted words. Inspect uncertain recognition and pronunciation rather than automatically blaming synthesis. |
| Speaking rate | Timestamped words and speech intervals; compare pause-aware rate with the approved audition/reference. | Flag rushed delivery and rate anomalies. Rate alone does not prove time compression; production provenance must also prohibit acceleration. |
| Speaker similarity | Speaker embeddings scored against the storyteller recording and approved clone audition. | Detect identity drift using a calibrated scorer. A score supports review; it is not a universal proof of identity or clone quality. |
| Signal quality | Decode, clipping/peak, loudness, and discontinuity measurements. | Catch broken audio, distortion, and abrupt changes. Exact gates remain to be calibrated. |
| Direct listening | Audio-capable reviewer hears the generated file and source/audition references. | Check glitches, garbled delivery, unnatural prosody, pronunciation, emotional fit, and applicable safety issues. |

Technical distinction: [FFprobe](https://ffmpeg.org/ffprobe.html) supplies media properties; [FFmpeg's silence filter](https://ffmpeg.org/ffmpeg-filters.html#silencedetect) detects silence. A transcript, waveform, player control, or provider success receipt does not substitute for hearing the audio.

Thresholds and scorer choices remain open. Calibrate them on ordinary speakers and varied accents, with known acceptable and defective examples. Do not invent a similarity threshold or claim an untested metric is definitive.

An agent-rejected beat is repaired and reviewed again. An inconclusive check stays pending. Agent-approved beats are shown to the user as four audio players beside their script text. User feedback is tied to specific beats where possible. Audio lock requires every current beat to pass review and explicit user approval.

## Orchestrator state and conversation discipline

The authoritative state lives in a project record on disk or in the selected persistence system, not solely in agent memory. Save after every meaningful event and before waiting on an external job.

Minimum information:

- Project ID, format/spec version, storyteller, recipient, relationship, and source inputs.
- Current stage, current deliverable version, and pending action or user decision.
- Exact script versions, clone/provider IDs, media paths/hashes, and timing plans.
- Reviewer reports and user decisions bound to exact artifact versions.
- Attempt history, provider job IDs, spend/budget, blockers, and next allowed action.
- Revision requests, deferred ideas, and invalidated downstream approvals.

Use explicit events such as `scriptSubmittedForReview`, `scriptChangesRequested`, `scriptApprovedByUser`, `cloneApprovedByUser`, `beatAudioRejected`, and `audioLocked`. This is a conceptual contract, not a commitment to a particular state-machine library.

On resume, read state, summarize the current deliverable and pending decision, and continue that stage. Resume saved provider jobs instead of submitting duplicates after a local interruption.

For unrelated messages, acknowledge and save the idea, then return to the pending deliverable. Do not ignore an explicit user pause, cancellation, or request to revisit an earlier stage. Ambiguous comments are not approval. The system keeps the user oriented without trapping them in a workflow.

## Approval invalidation and retry discipline

- Script edits invalidate affected narration and audio lock. Narrative changes that alter the full arc require full script review again.
- Replacing the clone invalidates all narration approvals and audio lock.
- Replacing an audio file invalidates that file's review and user approval, and requires renewed sequence review before lock.
- Later visual work depends on the exact audio lock; reopening it must visibly invalidate affected downstream work.
- Preserve previous versions; do not overwrite evidence or silently carry approvals across revisions.
- Remain in the stage until approved, but cap autonomous attempts and spending. At the limit, report the blocker and wait for direction; never advance because the loop is exhausted.
- External API failures stop affected production with clear diagnostics. No silent provider substitutions, invented outputs, or real-run gate bypasses.

## Package expectations

The eventual package includes one canonical operator manual, an official runner, validated input/output/state contracts, explicit provider requirements, a free offline smoke test, and reviewable run evidence. A fresh agent must be able to resume it without the user explaining the process again.

Before claiming this design works, prove: script revision cannot skip approvals; interrupted runs resume correctly; unrelated conversation cannot advance state; all four audio beats are measured and heard; script/voice edits invalidate dependent approvals; and image/video generation is blocked before audio lock. Include a real ordinary-person proof, not only a celebrity fixture.

## Open questions and next discussions

- What questionnaire reliably produces four meaningful beats without forcing every life into the same arc?
- What narrative rubric and timing budget preserve intimate natural speech?
- Which speech-to-text, speaker-similarity, and audio-listening systems have verified capabilities for this workflow?
- What measured thresholds, retry ceiling, and spending limit should apply?
- Should users approve narration beat by beat, approve the full set, or have both options?
- What voice audition best exposes identity and delivery problems?
- When and how is the piano score introduced and approved? Narration lock and final mixed-audio review may be separate gates.
- How do character references, scene plans, animation, and final audiovisual review follow audio lock?
- What interface and storage make the package portable without overbuilding the orchestrator?

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-10-01 | Design a new system independently of the current run. | Existing work should not dictate a flawed workflow. |
| 2026-10-01 | Four 15-second beats for v1. | A 60-second story with modular production units. |
| 2026-10-01 | Require agent review and user approval at each deliverable. | Semi-autonomous production with explicit creative ownership. |
| 2026-10-01 | Require audio lock before all image/video generation. | Establish story, voice, and timing before spending on visuals. |
| 2026-10-01 | Combine objective audio checks with direct listening. | Detect measurable defects while retaining judgment of sound and emotional fit. |

## Implementation and evidence status

Design captured. No new production implementation, paid generation, or validation proof has been completed under this specification. Future updates should record what was implemented, what was tested, and what remains uncertain here.
