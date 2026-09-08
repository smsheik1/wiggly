---
name: animal-conversations
description: Turn a supported accessible video link or local media file into an explicitly approved Dog/Bunny video using local transcription, the packaged engine, actual playback review, and verified export. The agent authors the dialogue timeline; user-authored timestamps are optional.
---

# Animal Conversations

Read `KIT-MANIFEST.json` first and report its exact `formatVersion`. This is the canonical agent workflow. Use `runner.mjs` as the episode entry point and `runtime/render.mjs` as the only renderer. Never rebuild the engine, weaken a gate, introduce image/video/voice providers, or invent a second workflow.

The blue Dog uses legacy runtime ID `cat`; the pink Bunny uses `bunny`. Either can be mentor, questioner, lead, or foil. Their performance comes from the user's approved complete script—not a fixed archetype, camera, or anonymous voice cluster.

## 1. Check setup and existing progress

Node >=20.9.0 is the initial prerequisite. Run `node runner.mjs doctor` before installation; report missing requirements together without silently repairing global installations. `FFMPEG`, `FFPROBE`, and `PYTHON` select executable paths, not shell commands.

Install kit-local dependencies with `npm ci`, then run `npm test`, the doctor again, and `node runner.mjs smoke --run=<fresh-smoke-id>`. Python and Cargo are unnecessary for rendering prepared episodes from the packaged poses. The smoke proof has synthetic mechanics-only approval; it cannot finalize real content.

For an existing episode, begin with:

```sh
node runner.mjs status --run=<id> --json
```

Follow the actual checkpoint and `nextAction.owner`: the **agent** drafts/diagnoses/reviews, the **user** approves or supplies inaccessible media, and the **operator** resolves unavailable tools/access. Do not turn agent-owned work into a request for user-authored timestamps. Status is read-only; a saved phase label does not prove artifacts remain valid.

## 2. Prepare the clip

Obtain a supported, accessible source link or local media file the user has permission to remix. A background preference is optional; propose a packaged background for approval if needed. No user-authored timestamps are required, though supplied transcripts/timelines may help draft.

Local transcription requires Python **3.12** and explicit one-time setup:

```sh
node runner.mjs setup-intake
node runner.mjs intake --run=<fresh-id> --source=<supported-link-or-absolute-local-file>
```

Before setup, explain that it installs locked dependencies into `.intake-env/` and approximately **486 MB** of pinned `small.en` weights into `.intake-models/`. Defaults: CPU/int8, English word timestamps, beam size 5, no VAD, no previous-text conditioning. Prepared local-file intake then works offline. Ordinary intake never downloads missing dependencies or model files. Do not promise non-English accuracy or perfect emotional/overlapping speech recognition.

If retrieval fails, ask for a downloaded file. Never obtain cookies, credentials, or paid services automatically; not every Instagram/TikTok/YouTube link works. Resume the existing intake after setup or with the supplied fallback:

```sh
node runner.mjs run --run=<id> --source=/absolute/downloaded-video.mp4
```

Original media stays private. `user-audio.wav` is the full-resolution/full-duration soundtrack; the separate 16 kHz mono WAV is only for ASR. Use measured audio duration, not video-frame duration. Transcript times start at decoded-audio zero; evidence records any source-container offset.

## 3. The agent authors the complete draft

At `needs-script-draft`, inspect the source and uncertain `transcript.json`, then author a candidate following `input-contract.json`. Do not ask the user for timing JSON, copy sample timings into real content, or mistake ASR for approval.

For a `speaker=both` draft, include the actual simultaneous-speech basis in `overlapEvidence` and identify `captionSpeaker` when there are captioned words. Use `captionSpeaker=both` only for a synchronized chorus. A draft evidence note does not confirm or approve the review; section 4 still applies.

Import into the **same intake run**, without calling init again:

```sh
node runner.mjs review-script --run=<id> --input=/absolute/draft.json
```

Validation happens before canonical input is replaced. The generated `script-review.html`, `timed-role-sheet.md`, and exact WAV clips show wording, timing, characters, caption ownership, vocalizations, overlap, cameras, emphasis, background, title, episode label, evidence, and uncertainty. The page works through `file://` without a server.

An operator with prepared real audio and a candidate may instead use the advanced fresh-run path: `init --run=<fresh-id> --audio=/absolute/audio.wav --input=/absolute/draft.json`. Both initialization paths reject run collisions.

