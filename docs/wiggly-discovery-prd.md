# Wiggly Discovery PRD

Status: Ready for implementation planning

Date: 2026-07-25

## Product In One Line

Watch a finished ad, see the exact Format behind it, and hand that Format to an agent to make your version.

## North Star

The visitor should think:

> I can make this. Wiggly already turned it into an exact science.

## The Problem

People looking for ad ideas do not want to start with prompts, models, workflow files, or a blank editor.

They want to see a finished result that makes them stop.

Then they want proof that the result can be repeated for their brand.

Today, Wiggly has good finished work and strong technical Format kits, but there is no simple public path between them.

## Primary User

Someone who needs an ad Format to use.

They may be:

- A founder making ads for their own brand
- A marketer looking for a new angle
- A creator looking for a repeatable production recipe
- An agent user who wants the agent to do the hard work

## Core Loop

```text
See a finished ad
  -> want a result like it
  -> inspect the Format proof
  -> see inputs, time, and cost
  -> use the Format with an agent
  -> publish a new ad
  -> keep creator and remix credit
```

## Product Principles

### 1. Finished Ads Lead

The first object is a real finished ad.

Do not lead with:

- A prompt
- A model
- A workflow diagram
- A technical repository
- A Format logo

### 2. Proof Beats Claims

Do not say a Format works across brands.

Show three to five finished examples across brands.

### 3. The Recipe Is Attached

Every approved ad must point to:

- Its exact Format
- Its exact public Format version
- The Format creator
- Its source Format when it is a remix

### 4. Use Is Clear

`Use this Format` is the main action.

Before a run starts, show:

- What the user needs
- What the agent will make
- Typical time
- Estimated cost
- The agent that can run it

### 5. The Agent Does The Work

The user does not install a kit or learn a workflow.

The agent receives the exact Format version and starts with one short question.

While working, the agent always names the current step.

### 6. Curate Before Scaling

Wiggly approves what appears in the public feed.

There is no ranking model, follower graph, or open publishing system in the MVP.

## Public Objects

### Finished Ad

This is the discovery object.

Required:

- Playable video or full static image
- Poster for every video
- Brand
- Short title
- Format and exact version
- Creator
- Public share slug
- Goal, business, platform, runtime, and media tags
- Short curator note

Actions:

- Watch
- Open ad
- Use this Format
- Save
- Share

### Format

This is the repeatable recipe.

Required:

- Stable slug and current public version
- Plain promise
- Three to five real proof ads
- Required inputs
- Produced deliverables
- Typical time
- Estimated cost
- Supported agents
- Creator and source lineage
- Last update
- Link to technical proof

Actions:

- Use this Format
- Save
- Share
- Open technical proof

### Creator

This proves ownership through finished work.

Required:

- Name and handle
- Image
- Short bio
- Published Formats
- Finished ads
- Source and remix credit

Do not show follower counts, ratings, DMs, or a public activity feed in the MVP.

### Discovery Entry

This is a small editorial record.

It points to an existing finished share and owns only:

- Published state
- Featured section
- Manual order
- Curator note
- Search and filter tags

It does not copy the scene, media, Format, or creator data.

## Pages

### `/discover`

Purpose: find a finished ad worth making.

First viewport:

- Wiggly identity
- Search on desktop
- Short goal filters
- At least part of the first finished ad

Feed:

- Four columns on wide desktop
- Three columns on desktop
- Two columns on tablet
- One column on mobile
- Stable `9:16` media
- No masonry

Initial rails:

- Worth stealing this week
- Explain a complicated product
- Sell without looking like an ad
- Built for ecommerce
- Fast tests
- New Formats

Each card shows:

- Finished media
- Brand
- Short title
- `Made with [Format]`
- Creator
- Save
- Visible sound control for video

### `/s/[slug]`

Purpose: watch one finished ad and understand how to repeat it.

Use the existing frozen share and existing scene/render contract.

For approved discovery entries, add:

- Brand and title
- `Made with [Format]`
- Creator
- `Use this Format`
- Save and share
- Short `Why it works` note
- More made with this Format
- More by this creator

Do not create a second finished-ad renderer or copy the scene into discovery data.

### `/formats/[slug]`

Purpose: prove the Format is a repeatable system.

Above the fold:

- Format name
- Plain promise
- Proof reel or strong finished example
- Creator
- `Use this Format`

Proof:

- Three to five finished ads
- What changes between brands
- What stays the same

Run facts:

- You provide
- The agent makes
- Typical time
- Estimated cost
- Output size and runtime
- Supported agents

Trust:

- Current public version
- Last update
- Creator and remix lineage
- Link to `/format-lab/[slug]`

### `/creators/[handle]`

Purpose: build trust through finished work.

Show:

- Creator identity and short bio
- Published Formats
- Finished ads
- Remix lineage

### `/saved`

Purpose: keep a private shortlist.

MVP behavior:

- One list called `Saved ads`
- Anonymous saves live in the browser
- Saves survive refresh

