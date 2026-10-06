# Leo packaged instruction audit

Verdict: **PASS for packaging, canonical task loading, quote binding and snapshot/lock protocol; instruction consistency has two input-schema caveats below.** This is not storytelling qualification or a clean-install proof.

## Artifact and environment

- Archive: `my-pixar-story-v2.0.0.tgz`
- SHA256: `747b6d2efe50f2e7d056080c37a38d7e91a564a70925584cd6156bd8ef3c5c3f`
- Fresh extraction: `/tmp/wiggly-leo-package-audit.ohOotz`
- Packaged Leo skill SHA256: `b997a2a164853cffe2b421f7006685e68d70af8fb9c2a287512bd55bcd9831d6`
- Loaded studio SHA256: `80f750e9ff8edc45fba3d075140a60d2e001b6a2c3cab260b2752828420ce54d`
- Node: `v26.8.1`; ffmpeg, ffprobe and tar available.

## Commands and results

All operational commands ran from the fresh extraction.

```sh
cmp package-lock.json /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/package-lock.json
ln -s /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/node_modules node_modules
npm run check
npm run smoke
node --test tests/studio-instructions.test.mjs tests/grounded-writing.test.mjs tests/review-grounding.test.mjs
```

- Lockfile comparison: exact byte match, exit 0. Lockfile SHA256 `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`.
- Check: exit 0; current version/studio loaded, dependencies and required local tools available; `credentialsRead:false`.
- Smoke: exit 0; parent/grandparent isolated persistent answers/script/review/human loops and audio-first gates passed; no model, media-generation or credential calls.
- Scoped tests: **19/19 pass**, 0 failed/skipped/cancelled, exit 0. No full-suite rerun.

## Verified protocol

Both answers and script route to Leo's project-pinned `crew/leo/SKILL.md`; independent review receives Sage plus the separate pinned text rubric. Canonical task validation rejects changed/omitted skills, source bindings, dependencies, directions and tools before dispatch. Tests cover exact immutable source binding and refusal of unconfirmed answer substitution; meaningful factual truth still requires independent text review.

The grounded-v1 gate rejects altered/unbound quoted words, absent source fields, missing answer citations and malformed quotes. Faithful unquoted paraphrases remain allowed. Quote matching explicitly proves wording only, leaving attribution and facts inconclusive without review.

SQLite restart retains prior snapshots, model/tool choices, recipes and limits after editable-template changes. Historical policy snapshots stay historical. Explicit human writing refresh is restricted to Leo/text rubric before script lock/media, preserves approved answers, draft, earlier review and retry count, and forces fresh review. Post-lock refresh and stale passing-verdict approval are refused.

## Genuine instruction/schema caveats

1. `crew/leo/SKILL.md:15` says a blank optional answer is fine. `runtime/contracts.mjs:6,13` uses trimmed nonempty strings for every present answer field. A local isolated probe added `optionalAuditField:""` to the public parent example; Inputs rejected it as too_small. Omitting an optional field can work, but the instructions do not define that representation. A supplied blank therefore fails before Leo can mark it skipped.
2. `crew/leo/SKILL.md:10` promises wording exactly as supplied. `initialProject` parses Inputs using trim. An isolated probe wrapped one source answer in two leading/trailing spaces: supplied length 96, stored length 92, raw equality false, task binding to stored source true, substantive wording unchanged. Source preservation is exact after schema normalization, not byte-exact raw questionnaire preservation.

Neither caveat silently changes an existing project lock. They limit a blanket claim that the new wording is fully compatible with every raw intake representation.

## Limits

Dependency reuse was explicitly allowed only after lockfile byte comparison; no npm ci or clean-install proof. Only extracted packaged instructions/runtime/tests and public synthetic examples were inspected or operated. No source-tree implementation inspection/mutation, real run data, production checkpoints, secrets, providers, model-generated story, live production, audiovisual qualification or full film rendering. Passing protocol fixtures do not establish Leo's semantic storytelling quality or factual judgment.

## Maintainer final package recheck (not independent)

The audit findings prompted a narrow wording correction: Leo now preserves the canonical version-bound sourceInputs and leaves unanswered optional subprompts omitted; he must not insert blank strings or invented skipped memories. Inputs/schema normalization itself is unchanged. Entirely absent/empty answer sections remain a separate intake-contract limitation recorded in the crew review checklist.

The independent worker hit the account usage limit on its final recheck; no substitute independent verdict is claimed. The maintainer extracted the final archive afresh, compared exact lockfile bytes before reusing dependencies, and passed check, smoke and the same 19 scoped tests. This is not a clean-install or semantic storytelling proof.

Final SHA256: da34df6fc7f2e0b955d42a8b567e551521ad0f856aa66eef336df787420448f9

Final extraction: /var/folders/y_/pb62snr9069bqz1wlj8lj9lc0000gn/T/memoir-leo-final-package-b90446qw

Official packaging checks: 123 pass; existing source focused checks: 28 pass plus Codex bridge's 14 pass (overlapping sets, not additive). No named tests were added. quick_validate.py could not run because PyYAML was unavailable in both installed/bundled Python; the simple two-field frontmatter was checked directly and the runtime bundle/task loader validated. Ponytail review: lean already; no new dependencies, runtime, tool permissions or state store. No real providers or production-state changes.
