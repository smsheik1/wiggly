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

## Editorial Engine & Viral Ideation

Think like a viral Shorts creative director. An idea is defined by **1 Visual Layout**, **1 Creative Flavor**, and strict obedience to the **3 Inviolable Hook Laws**.

### 1. The 3 Visual Layouts (Technical Engine)
The renderer only ever composes 3 visual layouts:
1. **The Classic Patrol (80% of episodes):** Two-character dialogue over continuous, seamless Arkham gliding. Fast, zero custom assets needed.
2. **The Universe Breach (Crossovers):** Multi-gameplay routing with scanlines and `assets/sfx/glitch-whoosh.wav` when an outside universe (Spider-Man, Goku, Gojo) cuts in.
3. **The Top 5 Ladder (Rankings):** 5-to-1 left-side ranking ladder with docked thumbnail card reveals (`revealedRanks`, `featuredCard`).

### 2. The 2 Creative Flavors (Ideation Engine)
When scripting dialogue (especially for *The Classic Patrol*), pick one of two proven viral flavors:

- **Flavor A: "Mythology Meets Mundane Reality" (Comedy Goldmine — 5.2M Peak Views)**
  - *Core Tension:* Crash Batman's ultra-serious, mythological persona into gritty, mundane real-world logistics.
  - *Proven Angles:*
    - **Biological:** Not sleeping, peeing in the suit, hiding broken ribs at board meetings (`inputs/how-batman-sleeps.json`).
    - **Bureaucratic / IRS:** Lucius Fox auditing multi-million dollar write-offs for Batmobiles and Kevlar ears.
    - **Gaming Meme / No-Kill:** Robin pointing out that hitting a thug with a 60mph tank breaks the "no-kill rule."
    - **Internet Culture:** Gotham Reddit zooming in on Bruce Wayne's jawline with 40,000 upvotes.
  - *Formula:* Sidekick points out absurdity $\rightarrow$ Batman gives clinical, deadpan rationalization $\rightarrow$ Sidekick comedic disbelief $\rightarrow$ Deadpan punchline.

- **Flavor B: "Deep Lore & Moral Checkmate" (Serious Fan Debates — 767K Peak Views)**
  - *Core Tension:* Two characters in an unyielding ideological deadlock where both sides have a point.
  - *Proven Angles:*
    - **Prep-Time Contingency:** Cold psychological/biochemical plans to take down god-like heroes (Homelander, Superman).
    - **Moral Confrontation:** Jason Todd or Joker grilling Batman on the body count caused by his code (`inputs/batman-vs-the-joker.json`, `inputs/batman-jason-todd.json`).

### 3. The 3 Inviolable Hook Laws
1. **In Media Res Hook (0–3s):** Zero idle small talk. The signature ArkhamStories opener pairs a casual direct address with the provocative question in the **very first breath** (e.g., *"Bruce, serious question: how do you actually survive on no sleep?"* or *"Hey Bruce, quick question: you just hit that thug with an electrified tank, is he alive?"*). Never waste separate turns on polite greeting exchanges (*"Hey Bruce"* $\rightarrow$ *"Yes, Robin?"*). Fire the core question immediately in Turn 1.
2. **Comment Bait:** Always inject an unresolved argument or deadpan logical absurdity that compels viewers to debate in the comments (*"Shattered pelvis is a non-lethal injury"*).
3. **The Hard Clock:** 45–55 seconds total duration (never exceeding 60s); captions max 2 lines of 19 characters each.

### 4. Autonomous Pitching Flow
When a user asks for an episode or says "make a video", pitch **3 contrasting angles** before generating:
> *"Here are 3 viral angles for today's episode:*  
> 1. 🩻 **Mundane Comedy:** *Robin asks how Bruce survives 86 hours without sleep.*  
> 2. ⚡ **Universe Breach:** *Batman breaks down how to counter Spider-Sense until Peter Parker drops in.*  
> 3. ⚖️ **Moral Debate:** *Jason Todd confronts Bruce on why Joker is still breathing.*  
>  
> *Which one do you want to run with? (Or say 'Surprise me' and I'll produce #1!)"*

---

## Autonomous Decision Matrix

When an agent receives an unguided prompt, route deterministically:

1. **Explicit Keyword Matching:**
   - Prompt contains `sleep`, `bathroom`, `bones`, `taxes`, `irs`, `money`, `bruises`, `kill` $\rightarrow$ **Flavor A: Mundane Reality**
   - Prompt contains `vs`, `who wins`, `crossover`, `spider`, `goku` $\rightarrow$ **Universe Breach**
   - Prompt contains `top`, `rank`, `countdown`, `list` $\rightarrow$ **Top 5 Ladder**
   - Prompt contains `debate`, `joker`, `jason`, `moral`, `confront` $\rightarrow$ **Flavor B: Moral Debate**

2. **Ambiguous Fallback ("Make a video", "Surprise me"):**
   - Inspect existing MP4s in `outputs/`.
   - Apply the **Viral Diversity Rule**: Rotate across **Flavor A $\rightarrow$ Universe Breach $\rightarrow$ Top 5 Ladder $\rightarrow$ Flavor B**. Default to **Flavor A** (highest proven viewer appeal with 5.2M views).

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


