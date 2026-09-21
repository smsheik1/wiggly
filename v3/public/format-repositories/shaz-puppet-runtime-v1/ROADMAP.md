# Animate Shaz roadmap

This is the working order for the Shaz Wiggly Repo. Read it before adding a capability or claiming that a pose is ready.

## Available now

- The recovered Shaz rig renders locally without Toon Boom Harmony.
- **Talk to Camera** turns user audio into a direct-to-audience scene without manual frame math. It measures the audio, holds `neutral-listening` for the exact duration, and lets Cherry change only the mouth.
- An explicit sequence can arrange approved actions with chosen holds and gaps. Actions are contiguous by default. This is sequencing, not polished inter-action blending.
- Six building blocks are safe defaults: `neutral-listening`, `present`, `think`, `aha`, `point`, and `confident`.
- Audio-backed sequences can use five real rig mouth shapes generated locally by the bundled Cherry 0.1.0 engine. A supplied exact-audio Cherry TSV and an explicit no-lip-sync option remain available.
- Every audio-backed run creates a local English transcript with word timestamps before planning. The package includes the pinned whisper.cpp source and model, compiles its small Apple-silicon helper locally, and uploads nothing.
- Four fixed backgrounds ship with the kit: Sisters Room, Living Room, Photo Zone, and Pure White. Sisters Room is the default. Every room uses the same camera and waist-up Shaz placement.
- **Multi-Shot Video (`shaz-multi-shot-v1`):** composes contiguous shots (`talk-to-camera`, `text-card`, `chibi-commentary`, `b-roll`) over continuous audio without frame gaps or desyncs.
- **Reference-Calibrated Chibi Choreography:** frame-by-frame calibrated against the human animator reference (`I made this video to impress my Pakistani Mom`). Native 1280×720 direct compositing (no synthetic scaling or Sharp crops), clause-level pose density (~15-30 frames / 0.6s–1.2s per hold), 2-frame cushions on-twos connecting all 5 core holds (`talk-gesture`, `present-card`, `think-chin`, `shrug-open`, `point-emphasis`), and root-level auto-expansion guardrail in `buildChibiSchedule` via `deriveChibiRoutine` so blind agents never produce frozen commentary.
- **Jev Sub-Conscious Director Integration:** optional TypeSafe AI Jev model integration for sub-200ms comedic acting instinct (pose selection, camera motion, and badge tags) with deterministic zero-cost fallback.
- The runtime validates the plan, renders through one character renderer, inspects the finished media, and requires human review before delivery.

## Registered, but not ready for automatic use

These eight current recipes are runnable engineering material and still need a fresh complete visual review:

- `shrug`
- `key-point`
- `excited-celebration`
- `point-at-screen`
- `look-at-phone`
- `facepalm-frustrated`
- `arms-crossed-skeptical`
- `phone-use-sequence`

**Registered means runnable, not creatively approved.** Do not use these actions as automatic choices in a user video.

The historical `anatomy-v8-release` mechanically passed 173 frames and was accepted under delegated review at the time. The user later saw and rejected its visible poses. That direct rejection supersedes the earlier delegated acceptance. The old checks and hashes remain useful engineering history, but they are not current creative approval.

## Next

### 1. Review or repair the remaining actions

Take one action at a time. Watch the full current recipe at normal speed, compare full-frame and close-up playback where useful, inspect every frame, and record human approval against the exact output checksum.

A passing render or registry inspection is not enough. Move an action into the safe set only after its current recipe looks right.

### 2. Add polished transitions

Build reusable transitions that preserve silhouette, joints, paint order, anticipation, overshoot, settle, and living holds. Do not hide a bad cut with a generic crossfade or uniform interpolation.

### 3. Turn transcripts into semantic performance plans

The transcript and word timing are available now. The next step is a conservative planner that uses meaning, emotion, emphasis, and conversational beats to propose gestures. Neutral speech should stay restrained. Gestures should land on meaningful moments instead of running constantly, and the plan must remain inspectable before rendering.

The current `shaz-body-language-performance-v1` mode schedules body language from measured audio duration, but it does not apply lip-sync.

### 4. Broaden lip-sync review

The packaged lip-sync path works for `shaz-sequence-input-v1`: initialization creates Cherry cues locally, the renderer maps them to five existing mouth drawings, and the body stays untouched. Broader real-dialogue review is still needed before calling lip-sync production-complete across every speaking style.

Broader language support and automatic transcript-to-pose planning are later work. English transcription itself is available now.

### 5. Activate the Photo Zone

The map artwork has been removed from the Photo Zone background, but the empty area is not an active media slot. Define and validate a supporting-image and supporting-video contract before accepting an overlay. The bounds in `assets.json` are provenance only.

### 6. Create poses from plain English

Translate a semantic request into inspectable rig controls and drawing substitutions, using the approved action library as the movement vocabulary. Reject any new pose that fails silhouette, compositing, timing, continuity, or complete visual review.

## Build order

Finish the body-language library and transition grammar before automating transcript-to-pose decisions. Keep transcription, lip-sync, background choice, and body performance as separate inputs behind the same renderer. Do not move faster by weakening a gate or adding a second render path.
