# Blind packaged audit — My Pixar Story v2.0.0

## Audited artifact

- Archive: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`
- SHA-256: `bdac36d04be23628e8a131c154983294050f87fc1d5b768d1b900c35aa2014cd`
- Extraction: `/tmp/my-pixar-story-blind-audit.81ybOK`
- Scope: archive contents and packaged instructions only. No source checkout or primary-repo implementation was inspected.
- Runtime: Node `v26.8.1`; packaged minimum is Node 22.

## Result

PASS for the requested isolated contract proof. I found no blocking packaged defect in the answers lock, reviewed character-design prompt gate, or four natural-rate 15-second narration-window mechanics.

This is a mechanics/contract result only. It does not establish real provider access, model quality, likeness quality, narration naturalness, voice identity, reviewer qualification, or production output quality.

## Packaged operator path reviewed

The package directs a fresh operator to:

1. Read `SKILL.md`, `requirements.json`, `scene-contract.json`, and `quality.json`.
2. Install pinned dependencies with `npm ci`.
3. Run `npm run check` and `npm run smoke`.
4. Use only `runner.mjs` with a fresh absolute run directory and durable SQLite checkpoint.
5. Configure actual host worker bindings before author/reviewer events.
6. Organize the existing five answer groups, independently review them, then obtain exact human confirmation to create ANSWERS LOCK before script authoring.
7. Bind each character prompt to the approved cast entry, ordered source-photo hashes, and packaged recipe hash; require independent review and human prompt approval before exactly three Muse candidates.
8. Generate four narration sources at speed 1, retain those originals, append only digital tail silence to make four exact 15.0-second deliverables, and reject overlong sources without trimming or time stretching.

## Commands and evidence

### Install/check/smoke

- `npm ci`: PASS; 241 packages installed; 0 reported vulnerabilities.
- `npm run check`: PASS. It loaded LangGraph + SQLite, found ffmpeg/ffprobe/tar, did not read credentials, and reported the packaged renderer and key names.
- `npm run smoke`: PASS for both packaged parent and grandparent isolated fixtures. Output explicitly states no model, media-generation, or credential calls.

### Full packaged tests

- `npm test`: PASS — 144/144 tests, 0 failures, about 20.2 seconds.
- The first Remotion synthetic-render test downloaded Remotion's Chrome Headless Shell because it was absent locally. This was tooling bootstrap traffic, not a model/provider call. The independent CLI proof below made no network or provider calls.

Focused passing coverage relevant to this audit includes:

- answers source digest, independent questionnaire review, exact human lock, stale-version refusal, and revision-2 compatibility;
- answer rewinds invalidating dependent work while retaining an independent clone;
- character prompt binding to character digest, ordered reference hashes, packaged recipe hash, reviewer separation, human gate, exact approved prompt, exactly three candidates, and failure escalation;
- author and reviewer requirement to view every scoped character photo;
- four Cartesia calls at speed 1, four retained source files, four exact 15-second windows, silence-only padding, and cached recovery without repeat calls;
- sample-exact audio proof that the original speech PCM is unchanged, padding bytes are digital silence, and a 16-second source is returned untouched;
- SQLite restart, stale-response refusal, zero-budget paid-call refusal, and state preservation.

### Independent black-box CLI proof

Evidence directory: `/tmp/my-pixar-cli-proof-final`

Result file: `/tmp/my-pixar-cli-proof-final/proof-result.json`

The proof used separate `runner.mjs` processes against one fresh SQLite run. It used synthetic worker bindings with the operator-selected `gpt-5.6-sol` label solely to satisfy the packaged binding contract; it did not invoke that model or any provider.

Verified:

- a wrong `sourceInputDigest` was refused with `ANSWER_SOURCE_MISMATCH` and left sequence/task/input unchanged;
- a human approval attempted before independent review was refused and the gate remained `review`;
- a fresh process recovered the exact pending review artifact/digest;
- after synthetic author, independent reviewer, and explicitly synthetic human contract events, the run advanced to `script/author` with `answers@1` approved;
- raw `pending.inputs` and locked `answers.content.inputs` both exactly matched the original input;
- locked source digest was `7e345b846ce2a1738ca57cb764870ec353e71c6b813fe345c0697035b69584e7` after restart;
- network calls: 0; provider calls: 0.

No synthetic event in this proof is production approval, production reviewer evidence, or a human label. Its event messages explicitly say synthetic/local contract proof.

## Defects and operator friction

No blocking defect found.

Minor operator friction observed:

1. The CLI refuses author work with `CREW_NOT_CONFIGURED` until the operator binds the full packaged crew. This is intentional and documented, but it means a minimal answers-only dry run still requires all role bindings.
2. Reviewer events must include the assigned worker's exact `modelVersion` and `capabilityVersion`; omission yields `CREW_MODEL_CHANGED`. The packaged schema exposes these fields and the worker task provides them, but a hand-authored CLI event can miss them.
3. The full test suite may download a roughly 93.5 MB Chrome Headless Shell on first run. A strictly air-gapped first run needs that Remotion browser dependency preprovisioned.

## Limits

- No credentials were opened, read, or supplied.
- No real model, review broker, STT, TTS, image, video, music, or media-generation call was made.
- No real media was generated and no real user approval, reviewer qualification, or human label was asserted.
- Character likeness and prompt quality were not visually judged; only the packaged binding/review/approval protocol and photo-view enforcement were exercised.
- Narration naturalness and speaker identity were not judged; only speed parameters, source retention, exact duration, silence padding, and refusal behavior were exercised with synthetic tones/mocks.
- Final production/provider readiness remains outside this audit and is explicitly described by the package as unproven.

## Final-byte recheck

The rebuilt final archive was verified at the same published path with SHA-256 `d893a37cb4ef7801caab021b791fe25ccc1ee093f1732d69cf30b008bef053fc`. This final hash supersedes the earlier audited hash for release-byte identity.

Using the already-installed pinned dependencies, without a second `npm ci`:

- `npm run check`: PASS; dependencies/tools loaded and `credentialsRead` remained false.
- `npm run smoke`: PASS for both isolated fixtures; no model, media-generation, or credential calls.
- `node --test tests/refined-flow.test.mjs`: PASS — 7/7, 0 failures.
- The focused answer-clarification test now asserts that changing `subject.fullName` is refused with `STORYTELLER_CHANGE_REQUIRES_NEW_PROJECT`. The same test preserves the permitted recipient correction path, immutable raw inputs, and dependent-lock behavior.
- Packaged `pack.mjs` now runs both `tests/supervised-regression.test.mjs` and `tests/refined-flow.test.mjs` before creating an archive.

Final-byte evidence is retained at `/tmp/my-pixar-story-final-recheck/evidence.md`. No real provider/model/media calls were made, and no existing run was changed.
