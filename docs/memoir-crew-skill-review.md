# Crew skill review — living checklist

Started October 5, 2026. Review one named worker at a time with the user. Leo’s revision is approved and installed; Sage’s agreed review improvements are installed. Ava is next. The live Round 1 rehearsal is deliberately on hold for this discussion; its authoritative SQLite state is unchanged. Its private resume note, exact operator snapshot and consistent database backup live in that run's debug-notes directory. Read RESUME.md there before resuming; never overwrite newer state with the backup.

## How we review each worker

Read the actual skill, related recipes/rubric, runtime task inputs, allowed tools and response contract. Separate job instructions from code-enforced rules. Explain responsibilities simply, identify observed gaps, record human decisions, and implement only agreed changes. Doers repair their work; independent reviewers return evidence and specific repairs. Runtime owns state, gates and spending. Active projects retain their bound instruction versions until an explicit supported refresh; editing a file alone does not silently update a run.

## Queue

| Worker | Responsibilities in current configuration | Review status |
| --- | --- | --- |
| Leo | Questionnaire preparation and script writing | Approved and installed |
| Sage | Independent text review across deliverables | Agreed improvements installed |
| Ava | Independent voice, narration and soundtrack review | Approved and installed |
| Eli | Local narration editing and final composition plan | Approved and installed |
| Cleo | Cast/character design | Approved and installed |
| Pia | Character sheet and Pixar image prompting | Approved and installed |
| Vera | Independent character/background/keyframe/video/final-film visual review | Approved and installed |
| Sam | Shot planning | Approved and installed |
| Beau | Background product ownership and outcome checking | Approved and installed |
| Cam | Character/background scene composition | Approved and installed |
| Mo | Motion direction | Approved and installed |
| Vin | Video prompt engineering | Approved and installed |
| Max | Generation planning | Approved and installed |
| Finn | Sound design; music/effects currently optional | Approved and installed |

Also inspect orchestrator-voice.md, shared text/audio/visual rubrics, Pixar recipes and studio.json where relevant. Voice cloning/TTS and image/video submission currently use runtime adapters/plans; do not invent a dedicated named worker or skill where one is not configured. Review that ownership explicitly when we reach the relevant stage.

## First worker: Leo

Canonical skill: `v3/public/format-repositories/my-pixar-story-v1/crew/leo/SKILL.md`. Bound role: script-writer; configured tool: readAsset. Runtime tasks distinguish answers and script.

Current questionnaire duties: organize supplied answers, preserve their source, flag only essential contradictions/missing facts, ask focused clarifications through the orchestrator, and accept thin storytelling/optional omissions. It cannot write the script before answers lock. Cast and reference-photo decisions belong to later gates.

Current writing duties: improve storytelling for a child, preserve facts/emotional meaning/actual quotes, draft four natural-rate 15-second beats, propose the smallest necessary cast and age looks, and revise only the current draft with evidenced feedback. Nearby ages may share a look; natural expression is permitted. Facts cannot be invented; fear/cost, chronology and concrete-image endings are optional guidance. Sage independently reviews; the human locks the script.

Initial point to discuss: the writing skill says excellent storytelling but provides little practical guidance for turning raw memories into a coherent four-beat emotional story. Judge the loaded inputs/criteria and packaged references before deciding whether to add guidance; do not impose unapproved mandatory plot ingredients.

## Decisions

Leo: adopt the supplied Claude revision with the two agreed corrections: questionnaire subprompts are optional (essential information can still be required); overlong generated narration goes to the Audio Editor for safe repair first, and rewriting a locked script needs runtime-confirmed human direction. Practical story guidance now covers concrete source details, recipient connection, earned direct emotion, optional exact quotations, flexible arc/ending, natural gestures and four natural-rate windows.

The canonical skill/template is updated; existing project instruction snapshots and approvals are not silently migrated. The Round 1 script remains locked and unchanged. Existing task-loading/source/quotation/lock tests protect the protocol; no new paid script generation or semantic writing-quality proof is claimed. Sage’s skill and separate text rubric were still unchanged at this Leo checkpoint; see the later Sage decision below.

