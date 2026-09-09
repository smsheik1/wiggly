---
name: lego-music-video
description: Create an evidence-backed brand ad as a three-shot Lego music video with the packaged runtime.
---

# Lego Music Video

Use this standalone Repo, not the audio-only Brand Jingle workflow. It adds a coherent miniature world, a recurring hero object, three cinematic moving scenes, lyric captions and a final vertical MP4. Lego naming is authorized by the operator; never invent an endorsement or reuse unrelated brand assets without permission.

## First actions

Require terminal, filesystem and local media access. If the chat cannot run this package, stop and ask the user to open it in a coding agent. Read KIT-MANIFEST.json at the archive root and report the version. Never rebuild the renderer, use a fallback compositor, or use the parent Wiggly app, database, private checkout or NIM.

All commands run from the archive's v3 directory:

```sh
npm install
npm test
npm run format:lego -- check
npm run smoke
```

Smoke imports the packaged cookie-tin source as a **fixture**, renders the official pipeline, and inspects the output. It sets LEGO_DISABLE_PAID_CALLS=1 and cannot be finalized as creative proof. An installed Chrome can be selected with LEGO_BROWSER_EXECUTABLE. If browser download or execution is denied, report that setup issue and obtain permission; do not spend money or rebuild the renderer. Fix observed setup failures before real work.

## Workflow

1. Ask one short question at a time. Start: “What brand or website is this music video for?” Establish the buyer truth, music direction, authorized assets and any existing song or Lego footage. Research with your own tools and save source-grounded claims. No separate LLM provider is required.
2. Run `npm run format:lego -- init --run=my-ad --brief='the brief'`. Fill the unresolved input.json from the user's evidence, not from smoke content. Read inputs.json and scene-contract.json. Use the goldens to understand structure, never as default customer content.
3. Complete scene.brand, creative, style and layout. Write exactly three compositionPlan.chunks with full lyrics, positive_styles, negative_styles and duration_ms totaling 10–30 seconds. Repeat the brand naturally in the hook. Keep the desired music direction explicit; do not imitate a named artist. Set layout.lyrics to all sung lines and layout.brandPhonetic to the spoken brand.
4. Run `npm run format:lego -- prompt --run=my-ad`. As the host agent, author the returned story schema into input.story: one recurring hero object, three distinct lyric-led events, camera/action continuity and a physical payoff. Follow the packaged allowed scene mechanisms. This is a narrative Lego music video, not a slideshow or a static product packshot.
5. Run `npm run format:lego -- validate --run=my-ad`. Present the lyrics/story and the current costs for any missing media. Reuse supplied media where possible. Do not call paid providers without explicit approval of the exact stages, one-attempt quantities and total budget.
6. Generate or import the song first. The runtime measures its actual duration; it scales the three planned sections to that total. Review the real song and revise timing if necessary. Captions are phrase/section-derived, not word-aligned; never claim timing is perfect without hearing it.
7. Generate/import the world reference, then three separate full-quality production stills. Inspect each for product identity, world consistency, clean composition and action potential. Never animate crops from a storyboard/contact sheet. Record a meaningful review of the exact input before generating a still or clip.
8. Generate/import three silent animated shots, one per section. Clip lengths are selected from measured song timing; the renderer permits only recorded modest retiming, never a frozen tail to hide missing footage. Keep jobs and outputs when something fails; collect the same prediction ID instead of starting over.
9. Run `npm run format:lego -- render --run=my-ad` then `npm run format:lego -- inspect --run=my-ad`. FFmpeg prepares clips; the one official AdRenderSurface/Remotion renderer makes the complete 1080 × 1920 MP4. Inspect that file, not only its source assets.
10. Directly watch the complete moving video and hear the audio. If either channel is unavailable, mark the review inconclusive and request a qualified reviewer. Never score hearing from captions, waveforms or unmuted controls. Fix only observed problems within the three-attempt ceiling.
11. When all checks and genuine creative review pass, write review.json using the exact rendered SHA256: `{"renderSha256":"…","videoPerception":"direct","audioPerception":"direct","verdict":"pass","notes":"Specific observations from this full audiovisual review."}`. Run `npm run format:lego -- finalize --run=my-ad --review=/absolute/path/review.json`. Never fabricate a review to pass the gate.
12. Return the playable MP4 with its contact sheet, input, source provenance, quality report, version and final review receipt. If review is pending, return a clearly labeled draft, not a finalized creative proof.

