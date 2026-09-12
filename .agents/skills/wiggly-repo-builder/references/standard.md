# Wiggly Repo Standard

This is the single living record of what Wiggly has learned about reusable, agent-operated Formats. Update it after real builds and blind-agent runs, not after brainstorming alone.

## Contents

- How to update this standard
- Proven rules
- Still testing
- Otaku-specific choices
- Gate for calling something a Wiggly Repo

## How to update this standard

Classify every lesson:

- **Proven:** observed in a real failure or successful run.
- **Still testing:** plausible, but not yet supported by different Repos.
- **Format-specific:** useful inside one Repo and not a shared rule.

For a new lesson, record the behavior, root cause, smallest general rule, and evidence. Prefer changing an existing rule over adding a near-duplicate.

## Proven rules

### 1. Ship a runnable package

**Rule:** A Wiggly Repo must include its working runtime, not only a page, prompts, screenshots, or pseudocode. If the official runtime consumes another local Repo, ship both in one installable artifact or workspace instead of relying on a sibling that exists only in the source tree.

**Why:** A fresh agent rebuilt Otaku’s renderer when it could only see how the output was supposed to look. The replacement introduced different timing behavior.

**Evidence:** The downloadable Otaku Format Kit let fresh agents use the packaged runner and renderer instead. Bikini Bottom Dance Off preserved its one official character renderer by packaging the Dance Off and Character Motion Repos as npm workspaces; a clean extraction installed, checked, and rendered its smoke proof without the source workspace.

### 2. Make one runtime official

**Rule:** Preview, test, and final output must use the same packaged renderer and runner. Instructions must explicitly forbid rebuilding them.

**Why:** Reimplementation creates outputs that look close while quietly changing timing, layout, or audio.

**Evidence:** Otaku’s official runner preserved its renderer across Naruto, Danny Phantom, SpongeBob, Yu-Gi-Oh, and later blind-agent world changes.

### 3. Declare requirements without storing secrets

**Rule:** Name required local tools, providers, and environment variables. Keep secret values outside the Repo and ask only for missing key names.

**Why:** An agent should know what it needs before starting, while a person who receives the Repo supplies their own keys.

**Evidence:** Otaku’s requirement check separated Fish voice access from optional Serper asset sourcing without leaking either key.

### 4. Smoke-test before real work

**Rule:** Provide a free, one-command smoke test that exercises the official runtime and fixed assets without provider calls.

**Why:** Missing tools, broken assets, and renderer setup should fail before the agent spends money or builds a full run.

**Evidence:** Otaku’s smoke test found that short videos did not produce contact sheets under the old fixed sampling interval.

### 5. Validate before spending

**Rule:** Validate inputs, contracts, asset references, layouts, and timing data before any paid or rate-limited media call.

**Why:** Provider success cannot repair an invalid plan.

**Evidence:** Otaku rejects unknown roles, layouts, backgrounds, missing assets, and invalid scenes before Fish voice generation.

### 6. Read timing from media

**Rule:** Derive scene and output duration from actual audio or video files. Represent intentional holds explicitly; never add unexplained padding.

**Why:** Guessed padding created audible dead air between otherwise valid voice clips.

**Evidence:** Historical Otaku runs contained roughly 520 ms of extra time per scene. The official runner and audio checks now detect that mismatch.

### 7. Inspect the finished media

**Rule:** Evaluate the rendered output, not only plans, API responses, or individual assets. Produce inspectable evidence such as a contact sheet, playable output, and quality report.

**Why:** Many failures appear only after composition: clipped text, floating characters, silent gaps, hard music seams, or bad pacing.

**Evidence:** Otaku’s contact sheets and final-video inspection exposed visual grounding and audio-continuity problems that source validation could not.

### 8. Combine automatic gates with human judgment

**Rule:** Block finalization when measurable checks fail, then require an honest creative review for meaning, fit, and usefulness.

**Why:** Software can detect missing audio and bad timing but cannot decide by itself whether a joke lands or an analogy makes sense.

**Evidence:** Otaku automatically checks audio, timing, assets, and contracts while its review asks whether the lesson is accurate and natural.

### 9. Separate reusable mechanics from replaceable content

