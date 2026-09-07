# Character Gameplay Conversations

Public baseline **0.1.2**. Choose your characters and topic, then supply gameplay and one voice clip per line. Your coding agent prepares the timing and assembles the conversation. No media-provider account is required for this supplied-media workflow.

Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, and `npm run smoke` from this extracted folder. Smoke creates a fresh evidence folder each time and never calls a provider. Then follow `SKILL.md` to create a real episode.

The 17-second Batman/SpongeBob example was published at the user's request after it was presented for review. That is publication approval, not a recorded detailed quality verdict. See `PUBLICATION.json`. The original authoring blueprint below is historical evidence; its no-install and bitmap descriptions were superseded by the Sharp-based 0.1.1 runtime, which is unchanged in 0.1.2.

A small standalone compositor for fictional-character conversations over supplied gameplay, with a persistent title/question header and timed captions. One Node.js runtime handles same-universe casts and crossovers.

The user clarified the creative hook: fan-favorite fictional characters having cloned-voice conversations over Batman Arkham Knight or Spider-Man 2 gameplay. The initial independent analysis identified only header/gameplay/captions/dialogue and missed that hook. This package consumes supplied authorized gameplay and per-turn audio; it does not generate or verify recognizable character voices.

The included inputs use original fictional test characters, generated diagnostic video and audible tone WAVs. These are mechanical tests, not finished examples of the intended creative format. No reference footage, extracted frames/audio, transcript, character performance or voice model is distributed.

## Setup and quick proof

Requires Node.js >=22, npm, FFmpeg with libx264, AAC, scale/crop/pad/overlay/concat/audio filters, and FFprobe on PATH. Sharp 0.34.5 and its platform packages are pinned in package-lock.json. Setup downloads those packages once; rendering requires no account, key, network, or paid provider. This was tested on the available macOS host; no cross-platform certification is claimed. FFmpeg builds without drawtext/subtitles work because Sharp rasterizes the text overlay. The runtime uses the host's Arial/Helvetica/sans-serif fonts; exact font appearance is host-dependent, so inspect the first output on a new machine.

From this extracted Repo root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/contract.test.mjs
node runtime/render.mjs inputs/same-universe.json outputs/same-universe.mp4
node runtime/render.mjs inputs/crossover.json outputs/crossover.mp4
node tests/verify-proofs.mjs outputs/same-universe.mp4 outputs/crossover.mp4
```

Use fresh output paths for reruns. The renderer creates the parent output folder and an adjacent MP4 receipt. All assets needed for these proof commands are bundled. tests/make-fixtures.mjs documents how original diagnostic fixtures were generated; it refuses to overwrite existing files and is not needed for normal use.

## Real episode inputs

Create a new JSON using the bundled examples. The contract is:

- schemaVersion: 1.
- header.title: up to 25 characters; header.question: up to 36.
- topic: up to 100 characters; authoring context only.
- castMode: same-universe or crossover. Same-universe requires one universe; crossover requires two or more.
- cast: 2-6 objects with unique id, visible name and universe. At least two members must speak.
- gameplay: file, authorized:true and nonempty provenance. The file is relative to the Repo root, must be a regular local file without symlinks, at most 100 MB, and contain enough video for the complete conversation.
- turns: 2-12 objects with speaker id, text, durationSeconds, audio and captions. Audio requires a file, authorized:true and provenance for every turn. Every file is at most 100 MB; its duration must agree with its turn within 0.06 seconds. Turn durations use 0.04-second increments and total at most 60 seconds.
- captions: 1-10 objects per turn, with text/start/end. Times are seconds relative to the turn, ordered and non-overlapping within the turn. Combined caption wording must match the turn text. Each phrase must fit two 19-character lines; split longer text into additional timed phrases.

Supported text is ASCII letters/digits, spaces and .,:?!'-; displayed output is uppercase. Text is antialiased and measured before fitting to a 436-pixel safe width. Cast names are at most 20 characters and become speaker labels above captions.

For real episodes, replace every diagnostic asset with the supplied authorized gameplay/audio. Put the files inside this Repo, update their file paths and provenance, and keep the runtime unchanged. Supply your own clips; there is no gameplay acquisition, voice-cloning service, automated transcription or silent fallback.

## Output behavior and boundaries

Outputs are 480x640 H.264/AAC MP4 at 25 fps, with a white 136-pixel header and a 480x504 gameplay area. Gameplay is scaled and center-cropped to that area. Original gameplay audio is omitted; supplied turn audio is concatenated in mono at 48 kHz. The runtime does not synthesize a missing track, loop short gameplay, mix music, animate a character face or infer speakers.

The official runtime is runtime/render.mjs. Inputs affect the shared rendering path; there are no alternate export or preview implementations. Media protocols are limited to file/pipe; FFprobe has a 30-second timeout and FFmpeg a 120-second timeout. Output files must be new; failed partial output is retained for diagnosis. Media paths are relative to the Repo root even when the JSON is stored in inputs/.

## Proof status

proofs/same-universe-0.1.1.mp4 is an eight-second, four-turn conversation about leadership. proofs/crossover-0.1.1.mp4 is a six-second, three-turn cross-universe exchange about finding the way home. Headers, cast, script, captions, source video, tones and turn count differ. Both use the same runtime checksum recorded in their receipts.

The contract suite includes eleven tests, including text size, antialiasing and wide-text margins. Builder technical inspections check dimensions, duration, frame rate, H.264 video and AAC audio. verify-proofs checks those stream properties, visible caption pixels, changing caption regions and the expected non-silent tone frequencies in each turn. These numerical checks do not establish speech quality or voice identity.

Sampled output frames were inspected for visible headers, speaker labels, captions and clipping. Direct moving-video/audio review and creative acceptance remain pending. Benchmark approval applies only to testing this interpretation; no user blueprint approval or creative output approval is claimed. See BENCHMARK.md and FORMAT-REPO.json.

This package is publicly available with detailed creative review still pending. A separate 18-second Batman/Sonic run exposed the old bitmap typography and drove the 0.1.1 fix. A fresh agent subsequently rendered the 16.76-second Batman/SpongeBob example on its first attempt with no runtime changes. That proves supplied-media execution, not automated acquisition or voice generation. The public page displays the finished example, but raw gameplay, separate character clips and private inputs are not distributed in this kit. See BENCHMARK.md for the actual proof scope.
