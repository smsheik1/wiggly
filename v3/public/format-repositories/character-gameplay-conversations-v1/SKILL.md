---
name: character-gameplay-conversations
description: Compose gameplay footage and per-turn character dialogue into vertical Shorts (1080x1920) across three supported sub-formats: 1v1 Debates, Top 5 Countdown Rankings, and Hypothetical Matchup Breakdowns.
---

# Batman Arkham Conversations (v0.2.0)

This Format Kit is built for autonomous AI agents to write, voice, and render high-retention character dialogue Shorts over continuous gameplay footage.

## Official Runtime & Validation

- **Official Renderer:** `runtime/render.mjs` (the passive compositor; never rewrite or duplicate it).
- **Validation Gate:** Run `node runtime/render.mjs --validate inputs/<episode>.json` before rendering.
- **Unit & Smoke Tests:** Run `npm test` and `npm run smoke` before authoring new episodes.

---

---

## 4 Supported Sub-Formats & Editorial Routing

Think like a viral Shorts editor. Match the format to the viewer's psychological itch:

### 1. Physiology & Human Reality Q&A (The #1 Viral Hit - 5.2M Peak Views)
- **Viewer Itch:** Relatability, humor, and grounded fascination. Viewers love seeing mythological superheroes subjected to ridiculous real-world human limits (sleep, bathroom, broken bones, calories, money, hiding bruises, bullet dodging).
- **Formula:** Sidekick/apprentice (Robin) or Butler (Alfred) asks an incredulous, unfiltered biological or logistical question. Hero (Batman) responds with deadpan, hyper-detailed, pseudo-medical/scientific protocol (e.g. polyphasic REM micro-naps, dropping resting heart rate to 40 bpm, bone micro-fracture calcification). Sidekick reacts with modern comedic disbelief; Hero lands an iconic deadpan punchline.
- **Visuals & Pacing:** Single continuous Arkham Knight gliding or nighttime city traversal. Two-speaker dialogue letting the comedic timing, pacing, and deadpan delivery drive maximum comment-section virality.
- **Reference Examples:** `inputs/how-batman-sleeps.json` (5.2M views on @ArkhamStories), *Where He Keeps Batarangs* (339K), *How He Hides Bruises* (308K), *How He Recovers* (295K), *How He Pees* (285K).

### 2. Hypothetical Matchup & Multi-Universe Crossover (Hype & Spectacle)
- **Viewer Itch:** Power-scaling debates and unexpected spectacle. The viral "wait, what?!" moment when another hero crashes the scene and the game world changes.
- **Formula:** Batman & Robin discuss how to defeat `[Character X]`, when `[Character X]` suddenly interrupts, cutting the footage dynamically to their game universe with digital scanline glitches and whoosh SFX.
- **Visuals & Contract:** Multi-gameplay routing via `input.gameplays` and `turn.gameplay`, with `assets/sfx/glitch-whoosh.wav` mixed at intro and cut points.
- **Reference Examples:** `inputs/batman-vs-spiderman-crossover.json` (767K views on @ArkhamStories), `inputs/batman-vs-goku.json` (437K), *Destroy Gojo* (711K), *Hellbat vs Kratos* (473K).

### 3. Top 5 Countdown Rankings (Curiosity & Retention)
- **Viewer Itch:** High scroll-stopping retention. Viewers cannot swipe away because they want to find out who or what takes the #1 spot.
- **Formula:** Robin asks Batman: *"Who/What are your Top 5 [opponents you secretly respect / most dangerous gadgets / biggest Gotham mistakes]?"* Batman counts down from #5 to #1.
- **Visuals & Contract:** Left-side ranking ladder (`1.` to `5.`) with docked thumbnail cards revealed turn-by-turn (`revealedRanks: [5, 4, ...]`) plus optional center cards (`featuredCard: { label, image }`).
- **Reference Examples:** `inputs/top-5-batman-villains.json` (648K views on @ArkhamStories), *5 Villains That Actually Scare Him* (229K), *5 Villains He Actually Respects* (175K).

### 4. 1v1 Debate / Moral Clash (Drama & Philosophy)
- **Viewer Itch:** Fans want deep lore, moral tension, and philosophical arguments between two characters who know each other well.
- **Formula:** `[Character A]` confronts `[Character B]` over a deep moral failure, broken code, or betrayal.
- **Pacing & Visuals:** Steady, high-intensity gameplay (e.g. Arkham gliding) letting the dialogue breathe without visual interruptions.
- **Reference Examples:** `inputs/batman-vs-the-joker.json` (451K views on @ArkhamStories), `inputs/batman-jason-todd.json`.

---

## Autonomous Decision Matrix

When an agent receives a prompt, route deterministically without guessing:

1. **Explicit Keyword Matching:**
   - Prompt contains `sleep`, `eat`, `food`, `pee`, `bathroom`, `bones`, `bruises`, `survive`, `heal`, `batarangs`, `suit`, `money`, `real life`, `biology`, `human` $\rightarrow$ **Physiology & Human Reality Q&A**
   - Prompt contains `vs`, `who wins`, `could beat`, `fight`, `crossover`, or two characters from different franchises $\rightarrow$ **Multi-Universe Crossover**
   - Prompt contains `top`, `rank`, `countdown`, `list`, `best`, `worst` $\rightarrow$ **Top 5 Countdown Rankings**
   - Prompt contains `argue`, `debate`, `truth`, `confront`, `philosophy`, or two characters from the same franchise $\rightarrow$ **1v1 Debate**

2. **Autonomous / Ambiguous Fallback ("Make a video", "Surprise me"):**
   - Inspect existing MP4s in `outputs/` or previous session context.
   - Apply the **Viral Diversity Rule**: Pick whichever sub-format was least recently produced (Rotation: **Physiology Q&A $\rightarrow$ Crossover $\rightarrow$ Countdown $\rightarrow$ Debate**).
   - If starting fresh, default to **Physiology & Human Reality Q&A** (highest proven viewer appeal with 5.2M peak views) or **Multi-Universe Crossover** (highest spectacle).

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
9. **Distribute (Stage 6):** Author platform-tailored copy in `inputs/distribution.json` (YouTube Shorts title/tags, Instagram Reel caption, Twitter/X teaser). Present for human review and approval. Once approved, run `node runtime/publish.mjs inputs/distribution.json outputs/<episode>.mp4` (or dispatch via Buffer MCP). Return the recorded live links from `outputs/<episode>.distribution.json` to the user alongside the finished MP4.

