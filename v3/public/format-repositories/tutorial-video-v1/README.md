# Tutorial Video v1

Tutorial Video turns one real Wiggly Format run into a proof-first, narrated,
captioned 16:9 walkthrough for a new user. The canonical example teaches the
Animal Conversations workflow: choose a format, send it to a coding agent,
approve the plan, and receive a finished video.

This is a local assembly kit, not an automatic video-understanding model. The
coding agent may use `yt-dlp` and local transcription before invoking the kit,
but the packaged runtime makes no paid provider calls and never invents source
audio, permissions, or character assignments.

## Quick start

```bash
npm ci
npm test
npm run smoke
node runner.mjs render --input examples/animal-conversations-first-run/input.json \
  --output /tmp/tutorial-video.mp4
node runner.mjs inspect --input /tmp/tutorial-video.mp4
```

`render` preserves the supplied tutorial master's natural duration. If
`durationSeconds` is included in the input, it is checked against the probed
source duration; the runner never accelerates, trims, or stretches the master.
Captions are expected to be burned into the supplied master; the runner does
not create captions from unreviewed speech.

## The agent loop

1. Confirm the user owns or is permitted to remix the reference and tutorial
   media.
2. Inspect the reference and write an evidence-backed blueprint, separating
   observations from assumptions.
3. Choose the format, send the exact Wiggly handoff to a computer-capable
   coding agent, and let it acquire local media with `yt-dlp`/FFmpeg when
   needed. A regular chat cannot run this local workflow.
4. Show the source, result, package contents, cost/time receipt, and proposed
   step list. Ask one short question at a time.
5. Require explicit approval of speaker assignments, captions, timing, and
   permissions before rendering. Transcription and diarization are proposals,
   never approval.
6. Render locally through the official runner, inspect the complete MP4 and
   contact sheet, and deliver the exact file plus hashes.

## Paid-call gate

There are no providers in this kit. If a fresh run would call a paid model or
media service, stop and show the user the estimate; continue only after their
explicit approval. Supplied media and local rendering remain the zero-provider
proof path.

## What is proven here

The included example is the recovered Animal Conversations tutorial master,
produced from the real Wiggly workflow and its QA receipts. The package proves
repeatable local assembly, 16:9 H.264/AAC output, captions carried by the
master, and the beginner-friendly handoff grammar. It does not claim that the
runtime itself downloads a URL, performs diarization, or generates voices.
