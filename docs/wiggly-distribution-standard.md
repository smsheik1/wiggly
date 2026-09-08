# Wiggly Distribution Standard

This standard establishes the official contract and architecture for **automated multi-platform social media distribution** across all Wiggly format repositories.

---

## 1. Motivation: Closing the Creative Loop

Until now, generative video pipelines stopped after rendering:
> *"Here is your MP4 file. Download it, open three different apps, re-type your captions, and manually upload."*

This turns the creator into a manual file-transfer bridge. 

The Wiggly Distribution Standard upgrades a format repo from a passive "rendering script" into an **autonomous media production house**:
1. **Produce:** The agent scripts, mixes audio, and renders 1080×1920 vertical video (`runtime/render.mjs`).
2. **Inspect:** The agent verifies duration, aspect ratio, audio mix, and visual framing.
3. **Approve (Human-in-the-Loop):** The creator watches the preview in chat and provides the "green light."
4. **Distribute:** The agent authors platform-adapted copy and publishes simultaneously to YouTube Shorts, Instagram Reels, TikTok, and X via official APIs.
5. **Record Provenance:** The agent stores live post IDs and URLs in `outputs/<media>.distribution.json`, enabling future analytics and performance feedback loops.

---

## 2. The 6-Stage Pipeline Contract

Every distributable video format repository implements a standard 6-stage pipeline in `pipeline.json`:

```json
{
  "stages": [
    { "id": "check-and-smoke", "output": "Verify local tools and run baseline proofs." },
    { "id": "choose-concept", "output": "Select characters, topic, and format.", "approvalRequired": true },
    { "id": "supply-assets", "output": "Provide gameplay, character audio, and background music." },
    { "id": "prepare-captions", "output": "Author word-timed synchronized subtitles." },
    { "id": "render-and-inspect", "output": "Render official MP4 and inspect contact sheet.", "approvalRequired": true },
    {
      "id": "distribute-episode",
      "output": "Author platform-tailored copy for YouTube Shorts, Instagram Reels, TikTok, and X, present for review, and dispatch to connected social channels via runtime/publish.mjs. Writes live receipts to outputs/episode.distribution.json.",
      "approvalRequired": true
    }
  ]
}
```

### The Non-Negotiable Rule: Explicit Human Approval Gate
* `distribute-episode` **must** declare `"approvalRequired": true`.
* An AI agent must **never** post to public social channels without presenting the rendered video preview and drafted platform copy for explicit user confirmation.

---

## 3. Security & Zero-Leakage BYOK (Bring Your Own Keys)

Following **Wiggly Rule 3** (*Declare requirements without storing secrets*):
* **No credentials live in repo files.** Repositories only declare provider interfaces and environment variable names (e.g. `BUFFER_API_KEY`).
* **Isolation:** When a format package is cloned, downloaded, or shared, it uses the consumer's local environment. It has **zero access** to the original author's social accounts or tokens.
* **Graceful Local Fallback:** If a runner executes on a machine without a configured social publisher:
  - It validates the distribution payload and media integrity.
  - It saves the local MP4 and logs an informative message:  
    `"No social publisher configured in environment. Local media preserved at outputs/episode.mp4."`
  - It exits cleanly with code `0`.

---

## 4. Contract Specifications

### A. Distribution Input (`inputs/distribution.json`)
The agent generates platform-tailored metadata adapting the core topic to each platform's distinct algorithmic and audience conventions:

```json
{
  "schemaVersion": 1,
  "episode": "inputs/crossover.json",
  "media": "outputs/crossover.mp4",
  "mode": "shareNow",
  "platforms": {
    "youtube": {
      "enabled": true,
      "title": "SEO-optimized title under 100 chars #Shorts",
      "description": "Full description with keywords and tags.",
      "categoryId": "20",
      "privacy": "public"
    },
    "instagram": {
      "enabled": true,
      "type": "reel",
      "shouldShareToFeed": true,
      "caption": "Aesthetic line-broken caption with niche hashtags."
    },
    "twitter": {
      "enabled": true,
      "text": "Punchy hook or debate question under 280 characters."
    },
    "tiktok": {
      "enabled": false,
      "caption": "Casual hook with trending tags.",
      "allowDuet": true,
      "allowStitch": true
    }
  }
}
```

### B. Distribution Receipt (`outputs/<media>.distribution.json`)
Every successful publication writes a durable receipt preserving full provenance:

```json
{
  "schemaVersion": 1,
  "status": "published",
  "timestamp": "2026-09-08T21:02:20.769Z",
  "media": "batman-vs-spiderman-crossover.mp4",
  "mediaSha256": "549934118d4ffbced9775b5590e14bbfda36e70e6ba145d44a08bc0603c5e136",
  "receipts": {
    "youtube": { "id": "YpJNregc-rU", "url": "https://www.youtube.com/watch?v=YpJNregc-rU" },
    "instagram": { "id": "DdCm0Q9gsiS", "url": "https://www.instagram.com/reel/DdCm0Q9gsiS/" },
    "twitter": { "id": "2097430297377743143", "url": "https://x.com/1455363696/status/2097430297377743143" }
  }
}
```

