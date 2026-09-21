# Animate Shaz

Give Shaz a voice track, pick a room, and render a 1280×720 talking scene locally. Use **Talk to Camera** for everyday speech. Add one of the approved gestures when the performance needs a beat of body language.

The kit draws Shaz from the recovered Toon Boom rig without requiring Toon Boom Harmony. It does not play back a sprite sheet or reuse finished artist-video frames.

## Start here

```sh
npm install
npm run check
npm run inspect:registry
npm run smoke
```

These commands check the package, inspect every registered recipe, and make a free local smoke video. After installation, the normal workflow needs no network connection, API key, provider call, or paid service.

## The safe building blocks

Use `neutral-listening` as the calm body behind Talk to Camera. The other five entries below are the artist-reviewed gestures in the current performance set.

| ID | Best use |
| --- | --- |
| `neutral-listening` | Calm audience-facing speech; used by Talk to Camera |
| `present` | Friendly introduction or offer |
| `think` | Thoughtful pause |
| `aha` | Realization |
| `point` | Strong directional emphasis |
| `confident` | Assured statement or finish |

`poses/index.json` contains eight more recipes. They are registered, so the runtime can load and inspect them, but they are **not cleared for automatic use**. Registered means runnable, not creatively approved. `shrug`, `key-point`, `excited-celebration`, `point-at-screen`, `look-at-phone`, `facepalm-frustrated`, `arms-crossed-skeptical`, and `phone-use-sequence` each need a fresh complete visual review before they appear in a user video.

## Talk to Camera

For ordinary direct-to-audience speech, copy `fixtures/talk-to-camera/input.json`:

```json
{
  "schemaVersion": "shaz-sequence-input-v1",
  "title": "Direct-to-audience dialogue",
  "backgroundId": "sisters-room",
  "sequencePreset": "talk-to-camera"
}
```

Start the run with the user's audio:

```sh
npm run init -- --run=my-talking-head \
  --input=/absolute/path/input.json \
  --audio=/absolute/path/dialogue.wav
```

Initialization measures the audio and holds `neutral-listening` for that exact duration. Cherry changes only Shaz's mouth. The preset adds no body keys, props, camera movement, gaps, or alternate renderer. Do not supply `sequence`, `durationFrames`, or handwritten frame math, and do not use `--lipsync=off` with this preset.

Every audio-backed initialization also writes `transcript.json`, with the spoken words and their timing, plus `transcription-receipt.json`. This happens locally and does not change the video by itself.

## Understand the audio before choosing gestures

For a body-language sequence, make the transcript before writing the pose timeline:

```sh
npm run transcribe -- \
  --audio=/absolute/path/dialogue.wav \
  --output=/absolute/path/transcript.json
```

Read the text and word timestamps, then choose a small number of gestures for meaningful phrases. A Point can begin on the actual key word; a Think can begin on the thought it belongs to. Ordinary speech should stay in `neutral-listening`.

The command prints the transcript SHA-256. Copy that value into `planningTranscriptSha256` in an audio-backed gesture input. Anchor every expressive entry to one real transcript word:

```json
{
  "planningTranscriptSha256": "<SHA-256 printed by npm run transcribe>",
  "sequence": [
    {
      "poseId": "point",
      "holdFrames": 12,
      "gapFrames": 0,
      "anchor": { "wordId": "w0042", "label": "the important point", "frame": 214 }
    }
  ]
}
```

At 24 fps, `frame` is `round(word.startMs × 24 / 1000)`. The frames before that entry must add up to the same value. Initialization regenerates the transcript and rejects the plan if its SHA, word ID, label, or frame no longer matches the staged audio.

The bundled English Whisper model runs entirely on the Mac. On its first use, the package compiles a small Apple-silicon helper from the included whisper.cpp source with Apple Clang; later runs reuse that local helper. It does not use Deepgram, upload the audio, download a model, call an API, or require Python. The transcript helps the agent plan—it does not select poses or alter the renderer on its own.