**Rule:** Keep content packs, prompts, assets, voices, and facts outside the reusable renderer and runner. When an asset source has no supported public API, expose a validated local import boundary instead of making private browser automation a runtime dependency.

**Why:** A content change should not require surgery on the engine.

**Evidence:** Danny Phantom and SpongeBob were added through world data, assets, voices, music, and scenes without story-specific renderer code. Bikini Bottom Dance Off replaced every solo and finale through input data, imported new Mixamo Collada files locally, and rendered a second real choreography with zero Mixamo or Fish calls.

### 10. Limit attempts and fail clearly

**Rule:** Set a small render-attempt ceiling. Fix only observed problems, and stop with a clear blocker rather than silently retrying or changing providers.

**Why:** Unbounded agent loops waste time and money while hiding whether the Format is reliable.

**Evidence:** Otaku caps a run at three attempts and records why each attempt exists.

### 11. Preserve evidence and provenance

**Rule:** Keep the Format version, input, assets and sources, dependency choices, attempt history, quality report, and final output reviewable after refresh or fresh checkout.

**Why:** A finished file alone cannot explain how it was made or whether another agent can reproduce it.

**Evidence:** Otaku packages world data, asset provenance, voice IDs, scene plans, contact sheets, quality reports, and final videos.

### 12. Return the result

**Rule:** A successful agent run ends by giving the user the finished media, not merely a path, commit, or “render complete” message.

**Why:** The user asked for the creative result, not the build system.

**Evidence:** The useful Otaku proof was the playable video delivered in chat.

### 13. Never animate planning thumbnails

**Rule:** Storyboards and contact sheets may guide production, but every generative-video start and end frame must be a separately generated, full-quality production asset.

**Why:** Enlarging a small storyboard panel produced a blurry endpoint, and the video model copied that blur while inventing a new person and setting to bridge the mismatch.

**Evidence:** The first 3D Breakdown LEGO proof passed duration and file checks but failed paid-media review because its ending frames came from upscaled storyboard crops. The corrected proof used four separate full-quality endpoints and kept the same workshop, subject, and physical story across both clips.

### 14. Persist provider jobs before waiting

**Rule:** Save a provider prediction ID as soon as a paid job starts, then collect or resume that same job after foreground timeouts. Never create a replacement call merely because local polling ended.

**Why:** A healthy media job can outlive the command, request, or function that started it. Treating a polling timeout as a provider failure risks duplicate spend and loses recoverable output.

**Evidence:** In the Style B LEGO proof, two Seedance predictions completed successfully after 319 and 1,725 seconds. The runner had already marked both failed because its foreground polling ended, but their exact outputs were recovered from the original prediction IDs without retries.

### 15. Add a reference inset exactly once

**Rule:** When a creator proof already contains its input as a baked-in inset, use a clean display copy before Wiggly adds its standard top-right reference.

**Why:** Reusing the composited creator proof and adding `referenceSrc` produced two copies of the original photo on Cool Tone Filter and Halo Effect cards.

**Evidence:** Clean display copies restored one top-right reference across both formats without changing the shared Discovery renderer.

### 16. Measure motion on the composed output

**Rule:** Omit zero-duration clips from media concat graphs, and verify sustained motion on the final rendered region with temporal freeze detection rather than unequal compressed-frame hashes. Inspection regions must consume the same layout contract as the compositor instead of duplicating crop coordinates.

**Why:** A zero-length hold can survive concat as a frozen frame and swallow the motion that follows it. Lossy encoding can still change pixel hashes on that visually frozen frame, producing a false pass. Hard-coded inspection crops can also keep passing after the visible layout moves, because they are no longer measuring the actual character panels.

**Evidence:** Bikini Bottom Dance Off's Squilliam finale appeared animated in its source clip and passed hash sampling, yet remained frozen for all nine rendered seconds. Removing the zero-duration segment and running `freezedetect` over the composed panel exposed and prevented the failure. Later, reserving a caption lane shortened and moved the panels while the inspector still held the old 635px crops; sharing one layout module restored accurate four-panel checks.

### 17. Measure replay seams perceptually

**Rule:** Force a keyframe when a replay bridge begins, preserve the compared frames as evidence, and evaluate the seam with half-scale luma SSIM. Keep a strict threshold rather than treating saturated chroma or fine-texture compression as a visible jump.

