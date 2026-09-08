---
name: roast-me-conversations
description: Compose viral social roast and commentary videos (1080x1920 9:16 Shorts) featuring Twitter/X cards, expanding iMessage exchanges, and animated 2D character presenters over background gameplay.
---

# Roast Me Conversations (v0.2.0)

This Format Kit enables autonomous AI agents to script, format, and render viral social roast videos and animated commentary shorts in 1080 × 1920 vertical Shorts.

## Official Runtime & Validation

- **Official Renderer:** `runtime/render.mjs` (the passive compositor; never rewrite or duplicate it).
- **Validation Gate:** Run `node runtime/render.mjs inputs/<episode>.json outputs/<episode>.mp4` (validation is automatic before render).
- **Unit & Smoke Tests:** Run `npm test` and `npm run smoke` before authoring new episodes.

## Supported Format Modes

### 1. Roast Conversation Mode (Canonical)
- **Scene 0 (The Hook):** Centered Twitter/X prompt card with avatar, username handle, roast prompt, and attached selfie photo.
- **Scenes 1..N (The Roast Exchanges):** iOS iMessage conversation threads that expand downward as dialogue bubbles arrive with pop sound effects over continuous Minecraft parkour gameplay.

### 2. Animated Character Presenter & Commentary Mode (SpecularAction Style)
- **Layer Stacking:** Continuous gameplay background -> Centered floating post card in upper half -> 2D animated character presenter anchored in the bottom foreground.
- **Continuous Idle Sway:** Gentle sinusoidal harmonic oscillation ($1.4\text{s}$ period, $\pm 2.2^\circ$ rotation, $\pm 16\text{px}$ sway, $\pm 6\text{px}$ bounce) centered at the bottom bust anchor.
- **Discrete Expression Poses:** Bundled `male` and `female` character presets with `neutral`, `laugh`, `talk`, and `shock` poses.
- **Directional Flipping:** Character mirrors horizontally (`flip: true`) when referencing cards or topics.
- **Dark/Light Theme Support:** Supports both dark theme Twitter/X post cards (`theme: "dark"`) with gold/blue badges and classic light cards.

## Step-by-Step Workflow for Agents

1. **Choose Format Mode:** Decide whether this is a pure text conversation roast or an animated presenter commentary short.
2. **Author the Script:**
   - Define the hook post (author, handle, text, optional image, theme).
   - For conversations: define contacts and dialogue turns.
   - For presenter mode: configure character (`male` | `female`) and emotional cue timestamps (`neutral`, `laugh`, `talk`, `shock`).
3. **Gather Audio & Visual Assets:**
   - Prepare authorized dialogue/voiceover audio clips.
   - Use authorized 9:16 vertical gameplay video (e.g. `assets/gameplay/minecraft-parkour.mp4`).
4. **Render:**
   - Run `node runtime/render.mjs inputs/<episode>.json outputs/<episode>.mp4`.
5. **Inspect:**
   - Run `node tests/verify-proofs.mjs outputs/<episode>.mp4` and inspect frames to confirm layout, character animation, text fitting, and audio synchronization.
6. **Distribute (Optional Multi-Platform Publishing):**
   - Proactively prompt the user: *"Do you want to post this to YouTube, Instagram, or X? (We can blast all three, or just your favorites!)"*
   - Author tailored platform copies:
     - **YouTube Shorts:** Title $\le 100$ characters with `#Shorts #RoastMe` + category ID 23 (Comedy).
     - **Instagram Reels:** Engaging hook caption $\le 2200$ characters + relevant hashtags.
     - **Twitter / X:** Snappy punchline tweet $\le 280$ characters.
     - **TikTok:** Punchy comment-bait caption $\le 2200$ characters.
   - Run preflight validation with `--dry-run`:
     ```bash
     node runtime/publish.mjs inputs/distribution.json outputs/<episode>.mp4 --dry-run
     ```
   - Present the copy and platforms to the user for explicit approval (`approvalRequired: true`).
   - On approval, dispatch to connected social accounts via Buffer MCP or `BUFFER_API_KEY`.
   - Durable receipt is written to `outputs/<episode>.mp4.distribution.json`.

## Conversational Onboarding & Behavioral Guardrails

- **Zero Jargon:** Never show raw JSON payloads, API endpoints, or developer terminology to users in chat.
- **Selective Platforms:** If a user only wants 1 or 2 platforms (e.g. "just post to Twitter"), set `enabled: false` on the others and proceed.
- **Graceful Fallback:** If `BUFFER_API_KEY` is not present, report the saved video and explain how to connect Buffer in 1 simple step without failing the render.
