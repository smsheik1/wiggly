# Evaluator development dataset — data first

This starter collection was inventoried and labelled before implementing the offline graders. It contains 22 scope-specific cases: 20 drawn from two saved legacy runs and two actually host-authored scripts from an explicitly isolated operating proof. The inventory records 145 original assets with SHA-256 provenance. No original run, checkpoint, approval, audio or video was modified, and no provider calls were made.

**A passing duration label is not a good-audio label.** These are narrowly scoped expected findings. Ten original narration stems and four fitted stems have objective timing labels; two fitted Steve stems exceed the new 15-second maximum. Two five-scene/100-second legacy manifests are incompatible with the explicitly requested v2 four-beat/60-second target. That comparison does not retroactively fail their old contracts. Two legacy approval records lack the evidence required by the new review contract. Old `approved` strings are not accepted as truth about media quality.

The driving video has one directly inspected anatomical defect at 5 seconds: upper-wheel hand, microphone hand and lower-wheel hand on the single driver. This confirms that instant, not complete motion or audio review. The original source video is identified by immutable hash; it is not packaged or presented as a finished deliverable. Voice likeness remains inconclusive without a genuine reference sample and measured comparison. The two Grandma drafts have structural labels only; previous independent host reviews are not relabelled as human calibration gold.

All Eminem-family data and both versions of the Grandma story are in calibration. All Steve-family cases are held out. Related drafts, stems, fitted derivatives and run approvals stay together. Asset hashes are also checked for cross-split duplicates. This tiny held-out set tests objective rules; it does not qualify a general script judge, voice judge or anatomy detector. It contains no held-out anatomy failure yet.

Label fields record criterion, status, authority, confirmation, localized evidence and repair. Authorities are objective measurement, direct frame inspection or capability audit. Human semantic/creative labels are still needed before model-based evaluators can be qualified. The available set is intentionally skewed toward timing/contract checks; report results by criterion rather than claiming a misleading overall quality accuracy.

The package carries text/measurement snapshots and provenance, not personal media. Optional actual-file verification uses the caller's local `--media-root` directory. Missing or changed files stop that verification; snapshot mode is always identified and never impersonates fresh media inspection. Future examples from ordinary storytellers and known-bad/known-good audio/video should be added with genuine review labels, keeping related cases in one split.

This folder is an offline test collection. Its labels, recorded predictions and reports cannot approve a production artifact or mutate the LangGraph project. The master design remains `docs/memoir-system-living-spec.md`.

## Run and inspect locally

```sh
node runner.mjs eval --split calibration --out /absolute/calibration-report.json
node runner.mjs eval --split holdout --out /absolute/holdout-report.json
node runner.mjs eval --split all --media-root /absolute/legacy-agent-runs --out /absolute/actual-file-report.json
node runner.mjs eval-tasks --split calibration --out /absolute/reviewer-tasks.json
node runner.mjs eval --split calibration --predictions /absolute/recorded-predictions.json --out /absolute/compared-report.json
node runner.mjs eval-export --split calibration --out /absolute/langsmith-examples.json
```

Default split is calibration. `eval-tasks` gives the operating reviewer inputs without expected labels, group/split or label evidence. Recorded predictions are bound to case ID and a digest of the actual kind/input. They need a scoped check with evidence and repair, evaluator identity and perception basis. Missing/duplicate/stale responses stop. Direct media claims require the relevant perception mode; the runner validates declarations, not a worker's honesty. These tasks are the explicit integration boundary for a qualified host judge; this checkpoint does not invoke an external model or guess a reviewer SDK.

Reports count false approvals, incorrect rejections, missed defects and unresolved cases per criterion. An inconclusive response on a known defective clip remains a missed detection, even though it safely avoided approving it. Agent-provisional labels cannot become confirmed calibration truth. No aggregate score hides unresolved media review. `qualification` stays false for semantic/voice/anatomy judges in this small seed collection.

