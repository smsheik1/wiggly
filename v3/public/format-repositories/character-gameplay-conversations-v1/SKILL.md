---
name: character-gameplay-conversations
description: Compose supplied authorized gameplay and per-turn character audio into a portrait conversation with a persistent header and timed captions.
---

# Character Gameplay Conversations

Report the exact version from KIT-MANIFEST.json, then read README.md for the complete input contract and limitations. Use only runtime/render.mjs as the official renderer. Run `npm test` and `npm run smoke` after setup before preparing an episode.

1. Confirm Node.js >=22, npm, FFmpeg with libx264/AAC and overlay support, and FFprobe are installed. Install pinned dependencies with `npm ci --ignore-scripts --no-audit --no-fund`, then run `npm test` and `npm run smoke` before real work.
2. **Autonomous Generation (`runtime/generate.mjs`):** When given a creative brief (cast, topic, fan question), run:
   `node runtime/generate.mjs --character1="<Char1>" --character2="<Char2>" --topic="<Topic>" --output="outputs/<name>.mp4"`
   The generator resolves voice models via Fish Audio (`s2.1-pro-free`), synthesizes per-turn dialogue, generates measured two-line captions, cuts curated gameplay, and invokes `runtime/render.mjs`. Use `--dry-run` to validate plan and voice IDs before synthesis.
3. **Manual / Custom Audio Composition:** Put approved media inside this Repo and create a new input JSON using inputs/same-universe.json or inputs/crossover.json as a structural example.
4. Author captions with explicit turn-relative timings and matching transcript text.
5. Run `node runtime/render.mjs inputs/episode.json outputs/episode.mp4`. The output is 1080×1920 vertical (9:16) for Shorts. Output paths must be new.
6. Inspect metadata, sampled frames, and the complete moving video/audio.
7. Deliver the MP4 and its .receipt.json. The receipt records exact argument tokens and media/runtime hashes, including optional music and its attribution. Include required music credits visibly with the delivered/published video.

The included proofs are original synthetic fixtures and tones. They establish supplied-file composition only. Use the same runtime across episodes; content belongs in inputs and assets, not renderer edits.
