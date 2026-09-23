# Animate Shaz: proof report

Proof baseline: Format 0.4.0

The package can transcribe local English audio with word timing, turn that audio into a complete Shaz talking scene, animate the mouth with five real rig drawings, place Shaz over four built-in rooms, and deliver an inspected 1280×720 video. The 12-second showcase is a strong first draft, not a claim of final creative approval.

## What is safe to use

Use `neutral-listening`, `present`, `think`, `aha`, `point`, and `confident` as the current default building blocks.

Six other recipes remain in the registry because they are useful for engineering and repair: `shrug`, `key-point`, `excited-celebration`, `point-at-screen`, `facepalm-frustrated`, and `arms-crossed-skeptical`. They all need a fresh complete visual review before use in a user video.

Registry checks prove that a recipe can run and pass mechanical rules. They do not prove that the pose looks good.

## Runtime facts

- Source Xstage SHA-256: `507e8b0fa7b95d36b9429671b6b6a9ffa3dd77f5c559b84eb2b49add04512fca`
- Compiled rig assets verified: 210
- Registered pose recipes: 13
- Automated tests: 125 passing, including reproducible package bytes, bundled-engine parity, transcript and cue provenance, tamper rejection, transcript-anchored choreography, local-only audio ingress, cache-link rejection, audio-backed rendering, fixed-stage framing, the duration-derived Talk to Camera preset, the exact four-background registry, and a smoke-fixture guard that excludes needs-review poses
- Registry inspection: all 13 registered actions, 406 recipe frames, zero mechanical failures
- Official smoke: Present and Confident only, 40 frames over 1.666667 seconds; validation, rendering, inspection, and finalization pass without using a needs-review action
- Provider calls: 0
- Cost: $0
- Finished artist-rendered frames used by the runtime or as generation input: false

## Talking-scene proof

- Historical Format 0.2.0 output: 288 frames, 12.0 seconds, 1280×720, H.264 + AAC
- Exact video SHA-256: `59cef6b0910a9d7f8dfe342c0602e8f1921ec6c837fe0fb26c8d5510fd1d2edf`
- Lip-sync: 100 Cherry WASI cues mapped to five recovered mouth drawings
- Source audio SHA-256: `37648e2e0b4c37d22ec529b4301c8abd9435f92ce641c804e521e5b3bdd23f1b`
- Cue SHA-256: `6a6d5604461dfe9aadc40ab3bf5f7b5171c64e674c95384c58275294ee32820d`
- All six used pose recipes passed inspection
- The full audio and video streams decoded successfully
- The run used Sisters Room, no camera movement, and no provider calls

The user chose this exact 12-second result for the main Repo video after calling it very good for a first draft. Its saved `human-review.json` is still `pending`, so it remains a working proof rather than a final creative certification.

## Local transcription status

Development calibration is green: the bundled whisper.cpp source and English model compiled a roughly 2.3 MB arm64 helper locally, without downloading or running a prebuilt native executable. A 30-second Shaz dialogue clip produced 104 timed words and 12 segments in about 1.5 seconds on this Mac. Repeating the transcription produced byte-identical canonical JSON, SHA-256 `35a55600eafd90cb352c01e43e477bcddd945eca6dc21cf757049b059188af7b`.

The sealed-package proof is also green. A fresh blind operator received only the Format ZIP and two different 30-second WAV files. It read each transcript, chose three sparse gestures from the actual words, bound those gestures to six exact word IDs and frames, generated Cherry mouth cues, and completed `init → validate → render → inspect` twice. Both 720-frame H.264 + AAC videos passed with zero failures and decoded completely. One plan used Think, Point, and Confident for a reflective puppy story; the other used Present, Point, and Ah-ha for a family story. The different choices came from different transcript meanings, not volume peaks.

The quarantined extraction compiled its own arm64 helper without a Gatekeeper prompt or quarantine removal. No Whisper executable or model was downloaded, and every transcription/render step reported zero provider calls and $0 cost. A one-time lockfile-pinned `npm ci` still needed network access for Sharp; operation after installation stayed local. Exact transcripts, plans, word anchors, engine receipts, media hashes, and the no-approval boundary are recorded in `evidence/local-transcription-proof.md`. Human review of the two videos remains pending.

## Body-language proof history

