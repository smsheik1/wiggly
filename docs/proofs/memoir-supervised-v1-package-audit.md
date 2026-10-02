# Blind package audit — My Pixar Story v2.0.0

Audit date: 2026-10-02

Final archive: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`

SHA-256: `87f7b5d788ace274cbd11ab852fb4c46e38c2b40c5cf599d55d6ba61f27156e5`

Final-byte bounded recheck: PASS. After the original full 137-test audit, the refreshed archive was re-extracted and its unchanged dependencies reinstalled. `check`, both smoke fixtures, and `tests/readiness.test.mjs` (3/3) passed. No live calls or production runs occurred.

## Verdict

PASS for the requested mechanics/package scope. A fresh operator can install and exercise the shipped human-supervised v1 runtime without the source checkout or extra workflow instructions. The package consistently stops at crew, human, perception, budget, credential, and finalization boundaries instead of fabricating evidence or silently falling back.

This is not production-film proof. No real human approval/label was fabricated, no credentials were read, no paid/provider inference or media-generation call was made, and no production run was touched.

## Final-archive evidence

- Clean `npm ci`: PASS, 241 packages installed, 0 vulnerabilities.
- `npm run check`: PASS. Node, FFmpeg, ffprobe, tar, LangGraph/SQLite and the packaged renderer loaded; credentials were not read.
- `npm run smoke`: PASS for parent and grandparent isolated fixtures; output explicitly reports no model, generation or credential calls.
- `npm test`: PASS, 137/137. This included a two-second synthetic render through the packaged Remotion renderer, SQLite restart coverage, provider request recovery/idempotency, zero-budget enforcement, human-confirmation gates and final audiovisual gates.
- `npm run regression`: PASS, 10/10 invented protocol-only cases. Identity swaps, stale/wrong references, unavailable perception and visible defects route to block/repair/escalation.
- `npm run eval`: PASS as an evaluator run, while correctly remaining unqualified. The known anatomy case stays inconclusive/missed and `productionApproval` is false.
- The refreshed abandonment regression passes: reconciliation preserves the original provider result and stores the reconciliation outcome separately.

## Independent CLI probes

All probes used the explicitly temporary `final-synthetic-gate-audit` project.

- Reinitializing an existing run: rejected (`Run already exists`).
- Premature fabricated human approval: rejected because it was not the exact current agent-passing artifact.
- Unconfigured synthetic worker artifact: rejected with `CREW_NOT_CONFIGURED`.
- Presenting before an agent-passing human gate: rejected with `DELIVERY_BLOCKED`.
- Finalizing before crew/artifacts/reviews: rejected with `CREW_NOT_CONFIGURED`.
- Missing ElevenLabs secrets file: stopped before network, named `ELEVENLABS_API_KEY`, and printed exact provider/billing/key repair steps; no fallback or retry.
- Validation of the untouched initialized run: passed at script/sequence 0.
- The initial budget is visibly `$0`; the full tests independently prove paid generation and inference remain blocked across SQLite restart.

## Package consistency findings

The two findings from the first final-byte audit are resolved in the refreshed archive. `proof.json` records the completed package verification, and `check` now classifies `REPLICATE_API_TOKEN` as required at the video stage, `GEMINI_API_KEY` as conditional for shipped Codex media review, and ElevenLabs as optional when importing licensed music/effects.

`npm ci` reports npm's install-script review warning for `better-sqlite3` and `esbuild`; both loaded and the renderer/SQLite tests passed on this audited macOS/Node 26 environment.

## Scope and remaining limitations

- Supported evidence is macOS local operation with Node 26.8.1, npm 11.19.0 and FFmpeg/ffprobe 9.0.1. The package declares Node >=22; other Node versions, operating systems and hosts were not independently tested.
- The audit proves workflow mechanics and package portability only. It does not prove voice likeness, anatomy/identity review quality, reviewer qualification, provider entitlement/funds, production media quality, or a real end-to-end 60-second film.
- The shipped Codex crew path was not launched because that would consume model-backed worker turns and the task prohibited provider/paid calls. The package exposes the template, requires actual worker/model/capability bindings, and rejects submissions before configuration.
- Browser playback was exercised indirectly by the packaged synthetic Remotion render test. No production film was created or watched.

Detailed command logs and probe outputs are retained under `evidence/`. The temporary installed `node_modules` was removed after the audit to conserve disk; package files, synthetic SQLite runs, logs and this report remain.
