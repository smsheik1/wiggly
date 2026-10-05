# Memoir studio test catalog

A plain-English inventory for Shaz, Claude and future builders.

**Snapshot:** October 5, 2026 (America/Chicago), grounded writing, blocker alerts and the audio planning correction. This catalog describes offline tests; a separate live sample retry is recorded in the audio-planning release proof.

## What happened to “219 tests”?

That was an earlier reported suite total. The previous release contained **220 named cases**. Grounded writing added **four**, and blocker alerts added **two**, giving **226 cases** in the current source suite. Audio planning adds one case, giving **227 cases**, all passing. The two alert fixtures now supply the required author worker ID and reach their intended assertions.

Earlier release proofs retain their own totals: 220 before these changes and 224 for grounded writing alone. Counts belong to a specific tested checkpoint.

The source suite, package-check subset and focused audit subset overlap. Do not add their totals together as if they were different tests.

## What a passing test tells us

This suite includes workflow regressions, contract checks, integration checks and local rendering/audio component checks. Calling all of them “regression tests” is shorthand.

- **Protocol checks:** Given an input or a supplied review finding, does the workflow accept, reject, pause, repair or resume correctly?
- **Mocked API checks:** Does our adapter construct the request, save results, respect limits and handle errors correctly when a fake provider responds?
- **Local component checks:** Do SQLite, file verification, synthetic-audio processing or a small Remotion render actually work locally?
- **Evaluation-mechanics checks:** Does the scoring system handle labels, predictions and evidence correctly? Artificial perfect predictions do not prove a real reviewer is competent.

These tests make no live paid provider calls. Some invoke local FFmpeg/ffprobe or render a tiny synthetic clip. They do not establish real voice likeness, moving storytelling, real-provider compatibility or a successful full production run.

**Important example:** A test that feeds in “third hand detected” and checks the repair route proves the route works. It does not prove Vera would notice that third hand herself.

Some cases intentionally preserve older workflows, qualified-review policy, optional sound or legacy HD settings. Their presence does not make those the default v1 experience. New v1 projects use Mini 480p and can finish with narration alone.

## Reading the catalog

Each numbered entry is one actual Node `test()` case, not one assertion. Some cases contain many checks or loop through variants. The ten planted-trap entries are ten executions of one parameterized test definition, using ten different corpus cases.

“Fingerprint” means a hash used to identify exact content. “Receipt” means the saved record of a finished request. “Scoped” means the worker can access only the inputs/tools assigned to that task. “Reconciliation” means resolving what happened to a request whose outcome is uncertain before considering another request.

The source links point to this inspected checkout and the beginning of the corresponding test. They let Claude inspect the original title and assertions rather than trusting the summary alone.

## Section index

