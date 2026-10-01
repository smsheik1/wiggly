# Personal Animated Memoir — Living System Spec

Status: design in progress; not an implementation claim.  
Last updated: October 1, 2026.  
Scope: the packaged, semi-autonomous workflow through script approval, audio lock, and character design lock. Background development follows; its detailed workflow and later production stages remain to be designed.

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
- This file is the master system spec and single source of truth for the new workflow. Technical prompt templates may support it, but must not introduce competing stage order, approval rules, or timing constraints.
- Mark conflicts with new source material as explicit comparisons, not automatic rejection. Explain where the alternative might be better and what evidence or decision would resolve it. Agreed choices are revisable through a recorded decision; active run state and approvals must never change silently.

## Agreed decisions

1. Version 1 has **four 15-second beats, totaling 60 seconds**. Future durations may change; the modular beat structure remains.
2. The system supplies a questionnaire and uses the answers to write an intimate narrative for the named recipient.
3. Every deliverable passes agent review before presentation for user approval.
4. Only explicit user approval of the exact deliverable version advances its stage.
5. Revision requests and complaints remain in the current deliverable's loop. Complete rejection returns to its authoring stage without silently discarding the source memories.
6. An orchestrator keeps persistent project state and controls legal stage transitions.
7. The voice must be the storyteller's approved clone. A stock voice is not an acceptable substitute.
8. **Cartesia voice cloning and narration are the default.** Gemini 3.8 Flash TTS is an optional path only when the user explicitly requests it; their agent must establish its requirements and support. Provider changes are visible decisions, never silent fallbacks, and cannot bypass or reset project state.
9. **Audio lock is required before any image or video generation, including character sheets and storyboards.**
10. Narration stays at natural speed. Never accelerate, time-compress, truncate spoken words, or silently rewrite approved copy to make it fit.
11. Audio review combines measurements and direct listening; neither replaces the other.
12. User review presents four separately playable audio files with the corresponding script beats in an ordered list.
13. After audio lock, establish the story's character roster. Every important character needs an individually approved design and standardized character sheet; an approved sheet for one character cannot unlock another.
14. Use Muse Image to generate **three design candidates per character by default**, anchored to authentic references. The agent reviews them and the user chooses and approves one before sheet production.
15. Build each character sheet from the selected character image plus the standardized Markdown prompt recipe: four full-body turnaround views and eight expressions. Pass the actual selected image to generation; text references to an unseen image do not count.
16. **All required character sheets must pass agent review and user approval before background development begins.** No omitted characters, placeholder sheets, or real-run bypasses.

## Roles and authority

| Role | Responsibility | Authority limit |
| --- | --- | --- |
| Orchestrator | Maintain state, dispatch work, preserve context, route feedback, enforce gates, and report the next decision. | Cannot approve on the user's behalf or treat casual conversation as a stage transition. |
| Script writer | Convert authentic answers into four coherent emotional beats; revise against specific feedback. | Cannot invent personal memories as facts or change an approved script silently. |
| Narrative reviewer | Check factual grounding, emotional connection, relationship/POV consistency, clarity, and timing feasibility. | Approval permits user presentation; it does not lock the script. |
| Voice/audio producer | Validate recordings, create the selected provider's clone, and synthesize approved narration. | Cannot substitute a preset voice or accelerate narration. |
| Audio reviewer | Run measurable checks, directly listen, compare against the approved voice reference, and report localized findings. | Missing evidence yields an inconclusive review, never a fabricated pass. |
| Character designer / prompt author | Establish the roster, translate real references into stylized designs, and compile full sheet prompts from the selected images and standard recipe. | Cannot pick for the user, invent identity traits, or substitute text-only grounding for required image references. |
| Visual reviewer | Inspect candidate designs and completed sheets for identity, style, anatomy, layout completeness, and consistency. | Approval is specific to the character and artifact version; cannot stand in for user approval. |
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
  → character roster establishment and user confirmation
  → for EACH required character:
      three design candidates ↔ agent review
      → user selection and design approval ↔ revision
      → sheet prompt compilation and review
      → reference-grounded sheet generation ↔ agent review
      → user sheet approval ↔ revision
  → CHARACTER DESIGN LOCK (all required characters complete)
  → background development (details to be designed)
  → scene composition, animation, and final review (to be designed)
