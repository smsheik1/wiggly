# Cartoon Explainer

Turn a real lesson into a short conversation between familiar characters. A curious lead asks the obvious questions, an expert explains the idea through the story world, and a third character adds tension or a joke.

This package is the first Wiggly Format repository experiment. It contains the instructions, inputs, assets, prompts, scene slots, renderer, audio rules, quality checks, and exact run records needed to recreate its outputs.

An agent can operate the package without an OpenRouter planning call. Start with `SKILL.md`; it explains how to check requirements, create and validate a scene plan, request one render-loop approval, inspect the result, and stop after three attempts.

The agent's first question is: **What should the characters explain?** If the user says “do it for me,” the agent uses the default packaged world. Otherwise it asks which packaged world should teach the lesson. It asks only one question at a time.

## Start from the public Wiggly Repo

1. Download and unzip the **Runnable Format Kit**.
2. Open its `v3` folder and run `npm install`.
3. Run `npm run smoke`. This free local test proves the renderer, assets, FFmpeg, Remotion, and audio mix work.
4. Run `npm run prototype:otaku -- check`. Planning and validation do not need a provider key.
5. Tell Claude or Codex: “Read `public/format-repositories/otaku-explainer-v1/SKILL.md` and use the packaged renderer. Do not rebuild it.”
6. Before voice generation, copy `.env.example` to `.env.local`, add the requested key values, and run `npm run prototype:otaku -- check --stage=render`.

The kit contains the real runner, renderer, dependencies, rules, layouts, and required assets. A fresh agent may write a new scene plan or story-world pack, but it must not recreate the renderer or timing pipeline.

## Formula

1. Open with a question that names the confusing idea.
2. Explain it one step at a time through story-world objects and actions.
3. Let the challenger introduce a believable mistake, warning, or joke.
4. Correct the mistake and complete the lesson.
5. End with the lead character saying the core idea back in one simple line.

Each scene uses the same visual grammar: a slowly panning story-world background, two or three grounded character cutouts, one visible speaker, one speech bubble, and an optional short callout.

Scene writers choose lesson roles and an approved layout. `worlds/*.json` maps the roles to characters and voices, while `layouts.json` owns the coordinates. This keeps a new topic from inventing a new renderer.

## Agent commands

From `v3`:

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

The Fish key stays in `v3/.env.local`. Serper is needed only when a run adds a new story world. `SKILL.md` tells the agent how to research lore, choose voices, source and inspect assets, and create the world pack without adding another command or changing the renderer. The package never needs OpenRouter, Replicate, a GPU, image generation, or video generation.

`pipeline.json` lists every deliverable, provider call, estimate, and approval point. The packaged `s2.1-pro-free` voice model is currently priced at $0 under Fish Audio's fair-use terms; the agent must recheck the linked pricing page before presenting that estimate as current.

Run progress is saved under `public/format-repositories/otaku-explainer-v1/agent-runs/<run-id>/`. After a restart, read `state.json` and continue the next unfinished step instead of starting over.

## Proof runs

The Format page discovers every packaged world from `worlds/*.json`, every scene plan from `scenes/*.json`, and every finished proof from `outputs/*.run.json`. These files are the source of truth; the README and page do not maintain separate lists.

Every proof uses the same scene contract and `renderer/OtakuFormatRenderer.tsx`. The web repository includes the full tracked videos, contact sheets, run records, and quality reports. The portable ZIP omits those heavy outputs, but includes the original reference, one visual golden, and the validated scene plans.

## Editing

Assets and deterministic scene values can be replaced without regenerating the script. Changing a prompt or instruction marks the package **Needs rerun**, because an old output must never pretend to reflect a new prompt.
