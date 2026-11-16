# Vertical Layout Decision Record

- **Chosen Layout:** Layout B (`layout-B-larger-1080x810`)
- **Reviewer:** shaz
- **Reviewed At:** 2026-11-16
- **Reference Candidate Run:** `daily-2026-11-11-pblvmjfr`
- **Clip SHA-256:** `b77bc4b5640c5bf7b39454db5b90ff90fe81c75a5ca68f02ea8af21bf0bd75cf`

## Evaluation Summary

Three candidate vertical letterbox layouts were rendered and inspected side-by-side using local ffmpeg rendering from the reference winner run:
1. **Layout A (Current 1080×608):** Centered letterbox video scaled to 1080×608 at $y=656$, top header at $y=140$, kinetic subtitles at $y=1320$.
2. **Layout B (Larger 1080×810 — CHOSEN):** Centered 16:9 video scaled to 1440×810 and cropped to 1080×810 at $y=500$, top header at $y=180$, kinetic subtitles lowered to $y=1360$. Provides 33% larger visual presence for Shaz and props while retaining clean safe margins.
3. **Layout C (4:5 Crop 1080×1350):** 4:5 vertical crop (1080×1350) centered at $y=310$, top header at $y=45$, subtitles at $y=1470$.

## Layout B Geometry Specifications

- **Total Dimensions:** 1080 × 1920 (9:16 vertical)
- **Atmospheric Background:** Gaussian blurred 16:9 video source stretched to 1080×1920 with boxblur and brightness/contrast leveling.
- **Main Video Window:**
  - Filter: `scale=1440:810,crop=1080:810:(in_w-out_w)/2:0`
  - Position: `overlay=0:500` (occupies $y = [500, 1310]$)
- **Top Header Hook Card:**
  - Canvas: 1080 × 280 SVG overlay with Grobold hook typography and optional category badge pill.
  - Position: `overlay=0:180` (occupies $y = [180, 460]$, leaving 40px clear margin before video)
- **Kinetic Subtitle Overlay:**
  - Canvas: 1080 × 200 SVG phrase overlays with Grobold/Arial Black active word highlight pop (`#FFE600`).
  - Position: `overlay=0:1360` (occupies $y = [1360, 1560]$, leaving 50px clear margin below video and safe clearance from bottom UI buttons).
