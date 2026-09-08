---
name: squilliam-news-format
description: Turn a real event, launch, or promotion into a reusable thirty-second Squilliam News bulletin with a verified selectable presenter using the packaged renderer and runner.
---

# Squilliam News agent loop

Operate this runnable Format Kit. Do not rebuild, imitate, or replace the renderer.

## First question

Ask: `What event, launch, or promotion should the Squilliam News desk declare an emergency over, and which verified presenter should anchor it?`

Use only `squilliam`, `squidward`, `spongebob`, or `mr-krabs` as `content.characterId`. Squilliam remains the default. Do not add a model to this list until the same official renderer passes character-pack smoke QA.

Read `assets/voice-presets.json` after the user chooses the presenter. For Squidward, SpongeBob, or Mr. Krabs, copy the matching packaged `referenceId` into the local `SQUILLIAM_VOICE_ID` environment variable when new Fish narration is needed. The MP3s under `assets/voice-previews/` are short public auditions only; never splice them into a production bulletin. Squilliam still requires the operator's approved private clone. Patrick and Sandy are voice-ready only; never select their character IDs until their model status becomes `presenter-ready`.

Ask one question at a time. If the user requests the packaged We The Artists proof, initialize from that example without additional creative questions.

## Required loop

1. Read `README.md`, `requirements.json`, `input-contract.json`, `output-contract.json`, `composition-contract.json`, `quality.json`, `assets.json`, `assets/character-packs.json`, `assets/voice-presets.json`, and `prompts/script.md`.
2. Run `npm install`, then `npm run smoke`, then `npm run check`.
3. Run `node runner.mjs init --run=<run-id> --from=we-the-artists` or `--from=smoke`.
4. Change only the new run's `content.json`, `assets/story/*`, `asset-sources.json`, and optional approved `audio/source.wav`.
5. Read the script aloud and inspect every story image at phone size.
6. Run `node runner.mjs validate --run=<run-id>` before any provider call.
7. If narration is missing, report the Fish model and current cost, then ask once when the call may charge or consume a limited quota.
8. Run `node runner.mjs render --run=<run-id> --approve-provider` only after approval. Omit the flag when approved narration already exists.
9. Run `node runner.mjs inspect --run=<run-id>`, then use the host environment's media viewer to show the emitted contact-sheet and playable-video paths. If the GUI viewer is unavailable, use packaged Playwright with installed Chrome to play the actual MP4; do not create a preview renderer.
10. Ask the user to confirm factual accuracy, voice identity, pronunciation, body language, lip sync, joke, and CTA.
11. Run `node runner.mjs finalize --run=<run-id> --human-review=pass` only after approval.
12. Return the final playable MP4.
13. Multi-Platform Social Distribution (Optional):
    When the bulletin is finalized and approved, distribute it across YouTube Shorts, X/Twitter, Instagram, and TikTok via the packaged `runtime/publish.mjs` CLI or connected Buffer MCP tools:
    - Author platform copy in `inputs/distribution.json` (YouTube Shorts title ≤100 chars, categoryId "23" or "25", duration ≤60s; Twitter/X ≤280 chars; TikTok ≤2200 chars; Instagram non-empty caption).
    - Dry-run validation: `node runtime/publish.mjs --dry-run inputs/distribution.json examples/we-the-artists/evidence/final.mp4`.
    - Live dispatch requires explicit human sign-off (`approvalRequired: true`). Never leak or log `BUFFER_API_KEY`.
    - Generates a verified distribution receipt (`<video>.distribution.json`).

Stop on missing tools, invalid content, absent assets, unapproved provider use, failed inspection, or attempt three. Never print or store secret values. A content change that requires editing `runtime/renderer/app.js` is a portability failure, not permission to patch the renderer.
