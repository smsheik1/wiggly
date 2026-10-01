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
17. The writer elevates raw memories into skilled, clear storytelling. The user does not need storytelling ability; preserving weak phrasing is not the goal. Keep authentic facts and emotional intent, use language children can understand, and avoid overwriting or forced sentiment.
18. **V1 is narration over memories.** The approved storyteller voice narrates while characters act the memories. On-screen spoken dialogue and narration lip-sync are not v1 requirements.
19. Reviewer rejection requires evidence tied to an agreed criterion and a specific repair. Personal preference alone is not a rejection reason. Repeated writer/reviewer disagreement returns to the user.
20. **V1 deliberately uses more human decisions.** Perfect the workflow and learn from reviewed outputs before reducing oversight or introducing broad automatic approval.
21. **Initial video generation and creative changes need explicit human approval of the request.** The reviewer must catch obvious generation defects, reject them internally, and route a specific repair for automatic regeneration before presenting a passing result to the user. These technical repair retries are a narrow exception to the earlier every-call approval rule and operate within an agreed retry/spending allowance. Extensions, new shots, and creative rerolls still require approval. Text and image generation may proceed autonomously within the current approved stage and bounded allowance; deliverable approval gates still apply.
22. Run **common sense checks during intake and script review**: flag missing character references, age variants, locations, difficult actions, and other feasibility gaps before script lock. Planning does not authorize pre-audio-lock image generation.
23. Show the consequences of proposed changes: affected shots/assets and approvals, what remains valid, and estimated rerun cost/time. Update only actual dependencies; do not silently rebuild unrelated work.
24. Video generation uses API-based models. The Format does not require local AI video-model inference.

## Roles and authority

| Role | Responsibility | Authority limit |
| --- | --- | --- |
| Orchestrator | Maintain state, dispatch work, preserve context, route feedback, enforce gates, and report the next decision. | Cannot approve on the user's behalf or treat casual conversation as a stage transition. |
| Script writer | Elevate authentic raw memories into four clear, engaging emotional beats, understandable to children; revise against specific feedback. | Cannot invent personal memories as facts, overwrite the emotional intent, or change an approved script silently. |
| Narrative reviewer | Check factual grounding, emotional connection, relationship/POV consistency, child-accessible clarity, timing feasibility, and common sense checks. | Cannot reject solely for personal preference; rejection needs evidence and a repair. Approval permits user presentation; it does not lock the script. |
| Voice/audio producer | Validate recordings, create the selected provider's clone, and synthesize approved narration. | Cannot substitute a preset voice or accelerate narration. |
| Audio reviewer | Run measurable checks, directly listen, compare against the approved voice reference, and report localized findings. | Missing evidence yields an inconclusive review, never a fabricated pass. |
| Character designer / prompt author | Establish the roster, translate real references into stylized designs, and compile full sheet prompts from the selected images and standard recipe. | Cannot pick for the user, invent identity traits, or substitute text-only grounding for required image references. |
| Visual reviewer | Inspect candidate designs and completed sheets for identity, style, anatomy, layout completeness, and consistency. | Approval is specific to the character and artifact version; cannot stand in for user approval. |
| User | Supply memories and recordings; approve, request changes, or reject each deliverable. | Can explicitly redirect or revisit a stage; affected approvals must then be invalidated visibly. |

These are responsibility boundaries. Whether each role needs a separate running agent is an implementation question, not a requirement to build a large agent framework.

## Stage sequence

