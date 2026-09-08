---
name: character-gameplay-conversations
description: Compose gameplay footage and per-turn character dialogue into vertical Shorts (1080x1920) across three supported sub-formats: 1v1 Debates, Top 5 Countdown Rankings, and Hypothetical Matchup Breakdowns.
---

# Character Gameplay Conversations (v0.2.0)

This Format Kit is built for autonomous AI agents to write, voice, and render high-retention character dialogue Shorts over continuous gameplay footage.

## Official Runtime & Validation

- **Official Renderer:** `runtime/render.mjs` (the passive compositor; never rewrite or duplicate it).
- **Validation Gate:** Run `node runtime/render.mjs --validate inputs/<episode>.json` before rendering.
- **Unit & Smoke Tests:** Run `npm test` and `npm run smoke` before authoring new episodes.

---

---

## 3 Supported Sub-Formats & Editorial Routing

Think like a viral Shorts editor. Match the format to the viewer's psychological itch:

### 1. 1v1 Debate / Moral Clash (Drama & Philosophy)
- **Viewer Itch:** Fans want deep lore, moral tension, and philosophical arguments between two characters who know each other well.
- **Formula:** `[Character A]` confronts `[Character B]` over a deep moral failure, broken code, or betrayal.
- **Pacing & Visuals:** Steady, high-intensity gameplay (e.g. Arkham gliding) letting the dialogue breathe without visual interruptions.
- **Reference Example:** `inputs/batman-vs-the-joker.json`, `inputs/batman-jason-todd.json`

### 2. Top 5 Countdown Rankings (Curiosity & Retention)
- **Viewer Itch:** High scroll-stopping retention. Viewers cannot swipe away because they want to find out who or what takes the #1 spot.
- **Formula:** Robin asks Batman: *"Who/What are your Top 5 [opponents you secretly respect / most dangerous gadgets / biggest Gotham mistakes]?"*
- **Visuals & Contract:** Left-side ranking ladder (`1.` to `5.`) with docked thumbnail cards revealed turn-by-turn (`revealedRanks: [5, 4, ...]`) plus optional center cards (`featuredCard: { label, image }`).
- **Reference Example:** `inputs/top-5-batman-villains.json`

### 3. Hypothetical Matchup & Multi-Universe Crossover (Hype & Spectacle)
- **Viewer Itch:** Power-scaling debates and unexpected spectacle. The viral "wait, what?!" moment when another hero crashes the scene and the game world changes.
- **Formula:** Batman & Robin discuss how to defeat `[Character X]`, when `[Character X]` suddenly interrupts, cutting the footage dynamically to their game universe with digital scanline glitches and whoosh SFX.
- **Visuals & Contract:** Multi-gameplay routing via `input.gameplays` and `turn.gameplay`, with `assets/sfx/glitch-whoosh.wav` mixed at intro and cut points.
- **Reference Example:** `inputs/batman-vs-spiderman-crossover.json`, `inputs/batman-vs-goku.json`

---

## Autonomous Decision Matrix

When an agent receives a prompt, route deterministically without guessing:

1. **Explicit Keyword Matching:**
   - Prompt contains `top`, `rank`, `countdown`, `list`, `best`, `worst` $\rightarrow$ **Top 5 Countdown Rankings**
   - Prompt contains `vs`, `who wins`, `could beat`, `fight`, `crossover`, or two characters from different franchises $\rightarrow$ **Multi-Universe Crossover**
   - Prompt contains `argue`, `debate`, `truth`, `confront`, `philosophy`, or two characters from the same franchise $\rightarrow$ **1v1 Debate**

2. **Autonomous / Ambiguous Fallback ("Make a video", "Surprise me"):**
   - Inspect existing MP4s in `outputs/` or previous session context.
   - Apply the **Viral Diversity Rule**: Pick whichever sub-format was least recently produced (Rotation: **Crossover $\rightarrow$ Countdown $\rightarrow$ Debate**).
   - If starting fresh, default to **Multi-Universe Crossover** (highest initial spectacle) or **Top 5 Countdown** (highest retention).

---

## Agent Toolkit (`tools/`)

Use these focused CLI tools to gather assets and synthesize voice lines:

1. **Fetch Card / Thumbnail Image:**
   ```bash
   node tools/fetch-card.mjs "<character or item query>" <output-path.png>
   ```
   *Uses DuckDuckGo's visual index (powered by Bing) + Sharp to download and crop a square card with zero API keys and zero cost.*

2. **Synthesize Voice Line:**
   ```bash
   node tools/synthesize.mjs --speaker="<name or id>" --text="<text>" --output="<output-path.wav>"
   ```
   *Uses Fish Audio's free tier (`s2.1-pro-free`) with built-in voice presets for Batman, Robin, Joker, Jason Todd, Spider-Man, Venom, and others. Outputs duration and provenance JSON.*

3. **Fetch Gameplay Footage:**
   ```bash
   node tools/fetch-gameplay.mjs "<gameplay query>" <output-path.mp4> [--duration=60] [--offset=10]
   ```
   *Fetches clean gameplay clips (e.g. Arkham Knight, Spider-Man 2 PS5) using yt-dlp section cutting.*

---

## Agent Workflow

1. **Decide Sub-Format:** Determine whether the episode is a Debate, a Countdown, or a Matchup Breakdown.
2. **Author Dialogue:** Write punchy, in-character lines (target 45–55s total duration; maximum 60s).
3. **Fetch Assets:** Use `tools/fetch-card.mjs` for any villain cards, ranking thumbnails, or opponent portraits.
4. **Synthesize Audio:** Run `tools/synthesize.mjs` for each dialogue turn.
5. **Format Subtitles:** Subtitles must fit max two lines of 19 characters each (max 38 characters per phrase).
6. **Validate:** Run `node runtime/render.mjs --validate inputs/<episode>.json`.
7. **Render:** Run `node runtime/render.mjs inputs/<episode>.json outputs/<episode>.mp4`.
8. **Inspect:** Extract sample keyframe PNGs via `ffmpeg -ss <time> -i outputs/<episode>.mp4 -frames:v 1 frame.png` and use `view_file` on the extracted PNGs to visually verify layout, typography, cards, glitch effects, and subtitles.