---

## 5. Rollout & Backfill Checklist for Existing Repos

To upgrade existing format repos (e.g. `animal-conversations`, `roast-me-conversations`):
1. **Pipeline:** Add `distribute-episode` stage with `approvalRequired: true` to `pipeline.json`.
2. **Requirements:** Add `Social Publisher (Buffer MCP or API)` under `providers` in `requirements.json`.
3. **Runner:** Copy `runtime/publish.mjs` into the repo.
4. **Input:** Add `inputs/distribution.json` template.
5. **Tests:** Add `tests/distribution.test.mjs` verifying stage definitions and `--dry-run` validation.
6. **Instructions:** Update `SKILL.md` with the distribution step, onboarding flow, and behavioral guardrails.

---

## 6. The Conversational Agent Experience & Guardrails

Distribution is not merely a technical pipeline—it is a **human conversation**. The agent must handle users of all technical levels, distractions, and preferences without friction.

### A. Core Philosophy: Zero JSON Friction
The creator should never have to manually edit JSON files on disk just to post a video. The agent:
1. Reads the episode transcript and concept from `inputs/<episode>.json`.
2. Drafts platform-adapted copy in memory.
3. Presents the preview in chat.
4. Dispatches the post via Buffer MCP (or `runtime/publish.mjs`).

### B. The Post-Render Offer (Proactive Trigger)
Immediately upon rendering and keyframe inspection, the agent asks:
> *"Your video is rendered and ready to watch! 🎬*  
> *Do you want to post this to YouTube, Instagram, or X? (We can blast all three, or just your favorites!)"*

### C. The 1-Time Onboarding Experience (First-Time Creators)
If the user wants to post but has not connected their social accounts yet, the agent delivers the 3-minute, zero-jargon onboarding guide:

> **⏱️ Time required:** ~3 minutes (one time only!)  
> **💡 Why it's worth it:** You spend 3 minutes connecting your channels once, and every video you ever create with Wiggly can be published automatically with one click forever.
>
> **Baby Steps:**
> 1. Go to **[buffer.com](https://buffer.com)** (it's 100% free) and sign up or log in.
> 2. Click **Connect Channel** to link whichever accounts you want to post to (YouTube, Instagram, and/or X/Twitter).
> 3. Go to **[buffer.com/manage/apps](https://buffer.com/manage/apps)** and create an API Key (or connect the Buffer MCP server in your agent settings).
>
> Once that's done, just tell me **"I'm back"** and I'll take it from there!

### D. Copy Drafting & Human Approval Gate
When connected (or upon the user saying "I'm back"), the agent presents the drafted copy for the selected platforms:
- **YouTube Shorts:** High-CTR title with hook (<100 chars), `#Shorts`, 3–4 hashtags, concise description.
- **Instagram Reels:** Engaging caption with clean vertical line breaks and 3–5 niche hashtags.
- **X (Twitter):** Viral quote, debate question, or hook under 280 characters.

> *"Here is what I'll post to your channels:*  
> *🔴 **YouTube Shorts:** [Title & Description]*  
> *🟣 **Instagram Reels:** [Caption]*  
> *⚪ **X / Twitter:** [Post Text]*  
> 
> *Ready to publish? Say **'Go'** or let me know if you'd like any tweaks!"*

### E. Live Publication & Provenance
Once the user confirms ("Go", "Yes", "Looks good"):
1. The agent publishes via Buffer MCP `create_post` (or `runtime/publish.mjs`).
2. Durable live receipts are saved to `outputs/<episode>.distribution.json`.
3. Clickable live URLs are returned directly in chat.

### F. Behavioral Guardrails (The Human Factor)

| User Behavior | Agent Response Protocol |
| :--- | :--- |
| **Confused / Non-Technical**<br>*"What is Buffer?", "Where do I click?"* | Explain in plain English without developer jargon. Break instructions into **one single micro-step at a time** instead of pasting walls of text. |
| **Off-Topic / Distracted**<br>*"Did you see the new Batman trailer?", "What model are you?"* | Be human and friendly! Respond warmly in 1–2 sentences, then gently tether back:<br>*"By the way, whenever you're ready, we can still post that episode to your socials—just say the word!"* |
| **Frustrated / Overwhelmed**<br>*"Ugh this is too much work", "Never mind", "Just give me the video"* | Instant de-escalation with zero guilt or friction:<br>*"No problem at all! You don't have to set anything up. Your video is already saved at `outputs/<episode>.mp4`—you can download it and post it manually whenever you like."* |
| **Selective Platforms**<br>*"Just post to Twitter", "Only YouTube"* | Respect their choice immediately. Never push them to connect or publish to platforms they didn't ask for. |