```text
Existing questionnaire and focused follow-up intake
  → common sense checks and feasibility flags
  → script writing ↔ narrative review (including common sense checks)
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

Use the existing questionnaire as the intake starting point. It already covers childhood, teenage freedom, a leap of faith, romance, and what the storyteller wishes their children understood. Collect the storyteller, recipient, relationship, memories, emotional intent, and any boundaries on what to include. Accept raw spoken memories as well as written answers. Four output beats do not require four questions or removal of an existing answer group; how these answers are distilled into four beats remains to be designed. Do not propose duplicate intake questions without first checking the existing questionnaire.

Preserve the original answers and any transcripts as factual source material. Ask focused follow-up questions where a meaningful detail is missing. The paid creative value is turning weak or unstructured telling into excellent storytelling: select, structure, simplify, and rewrite the memories into a clear emotional narrative. Preserve what happened and what it meant, rather than every original sentence. Keep meaningful humor and quotes when they serve the story, but do not preserve rambling merely to imitate the source. Use language even children can understand; avoid ornate prose, forced sentiment, and invented biographical claims.

**Common sense checks:** Before script lock, identify likely on-screen people and age variants, available/missing references, settings, meaningful props, and actions likely to be difficult to depict. These are preliminary planning findings, not generated assets or a replacement for the later confirmed character roster. Route gaps to a focused clarification or script/visual-plan adjustment and record their resolution. Do not approve a script while silently assuming essential missing assets or unresolved factual details will appear later.

The script deliverable contains four ordered beats, their narration text, emotional purpose, and a timing estimate. Narrative review rejects unsupported memories, inconsistent direct address, generic emotional filler, confusing transitions, or copy unlikely to fit naturally.

Rejected drafts return to the writer with the failed criterion, evidence from the current draft/source, and a specific proposed repair. A reviewer may suggest a different ending but cannot reject an otherwise passing ending solely because it prefers another. Separate defects, inconclusive findings, and optional creative suggestions. Repeated disagreement goes to the user with both positions and supporting evidence; do not run an endless rewrite loop.

Reviewer-approved drafts go to the user. User changes return to the writer and then pass review again. Approved script versions are locked and retained.

## 2. Voice clone

After script lock, collect a clean voice recording from the storyteller and any consent recording required by the selected provider. Use Cartesia by default. Validate actual media duration and quality, rather than trusting user-supplied metadata.

Create the clone and retain the provider, model, voice identifier, source recording reference, and creation receipt. Generate an audition for review and user approval before producing the complete narration. The user's judgment of whether it sounds like them remains essential.

Provider requirements verified October 1, 2026:

- **Cartesia (default):** 10 seconds is enough to start; Sonic 3.6 and newer accept up to 60 seconds for improved accent retention. See [Cartesia instant voice cloning](https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices).
- **Gemini (user-requested only):** The requesting user's agent must verify access, implement the optional path, and meet its recording/consent requirements through the same clone and audio gates. The current docs specify 10–30 seconds of reference speech plus a separate consent recording from the same adult speaker. See [Google voice replication requirements](https://ai.google.dev/gemini-api/docs/voice-replication). Mentioning this option alone does not approve a provider switch.

Requirements must be rechecked when implementing. These providers have separate voice IDs; a clone cannot be assumed portable between them. A celebrity test is not evidence that the ordinary storyteller's recording and consent flow works.

## 3. Four narration beats

Generate each beat from its locked script text using the approved clone as off-screen narration over memories, rather than additional character dialogue. Preserve the raw generated audio and measured speech duration. Each final beat occupies a 15-second timeline window, including deliberate pauses and reaction space; it need not contain 15 seconds of continuous speech.

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

Generated character design begins only after audio lock. Build on the preliminary people/age/reference findings from intake common sense checks to establish the important characters who will appear in the approved story, including supporting loved ones, not just the narrator. Confirm the roster with the user before generating designs. For each character, record a stable ID, name, story role, relevant beats, required age/appearance variants, available real-life reference photos, and any unresolved identity details.

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

## V1 human oversight and video spending gate

Keep the workflow hands-on in v1. Retain the established user review steps for script, clone audition, audio beats, character selection, and sheets; later visual-stage user decisions will be designed explicitly. Do not remove these steps merely to minimize clicks or claim greater autonomy.

Agents can author/revise text and generate image candidates within the current stage and its bounded spending/attempt allowance, without permission for each individual text/image call. This does not approve those results on the user's behalf, permit premature visual generation, or grant unlimited image spend. Clone and narration cost authorization remains to be specified separately; the video rule does not decide it implicitly.

Before initial video generation, show the exact beat/shot or segment, current prompt and input reference versions, provider/settings, planned duration, estimated cost, and the reason for this attempt. Obtain explicit approval for that request. Extensions, additional shots, creative changes, and rerolls for preference require their own approval. Approval becomes stale when relevant inputs or settings change outside the authorized technical repair scope. Persist the authorization and resulting job ID so collection/resumption of that same job does not become a duplicate paid call.

**Automatic technical repair exception, agreed October 1:** The reviewer should independently detect obvious defects such as extra limbs, broken anatomy, missing or duplicating props, and visible temporal corruption. Reject the defective attempt internally with localized evidence and a specific repair, return it to the video producer, regenerate within the agreed repair allowance, and review the replacement. Never advance the failed attempt or present it as the user's deliverable. The user reviews only an agent-passing candidate. Store failed attempts and diagnostic evidence for audit; do not routinely show defective media to the user. This exception authorizes narrowly scoped technical repairs, not new story actions, changed character identity, or creative preference changes. It never bypasses audio lock, approved references, or current stage dependencies.

The automatic retry ceiling, aggregate cost allowance, and permitted prompt/settings adjustments remain to be defined before implementing this exception. When that allowance is exhausted or a repair would change approved creative intent, pause and explain the blocker and proposed remedy in plain language; showing the defective clip is optional if the user asks to inspect it. External API failures still stop immediately under the repo's provider-failure rule; they are not creative defect retries.

Video review must cover the full clip over time, including limb/prop interactions and transitions. A first-frame likeness check or a few attractive stills cannot pass temporal quality. Retain localized evidence for failures; if the reviewer cannot inspect the motion reliably, its result is inconclusive and the clip cannot advance. Validate the reviewer against known defective clips, including the driving example, before claiming this loop catches common generation failures.

The user can inspect the outcome and approve it as a deliverable or request changes. Accepting a generated result and authorizing the next costly generation are separate decisions. These are design requirements; the actual video provider and shot structure remain undecided.

## Orchestrator state and conversation discipline

The authoritative state lives in a project record on disk or in the selected persistence system, not solely in agent memory. Save after every meaningful event and before waiting on an external job.

Minimum information:

- Project ID, format/spec version, storyteller, recipient, relationship, and source inputs.
- Current stage, current deliverable version, and pending action or user decision.
- Exact script versions, clone/provider IDs, media paths/hashes, and timing plans.
- Confirmed character roster/version; per-character references, required variants, candidate IDs, selected design/version, sheet prompt/recipe version, sheet file/version, and both review and user approval status.
- Current audio-lock and character-design-lock dependency versions, plus background-stage eligibility.
- Reviewer reports and user decisions bound to exact artifact versions.
- Intake common sense findings and their resolutions; request-specific video-generation authorization and whether it has been consumed; technical repair scope, retry/spending allowance, consumption, and parent attempt for each repair.
- Attempt history, provider job IDs, spend/budget, blockers, and next allowed action.
- Revision requests, deferred ideas, and invalidated downstream approvals.

Use explicit events such as `scriptSubmittedForReview`, `scriptChangesRequested`, `scriptApprovedByUser`, `cloneApprovedByUser`, `beatAudioRejected`, and `audioLocked`. This is a conceptual contract, not a commitment to a particular state-machine library.

Character events include `characterRosterConfirmed`, `characterCandidatesGenerated`, `characterDesignSelected`, `characterDesignApprovedByUser`, `characterSheetPromptReviewed`, `characterSheetRejected`, `characterSheetApprovedByUser`, and `characterDesignLocked`. Selection and approval are distinct decisions unless the user's action explicitly expresses both. Track each character's pending action separately; no project-level “images ready” status can replace per-character completion.

Bind worker results to the input and artifact versions used when dispatching. A delayed review of an older design or script cannot approve its replacement. Persist generation jobs, reference dependencies, and attempt IDs before waiting; on resume, recover the same work rather than duplicating charges. Derive stage eligibility from current dependencies, not the most recent chat message.

On resume, read state, summarize the current deliverable and pending decision, and continue that stage. Resume saved provider jobs instead of submitting duplicates after a local interruption.

For unrelated messages, acknowledge and save the idea, then return to the pending deliverable. Do not ignore an explicit user pause, cancellation, or request to revisit an earlier stage. Ambiguous comments are not approval. The system keeps the user oriented without trapping them in a workflow.

## Approval invalidation and retry discipline

For a proposed revision, first display its impact in plain language, for example: “This changes beat 2 narration and two dependent shots. Beats 1, 3, and 4, and the existing character sheets, remain valid.” The actual impact comes from recorded dependencies, not a canned blanket reset. Identify which approvals reopen and which jobs would need regeneration, and show labeled cost/time estimates when available. Then apply the user's chosen scope, preserving history and valid independent assets.

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

Prove that known video defects are caught and withheld from user presentation, specific repairs return to production, replacements receive fresh media review, and technical retries cannot exceed their allowance or change approved creative intent. A failed review must never be recorded as a pass merely to keep production moving.

## Open questions and next discussions

- How should the existing questionnaire answers be distilled into four meaningful beats while preserving the storyteller's intended message?
- What narrative rubric and timing budget preserve intimate natural speech?
- Which speech-to-text, speaker-similarity, and audio-listening systems have verified capabilities for this workflow?
- What measured thresholds, retry ceiling, and spending limit should apply?
- What automatic video defect-repair allowance and prompt/settings changes should be approved with the initial request?
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

The following remain open proposals; items decided by the user have been moved into the agreed decisions and stage rules above. Nothing here is implementation approval. Their priority reflects current design judgment, not measured production evidence.

| Decision | Proposed direction | Why it matters / what to evaluate |
| --- | --- | --- |
| Use the emotional answer already collected | Derive the narrative through-line from the existing “what I wish my kids understood” answer and connect the selected memories to it. | This is a writer/reviewer responsibility, not a new questionnaire step. Test whether the script honors the supplied answer instead of substituting a generic message. |
| Beat length versus shot length | Keep four 15-second narrative windows while evaluating multiple shorter shots within each. | A beat is an editorial unit, not necessarily a provider job. Compare emotional pacing and modular repair cost against the complexity of maintaining continuity across shots. |
| Representative video proof before full production | Consider validating one representative beat before requesting approval for remaining video generations. | It may expose integration defects earlier, but it must follow the established gates and the video authorization/technical repair rules. Whether to use this ordering remains undecided. |
| Household privacy and asset lifecycle | Decide where voice samples, clones, family photos, transcripts, and finished movies live; how users export/delete them; and whether publishing is a separate explicit action. | A private family gift and a public social post need different handling. Provider requirements and deletion behavior must be verified when choosing storage and implementing this workflow. |

Suggested next discussion: determine how existing answers map to four beats and explain beat-versus-shot structure before deciding it. Narration over memories and higher human oversight are now agreed v1 choices. Use the questionnaire already in place rather than adding another emotional-intent interview. Keep changing the design spec distinct from changing an active run: new spec versions must not silently migrate a project's approved artifacts.

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
| Voice and sound ownership | V1 uses separately locked Cartesia narration over acted memories; piano score intended. | Video prompts include described character voices, dialogue, ambience, and scene-specific music instructions. | Integrated performed dialogue remains a possible future format, not an unresolved v1 narration choice. Evaluate it separately if reopened; ambience/effects and their mix still need decisions. |
| Beat versus shot | Four 15-second story modules; internal shot grammar remains open. | Several shots and explicit cuts within a generated segment. | Reaction shots and detail inserts may tell a memory better than one continuous view. Test continuity, controllability, timing, and cost. A beat can contain multiple shots without changing the four-beat story contract. |
| Expression seven | DETERMINED. | ANGRY. | Anger may provide more useful facial range; determination may better fit restrained memoir acting. Choose the standard deliberately, or evaluate a versioned extension rather than treating the labels as equivalent. |
| Reference stance | Candidate image may be expressive; turnaround is neutral. | Candidate prompt recommends a neutral full-body stance; turnaround is evenly balanced. | Neutral candidate poses may give cleaner reference geometry and easier sheet generation. Compare sheet fidelity while still giving users appealing designs to choose from. |
| Prompt length and exclusions | Complete reviewed prompt with explicit requirements. | Initial advice favors concise positive instructions, but later examples use long prompts and exclusions. | Shorter prompts may reduce competing instructions. Compare concise and detailed versions on the same identity/reference task; source heuristics are not established provider behavior. |
| Proportion exaggeration | Stylization must retain recognizable identity and appropriate age. | Suggests overshooting values to counter generator defaults. | Measured exaggeration may avoid generic faces or adult/child proportion drift. Test controlled variants and user likeness judgments rather than adopting arbitrary extreme values. |
| Provider and continuation mechanism | Muse for images; later video provider/continuation design undecided, persistent orchestrator state required. | Higgsfield/Seedream image workflow and Sequel/Extend continuation. | These may offer better sheet quality or visual continuity. Verify actual capabilities, pricing, reference/audio support, and resumability before selection. Provider continuation can work underneath our saved state if explicitly represented. |

“No music” is local to the sample classroom segment, not a general conflict with the memoir's piano score. The absence of an orchestrator or our approval loop in this tutorial is a coverage gap, not evidence those mechanisms are wrong. Its inconsistent durations and cut counts are errors to validate, not competing creative philosophies.

### Boundaries while alternatives remain undecided

- Higgsfield, Seedream, Seedance, and its Sequel/Extend UI are tutorial choices, not selected dependencies or verified API capabilities for this package. Extension must eventually use the same saved project state and approved references, not rely on hidden provider conversation memory.
- Voice descriptions and generated dialogue in the video prompts cannot replace our approved clone or locked narration. V1 narration over memories is decided; ambience/effects and their mixing remain open. The sample's “no music” instruction is local to that classroom scene and does not remove our intended piano score.
- The sample is a multi-character classroom comedy, not a memoir template. Do not import its invented biographies, ten-child cast, running gag, or 27/30-second segment lengths.
- “Negative prompts barely work,” “aspect ratio in text is ignored,” and “overshoot values” are author heuristics, not verified universal model behavior. Set output dimensions through the documented provider API where supported and validate returned media. Do not overshoot traits so far that the storyteller loses recognizable identity.
- A concise prompt is useful, but the pack itself has long examples and uses negative instructions after discouraging them. Prefer a clear consistent contract; validate effectiveness on our actual provider rather than adopting absolutes.
- The source character-sheet template uses ANGRY, while our current draft uses DETERMINED. Keep the discrepancy visible until decided; do not silently substitute one for the other.

### What the sample teaches about validation

The extended example describes a nine-shot, 27-second segment, but its timecodes run to 30 seconds. Shot 2 contains an internal cut despite the global declaration of nine shots, eight transitions, and no internal cuts. These are source inconsistencies, not constraints to reproduce.

For the future shot-plan gate, consider checking declared duration against the timeline; gaps and overlaps; named shots against actual cuts; referenced characters/props against approved assets; and spoken text against audio lock. These checks support the human approval loop and cannot be replaced by a confident prompt-author verdict. Exact shot grammar, provider motion limits, and the background/scene approval flow remain design work.

## Gemini video diagnosis assessment — evidence and proposals

Reviewed October 1, 2026. This evaluates the pasted Gemini proposal against primary documentation, the existing runtime, saved state/storyboard, and sampled video frames. It does not approve an overhaul, edit the old run, select a video provider, or change our four-beat design. The existing working checkout may change independently; these are observations at review time. No paid requests were made.

**Assessment:** Concise, scene-specific motion prompts and shorter prototypes are worth testing. The claimed causal explanation and four universal physical laws are not established. Prompt improvements cannot replace reference grounding, current approvals, persistent request state, and evidence-based media review.

### Claims and evidence

| Claim or proposed fix | Assessment | Implication for our design |
| --- | --- | --- |
| Animation theory overload caused extra arms because the encoder literally activates on words such as “dart,” “fast,” and “opposite.” | The builder and saved storyboard do contain broad animation instructions. Removing irrelevant or conflicting instructions is plausible, but no recorded comparison isolates these words as the cause. ByteDance demonstrates complex action and instruction following; the categorical “doesn't understand theory” explanation is too crude. | Test concrete visible actions against generic theory while holding other inputs fixed. Treat improvements as observations, not proof of a token-level mechanism. |
| An I2V first frame locks 100% of style, lighting, and geometry; any style wording causes bubbling or flattening. | False as a guarantee. ByteDance acknowledges remaining detail stability and multi-subject consistency limitations. Replicate's Mini guidance expressly permits lighting and mood descriptions. The current saved prompts for beats 1–4 do not contain the claimed RenderMan style prefix, though a builder can produce it; the saved attempt does not retain its exact submitted prompt. | Avoid unnecessary restatement or contradiction, but do not impose an untested blanket style-word ban. Judge whether the output preserves the approved appearance over time. |
| Noise necessarily compounds after 5–6 seconds, so 12–15-second shots must fail. | No primary evidence found for that threshold or the stated autoregressive mechanism. The Seedance 2.0 model card documents 4–15-second generation. Replicate recommends starting with 5-second Mini prototypes and increasing duration for final versions. Supported duration does not guarantee usable results. | Shorter shots are an experiment and possible production choice, not a proven universal cap. Evaluate duration and action complexity independently on the exact deployed variant. |
| Negative instructions physically lock hands to props. | Text is guidance, not a rig constraint. The saved driving clip visibly gains an additional wheel hand while retaining the microphone hand at 5 seconds. A prompt cannot guarantee anatomical or contact consistency. | Specify a feasible starting pose and one readable action, then inspect limb count, contact, occlusion, and prop continuity throughout the result. |
| Restrict all acting to blinks, breathing, and small expressions. | Useful as a low-motion baseline or an intentional quiet shot; unproven as the best film-wide rule. It can remove the meaningful action that communicates a memory. | Consider controlled action plus intentional stillness. Do not reduce every scene to an animated portrait or add arbitrary environmental motion. |
| Remove mandatory style-tag validation. | The inspected check reports character consistency partly from finding a particular style phrase in prompt text. That does not demonstrate consistency in generated media. | Replace misleading checks with appropriate prompt/request checks and actual media review; do not simply remove quality assurance. |
| Bind the latest approved keyframe. | Correct direction, but “latest” alone is insufficient. The current runtime already looks up an approved attempt and uses its image, while filtering only for approval records and lacking our full dependency and human-lock contract. | Bind exact current artifact versions and hashes, require both reviewer and user approvals, honor subsequent invalidation/rejection, and record what was submitted. Never select by filename recency. |

Primary sources: [ByteDance Seedance 2.0 launch and limitations](https://seed.bytedance.com/en/blog/seedance-2-0-official-launch), [Team Seedance model card](https://arxiv.org/abs/2604.14148), and [Replicate Seedance 2.0 Mini capabilities and tips](https://replicate.com/bytedance/seedance-2.0-mini). Full-model documentation is not proof of identical quality on Mini. Provider documentation describes supported capabilities, not guaranteed success on our scenes.

### Concrete failures the overhaul does not address

Read-only evidence came from the existing `/Users/shaz/Projects/wiggly` checkout, including `v3/scripts/my-pixar-story-format.ts`, `v3/features/formats/my-pixar-story/inspect.ts`, and the `eminem-pixar-v1` run's state, storyboard, and clips.

- **Media review:** The driving clip's recorded approval says “Phenomenal 3D motion coherence,” despite the visible extra hand in the inspected 5-second frame. A sampled frame establishes that local defect; it is not a complete playback review or proof of its cause. Reviews need specific time ranges, failed criteria, and repairs. Passing dimensions or prompt vocabulary cannot establish anatomy, likeness, acting, or continuity.
- **Audio approval:** The current video runtime accepts a narration attempt with `status === "ready"` and permits an audio-first bypass. That establishes generation readiness, not agent review, user approval, or current four-beat audio lock. Our already-agreed rules require the latter and block all visual generation until that lock.
- **Motion director integration:** The runtime calls the motion director and logs its returned arc type, but submits the original storyboard prompt rather than applying the returned direction. A “verified” log is not proof that the director influenced generation. The caught provider failure also continues the workflow, contrary to the repo's explicit provider-failure rule.
- **Request provenance and resumption:** Video attempts retain provider/model, prediction ID, and output, but not the complete submitted prompt/settings or input artifact version/hash. The job ID is saved only after polling and downloading finish. An interruption can therefore lose the local record of an already submitted job. The new orchestrator must persist authorization and submission state, then save the returned job ID immediately and resume collection rather than repeat generation.
- **Human authorization:** A command-line approval flag is not a durable record of the user's approval of exact inputs and settings or a scoped technical repair allowance. Record both before generation; automatic technical defect retries are the explicitly agreed exception, not blanket permission for new creative calls.
- **Prompt coherence:** The saved storyboard's beat 4 scene-level video prompt describes a phone call, while its shot A prompt describes holding a newborn. The runtime prioritizes the scene-level field. The new system needs one compiled request per approved shot, with provenance, rather than contradictory alternative text fields.

### Conflicts and experiments to consider

The pasted plan writes five locked Eminem prompts into an old storyboard. Our system has four beats, and brainstorming cannot lock or alter production artifacts. A 15-second beat is a narrative window; it need not equal one provider request. One 5–6-second clip per beat would supply only 20–24 seconds of video. If shorter shots are selected, plan approved coverage for every 15-second window without accelerating narration or silently filling the gap with repeated footage. Shot subdivision, transitions, and handoffs remain open decisions.

The proposed camera/subject/environment structure is a useful prompt template candidate. A static camera is valid; every shot does not need a move. Prop contact must agree with the actual reference pose. Environmental effects must agree with the setting and memory. Exact blink counts, “zero movement,” and poetic emotion labels are requests to evaluate, not enforceable physics. Screen-within-screen scenes and interacting subjects need explicit continuity checks; freezing the outer character does not ensure the inset child or prop stays stable.

**Proposed evidence path, not authorized generation:** After the established locks, select a representative scene and review its starting frame for feasible anatomy, pose, contacts, and staging. Compare the current prompt with a concise action-focused prompt at the same duration and provider/settings; then compare durations separately. Keep seed fixed if supported, but do not assume deterministic results. Record exact requests and time-localized outcomes; a single lucky result does not verify a universal rule. Experimental calls require user authorization; ordinary technical repair retries follow the scoped exception above. Evaluate readable storytelling as well as fewer defects before adopting a low-motion policy or clip-length cap.

## Orchestration framework assessment — recommendation, not adoption

Reviewed October 1, 2026 against current official documentation. No framework has been installed or selected by the user. **Scope correction: this is an agent-operated Wiggly Format package, not a choice of framework for the Wiggly app backend.** The app's existing language and dependencies should not determine the package's architecture.

The candidates offer different benefits and can occupy different layers. Antigravity supplies an agent harness; LangGraph supplies explicit workflow execution; LangChain supplies model/tool integration and agent-loop components. For this Format, evaluate each against what it adds to the packaged instructions, contracts, official runtime, saved run state, and inspection tools. A Format must remain operable through its documented entry points by a fresh compatible agent; requiring a particular harness is a deliberate distribution decision, not inherent in being agentic.

**Provisional fit assessment:** LangGraph is the strongest candidate of these three if the package needs a workflow engine for resumable author/reviewer loops and approval pauses. That does not make it a required dependency. A small durable state machine in the official runner may meet the same needs more simply. Antigravity can operate the package or power specialized workers; LangChain can simplify integrations. Do not combine all three by default or build another chat agent loop merely to wrap the user's already-running agent.

| Candidate | Documented role and strengths | Fit and tradeoff for this system |
| --- | --- | --- |
| LangGraph | Low-level orchestration combining deterministic steps and model-driven steps, persistence, human interrupts, and recovery. It supports Python and JavaScript/TypeScript and does not require the full LangChain framework. | Could power the Format runner's saved production workflow. We still author the state schema, legal transitions, approval/version checks, budget enforcement, and generation tools. Its value is recoverable workflow execution, not changing the final Format's presentation or making media review reliable. |
| LangChain | Higher-level model/tool integrations and agent-loop components built on LangGraph. | Optional convenience within a writing/review step. Do not add it merely to orchestrate this workflow if direct provider SDKs suffice. It is not a separate competing persistence solution to layer over the same project. |
| Antigravity SDK | Python agent harness with tools, context management, subagents, policies, session persistence, and lifecycle hooks. | Could supply the agent that reads and operates the Format or runs specialist tasks. Its benefit is handling agent execution and context/tool mechanics. Saved conversations and permission rules do not automatically define our artifact approvals and dependencies. Making it mandatory adds a specific execution environment requirement for users; weigh that against the benefit rather than judging it by the Wiggly app's stack. |

Sources: [LangGraph TypeScript overview](https://docs.langchain.com/oss/javascript/langgraph/overview), [LangChain's framework comparison](https://www.langchain.com/oss-overview), [Antigravity SDK overview](https://www.antigravity.google/docs/sdk/overview), [Antigravity session persistence](https://www.antigravity.google/docs/sdk/lifecycle), and [Antigravity tool policies](https://www.antigravity.google/docs/sdk/policies). This is a fit assessment, not a claim that Antigravity cannot implement the workflow or that LangGraph enforces our rules automatically.

### Proposed ownership and safeguards

- The workflow controller owns current stage, approved artifact versions/dependencies, pending user decision, provider job references, and repair allowance. Maintain one authoritative project state; do not independently advance a JSON run manifest, chat memory, and framework checkpoint as competing state machines. Choose the persistence/manifest relationship explicitly when implementing.
- The conversation agent interprets feedback and requests semantic actions. The controller validates them. An unrelated message cannot set audio lock or authorize a new production stage; explicit user redirection remains supported with visible dependency invalidation.
- Writing and review remain model-driven; stage permission, required approvals, reference completeness, and retry budget checks remain deterministic code. Every generation tool enforces its prerequisites even if invoked outside the intended graph path.
- The automatic video defect loop is generate → inspect → localized repair → regenerate within allowance → inspect again. Only a passing candidate reaches user approval. A framework routes review results; it cannot supply reliable audio listening, identity matching, or anatomical/temporal defect detection by itself.
- Use persistent checkpoint storage, not an in-memory saver, for restart recovery. A paused approval must resume the same project and artifact version, even days later. See [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence).
- Approval and provider submission should be distinct operations. LangGraph restarts interrupted nodes from their beginning; repeated execution can duplicate side effects. Persist request identity, authorization consumption, submission status, and returned job ID, use provider idempotency where supported, and reconcile uncertain submissions before any retry. Checkpointing alone does not guarantee exactly-once paid API calls. See [LangGraph interrupt and side-effect rules](https://docs.langchain.com/oss/javascript/langgraph/interrupts).

Before committing to a dependency, prove a small vertical slice with isolated mocks: writer/reviewer repair, durable user pause/resume, stale approval rejection, an enforced audio-first gate, bounded technical repairs, and restart during provider submission without a duplicate request. Compare its complexity with a small persisted TypeScript state machine. Choose the simpler implementation that meets those proofs; do not build a large agent framework merely because the product is described as agentic. Deployment, storage, and portable-package support remain implementation decisions.

The distribution proof is a fresh agent receiving only the Format package and desired outcome: it must discover requirements, use the official runtime, recover the correct stage, obey gates, inspect and repair defects, and return the finished film without rebuilding the workflow. Keep portable package entry points and authoritative production state stable regardless of which agent harness operates them. Framework adoption remains a proposal until its benefits are demonstrated against that proof.

### ComfyUI comparison — complementary media execution candidate

**API-only video constraint clarified by the user:** Local video-model execution is not a reason to add ComfyUI to this Format. ComfyUI can still compose hosted API calls and processing steps, but it is optional. Given our described provider calls, prefer evaluating LangGraph with direct provider adapters first; add ComfyUI only if a concrete reusable media recipe demonstrates a benefit. This is a recommendation, not adoption of LangGraph. Standard local media inspection or editing tools are distinct from running AI video models locally.

ComfyUI and LangGraph both use graphs, but their documented strengths differ. ComfyUI provides reusable node workflows for image, video, audio, text, and 3D generation; LangGraph provides explicit agent/workflow control with persistence and human interrupts. ComfyUI is not limited to local image models: it supports partner API nodes, local execution, and cloud services. Its workflows can be invoked programmatically, and its managed API can package pinned nodes/models/dependencies as versioned deployments. See [ComfyUI official repository](https://github.com/Comfy-Org/ComfyUI) and [Comfy API deployment documentation](https://support.comfy.org/articles/2703236295-comfy-api-deploy-your-comfyui-workflow-as-an-api).

**Fit assessment:** LangGraph is the more direct candidate for our story-production state and approval/repair loops. ComfyUI becomes useful when a specific media recipe benefits from visually authored, reusable processing steps, open-model controls, or managed GPU execution. It could sit behind a generation tool invoked by the official Format runner; it need not replace the project orchestrator. Custom Comfy nodes can implement additional control logic, but that would be our implementation work, not evidence that the required memoir approval/state contract is already supplied.

Examples of possible ComfyUI value are reference preparation, supported pose/identity conditioning, generation followed by supported upscale/post-processing, and packaging an exact media workflow with its requirements. These are possibilities to verify on chosen models, not adopted production steps. A Comfy workflow does not add controls to a closed provider that its API does not expose, guarantee the same pixels across runs, or automatically detect extra limbs. Wrapping a single existing Muse/Cartesia/video API call may add little value compared with calling it directly.

If used, ship the tested workflow and its version/requirements as supporting Format assets. Keep authorized input versions, stage checks, review decisions, and repair budgets in the official runner's authoritative state. Account for each paid operation inside the workflow; a single workflow submission must not conceal unauthorized video calls. Decide local hardware versus hosted execution and credentials explicitly. Neither ComfyUI nor LangGraph is adopted by this comparison.

**User-supplied integration example:** [Muse Studio](https://github.com/benjiyaya/Muse-Studio) documents LangGraph agent paths, ComfyUI image/video workflows, and Remotion export. Its README and the accessible description of the [linked tutorial](https://www.patreon.com/aifuturetech/posts/comfyui-ai-muse-153744609) were reviewed; the two linked YouTube pages could not be retrieved, and their videos were not watched. This is evidence of a concrete integration example, not proof of how frequently the combination is used or that the example meets our approval/audio-lock/review requirements. The repository currently displays an archived status; use it as architectural reference unless separately evaluated for adoption.

The proposed combination for this Format is: agent operates packaged entry points → official runner uses LangGraph to control state and dispatch approved work → generation tools call tested ComfyUI workflows or direct provider APIs → reviewer returns evidence → runner repairs within allowance or presents a passing candidate for human approval. The user need not manipulate a ComfyUI node canvas. ComfyUI supports programmatic submission, job history, and execution updates through its [documented server API](https://docs.comfy.org/development/comfyui-server/comms_routes). “Brain and art department” is a useful shorthand; LLMs perform writing/judgment, and the workflow controller enforces our coded production rules.

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
| 2026-10-01 | Elevate raw memories into clear, skilled storytelling understandable to children. | Users pay for storytelling craft; authentic facts and intent matter more than reproducing weak phrasing. |
| 2026-10-01 | V1 uses narration over memories. | Establish one clear audio/performance model without adding character dialogue requirements. |
| 2026-10-01 | Reject only with evidence and a specific repair; repeated reviewer disagreement goes to the user. | Review enforces criteria rather than personal taste. |
| 2026-10-01 | Keep higher human oversight in v1 and require approval for every video-generation request. | Learn and perfect the workflow while controlling its most expensive production actions. |
| 2026-10-01 | Perform intake common sense checks and display revision dependency impacts. | Discover feasibility gaps early and preserve user understanding and valid work during changes. |
| 2026-10-01 | Automatically reject and repair obvious video generation defects before user presentation, within an agreed allowance. | The reviewer must catch extra limbs and similar defects itself. This explicitly narrows the earlier every-video-call approval rule for technical repairs; creative changes remain human-approved. Retry limits and permitted adjustments still need definition. |
| 2026-10-01 | Use API-based video models; do not require local video-model inference. | The user clarified the intended provider approach while evaluating ComfyUI. ComfyUI remains an optional workflow tool, not an adopted dependency. |

## Implementation and evidence status

Design captured. No new production implementation, paid generation, or validation proof has been completed under this specification. Future updates should record what was implemented, what was tested, and what remains uncertain here.
