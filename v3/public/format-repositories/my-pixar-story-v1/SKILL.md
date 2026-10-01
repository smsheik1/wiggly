---
name: my-pixar-story
version: 2.0.0
description: Operate the persistent four-beat memoir workflow through character-sheet approval using the packaged LangGraph runner.
---

# Operate the current deliverable

You are the operating agent. Read requirements.json, scene-contract.json and quality.json. Use this package's runner.mjs; never rebuild its state machine or invoke the old app scripts. Install pinned dependencies with `npm ci`, then run `npm run check` and `npm run smoke`. Use a new absolute run directory, separate from legacy runs. Existing checkpoints cannot be reset by init.

```sh
node runner.mjs init examples/parent.json --run /absolute/new-run
node runner.mjs status --run /absolute/new-run
node runner.mjs work --run /absolute/new-run
node runner.mjs schema script
node runner.mjs schema event
node runner.mjs respond /absolute/event.json --run /absolute/new-run
```

Replace the example with the user's existing five answer groups. They are source material for FOUR beats, not five scenes. Do not restart intake or ask duplicate questions when answers exist. The immutable input copy is in the SQLite project checkpoint. Intake corrections reopen the script with explicit human feedback; the writer must use that feedback, preserve facts and report its source answers.

`status` supplies the next task ID, current artifact ID/digest, dependencies, rubric and feedback. `work` supplies contracts for an agent task. Perform that task, write a structured response, then use `respond`. Agent tasks are yours to complete, not questions to send back to the user. Use the host's genuine reviewer worker/capabilities; a different worker ID is required. Do not claim independent review merely by inventing an ID. If the host cannot provide the required review, explain the missing capability and leave review pending/inconclusive. Do not fork into an unrelated topic or use an unconfigured external LLM.

A configured host bridge may export `async runTask(task)` in a module. `node runner.mjs work /absolute/host-worker.mjs --run /absolute/new-run` runs ONE author/review/plan task and validates its response. It cannot approve for the user. No harness autodetection or fallback occurs. This is a trusted local operator protocol, not a multi-user authorization service; user actions must reflect an actual user message.

Authoring event example (replace the content with your authored script; use fresh IDs):

```json
{"taskId":"<current taskId>","action":"artifact","actor":"agent","workerId":"<actual writer worker>","content":{"beats":["<use node runner.mjs schema script>"],"commonSenseChecks":[]}}
```

This illustrative content is not a valid script. JSON Schemas describe the complete artifact shape. Every review binds `artifactId`, `artifactDigest`, `workerId` and `review`. Every required criterion gets one localized evidence finding. Rejections need a specific repair, not a preferred ending. Two successive rejections escalate for user direction. Missing perception is inconclusive. An approved deliverable pauses at the user gate until a human event binds the exact version/digest and original message.

```json
{"taskId":"<current>","action":"approve","actor":"human","artifactId":"script@1","artifactDigest":"<current>","message":"<actual user approval>"}
```

Human approval applies to the current deliverable: for narration, present the four separate audio files together and explicitly confirm all four; for candidates, include `selection: 0`, `1`, or `2`. Never show failed media as a deliverable. Explain defects/repairs; direct reviewers inspect failed files internally. Stop for repeated disagreement, missing capabilities, budget limits or provider failure. `note` records unrelated chat without changing stages. User-requested `changes`/`reject` events require the exact valid artifact and feedback. Run `impact <artifactId>` first and explain affected and still-valid work. Invalidation follows artifact dependencies, and retained historical approvals never authorize a new version.

# Stage sequence and production tools

1. **Script:** Elevate memories into clear, skilled storytelling children understand, with four 15-second narration windows and an emotional purpose per beat. This is narration over memories. No v1 dialogue/lip-sync requirement. Preserve facts and meaning, not weak storytelling. Check important people, age variants, reference availability, settings, props and difficult actions before script lock. Missing source facts require clarification; no invented autobiographical claims.
2. **Voice sample and clone:** After script approval, obtain a genuine storyteller sample and consent. Use `import /absolute/sample.wav --run ...`; put its returned file record in the `voiceSample` human artifact with `consent: true` and language, using the actual user. At least 10 measured seconds; clean, single-speaker speech is required. Cartesia uploads must be WAV/MP3/FLAC/OGG under 16 MB. Convert other formats locally without tempo changes. Submit the current authorized clone request, then review its audition against the actual sample; human approval follows. No stock/Trevor voice. Optional Gemini needs an explicit user request and separately verified adapter; this version stops rather than silently switching.
3. **Narration:** Generate the locked four beat texts separately with the current cloned voice and speed 1. Measure and directly listen. Use `measure narration` for ffprobe duration and ffmpeg silence; a capable review worker must also run STT, compare words with the locked script, measure rate and speaker similarity against the actual sample, and explain calibration and limitations. Both audition and narration approval require these measurements plus direct audio perception. No automatic similarity threshold is claimed. Overlong narration must return to the writer; do not speed audio or trim words. A rejected audio review with `repairTarget: "script"` escalates for a script change instead of wasting another generation. If text must change, obtain human agreement via script `changes`; its dependent audio locks reopen. The current narration deliverable is reviewed/approved as a four-file set; per-beat regeneration and approval events are future refinement.
4. **Roster:** Only after audio lock, establish every important character and age variant. Import actual reference images and include their returned file records per roster entry. The reviewer verifies completeness before human approval.
5. **Characters:** Produce three reference-conditioned Muse candidate designs per roster entry. Agent review then human selection. The host author reads the selected image and character-sheet-recipe.md, writes the full sheet prompt and records both source hashes. Use `node runner.mjs recipe` for the packaged recipe hash. Prompt review then sheet generation MUST send the selected image. Require four full-body turnaround views and eight expressions, consistent identity/anatomy/outfit. Expression names are explicit in the authored prompt; the tutorial's angry-vs-determined choice remains a design question rather than a hidden substitution. Sheet reviewer then human approval; repeat for EVERY roster character. Additional age variants are separate entries. Then stop at the pending background stage.

