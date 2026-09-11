# Round 1: Landscape Scan

Date: 2026-07-25

## Goal

Find the strongest patterns for:

- Result-first visual discovery
- Understanding what is reusable
- Trusting a Format and its creator
- Moving from inspiration to use
- Connecting a Format to an agent
- Preserving creator and remix lineage

## Current Wiggly

Wiggly already has runnable Format kits, proof videos, version pointers, creator/source lineage concepts, frozen shares, and agent instructions. The current `/format-lab/*` pages expose technical proof and internal package details. They are useful for agents and developers but do not create a consumer discovery experience.

Screenshots:

- [Current homepage](screenshots/round-1/wiggly-home-current.png)
- [Current 3D Breakdown repository](screenshots/round-1/wiggly-3d-repo-current.png)
- [Current Cartoon Explainer repository](screenshots/round-1/wiggly-cartoon-repo-current.png)

Decision: keep Format Lab as technical proof. Add a separate outcome-first public discovery layer.

## Strongest Patterns

| Platform | Strong pattern | Wiggly use |
| --- | --- | --- |
| Civitai Images | Finished work fills the feed; the reusable model is attached behind it | Lead with finished ads and attach the Format |
| Runway Watch | Cinematic work gets space; interface stays quiet | Let great video sell the Format before metadata appears |
| Suno Explore | Playable outcomes, curated rails, remix section, persistent media controls | Autoplay-safe ad previews, useful collections, visible reuse |
| Replicate | Runnable playground beside output, clear inputs, examples, API tabs, trust metadata | Make `Use this Format` concrete and show what the agent needs |
| Hugging Face | Clear ownership, tags, versions, community, usage, providers, and one-click use | Format identity, creator proof, version lineage, agent connectors |
| Framer Marketplace | Strong visual cards, featured curation, type browsing, fresh finds | Curated rails and clear Format families |
| Webflow Made in Webflow | Search, use-case filters, cloneable-only filter, creator attribution | Filter by business goal and show only runnable Formats |
| Gumloop | Search by integration or use case; hand-picked agents | Search by ad goal, industry, platform, and required tools |
| n8n Workflows | Large workflow library organized around what the user wants to accomplish | Task-first language instead of internal Format jargon |
| FLORA | Visual workflow thinking and collaborative reuse | Explain the recipe visually without exposing every implementation detail |
| ComfyUI | Templates plus a simple App Mode and an advanced graph | Start with a simple agent handoff; keep technical kit details available |
| Smithery | Search-first agent connectors, verified tools, and use counts | One-click agent connection with trust signals |
| GitHub | Ownership, contributors, versions, forks, and durable history | Creator credit and remix lineage without social-network bloat |
| Behance | Work-first creator identity | Let a creator's finished output act as their profile |
| Pinterest | Fast visual scanning and saving | Save ads and build private inspiration collections |
| Lovable | Clear template categories with large previews | Browse Formats by intended outcome, not implementation |

## Pattern Details

### Outcome First

Civitai, Runway Watch, Suno, Behance, and Pinterest make the finished work the primary object. This matches Wiggly's target reaction: "I want to make that."

Wiggly implication:

- The discovery card is a playable or moving ad, not a technical Format card.
- Format name, creator, and proof are attached metadata.
- The first detail page keeps the finished ad dominant.

### Use Is Visible

Replicate places the input form and output together. Hugging Face makes `Use this model` and deployment providers visible. Webflow labels cloneable work. ComfyUI exposes templates directly.

Wiggly implication:

- `Use this Format` must explain what happens next.
- Show supported agents and a one-click handoff.
- Show required inputs before the user commits.
- Do not make users download a ZIP before understanding the result.

### Trust Is Layered

Hugging Face combines creator identity, usage, tags, versions, files, community, and providers. Replicate combines official status, run count, pricing, privacy, and examples. Superhive uses curation, creator identity, sales, ratings, and related products.

Wiggly implication:

- Start with curated/verified status, real outputs, successful runs, creator, version, and last update.
- Do not add ratings before there is real usage.
- Technical proof should remain available but should not dominate the consumer page.

### Browse By Goal

Gumloop, n8n, Webflow, Lovable, and Replicate organize around tasks or use cases.

Wiggly implication:

- Primary filters: ad goal, product category, platform, runtime, and media type.
- Format mechanics and provider requirements are secondary filters.
- User language should be "Explain a complicated product" rather than "presenter teardown."

### Reuse Has Lineage

GitHub, Hugging Face, Figma Community, Webflow, Suno, and Civitai make source ownership or reuse visible.

Wiggly implication:

- Every finished ad points to one exact Format version.
- Every remix credits the original Format creator.
- A creator can publish a new Format version without changing an existing result.

## Rejected Patterns

- Civitai's visual density, reaction overload, and competing badges
- MCP.so's sponsor-heavy opening and weak hierarchy
- Gumroad's generic product grid for media that should move
- Technical README content as the consumer's first view
- Long feature descriptions before the user sees the output
- Mixing every reference site's visual style into one interface

## Round 1 Decisions

1. Finished ads are the primary discovery object.
2. Formats are the reusable recipe attached to each ad.
3. `/format-lab` remains technical proof.
4. Public discovery needs distinct ad-detail, Format-detail, and creator surfaces.
5. The MVP feed is curated and chronological/editorial, not algorithmic.
6. Agent handoff is a first-class action, not a download footnote.
7. Real output proof replaces ratings in the MVP.

## Open Questions For Later Rounds

- Whether the ad detail and Format detail should be separate pages or one progressive page
- Which agent handoffs can truly be one click
- How much of the Format recipe should be visible before use
- Whether private collections belong in the first release
- Which creator submission flow is sufficient for a curated launch

## Screenshot Index

All valid screenshots live in [`screenshots/round-1`](screenshots/round-1).

Automated access was blocked for Superhive, Figma Community, Product Hunt, Canva, Midjourney, Replit, and Creative Market. Those blocked captures were removed and were not used as visual evidence. Later rounds used official Figma and TikTok material, plus a real-browser inspection of Superhive, to fill the highest-value gaps.
