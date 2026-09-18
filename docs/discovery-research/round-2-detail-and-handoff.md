# Round 2: Detail And Handoff

Date: 2026-07-25

## North Star

Someone is looking for an ad format to use. They see a finished ad and think:

> I can make this. Wiggly has already turned it into an exact science.

The finished ad creates desire. The attached Format creates confidence.

## The Four Questions

Every discovery and detail surface must answer:

1. **Why should I stop?** The finished ad is good enough to interrupt browsing.
2. **Why should I trust it?** The output is real, attributed, versioned, and repeatable.
3. **Why can I make it?** The required inputs, time, cost, and process are understandable.
4. **What happens when I click Use?** Wiggly hands the exact Format to an agent and starts a guided run.

## Strong Detail Patterns

### Civitai: Output First, Recipe Attached

[Output detail screenshot](screenshots/round-2/civitai-output-detail.png)

The output occupies most of the page. Remix, save, share, creator, reactions, tags, process, and generation data remain available without competing with the work.

Borrow:

- Full-height outcome as the visual center
- One obvious `Use this Format` action
- Creator and Format attached beside the output
- A collapsed `How it was made` section for proof
- Save and share as quiet secondary actions

Reject:

- Reaction overload
- Dense tag clouds
- Raw generation data as the default view

### Suno: Playable Result With Remix Nearby

[Song detail screenshot](screenshots/round-2/suno-song-detail.png)

The result is playable immediately. Creator, proof, comments, similar work, and remix are secondary layers. A persistent player lets the user continue exploring without losing the media.

Borrow:

- Playback remains available while the user explores details
- A clear reuse action near the result
- `More made with this Format` and `More by this creator` as separate rails
- Media state survives navigation

Reject for MVP:

- Comments
- Reaction sets
- Algorithmic recommendation claims

### Replicate: The Use Action Is Concrete

[Model detail screenshot](screenshots/round-2/replicate-model-detail.png)

Replicate makes the reusable object feel real by placing inputs and output together. It shows official status, run count, pricing, privacy, examples, docs, and API paths near the runnable surface.

Borrow:

- Show required inputs before handoff
- Put time and estimated cost beside the primary action
- Show one real example next to the input contract
- Offer agent-specific handoff instructions after the simple path

Reject:

- A developer playground as the consumer's first page
- Provider/API detail before the user chooses to use the Format

### Hugging Face: Trust, Ownership, And Providers

[Model detail screenshot](screenshots/round-2/huggingface-model-detail.png)

Identity, creator, tags, license, versions, community, usage, providers, and deployment actions form a layered trust system.

Borrow:

- Stable Format identity and version
- Creator credit and source lineage
- `Works with` agent/provider connectors
- Verified/curated badge with a plain meaning
- Last update and successful-run proof

Reject for MVP:

- Likes and follower counts
- Community threads
- Dense technical tags above the proof

### Smithery: Add To The Agent In One Step

[Connector detail screenshot](screenshots/round-2/smithery-server-detail.png)

Smithery makes the reusable capability legible: name, owner, reliability, use count, tools, source, license, and one prominent `Add to toolbox` action.

Borrow:

- One primary `Use this Format` action
- A short capability summary
- Supported agent destinations in a compact picker
- Source, ownership, and reliability below the primary action
- A direct path to advanced technical details

Reject:

- Making the user understand MCP terminology
- Treating the agent connector as the product instead of the ad result

### Framer: Embedded Preview Before Purchase

[Template detail screenshot](screenshots/round-2/framer-template-detail.png)

The template is experienced inside the detail page before the user buys it. Type, creator, description, and action surround a large live preview.

Borrow:

- Let users play the actual ad, not a poster frame
- Keep the preview stable while details change around it
- Make the primary action visible without scrolling

Reject:

- A dark marketplace shell that competes with varied ad styles
- Long sales copy before the user understands the Format

### Civitai Model Detail: Examples Prove The Recipe

[Model detail screenshot](screenshots/round-2/civitai-model-detail.png)

Multiple outputs demonstrate range. Versions are visible. The creation action and technical download details are separated.

Borrow:

- A Format detail page must show several real ads
- Examples should prove range across brands, not repeat one demo
- Version history belongs on the Format, not the finished ad

Reject:

- Raw download artifacts as the primary CTA
- Dense stats, ads, and referral content

## Result-to-Use Flow

The simplest useful flow is:

```text
Watch finished ad
  -> Open details
  -> See "Made with [Format]"
  -> View 3-5 more real outputs
  -> See what the Format needs, costs, and produces
  -> Click "Use this Format"
  -> Choose an available agent
  -> Agent starts with the exact Format version
```

The user should not need to:

- Read a README
- Download a package
- Choose a provider
- Understand model names
- Configure a workflow graph
- Decide between multiple technical install paths

Those controls can exist after the handoff for advanced users.

## Public Object Model

### Finished Ad

The discovery object.

- Video or playable media
- Brand and short outcome label
- Format name and exact Format version
- Creator credit
- Save, share, and `Use this Format`
- Optional source/remix lineage

### Format

The reusable recipe.

- Name and plain-language promise
- Hero reel made from real outputs
- 3-5 proof ads across different brands
- What the user provides
- What the agent produces
- Typical time and estimated cost
- Supported agents
- Creator, current version, last update, and source lineage
- `Use this Format`

### Creator

Proof through work.

- Identity and short bio
- Published Formats
- Finished ads made with those Formats
- Attribution and remix lineage

The MVP does not need followers, DMs, ratings, or public comments.

## Page Decision

Use separate progressive pages:

1. **Discovery feed:** finished ads first.
2. **Ad detail:** the selected output, attribution, and attached Format.
3. **Format detail:** proof reel, repeatability, requirements, cost/time, version, and handoff.
4. **Creator profile:** work and Formats.

Why separate them:

- The ad page answers "I want this."
- The Format page answers "Can I reliably make this?"
- Mixing both jobs into one long page weakens both.

## MVP Handoff

`Use this Format` opens a short handoff sheet:

1. Format and version
2. What the user needs to provide
3. Typical time and estimated cost
4. Available agent destinations
5. `Start with [agent]`

The agent receives:

- Stable Format URL
- Exact public version
- Format instructions
- Example outputs
- Required-input checklist
- Provenance and creator credit

The agent then asks one question at a time and calls out the current step while working.

## Round 2 Decisions

1. Keep ad detail and Format detail separate.
2. Keep video playback stable while browsing details.
3. Show three to five cross-brand proof ads on each Format.
4. Show time, cost, required inputs, and supported agents before handoff.
5. Make `Use this Format` the only dominant action.
6. Keep technical proof available but collapsed.
7. Treat successful real outputs as the main trust signal.
8. Do not build social features to manufacture trust before usage exists.

## Next Research Questions

- Which feed layout makes vertical ads easiest to scan on desktop without shrinking them into thumbnails?
- How should hover, sound, and autoplay work without creating noise?
- What is the smallest useful save/collection behavior?
- What should the handoff sheet look like on mobile?
- Which Wiggly visual direction can support many ad aesthetics without becoming beige marketplace chrome?