## 4. Show an honest review before approval

Fill the generated `script-review.json` beat evidence from actual observations: `confirmedSpeaker`, `evidence`, `evidenceNote`, `transcriptionEvidence`, `timingEvidence`, and `uncertainty`. Valid evidence methods are `direct-audio-review`, `local-audio-analysis`, `user-provided-label`, `reference-video`, or `silence`. Do not claim a channel you did not use. Do not manually set approval flags or compute approval hashes.

Only set `diarization.performed`, `detectedVoices`, and stable `voiceCharacterMap` entries when genuine diarization supplies distinct voices. Bundled ASR does **not** perform diarization. One person performing multiple characters is not proof of one voice/one character. Every `both` beat requires `overlapConfirmed: true` and specific simultaneous-speech evidence; it never means uncertainty.

After evidence edits, regenerate **before showing the page**:

```sh
node runner.mjs review-script --run=<id>
```

Show the actual playable page and explain uncertainty plainly. Ask the user to approve the entire displayed plan or describe corrections; the agent handles corrections and timing. Do not hide omitted reactions or turn uncertain words into confident claims.

Only after explicit approval of that displayed review:

```sh
node runner.mjs approve-script --run=<id> --review-id=<displayed-id> --approved-by=<user-name> --note="Actual complete-review confirmation"
node runner.mjs run --run=<id>
```

The runtime computes hashes. Changed review evidence may require a new displayed review ID. Changed audio or creative choices invalidate approval. For changed choices in a progressed run, import with `review-script --input=/absolute/revised.json --new-revision`; previous outputs/receipts are preserved. A different source/audio uses fresh intake, not in-place file replacement. Unchanged review regeneration is idempotent.

Importing changed draft content regenerates all beat evidence. Preserve the previous input/review first, carry forward only observations still valid for unchanged content and audio, then record corrections and regenerate the review. Never copy approval fields, fingerprints, review IDs, or receipts into the new review.

## 5. Render and repair only observed failures

`run` advances eligible deterministic work until completion or a required action. There are **three technical cycles per approved content-and-audio revision, including the first**: render if needed, then inspect. Interrupted cycles resume under the existing attempt ID; read-only diagnosis consumes no attempt.

**Reapproving unchanged content cannot reset that budget.** Approval timestamps and notes do not define a revision. A note claiming a fix is not a repair. Diagnose the actual failure and require a relevant supported correction before retrying. Changed approved choices need review/approval again. Never edit the renderer, weaken policy, delete history, or change correct timing just to pass a gate.

Missing approval/access, unavailable required perception, exhausted retries, or package defects produce a specific blocker and resumable checkpoint—not a completion claim. State what is missing and who must act. Do not retry unchanged failures indefinitely.

## 6. Review the actual video

At `needs-playback-review`, open the current `final.mp4` and perform both named passes in `quality.json`:

1. `uninterrupted-playback`: watch the full video, with audio when directly perceptible; otherwise uninterrupted visual playback plus technical audio checks.
2. `caption-camera-character-inspection`: inspect framing, orientation/separation, mouth/blink/emphasis motion, captions, and cameras against the approved plan.

Read every current `blindReview.criterionRules` entry and its matching criterion text. Author a playback record containing:

- `schemaVersion: 2`, current `mp4Sha256`, **`renderIdentityHash`**, `qualityPolicyHash`, and `rubricVersion`;
- `reviewer`, visual/audio `perception` modes and bases;
- both named `passes` with actual completion and observation notes;
- every criterion exactly once with `id`, `status`, and `note`;
- explicit `disclosures`.

Read current identities from `quality-report.json` and the rubric; runtime verification checks them against the actual media/environment. Do not reuse observations from a different render identity even if its MP4 bytes happen to match.

Only mark assessments performed. A contact sheet, sampled frames, playback counter, or FFprobe result is not by itself uninterrupted playback or proof of perceived sound. Required **direct visual**, evidence, and technical-audio checks must pass. Only policy-permitted **perceptual-audio** criteria may be `unscored` when direct sound perception is unavailable, with a reason and disclosure. Disclosure never excuses a required failure.

```sh
node runner.mjs record-playback-review --run=<id> --input=/absolute/playback-record.json
node runner.mjs run --run=<id>
```

