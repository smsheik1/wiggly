# Roast Me Conversations

Public baseline **0.1.0**, for **9:16 Shorts at 1080 × 1920**. A viral social roast format. Opens with a floating Twitter/X card over continuous vertical gameplay, transitioning into rapid iMessage roast exchanges that expand downward with audio and pop sound effects.

Run `npm test` and `npm run smoke` from this folder to verify offline baseline contracts.

## Format Overview

The video structure is modeled after viral social media roasts (e.g. *r/RoastMe* and texting family/friends):
1. **Scene 0 (Hook):** A floating social post card with author avatar, verified badge, handle, prompt text, selfie photo, timestamp, and metrics over continuous vertical gameplay (Minecraft parkour).
2. **Scenes 1..N (Roast Threads):** Floating iOS iMessage conversation cards that start with a contact header (`Mama >`, `Ben >`, `Dad >`, etc.) and dynamically expand downwards as blue (victim) and gray (roaster) message bubbles pop in with synchronized audio and iOS message sound effects.

## Setup and Quick Verification

Requires Node.js >=22, npm, Sharp 0.34.5, FFmpeg (with libx264, AAC, and standard filter support), and FFprobe.

```sh
npm test
npm run smoke
```

To render an episode:
```sh
node runtime/render.mjs inputs/family-friends-roast.json outputs/family-friends-roast.mp4
node runtime/render.mjs inputs/startup-pitch-roast.json outputs/startup-pitch-roast.mp4
node tests/verify-proofs.mjs outputs/family-friends-roast.mp4 outputs/startup-pitch-roast.mp4
```

## Input Contract

Inputs are defined in JSON with the following structure:
- `schemaVersion`: 1
- `topic`: Descriptive string
- `gameplay`: Object with `file`, `authorized: true`, and `provenance`
- `hook`: Social card definition:
  - `authorName`, `handle`, `text`, `timestamp`, `metrics`
  - `avatarImage`, `selfieImage`
  - `durationSeconds`, `audio` object with `file`, `authorized: true`, and `provenance`
- `contacts`: Array of contacts (`id`, `name`, `initial` or `avatarImage`)
- `scenes`: Array of conversation scenes:
  - `contactId`: ID referencing an entry in `contacts`
  - `turns`: Array of dialogue turns (`speaker: "victim" | "contact"`, `text`, `durationSeconds`, `audio`)
