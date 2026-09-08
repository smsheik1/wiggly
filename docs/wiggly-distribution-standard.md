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
6. **Instructions:** Add Step 8 (or 9) to `SKILL.md` detailing how the coding agent drafts platform copy, requests approval, and returns live links.
