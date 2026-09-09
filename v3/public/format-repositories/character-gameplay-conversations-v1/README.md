# Batman Arkham Conversations

Public baseline **0.3.0**, for **9:16 Shorts at 1080 × 1920**. Choose your characters and topic, and generate an end-to-end voiced conversation over gameplay with one command, or supply your own custom audio clips and gameplay video.

Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, and `npm run smoke` from this folder to verify offline baseline contracts.

## Autonomous Generation & 4 Sub-Formats

This format kit supports 4 distinct viral sub-formats detailed in `SKILL.md`:
1. **Physiology & Human Reality Q&A** (e.g. *Robin Asked Bruce How He Survives on No Sleep* [5.2M peak views], *Where He Keeps Batarangs*, *How He Recovers*, *How He Pees*)
2. **Multi-Universe Crossovers** with dynamic gameplay cutting and digital glitch whoosh transitions (e.g. *Batman vs. Spider-Man* [767K views], *Batman vs. Goku*, *Destroy Gojo*)
3. **Top 5 Countdown Rankings** with left-side number ladder and card reveals (e.g. *Top 5 Villains Batman Respects* [648K views], *5 Villains That Actually Scare Him*)
4. **1v1 Debates / Moral Clashes** (e.g. *Batman vs. The Joker* [451K views], *Batman vs. Jason Todd*)

### Autonomous Zero-Key Trend Scouting

Discover real-time viral debates and search velocity with zero credentials or API keys:

```sh
npm run scout
# Or scout by specific theme:
npm run scout -- --theme="money"
```

To automatically resolve community voice models, script the fan debate, cut gameplay, and render the complete Short:

```sh
node runtime/generate.mjs \
  --character1="Batman" \
  --character2="The Joker" \
  --topic="Why does Batman keep Joker alive?" \
  --output="outputs/batman-vs-joker.mp4"
```

Use `--dry-run` to validate the plan, voice model resolution, and timings without synthesis. Voice generation utilizes Fish Audio (`s2.1-pro-free`). Single-command wrapper: `npm run generate -- --character1="Batman" --character2="Jason Todd"`.

## Setup and quick proof

Requires Node.js >=22, npm, FFmpeg with libx264, AAC, scale/crop/pad/overlay/concat/audio filters, and FFprobe on PATH. Sharp 0.34.5 and its platform packages are pinned in package-lock.json. Setup downloads those packages once; rendering requires no account, key, network, or paid provider. This was tested on the available macOS host; no cross-platform certification is claimed. FFmpeg builds without drawtext/subtitles work because Sharp rasterizes the text overlay. The runtime uses the host's Arial/Helvetica/sans-serif fonts; exact font appearance is host-dependent, so inspect the first output on a new machine.

From this extracted Repo root:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
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
- music (optional): file, authorized:true, nonempty provenance, volume (default 0.1; greater than 0 and at most 0.25), and optional attribution text up to 2000 characters. Music follows the same local path/file-size rules and must contain audio long enough for the full episode. Omit the object for dialogue only. No music is silently selected, downloaded, generated or looped.

To use the bundled alternative, add this top-level object and preserve its publishing credit:

```json
"music": {
  "file": "assets/audio/yeat-if-we-being-real.mp3",
  "authorized": true,
  "provenance": "Yeat - If We Being Real (Instrumental starting at 0:28)",
  "volume": 0.12,
  "attribution": "Instrumental bed: Yeat - If We Being Real (used for pacing under dialogue)"
}
```

See `MUSIC-CREDITS.md` for the original source, license and required visible credit. This track is a chosen alternative, not the identified original YouTube song. The output receipt and MP4 comment retain `music.attribution`; also put it in the published description or credits.

Supported text is ASCII letters/digits, spaces and .,:?!'-; displayed output is uppercase. Text is antialiased and measured before fitting to a 900-pixel safe width, leaving at least 90 pixels on each side. Cast names are at most 20 characters and become speaker labels above captions.

For real episodes, replace every diagnostic asset with the supplied authorized gameplay/audio. Put the files inside this Repo, update their file paths and provenance, and keep the runtime unchanged. Supply your own clips; there is no gameplay acquisition, voice-cloning service, automated transcription or silent fallback.

## Output behavior and boundaries

Outputs are 1080x1920 (9:16) H.264/AAC MP4 at 25 fps with square pixels, a white 306-pixel header and a 1080x1614 gameplay area. Gameplay is scaled proportionally and center-cropped to that area, never stretched. Speaker labels start at y=1260; captions start at y=1350 with 86-pixel line spacing, leaving the bottom clear. Inspect the crop on real footage. Original gameplay audio is omitted; supplied turn audio is concatenated in mono at 48 kHz. An optional music bed is trimmed to the episode, reduced by the requested gain, ducked under speech, faded in over 0.35 seconds and out over 0.7 seconds (capped at half the episode each). A limiter prevents the summed mix clipping without normalizing up the dialogue. The runtime does not synthesize missing tracks, loop short media, animate a character face or infer speakers.

The official runtime is runtime/render.mjs. Inputs affect the shared rendering path; there are no alternate export or preview implementations. Media protocols are limited to file/pipe; FFprobe has a 30-second timeout and FFmpeg a 120-second timeout. Output files must be new; failed partial output is retained for diagnosis. Media paths are relative to the Repo root even when the JSON is stored in inputs/.

## Proof status

proofs/same-universe-0.1.4.mp4 is an eight-second, four-turn conversation about leadership. proofs/crossover-0.1.4.mp4 is a six-second, three-turn cross-universe exchange about finding the way home. Headers, cast, script, captions, source video, tones and turn count differ. Both use the same runtime checksum recorded in their receipts and preserve the dialogue-only path. The music test renders another diagnostic input to exercise the optional mix.

The 23 tests cover geometry/text, input/media safety, optional music validation, retained credit, a present quieter bed, preserved dialogue gain, ducking, ending fade and clipping. Builder technical inspections check dimensions, duration, frame rate, H.264 video and AAC audio. verify-proofs checks those stream properties, visible caption pixels, changing caption regions and the expected non-silent tone frequencies in each turn. These numerical checks do not establish speech quality or voice identity.

Sampled output frames were inspected for visible headers, speaker labels, captions and clipping. The user accepted the music preview after requesting its addition. The coding agent cannot receive audio input and does not claim a direct audiovisual score. Historical benchmark approval applies only to testing that interpretation; it is not retroactively relabeled as user blueprint approval. See BENCHMARK.md and FORMAT-REPO.json.

This is a user-accepted baseline, not general-purpose creative-fidelity certification. A separate 18-second Batman/Sonic run exposed the old bitmap typography and drove the 0.1.1 fix. A fresh agent subsequently rendered the original 3:4 Batman/SpongeBob episode on its first attempt without runtime changes. Shorts and music are maintainer refinements, not new unaided or blind-agent claims. The public page displays the example; raw gameplay, separate character clips and private inputs are not distributed in this kit. See BENCHMARK.md for the actual proof scope.