| Area | Committed cases |
|---|---:|
| [Workflow, locks and repair loops](#workflow-locks-and-repair-loops) | 11 |
| [Intake, character prompts and natural narration](#intake-character-prompts-and-natural-narration) | 8 |
| [Let the writer propose the cast](#let-the-writer-propose-the-cast) | 5 |
| [Keep human creative decisions in the loop](#keep-human-creative-decisions-in-the-loop) | 5 |
| [Existing voice clone selection and verification](#existing-voice-clone-selection-and-verification) | 10 |
| [Reuse an existing clone without demanding another recording](#reuse-an-existing-clone-without-demanding-another-recording) | 12 |
| [Independent speech-to-text](#independent-speech-to-text) | 7 |
| [Backgrounds, ownership and angle review](#backgrounds-ownership-and-angle-review) | 11 |
| [Compose characters and backgrounds into scene keyframes](#compose-characters-and-backgrounds-into-scene-keyframes) | 11 |
| [Main v1 flow: Mini 480p and narration-only finish](#main-v1-flow-mini-480p-and-narration-only-finish) | 9 |
| [Video, sound and final-film workflow](#video-sound-and-final-film-workflow) | 14 |
| [Human-supervised v1 policy, changes and project budget](#human-supervised-v1-policy-changes-and-project-budget) | 11 |
| [Whole simulated supervised workflow](#whole-simulated-supervised-workflow) | 1 |
| [Worker identities, independence and tool permissions](#worker-identities-independence-and-tool-permissions) | 9 |
| [Load the right skills, rubrics, recipes and config](#load-the-right-skills-rubrics-recipes-and-config) | 10 |
| [Native Codex worker connection and safe dispatch](#native-codex-worker-connection-and-safe-dispatch) | 14 |
| [Pause and inspect each worker in debug mode](#pause-and-inspect-each-worker-in-debug-mode) | 9 |
| [Clear producer messages and next steps](#clear-producer-messages-and-next-steps) | 11 |
| [Provider metadata checks and deliverable display](#provider-metadata-checks-and-deliverable-display) | 3 |
| [Cartesia and Muse generation adapters](#cartesia-and-muse-generation-adapters) | 8 |
| [Gemini listening and video inspection adapter](#gemini-listening-and-video-inspection-adapter) | 9 |
| [Video API and local film technical checks](#video-api-and-local-film-technical-checks) | 6 |
| [Remotion assembly and renderer component](#remotion-assembly-and-renderer-component) | 2 |
| [Evaluation harness, data integrity and honest evidence](#evaluation-harness-data-integrity-and-honest-evidence) | 10 |
| [Visual reviewer qualification mechanics](#visual-reviewer-qualification-mechanics) | 4 |
| [Audio reviewer qualification mechanics](#audio-reviewer-qualification-mechanics) | 1 |
| [Ten planted visual traps: routing only](#ten-planted-visual-traps-routing-only) | 10 |
| [Grounded writing](#grounded-writing-exact-rules-and-honest-semantic-evaluation) | 4 |
| [Blocker alerts](#blocker-alerts) | 2 |
| **Total committed** | **226** |

## Workflow, locks and repair loops

**Source:** `tests/workflow.test.mjs`

Uses invented project data and stipulated reviews. It checks routing and saved state, not the quality of a real story or voice.

1. **Require four 15-second story beats; compute the same file-content fingerprint regardless of object key order.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:10)

2. **Send a rejected script back for repair, require independent review and human approval, and refuse replies to an outdated task.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:16)

3. **Keep unrelated chat from changing the current stage; refuse self-review and incomplete rejection notes; escalate repeated rejection.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:26)

4. **Resume the same workflow after reopening SQLite; reject an outdated response without breaking the saved pause.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:36)

5. **Block visual work before narration is locked; check that changing a clone invalidates its dependent narration.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:50)

6. **Refuse narration approval when listening or required measurements are missing, or the transcript differs from the script.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:58)

7. **Tie spending approval to the exact request; save its provider job ID; prevent duplicate submission and require reconciliation after an uncertain outcome.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:67)

8. **Require three candidates and a sheet tied to the selected image for every character; verify the sheet recipe and finish the cast before backgrounds.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:83)

9. **Apply only the human's explicit request/count/cost allowance; return to approval when it is exhausted.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:100)

10. **Keep the source recording and clone when the script changes; regenerate the audition after the new script is approved.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:108)

11. **When fixing narration needs different words, stop for a script decision instead of generating more audio.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/workflow.test.mjs:115)

## Intake, character prompts and natural narration

**Source:** `tests/refined-flow.test.mjs`

Includes real local audio padding of synthetic tones and mocked Cartesia responses. No paid synthesis or actual voice-matching assessment.

12. **Bind questionnaire work to the original answers; require independent review and human confirmation; preserve older workflow behavior.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/refined-flow.test.mjs:18)

13. **Wait for the human to answer factual clarification; invalidate dependent work after a confirmed revision while preserving the clone.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/refined-flow.test.mjs:34)

14. **Reuse confirmed intake when approving a script; resolve new findings and prevent silent changes to locked ages or photos.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/refined-flow.test.mjs:51)

15. **Review and approve Cleo's character prompt before three Muse candidates; send defects back to the prompt and cap repeated failures.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/refined-flow.test.mjs:61)

16. **Pad short narration to 15 seconds with digital silence while preserving every original speech sample; leave overlong audio untouched.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/refined-flow.test.mjs:75)

17. **Make four natural-speed narration calls, retain their original files, pad afterward, and recover results without repeating calls.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/refined-flow.test.mjs:89)

18. **Require the character prompt author and Sage to view all supplied character photos through the scoped tools before submitting.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/refined-flow.test.mjs:101)

19. **When a pricing blocker is resolved, preserve previously approved visual prompts and retry counts rather than treating it as a visual defect.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/refined-flow.test.mjs:119)

## Let the writer propose the cast

**Source:** `tests/script-led-cast.test.mjs`

Checks the intake/cast protocol with invented story data, not whether the proposed cast is artistically correct.

20. **Allow memories to be confirmed before asking for a cast or photos; require the writer's cast proposal before script approval.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/script-led-cast.test.mjs:12)

21. **Prevent a passing review or cast proposal from bypassing unresolved factual blockers.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/script-led-cast.test.mjs:27)

22. **Require reference/consent decisions at roster approval and prevent silent changes to the script's approved cast.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/script-led-cast.test.mjs:36)

23. **After a restart, present the script and its proposed cast together without demanding the earlier intake inventory.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/script-led-cast.test.mjs:46)

24. **Give workers the saved workflow revision and approved cast proposal; refuse caller-supplied replacements.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/script-led-cast.test.mjs:62)

## Keep human creative decisions in the loop

**Source:** `tests/review-grounding.test.mjs`

Tests whether instructions and decisions reach the workers; it does not evaluate how well they follow them creatively.

25. **Give the writer and reviewer the same saved human decisions; prevent callers from dropping or replacing those decisions.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/review-grounding.test.mjs:20)

26. **Explicitly refresh writing instructions by re-reviewing the existing unapproved draft without losing answers, verdict history or retry count.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/review-grounding.test.mjs:31)

27. **Preserve creative directions across SQLite restart without altering approvals, budget or original facts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/review-grounding.test.mjs:43)

28. **Allow a new creative direction after an explicit script rewind even if earlier media work exists.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/review-grounding.test.mjs:51)

29. **Require a new review when the human adds a creative requirement; the previous passing review cannot authorize approval.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/review-grounding.test.mjs:60)

## Existing voice clone selection and verification

**Source:** `tests/existing-voice.test.mjs`

Several cases deliberately cover the older workflow that requested a reference recording. The next section covers the corrected sample-optional branch. Lookup responses are mocked, not live account checks.

30. **Save a selected existing clone and its authenticated lookup while preserving the script; in this older branch, wait for a real reference sample without spending or approving anything.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:25)

31. **In the older reference-required branch, bind the submitted sample to the selected clone and lookup record before audition planning; preserve the debug pause.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:34)

32. **Block replacement cloning while the selected clone is unverified; allow recovery by metadata verification alone.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:45)

33. **Clear previous verification before a recheck so a failed new lookup cannot reuse old ownership evidence.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:52)

