# Wiggly Discovery: Design Directions

Date: 2026-07-25

## Shared Requirements

Every direction must:

- Lead with finished ads
- Preserve a real `9:16` preview
- Keep Format and creator attached
- Show a visible sound control
- Make `Use this Format` clear
- Work across many ad styles
- Avoid a developer-dashboard first impression
- Avoid generic marketplace cards

## Direction A: Studio Contact Sheet

Bright Wiggly shell with ink borders, production labels, and strong accent colors. Ads sit in dark media wells so every creative style keeps its own contrast.

Behavior:

- Four-column uniform video grid on wide desktop
- Large editorial rails
- Compact metadata below media
- Strong Format tag
- Visible save and use actions
- Detail page uses a large media stage plus a proof panel

Strengths:

- Most ownable
- Feels like Wiggly
- Supports many ad styles
- Easy to scan
- Easy to simplify on mobile

Risk:

- Can look like a design portfolio if production proof is too quiet

Mitigation:

- Put `Made with [Format]` and real run facts on every detail page

## Direction B: Night Screening Room

Dark cinematic shell. Two large ads per row. Metadata stays minimal.

Behavior:

- Media dominates nearly every pixel
- Hover starts muted playback
- Detail pages feel like a screening room
- Creator and Format sit in a dark side rail

Strengths:

- Best immediate visual impact
- Excellent for premium video
- Quiet interface

Risks:

- Wiggly branding becomes weak
- Dark ads disappear into the shell
- Lower feed density
- Static Formats feel awkward

## Direction C: Proof Registry

Bright structured shell inspired by model and workflow registries. Each result includes compact proof, inputs, time, and cost.

Behavior:

- Two-column result cards
- Media and run facts visible together
- Strong filters
- Trust metadata is easy to compare

Strengths:

- Best repeatability proof
- Easy to scale
- Agent handoff feels credible

Risks:

- Feels like a dashboard
- The work loses emotional impact
- Too much information before desire exists

## Scorecard

Scores are out of 10.

| Criterion | Studio Contact Sheet | Night Screening Room | Proof Registry |
| --- | ---: | ---: | ---: |
| Stop power | 9 | 10 | 6 |
| Wiggly ownability | 10 | 6 | 7 |
| Works across ad styles | 9 | 7 | 9 |
| Feed scalability | 9 | 6 | 9 |
| Mobile clarity | 9 | 8 | 7 |
| Repeatability proof | 8 | 6 | 10 |
| Total | **54** | 43 | 48 |

## Selected Direction

Choose **Studio Contact Sheet**.

Borrow two behaviors without changing its visual language:

- From Night Screening Room: give the finished ad a dark, quiet media well.
- From Proof Registry: use a compact proof panel on Format and handoff pages.

This is one system:

- Off-white page canvas
- Ink borders and shadows
- Dark media wells
- Aqua, yellow, lime, violet, and coral accents
- Heavy display type
- Plain compact body copy
- Maximum 8px radius
- Stable `9:16` media dimensions

## Design Rules

### Feed

- Four columns at wide desktop
- Three columns at desktop
- Two columns at tablet
- One column on mobile
- No masonry
- No autoplay sound
- No hidden hover-only actions

### Cards

- Media is at least two thirds of the card
- Brand, title, Format, and creator remain visible
- Save and Use are visible controls
- No long descriptions
- No metrics without real data

### Detail

- The first viewport contains the whole playable ad
- `Use this Format` stays visible
- Format and creator are one compact line
- Proof appears beside the media on desktop and below it on mobile
- Technical proof is collapsed

### Brand

- Wiggly accents frame the work; they do not tint the ads
- Dark media wells prevent bright or transparent assets from disappearing
- Accent colors communicate sections, not decoration
- Borders and type create identity; avoid decorative gradients and blobs
