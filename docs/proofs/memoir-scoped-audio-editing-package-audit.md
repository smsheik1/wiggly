# Scoped narration editing — blind package audit

2026-10-05. Fresh package agent audited the extracted archive using its instructions only, without providers, credentials or real media. Final archive SHA-256: `f1b7b76f3d36357f42c0ec51567a109de21c965845455684f039f5fda9118fed`.

Initial audit passed check, smoke and three audio-edit cases, and found two concrete gaps: the archive needed explicit stored-tool-schema migration instructions, and raw FFmpeg drafts inherited 0644 permissions. Both were corrected and the archive rebuilt.

Final follow-up extracted to `/tmp/wiggly-blind-audio-final.gHQDwQ`, compared exact package-lock bytes before reusing installed dependencies, and passed `npm run check`, `npm run smoke` and `node --test tests/audio-edit.test.mjs` (3/3). A separate isolated fixture confirmed audio-edits/task/digest directories are 0700 and raw edited/window WAVs plus plan/result files are 0600. The archive hash stayed unchanged through the audit.

Packaged SKILL instructions now explain that dynamic tool schemas are stored at thread creation, require a fresh unused editor with the same model and retained startup receipt, then explicit crew configuration. Reviewers and historical evidence stay preserved. The package explains immutable originals, unaffected sibling stems/locks, source listening and inspection, full draft listening, independent review, human approval and bounded attempts.

Initial archive inspection found no credentials, checkpoints, installed dependencies, symlinks or traversal members. The initial clean npm install required the documented better-sqlite3 install script because the host skipped unapproved dependency scripts. Final dependency reuse is not a clean-install claim. Final audit covered the changed module, its tests, instructions and proof metadata; actual native adoption was separately checked by the parent agent. No audit proves natural real-audio repair or end-to-end film quality.