When the official run starts, initialization regenerates the transcript from the staged audio and binds it into the validation, render, inspection, and delivery receipts. Do not paste a transcript into the input as if it were generated evidence. The deliverable transcript is `agent-runs/<run>/transcript.json`; the preflight copy is only for planning.

## Build a gesture sequence

For a more expressive moment, write a sequence with approved pose IDs and explicit timing informed by the transcript:

```json
{
  "schemaVersion": "shaz-sequence-input-v1",
  "title": "A thought and an answer",
  "sequence": [
    { "poseId": "think", "holdFrames": 8, "gapFrames": 0 },
    { "poseId": "aha", "holdFrames": 12, "gapFrames": 0 }
  ]
}
```

Actions touch by default. A positive `gapFrames` value deliberately inserts white frames; it does not create a polished transition. The final action must use `gapFrames: 0`.

The five-action fixture at `fixtures/five-recreated-authored-input.json` shows Present, Think, Ah-ha, Point, and Confident through the official runtime.

## Multi-Shot Video (`shaz-multi-shot-v1`)

For high-retention storytelling, the multi-shot engine composes four contiguous shot types across continuous audio with zero frame gaps or lip-sync desyncs:

| Shot Type | Purpose | Character / Visuals |
| --- | --- | --- |
| `talk-to-camera` | Personal address, comedic hooks, punchlines | Shaz waist-up with Cherry lip-sync & approved poses (`neutral-listening`, `present`, `think`, `aha`, `point`, `confident`) |
| `text-card` | Pacing resets, chapter titles, thesis highlights | Bold wall typography with vibrant colored highlights (`#00b4d8`, `#f77f00`) |
| `chibi-commentary` | Topic reactions, theories, breakdowns | Chibi Shaz reacting to on-the-fly vector topic cards or topic media |
| `b-roll` | Lore, complex scenarios, visual breathing room | Full-screen concept artwork with Ken Burns camera motion (`zoom-in`, `pan-right`, etc.) |

### Chibi Shaz Choreography Architecture

Chibi Shaz follows classical animation physics and timing discovered from frame-by-frame analysis of the human animator reference (`I made this video to impress my Pakistani Mom`):

1. **Native 1280×720 Compositing:** Chibi cels are authored natively for 1280×720 and composited directly without programmatic cropping, matrix scaling, or aspect stretching, grounded at $y=719$.
2. **Clause-Level Pose Density:** In authentic animation, characters never hold one static pose through a spoken sentence. Poses advance at each vocal clause ($\sim 15-30$ frames / 0.6s–1.2s per hold):
   ```json
   "chibiRoutine": ["talk-gesture", "present-card", "think-chin", "shrug-open"]
   ```
3. **Transition Cushions on Twos:** All transitions between hold poses (`talk-gesture`, `present-card`, `think-chin`, `shrug-open`, `point-emphasis`) are dynamically connected by 2-frame squash, stretch, and anticipation cushions (`0004x`, `0006`, `0007x`, `0009`, `0010`, `0012`) stepped strictly on twos (12 fps animated cadence).
4. **Root-Level Guardrail for Autonomous/Blind Agents:** If an agent provides only a single static hold for a shot $\ge 48$ frames (2.0s), `buildChibiSchedule` automatically expands it via `deriveChibiRoutine` into a multi-pose clause progression. Blind agents cannot produce a frozen chibi shot even on their first attempt.

### Jev Actor Intuition & Direction

When `TYPESAFE_API_KEY` is present in `secrets.env`, the director uses TypeSafe AI's Jev model (`jev-latest`) for sub-200ms comedic acting decisions (pose selection, camera motion, and badge tags). If no key is configured, the system falls back seamlessly to the deterministic keyword analyzer at $0 cost.

## Pick a background

Audio-backed scenes must name one of these built-in backgrounds:

| ID | Use |
| --- | --- |
| `sisters-room` | Main/default Shaz room |
| `living-room` | Warmer home setting |
| `map-photo-zone` | Clean purple room with the original map art removed |
| `pure-white` | Minimal scene or later compositing |

Each background is an opaque 3840×2160 PNG registered in `assets.json`. They all use the same fixed camera and waist-up character placement.

