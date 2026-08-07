---
name: otaku-explainer-format
description: Use the Cartoon Explainer Format to make a short story-world lesson video without asking the user to explain how the Format works.
---

# Cartoon Explainer Agent Loop

You are operating a complete runnable Wiggly Format Kit. The user supplies a topic and chooses a packaged story world. This folder supplies the cast, voices, backgrounds, layouts, renderer, runner, audio rules, and quality checks.

## Start the conversation

Always name the step you are on.

1. Ask one short question: **What should the characters explain?**
2. If the user says “do it for me,” “pick for me,” or “Turbo,” use the default packaged world in `inputs.json` and continue without more creative questions.
3. Otherwise ask one second question: **Which packaged story world should teach it?**
4. Never ask budget questions. Before provider work, show the estimate from `pipeline.json` as a short list.

Use these progress labels in every update: `1. Setup`, `2. Scene plan`, `3. Validation`, `4. Voice + render`, `5. Review`, `6. Final`.

## Use the packaged runtime

Do not rebuild, replace, translate, or imitate the renderer. Run the renderer and runner already included in this kit. A different framework or a new scene-timing loop is a failed use of the Format, even when its final video looks similar.

If you received the public Wiggly Repo URL, download and unzip the **Runnable Format Kit** first. Open its `v3` folder, run `npm install`, copy `.env.example` to `.env.local`, and add only the missing key values. Then follow the commands below.

The renderer deliberately adds a soft glow around the active speaker. This hides rough transparent-image edges and makes the speaker obvious. Preserve that behavior.

## Commands

Run commands from the downloaded kit's `v3` folder:

```bash
npm run smoke
npm run prototype:otaku -- check
npm run prototype:otaku -- init --run=<run-id> --topic="<topic>" --world=naruto
npm run prototype:otaku -- validate --run=<run-id>
npm run prototype:otaku -- check --stage=render
npm run prototype:otaku -- render --run=<run-id> --approve-loop
npm run prototype:otaku -- inspect --run=<run-id>
npm run prototype:otaku -- finalize --run=<run-id>
```

Run `npm run smoke` first. It makes a tiny local test video and verifies the packaged renderer, assets, FFmpeg, Remotion, and audio mix without calling Fish or any paid provider.

`--approve-loop` records permission for one initial render and up to two focused improvement renders without storing secrets. If the configured voice model is free and the user already asked the agent to make the video, that request is enough; do not interrupt them for another approval. Ask first when a provider may charge money.

## Required loop

1. Read this file, `requirements.json`, `worlds/<world>.json`, `layouts.json`, `scene-contract.json`, `prompts/script-system.md`, and `quality.json`.
2. Run `npm run smoke`, then run `check`. Both are local and free. If either fails, stop and report the exact missing local requirement.
3. Run `init`, then write 12–18 short scene records in the new run's `scene-plan.json`.
4. Use only packaged role names, backgrounds, layout IDs, and assets. Do not invent character coordinates.
5. Run `validate` before any media call. Fix every validation error first.
6. Show the user the scene plan, scene count, cast, estimated duration, and the estimate list from `pipeline.json`.
7. Run `check --stage=render`. If it reports a missing key, ask the user to add the named key to `.env.local`. Never ask them to paste a secret into chat and never print its value.
8. If any provider call may cost money, ask once for approval covering no more than three total render attempts. The packaged Fish model is currently listed as free, but the user’s request still authorizes only the current run.
9. Run `render --approve-loop` for the first attempt. Later attempts use `render` without that flag.
10. Run `inspect`. Look at the full video and contact sheet. Record only concrete problems in `quality-report.json`.
11. Fix only the problems you found. Do not rewrite good scenes. Render and inspect again when needed.
12. Run `finalize` only when every automatic and human review check passes.

## Resume a run

Run state lives in `public/format-repositories/otaku-explainer-v1/agent-runs/<run-id>/state.json`.

- `draft`: validate the scene plan.
- `rendering` with a failed attempt: fix the reported failure, then render again if attempts remain.
- `rendered`: run `inspect`.
- `inspected`: finish the creative review in the latest quality report.
- `finalized`: return the paths in `final.json`.

Never create a new run just because the chat restarted.

## Add a story world

When the user asks for a story world that is not packaged:

1. Run `check --needs-new-assets`. Ask for missing key names without exposing their values.
2. Research the show's characters, relationships, locations, and lore. Record the sources you used.
3. Map one character to each lesson role: learner, guide, and challenger. Keep the renderer, layouts, and scene contract unchanged.
4. Search Fish Audio's public models for each character, audition available samples, and record the chosen model IDs and why they fit.
5. Use Serper to find full-body character cutouts and wide backgrounds. Follow `prompts/image-search.md`; prefer existing transparent assets and use local cleanup when needed.
6. Source one quiet instrumental track using the music procedure below.
7. Add the inspected files and provenance to `assets.json`, then create `worlds/<world>.json` with the cast, voices, backgrounds, useful lore, claims to avoid, and selected music.
8. Validate the new world before rendering. If it requires special renderer, runner, layout, or schema code, stop: the Format is not portable yet.

Do not generate images unless the user separately approves it. Do not add an automated world-building workflow; the agent performs and documents this work.

### Source story-world music

1. Search Serper for `"<story world> background music instrumental"` and inspect the top three credible results.
2. Prefer an exact official or studio instrumental over a cover, remix, or re-orchestration unless the Format calls for one.
3. Download audio with `uvx yt-dlp --no-playlist -x --audio-format mp3 --audio-quality 0 <url>`.
4. Use FFprobe and FFmpeg to check duration, loudness, clipping, and trailing silence. Remove dead air, normalize with `loudnorm=I=-14:TP=-1.5:LRA=11`, and use a one-second crossfade when looping the track to the video length.
5. Verify that the loop has no silent seam and dialogue remains clear. If you cannot hear the candidates, do not claim that you auditioned them: use metadata and technical checks, then show the user playable options when taste affects the decision.
6. Record `localPath`, `sourceUrl`, `volume`, and `selectionReason` in the world pack. Keep the Format's default music when no candidate passes.

## Good result

A passing result:

- teaches the topic accurately in language a nontechnical viewer can repeat;
- sounds like a natural conversation, not a lecture pasted into character mouths;
- uses a story-world analogy that stays consistent;
- keeps every visible character grounded;
- fits every line inside the speech bubble;
- assigns the right voice to the active speaker;
- uses a clean music loop that stays below the dialogue; and
- leaves a clear final takeaway.

## Failure rules

- Never render an invalid plan.
- Never rebuild the packaged renderer or write a substitute timing/rendering pipeline.
- Scene duration comes from the actual voice file. Never add arbitrary silence after a voice clip.
- Use the full-length music bed prepared by the runner. Never loop a short track with a hard seam.
- Never exceed three attempts for one run.
- Never silently change providers or generate replacement images or video.
- If the packaged world lacks an asset, stop and explain what is missing. Use Serper only after the user approves sourcing a new asset.
- If attempt three still fails, stop and explain the blocker. Do not mark the run finished.
- Do not expose, copy, log, or store API key values.
