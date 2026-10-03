# Wiggly memoir studio packaged-instructions audit

Audit date: 2026-10-03. Scope was restricted to independently extracted archive bytes; no source checkout, prior report, credentials, paid provider call, host-model dispatch, production mutation, or AI generation was used.

## Artifacts

- Original archive SHA-256: `6551d9bb7e604e82726bdb27461834623960d72706d5b6f064079a320a6c1537`; extracted to `/tmp/memoir-studio-audit.Gq4j08`.
- Later archive SHA-256: `82601ed533898e64ae88e9d7ef7a1ba8a8e179be8a39a20421de94c4404d8710`; extracted to `/tmp/memoir-studio-audit-later.EWuQsc`.
- Finalized archive SHA-256: `5b336a8578e7f11b5dbe722bd28f11c16bbbede97318710c0563e6f64cbe3658`; extracted fresh to `/tmp/memoir-studio-audit-final.uWfdzi`.
- Release archive SHA-256: `5a7536528f426b5cef89fd997dce41330876289c62f63d64d35adf34f167076e`; extracted fresh to `/tmp/memoir-studio-audit-release.bSoD2H`.
- Neither archive was altered.

## Results

For both artifacts, `npm ci` completed from the lockfile (241 packages, 0 reported vulnerabilities). `npm run check` passed and reported no credential read. `npm run smoke` passed both parent and grandparent isolated fixtures and explicitly reported no model, media-generation, or credential calls.

The original full parallel suite reached 145/160 passes before the host filesystem exhausted its remaining space; all 15 failures were `ENOSPC`/SQLite I/O fallout. A serial retry cleared the provider/audio failures, but the Remotion child stalled after the host again ran short of disk. The one restart case reported failed during pressure passed alone (1/1). Focused instruction/authority suites passed 16/16.

The later full serial suite reached 93 passes before the same host-volume condition caused two SQLite/disk failures and one Remotion `ENOSPC`; nine later files were cancelled when the stalled test process was terminated after roughly three minutes. Focused instruction, crew-authority, and Codex-driver suites then passed 25/25. Therefore the complete 160-test suite could not be truthfully certified on this host, although every observed non-resource failure was reproducibly cleared in isolation or attributable to exhausted storage. The blocker was environmental: the data volume repeatedly had only about 155–514 MiB free while synthetic media and Chrome Headless Shell required more.

### Finalized archive recheck

After task-owned dependency directories were removed to relieve disk pressure, the finalized archive was extracted afresh and checked independently. `npm ci` succeeded (241 packages, zero reported vulnerabilities); `npm run check` passed with `credentialsRead: false`; and `npm run smoke` passed both isolated fixtures with no model, generation, or credential calls. The required serial command, run with the supplied already-installed Chrome Headless Shell through `MEMOIR_BROWSER_EXECUTABLE`, passed **161/161 tests** with zero failures, cancellations, skips, or todos in 77.1 seconds. This resolves the earlier full-suite verification limitation for the finalized bytes while preserving the earlier failures as historical results for the two prior hashes.

### Metadata-only release recheck

The release archive `5a7536…` was compared recursively against the retained, fully tested `5b336a…` extraction. Excluding `proof.json` (and the already removed `node_modules` directory), the trees are byte-identical. The only diff changes `proof.json`: it records the independent 161/161 pass, the predecessor archive hash, the scoped-handoff result, and the simplification review. Runtime, skills, config, README, renderer, package metadata/lockfile, and tests are unchanged. On a fresh release extraction, `npm ci`, `npm run check`, and `npm run smoke` passed; `node --test tests/studio-instructions.test.mjs` passed **8/8**. Repeating the complete suite was unnecessary because all executable and test bytes exactly match the already verified `5b336a…` artifact.

## Instruction/runtime findings

No release-blocking instruction-authority defect was found in the later bytes.

- Named skills are runtime-loaded from `crew/<name>/SKILL.md`; all 14 unique skill folders have matching lowercase frontmatter names. Pia intentionally serves two roles. The config schema fixes every role/name/path pair and only permits tool subsets of hard-coded role ceilings.
- Independent reviewer procedures remain separate in `evaluation/rubrics/{text,audio,visual}.md`. Review task preparation injects the canonical pinned rubric and rejects caller-supplied replacements.
- New projects snapshot config plus exact skill, rubric, recipe, and communication bodies and hashes. Snapshot/body tampering fails schema validation. SQLite restart uses the saved snapshot; editable package changes affect only new projects. Legacy projects do not silently adopt current instructions, and `upgrade-studio` is human-only and pristine-only.
- Task handoffs bind the current task, dependencies, artifact IDs/digests, assigned worker/model/capability, input checklist, scoped assets, and allowed tools. Stale/missing/replaced inputs stop before dispatch. Workers cannot submit human approvals, provider calls, or another role's event.
- Human authority is preserved for crew configuration/profile changes, budgets, exact paid requests, media confirmation, instruction upgrades, and final approval. Direct perception cannot be replaced by declarations, transcripts, IDs, or deterministic checks; missing capability stays inconclusive.
- The later task-packet change removes producer communication from worker packets and replaces a duplicated full skill body in `instruction` with a pointer to the attached pinned skill. Manual `work` exposes communication separately for the producer. Focused tests confirm the worker packet has no communication field.
- The later driver defaults `maxTasks` from the saved project's pinned `crewTasksPerDispatch` rather than a process-global constant. Explicit values remain bounded to 1–32. Tests confirm stopping at human and production gates.
- Recipe hashes are validated against the project-pinned recipe at artifact submission; active task packets carry the pinned recipe. The standalone `recipe`/`background-recipe` commands intentionally display current templates, as documented, and do not override an active project's snapshot.
- Finalized background task packets include the current location entry and approved cast-sheet files only for characters used by that location's scenes. Finalized video-plan, video-prompt, and video packets include the locked narration artifact and its four audio files. Both new fields participate in canonical task digest comparison; missing or substituted values fail with `TASK_INPUT_MISMATCH`, unlocked sheets/narration fail before dispatch, the input checklist records their provenance, and only those scoped files enter the task asset broker. The new isolated regression passed as part of the 161-test suite.

## Compatibility/refusal probes

Isolated tests confirmed refusal of worker impersonation, fake human approval, tool broadening, generation/write/authorization tools, unsupported perception, stale task packets, changed model/tool profiles, silent instruction upgrade, duplicate/uncertain dispatch, and provider work without the workflow authorization gates. Repeated reviewer disagreement escalates rather than generating. No probe contacted a provider or a real host model.

## Complexity assessment

The safety model is intentionally substantial: 15 configured roles, 14 skills, three independent rubrics, snapshot/version machinery, SQLite state, dispatch receipts, and roughly 3,900 lines across runner/runtime/tests/skills/rubrics in the inspected set. This is a high operational surface, but the later packet deduplication and producer-only communication scope remove real duplication without weakening bindings. The remaining complexity mostly corresponds to explicit authority, restart, paid-call, and media-evidence boundaries. The main practical risk is operability: full synthetic media tests require materially more free disk than was available, and the Remotion test can wait on Chrome acquisition after a storage failure. CI should provision headroom and preinstall/cache the pinned browser so resource failures do not obscure behavioral regressions.

## Limitations

No real reviewer independence, perceptual quality, provider readiness/funds, speaker similarity, or end-to-end film quality was established. Mock and synthetic fixtures validate protocol enforcement only. Full-suite completion is verified for the finalized `5b336a…` runtime bytes, and the release `5a7536…` archive is byte-identical outside its metadata-only proof update. The earlier disk failures remain applicable to the two superseded hashes and their original audit runs.