34. **Require human consent to choose a clone and trusted runtime authority to verify its exact metadata.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:67)

35. **Preserve the normal new-clone path; do not invent lookup evidence for historical clone records.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:77)

36. **Keep the selected voice unchanged in the task sent to a worker.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:85)

37. **Retain only allowed lookup fields, including visibility, and exclude secret keys and unrelated provider response data.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:91)

38. **Stop a failed or mismatched lookup once with remediation; never silently create a new clone instead.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:99)

39. **Keep the verified selection after SQLite restart; prevent CLI events from pretending to be runtime verification.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice.test.mjs:108)

## Reuse an existing clone without demanding another recording

**Source:** `tests/existing-voice-no-sample.test.mjs`

These are protocol and mocked-tool checks. They do not establish real voice quality or a measured speaker-similarity score.

40. **Require a real recording for a new clone, but allow a verified existing clone to reach audition planning without a dummy sample or generation job.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:31)

41. **Move an older verified-clone project to sample-free reuse only through an explicit human event; preserve story locks and the debug pause.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:41)

42. **When no original recording exists, require human recognition of the audition and refuse fabricated source or similarity evidence.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:51)

43. **Still require four measured narration windows, independent review and human approval before narration lock without an original sample.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:59)

44. **Reject invented source hashes, similarity scores and comparison-tool evidence even on rejected or inconclusive reviews.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:65)

45. **After a script revision, retain the existing clone and return to audition rather than asking for an unnecessary recording.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:73)

46. **If the user supplied a real optional recording, retain it for comparison instead of discarding it.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:79)

47. **Allow an explicit, narrowly scoped Ava/rubric correction only before provider work starts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:84)

48. **Prevent a qualified reviewer from converting missing original-reference identity evidence into an automatic pass.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:93)

49. **Include the real existing-voice basis in worker inputs; exercise the review tool bridge without an original sample.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:97)

50. **Persist sample-free existing-voice reuse across CLI/SQLite restart with no spending.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:109)

51. **Use the verified clone's language for independent transcription without supplying an original sample or the expected script.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/existing-voice-no-sample.test.mjs:118)

## Independent speech-to-text

**Source:** `tests/cartesia-stt.test.mjs`

Uses mocked provider responses and small synthetic audio files. Confirms request/evidence/accounting behavior, not real transcription accuracy.

52. **Send the exact audio for transcription without revealing the expected script; save provider evidence and recover without another paid request.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/cartesia-stt.test.mjs:21)

53. **Reject unauthorized workers, out-of-scope files, unsupported language and absent allowance before any network request.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/cartesia-stt.test.mjs:37)

54. **Redact credentials and stop transcription failures without retries or fallback output.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/cartesia-stt.test.mjs:48)

55. **Refuse malformed transcript responses as approval evidence.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/cartesia-stt.test.mjs:57)

56. **Keep parallel transcription calls within the cap and bind finished results to the task and language.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/cartesia-stt.test.mjs:64)

57. **Share a result for identical concurrent requests without using the next legitimate request's allowance.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/cartesia-stt.test.mjs:73)

58. **Reserve project funds before the network call; reusing a completed cached result consumes no additional reservation.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/cartesia-stt.test.mjs:81)

## Backgrounds, ownership and angle review

**Source:** `tests/backgrounds.test.mjs`

Uses simulated generation receipts and review observations. No actual backgrounds are generated or judged.

59. **Block background inventory until narration and every character sheet are locked.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:10)

60. **Require the location registry to cover all four beats and refer to established characters and valid scene angles.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:13)

61. **Require a scene-focused owner brief, separate technical prompter, owner check, independent review and human approval in that order.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:17)

62. **Require direct-perception evidence for three concepts, explicit human selection and derived angles tied to that selected master.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:24)

63. **Process one location at a time; review and approve each angle separately; keep video blocked.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:29)

64. **Changing a location master invalidates its dependent angle while preserving unrelated locations.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:33)

