# Wiggly Engineering Rules

Wiggly should feel magical to users and boring internally. The way we avoid endless bug-fixing is by making whole categories of bugs impossible.

## Product Split

- `/create` generates and previews. It is for pasting a URL, choosing a format, rerolling, adding audio, downloading, sharing, and opening the result in builder.
- `/builder` edits. It owns advanced movement, resizing, layout tuning, colors, locks, and detailed controls.
- `/share` views and spreads. It should let viewers play, reroll when intended, and route back to Wiggly.

## Rules

1. **One screen has one job.** Do not make `/create`, `/builder`, or `/share` do each other's jobs.
2. **One source of truth per thing.** Scene data, interaction state, render jobs, and audio state must not be duplicated across components.
3. **Renderer is sacred.** Preview, download, and share must render through the same `AdRenderSurface`. No fallback renderers and no almost-the-same versions.
4. **Render surface is passive.** `AdRenderSurface` paints the active `AdScene`; it does not own product mutation logic.
5. **Scene changes are complete payloads.** Reroll and format changes should swap or update a full scene contract instead of mutating scattered top-level UI state.
6. **No invisible interactivity.** If users can click it, they can see it. Hidden hover zones, transparent buttons, and overlapping controls are banned.
7. **State changes are events.** Prefer semantic actions such as `websiteSubmitted`, `sceneSelected`, `audioGenerated`, `renderQueued`, and `formatChanged` over generic setters.
8. **Formats are plugins.** New formats must live behind the format registry with their own renderer/defaults/validation/reroll behavior.
9. **Every bug becomes a guardrail test.** If a bug reaches the UI once, add or update a test so it cannot silently return.
10. **No silent fallbacks on external API failures.** If an external API call fails (missing key, invalid credentials, out of credits, rate limit, provider outage, or HTTP 4xx/5xx): STOP immediately, yell loudly to the operator with clear diagnostic details, and provide click-by-click baby steps on how to fix it (the exact website URL, which button/tab to click, where to check credits or add payment, where to copy the key, the exact file path to open in `secrets.env`, and the exact line to paste). Do NOT silently degrade quality, swallow errors, or fall back to mock/synthetic data unless running in an explicit, isolated local mock test suite.

## Pre-Change Checklist

- Am I touching the right product surface?
- Am I adding duplicate state?
- Am I adding a second renderer?
- Am I adding invisible interactivity?
- Can this change be expressed through `AdScene` or a format module?
- Did I add or update the guardrail test that prevents the bug class from returning?

## Practical Default

When in doubt, keep `/create` simple and move editing complexity to `/builder`. Wiggly's foundation should make adding new formats feel like adding modules, not performing surgery on the core app.
