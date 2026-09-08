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
9. **Distribute (Stage 6):** Proactively offer multi-platform distribution in chat. Follow the **Distribution & Social Onboarding Protocol** below to guide setup if needed, present platform-adapted copy for human approval, publish via Buffer MCP (or `runtime/publish.mjs`), and return live post links.

---

## Distribution & Social Onboarding Protocol

When video rendering and keyframe inspection finish, the agent must guide the creator through effortless multi-platform distribution.

### 1. The Post-Render Offer (Always Ask Proactively)
Immediately after presenting the rendered video:
> *"Your video is rendered and ready to watch! 🎬*  
> *Do you want to post this to YouTube, Instagram, or X? (We can blast all three, or just your favorites!)"*

### 2. If the User Says Yes (or Names Platforms)
Check if a social publisher is already configured (e.g. Buffer MCP tools are active or `BUFFER_API_KEY` is present in the environment).

#### Case A: First-Time User (Not Connected Yet)
Deliver the 3-minute, zero-jargon setup guide:
> **⏱️ Time required:** ~3 minutes (one time only!)  
> **💡 Why it's worth it:** You spend 3 minutes connecting your channels once, and every video you ever create with Wiggly can be published automatically with one click forever.
>
> **Baby Steps:**
> 1. Go to **[buffer.com](https://buffer.com)** (it's 100% free) and sign up or log in.
> 2. Click **Connect Channel** to link whichever accounts you want to post to (YouTube, Instagram, and/or X/Twitter).
> 3. Go to **[buffer.com/manage/apps](https://buffer.com/manage/apps)** and create an API Key (or connect the Buffer MCP server in your agent settings).
>
> Once that's done, just tell me **"I'm back"** and I'll take it from there!

#### Case B: Connected (or User Says "I'm back")
Draft tailored copy directly in chat from the episode's hook, characters, and dialogue (no manual JSON editing needed from the user):
- **YouTube Shorts:** High-CTR title with hook (<100 chars), `#Shorts`, 3–4 hashtags, concise description.
- **Instagram Reels:** Attention-grabbing caption with clean spacing and 3–5 niche hashtags (`#batman #gaming #arkhamknight`).
- **X (Twitter):** Viral quote, debate question, or hook under 280 characters.

Present the preview clearly:
> *"Here is what I'll post to your channels:*  
> *🔴 **YouTube Shorts:** [Title & Description]*  
> *🟣 **Instagram Reels:** [Caption]*  
> *⚪ **X / Twitter:** [Post Text]*  
> 
> *Ready to publish? Say **'Go'** or let me know if you'd like any tweaks!"*

### 3. Publication & Receipt Delivery
Once the user gives the green light ("Go", "Yes", "Looks good"):
1. Call Buffer MCP `create_post` (or run `node runtime/publish.mjs inputs/distribution.json outputs/<episode>.mp4`).
2. Write the live results to `outputs/<episode>.distribution.json`.
3. Deliver the clickable live links directly in chat:
   > *"🚀 Live on all platforms!*  
   > *- 🔴 **YouTube Shorts:** <url>*  
   > *- 🟣 **Instagram Reels:** <url>*  
   > *- ⚪ **X / Twitter:** <url>*  
   > 
   > *Local master video is saved at `outputs/<episode>.mp4`."*

---

## Behavioral Guardrails (The Human Factor)

- **Confused / Non-Technical Users ("What is Buffer?", "Where do I click?"):**  
  Explain in plain English without developer jargon. If they get stuck, give them only **one** micro-action at a time.
- **Off-Topic / Distracted Users ("Did you see the new Batman trailer?", "What model are you?"):**  
  Respond warmly and conversationally in 1–2 sentences, then gently tether back:  
  *"By the way, whenever you're ready, we can still post that episode to your socials—just say the word!"*
- **Frustrated / Overwhelmed Users ("Ugh this is too much work", "Never mind", "Just give me the video"):**  
  De-escalate immediately with zero guilt or friction:  
  *"No problem at all! You don't have to set anything up. Your video is already saved at `outputs/<episode>.mp4`—you can download it and post it manually whenever you like."*
- **Selective Users ("Just post to Twitter", "Only YouTube"):**  
  Respect their choice instantly. Never push them to connect or publish to platforms they didn't ask for.