`import` copies media to immutable hash-addressed assets and measures it. `respond`, generation and approval verify the bytes against recorded hashes. Do not submit filenames or remote URLs in place of imported file records. `validate` checks current file integrity. `inspect` returns the current state; it does not itself perform perceptual review. `render`/`finalize` cannot create or certify a film yet. No second renderer is introduced.

# Exact paid plans, allowances and recovery

At `produce`, submit an agent `plan` containing provider, current operation, estimatedCostUsd and parameters. Prompt text is host-authored. The runtime snapshots the exact provider request, clone ID, locked texts, image hashes, counts and dependencies BEFORE authorization. Cartesia defaults to documented API version 2026-08-14 and snapshot sonic-3.6-2026-08-27. Muse uses muse-image-1.0, /v1/images/edits, reference bytes and $0.01 per image estimates. The `narration` plan represents four TTS subrequests; candidate `n:3` represents three images.

```json
{"taskId":"<current>","action":"plan","actor":"agent","plan":{"provider":"cartesia","operation":"clone","estimatedCostUsd":0.10,"parameters":{}}}
```

Cartesia estimates must be verified by the operator for their account; the above amount is illustrative, not an advertised price. Human `authorize` binds current `jobId`, `artifactDigest` (the job digest) and the actual approval message. An optional human `allowance` grants operations, maxRequests and maxCostUsd (estimated spend) with explicit user wording. Actual provider charges are not a billing cap; verify pricing for the account. Future matching plans automatically reserve from those bounded limits. Never infer an allowance from cheap images or an unrelated "yes". Limits count provider request bundles; the exact plan states subrequest/image counts. There is also a three-request safety ceiling per deliverable dependency set. Repeated failed reviews escalate after two. These conservative checkpoint limits are implementation limits, not a finalized video repair policy. Video generation and its defect-repair allowance remain unimplemented.

```json
{"taskId":"<current>","action":"allowance","actor":"human","message":"<actual scope and limits>","allowance":{"operations":["candidates","sheet"],"maxRequests":6,"maxCostUsd":0.20}}
```

Execute only authorized work:

```sh
node runner.mjs generate --run /absolute/new-run --secrets /absolute/repo-root/secrets.env
node runner.mjs collect --run /absolute/new-run
```

Only the named CARTESIA_API_KEY or META_API_KEY is loaded in memory from secrets.env at generation time. Use the operator's canonical ignored file/symlink; never .env.local, chat keys, copied worktree keys or key output. Preflight does not inspect secret values. API errors stop with diagnostics/remediation; no synthetic/alternate-provider fallback.

The runner checkpoints `submitting` before network traffic. Each synchronous provider subrequest has a started marker and completed receipt. `collect` reconstructs completed receipts without network calls, including after the process died before the final state update. Uncertain outcomes never get resubmitted automatically. `generate` on a started request stops and records uncertainty. A human `reconcile` event can return an uncertain job to collection, or close it as failed ONLY with `result: {"outcome":"confirmed-no-result"}` and evidence from the provider. A partial narration batch with an unknown subrequest currently needs operator reconciliation; no blind replay or automatic completion of missing subrequests. Retain all run files together; imported media paths are absolute in this checkpoint.

No requests are submitted inside LangGraph interrupt nodes, which can replay. SQLite is the authoritative state. Do not edit checkpoint tables, fabricate receipts, or maintain a competing advancing state.json. Writer locks prevent concurrent run mutation. Local adapter tests use explicitly isolated fixtures; their results and fake approvals must never be promoted into production runs.

# Develop evaluators before activating them

Use `evaluation/README.md` and `evaluation/reviewer.md`. Run `npm run eval` for calibration and `npm run eval:holdout` only for the frozen held-out comparison. Group related drafts, derivatives and runs together; do not tune prompts on held-out labels. `eval-tasks` exposes unlabelled inputs for the actual host reviewer, `eval --predictions` scores recorded responses and `eval-export` prepares a local optional LangSmith dataset. No model or LangSmith calls occur in these commands. A passing scope does not approve an artifact.

`work` at a review gate now includes advisory deterministic findings and actual duration/silence evidence where applicable. Follow the full reviewer rubric and resolve missing semantic/listening/identity capabilities honestly; the evidence does not replace the required review event. The seed dataset's video detector and voice/semantic judges are not qualified, so never activate automatic production acceptance from its scores.