65. **Send a rejected background prompt back to the prompter with evidence, then repeat the owner check.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:38)

66. **Resume at the exact background gate after SQLite restart and refuse replies to outdated tasks.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:39)

67. **Start background work in an older pending project only explicitly; route an inconclusive owner check back to the owner.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:50)

68. **Prevent generation plans from changing the approved prompt or omitting count/cost; reject portrait-format receipts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:57)

69. **Tie advisory evidence to the current location artifact without pretending an image inspection happened.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/backgrounds.test.mjs:63)

## Compose characters and backgrounds into scene keyframes

**Source:** `tests/keyframes.test.mjs`

Defects here are supplied as review findings. These checks verify the response to a third-hand report; they do not prove a model can detect a third hand.

70. **Require approved backgrounds and a four-beat shot plan tied to valid scenes, characters and angles.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:11)

71. **Supply the actual approved setting and character-sheet references; reject mismatched or reordered reference fingerprints.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:19)

72. **Require prompt review and human approval before generation; enforce the exact prompt and a production-sized 16:9 image.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:23)

73. **Route a reported extra-hand defect to the composition writer instead of approving the frame.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:29)

74. **Keep the generation limit for the same shot plan even when its prompt is revised.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:33)

75. **Require independent review and human approval for every shot before reviewer qualification; keep video blocked.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:37)

76. **Changing a background reopens affected shot prompts and frames while preserving other locations' frames and the shot plan.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:40)

77. **Resume at keyframe prompt approval after SQLite restart; reject outdated replies and missing perception.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:45)

78. **Explicitly start an older pending shot workflow; resolve rejected-image escalation back to the prompt.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:51)

79. **Reject thumbnail-sized images as production keyframes even when their aspect ratio is widescreen.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:55)

80. **Escalate after two rejected frames for the same shot, even if the prompt was repaired between attempts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/keyframes.test.mjs:60)

## Main v1 flow: Mini 480p and narration-only finish

**Source:** `tests/mini-core-flow.test.mjs`

Mocked video API and real local synthetic audio mixing. Historical HD settings remain covered for compatibility.

81. **Use Seedance 2.0 Mini at 480p for new projects; preserve legacy model/resolution when an older saved project lacks that profile.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:28)

82. **Block video before any request if the approved scene keyframe is missing.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:41)

83. **Report localized video-defect evidence, return to Vin and require approval of the next exact spend.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:45)

84. **Return background image defects to Pia, preserve Beau's brief and retain retry limits across prompt versions.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:57)

85. **Send sheet and derived-angle defects to their prompt authors rather than directly generating replacements.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:64)

86. **Keep Vera's and Ava's separate final review gates in a narration-only film across SQLite restarts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:72)

87. **Require an explicit reviewed decision to omit music; still require locks for any included effects.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:78)

88. **Mix synthetic narration with optional effects locally without music or changes to playback speed.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:84)

89. **Send the actual first-frame bytes in a mocked Mini request and recover the same job without submitting again.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/mini-core-flow.test.mjs:91)

## Video, sound and final-film workflow

**Source:** `tests/studio.test.mjs`

Mostly legacy qualified-review/short-clip workflow coverage with stipulated verdicts. It is not proof of a real 60-second production or present-day model quality.

90. **Block video when the visual reviewer is unqualified; refuse agent self-certification of qualification reports.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:16)

91. **Require a 60-second video plan built from short clips, approved first frames and positive cost estimates.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:22)

92. **Require full-video coverage evidence; route a reported extra hand back to the prompt engineer before user approval.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:31)

93. **Allow automatic technical repairs only under bounded human authorization; exclude creative changes from that allowance.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:38)

94. **Escalate repeated video defects and preserve generation caps across prompt revisions.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:46)

95. **Review imported sound and its provenance; keep unrelated sound assets valid when a clip changes.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:51)

96. **Build an assembly timeline that retains four natural-speed narration stems, trims clips, ducks piano and records every asset.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:57)

97. **Require audiovisual review and human approval for the final film; reject malformed render records.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:64)

98. **Resume every studio gate after SQLite reopening and finish the fixture workflow without provider calls.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:71)

99. **Pass generated-sound receipts through the workflow only when their prompt and duration match the plan.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:76)

100. **Send a mix defect back to editing; send a source-video defect back only to its own video prompt.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:82)

101. **Return an imported-sound defect to the import author rather than the sound-generation provider.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:87)

102. **Route human film feedback to the editor; pause for dependency impact before repairing narration sources.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:91)

103. **Tie final approval to the renderer's actual inventory; refuse older incompatible renderer manifests.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio.test.mjs:96)

## Human-supervised v1 policy, changes and project budget

**Source:** `tests/supervised-v1.test.mjs`

Exercises policy and accounting with fictional data. A provisional review is advisory and still requires explicit human confirmation.

104. **Allow supervised narration without pretending the reviewer is qualified or inventing a speaker score; require human media confirmation.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:14)

105. **Prevent missing perception, known defects or outdated human evidence from becoming provisional approval.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:22)

