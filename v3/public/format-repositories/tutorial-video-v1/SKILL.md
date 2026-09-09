---
name: tutorial-video
description: Render a proof-first Wiggly tutorial from editable browser, terminal, narration, caption, checkpoint, and finished-result ingredients using the packaged 16:9 compositor.
---

# Tutorial Video Wiggly Repo (v0.3.0)

Use this skill when a user wants a polished first-run tutorial for a Wiggly
Format. The official renderer is `runner.mjs` plus `runtime/tutorial-video.jsx`.
Never replace it with slides, a second renderer, or a pre-rendered master.

## 0. Intake & Script Critique Protocol

Before composing, conduct a brief 2-to-3 question intake if parameters are unspecified:
1. **Target Format:** Which published Wiggly format are we teaching? (e.g. `character-gameplay-conversations`, `lego-music-video`, `mugsy-explains`).
2. **Audience Angle:** First-Time Creator (zero-code, prompt-focused) vs Developer / Operator (contracts, commands, verification).
3. **Voice Style:** Crisp Tech Walkthrough (Linear/Apple style) vs Casual Creator Walkthrough.

Never ask the user for labor (screenshots, recordings, timestamps). Capture or synthesize them using the runtime tools.

### 0.1 Retention & Proof-First Script Critique Engine (`runtime/critique.mjs`)

Before rendering, run the deterministic 5-law script linter:
```bash
npm run critique [path/to/input.json]
# or: node runtime/critique.mjs [path/to/input.json] --json
```

The critique engine deterministically enforces the **5 Inviolable Tutorial Laws**:
- **Law 1: Proof-First Opening (25 pts)** — Step 1 must be `kind: "hero"` or `"final"` with `nativeAudio: true` and no narrator voiceover (let the finished format speak for itself).
- **Law 2: Imperative Action Titles (20 pts)** — Every step label must begin with a strong action verb (`See`, `Choose`, `Copy`, `Paste`, `Run`, `Inspect`, `Watch`, `Try`).
- **Law 3: Zero Conversational Fluff (20 pts)** — Banned filler phrases (*"Hey guys"*, *"In this video"*, *"Without further ado"*, *"Simply click"*) are penalized. Requires concrete technical/action density.
- **Law 4: Explicit Checkpoint Quality (15 pts)** — Must include at least one verified troubleshooting card (`headline`, `badge`, `eyebrow`) confirming what success looks like.
- **Law 5: Narration-to-Screen Clock & Pacing (20 pts)** — Narration audio must finish within 85-90% of each step's `durationSeconds` to ensure clean transitions, with speech rate under 2.8 words/sec.

A score $\ge 85$ (`PASS`) is required for release.

### 0.2 Autonomous 1-Click Pipeline (`node runner.mjs make`)

To autonomously build a complete tutorial without manual screen recording or manual voiceover typing:
```bash
node runner.mjs make --target=<format-slug> [--audience=creator|developer] [--skip-render]
# Example:
node runner.mjs make --target=mugsy-explains
```

This automated pipeline executes 5 discrete stages:
1. **Harvests** the target format's official proof MP4, renders a 16:9 format page still, and generates a dark-mode macOS terminal graphic (`runtime/harvest.mjs`).
2. **Synthesizes voiceover** audio and computes proportional microsecond subtitle timestamps (`runtime/voice.mjs`).
3. **Writes** `inputs/<target-slug>.json`.
4. **Lints** the script against the 5 Inviolable Tutorial Laws (`runtime/critique.mjs`).
5. **Renders** the official 1920x1080 MP4 through Remotion and generates a step contact-sheet inspection report (`outputs/<target-slug>-tutorial.mp4`).

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