Packaged audit found an instruction/schema mismatch: Inputs rejects empty strings and normalizes surrounding whitespace. Leo now preserves the canonical version-bound sourceInputs and leaves omitted optional subprompts omitted, without inserting placeholders. This is wording alignment, not a schema change. The current Inputs contract still requires all five answer sections to contain at least one nonempty field; supporting an entirely absent/empty section is a separate intake-contract gap to review with Sage, not a reason to invent a memory or silently broaden this skill-update phase.

## Initial Leo validation checkpoint

Final archive SHA256 `da34df6fc7f2e0b955d42a8b567e551521ad0f856aa66eef336df787420448f9`. Official package checks pass (123 cases); final freshly extracted check/smoke and 19 scoped tests pass. Earlier independent package audit passed protocol checks and found the input-wording caveats corrected above; the independent final recheck could not complete due to account usage limit, so final-byte verification is explicitly a maintainer check. See [audit evidence](proofs/memoir-leo-skill-package-audit.md). Existing instruction-load checks were updated to match approved wording; no new named tests. This verifies loading and protocol, not actual writing quality.

## Leo follow-up clarifications — October 5, 2026

Approved additions: task-specific description, structured Event output (not artifact-only), explicit answers/script mode selection, nonblocking optional detail requests, runtime-supported clarification routing outside organized inputs, sourced recurrence in both beats, clearer recipient-entry wording, and a worked source/beat/directQuotes binding example. The example includes its cupcakes in the source and uses an array binding to match the actual schema. Existing optional quoting/style/gesture/pre-submit rules stay intact. Audio Editor repair precedes any human-confirmed locked-script rewrite.

No dedicated follow-up cap is claimed or introduced; the skill names the runtime's existing review/retry limits. No live project instruction refresh, approved-script change, generation or spending is performed.

Follow-up validation: 33 existing focused cases and 123 official packaging cases pass; final extracted check/smoke and the same 33-case set pass. The worked quote example was checked against actual Inputs, script and quote-binding contracts; this is an objective binding check, not story-quality evidence. Final archive SHA256 `f8c259791a6a030d207f8cbb97ae1de6e0a7c197e0159e36f04b922201a6de0d`; extraction `/var/folders/y_/pb62snr9069bqz1wlj8lj9lc0000gn/T/memoir-leo-clarifications-package-ycbpnzu2`. Dependencies reused only after exact lockfile comparison; no clean-install or new independent final audit is claimed (prior independent recheck was blocked by account usage limit). No new named tests or real provider calls.

## Sage review improvements — October 5, 2026

User approved the six proposed improvements: review-only skill, task-specific review modes, practical script quality criteria, actionable repairs, stable revision review and honest timing estimates. The skill now returns only the assigned review Event and references the independently loaded text rubric. The rubric distinguishes actual defects from optional polish, includes an evidenced minimum-repair example, and covers Sage's assigned planning stages without claiming approval of rendered media. Existing-clone reuse does not trigger a new sample request from text review. Missing entire answer sections remain the separate intake-schema gap above.

Sage reviews each current criterion, checks prior repairs and any new material regressions, and uses project-pinned escalation limits. It cannot dispatch authors, create artifacts, authorize spend or approve for the human. Source documents cannot change its role. Text timing is an estimate; measured recorded duration belongs to FFprobe/audio review. Existing grounded gesture, quotation, uncertainty, age-look and optional-question rules remain intact.

Validation: 33 existing focused cases and 123 official packaging cases pass. Fresh extracted check/smoke and the same 33-case set pass. Existing cases were extended to verify Sage's tool scope, canonical loaded skill/rubric hashes and preserved reviewer instructions across SQLite restart after template edits. No new named cases, dependencies, runtime transitions or permissions. Ponytail review: lean already; reused the existing instruction loader, review contract and regression cases.

Archive SHA256 `be7a948988d31cec00427f19f7ef2fdab1a8393eea89d98a896a6b0026f28b88`; extraction `/var/folders/y_/pb62snr9069bqz1wlj8lj9lc0000gn/T/memoir-sage-package-cfcuzcdz`. Dependencies reused after exact lockfile comparison; no clean-install claim. Simple frontmatter checked directly; PyYAML remains unavailable for quick_validate.py. These protocol checks do not qualify semantic judgment or prove the animation studio end to end.