106. **Preserve the qualified-review policy in older checkpoints instead of silently skipping qualification.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:32)

107. **Keep supervised policy and human review evidence after reopening SQLite.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:40)

108. **For detail changes and complete redo, require confirmation of the exact dependency impact; preserve source facts and attempt counts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:48)

109. **Preserve artifacts when abandoning a project; block new submissions and retain uncertain jobs for reconciliation.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:59)

110. **Plan shot intentions before backgrounds without bypassing approved references or narration.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:69)

111. **Allow later staging refinements but refuse changes to already locked shot action or timing.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:79)

112. **Use one lasting project ceiling for both generation and inference; do not reset spending through errors or rewinds.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:87)

113. **Block paid generation and inference at zero budget; preserve accounting and the creative task across SQLite restart.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:108)

114. **In the older script-approval policy, require rights/reference and common-sense decisions; prevent later cast identity/age swaps.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-v1.test.mjs:123)

## Whole simulated supervised workflow

**Source:** `tests/supervised-studio.test.mjs`

A fixture-based integration test: no real provider generation, genuine reviewer qualification or paid end-to-end production.

115. **Run the supervised studio to completion while reopening SQLite at every transition; require human decisions without inventing reviewer qualification or video authorization.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-studio.test.mjs:32)

## Worker identities, independence and tool permissions

**Source:** `tests/crew.test.mjs`

Workers and perception responses are simulated. Real tool execution is exercised for local synthetic-audio measurement.

116. **Enforce the saved role/worker assignments, require every role and prevent workers from impersonating reviewers or human approvers.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:15)

117. **Restrict workers to permitted tools and scoped assets; deny writes/spending and report unavailable listening instead of pretending to hear.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:27)

118. **Give automatic reviews the same canonical rubric and advisory evidence as manual review; reject attempts to replace the rubric.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:40)

119. **Require separate qualified visual and audio reviews before the final human film decision.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:49)

120. **Explicitly reopen old audio locks for the required qualified review without discarding independent source facts and assets.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:57)

121. **Do not let an unavailable-listening rejection trigger new paid production.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:62)

122. **Require successful connected perception-tool evidence with enough coverage, rather than accepting a bare claim of listening.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:68)

123. **Use measured tool results for the audition transcript and similarity; prevent a worker from replacing failed STT with the locked script.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:81)

124. **Explicitly upgrade a reviewer's profile by reopening its qualification and dependent work while preserving original facts and sources.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/crew.test.mjs:90)

## Load the right skills, rubrics, recipes and config

**Source:** `tests/studio-instructions.test.mjs`

Checks instruction loading, integrity and permissions. It does not prove a model obeys each instruction or makes good creative choices.

125. **Send the answers organizer the original source fingerprint; reject substitutions or omissions before dispatch and require clarification for changed facts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:18)

126. **Give both intake roles the rule that optional anecdotes need not block progress; retain required human confirmation.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:31)

127. **Load each named agent's skill and only its relevant recipe/rubric; keep writer and reviewer instructions distinct.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:42)

128. **After template edits and SQLite restart, keep an active project's saved instructions, recipes, model bindings and limits.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:50)

129. **Stop missing, replaced or outdated inputs before host dispatch; always supply the canonical review rubric.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:62)

130. **Reject instruction tampering and expanded tool privileges; enforce project-specific tool restrictions.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:70)

131. **Return an evidenced rejection to Leo with the exact draft and notes; escalate repeated disagreement without generating media.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:77)

132. **Require explicit, pristine-project instruction upgrades; preserve historical compatibility and human ownership of actual budget decisions.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:86)

133. **Keep Cartesia model/version/speed settings pinned to the project; reject silent plan overrides.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:95)

134. **Give background workers approved cast sheets and video workers locked narration as verified scoped assets.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-instructions.test.mjs:101)

## Native Codex worker connection and safe dispatch

**Source:** `tests/codex-host.test.mjs`

Uses a fake Codex transport and simulated worker turns. These are interface tests, not evidence that a live model completed each job.

135. **Use the chosen model, distinct role threads and permitted dynamic tools in the Codex bridge.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:37)

136. **Stop model/profile mismatches and failed host turns without silently switching models or retrying.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:49)

137. **Send the native answers worker the original source fingerprint and the rule to preserve raw answers.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:61)

138. **Terminate a worker turn after a fatal external perception failure before it can submit a verdict.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:72)

139. **Dispatch only bounded eligible work; retain SQLite task state and stop at human/production gates.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:80)

140. **Keep successfully initialized roles after partial crew setup and do not blindly repeat uncertain initialization.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:90)

141. **Save finished worker receipts even if checkpointing fails; do not redispatch uncertain turns.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:99)

142. **Attach permitted reference images as native image inputs tied to their scoped fingerprints.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:111)

143. **Keep a known malformed finished response inspectable and allow a bounded, evidenced repair.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:119)

144. **Allow repair of known finished role/JSON errors while refusing repeat attempts after unknown transport outcomes.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:130)