The clear area in Photo Zone is reserved for a future supporting-image or supporting-video feature. This package does not accept an overlay there. Do not invent, crop, or position one.

## Add local lip-sync

For an audio-backed gesture sequence, include `backgroundId` in the input and stage the audio during initialization:

```sh
npm run init -- --run=my-talking-sequence \
  --input=/absolute/path/input.json \
  --audio=/absolute/path/user-audio.wav
```

By default, the bundled Cherry Lip Sync 0.1.0 WebAssembly engine creates the speech cues locally. The renderer maps those cues to five existing mouth drawings: rest/closed, teeth, small-open, wide-open, and rounded O. Only the `Mouth` drawing changes; the selected body recipe, timing, deformations, props, and framing stay untouched.

There are three cue choices:

- **Automatic:** `--audio` uses the bundled Cherry engine.
- **Use an existing Cherry file:** add `--lipsync-cues=/absolute/path/cherry.tsv`. The TSV must come from that exact audio.
- **Audio without mouth motion:** add `--lipsync=off`.

To create only a cue file:

```sh
npm run lipsync -- --audio=/absolute/path/user-audio.wav --output=/absolute/path/cherry.tsv
```

The engine runs inside Node's WASI sandbox. The package does not run or require a native `cherrylipsync` app, Python, Rust, an API key, or a network call. Rust is needed only to rebuild the bundled WebAssembly module from source.

The separate `shaz-body-language-performance-v1` mode uses audio to measure duration and schedule gestures. It does not apply mouth cues.

## Render, watch, and deliver

Run the official workflow in this order:

```sh
npm run init -- --run=my-sequence --input=/absolute/path/input.json
npm run validate -- --run=my-sequence
npm run render -- --run=my-sequence
npm run inspect -- --run=my-sequence
```

For audio-backed work, include the `--audio` option on `init` as shown above.

Watch `agent-runs/my-sequence/final.mp4` all the way through. Also inspect `contact-sheet.jpg` and `quality-report.json`. Then edit only `human-review.json`: keep the exact output checksum, identify the reviewer, add concise notes, and set the status to `approved` or `rejected`.

Only an approved run can be finalized:

```sh
npm run finalize -- --run=my-sequence
```

The finalized video and its receipts stay in `agent-runs/my-sequence/`.

## What the checks protect

The runtime verifies the chosen recipe and background files, renders every frame through the same character renderer, and checks the final video rather than trusting the plan. Its gates cover joint continuity, cuff ownership, hand proportions, clipping, paint order, props, facial stability, frame count, duration, audio, background, fixed camera, and lip-sync provenance when used.

Automatic checks cannot decide whether a pose looks good. That is why complete normal-speed playback and an honest human review remain required.

Shaz always uses one fixed waist-up composition. The hoodie must continue below the bottom edge so the absent legs are never revealed, while both sides keep enough room for hands and pointing gestures.

## Author a new action

Sequencing an approved action is routine. Creating or repairing one is rig work.

Read `poses/README.md` and `references/rig-animation-playbook.md` completely. Work on one action at a time. Use sparse named controls and existing drawing substitutions wherever possible, and keep each native shoulder-to-sleeve-to-hand chain intact.

If three bounded native-rig attempts prove that the recovered drawings and pivots cannot form an essential destination, the narrow replacement rule in `SKILL.md` allows one coherent part-specific drawing. Its exact bytes, transform, paint layer, and visibility swap must be fixed; the original head and body must remain rig-rendered; and the result still needs independent inspection and complete normal-speed review.

Adding a recipe to `poses/index.json` makes it runnable. It does not make it creatively approved.

## Package integrity

`npm run build:kit` removes the previous stable ZIP before rebuilding it and writes a `.sha256` file beside the new archive. The ZIP leaves out `node_modules`, run outputs, downloads, the original Toon Boom archive, source PSDs, and finished artist renders. It intentionally includes the pinned whisper.cpp source and English model needed for offline transcription.

See `PROVENANCE.md` for where the rig, backgrounds, Cherry engine, and pose assets came from. See `PROOF-REPORT.md` for what has been proven and what still needs review.
