# Squilliam News proof report

## Format boundary

The fixed Format is the verified character-pack contract, studio, camera, presenter-derived gesture system, desk-safe arm retargeting, mouth/jaw-bone lip sync, ten monitor layouts, 30-second timeline, renderer, and quality gates. Replaceable content includes the verified `characterId`, promotion script, facts, ticker, slide copy, story images, pronunciation overrides, provenance, and approved narration.

The two full promotional proofs below were freshly rendered and automatically inspected under corrected version `0.2.1-proof`. They share current runtime fingerprint `480d2e91d07b115cb0e161c0d5a2f9e8ec022a49463f8647695575f296662533` while carrying different content and video hashes. Historical v0.1 evidence, the human-rejected v0.2.0 eye-regression evidence, and the superseded pupil-only blink render remain available under each example's `evidence/history/` directory.

## Proof 1 — We The Artists

- Input: a live-art, music, visual-art, and spoken-word event in Indianapolis.
- Final output: `examples/we-the-artists/evidence/final.mp4`.
- Result: current automatic checks pass on attempt one; Squilliam's yellow eyes and red pupils remain visible through close samples around both former blink moments. The user approved the corrected review and it was finalized with video hash `4225ac87c1d6db293579502c2ffe5b660a6351aa8b74e16b471060f7e80657db`.
- Automatic evidence: exact 30.000 seconds, 1280×720, 30 fps, one AAC stream, no detected black segment, no interior silence over 0.6 seconds, and a 0.899-second intentional final hold.
- Runtime, content, audio, and video fingerprints are recorded in `examples/we-the-artists/evidence/quality-report.json`.
- Human and automatic approval are bound to the same runtime/content/video hashes in `examples/we-the-artists/evidence/finalization.json`.

## Proof 2 — Wiggly Format Lab

- Input: a software-format promotion with synthetic instruction, renderer, and evidence graphics; no event imagery or Indianapolis facts.
- Current output: `examples/wiggly-format-lab/evidence/review.mp4`.
- Result: current automatic checks pass on attempt one; human creative review is still required before finalization.
- Historical portability failure: a longer monitor eyebrow clipped in the first v0.1 attempt. A shared measured-text fitting rule fixed it without proof-specific renderer code; the current v0.2.1 proof passed on its first attempt.

## Attempt and provider record

- Each run is capped at three render attempts and records its state.
- The We The Artists narration was supplied as previously approved audio, so the current run made no provider call.
- Wiggly Format Lab recovered its narration locally from the historical v0.1 review. The current run made no provider call. The earlier explicitly authorized Fish Audio `s2.1-pro-free` receipt is retained under `evidence/history/v0.1/` and stores no API key or private voice model ID.
- Each example's `narration-source.json` binds the packaged audio and current render audio to hashes and records zero provider calls for the v0.2.1 run.
- Fish Audio's official published free window was checked on August 4, 2026 and is recorded in `requirements.json`; later users must recheck it.

## Shared-standard decision

No new universal Wiggly rule is proposed. The general lessons—separate content from runtime, inspect final media, and derive timing from actual audio—already exist in the shared standard. Text fitting and resumable browser-frame caches remain Format-specific evidence.

## Character-pack proof — version 0.2.1

- Verified selectors: `squilliam`, `squidward`, `spongebob`, and `mr-krabs`.
- Every selector validated and rendered the same 900-frame motion plan through `runtime/renderer/app.js`.
- Nine representative source frames per character were encoded into a smoke video and contact sheet.
- Every admitted Collada model now declares stable transparent facial-material names. Corrected smoke evidence visibly retains Squilliam and Squidward's yellow/red eyes, SpongeBob's complete blue-eye art, and Mr. Krabs' pupils and lids. Squilliam and Squidward's pupil-only scale joints are explicitly not presented as eyelids.
- Media hashes, content hashes, the current runtime hash, and admission checks are recorded in `evidence/character-packs/quality-report.json`.
- Patrick, Sandy, Larry, Man Ray, Announcer Fish, and Gary were deliberately excluded; `CHARACTER-AUDIT.md` records the reason for each.

## Historical blind-agent handoff — version 0.1

A fresh agent received only the packaged v0.1 ZIP and the desired We The Artists outcome. It installed dependencies, ran smoke and requirements checks, initialized the supplied example, validated, rendered, inspected, and finalized on attempt one of three without editing the renderer or calling a provider. Its final MP4 SHA-256 was `966b601ebc40e1fed8724fdcb7c843fb027c56d950eb8e4dabafe54d9757dcd8`, exactly matching the historical v0.1 final. Receipts are retained under `evidence/blind-handoff/history/v0.1/`.

## Rejected blind-agent handoff — version 0.2.0

A second fresh agent received only the v0.2.0 ZIP and operationally completed smoke, checks, validation, rendering, automatic inspection, and actual MP4 playback with zero provider calls. The user then rejected the output because Squilliam's eye cutout was opaque and hid the intended eye art. That handoff is invalid as creative proof even though automatic checks passed; its receipts are archived under `evidence/blind-handoff/history/v0.2.0-broken-eyes/`.

The root cause was reliance on a browser-resolved texture URL instead of stable Collada material names. Version 0.2.1 fixes that shared character-pack rule, adds contract regression coverage, and archives every stale v0.2.0 proof. A close pass on the first corrected package then found a separate pupil-only fake blink; that intermediate proof is also archived.

## Current blind-agent handoff — version 0.2.1

A fresh agent received only candidate archive `d6526546e1cbdc95f26c3268419ca643f2c3d3bba5eaec68a93551138016fdfa`. It clean-installed the kit, passed all 14 tests, smoke, check, validation, render, automatic inspection, and actual Chrome playback on attempt one of three with zero provider calls and no renderer edits. It stopped before finalization.

The returned video and contact sheet are byte-identical to the current We The Artists evidence. Six close samples around the two former pupil-disappearance moments plus thirty one-second samples retained both yellow eye fields and both red pupils, with no opaque facial cutout. Current receipts are under `evidence/blind-handoff/v0.2.1/`.
