# Universal Create Assembly Line PRD

Status: Deferred

Owner: Wiggly product and engineering

Last updated: July 21, 2026

## Summary

Wiggly should use one assembly-line experience across every ad format. Formats may have different numbers of steps, generated artifacts, providers, and approval points, but users should not have to learn a new interface for each format.

The generated ads should look different. The factory that creates them should not.

This work is intentionally tabled until the current 30 Ads in 30 Days production work is complete.

## Problem

Wiggly already has a shared `CreateAssemblyLine` shell, but format stages can inject arbitrary React content. That flexibility has allowed Brand Jingle and 3D Breakdown to develop different stage layouts, status treatments, action placement, media cards, and pre-assembly screens.

This creates three problems:

1. Users must relearn the workflow when they change formats.
2. Each new format adds bespoke frontend code and regression risk.
3. Improvements to loading, errors, retries, previews, and paid-step approval must be rebuilt repeatedly.

## Product Decision

Build one configurable assembly-line system for `/create`.

Each format defines what happens and in what order. The shared assembly system defines how every step looks and behaves.

The number of stages may vary. Stage names may vary. The UI grammar must remain consistent.

## Universal Workflow

Every format can be expressed as some sequence of these operations:

1. **Input** - The user selects a product, premise, style, script, or other direction.
2. **Retrieve** - Wiggly scrapes a website, collects assets, fetches reviews, or imports source material.
3. **Generate** - A text, image, video, voice, or music model produces an artifact from prompts and references.
4. **Review** - Wiggly validates the result and the user approves, edits, retries, or chooses an option.
5. **Transform** - Wiggly crops, splits, times, stitches, mixes, resizes, or converts existing artifacts without a generative model call.
6. **Deliver** - Wiggly renders, saves, downloads, or shares the final output.

The common mental model is:

`Input -> Retrieve -> Generate -> Review -> Transform -> Deliver`

Formats may repeat or omit operations.

## Shared Stage Types

The assembly line should support a small set of reusable visual stage types:

### Choice

Use for product selection, premise selection, creative direction, style, or preferred variation.

### Script

Use for narration, dialogue, lyrics, captions, hooks, and other editable text.

### Media

Use for storyboards, frames, anchors, product images, clips, or other generated assets.

### Motion And Audio

Use for animation, voice, music, sound, and timed media.

### Final

Use for final preview, rendering, download, sharing, and starting another ad.

These are presentation types, not rigid pipeline positions. A format can use the same type more than once.

## Shared UX Contract

The assembly system owns:

- Bounded dimensions and scrolling
- Stage navigation and progress
- Expanded and collapsed behavior
- Idle, running, blocked, failed, ready, and complete states
- Elapsed time and cost presentation when available
- Primary, retry, regenerate, and approval action placement
- Loading and long-running feedback
- Error placement and recovery
- Artifact thumbnails and media grids
- Prompt disclosure
- Paid-generation confirmation
- Final preview, download, and share placement
- Responsive behavior
- Accessibility semantics and keyboard behavior

Formats must not replace this shell with custom cards or parallel assembly interfaces.

## Format Responsibilities

Each format supplies:

- Assembly title
- Ordered stages
- Stage labels and short descriptions
- Operation and presentation type
- Current stage status
- Inputs and generated artifacts
- Primary and secondary actions
- Whether an action spends money
- Error and retry data
- Completion requirements

Format modules continue to own their generation logic, prompts, validation, scene contracts, and provider integrations.

## Minimal Stage Contract

The implementation should begin with the smallest contract that supports Brand Jingle and 3D Breakdown. It should not become a generic workflow engine.

Conceptually, a stage needs:

```ts
type AssemblyStage = {
  id: string;
  label: string;
  description: string;
  operation: "input" | "retrieve" | "generate" | "review" | "transform" | "deliver";
  presentation: "choice" | "script" | "media" | "motion-audio" | "final";
  status: "idle" | "running" | "blocked" | "failed" | "ready" | "complete";
  artifacts?: AssemblyArtifact[];
  primaryAction?: AssemblyAction;
  secondaryAction?: AssemblyAction;
  error?: string;
};
```

The final implementation may differ, but arbitrary full-stage React content should no longer be the default extension point.

## Example Pipelines

### 3D Breakdown

`Subject -> Direction -> Script -> Storyboard -> Anchors -> Clips And Voice -> Final`

### Brand Jingle

`Song -> Scenes -> Images -> Clips -> Final`

### Product Photoshoot

`Product -> Direction -> Images -> Review -> Final`

### Static Meme

`Direction -> Drafts -> Review -> Final`

The step count changes while the interaction model remains familiar.

## Scope

The first implementation phase should only standardize Brand Jingle and 3D Breakdown because they exercise the most complex existing workflows.

After those formats work through the same primitives, simpler formats can adopt the system incrementally when touched.

## Non-Goals

- Do not build a visual workflow editor.
- Do not let users reorder arbitrary provider jobs.
- Do not move detailed editing from `/builder` into `/create`.
- Do not rewrite generation prompts or provider integrations.
- Do not force every format to have the same number or names of stages.
- Do not migrate every format in one pull request.
- Do not add another renderer or scene state system.

## Rollout Plan

### Phase 1: Inventory

Map current Brand Jingle and 3D Breakdown stages to the universal operation and presentation types. Document gaps before changing UI.

### Phase 2: Shared Primitives

Create only the shared stage components needed by both formats: choice, script, media, motion/audio, final, action footer, artifact card, and common status states.

### Phase 3: Migrate Brand Jingle

Move Brand Jingle onto the structured stage contract without changing its pipeline behavior.

### Phase 4: Migrate 3D Breakdown

Move subject selection, story direction, script, storyboard, anchors, clips, voice, and final output into the same assembly experience.

### Phase 5: Visual QA And Guardrails

Compare both formats side by side at desktop and mobile sizes. Add tests preventing bespoke top-level assembly shells and unbounded page growth.

### Phase 6: Incremental Adoption

Adopt the system in other formats only when their assembly experience is added or materially changed.

## Acceptance Criteria

- Brand Jingle and 3D Breakdown use the same assembly shell and stage layouts.
- Switching formats does not require learning new navigation, status, retry, or approval behavior.
- Different stage counts do not break layout or progress.
- Running and failed operations are visible without hunting.
- Paid actions always require explicit user approval.
- The right column remains bounded and usable at supported desktop sizes.
- Mobile stages remain readable without clipped controls.
- Format-specific generation and scene behavior remain isolated in format modules.
- `/create` does not become a mini-builder.
- Preview, download, and share continue through the existing scene and renderer contracts.

## Success Measures

- Less format-specific assembly UI code
- Fewer regressions when adding formats
- Faster implementation of new formats
- Consistent user understanding across formats
- Fewer reports of hidden actions, frozen states, clipped content, or unexpected page growth

## Risks

### Over-generalization

A schema that tries to model every future workflow will become harder to maintain than the current bespoke UI. Start with the shared needs of two real formats.

### Lowest-common-denominator UI

Standardization must not hide important format-specific artifacts. Formats may supply different data while using shared presentation patterns.

### Migration Regressions

Move one format at a time with browser QA and rollback commits. Do not combine this work with prompt, renderer, or provider changes.

## Open Questions For Later

- Should research appear as a visible stage or remain part of the initial generation state?
- Which cost and elapsed-time fields are reliable enough to show?
- Should prompt disclosure be available on every generated artifact or only at the stage level?
- How should partial success appear when some images or clips succeed and others fail?
- Which simple formats need an assembly line versus a single review-and-download surface?

