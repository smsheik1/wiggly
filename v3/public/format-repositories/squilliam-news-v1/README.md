# Squilliam News Wiggly Format Repo

This Repo turns a real promotion into a thirty-second breaking-news segment in the Squilliam News format. One official renderer drives a verified character pack, presenter-derived gestures, desk collision behavior, real-bone lip sync, the studio camera, screen layouts, and export. Promotion facts, story images, copy, timing labels, pronunciation overrides, voice inputs, and the verified `characterId` are replaceable.

The verified presenter roster is `squilliam` (default), `squidward`, `spongebob`, and `mr-krabs`. Put one of those IDs in `content.json`. All four have immutable render evidence under `evidence/character-packs/`.

Fish Audio presets are registered in `assets/voice-presets.json`: all four verified presenters have isolated vertical posters and browser-ready interactive GLBs under `assets/character-previews/`, plus short public voice auditions under `assets/voice-previews/`. Squilliam's audition is an excerpt from the approved proof narration, so the private clone ID remains outside the Repo and no additional provider call was made. These clips are marketing previews, not reusable production narration. Patrick and Sandy also have supplied voice presets, but their models remain unavailable until the failures recorded in `CHARACTER-AUDIT.md` are fixed and render-tested. Production Squilliam narration still uses the operator's approved private clone through the `SQUILLIAM_VOICE_ID` environment slot.

The two supplied proofs intentionally differ: We The Artists promotes an Indianapolis event with photographs, while Wiggly Format Lab promotes a software workflow with synthetic diagrams. Their results and the portability bug found by the second proof are recorded in `PROOF-REPORT.md` and `lessons.json`.

## Quick start

```bash
npm install
npm run smoke
npm run check
node runner.mjs init --run=my-promotion --from=we-the-artists
node runner.mjs validate --run=my-promotion
node runner.mjs render --run=my-promotion
node runner.mjs inspect --run=my-promotion
node runner.mjs finalize --run=my-promotion --human-review=pass
npm run package
```

If the run has no approved narration, add the Fish API key (`FISH_STUDIO_APIKEY`) to root `secrets.env` (or export in environment), and copy the selected presenter's `referenceId` from `assets/voice-presets.json` into `SQUILLIAM_VOICE_ID`. For Squilliam, use the operator's approved private clone instead. Validate first, obtain provider approval when required, and add `--approve-provider` to `render`. Fish variables may appear as unconfigured during `check`; they are optional when the selected example already includes `audio.wav`.

## Fixed and replaceable boundaries

| Fixed Format mechanics | Replaceable promotion content |
| --- | --- |
| Three.js renderer and 1280×720 studio | Headline, location bug, ticker |
| Character-pack contract and rig retargeting | Verified `characterId` |
| Calibrated real mouth/jaw bones | 65–112 word narration |
| Presenter-derived pose source | Pronunciation overrides and selected voice preset |
| Desk-safe arm retargeting | Poster and three story images |
| Ten monitor layouts and 30-second output | Slide copy, facts, CTA, sign-off |
| Render, inspect, and finalize gates | Run-local provenance and evidence |

## Run outputs

Each production lives under `agent-runs/<run-id>/`. Rendering never overwrites another run. Disposable PNG frames stay inside the run and are ignored by Git. A finalized run contains `final.mp4`, `contact-sheet.png`, `quality-report.json`, `finalization.json`, its exact `content.json`, and its asset provenance.

The runner prints absolute paths for playable video and contact-sheet output. An operating agent should open those with the host environment's normal media/image viewer; the Repo deliberately does not ship a second preview renderer.

`npm run package` creates `downloads/wiggly-squilliam-news-format-kit.zip` plus a SHA-256 sidecar. The archive includes the runtime, contracts, fixed assets, smoke fixture, and tracked proof evidence. It excludes API secrets, dependencies, temporary frames, run state, and older downloads.

## Provider and rights boundary

API keys and the operator's private Squilliam clone are environment values, never package data. The public reference presets explicitly supplied for this Repo live in `assets/voice-presets.json`; the runner fingerprints the selected ID in provider receipts without printing it. The included character files were supplied by the user for this private proof. Review distribution rights before publishing a downloadable public kit. Adding another character requires an entire registered pack plus render QA; a voice preset alone is not model admission and must not create another renderer.
