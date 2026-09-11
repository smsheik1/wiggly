# Wiggly Agent Instructions

This repo is optimized for AI-assisted product work. Keep Wiggly boring internally and magical externally.

Before changing product code, read this file and `docs/wiggly-engineering-rules.md`.

## Active App

- Current product work lives in the v3 app unless the user explicitly says otherwise.
- Legacy `/create`, `/create-v2`, and `/builder` code may be used as visual or behavioral reference, but do not blend legacy implementation back into v3 without an explicit plan.
- Treat old code as reference material first. Port the recipe, contract, or visual behavior; avoid copying legacy state/rendering patterns that caused the rebuild.

## Product Boundaries

- `/create` generates and previews. It is for URL input, format choice, reroll, audio, download/share, and opening in builder.
- `/builder` edits. Advanced movement, resizing, layout tuning, colors, locks, captions, and detailed controls belong there.
- `/share` views and spreads. It should play, reroll when intended, and route people back to Wiggly.

Do not turn `/create` into a mini-builder. Movement, resizing, precision controls, and detailed editing belong in `/builder`. If a feature needs precise editing on `/create`, pause and explain why the boundary should change before implementing it.

## Product Manager Guardrail

The user may describe product ideas in broad product-manager language. Do not treat every idea as implementation approval.

If a request would violate these guardrails, pause before coding and explain which rule it risks breaking, what bug class it may reintroduce, the cleaner alternative, and whether the user explicitly wants to override the rule.

Do not override guardrails silently.

## Non-Negotiable Rules

1. Use one renderer. Preview, download, and share must render through `AdRenderSurface`.
2. Do not add fallback renderers, duplicate render surfaces, or "almost the same" preview/export components.
3. Keep `AdRenderSurface` passive. It paints an `AdScene`; it does not own product mutation logic.
4. Change scene data through complete `AdScene` payloads, not scattered page-level state.
5. Keep canvas interaction state in the dedicated interaction store. Do not recreate selection, locks, mode, or reroll state in local component state.
6. State changes should be semantic events, not random setters. Prefer names like `websiteSubmitted`, `sceneSelected`, `audioGenerated`, `renderQueued`, and `formatChanged`.
7. Formats are isolated modules. Adding a format should not require surgery in the core `/create` page.
8. No invisible interactivity. If a user can click it, they must be able to see it. Hidden hover zones, transparent buttons, and overlapping click traps are banned.
9. Download/share parity is mandatory. Canvas preview, Remotion export, and share pages must consume the same scene contract and renderer path.
10. Every fixed bug needs a guardrail test or an updated existing test for that bug class.

## Before You Edit

Ask these questions before writing code:

- Am I touching the correct surface: `/create`, `/builder`, or `/share`?
- Am I adding duplicate scene, render, audio, or interaction state?
- Am I creating another render path instead of using `AdRenderSurface`?
- Am I adding hidden or transparent interactivity?
- Can this be expressed as an `AdScene` or format-module change?
- If this touches render, reroll, audio, share, or download, what existing contract and test surface protects it?
- What regression test prevents this bug from returning?

## Working Style

- Prefer small, reversible changes.
- Commit after each completed phase so rollback points stay obvious.
- Push after a clean phase or clean set of phases once checks pass; do not leave important checkpoints local-only unless the user explicitly says not to push.
- After a PR is merged, treat that branch as finished. Switch back to `main`, pull the latest `origin/main`, and create a fresh branch before doing new work.
- Use one branch per coherent task or phase set. Good branch names are scoped and disposable, such as `fix/meme-text-fit`, `feat/meme-format-mvp`, `docs/branch-workflow-rules`, or `deploy/auto-main`.
- Stay on the same branch only while finishing the same coherent task. Do not keep adding unrelated fixes after the PR has merged; that creates noisy compare views and confusing rollback points.
- If a branch has already been merged and one tiny follow-up is needed, create a new follow-up branch from updated `main` instead of pushing more commits to the merged branch.
- Keep PRs boring: one purpose, clear title, focused diff, tests/checks noted. If the PR description needs a timeline to explain what happened, the branch is probably too broad.
- Keep page components thin; move format-specific behavior into format modules.
- Preserve the current product split unless the user explicitly approves changing it.
- When in doubt, keep `/create` simpler and move advanced editing to `/builder`.
- Do not delete legacy/reference code unless the user explicitly asks and the branch has a clear rollback path.

## Provider Credentials

- Provider API keys have one canonical source: the ignored repo-root `secrets.env`, which is a local symlink to the operator's central secrets file. Do not search, open, or use `.env.local` for provider credentials.
- When a provider key is needed for an explicitly approved call, load only the named value from `secrets.env` in memory. Do not print it, copy it into a worktree, or assume its absence from the worktree shell means it is unconfigured.

## Frontend QA

- After any real rendered frontend change, use browser validation before calling it done.
- Prefer the Browser plugin/in-app browser when available. If it is not available or fails, use the local Playwright skill/CLI smoke path and say why.
- A passing typecheck/build is not enough for UI work. Verify the affected flow in a real browser, including the actual control the user complained about.
- For layout fixes, capture or inspect dimensions/screenshots so oversized, clipped, or off-screen UI cannot slip through.
- If two attempts fail or the same bug class keeps moving around, stop and report the deeper blocker instead of pushing through.

## Next.js App Structure

- Use Next.js App Router defaults in `v3/app`: route folders own `page.tsx`, route-specific client shells, and route-local UI.
- Keep reusable product logic outside routes in `v3/features/*`; keep shared utilities in `v3/lib`; keep Convex code in `v3/convex`; keep Remotion entry code in `v3/remotion-entry`.
- Default components to server components. Add `"use client"` only for components that need browser APIs, local state, effects, event handlers, or Convex client hooks.
- Do not add new top-level source folders or parallel app structures without a clear reason.

## UI Components

- For normal app UI, use shadcn first: buttons, dialogs, sheets, inputs, textareas, selects, tabs/toggle groups, badges, alerts, separators, scroll areas, and tooltips.
- Do not hand-roll normal app UI when a shadcn component fits. If a custom control is truly needed, keep it small and explain why shadcn was not the right fit.
- Do not rewrite existing working UI to shadcn just for purity. Adopt shadcn incrementally when touching a surface or building new app-shell controls.
- Keep Wiggly's product canvas custom. `AdRenderSurface`, format renderers, preview chrome, Remotion/share/download rendering, and ad pixels are not generic shadcn UI.
- Do not let shadcn replace Wiggly architecture rules: one renderer, passive render surface, complete `AdScene` payloads, no hidden interactivity, and guardrail tests still win.

## Related Guardrails

- Human-readable rulebook: `docs/wiggly-engineering-rules.md`
- Local Codex skill: `wiggly-guardrails`
- Required before creating or materially changing a Wiggly Repo: `.agents/skills/wiggly-repo-builder`

## gstack

For product, site, design, QA, and ship work, use [gstack](https://github.com/garrytan/gstack) skills when they are installed: `/office-hours`, `/plan-ceo-review`, `/design-shotgun`, `/design-review`, `/review`, `/qa`, `/ship`. Use `/browse` for web browsing.

Install is optional and does not block format-kit work:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Format-kit and Wiggly Repo builder work still follows this file and `.agents/skills/wiggly-repo-builder`. Those runs do not require gstack.