145. **Dispatch Max to plan an existing-clone audition, then stop before authorization or media generation.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:153)

146. **Honor the debug pause and exclude local film assembly, human decisions and provider submission from native planning dispatch.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:167)

147. **Let Max report missing pricing prerequisites with the correct locked audition text, without inventing a job, plan or approval.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:181)

## Pause and inspect each worker in debug mode

**Source:** `tests/debug-mode.test.mjs`

Uses simulated workers and temporary checkpoints. The CLI inspector is read-only; no actual providers are called.

148. **Require human authority for debug controls; preserve task identity and older checkpoints.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:23)

149. **Keep debug settings across SQLite restart and pause after every worker even when a batch was requested.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:35)

150. **Keep rejected work inspectable and pause before automatically sending it to the repair author.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:55)

151. **Pause on malformed finished output while preserving its recoverable receipt and task ID.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:68)

152. **Refuse worker dispatch, provider submission and rendering while debug is paused, before side effects.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:81)

153. **Allow collecting a previously submitted job while paused, but refuse to submit it again.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:91)

154. **Keep file-verification failures repairable, including those on old completed receipts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:106)

155. **Do not repeat a worker with an unknown outcome even after the human says to continue debug.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:127)

156. **Use the actual saved project for CLI debug controls and read-only inspection without provider calls.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/debug-mode.test.mjs:138)

## Clear producer messages and next steps

**Source:** `tests/producer-handoff.test.mjs`

Checks the producer's generated status text against simulated history. Current assertions also distinguish blocked work from waiting for debug inspection, use plain voice-sample labels, keep historical diagnostics separate and clear stale blocked wording after resolution. The two additional blocker-message cases are listed separately at the end.

157. **Name the author who actually completed work and the next reviewer; do not claim an assigned worker is already running.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:24)

158. **Report a passed review as a review result, leaving human approval as the next decision in debug mode.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:36)

159. **Name the rejecting reviewer and send localized repair notes to the author without presenting failed media as ready.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:43)

160. **On the new-clone path, ask for a real recording after script approval rather than approval of a nonexistent deliverable or another debug continuation.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:51)

161. **Give old checkpoints current-stage guidance without inventing worker provenance.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:62)

162. **Create the exact runtime-designated upload folder while preserving approvals and state across CLI restart.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:69)

163. **Distinguish request planning from finished generation; describe uncertain submissions without requesting a duplicate plan.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:88)

164. **After a rewind or new-review requirement, stop describing old approvals or reviews as current.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:102)

165. **After a saved worker failure, ask for diagnosis and refuse to imply a guessed completion or routine retry.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:112)

166. **Allow genuine human sample upload during the debug pause while keeping worker dispatch and provider submission paused.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:119)

167. **Require debug continuation for authorized submission; after reconciliation, request existing collection or a fresh scoped plan as appropriate.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:133)

## Provider metadata checks and deliverable display

**Source:** `tests/readiness.test.mjs`

All provider metadata responses are mocked. A successful metadata check explicitly does not establish generation access, credits or production readiness.

168. **Use only the documented metadata GET requests; redact errors and never treat them as permission or proof of generation readiness.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/readiness.test.mjs:15)

169. **Present four separate verified narration files only at the proper reviewed gate; block stale, failed or tampered assets and clearly label supervised advisory review.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/readiness.test.mjs:29)

170. **Display the saved reviewed script through the CLI without altering SQLite or inventing human approval.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/readiness.test.mjs:42)

## Cartesia and Muse generation adapters

**Source:** `tests/providers.test.mjs`

Network responses are mocked; file bytes and request construction are checked. Includes real local duration/silence measurement of synthetic audio.

171. **Upload the exact source recording with language and private clone settings; recover a completed receipt without another request.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/providers.test.mjs:26)

172. **Send selected-image bytes for Muse reference edits, request exactly three candidates and redact secrets on failure.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/providers.test.mjs:44)

173. **Use the current clone in four separate natural-speed narration requests; never repeat an uncertain second subrequest.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/providers.test.mjs:63)

174. **Measure real local duration/silence and detect changed files; read only the requested secret value.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/providers.test.mjs:78)

175. **Resume the standalone CLI in another process; refuse runtime impersonation and unauthorized final-film completion.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/providers.test.mjs:89)

176. **Prevent direct adapter calls from bypassing the workflow's submission and spending gates.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/providers.test.mjs:101)

177. **Generate background concepts without character references; send the selected master for angle edits and prevent replay of completed requests.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/providers.test.mjs:107)

178. **Upload the actual setting and character-sheet bytes in their bound order for one composed keyframe request.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/providers.test.mjs:126)

## Gemini listening and video inspection adapter

**Source:** `tests/gemini-review.test.mjs`

Provider behavior is mocked. These verify media delivery, coverage and accounting, not Gemini's actual defect-detection accuracy at 4 FPS.

179. **Send exact audio bytes for listening, bind the result receipt and reuse a completed request without paying again.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:23)