Named collections and shared lists are deferred.

### `/submit`

Purpose: let creators ask Wiggly to publish a Format.

Ask for:

- Creator name and contact
- Format link or package
- Three real outputs
- Short promise
- Source and remix credit

Wiggly reviews every submission.

There is no public publishing dashboard in the MVP.

## Use This Format

The action opens one sheet.

### What You Need

Show a short checklist from the exact Format version.

### Run Estimate

Use a list, not a paragraph.

Example:

- Story: free, about 1 minute
- Storyboard: about $0.05, 1-2 minutes
- Video: about $0.60, 3-6 minutes
- Voice and final: about $0.05, under 2 minutes
- Total: about $0.70, 5-12 minutes

Estimates are not billing promises.

### Choose An Agent

Only show agents with a working handoff.

MVP:

- Codex

### Start

The agent receives:

- Stable Format URL
- Exact public version
- Required inputs
- Format instructions
- Real proof examples
- Creator and remix lineage

The agent asks one question at a time.

## Search And Filters

Search:

- Brand
- Ad title
- Format
- Creator
- Goal

Public filters:

- Goal
- Business
- Platform
- Runtime
- Media

Do not expose provider or model filters in the public feed.

## Playback

- Feed videos autoplay muted
- Only one video plays at a time
- Sound control is always visible
- Sound choice lasts for the session
- Media pauses when it leaves the viewport
- Every video has a poster
- Captions stay visible when available
- Reduced-motion preferences are respected
- A slow video shows its poster instead of a black box

## Visual Direction

Use the selected `Studio Contact Sheet` system:

- Off-white page
- Ink borders and short ink shadows
- Dark media wells
- Aqua, yellow, lime, violet, and coral accents
- Heavy display type
- Compact plain body copy
- Maximum 8px radius

Wiggly frames the work. It does not recolor the work.

Detailed evidence: [Design directions](discovery-research/design-directions.md)

Clickable proof: [High-fidelity prototype](discovery-research/prototype.html)

## Empty And Error States

### Empty Search

> No exact match yet.

Then show nearby goal rails.

### Slow Media

Keep the poster, runtime, and play action visible.

### Handoff Not Ready

> This Format is ready to browse, but its agent handoff is not live yet.

Do not show a broken agent option.

### Removed Format Version

Existing ads keep their pinned version and creator credit.

New runs use the current public version.

## MVP Scope

Build:

- Curated finished-ad feed
- Discovery chrome on approved share pages
- Format detail
- Creator profile
- One private Saved list
- Share
- `Use this Format` agent handoff
- Simple curated submission
- Version and remix lineage

Do not build:

- Payments
- DMs
- Followers
- Comments
- Ratings
- Algorithmic ranking
- Open publishing
- Creator dashboards
- Teams
- Collaborative collections
- Advanced moderation tools

## Events

Track only what helps improve the core loop:

- `discovery_viewed`
- `discovery_ad_opened`
- `discovery_format_opened`
- `discovery_handoff_started`
- `discovery_submission_sent`

Do not use these events to build an algorithmic feed in the MVP.

## Success

The MVP works when a new visitor can:

1. Find a finished ad they want.
2. Understand the attached Format in under 30 seconds.
3. See proof across brands.
4. Know what they need, how long it takes, and what it may cost.
5. Start a guided agent run.
6. Save or share the ad.

Primary signal:

- A visitor opens a Format after watching an ad.
- A visitor starts an agent handoff.

Qualitative test:

> I can make this.

## Acceptance Criteria

### Feed

- A `390x844` first viewport shows the promise and part of a real finished ad.
- A `1440x900` viewport shows four stable `9:16` cards.
- No horizontal page overflow.
- Every interactive control is visible.
- Only one feed video plays at a time.
- Search and primary filters return the expected curated entries.

### Finished Ad

- Approved shares use the existing frozen scene and renderer path.
- The first viewport contains playable media, Format credit, and `Use this Format`.
- Static entries show an image, not an empty video player.
- Save survives refresh.

### Format

- The page shows at least three real finished outputs.
- Current public version, creator, inputs, outputs, time, and cost are visible.
- `Use this Format` opens a handoff sheet without a paid media call.
- The technical proof remains linked, not copied into the consumer page.

### Handoff

- The sheet lists required inputs and a list-format estimate.
- Only working agents appear.
- The handoff pins the exact public Format version.
- The first agent message asks one short question.
- Every later agent update names the current step.

### Guardrails

- No second renderer is added.
- `AdRenderSurface` remains passive.
- Discovery data does not duplicate scene or media payloads.
- `/create`, `/builder`, and `/share` keep their existing jobs.
- Every regression found during implementation gets a test.

## Research

- [Round 1: landscape](discovery-research/round-1-landscape.md)
- [Round 2: detail and handoff](discovery-research/round-2-detail-and-handoff.md)
- [Round 3: feeds and mobile](discovery-research/round-3-feed-and-mobile.md)
- [Screenshot inspiration board](discovery-research/inspiration-board.html)
