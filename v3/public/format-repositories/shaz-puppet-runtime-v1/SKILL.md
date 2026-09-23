---
name: shaz-puppet-runtime
description: Animate the supplied Shaz puppet locally. Use Talk to Camera for dialogue, arrange approved body-language gestures, or repair and review one rig action without rebuilding the renderer.
---

# Animate Shaz

Skill version: **2.0**.

Use this kit to turn a voice track into a Shaz talking scene or to build a short performance from the recovered rig. Everything runs locally, makes no provider calls, and costs $0.

## Choose the job

- **Talk to Camera:** the normal choice for direct-to-audience speech. `sequencePreset: "talk-to-camera"` measures the audio, holds `neutral-listening` for the full line, and lets Cherry change only the mouth. Do not invent a pose or calculate frames.
- **Reviewed gesture sequence:** arrange the five artist-reviewed gestures listed below, then follow the complete run workflow.
- **Multi-Shot Video (`shaz-multi-shot-v1`):** high-retention directed video composing four shot types (`talk-to-camera`, `text-card`, `chibi-commentary`, `b-roll`) over continuous audio. Read `director-playbook.md` and `shot-sheet-contract.json`. The Director choreographs `chibiRoutine` sequences with lively clause-density (1 pose per ~15-30 frames / 0.6s-1.2s) connected by 2-frame squash/stretch cushions. The runtime auto-expands single holds on shots >= 48 frames so chibi never freezes.
- **Action repair or authoring:** work on exactly one action. Read `references/rig-animation-playbook.md` completely and follow the author-and-learn loop. Do not repair several unapproved actions at once.

## Which actions may be used

Use `neutral-listening` as the calm body behind Talk to Camera:

- `neutral-listening`

For body-language beats, default to these approved gestures:

- `present`
- `think`
- `aha`
- `point`
- `confident`
- `chin-stroke` (alias for canonical `chin-stroke-swagger`; approved swagger / smug chin-stroke with sly smirk)

The registry also contains `shrug`, `key-point`, `excited-celebration`, `point-at-screen`, and `chin-stroke-swagger`. They are runnable engineering material, not approved performance choices. Do not select one automatically or put it into a user video until that exact current recipe has passed a fresh complete visual review. (Broken experimental poses `facepalm-frustrated` and `arms-crossed-skeptical` are archived in `poses/archive/`).

**Registered means runnable. It does not mean creatively approved.** Mechanical inspection can pass a pose that still looks wrong.

## Run workflow

1. Read `README.md`, `input-contract.json`, `composition-contract.json`, `output-contract.json`, `quality.json`, and `content-boundary.json`. Read `ROADMAP.md` as well when changing the Format, planning a capability, or checking what remains unfinished.
2. Run `npm install` once. Then run `npm run check`, `npm run inspect:registry`, and `npm run smoke`.
3. **If scouting for breaking topics (Cultural Radar):**
   - Follow `trend-scout-playbook.md` to monitor the Layer 1 Reddit sieve.
   - Run the automated scout:
     `npm run scout -- --subreddit=GamingLeaksAndRumours --limit=3`
     Or scout all 5 core subreddits with top community debate comments:
     `npm run scout -- --with-comments --output=/absolute/path/trends.json`