180. **Use the approved 4-FPS video inspection profile with only the allowed references and tools.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:34)

181. **Reject absent allowance, incomplete coverage and provider errors; never fake listening, retry or silently switch reviewers.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:46)

182. **Recover a completed response without a provider ID after a local save failure instead of submitting it again.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:60)

183. **Save large-upload sessions and poll recorded files; never blindly repeat an upload with an unknown outcome.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:69)

184. **Prevent concurrent perception requests from exceeding the explicit inference cap.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:88)

185. **Share identical concurrent review requests without consuming the allowance for a different legitimate request.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:96)

186. **Check the selected Gemini model using one authenticated metadata GET, without inference.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:104)

187. **Reserve the project budget before a review request; reuse completed cached results without another reservation.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/gemini-review.test.mjs:109)

## Video API and local film technical checks

**Source:** `tests/studio-providers.test.mjs`

Mocked video/music/effects API requests plus real local operations on tiny synthetic clips. Optional sound and legacy video paths remain covered.

188. **Send actual first-frame bytes to Seedance, save the job ID and poll/recover without another generation POST.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-providers.test.mjs:18)

189. **Block resubmission after an unknown video POST outcome; do not create a new generation when polling fails.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-providers.test.mjs:26)

190. **Use fixed instrumental music/effect payloads and keep provenance and durable binary receipts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-providers.test.mjs:34)

191. **Inspect real local clip/audio streams and flag a synthetic freeze without claiming to judge human anatomy.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-providers.test.mjs:41)

192. **Execute the audio mix on a two-second synthetic fixture; this is not a full story-production proof.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-providers.test.mjs:45)

193. **Measure the moving-video stream's duration instead of accepting a longer accompanying audio track.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/studio-providers.test.mjs:49)

## Remotion assembly and renderer component

**Source:** `tests/remotion.test.mjs`

Real local rendering of a synthetic two-second component, not the final memoir or a paid generation.

194. **Build the composition with integer frame counts and the exact mixed timeline without changing playback speed.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/remotion.test.mjs:12)

195. **Render a packaged two-second synthetic Remotion component with the specified source trim and exact cut.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/remotion.test.mjs:16)

## Evaluation harness, data integrity and honest evidence

**Source:** `tests/evaluation.test.mjs`

Mixes saved-case metadata checks with artificial predictions and local evaluator rules. Does not call a real judge or qualify production perception.

196. **Require dataset provenance, valid labels and repairs; keep related cases and identical media out of different data splits.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:14)

197. **Hide answer labels and split/provenance clues from evaluator tasks; reject outdated, duplicate or incomplete predictions.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:22)

198. **Allow local rules to judge only measured timing/contracts; report unresolved anatomy/voice questions instead of inventing a perceptual pass.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:31)

199. **Correctly count false approval and unnecessary rejection from deliberately bad supplied predictions.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:39)

200. **Validate script structure while leaving facts and storytelling quality unresolved; localize malformed-draft repairs.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:50)

201. **Detect omitted/changed transcript words and refuse mismatched transcription/similarity fingerprints as valid evidence.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:57)

202. **Prepare a local LangSmith export with expected outputs separate from worker inputs; do not upload it.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:69)

203. **Block escaped paths and changed media; do not treat saved labels as a new inspection of the actual asset.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:74)

204. **Run offline evaluation without changing an existing project checkpoint; keep holdout cases out of default calibration tasks.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:85)

205. **Bind advisory evidence to the current artifact without approving it or certifying its facts.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/evaluation.test.mjs:99)

## Visual reviewer qualification mechanics

**Source:** `tests/visual-qualification.test.mjs`

Synthetic colors/clips and stipulated labels/predictions. Passing these tests does not mean Vera is genuinely qualified on real animation.

206. **Score six held-out image/video criteria using exact files while hiding labels from worker inputs.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/visual-qualification.test.mjs:12)

207. **Refuse qualification when perception, predictions or sample coverage are missing, outdated, duplicated or leaked across splits.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/visual-qualification.test.mjs:15)

208. **Keep qualification evidence available for inspection; detect changed labels/predictions and reference leakage.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/visual-qualification.test.mjs:22)

209. **Bind visual qualification to the selected tool profile and reject results after that profile changes.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/visual-qualification.test.mjs:28)

## Audio reviewer qualification mechanics

**Source:** `tests/audio-qualification.test.mjs`

Synthetic tones and stipulated labels/predictions. No real hearing or speaker-recognition qualification is established.

210. **Score all six audio criteria independently, verify the saved source evidence, and reject changed evidence, incorrect/incomplete predictions, missing listening/reference audio, model mismatches or split leakage.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/audio-qualification.test.mjs:18)

## Ten planted visual traps: routing only

**Source:** `tests/supervised-regression.test.mjs`

Every defect is a scripted observation or deliberately altered reference. No model is asked to discover the defect in an actual image.

211. **Route a stipulated usable frame to human review without automatically approving it.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

212. **Route a scripted third-hand finding to keyframe-prompt repair without approving the frame.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