**Why:** The same bright or finely textured background can receive slightly different quantization at opposite ends of an H.264 file even when the loop looks identical. Full-resolution RGB or luma SSIM can reject invisible compression noise instead of measuring the structure people perceive on playback.

**Evidence:** Bikini Bottom Dance Off's exact Fish News flower background produced visually matching loop frames but failed RGB SSIM. The forced replay keyframe plus luma SSIM scored 0.996239 against the unchanged 0.995 gate. Its later dance-club canvas produced another visibly matching pair that scored 0.993305 at full-resolution luma and 0.996416 at half scale, again without lowering the gate.

### 18. Qualify what the creative reviewer can directly perceive

**Rule:** A finished-video review may ship only when the reviewer directly perceives every required channel. Record the perception basis for moving video and audio. Player state, mute or volume controls, captions, transcripts, waveforms, metadata, and provider receipts are indirect evidence; they cannot substitute for actually seeing motion or hearing sound. Missing or indirect perception makes the review inconclusive and requires a replacement reviewer, not a failed video score.

**Why:** A Bikini Bottom Dance Off blind agent watched the moving video in QuickTime but had no audio input. It initially inferred intelligibility from burned-in captions and an unmuted full-volume player, producing an unsupported audio score. A later capability audit retracted the judgment, while another agent correctly refused to score the same playback environment.

**Evidence:** Rubric `1.1.1` records direct, indirect, or unavailable perception for both channels. Its validator converts anything but direct audiovisual perception to `inconclusive`; a regression test proves that captions and unmuted player controls cannot impersonate hearing.

### 19. Send a launcher; keep one workflow in the Repo

**Rule:** A website or deep link sends only a coding-agent capability gate, the goal, stable latest-package location, package-reading instruction, paid-provider boundary, and definition of done. When terminal, filesystem, or local-media access is unavailable, the launcher must stop the chat from simulating the run and redirect the user to a supported coding agent. The downloaded Repo reports its exact manifest version and routes every supported agent through thin root entrypoints to one canonical `SKILL.md`. Never duplicate the operating manual across the website prompt, shell commands, `AGENTS.md`, `CLAUDE.md`, Cursor rules, or Copilot instructions.

**Why:** Bikini Bottom Dance Off's first Send to Agent prompt repeated inputs, commands, proof links, working rules, an exact version, and the first question. The user could not tell why most of it was being sent, while the ZIP itself had no root instructions and buried the real skill one folder down. That made the longest, fastest-staling copy the entrypoint.

**Evidence:** The `0.10.0` pilot replaces the duplicated prompt with a concise launcher, resolves the exact version from `KIT-MANIFEST.json`, and packages checked root adapters for Codex, Claude Code, Antigravity app and CLI, Cursor, and GitHub Copilot. A clean-package check rejects adapter copies that contain commands, provider recipes, or deliverables.

### 20. Publish every new Format with the rich Repo page

**Rule:** Every newly published Format uses the shared rich Repo-page presentation established by Bikini Bottom Dance Off. Adapt the content to the Format, but keep the compact hero, honest services and costs, run summary, included assets, finished examples, proof and quality evidence, readable Repo files, and agent CTA. Never add a new Format to the frozen legacy-page allowlist.

**Why:** A download button and generic proof grid do not explain what the agent needs, what the run costs, what is packaged, or why the Repo can be trusted. A shared structure makes those decisions predictable without creating a separate page implementation for each Format.

**Evidence:** Bikini Bottom Dance Off established the structure, and Animal Conversations reused the same shared page components while preserving its zero-provider audio workflow, character assets, camera grammar, proof, and exact v0.7.0 download. The publication guard rejects unknown future Formats until they register the rich presentation.

### 21. Keep smoke content out of real initialization

**Rule:** A smoke fixture may prove structure, but a real `init` must either run the official content selector or leave replaceable creative choices explicitly unresolved. Validation must reject stale fixture-derived selections after a dependent input such as the roster changes.

**Why:** Bikini Bottom Dance Off initialized every song with the same smoke choreography, then relied on an agent to replace twelve motion IDs manually. Agents kept familiar safe assignments, so nominally random episodes repeated the same dances.

