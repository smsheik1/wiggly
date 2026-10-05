# Audio investigation gate — blind package audit

2026-10-05. Initial archive inspection passed check, smoke and 11 targeted audio-edit/STT cases. It found a real gap beyond those tests: an untimed successful transcription could support an editing-infeasible Event despite instructions requiring word timing. A synthetic fixture reached escalate with no word timestamps.

The corrected final archive SHA-256 is `294bd6eedfc78ad263c512b6ae26a67a92829122e8fd79a56f2a187d82749501`. A fresh extraction at `/tmp/wiggly-blind-audio-gate-final.4lBNgz` passed `npm run check`, `npm run smoke` and all 11 cases in `tests/audio-edit.test.mjs` and `tests/cartesia-stt.test.mjs`. Installed dependencies were reused only after exact lockfile comparison; this is not a clean-install proof.

An independent untimed probe now throws STT_WORD_TIMING_UNAVAILABLE with stopDispatch=true before any infeasibility verdict; the project stays narration/author. Graph validation separately rejects untimed forged investigation. Audio-reviewer behavior remains unchanged.

Other requested boundaries passed: rejected-editor STT scope; current hashes/time bounds and overlong-beat inclusion; successful full source listening; captured tool outputs replacing worker-written evidence; essential tool failures stopping native dispatch; timed pronunciation cuts; history evidence and human repair feedback. No source edits, provider calls, production credentials or real media were used by the auditor.

The parent separately retried the real editor. That proved source STT and two local draft renders, but a distinct listening-report endpoint mismatch interrupted the worker before a final artifact Event or independent approval. This audit does not establish real audio quality or end-to-end film completion.
