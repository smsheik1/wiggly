# Legacy Orchestrator Purge Plan (v2, corrected)
**Target:** `my-pixar-story-v1` kit
**Goal:** Cut the Remotion renderer loose from the legacy orchestrator (`workflow.mjs`) and LangGraph without breaking Phase 6 (`memoir-format.ts`, `setup-memoir.ts`, `phase2.ts`, `phase5-live.ts`).

**Ground rule:** Do all of this on top of `codex/studio-phase6-film-integration` (branch off it), NOT on the untracked disk copy on `main`. Phase 6 has the newer `workflow.mjs` (with `validateArtifactContent`) and `director-jev.mjs`; disk has newer `crew/*/SKILL.md` and `evaluation/rubrics/audio.md`. Run tests after every phase and stop on any failure.

## Phase 0: Secure & back up
- [x] `agent-runs/` moved to `~/Documents/wiggly-private-backups/agent-runs-backup` (verify file count + sizes match ~347M before treating as done).
- [ ] Full tarball of the disk kit (excluding node_modules) to the same private folder, plus `sqlite3 .backup` copies of every `checkpoints.sqlite`.
- [ ] Restore `director-jev.mjs` from `git show codex/studio-phase6-film-integration:v3/public/format-repositories/my-pixar-story-v1/runtime/director-jev.mjs` (the git copy is the known-good source; confirm the .tgz copy matches it).
- [ ] Find out what created `chore/nuke-legacy-orchestrator` and touched the kit at 11:57-11:59 PM; make sure nothing else is editing it.

## Phase 1: Reconcile the drift
- [ ] Branch from `codex/studio-phase6-film-integration` (e.g. `chore/purge-legacy-orchestrator`).
- [ ] Bring over the uncommitted renderer edits from `main` (`remotion-entry/{Root,RemotionAdScene,MemoirPreview}.tsx`, `features/formats/memoir-film/`, `features/render/*`, `features/scene/types.ts`, `features/formats/registry.ts`) and diff them against phase 6's versions instead of committing them to `main` separately.
- [ ] Decide per file which kit copy wins: keep phase 6's `workflow.mjs`/`contracts.mjs`/`gates.mjs`/`assemble.mjs`; review and port disk's `crew/*/SKILL.md` and `rubrics/audio.md` edits.
- [ ] Baseline: run `tests/memoir-render.test.tsx`, kit `tests/remotion.test.mjs`, `phase6.test.ts`, `phase6:proof`. Record results.

## Phase 2: Move what the studio needs out of the orchestrator
- [ ] `memoir-format.ts`: replace `workflow.keyFor`, `workflow.assertAllowed`, `workflow.validateArtifactContent` (lines ~70, 79-80, 114) with studio-owned versions (e.g. `v3/lib/memoir-policy.ts`).
- [ ] `memoir-format.ts`: replace `studio.assemblyManifest` (115) and `assemble.renderFilm` (161) with the pure renderer API from Phase 3.
- [ ] Move content the studio reads (`studio.json`, `crew/*/SKILL.md`, `evaluation/rubrics/*.md`, recipe docs) into a studio-owned folder, or explicitly keep them in the kit as data. Don't delete them.
- [ ] `phase2.ts:37`, `phase5-live.ts:78`: stop importing `runtime/providers.mjs` (move the provider calls into the studio).
- [ ] `setup-memoir.ts:11-13`: stop running kit `npm run smoke` (`kit-smoke.mjs` boots LangGraph); replace with a renderer check (`remotion.test.mjs` / `verifyRenderer`).
- [ ] `scripts/my-pixar-story-format.ts` (not memoir-format.ts): decide whether the old Eminem/Steve Jobs pipeline survives. If not, delete it, the `format:pixar` script, and `tests/my-pixar-story-character-gate.test.ts`. If yes, repoint its output away from `kit/agent-runs` (:44-45).
- [ ] Re-run Phase 1 baseline tests.

## Phase 3: Untangle the renderer
- [ ] `runtime/remotion.mjs`: inline `digest` and `verifyFiles`.
- [ ] `runtime/media.mjs`: remove the dynamic imports at :38-39.
- [ ] `runtime/assemble.mjs`: keep `inspectFilm`; replace `renderFilm(p, runDir)` with `render(manifest) -> mp4` (no `debug`/`gates`/`studio` imports).
- [ ] `runtime/studio.mjs`: move the Project-to-manifest mapping (`assemblyManifest`) into the studio (TS side); the kit should only accept a manifest.
- [ ] `runtime/contracts.mjs`: drop the `instructions.mjs` import; keep `VERSION`, `digest`, `Content.film`, `criteria` (or move them to the studio).
- [ ] Re-run tests. `git grep workflow.mjs\|providers.mjs\|crew.mjs\|kit-smoke` on the branch must return nothing outside the kit.

## Phase 4: Delete the unreferenced files
Only these (nothing loads them on any branch):
- `runner.mjs`, `pack.mjs`
- `runtime/{codex-host,gemini-review,cartesia-stt,presentation}.mjs`
- `evaluation/{harness.mjs,dataset.json,baseline-report.json,invented-regression.json,inventory.json,text-personas.json,README.md,local/}`. **Not** all of `evaluation/`: `rubrics/` is read by the studio, and `audio-qualification.mjs`, `visual-qualification.mjs`, `reviewer.md` wait for Phase 5.
- `AGENTS.md`, `SKILL.md`, `README.md`, `PIXAR-PROMPTER.md`, `pipeline.json`, `requirements.json`, `quality.json`, `proof.json`, `format.json`, `scene-contract.json`, `inputs.json`
- `my-pixar-story-v2.0.0.tgz` (identical copy on phase 6)
- `tests/*.test.mjs` except `remotion.test.mjs`. Keep `tests/helpers.mjs` until `kit-smoke.mjs` is gone.
- **Not yet:** `orchestrator-voice.md`, `questionnaire.json` (`crew.mjs` reads them on import, so deleting them breaks `workflow.mjs` while it's still loaded).
- Re-run tests.

## Phase 5: Final severance
Only after Phase 2-3 grep is clean:
- `runtime/{workflow,crew,instructions,legacy-instructions,budget,debug,audio-edit,evaluators,providers,video-provider,director-jev}.mjs`
- `runtime/{studio,gates,shots}.mjs` (once nothing in Phase 3's renderer imports them)
- `kit-smoke.mjs`, `tests/helpers.mjs`, `evaluation/{audio,visual}-qualification.mjs`, `evaluation/reviewer.md`, `orchestrator-voice.md`, `questionnaire.json`
- Kit `package.json`: remove `@langchain/langgraph`, `@langchain/langgraph-checkpoint-sqlite`, `@langchain/core`, `better-sqlite3` (only if nothing else in the kit imports it); `npm install`; rebuild the renderer bundle with `build-renderer.mjs` and check `renderer-manifest.json`.
- Keep: `build/remotion/**`, `build-renderer.mjs`, `examples/*.json`, `runtime/{remotion,media,mix,assemble,contracts}.mjs`, `tests/remotion.test.mjs`, remotion/react/zod deps.
- Final: full test run plus one end-to-end Memoir Film render through the studio.
