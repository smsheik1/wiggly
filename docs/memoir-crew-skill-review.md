# Crew skill review — living checklist

Started October 5, 2026. Review one named worker at a time with the user. No skill edits are agreed yet. The live Round 1 rehearsal is deliberately on hold for this discussion; its authoritative SQLite state is unchanged. Its private resume note, exact operator snapshot and consistent database backup live in that run's debug-notes directory. Read RESUME.md there before resuming; never overwrite newer state with the backup.

## How we review each worker

Read the actual skill, related recipes/rubric, runtime task inputs, allowed tools and response contract. Separate job instructions from code-enforced rules. Explain responsibilities simply, identify observed gaps, record human decisions, and implement only agreed changes. Doers repair their work; independent reviewers return evidence and specific repairs. Runtime owns state, gates and spending. Active projects retain their bound instruction versions until an explicit supported refresh; editing a file alone does not silently update a run.

## Queue

| Worker | Responsibilities in current configuration | Review status |
| --- | --- | --- |
| Leo | Questionnaire preparation and script writing | In discussion — first |
| Sage | Independent text review across deliverables | Pending |
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

None yet. Saving progress and opening the skill for review do not change worker instructions, permissions, project state, approvals or spending.