213. **Route a scripted floating-hand finding to staging repair.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

214. **Block a character reference substituted with the wrong age variant.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

215. **Block a character reference substituted with a different person.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

216. **Block reordered setting/character references in the composition prompt.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

217. **Block a changed or outdated reference fingerprint.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

218. **Route a scripted moved-doorway finding to background-continuity repair.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

219. **Route a scripted unreadable story-critical sign finding to scene repair.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

220. **Escalate when perception is unavailable instead of approving or inventing a visual judgment.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/supervised-regression.test.mjs:12)

## Grounded writing: exact rules and honest semantic evaluation

**Source:** `tests/grounded-writing.test.mjs`

These tests enforce literal quotation/source binding and the reviewer protocol. They do not ask a real model to distinguish truthful from invented memories. Fourteen invented persona examples are separate data, not fourteen additional test cases.

221. **Reject altered, undeclared, wrongly cited, partial-word or unbalanced direct quotations; accept exact sourced words, including multiline excerpts and unquoted paraphrase while leaving factual meaning to independent review.** [Test source](/Users/shaz/Projects/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/grounded-writing.test.mjs:17)

222. **Use actual human-confirmed answer clarifications for quotations, retain original raw answers, and preserve older instruction snapshots through SQLite restart without a policy migration.** [Test source](/Users/shaz/Projects/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/grounded-writing.test.mjs:31)

223. **Give the writer and independent reviewer the agreed rules through canonical tasks, including optional fear/chronology/ending guidance and essential-only follow-ups.** [Test source](/Users/shaz/Projects/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/grounded-writing.test.mjs:44)

224. **Hide proposed persona labels using neutral IDs and strict task inputs, reject nonhuman semantic-label authority or structural-only verdicts, bind the actual rubric into predictions, and keep semantic baseline results inconclusive and unscored without human-confirmed labels.** [Test source](/Users/shaz/Projects/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/grounded-writing.test.mjs:50)

The existing native Codex bridge test also checks that the worker receives the quotation fields and current writer policy.

## Blocker alerts

**Source:** `tests/producer-handoff.test.mjs`. Both cases pass in the 226-case source suite. They enforce the handoff and display contract using isolated fixtures; an actual new Max response and verified account pricing remain untested.

225. **Require a billing blocker to explain the problem, solution and canonical baby steps, without inventing an API failure or assuming a free plan cannot work.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:155)

226. **Keep missing-input blockers and historical records readable without inventing billing evidence, approvals or new generation jobs.** [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/producer-handoff.test.mjs:166)

## Audio planning correction

227. **Plan cheap speech without unavailable balance proof, while refusing forged cost inputs, zero-cost reservations, unauthorized instruction refresh, insufficient budgets and mismatched request approval.** Also verifies that refreshing Max leaves the approved story, clone, crew and other pinned skills unchanged. [Test source](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/tests/codex-host.test.mjs:202)

The actual Cartesia sample generation is separate evidence; this offline case uses no real provider.

## How Claude should review this

Treat the entries as an inventory, not a quality score. For any suggested change:

1. Open the linked test and identify what its assertions actually verify.
2. Identify the failure class it protects: wrong state, unauthorized spend, wrong assets, false evidence, lost progress or misleading communication.
3. Suggest consolidation only when the replacement preserves those distinct protections. Several assertions in one test can replace several small tests.
4. Separate test weaknesses from runtime weaknesses. A passing mock cannot validate a real provider contract or a real reviewer's judgment.
5. Flag outdated policy assumptions, redundant coverage and useful missing scenarios. Do not change the active project's state, approvals or provider jobs while reviewing.

This document is a snapshot. If tests are added, removed or renamed, reconcile its entries against `tests/*.test.mjs` and `evaluation/invented-regression.json` before quoting its count again.

## Source and verification references

- [Blocker-alert release proof](/Users/shaz/Projects/wiggly/docs/proofs/memoir-blocker-alert-release.json).
- [Grounded-writing release proof](/Users/shaz/Projects/wiggly/docs/proofs/memoir-grounded-writing-release.json).
- [Earlier release proof](/Users/shaz/.codex/worktrees/2f6f/wiggly/docs/proofs/memoir-planner-debug-release.json): records the 220-case source result and its production-proof limitations.
- [Test script and dependencies](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/package.json): `npm test` runs `node --test tests/*.test.mjs`.
- [Invented regression corpus](/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/evaluation/invented-regression.json): the ten expanded routing-only trap cases.
- [Living system spec](/Users/shaz/.codex/worktrees/2f6f/wiggly/docs/memoir-system-living-spec.md).
- [Remaining work](/Users/shaz/.codex/worktrees/2f6f/wiggly/docs/memoir-system-remaining-work.md).

To run the suite locally, enter the format kit directory and run `npm test`. The grounded-writing source suite was rerun: 224 passed. The independently extracted package and limits of that verification are recorded in the grounded-writing release proof. The unfinished appendix is not included in that result.
