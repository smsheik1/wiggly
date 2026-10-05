# Blind packaged plain-producer audit

Result: PASS for wording and presentation. No release-blocking issue found. This is not a media-production or clean-install proof.

Date: 2026-10-05. Node: v26.8.1. Audit directory: `/tmp/memoir-plain-producer-package.n1J062`.

## Artifact and isolation

Only release inspected: `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz`.

Archive SHA256: `fa331746c7b42f09894097da88e924e5d07322bd469f8cff639007343d5d2ea4`.

The archive was extracted into a fresh `mktemp` directory. Inspected packaged AGENTS.md, SKILL.md, orchestrator-voice.md, crew/max/SKILL.md, README.md, runtime presentation code, and relevant packaged tests/helpers. No sibling production runtime, source tests, real project, or operator secrets were read. No production files were changed.

`cmp` returned exit 0 for the exact packaged package-lock.json versus the candidate kit lock. Lock SHA256: `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`. Only then was the existing matching kit node_modules symlinked into the fresh extracted directory. No `npm ci` was run: this is explicitly no clean-install proof.

## Commands and counts

Executed:

```sh
mktemp -d /tmp/memoir-plain-producer-package.XXXXXX
shasum -a 256 v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz
tar -xzf /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz -C /tmp/memoir-plain-producer-package.n1J062
cd /tmp/memoir-plain-producer-package.n1J062
cmp package-lock.json /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/package-lock.json
ln -s /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/node_modules node_modules
node --version
npm run check
npm run smoke
node --test tests/producer-handoff.test.mjs tests/debug-mode.test.mjs tests/codex-host.test.mjs tests/existing-voice.test.mjs tests/existing-voice-no-sample.test.mjs
node plain-producer-probes.mjs
node plain-producer-probes.mjs > /tmp/memoir-plain-producer-package-probes.json
shasum -a 256 package-lock.json
```

Check: PASS, credentialsRead=false; LangGraph/SQLite loaded; official renderer inventory/path checked. No credentials or provider/model calls.

Free smoke: PASS for both parent and grandparent. Each exercised isolated persistent answers/script author/reviewer/human loops, SQLite restart, and audio-first refusal gates. No media-generation, model or credential calls.

Focused tests: 57 passed, 0 failed, 0 skipped, 0 cancelled. Test-file counts:

- producer-handoff: 13
- debug-mode: 9
- codex-host: 13
- existing-voice: 10
- existing-voice-no-sample: 12

The focused suite uses isolated synthetic artifacts, fake provider keys and mocked HTTP/host transports. Those fixtures are test-only and are not real credentials, workers, creative approvals or generated assets. A sine-wave fixture is made locally by ffmpeg for broker mechanics. No external model/provider/network calls or real projects were used.

## Independent probes

Probe source: `/tmp/memoir-plain-producer-package.n1J062/plain-producer-probes.mjs`.

Complete output: `/tmp/memoir-plain-producer-package-probes.json`.

Built a new in-memory, explicitly ISOLATED revision-4 fixture using packaged event helpers. Fixture-only story approvals, existing-clone metadata, human debug controls and resolution events establish test states; they never touch a real run. A rejecting global fetch hook recorded zero attempted network calls. Each producerUpdate call was checked against a byte-for-byte JSON snapshot. Across every probe: zero provider jobs, $0 budget ceiling, no audition artifact/approval, unchanged approved-script bytes and clone bytes. No plan, authorization, spend reservation, generation or media approval was added by presentation.

Five probes passed:

1. Intentional debug inspection wait: next worker is waiting-for-debug-continuation; message says “Waiting for your debug check: inspect the last result”; next decision says continuation “approves nothing”; no STOP/blocker wording.
2. Account-readiness blocked audition: internal `stage` remains `audition`; customer-facing `stageLabel` and message say “Short sample using your cloned voice”; message begins `STOP — Short sample using your cloned voice is blocked.` It includes the canonical subscription URL and steps, says upgrade only if needed, does not infer a free plan is an API failure, and says no new generation started. No debug-wait message is appended.
3. Historical unstructured blocker: removing structured blocker help on the isolated fixture preserved the original raw evidence in both producer.diagnostic and completion.diagnostic. The customer message is a plain STOP/missing-information statement and does not paste technical diagnostics or invent help fields. Packaged orchestrator-voice.md explicitly requires the host to read that evidence and explain the reason and repair in plain language; SKILL.md likewise says never make the user decode the report. Historical diagnostics alone cannot mechanically generate a specific repair, so this host instruction is part of the proof.
4. Resolved while debug waiting: gate returns to produce, debug remains paused, Max is next to prepare the exact request. Message says “Max (Generation Planner) previously reported missing planning information.” It has no present-tense “is blocked” or STOP. Diagnostic remains separate for audit context; continuation remains a distinct inspection decision.
5. Resolved ready for dispatch: genuine fixture continuation changes worker status to ready-for-dispatch, clears debug wait wording, and retains historical “previously reported” wording without claiming a worker is running.

Probe correction: the first custom run had an overly broad `/HTTP/i` rejection which also matched the intended `https://` subscription URL. The audit-only regex was corrected to `/\bHTTP\b/i`; no package code was changed. Both subsequent complete probe runs passed. This was an audit assertion error, not a release failure.

## Findings and limits

The packaged producer distinguishes genuine planning blockers from intentional human inspection waits. Its customer messages translate audition while keeping internal stage IDs intact. Historical raw diagnostics remain separate and pinned communication instructions require host explanation. Resolution no longer describes Max as currently blocked. The focused suite additionally confirms human gates, bounded dispatch, existing-voice retention, and refusal to mutate/submit while debug-paused.

No live chat delivery, provider account access, entitlement, cloned-voice identity, perception quality, generated audio/video, production media or end-to-end film was proven. No browser validation was necessary: no rendered frontend or production source changed. Matching reused dependencies do not establish a fresh install.