```

At every review, the outcome is approved, changes requested, rejected, or inconclusive. Provider failures and missing requirements are blockers, not creative rejection or permission to advance.

## 1. Questionnaire and narrative

Collect the storyteller, recipient, relationship, memories, emotional intent, and any boundaries on what to include. Accept raw spoken memories as well as written answers. The questions and their number are still to be designed; four beats do not require exactly four questions.

Preserve the original answers and any transcripts. Ask focused follow-up questions where a meaningful detail is missing. The writer can shape the language but must not manufacture biographical claims.

The script deliverable contains four ordered beats, their narration text, emotional purpose, and a timing estimate. Narrative review rejects unsupported memories, inconsistent direct address, generic emotional filler, confusing transitions, or copy unlikely to fit naturally.

Rejected drafts return to the writer with specific reasons. Reviewer-approved drafts go to the user. User changes return to the writer and then pass review again. Approved script versions are locked and retained.

## 2. Voice clone

After script lock, collect a clean voice recording from the storyteller and any consent recording required by the selected provider. Use Cartesia by default. Validate actual media duration and quality, rather than trusting user-supplied metadata.

Create the clone and retain the provider, model, voice identifier, source recording reference, and creation receipt. Generate an audition for review and user approval before producing the complete narration. The user's judgment of whether it sounds like them remains essential.

Provider requirements verified October 1, 2026:

- **Cartesia (default):** 10 seconds is enough to start; Sonic 3.6 and newer accept up to 60 seconds for improved accent retention. See [Cartesia instant voice cloning](https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices).
- **Gemini (user-requested only):** The requesting user's agent must verify access, implement the optional path, and meet its recording/consent requirements through the same clone and audio gates. The current docs specify 10–30 seconds of reference speech plus a separate consent recording from the same adult speaker. See [Google voice replication requirements](https://ai.google.dev/gemini-api/docs/voice-replication). Mentioning this option alone does not approve a provider switch.

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

## 5. Establish the character roster

This stage begins only after audio lock. Identify the important characters who will appear in the approved story, including supporting loved ones, not just the narrator. Confirm the roster with the user before generating designs. For each character, record a stable ID, name, story role, relevant beats, required age/appearance variants, available real-life reference photos, and any unresolved identity details.

Every important character requires their own design and sheet workflow. Decide explicitly whether incidental background figures need individual identity assets; do not label an important person incidental to skip the gate. Missing references stay unresolved and prompt a focused request rather than invented likeness. A reference to a character in narration does not automatically mean they must appear on screen; planned appearances belong in the roster.

The roster is the completeness checklist. An unapproved addition blocks character design lock; removal requires an explicit roster revision, not deletion to make a check pass. How to handle age variants across a lifetime remains an open design question, and must be resolved for a run before affected scenes proceed.

## 6. Choose each character's design

For each required character, translate their authentic reference photo(s) into the shared Pixar-style feature-animation aesthetic using Muse Image. Generate **three separate candidates** as the default comparison batch, with consistent identity requirements and controlled visual variation. Keep full-body design readable where possible so the selected reference supports later turnaround production.

The agent inspects every candidate against the real references for recognizable likeness, appropriate age and proportions, anatomy, and style. Failed candidates are marked and repaired within the image budget; they are not offered as approved options merely because generation succeeded. Display the acceptable candidates side by side with stable IDs and brief differences. The user selects and explicitly approves the preferred design; an agent recommendation or the first generated file is not a selection.

If the user dislikes the options, record the specific feedback and produce a bounded revised batch. Three is the default, not a lifetime attempt cap. Additional cheap image iteration is reasonable within the declared budget, especially before expensive video, but never becomes an unbounded spend loop.

Muse Image's published direct API price is **$0.01/image** as checked October 1, 2026: three candidates cost about $0.03 per character; one sheet adds about $0.01, for about $0.04 before retries, additional references, or other services. Record actual usage and recheck pricing when operating. See [Meta's Muse Image guide](https://dev.meta.ai/resources/blog/build-with-muse-Image).

## 7. Compile and generate the standardized character sheet

Reproduce the human workflow explicitly: **standard Markdown recipe + approved character image + character identity → complete character-sheet prompt → prompt review → prompt and actual reference image sent to Muse → sheet review → user approval**.

The prompt author reads the selected image as well as the recipe. It produces a complete, character-specific prompt, not fragments or “same as above.” Review verifies that the prompt preserves the selected identity, fills every required slot, and requests the complete sheet. A rejected prompt returns to its author before image generation. The approved prompt and selected image version are saved as the sheet's dependencies.

Sheet standard:

- Four full-body turnaround views: front, three-quarter front, side profile, and back. Entire figures including feet remain visible, with matching scale, proportions, wardrobe, and baseline.
- Eight head-and-shoulders expressions: neutral, happy, delighted, sad, surprised, confused, determined, and talking, arranged in two rows of four beneath the turnaround row.
- Clean neutral-grey studio background, even lighting, consistent stylized materials, and empty hands in the turnaround poses. No cropped bodies, missing panels, duplicate views substituted for required angles, or inconsistent character identities.
- All expressions remain the same person as the selected design; expressions change acting, not facial identity or age. Proportions suit the character's age rather than applying a generic adult template to children.

The existing `PIXAR-PROMPTER.md` character contract is reference material for the technical recipe, not an authority over this new workflow's four-beat timing or audio-first stage order. The supplied sheet example and tutorial prompt pack confirm the four-angle turnaround above two rows of four expressions. Package a scoped, versioned sheet recipe before implementation and register its path/version in this master spec rather than importing the old production workflow wholesale. The tutorial's inline sheet template is now available, but its linked `dan-kiefts-pixar-prompter-4.md` and the screenshot's `dan-kiefts-pixar-prompter (3) copy.md` have not been compared. The pack requests ANGRY as expression seven; this draft currently specifies DETERMINED. Resolve that mismatch explicitly before freezing the recipe.

The selected design may use an expressive full-body pose; the sheet translates it into neutral turnaround poses while preserving identity. These are layout requirements, not a requirement to package the illustrative images shown in this conversation.

Generate the sheet with the **actual approved character image supplied as reference input**. A prompt saying “match Mia” or “use the selected image” without sending that image is invalid. Resolve the reference through its character ID and approved version, never through an arbitrary approved sheet or guessed filename.

The visual reviewer inspects the actual output for all required views and expressions, identity fidelity, consistent scale and materials, anatomy, and layout. Rejections record localized defects and return to prompt revision or sheet regeneration as appropriate. Approved sheets are displayed to the user, who can approve, request changes, or reject. The user must approve the sheet separately from the original design choice.

Lock character design only when **every current required character/variant** has a selected design, reviewed sheet prompt, completed sheet, passing agent review, and explicit user approval tied to its exact file version. Recheck completeness from the current roster; do not infer it from a total image count.

## 8. Background development boundary

Background development unlocks only after character design lock, which itself depends on current audio lock. Establish the settings needed by the approved story and their relationship to the four beats next. Background candidate counts, layout rules, and detailed review criteria are still to be decided. The same agent-review/user-approval pattern applies; scene composition and video remain pending their own defined gates.

## Orchestrator state and conversation discipline

The authoritative state lives in a project record on disk or in the selected persistence system, not solely in agent memory. Save after every meaningful event and before waiting on an external job.

Minimum information:

- Project ID, format/spec version, storyteller, recipient, relationship, and source inputs.
- Current stage, current deliverable version, and pending action or user decision.
- Exact script versions, clone/provider IDs, media paths/hashes, and timing plans.
- Confirmed character roster/version; per-character references, required variants, candidate IDs, selected design/version, sheet prompt/recipe version, sheet file/version, and both review and user approval status.
- Current audio-lock and character-design-lock dependency versions, plus background-stage eligibility.
- Reviewer reports and user decisions bound to exact artifact versions.
- Attempt history, provider job IDs, spend/budget, blockers, and next allowed action.
- Revision requests, deferred ideas, and invalidated downstream approvals.

Use explicit events such as `scriptSubmittedForReview`, `scriptChangesRequested`, `scriptApprovedByUser`, `cloneApprovedByUser`, `beatAudioRejected`, and `audioLocked`. This is a conceptual contract, not a commitment to a particular state-machine library.

Character events include `characterRosterConfirmed`, `characterCandidatesGenerated`, `characterDesignSelected`, `characterDesignApprovedByUser`, `characterSheetPromptReviewed`, `characterSheetRejected`, `characterSheetApprovedByUser`, and `characterDesignLocked`. Selection and approval are distinct decisions unless the user's action explicitly expresses both. Track each character's pending action separately; no project-level “images ready” status can replace per-character completion.

Bind worker results to the input and artifact versions used when dispatching. A delayed review of an older design or script cannot approve its replacement. Persist generation jobs, reference dependencies, and attempt IDs before waiting; on resume, recover the same work rather than duplicating charges. Derive stage eligibility from current dependencies, not the most recent chat message.

On resume, read state, summarize the current deliverable and pending decision, and continue that stage. Resume saved provider jobs instead of submitting duplicates after a local interruption.

For unrelated messages, acknowledge and save the idea, then return to the pending deliverable. Do not ignore an explicit user pause, cancellation, or request to revisit an earlier stage. Ambiguous comments are not approval. The system keeps the user oriented without trapping them in a workflow.

## Approval invalidation and retry discipline

- Script edits invalidate affected narration and audio lock. Narrative changes that alter the full arc require full script review again.
- Replacing the clone invalidates all narration approvals and audio lock.
- Replacing an audio file invalidates that file's review and user approval, and requires renewed sequence review before lock.
- Later visual work depends on the exact audio lock; reopening it must visibly invalidate affected downstream work.
- Switching voice providers reopens clone and audio approval through the existing project record; it never creates a clean state that bypasses earlier requirements.
- Selecting a replacement character design invalidates that character's sheet prompt, sheet approvals, and character design lock; affected downstream backgrounds/compositions become stale for review. Preserve independent approved assets when still valid, with explicit dependency evaluation.
- Revising the roster invalidates character design lock until every current required character/variant is complete. A newly added character cannot inherit another character's approval.
- Replacing a sheet or its prompt/reference recipe invalidates the affected sheet review and downstream dependencies. Record an explicit re-review when a change is judged not to affect an existing asset; never silently transfer approval.
- Preserve previous versions; do not overwrite evidence or silently carry approvals across revisions.
- Remain in the stage until approved, but cap autonomous attempts and spending. At the limit, report the blocker and wait for direction; never advance because the loop is exhausted.
- External API failures stop affected production with clear diagnostics. No silent provider substitutions, invented outputs, or real-run gate bypasses.

## Package expectations

The eventual package includes one canonical operator manual, an official runner, validated input/output/state contracts, explicit provider requirements, a free offline smoke test, and reviewable run evidence. A fresh agent must be able to resume it without the user explaining the process again.

Before claiming this design works, prove: script revision cannot skip approvals; interrupted runs resume correctly; unrelated conversation cannot advance state; all four audio beats are measured and heard; script/voice edits invalidate dependent approvals; and image/video generation is blocked before audio lock. Prove that generated sheet requests contain the correct selected image, another character's approval cannot unlock production, stale reviews cannot approve replacements, and backgrounds stay blocked until the complete current roster has agent- and user-approved sheets. Include a real ordinary-person proof, not only a celebrity fixture.

## Open questions and next discussions

- What questionnaire reliably produces four meaningful beats without forcing every life into the same arc?
- What narrative rubric and timing budget preserve intimate natural speech?
- Which speech-to-text, speaker-similarity, and audio-listening systems have verified capabilities for this workflow?
- What measured thresholds, retry ceiling, and spending limit should apply?
- Should users approve narration beat by beat, approve the full set, or have both options?
- What voice audition best exposes identity and delivery problems?
- When and how is the piano score introduced and approved? Narration lock and final mixed-audio review may be separate gates.
- Where will the scoped character-sheet Markdown recipe live in the eventual package, and how does it compare with the actual source recipe?
- Does each materially different age require its own selected design and sheet, and how do we preserve identity across those variants?
- What references suffice for supporting loved ones, and what is the explicit rule for incidental extras?
- What background design and approval workflow follows character design lock?
- How do scene plans, animation, and final audiovisual review follow approved characters and backgrounds?
- What interface and storage make the package portable without overbuilding the orchestrator?
- Should expression seven match the tutorial's ANGRY, or remain DETERMINED? These are different expressions, not interchangeable labels.

## Additional system decisions to brainstorm

The following are proposed improvements, not accepted defaults or implementation approval. Their priority reflects current design judgment, not measured production evidence.

| Decision | Proposed direction | Why it matters / what to evaluate |
| --- | --- | --- |
| Emotional target before writing | Ask what the recipient should understand about the storyteller after watching; agree on one central emotional idea. | Four life milestones can become a compressed biography. Test whether one coherent message produces a more personal film without forcing a tearjerker or invented vulnerability. |
| How much the writer may polish the speaker | Preserve characteristic phrasing, humor, and direct quotes from memories while trimming for clarity. Let users compare a representative source passage with the adaptation. | A convincing clone reading generic polished prose can still feel unlike the person. Review verbal identity as well as acoustic identity. |
| Narrator voice versus on-screen dialogue | Consider single-speaker narration over acted memories for v1; evaluate dialogue/lip-sync as a separate option. | Decide whether a character's mouth should match narration at all. Off-screen narration may simplify production; performed dialogue may deepen connection but adds voices and synchronization requirements. |
| Beat length versus shot length | Keep four 15-second narrative windows while evaluating multiple shorter shots within each. | A beat is an editorial unit, not necessarily a provider job. Compare emotional pacing and modular repair cost against the complexity of maintaining continuity across shots. |
| Early feasibility without early visual spend | Gather available photos and flag ages, supporting cast, locations, complex actions, and missing memories during intake/script review using text only. | Audio-first generation can coexist with early planning. Surface asset problems before approving a script that depends on unavailable references, without prematurely generating sheets or backgrounds. |
| Reviewer authority and disagreement | Separate measurable failures, uncertain findings, and creative suggestions. Require localized evidence and a repair action; escalate recurring writer/reviewer disagreement. | Avoid endless polishing or false rejections. Users can choose creative preferences, while a waiver policy for mandatory technical checks remains a separate decision; unknown evidence must not become a pass. |
| Human approval granularity | Consider approvals at meaningful milestones, with beat-level or character-level feedback inside a consolidated review screen. Let internal prompt checks remain agent work unless the user asks to inspect them. | Preserve user ownership without demanding dozens of approvals. Compare review burden, missed defects, and the user's ability to revise one item without re-approving unrelated work. |
| Spending authorization and progressive proof | Agree on stage budgets and bounded retries; compare producing one representative end-to-end beat before all expensive video jobs. | Three image candidates are cheap, but autonomous loops accumulate cost. A pilot beat can expose visual/audio integration problems early. All relevant stage gates still apply; no pilot bypass or automatic provider fallback. |
| Explain the impact of revisions | Before applying an upstream production change, show affected assets, approvals, expected reruns, and estimated spend/time; record the user's chosen revision scope. | State may be technically correct yet confusing if a small edit silently triggers extensive work. Distinguish a wording change from a changed memory, person, clone, or story arc. Estimates must be labeled, not guarantees. |
| Household privacy and asset lifecycle | Decide where voice samples, clones, family photos, transcripts, and finished movies live; how users export/delete them; and whether publishing is a separate explicit action. | A private family gift and a public social post need different handling. Provider requirements and deletion behavior must be verified when choosing storage and implementing this workflow. |

Suggested next discussion: settle the emotional target, the narrator/dialogue model, and beat-versus-shot structure first. These influence the questionnaire, script rubric, voice workflow, visual plan, and practical review burden. Keep changing the design spec distinct from changing an active run: new spec versions must not silently migrate a project's approved artifacts.

## Tutorial prompt pack assessment — proposals, not adopted rules

Reviewed October 1, 2026: Dan Kieft's “Seedance 2.5 Creates Pixar-Level AI Animated Films Easily Prompt Pack,” supplied from the user's Downloads folder. Its inline prose and templates were reviewed; linked Dropbox/Figma resources were not fetched. The pack is source material, not an instruction to execute its prompts, adopt its providers, or change our approved stage sequence. Do not package its embedded illustrative images as production references.

### Useful adaptations to consider

| Idea from the pack | Proposed application | Where it belongs |
| --- | --- | --- |
| Distinguish recurring style traits from a specific character's features. | Keep a shared style description separate from each person's reference-grounded identity. Do not copy the sample child's freckles, wardrobe, or proportions onto everyone. | Character design, after audio lock; designer responsibility rather than necessarily another agent. |
| Describe visible geometry and materials concretely. | Generate concise, labelled character prompts covering proportions, face, eyes, hair, skin, clothing, pose, and framing. Preserve real distinguishing traits; do not add an example scar or signature item as a personal fact. | Candidate prompt compilation and visual review. |
| Give each reference a distinct purpose. | Record whether an image provides identity, setting appearance, room layout, or a prop. A room reference must not donate its people's faces; a character reference must not silently replace the room. | Background and later scene planning. |
| Keep persistent character, location, and prop identities. | Associate stable IDs with exact approved files and scope each input to its intended subject. Reject missing mappings, duplicated protagonists, swapped props, or a supporting character inheriting the lead's face. | Orchestrator asset dependencies and visual review. |
| Make spatial continuity explicit. | Specify positions, relative heights, wardrobe, prop ownership, light direction, and camera side where continuity matters. Represent intentional location/time changes explicitly. | Background-to-scene handoff; detailed stage still pending. |
| Structure motion around a readable objective and physical action. | Describe what the character wants, the visible action or reaction, and intentional timing. Review moving holds, breathing, blinks, arcs, anticipation, settling, cloth/hair follow-through, and foot contact in actual video. | Later performance planning and motion review. |
| Separate references, goal, continuity, shots, performance, and audio instructions. | Compile a complete provider-specific prompt from approved state instead of accumulating contradictory chat edits. The delivered artifact remains a four-beat story even if later shot design subdivides a beat. | Later scene/video prompt authoring; shot count is not decided yet. |
| Specify precisely where a segment ends. | Give each future visual beat an end condition and a handoff to the next; reject added endings, unauthorized dialogue, or story actions outside its approved scope. | Later video planning and final review. |

Reference labels such as `@Mia` are naming conventions, not proof that a provider received an image. The eventual runner must resolve labels to actual supported media inputs and save that mapping with the request.

### Conflicts and alternatives to evaluate

These are design comparisons, not a declaration that our current approach is better. Preserve the current agreed behavior while evaluating alternatives; a decision to adopt one must identify the spec change and its effect on active project state.

| Topic | Current spec | Tutorial approach | Why the alternative might help / how to resolve |
| --- | --- | --- | --- |
| Production order | User-approved narration lock before any generated visual asset. | The shown workflow develops character images/sheets before video; it does not demonstrate our separate audio-lock gate. | Early visual exploration may reveal emotional tone or staging opportunities before the script is fixed. Compare that benefit against discarded images, spend, and story drift; changing our order requires an explicit decision. |
| Voice and sound ownership | Cartesia clone and separately locked narration; piano score intended. | Video prompts include described voices, dialogue, ambience, and scene-specific music instructions. | Integrated dialogue/audio may align acting, lip movement, and sound naturally. Test whether it can preserve the approved storyteller voice and exact words; do not assume a text voice description can. Extra dialogue and effects may complement narration if deliberately approved. |
| Beat versus shot | Four 15-second story modules; internal shot grammar remains open. | Several shots and explicit cuts within a generated segment. | Reaction shots and detail inserts may tell a memory better than one continuous view. Test continuity, controllability, timing, and cost. A beat can contain multiple shots without changing the four-beat story contract. |
| Expression seven | DETERMINED. | ANGRY. | Anger may provide more useful facial range; determination may better fit restrained memoir acting. Choose the standard deliberately, or evaluate a versioned extension rather than treating the labels as equivalent. |
| Reference stance | Candidate image may be expressive; turnaround is neutral. | Candidate prompt recommends a neutral full-body stance; turnaround is evenly balanced. | Neutral candidate poses may give cleaner reference geometry and easier sheet generation. Compare sheet fidelity while still giving users appealing designs to choose from. |
| Prompt length and exclusions | Complete reviewed prompt with explicit requirements. | Initial advice favors concise positive instructions, but later examples use long prompts and exclusions. | Shorter prompts may reduce competing instructions. Compare concise and detailed versions on the same identity/reference task; source heuristics are not established provider behavior. |
| Proportion exaggeration | Stylization must retain recognizable identity and appropriate age. | Suggests overshooting values to counter generator defaults. | Measured exaggeration may avoid generic faces or adult/child proportion drift. Test controlled variants and user likeness judgments rather than adopting arbitrary extreme values. |
| Provider and continuation mechanism | Muse for images; later video provider/continuation design undecided, persistent orchestrator state required. | Higgsfield/Seedream image workflow and Sequel/Extend continuation. | These may offer better sheet quality or visual continuity. Verify actual capabilities, pricing, reference/audio support, and resumability before selection. Provider continuation can work underneath our saved state if explicitly represented. |

“No music” is local to the sample classroom segment, not a general conflict with the memoir's piano score. The absence of an orchestrator or our approval loop in this tutorial is a coverage gap, not evidence those mechanisms are wrong. Its inconsistent durations and cut counts are errors to validate, not competing creative philosophies.

### Boundaries while alternatives remain undecided

- Higgsfield, Seedream, Seedance, and its Sequel/Extend UI are tutorial choices, not selected dependencies or verified API capabilities for this package. Extension must eventually use the same saved project state and approved references, not rely on hidden provider conversation memory.
- Voice descriptions and generated dialogue in the video prompts cannot replace our approved clone or locked narration. Whether to include additional dialogue, ambience, or effects remains undecided. The sample's “no music” instruction is local to that classroom scene and does not remove our intended piano score.
- The sample is a multi-character classroom comedy, not a memoir template. Do not import its invented biographies, ten-child cast, running gag, or 27/30-second segment lengths.
- “Negative prompts barely work,” “aspect ratio in text is ignored,” and “overshoot values” are author heuristics, not verified universal model behavior. Set output dimensions through the documented provider API where supported and validate returned media. Do not overshoot traits so far that the storyteller loses recognizable identity.
- A concise prompt is useful, but the pack itself has long examples and uses negative instructions after discouraging them. Prefer a clear consistent contract; validate effectiveness on our actual provider rather than adopting absolutes.
- The source character-sheet template uses ANGRY, while our current draft uses DETERMINED. Keep the discrepancy visible until decided; do not silently substitute one for the other.

### What the sample teaches about validation

The extended example describes a nine-shot, 27-second segment, but its timecodes run to 30 seconds. Shot 2 contains an internal cut despite the global declaration of nine shots, eight transitions, and no internal cuts. These are source inconsistencies, not constraints to reproduce.

For the future shot-plan gate, consider checking declared duration against the timeline; gaps and overlaps; named shots against actual cuts; referenced characters/props against approved assets; and spoken text against audio lock. These checks support the human approval loop and cannot be replaced by a confident prompt-author verdict. Exact shot grammar, provider motion limits, and the background/scene approval flow remain design work.

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-10-01 | Design a new system independently of the current run. | Existing work should not dictate a flawed workflow. |
| 2026-10-01 | Four 15-second beats for v1. | A 60-second story with modular production units. |
| 2026-10-01 | Require agent review and user approval at each deliverable. | Semi-autonomous production with explicit creative ownership. |
| 2026-10-01 | Require audio lock before all image/video generation. | Establish story, voice, and timing before spending on visuals. |
| 2026-10-01 | Combine objective audio checks with direct listening. | Detect measurable defects while retaining judgment of sound and emotional fit. |
| 2026-10-01 | Make Cartesia the default; Gemini is user-requested and agent-resolved. | Keep the standard path clear without losing state when an optional provider is chosen. |
| 2026-10-01 | Generate three Muse design candidates per required character before selection. | Compare inexpensive alternatives before committing to costly animation. |
| 2026-10-01 | Compile sheets from the approved character image and standardized Markdown recipe. | Ground turnaround and expressions in a chosen identity rather than text-only resemblance. |
| 2026-10-01 | Require agent and user approval for every important character's sheet before backgrounds. | Make roster completeness and identity consistency enforceable stage dependencies. |
| 2026-10-01 | Use the shared examples to clarify layout without packaging them as reference assets. | The examples explain the intended workflow, rather than supplying reusable character content. |
| 2026-10-01 | Record tutorial-derived improvements as proposals and compare conflicting approaches on their merits. | Better alternatives may exist; evaluate them without silently changing agreed behavior or active state. |

## Implementation and evidence status

Design captured. No new production implementation, paid generation, or validation proof has been completed under this specification. Future updates should record what was implemented, what was tested, and what remains uncertain here.
