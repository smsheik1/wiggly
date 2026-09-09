# Tutorial Video v1

Tutorial Video is an executable 16:9 compositor, not a wrapper around a
finished master. Give it the editable ingredients of a first-run walkthrough:
format metadata, permitted browser and coding-agent captures, supplied
narration tracks, timed captions, checkpoint copy, and the format's finished
video. The packaged Remotion runtime directly renders the Wiggly tutorial look:

- acid-lime, electric-blue, and warm-cream retro grid backgrounds;
- macOS-style browser and terminal windows;
- numbered step badges and a bottom progress rail;
- neon checkpoint cards;
- bold, timed subtitles; and
- native-audio result playback before and after the walkthrough.

The runtime rejects `sourceVideo`. A fresh agent cannot hand it a pre-rendered
tutorial or replace the format with a generic slideshow.

## Quick start

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
node runner.mjs init --output=my-tutorial.json
node runner.mjs validate --input=my-tutorial.json
node runner.mjs render --input=my-tutorial.json --output=my-tutorial.mp4
node runner.mjs inspect --input=my-tutorial.mp4 --report=quality-report.json
```

Run those commands **one at a time**. `npm test` already performs the official
smoke render; do not run `npm run smoke` beside it or immediately repeat the
same preflight. Use `npm run smoke` only when you want the smoke by itself.
Remotion also needs to bind a temporary localhost port. In a sandboxed coding
agent, grant that local browser/port permission before the first `npm test` or
`render` command. This is local process access—not internet or a provider call.
`doctor` reports `localhostPort: true` when the permission is ready.

Use `examples/batman-arkham-first-run/input.json` and
`examples/animal-conversations-compositor/input.json` as complete examples.
All media paths are relative to `media/`, even when the input JSON lives in a
different directory.

The bundled examples are immutable proofs and may be rendered unchanged when a
user asks to reproduce them. For a new tutorial, run `init`, copy new assets
under `media/runs/<name>/`, and edit the new input—not an example in place.

## Start with a target

Tell your agent which Wiggly Format to teach. It follows
`references/preparation.md` to find the result, capture real actions, write the
script, and generate narration using Fish Audio `s2.1-pro-free`. It asks one
short question at a time when needed. Configure `FISH_STUDIO_APIKEY` or
`FISH_API_KEY` locally for new narration; no paid model is selected.

`runner.mjs make` uses the strict Fish path in `runtime/voice.mjs`; the
lower-level `runtime/narrate.mjs` command takes a narration plan and produces
measured narration/caption ingredients. Captures use your coding agent's
browser or recording tools. Supplied audio still allows offline replay.

## Ingredients the agent prepares

1. Format name, promise, public URL, and output label.
2. Four to fourteen tutorial steps totaling 12–240 seconds.
3. At least one permitted browser capture and one permitted terminal/coding-
   agent capture, with provenance.
4. At least two generated or supplied narration audio tracks and their reviewed timed
   caption phrases.
5. At least one neon checkpoint and exactly one final-result step that keeps
   the result video's native audio.
6. Optional supplied music long enough for the full tutorial. Music is muted
   during native-result sections.

Copy files beneath `media/`, declare `authorized: true`, and write meaningful
`provenance` for each one. The validator refuses missing, external, symlinked,
oversized, or too-short media; it never silently loops or freezes a clip.

## Agent workflow

1. Read `SKILL.md`, the contracts, and a complete example. Run commands one at
   a time; concurrent Remotion commands can contend for local browser ports.
2. Confirm permission and provenance for every capture, audio file, and result.
3. Draft the tutorial as ingredient steps. Show the result first; use plain
   verbs such as choose, copy, send, render, inspect, and watch.
4. Put the media under `media/` and validate before spending render time. If
   `npm test` passed, do not run a redundant standalone smoke before the target.
5. Render through `runner.mjs`; do not duplicate or rewrite the compositor.
6. Inspect the output and contact sheet. A human must still watch and hear the
   entire output before finalization.

`inspect` reads the adjacent render receipt and samples the midpoint of every
declared ingredient step, so short browser or terminal steps cannot disappear
between evenly spaced screenshots. After complete playback, copy
`fixtures/creative-review.example.json`, record the reviewer decision, and run:

```bash
node runner.mjs finalize --input=my-tutorial.mp4 --report=quality-report.json \
  --review=creative-review.json --output=delivery.json
```

## Cost and boundaries

The compositor and offline tests make **zero provider calls**. New narration
uses the packaged Fish path, pinned to `s2.1-pro-free`; $0 under the provider's
fair-use limits. A key and selected voice are required. If Fish is unavailable,
the real run stops with a clear error—there is no OS-voice, sine-wave, or paid
fallback. Local dependency setup and rendering do not consume media-model
credits. Coding-agent usage is separate.
If an agent wants to generate music, images, or video with a paid service, it
must first show a per-provider estimate and receive explicit user approval. URL
downloading and screen capture use the host agent's tools and the preparation
recipe; narration and measured caption assembly are implemented in the Repo.

The two bundled proofs were rendered by this same runtime from different JSON
inputs. The Batman proof demonstrates the recovered visual identity against the
exact format that exposed the old shell; the Animal Conversations proof shows
that the compositor generalizes without code changes.
