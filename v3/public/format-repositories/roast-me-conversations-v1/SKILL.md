---
name: roast-me-conversations
description: Compose viral social roast videos (1080x1920 9:16 Shorts) featuring a Twitter/X hook card and expanding iMessage roast exchanges over background gameplay.
---

# Roast Me Conversations (v0.1.0)

This Format Kit enables autonomous AI agents to script, format, and render viral social roast videos in 1080 × 1920 vertical Shorts.

## Official Runtime & Validation

- **Official Renderer:** `runtime/render.mjs` (the passive compositor; never rewrite or duplicate it).
- **Validation Gate:** Run `node runtime/render.mjs --validate inputs/<episode>.json` before rendering.
- **Unit & Smoke Tests:** Run `npm test` and `npm run smoke` before authoring new episodes.

## The Viral Roast Formula

1. **Scene 0 (The Hook):**
   - Centered Twitter/X card with author name, verified check, username handle, roast prompt, timestamp, and metrics.
   - Attached selfie / photo representing the victim.
   - Opening voiceover establishing the premise ("I asked my family to roast me and they did NOT hold back...").
2. **Scenes 1..N (The Roast Exchanges):**
   - Each contact begins with an iOS header (`[Contact Name] >`, unread indicator `< 14`, FaceTime icon).
   - Dynamic window expansion: card starts compact and expands downward as speech bubbles arrive.
   - Alternating blue bubbles (victim) and gray bubbles (contact roast).
   - Synchronized audio voice clips and synthesized iOS message pop sound effects.
   - Continuous high-retention vertical gameplay (e.g. Minecraft parkour) visible beneath the floating card.

## Step-by-Step Workflow for Agents

1. **Author the Script:**
   - Define a victim prompt (e.g. asking family, friends, coworkers, or investors to roast them).
   - Write 2-4 contact scenes with 2-4 turns each. Keep roasts punchy, witty, and escalating in severity.
2. **Gather Audio & Visual Assets:**
   - Prepare authorized audio files for each turn and the hook.
   - Provide victim selfie image and avatar images or initials for contacts.
   - Use authorized 9:16 vertical gameplay video (e.g. `assets/gameplay/minecraft-parkour.mp4`).
3. **Validate:**
   - Run `node runtime/render.mjs --validate inputs/<episode>.json` to check duration, contacts, and assets.
4. **Render:**
   - Run `node runtime/render.mjs inputs/<episode>.json outputs/<episode>.mp4`.
5. **Inspect:**
   - Run `node tests/verify-proofs.mjs outputs/<episode>.mp4` and sample frames to confirm layout, text fitting, and audio synchronization.