4. **If starting from a topic or idea (Research & Script Creation):**
   - Follow `research-playbook.md` to frame the counterintuitive angle, concrete stories/facts, and emotional payoff.
   - Follow `writer-playbook.md` to write the script in Shaz's authentic voice, enforcing the *Therefore/But* causality rule and 4-shot rhythm.
   - Validate and lint the script against AI tells and word count limits:
     `npm run lint:script -- --script=/absolute/path/script.json`
   - Once approved by the user, record dialogue or synthesize speech using Shaz's official cloned voice:
     `npm run speak -- --text="Approved script text here" --output=/absolute/path/user-audio.wav`
     (Uses Shaz's official Cartesia Sonic-3.6 clone `28ca280b-6835-45d4-aa27-f432156f8236` with `-16 LUFS` broadcast loudness normalization and Cherry WASI lip-sync compatibility; falls back to Fish Audio clone `947a3b8d8a2c431a8a2934008d89d5b3`).
4. If the job uses audio, transcribe it before choosing gestures:

   `npm run transcribe -- --audio=/absolute/path/audio --output=/absolute/path/transcript.json`

   Read the full text and the word timestamps. The bundled English Whisper model runs locally; never upload the audio to Deepgram or another transcription service. For a gesture sequence, copy the printed transcript SHA into `planningTranscriptSha256`. Anchor each expressive action to a real `wordId`, label, and 24 fps frame (`round(startMs × 24 / 1000)`), then make the preceding frames add up to that anchor. Do not infer semantics from volume alone. Talk to Camera does not need a gesture plan, but initialization still records the local transcript as evidence.

4. Choose the input:
   - For ordinary dialogue, copy `fixtures/talk-to-camera/input.json`. Supply no `sequence`, `durationFrames`, or frame math. Initialization derives one exact-length `neutral-listening` hold from the audio, with lip-sync required.
   - For a multi-shot directed video, copy `fixtures/multi-shot/input.json` or author a `shaz-multi-shot-v1` plan following `director-playbook.md`. If `shots` is omitted, `npm run init` will automatically invoke the autonomous JEV Director engine to derive a complete, emotionally paced shot sheet directly from the Whisper transcript.
   - For body language, write a `sequence` with the five reviewed gesture IDs above. Use `neutral-listening` only as the calm default or connective tissue. Use explicit `holdFrames` and `gapFrames`. The last action must use `gapFrames: 0`.
   - Choose `sisters-room`, `living-room`, `map-photo-zone`, or `pure-white` from `assets.json`. Name `backgroundId` explicitly for an audio-backed sequence. A semantic performance input may omit it and use `assets.defaultBackgroundId`. Never invent a background ID.
   - `map-photo-zone` is only a clean fixed room in this release. Its empty area is reserved for future supporting media; do not add, crop, or position an image or video there.
5. Start a run with an absolute input path:

   `npm run init -- --run=my-run --input=/absolute/path/input.json`

   For an audio-backed `shaz-sequence-input-v1`, also pass `--audio=/absolute/path/audio`. The bundled Cherry Lip Sync 0.1.0 WASI engine creates and records cues by default. Use `--lipsync-cues=/absolute/path/cherry.tsv` only for a real Cherry TSV generated from that exact audio. Use `--lipsync=off` only when the user explicitly wants audio without mouth animation. Never make cyclic placeholder cues or reuse cues from a different audio file.

   `shaz-body-language-performance-v1` remains body-language-only. Its audio sets duration and gesture timing, not mouth drawings. It accepts the same backgrounds and defaults to Sisters Room.

6. Run these commands in order:

   - `npm run validate -- --run=my-run`
   - `npm run render -- --run=my-run`
   - `npm run inspect -- --run=my-run`

7. Watch `agent-runs/my-run/final.mp4` completely. Inspect `contact-sheet.jpg` and `quality-report.json`. Do not approve a video you did not watch.
8. Edit only `agent-runs/my-run/human-review.json`. Keep the exact `reviewedOutputSha256`, name the reviewer, write concise notes, and set `status` to `approved` or `rejected`.
9. Run `npm run finalize -- --run=my-run`. Delivery remains blocked unless validation, inspection, file checks, and human review all pass.

## Author-and-learn loop

1. Choose exactly one action. Record its reference segment, meaning, duration, and visible acceptance criteria. Check the surrounding frames before choosing the cut: include setup through release, or give a smaller gesture a smaller, honest name. A preexisting filename does not define the action.
2. Watch the complete reference at normal speed. Then inspect dense decoded frames and consecutive-frame differences. When source controls exist, inspect their timing, hierarchy, drawing substitutions, deformation channels, and asymmetry. Find intentional stepped exposures and holds before deciding how to interpolate. Never infer motion from one destination frame.
3. Render the authored calibration through the official runtime before changing its meaning. Fix renderer-wide silhouette, deformation, masking, fill, and paint-order defects before tuning timing.
4. Animate through real rig controls and existing drawing substitutions. Preserve secondary controls and living holds. Make the smallest semantic change that produces the intended action.
5. Run focused tests and independent per-frame pose inspection. Where a reference exists, compare synchronized full-frame and close-up playback.
6. Watch the exact candidate completely at normal speed. Slow motion is useful for diagnosis, but it cannot be the only approval view. A successful command, contact sheet, or handful of frames is not visual approval.
7. Allow at most three candidate attempts. Fix only observed causes. Stop and report the blocker instead of weakening a gate.
8. After genuine approval, ask exactly: **“What did this teach us, and does the skill, runtime, or test suite need updating?”**
9. Record the behavior, root cause, smallest reusable correction, and evidence. Follow the promotion rules in `references/rig-animation-playbook.md`. Update a recipe checksum only after the accepted file is final.
10. Register and sequence the action only after inspection and checksum-bound human approval pass. Registration alone does not grant creative approval.

## Rules that keep Shaz on-model

- Protect the finished silhouette and character assembly before polishing motion. Visible seams, detached joints, missing fills, or construction artwork make timing judgments invalid.
- Reproduce the artist's timing grammar: anticipation, accent, overshoot, settle, readable living hold, afterbeat, and release. Do not apply generic smoothing.
- Preserve stepped presentation. If the reference animates on twos or holds an exposure, encode those steps instead of inventing smooth in-betweens.
- Preserve the whole control choreography. Major arm and head keys alone are rarely enough.
- Treat drawing substitutions, visibility, AutoPatch-style masking, and paint order as animation controls.
- Visible alpha and semantic ownership are not the same thing. A partial eye, hand, or face drawing may own a larger matte than its painted pixels. Rebuild that envelope and clip occluders behind it instead of shifting artwork or erasing only an outline.
- Palette ownership matters. Shape, opacity, and connectivity can pass while teeth, eye whites, tongues, or skin use the wrong color. Keep direct color-presence gates for stable semantic regions.
- Prefer limbs animated through their common rig ancestor, with one continuous native shoulder-to-finished-sleeve-to-hand chain per side. Independent screen-space pieces and multi-fragment limb assemblies are forbidden.
- If three bounded native-rig attempts prove that the recovered drawings and pivots cannot form an essential destination, one coherent part-specific drawing may replace the complete corresponding native parts. It must be user-supplied or explicitly authored for the pose, exact-file and exact-transform locked, placed on a declared paint layer, preserve the rig-rendered head and body, and never overlap visible native counterparts. This is a narrow substitution rule, not permission to use a full-character sprite.
- A front overlay hand may record its recovered native sleeve owner as descriptive, validated metadata, but that label does not create ownership. The renderer must derive the cuff owner from rig topology, matte the overlay at that finished cuff, and enforce the rendered hand role's geometry limits. Inspect the wrist joint; overlap with the face or torso is not attachment evidence.
- When reusing a gesture, keep its authored wrist states with its hand drawings. Do not import wrist transforms from another frame range or enlarge a hand to force contact.
- Establish handheld props before contact and keep the hand inside the native rig hierarchy. A prop cannot stand in for a hand, finger, fist, sleeve, or arm. Matching coordinates do not create a joint. A prop-free alias removes the prop while leaving the native gesture controls and drawings unchanged. Never use the part-replacement rule as a shortcut for prop interaction.
- Reject a candidate when dense transition frames or normal-speed playback show a detached, duplicated, missing, scale-popping, undersized, oversized, or independently drifting limb. Whole-character connectivity and an asset ID are not enough. Verify native shoulder, cuff, wrist, and proportions directly. For a registered replacement, also verify exact asset bytes, transform, paint layer, complete suppression of the native parts, and preservation of the original body and head.
- Diagnose in this order: assembly, deformation, substitution or expression, timing, then polish.
- Turn repeated mechanical failures into tests or inspection gates. Do not rely on an agent remembering prose.
- Use Talk to Camera for unaccented speech. Keep Present, Think, Ah-ha, Point, and Confident as brief meaningful accents, not constant motion.
- Keep the background separate from pose and mouth decisions. Every built-in room is fixed input data behind the same waist-up character path. Never add camera movement or a background-specific character transform.

## Hard boundaries

- `runtime/rig-v2-renderer.mjs#renderRigFrame` is the only renderer for smoke, proof, and final video.
- Lip-sync may change only the registered `Mouth` drawing at each output frame. It must not alter body controls, pose order, hold length, deformation, props, framing, or any other face drawing. Cherry runs locally through Node WASI as a cue generator, never as another renderer. Validation binds the exact engine artifact, cue file, and audio checksums.
- Do not download, invoke, or require a native `cherrylipsync` executable. Use `npm run lipsync -- --audio=/absolute/path/audio --output=/absolute/path/cues.tsv`, or let audio-backed sequence initialization call the same bundled engine.
- Transcription must use the bundled whisper.cpp source and English model through `npm run transcribe`. Never use Deepgram, another hosted service, an unsigned downloaded Whisper executable, or a source-supplied transcript as generated evidence. The transcript may guide pose choice and timing; it must never mutate the rig or renderer directly.
- The waist-up crop is part of the composition contract on every background. The hoodie must continue below the bottom edge through every used action, while hands and pointing gestures retain clear horizontal margins. Never reveal the rounded lower hoodie boundary or invent legs.
- Finished artist-rendered animation frames may guide phase, cadence, and acceptance criteria. They must never become runtime sprites, deformation data, or generated pose artwork. A user-supplied pose-design drawing may be registered only under the strict part-substitution rule above and must be disclosed separately from recovered Xstage drawings.
- Never bypass `poses/index.json` with an arbitrary recipe path.
- Never weaken per-frame clipping, joint continuity, layer order, prop, facial-pop, or provenance gates to force a pass.
- A run gets at most three render attempts. Fix the input or recipe between attempts; do not create shadow runs to evade the limit.
- Do not use a generic crossfade, whole-character bounce, or uniform interpolation in place of body mechanics.
- Do not copy only the obvious controls, approve from sparse screenshots, or patch several poses at once.
- A new action is an authoring task, not a sequence-input change. Follow `references/rig-animation-playbook.md` and `poses/README.md`, inspect the recipe independently, register its checksum, and add evidence before using it.

## Return the result

Give the user the absolute path to `final.mp4`, the video checksum from `delivery.json`, the selected background ID, the actions in order, `agent-runs/<run>/transcript.json` plus `delivery.json.transcript.sha256`, the anchor phrases used for body-language beats, and any remaining limitations. Never claim delivery when `delivery.json` is absent.
