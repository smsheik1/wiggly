# Proof report

## Scope

This proof packages the recovered Animal Conversations tutorial workflow as a
standalone Tutorial Video Wiggly Repo. The target is a narrated and captioned
16:9 first-run walkthrough: choose a format, send it to a coding agent, get a
finished video.

## Recovered learnings

- Show the finished result before explaining the recipe.
- Make the source-to-result transformation obvious and use plain beginner
  verbs.
- Show a real `Send to Coding Agent` handoff and distinguish a computer-capable
  coding agent from a normal chat.
- Teach URL-to-local-media preparation honestly: the host agent may use yt-dlp,
  FFmpeg, and local transcription; the format runtime consumes local assets.
- Keep speaker timing, overlap ownership, camera changes, captions, approval,
  render, inspection, and delivery as explicit checkpoints.
- Do not fake automatic voice identity, diarization, permissions, or paid
  generation. Show the cost/time receipt and stop for approval.
- Inspect the complete audiovisual result and bind the receipt to the output
  hash; metadata alone cannot prove intelligibility or perceived sync.

## Commands run

```text
npm ci
npm test
npm run smoke
node runner.mjs render --input examples/animal-conversations-first-run/input.json --output examples/animal-conversations-first-run/final.mp4
node runner.mjs inspect --input examples/animal-conversations-first-run/final.mp4
```

## Acceptance status

The offline contract, local tool check, smoke render, package-produced example,
media metadata, hash receipt, and ZIP parity are checked by `scripts/verify.mjs`.
Direct playback is still a human responsibility; this report does not claim a
machine can judge narration intelligibility.