`eval-export` writes local example objects with separate `inputs`, expected `outputs`, and provenance `metadata`, suitable for an explicit LangSmith dataset upload through its SDK. It does not log in, upload, enable tracing or read LANGSMITH_API_KEY. A future upload requires account/configuration, review of what is being sent and explicit authorization. LangSmith is optional; every local command works without it. See [LangSmith evaluation concepts](https://docs.langchain.com/langsmith/evaluation-types).

## Current baseline

The free rules match all 14 duration labels, flag both incompatible v2 composition snapshots, reject both insufficient legacy review records and accept both structurally valid host-written drafts. They produce no incorrect rejections on these narrow passing cases. The known extra-hand clip remains **one missed detection / inconclusive** because no anatomy model is connected. Voice likeness is also inconclusive. These are component results, not proof of full artifact quality. The held-out Steve-family set has nine objective cases; additional held-out semantic, voice and anatomical failures are required before those judges can be qualified.

Current production `work` review tasks also include advisory deterministic findings, actual audio measurements when applicable and the scoped reviewer rubric. They still require the same independent host reviewer, exact artifact digest, complete review, direct perception and human approvals. No offline score automatically becomes a `review` event or changes project stage.

## Production visual qualification (new gate)

`visual-qualification.mjs` is separate from the 22-case seed harness. Existing scope coverage cannot certify an anatomy/identity/continuity judge. At the pre-video task, `visual-tasks --dataset <cases.json>` exports unlabelled held-out actual media/reference tasks. An independent host worker supplies VisualPrediction records. `qualify-visual --dataset <cases.json> --predictions <responses.json> --worker <worker-id> --model <model-version> --run <run>` verifies every source file, rejects leakage/duplicate coverage, and measures misses and false rejections. A worker cannot self-submit a passing report. Each of six scopes needs at least two distinct good and two distinct broken held-out examples and zero errors. The report still requires independent review and human approval.

Read exact schemas in visual-qualification.mjs. Labels must be actual human adjudications with localized evidence and repair, not the same reviewing model's outputs. Keep source runs/derivatives grouped before holdout; tune on calibration only. Classification thresholds are a conservative v1 policy rather than statistical reliability proof. Explicitly synthetic test fixtures only exercise these mechanics; they are never qualification data. No qualified production reviewer, new real labels, remote LangSmith tracing or real film proof was created in this checkpoint. Earlier image stages retain actual-image and human reviews; qualification is enforced before video.

Qualification reports include evidenceDirectory; its saved dataset/prediction sources and actual media remain required throughout their use. Approval/generation/finalization recompute hashes and metrics. Identity/continuity require independent references; cross-split checks include reference files.

## Independent audio qualification

`evaluation/audio-qualification.mjs` defines AudioCase/AudioPrediction, label-free tasks, six held-out criterion scores and verified saved evidence. `audio-tasks` / `qualify-audio` parallel the visual qualification commands without substituting visual qualification for audio expertise. Real sample references are mandatory for voice-match and locked text for transcript checks; family/source groups and all media/references must remain in one split. New host model/tool profiles need new qualification. Synthetic audio unit fixtures prove plumbing only, never production listening quality. Production corpus collection and direct host perception/STT/speaker tools remain pending.

## Grounded-writing persona collection

`text-personas.json` adds 14 invented, narrowly scoped source/draft or proposed-follow-up pairs for factual grounding and intake completeness. Good controls accompany invented ages, motives, promises and relationships; the set also exercises faithful gestures, nicknames, paraphrases, optional questionnaire omissions and unnecessary fear follow-ups. All labels are explicitly **agent-provisional, unconfirmed and calibration-only**. They are proposals to discuss, not human gold or qualification evidence. The local baseline returns inconclusive on every semantic case and scores none.

```sh
node runner.mjs eval-tasks --dataset evaluation/text-personas.json --out /absolute/persona-tasks.json
node runner.mjs eval --dataset evaluation/text-personas.json --out /absolute/persona-baseline.json
node runner.mjs eval --dataset evaluation/text-personas.json --predictions /absolute/persona-predictions.json --out /absolute/persona-review.json
```

Semantic tasks carry the actual packaged independent text rubric, bound into their input digest. Exported tasks use neutral IDs, omit expected labels/group/split, and reject extra fields outside the scoped semantic input contract, including nested expected-label fields. Semantic truth authority must be human or an unconfirmed agent proposal; objective/frame/capability labels cannot score factual meaning. Supplied semantic verdicts must declare direct-text review. A changed rubric invalidates earlier predictions. A genuine reviewer may supply predictions for discussion, but unconfirmed labels produce no accuracy score and neither predictions nor scores authorize production. Human-confirmed independent labels and additional separated holdout examples are needed before claiming semantic qualification.
