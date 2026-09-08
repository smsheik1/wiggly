---
name: wiggly-video-meme
description: Turn one buyer truth into a short reaction-clip meme with a local MP4 render.
---

# Wiggly Video Meme

Use this skill when someone wants a short brand meme.

## Start

If the user gave you a website or brand brief, start the run.

If they only sent this Format, ask:

`What website or brand should this meme be for?`

Ask one question at a time.

If they have no website, ask:

`In one sentence, who is it for and what problem do they have?`

Do not ask about a budget.
Do not ask them to pick a model.
Do not ask them to pick a clip unless they asked for control.

Defaults:

- Template: Pick for me
- Caption options: 3
- Output: One MP4
- Provider cost: $0

## Modes

If the user says `do it for me` or `Turbo`, choose the template and strongest caption.

Otherwise use Guide Me:

- Research the brand.
- Pick the best template.
- Show three captions.
- Ask which caption to use.
- Render the selected meme.

## Progress

Show this line during the run:

`Research → Pattern → Caption → Render → Deliver`

Start every update with the current step:

- `Step 1 of 5: Research`
- `Step 2 of 5: Pattern`
- `Step 3 of 5: Caption`
- `Step 4 of 5: Render`
- `Step 5 of 5: Deliver`

Keep updates short.

## Run

Run all commands from the downloaded kit's `v3` directory.

1. Run `npm run format:video-meme -- check`.
2. Start one run:
   - Website: `npm run format:video-meme -- init --run=<id> --url=<url>`
   - No website: `npm run format:video-meme -- init --run=<id> --brief="<one sentence>"`
3. Read `prompts/research.md`.
4. Use your web tools for website research.
5. Fill the run's `research.json`.
6. Read `prompts/template-selection.md`.
7. Pick one template and set it in `meme-plan.json`.
8. Run `prompt`.
9. Read the generated `caption-prompt.txt`.
10. Write three caption options yourself.
11. In Guide Me, show the three options and ask:

    `Which caption should I use? Say 1, 2, 3, or pick for me.`

12. In Turbo, pick the strongest caption.
13. Save the selected option and evidence indexes in `meme-plan.json`.
14. Run `validate`.
15. Run `estimate`.
16. Show the selected template, caption, and estimate.
17. Run `render`.
18. Run `inspect`.
19. Let the user watch the complete MP4.
20. If it is good, run `finalize --approve-final`.

Use `resume --run=<id>` after an interruption.

## Estimate

Before render, show:

```text
Run estimate

- Research: $0 Wiggly provider cost
- Caption: $0 separate provider cost
- Source clip: bundled
- MP4 render: local

Total: $0 Wiggly provider cost
```

## Template Rules

### Bear Sniff

- Expose a private thought or guilty habit.
- Start with `This bear sniffs`.
- Use `caught` unless only a strong flattering angle fits.
- One caption.

### Pingu Noot Noot

- Start with a calm thought.
- End with one specific reversal.
- Use `comic_dread`.
- Save `setupText` and `dreadText`.

### Darwin Journey

- Name a specific person.
- Name the connected pain stack they survived.
- Use `customer_pain`, `business_pain`, or `goofy_exaggeration`.
- One caption.

## Caption Rules

- The clip carries the joke.
- The caption is flat and short.
- Never name the brand or product.
- Never add a CTA, hashtag, emoji, or hype.
- Never invent a number or claim.
- Tie the idea to saved evidence.
- A competitor swap should make the caption feel wrong.

## Provider Rules

- No API key is required.
- This workflow has no image provider call.
- This workflow has no video provider call.
- This workflow has no voice provider call.
- This workflow has no Replicate call.
- The portable runner has no separate LLM API call.
- The host agent writes the caption.
- The bundled clip and local Remotion renderer make the MP4.
- Never add a provider fallback.
- Never hide an error.

## Good Result

- A stranger understands the joke at once.
- The caption feels true to the brand's buyer.
- The caption matches the selected reaction.
- The caption stays readable.
- The final MP4 is 1080 × 1350.
- The clip length is correct.
- Source audio is kept when it exists.
- The user watches the full result before approval.

## Multi-Platform Social Distribution (Optional)

When a video meme is finalized and approved, the agent can distribute it across YouTube Shorts, Instagram Reels, TikTok, and X via the packaged `runtime/publish.mjs` CLI or connected Buffer MCP tools:

1. **Author platform-tailored copy in `inputs/distribution.json`:**
   - **YouTube Shorts:** Punchy title (≤100 chars), categoryId (`23` for Comedy), duration ≤60s.
   - **Twitter/X:** Strong relatable meme hook (≤280 chars total).
   - **Instagram Reels:** Engaging caption with tags (4:5 / vertical).
   - **TikTok:** Engaging caption with trending tags (≤2200 chars).
2. **Dry-run validation:**
   ```sh
   node runtime/publish.mjs --dry-run inputs/distribution.json goldens/bear-secret.mp4
   ```
3. **Live dispatch requires explicit human sign-off:**
   - Confirm target channels and copy with the user (`approvalRequired: true`).
   - Execute with connected Buffer MCP tools or `node runtime/publish.mjs inputs/distribution.json outputs/final.mp4`.
   - Generates a verified distribution receipt (`<video>.distribution.json`) with zero secret leakage.