## Import existing media (free)

Prepare a portable input.json alongside local media using the golden schema. Null means a missing stage, not permission to generate it. Every media path must stay inside that input directory; include an authorized logo locally if needed.

```sh
npm run format:lego -- import --run=my-ad --input=/absolute/path/input.json
npm run format:lego -- validate --run=my-ad
npm run format:lego -- render --run=my-ad
npm run format:lego -- inspect --run=my-ad
```

Import copies sources and measures the song. Historical Jingle scene data is accepted only as an import adapter and becomes Lego Music Video. Do not copy old render state, fixture selections or final receipts into a real run. Preserve your sources and existing attempts.

## Paid commands and recovery

Optional key names are ELEVENLABS_API_KEY and REPLICATE_API_TOKEN. Use environment variables or ignored archive-root secrets.env; do not open .env.local, paste secrets in chat or write keys into the kit. Set LEGO_DISABLE_PAID_CALLS=1 whenever paid calls are prohibited.

Stages: song, reference, shot-1, shot-2, shot-3, clip-1, clip-2, clip-3.

`npm run format:lego -- request --run=my-ad --stage=clip-1` prints the exact route and request hash **without calling it**. Check the current provider quote for that model and settings. A fresh full run uses at most one song, four images and three videos before any reviewed retry. Quotes and wait times vary; never promise $0 for newly generated media.

After actual user approval, use `generate --run=my-ad --stage=… --approve-cost-usd=<quoted-call-cost> --budget-usd=<approved-total>` through npm run format:lego. For shot/clip stages include `--image-review='specific observations about this exact reference or production still'`. These flags record approved estimates, not a guarantee of final provider billing. Do not invent approval or silently switch models.

Use `collect --run=my-ad --stage=clip-1` to check a saved Replicate job. It never starts another prediction. Music submission is synchronous; an uncertain response requires operator recovery, not an automatic retry. `status --run=my-ad` shows attempts and jobs. Three paid submissions per slot and three renders per run are the hard limits; do not reset counters or rename runs to bypass them.

## Evidence limits

The goldens are two distinct existing David's Cookies songs and Lego stories. Their final MP4s are new local exports of recovered media, not newly generated footage and not recovered historical final exports. Technical checks passed; direct audiovisual review remains unreviewed. Historical imagery used google/nano-banana-2; historical video model is unknown. Current defaults in requirements.json are not retroactive provenance and were not freshly paid-tested.

Preserve the official renderer, local fonts, preparation logic, approval gates, attempt ledger and asset hashes. Replace content through input.json and local media only.

## Multi-Platform Social Distribution (Optional)

When a Lego music video is rendered and approved, the agent can distribute it across YouTube Shorts, Instagram Reels, TikTok, and X via the packaged `runtime/publish.mjs` CLI or connected Buffer MCP tools:

1. **Author platform-tailored copy in `inputs/distribution.json`:**
   - **YouTube Shorts:** Punchy music video title (≤100 chars), categoryId (`10` for Music or `24` for Entertainment), duration ≤60s.
   - **Twitter/X:** Engaging hook (≤280 chars total).
   - **Instagram Reels:** Engaging caption with tags, strictly vertical (9:16).
   - **TikTok:** Engaging caption with trending tags (≤2200 chars).
2. **Dry-run validation:**
   ```sh
   node runtime/publish.mjs --dry-run inputs/distribution.json goldens/cookies/final.mp4
   ```
3. **Live dispatch requires explicit human sign-off:**
   - Confirm target channels and copy with the user (`approvalRequired: true`).
   - Execute with connected Buffer MCP tools or `node runtime/publish.mjs inputs/distribution.json outputs/final.mp4`.
   - Generates a verified distribution receipt (`<video>.distribution.json`) with zero secret leakage.
