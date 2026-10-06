# Crew skill review — living checklist

Started October 5, 2026. Review one named worker at a time with the user. Leo’s revision is approved and installed; Sage is next. The live Round 1 rehearsal is deliberately on hold for this discussion; its authoritative SQLite state is unchanged. Its private resume note, exact operator snapshot and consistent database backup live in that run's debug-notes directory. Read RESUME.md there before resuming; never overwrite newer state with the backup.

## How we review each worker

Read the actual skill, related recipes/rubric, runtime task inputs, allowed tools and response contract. Separate job instructions from code-enforced rules. Explain responsibilities simply, identify observed gaps, record human decisions, and implement only agreed changes. Doers repair their work; independent reviewers return evidence and specific repairs. Runtime owns state, gates and spending. Active projects retain their bound instruction versions until an explicit supported refresh; editing a file alone does not silently update a run.

## Queue

| Worker | Responsibilities in current configuration | Review status |
| --- | --- | --- |
| Leo | Questionnaire preparation and script writing | Approved and installed |
| Sage | Independent text review across deliverables | Next — in discussion |
| Ava | Independent voice, narration and soundtrack review | Pending |
| Eli | Local narration editing and final composition plan | Pending |
| Cleo | Cast/character design | Pending |
| Pia | Character sheet and Pixar image prompting | Pending |
| Vera | Independent character/background/keyframe/video/final-film visual review | Pending |
| Sam | Shot planning | Pending |
| Beau | Background product ownership and outcome checking | Pending |
| Cam | Character/background scene composition | Pending |
| Mo | Motion direction | Pending |
| Vin | Video prompt engineering | Pending |
| Max | Generation planning | Pending |
| Finn | Sound design; music/effects currently optional | Pending |

Also inspect orchestrator-voice.md, shared text/audio/visual rubrics, Pixar recipes and studio.json where relevant. Voice cloning/TTS and image/video submission currently use runtime adapters/plans; do not invent a dedicated named worker or skill where one is not configured. Review that ownership explicitly when we reach the relevant stage.

## First worker: Leo

Canonical skill: `v3/public/format-repositories/my-pixar-story-v1/crew/leo/SKILL.md`. Bound role: script-writer; configured tool: readAsset. Runtime tasks distinguish answers and script.

Current questionnaire duties: organize supplied answers, preserve their source, flag only essential contradictions/missing facts, ask focused clarifications through the orchestrator, and accept thin storytelling/optional omissions. It cannot write the script before answers lock. Cast and reference-photo decisions belong to later gates.

Current writing duties: improve storytelling for a child, preserve facts/emotional meaning/actual quotes, draft four natural-rate 15-second beats, propose the smallest necessary cast and age looks, and revise only the current draft with evidenced feedback. Nearby ages may share a look; natural expression is permitted. Facts cannot be invented; fear/cost, chronology and concrete-image endings are optional guidance. Sage independently reviews; the human locks the script.

Initial point to discuss: the writing skill says excellent storytelling but provides little practical guidance for turning raw memories into a coherent four-beat emotional story. Judge the loaded inputs/criteria and packaged references before deciding whether to add guidance; do not impose unapproved mandatory plot ingredients.

## Decisions

Leo: adopt the supplied Claude revision with the two agreed corrections: questionnaire subprompts are optional (essential information can still be required); overlong generated narration goes to the Audio Editor for safe repair first, and rewriting a locked script needs runtime-confirmed human direction. Practical story guidance now covers concrete source details, recipient connection, earned direct emotion, optional exact quotations, flexible arc/ending, natural gestures and four natural-rate windows.

The canonical skill/template is updated; existing project instruction snapshots and approvals are not silently migrated. The Round 1 script remains locked and unchanged. Existing task-loading/source/quotation/lock tests protect the protocol; no new paid script generation or semantic writing-quality proof is claimed. Sage’s skill and separate text rubric have not been changed yet.

Packaged audit found an instruction/schema mismatch: Inputs rejects empty strings and normalizes surrounding whitespace. Leo now preserves the canonical version-bound sourceInputs and leaves omitted optional subprompts omitted, without inserting placeholders. This is wording alignment, not a schema change. The current Inputs contract still requires all five answer sections to contain at least one nonempty field; supporting an entirely absent/empty section is a separate intake-contract gap to review with Sage, not a reason to invent a memory or silently broaden this skill-update phase.

## Initial Leo validation checkpoint

Final archive SHA256 `da34df6fc7f2e0b955d42a8b567e551521ad0f856aa66eef336df787420448f9`. Official package checks pass (123 cases); final freshly extracted check/smoke and 19 scoped tests pass. Earlier independent package audit passed protocol checks and found the input-wording caveats corrected above; the independent final recheck could not complete due to account usage limit, so final-byte verification is explicitly a maintainer check. See [audit evidence](proofs/memoir-leo-skill-package-audit.md). Existing instruction-load checks were updated to match approved wording; no new named tests. This verifies loading and protocol, not actual writing quality.

## Leo follow-up clarifications — October 5, 2026

Approved additions: task-specific description, structured Event output (not artifact-only), explicit answers/script mode selection, nonblocking optional detail requests, runtime-supported clarification routing outside organized inputs, sourced recurrence in both beats, clearer recipient-entry wording, and a worked source/beat/directQuotes binding example. The example includes its cupcakes in the source and uses an array binding to match the actual schema. Existing optional quoting/style/gesture/pre-submit rules stay intact. Audio Editor repair precedes any human-confirmed locked-script rewrite.

No dedicated follow-up cap is claimed or introduced; the skill names the runtime's existing review/retry limits. No live project instruction refresh, approved-script change, generation or spending is performed.

Follow-up validation: 33 existing focused cases and 123 official packaging cases pass; final extracted check/smoke and the same 33-case set pass. The worked quote example was checked against actual Inputs, script and quote-binding contracts; this is an objective binding check, not story-quality evidence. Final archive SHA256 `f8c259791a6a030d207f8cbb97ae1de6e0a7c197e0159e36f04b922201a6de0d`; extraction `/var/folders/y_/pb62snr9069bqz1wlj8lj9lc0000gn/T/memoir-leo-clarifications-package-ycbpnzu2`. Dependencies reused only after exact lockfile comparison; no clean-install or new independent final audit is claimed (prior independent recheck was blocked by account usage limit). No new named tests or real provider calls.
