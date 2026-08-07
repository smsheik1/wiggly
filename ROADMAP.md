# Wiggly Roadmap

This file is the product memory for things we intentionally defer. When we make a practical v1 tradeoff, add it here immediately so it does not depend on anyone remembering a chat thread.

## Reference Remix

### Turn an inspiration ad into an editable ad for the user's brand

**Status:** Deferred / tabled

**Why:** A general-purpose editor is useful infrastructure but not a strong customer-acquisition promise. The sharper wedge is: upload an ad you wish your brand had made, paste your website, and receive one brand-specific, editable remix.

**Goal:** Connect the existing reference analyzer, website research, static scene composer, and Builder through one customer-facing Reference Remix flow.

**Acceptance criteria:**
- `/create` accepts one static reference image and one public brand or product URL.
- Wiggly produces one brand-grounded remix using real product evidence and native editable text.
- The user sees a clear before-and-after preview, then downloads or opens the result in `/builder`.
- The flow reuses `AdRenderSurface`, complete `AdScene` payloads, and the existing Builder rather than introducing another editor or renderer.
- The product stops visibly when it cannot create a trustworthy editable result; it never substitutes a flattened generic AI image.
- Implementation follows the phased scope in [the Reference Remix PRD](./docs/reference-remix-acquisition-prd.md).

## Event Demo Wow Moment

### Build a booth-ready option browser

**Status:** Planned

**Why:** We are taking Wiggly to an event with an iPad and need every booth visit to feel like a fast "wow" moment for that brand. The demo should make it obvious that Wiggly can generate lots of usable directions, then let us spacebar through them without dead ends.

**Goal:** Make `/create` generate enough distinct, on-brand options per format that a user can quickly browse variations live.

**Acceptance criteria:**
- Current 4 image meme templates generate 3 variations each, for 12 meme scenes total.
- Spacebar cycles through all meme variations, not just one scene per template.
- Video memes are added as the next meme-format expansion path.
- Add a brand jingle format that turns the brand brief into a short, memorable audio-first concept.
- Add a "We're sorry" format inspired by the Instagram trend: brands apologize for being too good, selling out, or needing to make it up with an offer.
- "We're sorry" outputs can support both playful apology-only copy and apology-plus-discount/offer copy when the brand evidence supports it.
- All new formats still use `AdRenderSurface` and complete `AdScene` payloads.
- The iPad demo can start from a booth's website URL and quickly spacebar through a varied set of options.

## Next Rendering Improvements

### Make Remotion visualizers truly audio-reactive

**Status:** Planned

**Why:** Remotion export v1 uses deterministic animated bars/waveforms for stability. This is safer than the old browser-recorded canvas path, but it is not yet reacting to the actual spoken audio.

**Goal:** Precompute or sample audio amplitude/FFT data and feed it into the Remotion composition so exported waveform and bar visualizers move with the real voiceover.

**Acceptance criteria:**
- Exported waveform-strip reacts to the actual audio.
- Exported bars-center and bars-bottom react to the actual audio.
- Caption/audio timing does not drift.
- Feed exports remain `1080x1350` at `60fps`.
- Reels/stories exports remain `1080x1920` at `60fps`.
- Remotion export remains the default path with old export fallback available.

## Audio Reliability

### Handle transcription failures gracefully

**Status:** Planned

**Why:** Uploading audio can currently trigger a local transcription API failure in the console. Even though upload/storage still works, a real user should not hit noisy errors or confusing failed-caption behavior.

**Goal:** Make transcription failure non-scary and recoverable: uploaded audio remains selected, captions either stay as-is or show a clear retry path, and console noise is limited to useful diagnostics.

**Acceptance criteria:**
- Audio upload never appears broken just because transcription fails.
- Failed transcription does not show a blocking alert for normal local/server outages.
- The UI shows a small retry/status affordance if captions could not be generated.
- The console logs one useful diagnostic, not a noisy stack during expected API unavailability.
- Existing captions are not wiped unless a new transcription succeeds.

## Audio Panel Redesign

### Make voice selection moron-proof

**Status:** Planned

**Why:** The audio panel should start from a working voice and hide file-manager complexity behind one simple "Change" action.

**Goal:** Default to one calm row: "Voice: [current voice] - Change." Behind Change, show two clear paths: "Make me a voice" and "Use a voice I have."

**Acceptance criteria:**
- The selected voice must survive a page refresh.
- A new user always lands with a working voice selected.
- The front row does not show saved-audio lists, file counts, script counts, or technical labels.
- "Make me a voice" is the primary path behind Change.
- "Use a voice I have" reveals uploaded/generated/example voices only when requested.
- Saved voices are deduped and use human labels like "Using now," "Example," and "Uploaded by you."
- The UI never shows duplicate voice rows.
- Dead or broken local voice records are hidden or clearly flagged as "Needs re-upload," never shown as working choices.
- Audio download and upload actions live behind Change, not on the default front row.
- There is no one-click path that leaves the ad silently broken with no voice.
- The desktop flyout opens to the right; narrow screens fall back to a bottom-sheet style drawer.

## Bill Shield Hardening

### Move from session-memory protection to production-grade abuse controls

**Status:** Planned

**Why:** We now have an effective temporary shield for anonymous usage, but in-memory tracking and unsigned session cookies are not enough for production scale or adversarial traffic.

**Goal:** Upgrade protection so anonymous and authenticated traffic is rate-limited safely across deployments and we can confidently cap LLM spend.

**Acceptance criteria:**
- Replace in-memory quota storage with a shared store (Redis or Postgres) so limits survive restarts and respect all server instances.
- Add user-based fallback limits once auth lands, with anonymous-session limits still enforced for unauthenticated visitors.
- Add lightweight anti-abuse hardening on high-cost routes: per-IP + per-session/device throttling, suspicious burst detection, and clear block telemetry.
- Add alerting for spend/rate anomalies and a runbook for kill-switch response.
- Keep the default kill-switch + provider flags path working so we can disable any LLM path without deploys.

### Make abuse limits visible and tunable without redeploy

**Status:** Planned

**Why:** We need practical controls during spikes and model regressions.

**Goal:** Add simple internal visibility on quota usage and make the main route limits adjustable through ops knobs.

**Acceptance criteria:**
- Display rolling quota stats per route and per-day totals in an internal admin/status endpoint.
- Confirm `AI_BILL_SHIELD_SECRET`, per-route quotas, and feature flags can be changed via environment and deployed safely.
- Add docs for temporary emergency values and maintenance mode behavior.
- Add a rollback plan that preserves user-facing UX when shields are temporarily activated.

## Backlog Rules

- If we say "v2 later", add it here or to GitHub Issues before moving on.
- Keep each item short: why, goal, acceptance criteria.
- Prefer GitHub Issues for active work and this file for durable product/technical memory.
