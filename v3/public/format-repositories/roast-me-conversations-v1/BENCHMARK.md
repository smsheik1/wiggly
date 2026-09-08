# Roast Me Conversations — Evidence and History

## Initial Authoring Record (v0.1.0)

- **Source Reference:** YouTube Short "r/RoastMe v1" (https://www.youtube.com/shorts/nCVTDHdV7gA), SHA-256 `8c7a186f5dbef329490646c47ee4e73621da78341c71db30c95c8b306521d3d5`.
- **Approved Blueprint:** SHA-256 `d4bca603336e92d59fb3b96cd21f66d0f87588708f5f7a708a639e7de9183c62`.
- **Official Runtime:** `runtime/render.mjs`, SHA-256 `075d465e6e10efb9a9570e1aa36daa0583efa4c245b1b32542125c1a145b3958`.
- **Compositor Engine:** Node.js + Sharp (vector SVG rasterization) + FFmpeg (overlay filter, amix/adelay/alimiter audio mixing). 1080x1920 (9:16 vertical), 25 fps H.264/AAC.
- **Two Completed Proofs:**
  1. `proofs/family-friends-roast-0.1.0.mp4` (39.17s) — Canonical reference proof with tweet hook and 3 contacts (Mom, Ben, Dad).
  2. `proofs/startup-pitch-roast-0.1.0.mp4` (36.44s) — Domain-transfer proof with tech founder tweet hook and 2 contacts (Marc, Alex).
- **Automated Verification:**
  - `npm test`: 4 contract unit tests passed.
  - `npm run smoke`: Offline 5.2s test rendered and verified in ~1.3s with zero external network or paid API calls.
  - `verify-proofs.mjs`: Stream codecs, 1080x1920 dimensions, 25 fps, 48kHz audio, and white card pixel density verified.
- **Limitations:**
  - Speech audio clips were prepared as pre-cut WAV assets; live TTS generation is not bundled in this baseline release.
  - Typography uses platform-native system sans-serif fonts.