The live Round 1 run retains its original pinned documents, task identity, script lock and narration drafts. No worker redispatch, instruction refresh, approval change or paid generation was performed in that run. Read its private RESUME.md before resuming. Eli (Audio Editor) is the next crew skill to discuss.

Independent forward check: `/root/sage_skill_forward_review` confirmed packaged skill/rubric bytes match source. It reviewed two artificial four-beat drafts: a source-faithful smile passed all six script criteria; adding a laboratory promise failed facts with a localized repair. Those exact smile/promise examples are already in the rubric, so this verifies instruction following rather than held-out calibration. No real rehearsal artifacts were sent or changed.

## Ava review improvements — October 5, 2026

User approved the complete overhaul of Ava according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Perception-first mandate: mandatory execution of `listenAudio` (100% full-file listening), `measureAudio`, `transcribe` (Cartesia ASR), and `speakerSimilarity`. Inferred listening from captions or text is strictly prohibited.
- 6 canonical audio criteria definitions: `integrity`, `transcript`, `natural-rate`, `voice-match`, `mix`, `safety`.
- Explicit splice inspection on edited stems from Eli: never approve solely because a stem meets 15.0s; directly inspect splice boundaries for micro-clicks, phase pops, or severed consonant endings.
- Operational mode clarity: Supervised v1 mode treats reviews as provisional advisory evidence for the human operator; existing account clones without raw samples mark `voice-match` as inconclusive for explicit human ear recognition.
- 2-strike escalation protocol: consecutive failed repairs on the same defect escalate to the human operator rather than looping indefinitely.
- Overrun routing: overlong narration is routed to Eli (Audio Editor) for pause trimming rather than discarding the locked script.
- Complete concrete input task packet and structured output review Event examples with full measurement block.

