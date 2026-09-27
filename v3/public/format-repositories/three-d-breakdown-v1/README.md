# 3D Breakdown Wiggly Repo

This Repo packages the recipe behind Wiggly's existing 3D Breakdown Format. It does not create a second renderer or a second creative pipeline.

## Send the link to an agent

You can send an agent only this Repo link.

The agent should ask:

1. `What brand or website is this for?`
2. `Do you want Guide Me or Turbo?`
3. `What should the video focus on?`

The agent asks one question at a time.

**Guide Me** shows each big step and waits for you.

**Turbo** makes the choices after you approve one clear run estimate. The estimate lists each provider step, its call count, its current cost, the total cost, and the expected time. Turbo covers one normal attempt per step. Retries still need a new yes.

The agent never asks for a budget. It never asks you to choose tools or models.

Before planning, watch the packaged FinalStraw reference first, then Grüns, Kiala Nutrition, and Theragun, and read `goldens.json`. FinalStraw is the canonical Style B reproducibility target. These references teach structure, not claims, shots, or copy to reuse.

## What it makes

1. Five story directions from website evidence.
2. One selected Style B script and scene.
3. One six-frame storyboard contact sheet.
4. Four full-quality 9:16 video endpoints: frames 1, 3, 4, and 6.
5. After separate approval, two coherent 10-second 480p clips with three readable visual beats each.
6. One Fish narration and one final 20-second MP4 rendered through `AdRenderSurface`.

The storyboard is a planning reference. Its small panel crops must never become video endpoints.
Your coding agent authors the story slate, script, and scene plan. The packaged prompt commands provide the exact contracts; imports validate them locally before any media call. No NVIDIA NIM account or separate LLM API key is required. Coding-agent usage still applies.

Extract the ZIP, enter its v3 directory, run npm install, then npm run smoke. For research, use the research object in public/format-repositories/three-d-breakdown-v1/fixtures/agent-cookie-gift.json as a structural example, not as facts to reuse. Write sourced brand, offer, audience, buyer moments, evidence receipts, and optional products with real URLs. Null is allowed for unavailable brand images; use empty arrays for unavailable optional facts. An existing Wiggly export also works.

## Commands

```bash
npm run format:three-d -- check --stage=plan
npm run format:three-d -- init --run=my-run --research=/absolute/path/research.json --subject=brand
npm run format:three-d -- prompt --run=my-run --stage=directions
# Read the saved prompt, then author directions.json with your coding agent.
npm run format:three-d -- directions --run=my-run --input=/absolute/path/directions.json
# Choose a direction, then author script.json using this prompt.
npm run format:three-d -- prompt --run=my-run --stage=script --direction=idea-1
npm run format:three-d -- script --run=my-run --direction=idea-1 --input=/absolute/path/script.json
# Review the script, then author plan.json using this prompt.
npm run format:three-d -- prompt --run=my-run --stage=plan --direction=idea-1
npm run format:three-d -- select --run=my-run --direction=idea-1 --input=/absolute/path/plan.json
npm run format:three-d -- validate --run=my-run
npm run format:three-d -- inspect --run=my-run
```

Failed imports do not advance the run. Correct the authored JSON and retry locally; there is no planning provider call. Once the scene is assembled, start a new run to change it so existing media and reviews stay intact.

Image commands always create one image:

```bash
npm run format:three-d -- image --run=my-run --kind=storyboard --approve-image
npm run format:three-d -- review --run=my-run --asset=storyboard --decision=approve
npm run format:three-d -- image --run=my-run --kind=anchor --frame=1 --approve-image
npm run format:three-d -- review --run=my-run --asset=anchor-1 --decision=approve
npm run format:three-d -- image --run=my-run --kind=anchor --frame=3 --approve-image
npm run format:three-d -- review --run=my-run --asset=anchor-3 --decision=approve
npm run format:three-d -- image --run=my-run --kind=anchor --frame=4 --approve-image
npm run format:three-d -- review --run=my-run --asset=anchor-4 --decision=approve
npm run format:three-d -- image --run=my-run --kind=anchor --frame=6 --approve-image
npm run format:three-d -- review --run=my-run --asset=anchor-6 --decision=approve
```

Each image command makes one attempt-specific file. Approve a good current result, or reject it with a useful reason and generate a replacement:

```bash
npm run format:three-d -- review --run=my-run --asset=anchor-4 --decision=reject --reason="The demonstrator identity drifted."
```

Video commands create one paid clip at a time:

```bash
npm run format:three-d -- video --run=my-run --clip=1 --approve-video
npm run format:three-d -- review --run=my-run --asset=clip-1 --decision=approve
npm run format:three-d -- inspect --run=my-run
npm run format:three-d -- video --run=my-run --clip=2 --approve-video
npm run format:three-d -- review --run=my-run --asset=clip-2 --decision=approve
npm run format:three-d -- inspect --run=my-run
```

If Replicate is still processing after the local wait ends, the runner saves the prediction ID instead of failing the clip. Run the same `video` command again to check and collect that exact job. A saved active job never requires another approval and never creates a replacement generation.

If clip 2 is creatively good but its meaningful action lands after the 16-second end-card boundary, retime the existing file locally instead of buying another generation:

```bash
npm run format:three-d -- retime-clip --run=my-run --clip=2 --action-seconds=6 --approve-local-retime
npm run format:three-d -- review --run=my-run --asset=clip-2 --decision=approve
```

The original provider file remains preserved. The retimed result requires a new review and makes no provider call.

Finish with one approved voice call and a local render:

```bash
npm run format:three-d -- check --stage=voice
npm run format:three-d -- voice --run=my-run --approve-voice
npm run format:three-d -- check --stage=final
npm run format:three-d -- render --run=my-run
npm run format:three-d -- inspect --run=my-run
npm run format:three-d -- finalize --run=my-run --approve-final
```

`render`, `inspect`, and `finalize` are local and make no provider calls. Regenerating any upstream media invalidates the old final report. Do not finalize just because rendering completed; watch the video first.

Compare the result with FinalStraw and at least one supporting reference before finalizing. A file can pass resolution, duration, and audio checks while still failing as an ad.

Never paste keys into prompts, files, run records, or chat. Add the required key names to root `secrets.env` or export in environment.

## Important boundary

The official renderer remains `features/formats/three-d-breakdown/render.tsx`, consumed through `AdRenderSurface`. Do not rebuild it. The Repo runner writes the same `ThreeDBreakdownAdScene` contract that `/create`, preview, download, and share already understand.
