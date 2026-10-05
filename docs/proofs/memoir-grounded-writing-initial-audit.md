# Blind packaged grounded-writing audit

Kit: `/private/tmp/memoir-grounded-writing-package-proof`. Audit used this extracted kit only. Read AGENTS.md, SKILL.md, contracts, writer/reviewer instructions, text rubric, evaluation instructions and relevant runtime/tests. Existing dependencies were reused following the supplied exact-lockfile comparison; no `npm ci` or clean-install proof was performed. No package files were edited, secrets read, real projects mutated, native workers dispatched, external network/model/provider calls made, or paid media generated. Independent state work used a disposable SQLite file.

## Actual command outcomes

- `npm run check`: exit 0; LangGraph/SQLite and ffmpeg/ffprobe/tar available; compiled official renderer recognized; `credentialsRead:false`.
- `npm run smoke`: exit 0; **2** isolated parent/grandparent workflows passed persistent author/reviewer/human loops and audio-first gates.
- `npm test`: exit 0; **224 tests passed, 0 failed, 0 skipped/cancelled/todo**. A second run retained the complete count after the first tool output was truncated; 27.35 seconds. Log: `/tmp/memoir-grounded-writing-package-tests.log`.
- `node runner.mjs eval --split all --out /tmp/memoir-grounded-writing-package-baseline.json`: exit 0; **22 cases**. Duration 14/14, composition 2/2, review-evidence 2/2 and structure 2/2 scoped matches. Anatomy: **1 missed defect/inconclusive**, voice: **1 inconclusive**. No semantic/voice/anatomy qualification.
- Persona `eval` and `eval-tasks` CLI commands: exit 0; **14 calibration-only, agent-provisional cases**, all semantic findings inconclusive, **0 scored**, empty metrics, no API calls or credential reads.
- Independent inline Node probes: exit 0; 10 quote/source variants plus inert native-packet, semantic binding and historical SQLite restart checks.

## What held

The current author packet carries grounded-v1 policy, exact source facts and quotation schema. An inert capture of `CodexHost.runTask` (no process/worker started) showed revision-4 `proposedCast` required, structured `directQuotes`, and no private reviewer rubric in the author packet. Canonical reviewer tasks carry the independent rubric and advisory evidence; structure and quote wording do not establish facts or production approval.

Exact curly quotations with citations advance to review. Altered words, missing/invalid source fields, undeclared double quotes and duplicate occurrences with only one binding stop with `QUOTATION_BINDING_REQUIRED`, without mutating the input project. Packaged tests cover human-confirmed clarified answers as the quote source.

A separately constructed pre-policy snapshot remained byte-for-byte equivalent by project digest after SQLite close/reopen: policy remained absent, old quoted draft stayed at review, zero jobs and $0 budget. Historical compatibility deliberately preserves the old policy rather than silently applying the new gate. Snapshot tamper/refusal, controlled refresh and saved-lock behavior also pass packaged tests.

Semantic tasks omit top-level label/group/split, attach the actual text rubric, and bind it into the input digest. A prediction using a changed-rubric digest was rejected as stale. Stock persona reports honestly stay unscored/inconclusive.

## Concrete gaps

1. **Semantic scoring accepts nonhuman truth authority.** `evaluation/harness.mjs:17` only prohibits *agent-provisional + confirmed*. Changing the isolated 14-case corpus to `authority:"objective", confirmed:true` passes validation and makes all **14 cases scored** at line 52 despite lacking human semantic labels. Require human-confirmed authority for semantic case kinds before scoring; keep qualification false.
2. **Exported tasks can disclose expected answers.** `taskForCase` retains original IDs such as `thin-tom-invented-fear`, `age-gina-invented-age`, `nonna-wrong-relationship` and `thin-tom-forced-followup`. It also copies arbitrary `input.label` unchanged (independently reproduced). Opaque IDs and a kind-specific input allowlist would make the advertised label-free boundary stronger. Current stock cases have no nested labels; current reports remain unscored.
3. **Quote parsing has boundary weaknesses.** `runtime/evaluators.mjs:25` rejects a verbatim cited multiline `"red\nblue"` quotation. At line 31, `source.includes(q.text)` accepts `"happy"` from source `unhappy`. Define whether line breaks and partial-word excerpts are allowed, then enforce the intended policy and add regression cases.
4. **Exact wording is narrower than grounded direct speech.** Single-quoted invented speech and a sourced quotation assigned to the wrong speaker both advance to review and receive a quotation wording pass. This is explicitly documented as Sage's independent-review responsibility, not a proved runtime attribution check. Without an actual reviewer this audit cannot establish grounded narrative quality or full direct-speech enforcement.

Conclusion: packaged contract/state mechanics pass, with concrete evaluation-boundary and quotation edge cases remaining. This is **not semantic or perceptual qualification**, a live-worker proof, a clean-install proof, or evidence that a generated narrative/film is accurate.
