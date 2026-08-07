# Round 3: Feed And Mobile

Date: 2026-07-25

## Goal

Make finished vertical ads easy to discover without shrinking them into generic marketplace thumbnails.

## Evidence

### TikTok Top Ads: Browse By Business Need

[Official Top Ads guide screenshot](screenshots/round-3/tiktok-top-ads-guide.png)

TikTok organizes real, authorized ads by region, industry, objective, and performance metric. The detail view connects the video to background, performance, keywords, and second-by-second key-frame analysis.

Borrow:

- Filter ads by business goal and industry
- Let the ad play before explaining it
- Explain why a curated example matters
- Save and share individual ads

Do not imitate:

- Performance claims Wiggly cannot verify
- Dense analytics in the discovery feed
- A dashboard aesthetic for creative browsing

Wiggly's MVP proof is repeatability, not ad performance. Show the exact Format version and several successful outputs instead of invented CTR or conversion metrics.

### Civitai Mobile: Media Owns The Screen

[Mobile output screenshot](screenshots/round-3/civitai-output-mobile.png)

The media fills the viewport. Reuse and save actions stay in a bottom bar. Details are available without displacing the work.

Borrow:

- Near-full-screen vertical media
- Sticky `Use this Format`
- Secondary save/share controls
- Expandable detail sheet

Reject:

- Reactions as the dominant proof
- Tip and gamification controls

### Suno Mobile: Identity Lives On The Media

[Mobile output screenshot](screenshots/round-3/suno-song-mobile.png)

Title, creator, light metadata, proof, and playback actions sit on the result. The page does not begin with a technical explanation.

Borrow:

- Brand, creator, and Format can overlay the lower safe area
- Playback is the primary interaction
- One clear action bar follows the media

Reject:

- Multiple equally weighted social actions
- App-install pressure

### Replicate Mobile: Trust Can Overwhelm The Result

[Mobile model screenshot](screenshots/round-3/replicate-model-mobile.png)

The mobile page stacks identity, trust metadata, tabs, and output. It is useful for developers but delays the proof.

Lesson:

- Put Wiggly trust data below the first finished ad
- Summarize trust as one compact line
- Reveal version, lineage, requirements, and technical kit on demand

### Framer Mobile: Preview Is Strong, Action Is Not Persistent

[Mobile template screenshot](screenshots/round-3/framer-template-mobile.png)

The embedded preview is large, but the purchase action scrolls away and long copy takes over.

Lesson:

- Keep `Use this Format` sticky on mobile
- Put real output examples before long description
- Avoid generic marketplace prose

## Feed Model

### Desktop

Use a calm four-column grid of vertical ads on wide desktop.

- Cards preserve a stable `9:16` viewport
- The hovered card previews motion, muted
- Only one card plays at a time
- A visible sound control turns sound on and persists the choice
- Brand, Format, and creator sit below the media, not over its important pixels
- Save is secondary
- Clicking the media opens the ad detail
- Clicking `Use` begins the Format handoff

Do not use masonry. Different card heights make video browsing harder and create layout jumps.

### Mobile

Use one full-width ad per row, close to the natural `9:16` size.

- Autoplay muted when at least half visible
- Pause when scrolled away
- Only one video plays
- Tap toggles play/pause
- Sound control is always visible
- `Use this Format` is sticky on the ad detail, not repeated over every feed card

Do not build a TikTok clone. Normal page scrolling, browser navigation, and shareable URLs remain intact.

## Discovery Controls

Use plain buyer language.

Primary filters:

- Goal: sell a product, explain how it works, show proof, tell the brand story, entertain
- Business: ecommerce, SaaS, local service, creator, nonprofit
- Platform: Meta, TikTok, YouTube Shorts, LinkedIn
- Runtime: under 15s, 15-30s, 30-60s
- Media: narrated video, dialogue, music, static

Secondary filters:

- Format family
- Typical time
- Estimated cost
- Required assets

Do not expose model/provider filters in the public feed.

## Curation

The MVP feed is curated.

Useful rails:

1. **Worth stealing this week**
2. **Explain a complicated product**
3. **Sell without looking like an ad**
4. **Built for ecommerce**
5. **Fast tests under $1**
6. **New Formats**

Each rail must contain real outputs. Do not publish empty Format cards.

## Save Behavior

The smallest useful save system is one private list called `Saved ads`.

- Save an ad
- Remove a saved ad
- View saved ads
- Anonymous saves may live in the browser

Named collections, following, public boards, collaboration, and social activity are deferred.

## Playback Rules

- Feed previews autoplay muted
- Only one media item plays at a time
- User sound choice persists during the session
- No surprise sound on page load
- Ad detail opens paused on desktop and ready to play
- Ad detail may continue the same playback position when opened from the feed
- Captions are visible when present
- Poster images are required for slow connections and reduced-motion users

## First-Viewport Test

A first-time visitor should understand these facts without scrolling:

1. These are finished ads.
2. Each ad was made with a reusable Format.
3. Wiggly can hand that Format to an agent.
4. The user can watch, save, share, or use it.

If the first viewport instead looks like a template store, model registry, or developer dashboard, the design has failed.

## Round 3 Decisions

1. Use a uniform four-column video grid on wide desktop, not masonry.
2. Use near-full-width media on mobile, not thumbnail cards.
3. Autoplay muted and allow only one active video.
4. Persist sound choice for the session.
5. Keep `Use this Format` sticky on detail pages.
6. Use one private Saved list in MVP.
7. Filter by ad goal and business context.
8. Curate rails manually until usage exists.