Records are attestations; software cannot authenticate chat, prove perception, or prevent an unrestricted agent editing files. Never manufacture review results to pass validation.

## 7. Verify export and show the video

After current technical/playback evidence passes, `run` finalizes and verifies an export, defaulting to `outputs/<run-id>/`. Use `export --run=<id> --output=/absolute/output-directory` for another destination. Unrelated or changed existing destinations are refused; choose a new folder rather than deleting user files.

The public bundle contains the MP4, local viewing page, sanitized review summary/contact sheet, and checksums. Source/review WAVs are excluded unless the user wants `--include-review-media`. Raw downloader metadata, original source video, credentials, machine paths, and original hash-bound evidence stay private; presentation copies do not rewrite canonical records.

Run `status --run=<id> --json`, then show the actual exported MP4 with review status and permitted limitations. `complete` means the current finalized export verifies—not that the user received or watched it. Missing or changed exported files invalidate completion.

`upgrade-run --run=<old-id> --new-run=<fresh-id>` preserves legacy history but requires a newly displayed expanded review, fresh approval, and new render/quality evidence. Never manufacture upgraded approval or playback receipts.

## 8. Multi-Platform Social Distribution (Optional)

When an episode is rendered and approved, the agent can distribute it across YouTube Shorts, Instagram Reels, TikTok, and X via the packaged `runtime/publish.mjs` CLI or connected Buffer MCP tools:

1. **Author platform-tailored copy in `inputs/distribution.json`:**
   - **YouTube Shorts:** Punchy title (≤100 chars), categoryId (`15` for Pets & Animals), duration ≤60s.
   - **Twitter/X:** Strong hook with viral hashtags (≤280 chars total).
   - **Instagram Reels:** Engaging caption with tags, strictly vertical (9:16).
   - **TikTok:** Engaging caption with trending tags (≤2200 chars).

2. **Probe the release before publishing (`--dry-run`):**
   ```sh
   node runtime/publish.mjs --dry-run inputs/distribution.json <path-to-mp4>
   ```

3. **Obtain explicit user approval:**
   - Present the copy and selected platforms to the user.
   - **Never dispatch live to social media without explicit human sign-off.**

4. **Live dispatch and receipts:**
   - If `BUFFER_API_KEY` is provided, dispatch live via Buffer MCP or CLI.
   - If unconfigured, the runtime validates assets and logs a graceful `unconfigured_environment` receipt.
   - Durable receipts are saved to `<video-path>.distribution.json`.

## Behavioral Guardrails
- **Human in the Loop:** Never publish without explicit confirmation from the user.
- **Probe First:** Always validate media format and character limits before dispatching.
- **Zero Token Leakage:** Never print or store API keys in repo files or receipts.

## Fixed animation and authoring rules

- Start the timeline at zero and finish at measured audio duration. Schema 1 retains 20 ms boundary tolerance; new drafts use exactly shared boundaries. The review exposes discrepancies.
- Each active beat contains words in `caption` **or** a named nonverbal `vocalization`, never both. Silence uses `speaker=none`. Separate audible reactions. Keep delayed questions, internal pauses, elongated delivery, and trailing words with the real speaker without swallowing the next speaker's first word.
- Cameras are only `two-shot`, `cat-close`, or `bunny-close`. Captioned overlap sets `captionSpeaker=cat`, `bunny`, or a genuinely synchronized `both`.
- Neutral talking changes mouths only. Optional `bounceAt` offsets request sparse emphasis: normally one bounce, two only for an intentionally frantic line. No manual blink/lip-sync/viseme cues.
- The official renderer measures the audio envelope, holds slow sounds, closes sustained pauses, suppresses mouth jitter, and supplies independent deterministic blinks. Do not replace those systems.
- Keep a complete line in `caption`; the renderer creates progressive one-to-three-word chunks below faces and above the label. Vocalizations are review/animation evidence, not caption text. Word-aligned caption rendering is not added here.
- Animation uses packaged assets and local computation, with no AI image/video/voice API calls or dedicated GPU requirement. This does not promise free coding-agent access, internet, or hardware.

Use `npm run convert` only for an operator-supplied Harmony project; normal episodes keep the existing PNGs. Read `PACKAGING.md` for release archives and acceptance boundaries. A built ZIP is not fresh-agent or supported-platform certification.
