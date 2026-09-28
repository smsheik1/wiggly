# Wiggly Mugsy Explains

This proof kit turns three A-versus-B lessons into a 25-35 second vertical explainer using the bundled recurring character poses and an authorized Fish voice reference.

## What stays fixed

- Plain white 9:16 canvas.
- Exact bundled pose pack reused throughout.
- Proof images at the top.
- Handwritten labels and rolling captions.
- Hard cuts and continuous off-screen narration.
- One official runner and renderer.

## What changes

- The three comparisons in `content.json`.
- Six proof images referenced by `content.json`.
- The narration generated from those sentences.

## Commands

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm run direct # Choreograph Mugsy's acting poses & staging with Jev System One
.venv/bin/python runner.py smoke
.venv/bin/python runner.py validate
FISH_STUDIO_APIKEY=... .venv/bin/python runner.py render
.venv/bin/python runner.py inspect
.venv/bin/python runner.py finalize --human-review pass
```

`smoke`, `validate`, and `inspect` are local and free. The included example reuses its approved cached narration, so rendering it makes zero provider calls. If `content.json` changes, the runner invalidates that cache and `render` requires explicit Fish access through `s2.1-pro-free`. It never makes image or video generation calls.

The included finished proof is at `examples/wiggly-proof.mp4`.

The package bundles Patrick Hand under the SIL Open Font License so rendering does not depend on macOS system fonts. The pose and voice-reference assets are included with the source owner's permission for use inside this Wiggly Format. Do not extract, resell, or redistribute them as standalone assets.
