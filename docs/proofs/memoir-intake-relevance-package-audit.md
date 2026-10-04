# Focused blind package audit: intake relevance

Result: PASS for offline instruction delivery, persistence, and approval-gate mechanics. Live model relevance judgment was not evaluated.

Executed archive: /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz
Archive SHA-256: `90df7d2099ddad377520f885d9649f769995c753f7210e26ef42e31f2c1b4538`
Fresh extraction: /tmp/pixar-intake-blind-l75hp8o6
Source HEAD used only for unchanged-gate comparison: `878da0508fd732e3b1a6791254ed7027ad8fd61b`

Dependency reuse: extracted `package-lock.json` was byte-identical to source lock (SHA-256 `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`). Reused installed source `node_modules` through a symlink after that comparison. This is **not a clean-install proof**. All runtime, instructions, tests, public example fixtures and compiled renderer read for the proof came from the extracted archive.

Executed checks:
- `npm run check`: exit 0; Node v26.8.1, ffmpeg/ffprobe/tar found, LangGraph + SQLite loaded, credentialsRead false.
- `npm run smoke`: exit 0; public parent and grandparent fixtures each passed persistent answers/script author/reviewer/user loops and audio-first gates.
- `node --test tests/studio-instructions.test.mjs tests/refined-flow.test.mjs tests/debug-mode.test.mjs`: 26 passed, 0 failed, 0 skipped.
- Independent generic audit (`/tmp/pixar-intake-independent-audit.mjs`): exit 0. Constructed a pre-policy template and synthetic public-example project, persisted it in SQLite, edited both templates, reopened the database, and verified both old author and old reviewer packets retained pre-policy instructions. Fresh projects received the new relevance policy in Leo's skill and Sage's independent text rubric.

Verified behavior:
- Only missing facts needed to understand or stage the story block intake; optional anecdote prompts may remain unanswered. Both role packets deliver this rule. The reviewer rubric also tells Sage to reject unnecessary blocking commonSenseChecks with a localized repair.
- Pinned instruction document hashes and studio bundle hash bind task packets. `prepareCrewTask` rejects replaced/omitted/stale context and supplies the rubric from the project snapshot.
- Human actor, exact artifact/digest, explicit confirmation, voice consent, nonempty person/age inventory, photo rights, guardian authority for minors, measured still references and await-reference refusal remain enforced. Independent isolated checks exercised these rejection paths. Interpret/omit decisions remain supported by the unchanged contract; the policy does not remove their human gates.
- Runtime workflow/contracts/crew/instructions, questionnaire, quality, requirements, scene contract and studio config are byte-identical to source HEAD. The scoped source diff consists of the role-specific policy paragraphs and a guardrail test; it does not change consent, reference, approval, debug or provider authority.
- `upgrade-studio` remains human/pristine-only. Existing active bundles do not adopt editable instructions. Historical no-snapshot compatibility remains covered by the focused suite.

Evidence scope: these checks prove instruction delivery and deterministic gate/persistence mechanics. Mocked structured reviewer passes and isolated test-provider responses do not demonstrate a live model's semantic judgment, real media quality, perceptual capability, genuine human approval, or reviewer qualification. No live worker, provider API, credential file, AI media generation or private real run/story was read or executed. Only packaged public examples and isolated local fixtures were used. No broader suite was run.

Ponytail review: the separate author skill and independent reviewer rubric each need the policy because they are delivered to different roles. The focused guardrail assertion is useful; no new abstraction, dependency, state or runtime path was introduced. `net: -0 lines possible.` **Worthiness Verdict: NOT WORTH IT (Lean already). Lean already. Ship.**

Log files and SHA-256:
- `/tmp/pixar-intake-audit-logs/check.log`: `14cf08de95b64f6933f602b819d4d7aea56b45f794bfd3c7ff6bb2ae1aadb05d`
- `/tmp/pixar-intake-audit-logs/focused-tests.log`: `b7491107cc4ed3aaa2ba0466cf8ad7c7967f97e0887944d0011d4a4ff9ef330f`
- `/tmp/pixar-intake-audit-logs/gate-baseline.json`: `39fe18f03f193eaf72b599f445337fa3e7581c03d59a0cddec94aed3392f71d9`
- `/tmp/pixar-intake-audit-logs/independent-audit.log`: `1ceaeab46612489c7983c4250cd438a525285f50b74c94228c01203620c0904c`
- `/tmp/pixar-intake-audit-logs/smoke.log`: `8bc67a1393cddcce9322463f3903f543fa2891f6c416fa057450b5340db405d2`

Executed member inventory excluding only proof.json: `/tmp/pixar-intake-executed-package-inventory.json`. Retained extraction permits exact final-package byte comparison if proof metadata is repacked.

Final metadata repack verification: 147 packaged files match the executed member inventory exactly, excluding only proof.json. Final archive SHA-256: `570f5a0878fa2d3d678a5c88af43583b9d03b502bc3e1393c6d8a9c7dd4a3e74`.
