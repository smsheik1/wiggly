# Wiggly Discovery Implementation Plan

Status: Separate from the design phase

PRD: [Wiggly Discovery PRD](wiggly-discovery-prd.md)

## Goal

Ship the smallest public loop:

```text
finished ad -> Format proof -> agent handoff
```

## Constraints

- Work in `v3`.
- Use one branch per phase.
- Keep each PR focused and reversible.
- Use the existing `/s/[slug]` share and renderer path.
- Do not change `/create` or `/builder`.
- Do not build a social network.
- Do not add paid media calls.
- Do not add a second renderer.

## Phase 1: Curated Feed

Build:

- Small `DiscoveryEntry` record that references an existing share slug
- Manual publish state, rail, order, curator note, and tags
- `/discover`
- Search and primary filters
- Stable video/image cards
- Muted one-at-a-time playback

Use existing data for:

- Scene
- Media
- Brand
- Format

Do not copy those payloads into `DiscoveryEntry`.

Suggested files:

- `v3/app/discover/page.tsx`
- `v3/app/discover/DiscoveryClient.tsx`
- `v3/features/discovery/catalog.ts`
- `v3/features/discovery/types.ts`
- `v3/convex/discovery.ts`
- Small schema addition for editorial discovery entries

Tests:

- Published entries only
- Manual order is stable
- Search and filters
- Static and video card states
- One playing video
- No hidden controls
- Desktop and mobile screenshots

Exit:

- A new visitor can browse real finished ads.

## Phase 2: Finished Ad And Format Proof

Build:

- Discovery chrome for approved `/s/[slug]` pages
- `Made with [Format]`
- Creator credit
- Curator note
- Related Format outputs
- `/formats/[slug]`
- Consumer adapter over the current public Format package

Keep:

- Existing frozen share scene
- Existing renderer
- Existing share playback
- Existing technical `/format-lab/[slug]`

Do not:

- Copy scene JSON into discovery data
- Create `/ads/[slug]`
- Create another video player or renderer path

Tests:

- Share playback is unchanged
- Approved share adds discovery chrome
- Non-discovery share keeps current behavior
- Format version is visible and pinned
- Three real proof outputs appear
- Mobile puts Format promise and action before long proof content

Exit:

- A visitor can understand why an ad works and see proof that its Format repeats.

## Phase 3: Creator, Save, And Handoff

Build:

- `/creators/[handle]`
- One anonymous `Saved ads` list in browser storage
- `Use this Format` sheet
- Required inputs
- List-format cost and time estimate
- Codex handoff with exact Format version

Keep the creator catalog curated in the MVP.

Tests:

- Save and remove
- Save survives refresh
- Handoff contains exact version and required inputs
- Handoff makes no paid media call
- Unsupported agents do not appear
- The first agent question is short
- Agent progress messages name the current step

Exit:

- A visitor can trust the maker, save the work, and start a guided run.

## Phase 4: Curated Submission

Build:

- `/submit`
- Small submission record
- Required fields from the PRD
- Private review status
- Simple internal review query or existing admin-safe inspection path

Do not build:

- Public creator dashboard
- Open publish button
- Automated moderation
- Ratings

Tests:

- Required fields
- Three output examples required
- Source/remix credit required
- Submission is private by default

Exit:

- A creator can ask Wiggly to review a Format without creating a social network.

## Shared QA

Run after every phase:

- Targeted unit tests
- Typecheck
- Production build
- Browser smoke at `1440x900`
- Browser smoke at `390x844`
- Console error check
- Horizontal overflow check
- `ponytail-review`

Browser flow:

1. Open `/discover`.
2. Filter and search.
3. Open one video ad.
4. Enable sound.
5. Open the attached Format.
6. Review proof across brands.
7. Open `Use this Format`.
8. Confirm inputs, time, cost, and exact version.
9. Save the ad.
10. Refresh and confirm it remains saved.

## Rollout

1. Seed six to twelve approved finished ads.
2. Include at least three Formats.
3. Keep feed order manual.
4. Test the handoff with one supported agent.
5. Ship behind one public discovery navigation link.
6. Review real user behavior before adding more community features.

## Explicitly Deferred

- Payments
- DMs
- Followers
- Comments
- Ratings
- Algorithmic ranking
- Open publishing
- Creator dashboards
- Teams
- Named or shared collections
- Advanced moderation
- Multi-agent marketplace

## Definition Of Done

- The loop works without a paid media call.
- The work looks like Wiggly on desktop and mobile.
- A visitor sees a finished result before technical details.
- The exact Format and creator stay attached.
- The agent handoff is clear and version-pinned.
- No duplicate renderer, scene state, or media data was added.