Validation: 23 focused audio/supervised regression tests pass (`tests/existing-voice-no-sample.test.mjs`, `tests/supervised-v1.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. No existing project runs or provider calls were altered.

## Eli review improvements — October 5, 2026

User approved the complete overhaul of Eli according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Separation of operational modes: Mode A (`narration` repair as Audio Editor) and Mode B (`editPlan` timeline authoring as Film Assembler).
- Actionable mathematical contract: `keepRanges: [{ startSeconds, endSeconds }]` specifies ordered intervals to KEEP, with omitted ranges as cuts.
- Zero speed-up guardrail: hard prohibition against `atempo`, pitch shifting, or destructive filters. Speech remains 100% natural rate.
- Mandatory join scrutiny: self-listening on the rendered join required before submission to catch severed consonants, clicks, or phase pops.
- Preserves untouched sibling stems: only replaces the affected beat file; retains exact bytes of unaffected beats.
- Safe escalation protocol: returns `planning-blocked` with `kind: "editing-infeasible"` when pause trimming cannot fit speech without cutting spoken words.
- Concrete worked examples: JSON input task packet, tool invocation with `pause-shortening`, and structured output artifact Event.

Validation: 4 focused audio-edit regression tests pass (`tests/audio-edit.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Cleo (Cast/Character Designer) was reviewed next.

## Cleo review improvements — October 5, 2026

User approved the complete overhaul of Cleo according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Separation of operational modes: Mode A (`roster` compilation) and Mode B (`characterPrompt` authoring for the 3 candidate designs).
- Mode A strictly binds to `approvedScript.content.proposedCast`, verified photo references (`viewImage`), and explicit minor guardian authority. Output matches exact `Content.roster` schema `{ characters: [...] }`.
- Mode B authors the single full-body front-facing reference stance prompt for the Muse candidate designs. Explicitly forbids premature turnarounds or facial expression grids (which belong strictly to Pia).
- Mandatory digest and hash integrity: binds `characterDigest`, `recipeSha256`, and sorted `referenceHashes`. Output matches exact `Content.characterPrompt` schema `{ prompt, characterDigest, referenceHashes, recipeSha256 }`.
- Worked JSON examples included for both input task packets and structured output artifact Events.

Validation: 11 focused supervised tests pass (`tests/supervised-v1.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Pia (Character Sheet & Pixar Image Prompter) was reviewed next.

## Pia review improvements — October 5, 2026

User approved the complete overhaul of Pia according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Separation of operational modes: Mode A (`sheetPrompt` as Sheet Prompter) and Mode B (`backgroundPrompt` / `backgroundAnglePrompt` as Pixar Background Prompter).
- Mode A strictly binds to the selected character design candidate image (viewed directly via `viewImage`), preserving facial likeness, proportions, and wardrobe. Prompts a standardized layout of exactly 4 full-body turnaround views (`front`, `three-quarter`, `profile`, `back`) and 8 distinct expression portraits. Binds `recipeSha256` and `referenceSha256`.
- Mode B strictly enforces empty-of-people environment plates (zero characters, silhouettes, or crowds) staged for scripted spatial action and camera clearance. Angle prompts directly inspect master plates via `viewImage` to lock architecture and lighting. Binds `recipeSha256` and `briefDigest`, providing a clear `changeSummary`.
- Concrete worked examples provided for both input task packets and structured output artifact Events across both modes.

Validation: 20 focused tests pass (`tests/mini-core-flow.test.mjs`, `tests/supervised-v1.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Vera (Independent Visual Reviewer) was reviewed next.

## Vera review improvements — October 5, 2026

User approved the complete overhaul of Vera according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Direct perception-first mandate: mandatory execution of `viewImage` (for stills: candidate designs, sheets, background plates, keyframes) and `watchVideo` (for video clips and final film). Unavailable perception strictly forbidden from approval.
- Complete canonical criteria coverage: strictly enforces exactly one evidenced finding per required criterion across all 7 visual review stages (`candidates`, `sheet`, `backgroundCandidates`, `backgroundAngle`, `keyframe`, `video`, `film`).
- Anatomical rigor: strictly 2 arms, 2 hands, 5 fingers per hand. Zero tolerance for phantom limbs, fused fingers, or melted facial features.
- Empty environment enforcement: strictly zero humans, silhouettes, or background crowds permitted in master or angle background plates.
- Actionable defect localization: every failure requires specific spatial region or timestamp location, factual descriptive evidence, and concrete repair instructions for authors.
- Full video coverage binding: video and film reviews bind `coverage: { artifactSha256, videoSeconds }`, `modelVersion`, and `capabilityVersion`.
- Concrete worked examples provided for both still image pass and video rejection events.

Validation: 30 focused visual/qualification tests pass (`tests/gemini-review.test.mjs`, `tests/review-grounding.test.mjs`, `tests/visual-qualification.test.mjs`, `tests/keyframes.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Sam (Shot Planner) was reviewed next.

## Sam review improvements — October 5, 2026

User approved the complete overhaul of Sam according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Separation of operational phases: Phase 1 (`shotIntentions` as upfront spatial architecture) and Phase 2 (`shots` as post-background staging lock).
- Exact timeline mathematics: strictly 4 beats, each totaling exactly 15.0 seconds (`durationSeconds`), starting at 0 per beat, contiguous with zero gaps or overlaps.
- Comprehensive scene and cast coverage: every scene in `locations` mapped to at least one shot; cast IDs bound to roster; valid angle IDs bound to local scene angles.
- Supervised staging invariance: in Phase 2 (`shots`), core shot properties (`id`, `sceneId`, `locationId`, `angleId`, `beat`, `startSeconds`, `durationSeconds`, `characterIds`, `camera`, `action`) are strictly immutable from approved `shotIntentions`; only `staging` and `continuityNotes` are refined to ground physical placement in the rendered plates.
- Concrete worked examples provided for both `shotIntentions` and `shots` artifact Events.

Validation: 11 focused keyframe/shot tests pass (`tests/keyframes.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Beau (Background Product Owner) was reviewed next.

## Beau review improvements — October 5, 2026

User approved the complete overhaul of Beau according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Separation of operational responsibilities: Mode A (`backgrounds` registry compilation), Mode B (`backgroundBrief` master brief authoring), Mode C (`backgroundAngleBrief` angle brief authoring), and Mode D (`owner-review` product owner check on Pia's prompt).
- Plain human language mandate: creative briefs describe physical spaces, lighting atmosphere, emotional tone, and action clearance without technical prompt flags.
- Strict empty environment enforcement: all background plates are mandated to be completely empty of people, characters, and silhouettes.
- Master-plate invariance: angle briefs lock the architectural landmarks, window/door placements, and materials of the master plate, describing only camera re-framing.
- Authoritative owner check: conducts first-pass review of Pia's prompts across `['brief-fit', 'style', 'spatial-action', 'continuity']` before independent review by Sage.
- Concrete worked examples provided for `backgroundBrief`, `backgroundAngleBrief`, and `owner-review`.

Validation: 11 focused background tests pass (`tests/backgrounds.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Cam (Character/Background Scene Composition) was reviewed next.

## Cam review improvements — October 5, 2026

User approved the complete overhaul of Cam according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Perception-first mandate: mandatory execution of `viewImage` on both setting plates and character sheets before writing composition prompts.
- Strict reference sequence and binding integrity: `references` array must strictly follow `task.referenceBindings` (setting first, followed by character sheets in exact shot cast order). Strictly binds `shotDigest`.
- Single 16:9 widescreen composition: explicitly forbids collages, grids, or split panels.
- Functional reference division: setting plate governs architecture, lighting, and materials; character sheets govern likeness, age, skin tone, hair, and wardrobe.
- Anatomical and physical anchoring: explicitly states hand placement, limb counts, and physical contacts to proactively prevent generative multi-limb defects.
- Rejection feedback handling: routes Vera's defect evidence directly into strengthened physical and negative prompt constraints.
- Concrete worked examples provided for input task packet, tool calls, and structured output artifact Event.

Validation: 11 focused keyframe tests pass (`tests/keyframes.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Mo (Motion Director) was reviewed next.

## Mo review improvements — October 5, 2026

User approved the complete overhaul of Mo according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Direct perception-first mandate: mandatory execution of `viewImage` on approved shot keyframes before authoring clip motion.
- Strict resolution profile enforcement: locks `"480p"` for `seedance-mini-480p` and `"1080p"` for `legacy-seedance-hd` without silent alterations.
- Exact timeline mathematics and 30fps alignment: clips partition each approved shot duration with zero gaps or overlaps; `durationSeconds * 30` must be an integer; `generationSeconds` bounded between 4 and 15 seconds.
- Diffusion motion engineering principles: one clear camera move per clip; subtle, believable micro-acting (blinking, breathing, gentle head tilt) rather than rapid gestural thrashing; mandatory physical anchors (`anchors`) to ground limbs and prevent generative morphing defects; atmospheric secondary motion (`atmosphere`).
- Concrete worked examples provided for input task packet, keyframe inspection, and full 4-beat `videoPlan` output artifact Event.

Validation: 9 focused video/workflow tests pass (`tests/mini-core-flow.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Vin (Video Prompt Engineer) was reviewed next.

## Vin review improvements — October 5, 2026

User approved the complete overhaul of Vin according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Perception-first mandate: mandatory execution of `viewImage` on the approved first-frame keyframe before authoring clip video prompts.
- Strict keyframe and clip digest integrity: returned `videoPrompt` binds `clipDigest`, `keyframeId`, and `keyframeSha256` matching `task.videoBinding`.
- 4000-character ceiling: strictly enforces prompt length <= 4000 characters.
- Structured diffusion prompting: formatted cleanly into `Camera:`, `Action:`, `Physical anchors:`, and `Atmosphere:` sections optimized for ByteDance Seedance 2.0 / Mini.
- Guarded `repairOnly`: `repairOnly: false` by default; set to `true` strictly when responding to evidenced defect feedback from Vera.
- Concrete worked examples provided for both initial clip authoring and defect repair prompts.

Validation: 9 focused video tests pass (`tests/mini-core-flow.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Max (Generation Planner) was reviewed next.

## Max review improvements — October 5, 2026

User approved the complete overhaul of Max according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Strict non-blocker boundaries: explicitly establishes that a zero project budget, unknown account credits, or untested external API access do NOT block planning. Max prepares the plan with conservative pricing so the orchestrator and human can authorize it.
- Comprehensive provider matrix: maps exact operations and parameters across Cartesia voice (`clone`, `audition`, `narration`), Meta Muse images (`candidates`, `sheet`, `backgroundCandidates`, `backgroundAngle`, `keyframe`), Replicate video (`video`), and ElevenLabs audio (`music`, `effect`).
- Character-for-character prompt invariance: guarantees that `parameters.prompt` in generation plans matches approved prompt artifacts verbatim.
- Guarded `planning-blocked` protocol: used strictly when essential inputs or official pricing are unavailable, binding canonical `planningGuide` for account readiness and providing 1-5 concrete steps for missing inputs.
- Concrete worked examples provided for narration, keyframe, video plans, and planning-blocked diagnostic events.

Validation: 8 focused provider tests pass (`tests/providers.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. Finn (Sound Designer) was reviewed next.

## Finn review improvements — October 5, 2026

User approved the complete overhaul of Finn according to Anthropic Agent Skills standards:
- Clear progressive disclosure frontmatter description (<= 200 chars).
- Narration clarity sovereignty: narration voice is protected as the primary emotional medium; music and Foley cannot clash or overpower speech.
- Explicit omission documentation: in Mini production, omitting music (`music: null`) requires an explicit story-justified `noMusicReason`, and omitting effects (`effects: []`) requires a non-empty `noEffectsReason`.
- Piano score specifications: exactly 60.0s (`durationSeconds: 60`), tender/restrained acoustic solo piano, strictly instrumental with zero vocals.
- Story-serving Foley constraints: unique IDs, duration bounded between 0.5s and 30.0s, gain between -60 dB and 0 dB, total timing <= 60.0s.
- Perception-first media delivery: executes `listenAudio` and `measureAudio` on rendered `music` and `effect` assets prior to submission.
- Provenance integrity: enforces exact alignment between `mode: "generate" | "import"` and `provenance.source: "generated" | "imported"`.
- Concrete worked examples provided for narration-only sound plan, scored plan with Foley, and music media deliverable artifact Event.

Validation: 9 focused audio/workflow tests pass (`tests/mini-core-flow.test.mjs`), smoke check passes (`FREE SMOKE PASS`), and `runner.mjs check` passes. All 14 crew workers are now fully reviewed, overhauled to Anthropic Agent Skills specifications, and verified.

## Comprehensive 6-Dimension Perfection Audit & Goal Loop Sign-Off — October 5, 2026

The `/goal` perfection loop executed a rigorous deep-dive audit across all 14 crew worker `SKILL.md` files and companion rubrics/recipes against the 6-dimension quality rubric:

1. **Anthropic Agent Skills Standard (`agentskills.io`)**:
   - Every worker frontmatter strictly adheres to required limits: `name` <= 64 chars, `description` <= 200 chars explicitly defining trigger conditions and scope.
   - Clean Level 1 (frontmatter progressive disclosure) to Level 2 (rich structured markdown body) architecture across all skills.
2. **Contract & Schema Fidelity**:
   - Exact alignment with `runtime/contracts.mjs` and `runtime/workflow.mjs`. Every input task schema and output event contract (`artifact`, `review`, `plan`, `owner-review`) validated with concrete JSON examples. Zero phantom fields.
3. **Perception-First Mandate**:
   - Zero guessing enforced: `listenAudio`, `measureAudio`, `transcribe`, and `speakerSimilarity` for Ava/Eli; `viewImage` for Cleo, Pia, Beau, Cam, Vin, and Vera; `watchVideo` (4 FPS sampling) for Vera. Unavailable perception is strictly marked inconclusive/failing.
4. **Domain & Cinematic Craft**:
   - Pixar 3D RenderMan styling, peach-undertone subsurface scattering, tactile fabrics, empty-environment room geometry, 60s 4-beat timing math, 30fps diffusion motion stability with physical anchors, solo acoustic piano, and child-clear grounded storytelling.
5. **Defect Diagnosis & Bounded Loops**:
   - Every rejection mandates exact spatial region / timestamp `location`, factual `evidence`, and concrete author `repair`. Overrun routing to Audio Editor precedes script changes; 2-strike escalation prevents infinite loops.
6. **Full Automated Verification**:
   - Baseline regression regexes preserved for all workers (including Leo's quotation/gesture rules and Max's planning blocker guardrails).
   - `node runner.mjs check`: PASS (14 instruction files + 3 rubrics + 4 recipes, SHA-256 verified).
   - `node kit-smoke.mjs`: FREE SMOKE PASS.
   - Full test suite (`node --test tests/*.test.mjs`): **237 of 237 tests pass (100% passing, 0 failures, 0 skips)** across all 18 test files.


