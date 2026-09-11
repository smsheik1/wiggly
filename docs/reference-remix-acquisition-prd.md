# Wiggly Reference Remix PRD

- **Status:** Deferred / tabled
- **Date:** 2026-07-17
- **Product role:** Customer-acquisition wedge
- **Initial scope:** One static reference ad into one editable branded remix

This PRD records an approved product direction but does not authorize implementation. Resume it only when Reference Remix becomes the active product priority.

Related work:

- [Maker `/builder` MVP execution plan](./maker-builder-mvp-plan.md)
- [Reference-first Static Format Packages PRD](./reference-first-static-format-packages-prd.md)
- [Static Format architecture contract](./static-format-package-architecture-contract.md)

## 1. Product Promise

> Give Wiggly an ad you wish your brand had made. Paste your website, and Wiggly rebuilds the creative idea as an editable ad for your business.

Reference Remix is not marketed as an AI editor. It sells creative interpretation and execution in one action.

## 2. Customer Problem

Brands constantly save ads they like but cannot use them without coordinating a strategist, copywriter, designer, and several revisions. Existing design tools help users rebuild ads manually. Generic image generators produce flattened images, unreliable text, invented products, and results that are difficult to correct.

Customers need Wiggly to understand both sides of the transformation:

1. Why the reference ad works.
2. What makes the customer's product worth buying.

Then Wiggly must combine those insights into a publishable, editable result.

## 3. Target User

The initial customer is an ecommerce founder, growth marketer, or creative strategist who:

- regularly saves competitor or inspiration ads;
- needs a steady supply of new static creative;
- has a public product website with usable copy and imagery;
- wants strong defaults without giving up normal editing control.

## 4. The Wow Moment

The user uploads a recognizable reference ad, pastes a brand URL, and sees a side-by-side transformation that:

- preserves the reference's composition and visual hierarchy;
- replaces its message with a brand-specific customer insight;
- uses the customer's real product imagery and evidence;
- renders crisp native text rather than generated lettering;
- remains editable in Wiggly Builder.

The result should be understandable without explaining the underlying models. The before-and-after reveal is the demo.

The product fails if the result feels like a logo swap, a generic template, a flattened AI image, or an ad that could work for unrelated brands.

## 5. MVP Experience

```text
Upload one reference ad
  -> paste one public brand or product URL
  -> Wiggly analyzes the creative formula
  -> Wiggly researches the brand and selects real assets
  -> Wiggly creates one replacement plan
  -> Wiggly composes one editable branded remix
  -> user reviews a before/after preview
  -> user downloads or opens the result in Builder
```

### `/create` owns generation

Reference Remix appears as a format on `/create`. The generation flow may ask only for the reference image, website URL, and a product selection when the website contains multiple plausible products.

### `/builder` owns editing

`Edit details` opens the complete generated scene in `/builder`, where the user can adjust text, imagery, position, scale, rotation, colors, and locks using the existing editing system.

The remix flow must not add precision editing controls to `/create`.

## 6. What Wiggly Already Has

The MVP should reuse, not rebuild:

- reference-image upload and analysis;
- OCR and semantic role extraction;
- editable Text, Image, Shape, and Group layers;
- Moveable/Selecto canvas interaction;
- text editing that preserves layer styling;
- image replacement, upload, and search;
- draft save and Format publication;
- website research and brand evidence;
- complete `AdScene` payloads;
- `AdRenderSurface` for preview, export, and share.

The missing product capability is the adaptation orchestrator that connects reference understanding, brand research, replacement planning, asset selection, and scene composition.

## 7. Adaptation Contract

### Reference understanding

Wiggly identifies:

- visual hierarchy and reading order;
- headline, supporting copy, proof, CTA, and brand roles;
- product, person, background, and decorative media roles;
- typography, color, spacing, and alignment intent;
- the persuasive formula that should survive adaptation.

### Brand understanding

