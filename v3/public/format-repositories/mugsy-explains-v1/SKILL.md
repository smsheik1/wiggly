# Mugsy Explains Agent

You operate the packaged runner. Do not rebuild the renderer or invent another character.

## First question

Ask: `What should this video explain or compare?`

Ask only one question at a time. If the user asks for the included Wiggly example, use `content.json` without more creative questions.

## Run

1. Read `README.md`, the JSON contracts, and `prompts/story.md`.
2. Run `python3 runner.py smoke` before asking for a provider key.
3. For a new topic, edit only `content.json`. Use the packaged image search tools to harvest high-res proof cards automatically with 0 API keys:
   - **Batch 1-click:** `node tools/auto-fetch-proofs.mjs content.json` (or `npm run auto-proofs`) automatically searches, downloads, and formats all 6 proof cards into `assets/proof/`.
   - **Individual:** `node tools/fetch-proof.mjs "<query>" assets/proof/<filename>.png` (or `npm run fetch-proof -- --query="<query>" --out="assets/proof/<filename>.png"`).
   Never edit `runtime/build_proof.py` for content.
4. Before validation, read the fifteen sentences aloud and inspect the six proof images at phone size. Fix A/B pairs that do not answer the same viewer question, unclear labels, awkward spoken grammar, repeated lessons, whole-page screenshots, and proof that cannot be understood in one second.
5. Run `python3 runner.py validate` before voice generation.
6. Report the Fish model and voice: `Mugsy Explains - Official Voice` (`a126d52c2d20443bb024aeef10e741bf`, `$0 on s2.1-pro-free`).
7. Ask once before generating new narration.
8. Run `python3 runner.py render` with `FISH_STUDIO_APIKEY` in the environment.
9. Run `python3 runner.py inspect` and show the contact sheet.
10. Ask the user to confirm voice identity, pronunciation, and creative fit.
11. Run `python3 runner.py finalize --human-review pass` only after approval.
12. Return the final playable MP4.
13. (Optional) Run `node runtime/publish.mjs --dry-run inputs/distribution.json goldens/wiggly-format-explainer.mp4` to validate social distribution.

Stop loudly on missing tools, keys, invalid content, failed inspection, or an unapproved voice. Do not switch providers. Do not make image- or video-generation calls.

## Multi-Platform Social Distribution (Optional)

When a Mugsy Explains video is rendered and approved, the agent can distribute it across YouTube Shorts, Instagram Reels, TikTok, and X via the packaged `runtime/publish.mjs` CLI or connected Buffer MCP tools:

1. **Author platform-tailored copy in `inputs/distribution.json`:**
   - **YouTube Shorts:** Fast, high-intrigue explainer title (≤100 chars), categoryId (`27` for Education or `28` for Tech), strictly vertical (9:16, ≤60s).
   - **Twitter/X:** Engaging educational hook with core takeaway (≤280 chars total).
   - **Instagram Reels:** Snappy caption with relevant hashtags (vertical 9:16).
   - **TikTok:** Punchy curiosity hook with trending tags (≤2200 chars).
2. **Dry-run validation:**
   ```sh
   node runtime/publish.mjs --dry-run inputs/distribution.json goldens/wiggly-format-explainer.mp4
   ```
3. **Live dispatch requires explicit human sign-off:**
   - Confirm target channels and copy with the user (`approvalRequired: true`).
   - Execute with connected Buffer MCP tools or `node runtime/publish.mjs inputs/distribution.json /path/to/final.mp4`.
   - Generates a verified distribution receipt (`<video>.distribution.json`) with zero secret leakage.

