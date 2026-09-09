---
name: tutorial-video
description: Render a proof-first Wiggly tutorial from editable browser, terminal, narration, caption, checkpoint, and finished-result ingredients using the packaged 16:9 compositor.
---

# Tutorial Video Wiggly Repo (v0.3.0)

Use this skill when a user wants a polished first-run tutorial for a Wiggly
Format. The official renderer is `runner.mjs` plus `runtime/tutorial-video.jsx`.
Never replace it with slides, a second renderer, or a pre-rendered master.

## Required loop

1. Run `node runner.mjs doctor` and stop if a required local tool is missing.
   Run every command sequentially; never launch two Remotion commands together.
   If `localhostPort` is false, request permission to bind a temporary localhost
   port before the first render. This is local browser access, not a provider.
2. Read `input-contract.json`, `composition-contract.json`, and one complete
   example input.
3. Gather permitted ingredients under `media/`: the real Wiggly page, the real
   coding-agent or terminal flow, supplied narration, and the finished format
   video. Preserve authorization and provenance for each file.
4. Create an ingredient JSON with at least one browser step, one terminal step,
   two narrated/captioned steps, one checkpoint, and one native-audio final.
5. Run `node runner.mjs validate --input=<input.json>` before rendering.
6. Run `node runner.mjs render --input=<input.json> --output=<output.mp4>`.
7. Run `node runner.mjs inspect --input=<output.mp4> --report=<report.json>` and
   inspect the generated contact sheet.
8. Have a human watch and hear the entire MP4. Only then create an approval JSON
   from `fixtures/creative-review.example.json` and use `runner.mjs finalize`.

`npm test` already includes the official smoke render. Do not also run
`npm run smoke` during the same preflight; the latter is a standalone shortcut.
Bundled example inputs may be rerun unchanged as proofs. For a new target, use
`runner.mjs init` and edit the new input; never overwrite an included example.

## Format grammar

- Open with the finished result so the value is obvious before explanation.
- Use the bundled lime, blue, and cream grid backgrounds.
- Put browser/terminal media inside the compositor's visible macOS window.
- Keep numbered badges at the top, captions in reserved lower space, the neon
  checkpoint above the progress rail, and the progress rail visible throughout.
- Preserve result audio in hero/final sections. Never narrate over the final.
- Keep language concrete: choose a format, copy it, send it, render, inspect,
  and watch.

## Hard boundaries

- `sourceVideo` is forbidden. Supply editable ingredients.
- Do not rewrite or bypass the official compositor.
- Do not claim URL download, transcription, synthetic speech, or screen capture
  is built into the Repo.
- Do not invent permissions, provenance, captions, or narration approval.
- Do not loop short media or freeze its final frame to hide missing footage.
- There are no providers in this kit. Before any paid generation, show the
  estimate and wait for explicit approval.
- Do not misread a sandbox's denied localhost port as missing media. Grant the
  local Remotion browser/port permission before the first render attempt.
- Automated metadata and contact-sheet checks do not replace complete human
  audiovisual review.

## Commands

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test
node runner.mjs init --output=my-tutorial.json
node runner.mjs validate --input=my-tutorial.json
node runner.mjs render --input=my-tutorial.json --output=my-tutorial.mp4
node runner.mjs inspect --input=my-tutorial.mp4 --report=quality-report.json
```

## Multi-Platform Social Distribution (Optional)

When a tutorial video is rendered and approved, the agent can distribute it across YouTube, Instagram, TikTok, and X via the packaged `runtime/publish.mjs` CLI or connected Buffer MCP tools:

1. **Author platform-tailored copy in `inputs/distribution.json`:**
   - **YouTube:** High-retention title (≤100 chars), categoryId (`27` for Education or `28` for Science & Technology). Handles standard 16:9 video or vertical Shorts automatically based on aspect ratio.
   - **Twitter/X:** Engaging educational hook with key takeaways (≤280 chars total).
   - **Instagram:** Informative caption with relevant hashtags (feed video or Reels).
   - **TikTok:** Engaging caption with trending tutorial tags (≤2200 chars).
2. **Dry-run validation:**
   ```sh
   node runtime/publish.mjs --dry-run inputs/distribution.json examples/animal-conversations-first-run/final.mp4
   ```
3. **Live dispatch requires explicit human sign-off:**
   - Confirm target channels and copy with the user (`approvalRequired: true`).
   - Execute with connected Buffer MCP tools or `node runtime/publish.mjs inputs/distribution.json /path/to/final.mp4`.
   - Generates a verified distribution receipt (`<video>.distribution.json`) with zero secret leakage.