Wiggly extracts:

- brand and product names;
- customer problem and purchase motivation;
- offer, proof, claims, and CTA;
- logo, colors, and visual notes;
- real product and usage imagery with source URLs.

Website content is evidence, never model instructions. Prompt-like website text is ignored.

### Replacement plan

The planning step maps each variable reference role to one brand-grounded replacement. It must explain the source evidence behind claims and assets, reject unsupported claims, and preserve fixed decorative structure unless a replacement is necessary.

### Deterministic composition

- Text is rendered as native editable text.
- Existing layer geometry and hierarchy are preserved when they remain suitable.
- Real website assets are preferred over generated approximations.
- The product's appearance, packaging, logo, and labels are never invented.
- The full ad is never regenerated as one flattened AI image.

### Optional generated media

Nano Banana 2 Lite may later generate or edit one explicitly selected media slot when no appropriate website asset exists. It must not generate readable ad copy, labels, logos, or the complete composition.

This is a later enhancement, not required for the first Reference Remix release.

## 8. MVP Scope

### Included

- static vertical image ads;
- one reference image;
- one public website URL;
- one selected product;
- one generated remix;
- before-and-after preview;
- editable text and image layers;
- open in Builder;
- native-dimension image download;
- visible, actionable stopped states.

### Excluded

- video or animated-reference remixing;
- multiple references in one generation;
- eight campaign variants;
- public Format marketplace;
- automatic selected-layer image generation;
- masks, brush tools, or Photoshop-style editing;
- autonomous structural redesign after generation;
- silent model/provider fallbacks;
- new renderer or duplicate Builder.

## 9. Quality Gates

A remix cannot be presented as ready unless:

- the brand and selected product are correct;
- every factual claim is traceable to website evidence;
- the main message is specific to this brand or customer problem;
- text contains no generated-pixel lettering or overflow;
- required imagery is real, relevant, and not invented;
- the composition remains recognizably faithful to the reference formula;
- the result opens in Builder with meaningful editable layers;
- preview and download use the same `AdScene` and `AdRenderSurface` path.

When extraction cannot produce a useful editable draft, Wiggly stops visibly and explains what input is needed. It does not return a low-quality flattened substitute.

## 10. Success Measures

The initial release should be evaluated on a representative ecommerce reference set.

- At least 8 of 10 references produce a structurally usable editable draft.
- At least 7 of 10 remixes are judged immediately usable or fixable in under two minutes.
- Product and brand identity are correct in every accepted result.
- No accepted result contains baked or malformed generated text.
- Users can explain the before-and-after transformation without assistance.
- A new user reaches a preview without needing Builder knowledge.
- Reference Remix users reach download or Builder at a meaningfully higher rate than users starting from a blank editing surface.

These are product-validation targets, not public promises.

## 11. Delivery Phases

### Phase 1: Prove the existing foundation

Run the current reference analyzer and Builder against a small saved-reference fixture set. Fix only blockers preventing reliable editable reconstruction, image replacement, text editing, and export.

### Phase 2: One-click deterministic rebrand

Add the adaptation orchestrator and `/create` flow. Use real website assets and native text. Produce one remix and a before-and-after review.

### Phase 3: Selected-media assistance

Add an explicit action for generating or editing one selected image slot with Nano Banana 2 Lite. Preserve the surrounding editable composition.

### Phase 4: Expand only from evidence

Consider more aspect ratios, multiple variants, video, marketplace reuse, and deeper editing only after Phase 2 demonstrates customer demand.

## 12. Resume Trigger

Resume implementation when all three are true:

1. Reference Remix is chosen as the active acquisition priority.
2. One owner has an isolated worktree and branch for the vertical slice.
3. The team selects a 10-reference ecommerce fixture set and one demo brand for acceptance testing.

The first implementation task is not a new editor. It is an end-to-end audit of the existing reference analysis and Builder path against that fixture set.