**Evidence:** The first randomized-cast `Life Goes On` run exposed the repetition. Dance Off `0.17.0` moved choreography into a seeded selector, proved identical-seed reproducibility, rejected a roster changed after selection, recorded a two-run cooldown, and rendered a 47-second smoke with twelve distinct motions through the unchanged official renderer.

### 22. Click native close buttons on modal dialogs

**Rule:** Never delete or hide modal dialogs in the DOM. Always click the page's native close button (`svg[aria-label="Close"]` or `[role="button"]`).

**Why:** Deleting the modal leaves its dark backdrop scrim covering the screen, making the entire capture dim and gray. Clicking the real button dismisses the scrim and captures full native brightness.

**Evidence:** Capturing `@_otaku_explains_` by removing `div[role="dialog"]` created dark, murky channel screenshots. Clicking Instagram's native `Close` button cleanly tore down the scrim and captured a crisp, bright 2560x1920 proof at 100% saturation.

### 23. Surface live render progress via interactive Generative UI and auto-open upon completion

**Rule:** Every video render command must emit an interactive Generative UI progress artifact (`progress.html`) alongside `progress.json`. Agents running inside Antigravity, Cursor, Claude Code, or Codex must immediately surface this live HUD widget inline via `<agent-embed url="..." height="260" title="...">` when a render begins. Furthermore, as soon as the render finishes and passes inspection, the agent **must automatically execute `node runner.mjs open --input=<path>` (or a cache-busting / lock-releasing player launcher)** so the user can immediately review the video without having to manually copy paths or run shell commands. Never use naive `open -a "QuickTime Player" <path>` on macOS without closing stale documents first (which causes a frozen still frame at the previous pause position), and never leave open file handles on Windows NTFS before re-rendering (which triggers `EBUSY: resource busy or locked`). `node runner.mjs open` handles both OS environments cleanly.

**Why:** Terminal ANSI sequences buffer or collapse in IDE background tasks, leaving the user with zero visibility during multi-minute Remotion renders. Sandboxed browser iframes cannot directly spawn native OS apps due to browser security restrictions. Having the agent display the live Generative UI HUD during the render and then autonomously launch the player upon completion provides a seamless, zero-friction developer experience. Cache-busting and lock-releasing ensure that successive renders reload the latest file bytes from disk and play from 00:00 without OS file-lock crashes.

**Evidence:** In the 111-second `otaku-explainer.mp4` render, re-rendering over an existing video caused QuickTime to foreground a stale file handle frozen at 00:23 instead of playing the new render. On Windows, NTFS holds an exclusive lock that crashes Remotion with `EBUSY`. Closing existing player instances before opening forced QuickTime to reload the fresh file descriptor from disk, reset the playhead to 00:00, and immediately start playback.

## Still testing

These ideas are deliberately not universal yet:

- Every Wiggly Repo should use the exact Otaku command names.
- Every Repo needs scenes or a timeline.
- Every Repo needs a contact sheet; static-image Formats may need different evidence.
- Run evidence should share one product-wide UI component.
- One folder and manifest shape can cover static ads, template-only video, and generative video equally well.
- Dialogue Formats with simultaneous performance should separate the active performers from caption ownership and show both in one exact-time approval artifact. Animal Conversations v0.15.0 fixed a real Dog/Bunny overlap failure this way, but the rule has not yet been challenged in another dialogue Repo.

Repo #2 should challenge these assumptions instead of copying Otaku blindly.

## Otaku-specific choices

Do not put these into a general builder or Wiggly’s app shell:

- learner, guide, and challenger roles;
- story-world packs and lore;
- 12–18 short scenes;
- anime or cartoon character cutouts;
- two- and three-character layouts;
- speech bubbles, moving backgrounds, callouts, and active-speaker glow;
- the rule that a technical lesson maps to events from a fictional world.

## Gate for calling something a Wiggly Repo

A candidate passes only when:

1. A fresh agent can start from the Repo package or page without the user teaching the Format.
2. The free smoke test proves the official runtime locally.
3. Missing tools and key names are reported before work begins.
4. Validation happens before spending.
5. At least two meaningfully different inputs use the same runtime.
6. The agent inspects the real output and cannot finalize failed checks.
7. Replaceable content does not require proof-specific renderer or runner changes.
8. The final media and evidence are returned and remain reviewable.

Passing one beautiful example is not enough.