- The five recreated artist-authored actions produced 242 frames over 10.083333 seconds. Exact video SHA-256: `8a5183154aaefb9a844d3bd8be48170e7576986f0d0717de5243057c2ea435ae`.
- Present, Think, Ah-ha, Point, and Confident passed all 170 recipe frames with zero mechanical failures.
- Present, Think, Ah-ha, and Point have direct checksum-bound user approval.
- Confident passed synchronized frame comparison plus a fresh-package render and inspection. The user explicitly delegated its final visual decision while away; the agent watched both the exact approval artifact and the complete five-action video through `ended=true`. This does not claim that the user personally watched Confident.
- The legacy Format 0.1.0 ten-action golden has 504 frames over 21.0 seconds at 1280×720, H.264, yuv420p, and 24 fps. It is retained as pending-review history, not current certification.
- The current ten-action fixture has 512 frames over 21.333333 seconds under the pre-Cherry 0.1.2 runtime. The legacy golden does not represent it.
- The current alternate fixture has 191 frames over 7.958333 seconds, with four actions in a different order and different holds.
- A historical blind ZIP-only proof produced 334 frames over 13.916667 seconds from seven independently chosen actions. It proves that an older archive operated on its own; it does not certify the current ZIP.
- Historical structural run `anatomy-v8-release` produced 173 frames over 7.208008 seconds. Exact video SHA-256: `bcf3556ffde53beb7e9efe989bd7e26655b0a2f3a23a5e80ed63f334d0edc9f9`.

`anatomy-v8-release` passed its mechanical checks and received delegated approval at the time. The user later saw and rejected its visible poses. That direct rejection supersedes the earlier delegated acceptance. Keep the run as engineering history; do not use it as a showcase or creative release gate.

## Talk to Camera proof

`sequencePreset: "talk-to-camera"` is a composition preset, not another pose. Initialization measures the supplied audio, records `durationFrames`, resolves one gap-free `neutral-listening` hold for the exact length, and requires Cherry cues tied to that audio. The user supplies no `sequence`, `holdFrames`, or frame calculation.

Validation, render, inspection, and delivery receipts carry the preset ID. The contact sheet samples real mouth-change frames. The preset reuses the existing one-frame neutral anchor and adds no body controls, props, camera movement, or renderer branch. Explicit gesture sequences still work and keep their 120-frame-per-entry hold limit.

A sealed Format 0.2.1 extraction passed all 110 packaged tests. The minimal preset then ran against two meaningfully different files: a 2.843-second OGG and a 12-second WAV. Both timelines came from the audio with no user frame math. Both used only `neutral-listening`, created local Cherry cues, produced H.264 + AAC, passed inspection with zero failures, and decoded completely. Exact receipts live in `evidence/talk-to-camera-preset-proof.md`. Creative approval remains a separate decision.

## Background proof

`assets.json` contains exactly four opaque 3840×2160 RGB PNG backgrounds and names `sisters-room` as the default. An audio-backed sequence or Talk to Camera run names a registered ID. The separate semantic performance mode accepts the same IDs and resolves an omitted choice through the manifest. Every background stays behind the same fixed stage and character renderer.

- Living Room is an exact flattened composite of the supplied PSD.
- Photo Zone hides only the visible source map-art layer and preserves the clean purple striped wall beneath it. Its recorded supporting-media bounds are reserved for a future feature; the current Format accepts and renders no overlay there.
- Pure White is an exact generated `#FFFFFF` canvas.

A sealed extraction passed all 111 packaged tests and `npm run check`, contained exactly the four registered background files, and rendered the same Talk to Camera audio, timing, and cues twice: once in Living Room and once in Photo Zone. Both outputs were 68-frame H.264 + AAC videos. Both decoded completely and passed inspection with zero failures. Their receipts record different background IDs and checksums while audio, cues, pose, holds, camera, and mouth histogram remain identical. Exact receipts live in `evidence/background-library-proof.md`. Creative approval remains separate.

## Cherry proof

When an audio-backed `shaz-sequence-input-v1` run starts, the bundled Cherry Lip Sync 0.1.0 WASI module creates cues locally by default. A Cherry TSV from the exact audio can be supplied instead, and `--lipsync=off` is the explicit audio-without-mouth-motion path.

The package contains no native Cherry executable and makes no provider call. The cue-only command and sequence initializer use the same bundled engine. `renderRigFrame` remains the only character renderer.

The separate `shaz-body-language-performance-v1` mode remains body-language-only. Its audio controls duration and gesture scheduling, not mouth drawings.

For the historical Format 0.2.0 package proof, a sealed extraction installed, passed all tests, passed `check`, passed registry inspection, and passed smoke without a supplied cue TSV. Two different speech inputs then completed `init → validate → render → inspect` through the bundled engine. Both videos decoded completely and reported zero mechanical failures. Exact receipts live in `evidence/bundled-cherry-wasi-proof.md`. This proves the bundled cue engine; it is separate from the later Talk to Camera preset proof.

## Publication boundary

The rich Repo page is testable, but the Format stays off the main Discovery shelf until the exact talking-proof checksum receives final creative approval.

The downloadable ZIP intentionally contains the pinned whisper.cpp source archive and English model. It does not contain the original Toon Boom archive, source PSDs, finished artist renders, agent runs, downloads, `node_modules`, or a downloaded native Whisper executable.
