# Blind package audit: Codex tool host

Date: 2026-10-05. Outcome: free checks and focused isolated tests pass; the packaged launch configuration preserves the required Code Mode host while disabling the listed ambient capabilities. Live host execution remains unverified by this audit.

## Scope and provenance

- Only the archive `/Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz` supplied runtime, instructions, contracts, and tests.
- Archive SHA-256: `d712a18992d39116c1ac4ab4b95cc2a427dec924e8062a21fd2f487de8938906`.
- Fresh extraction: `/tmp/wiggly-tool-host-review.zem9km`.
- Read packaged `AGENTS.md`, `SKILL.md`, `README.md`, `requirements.json`, `quality.json`, `scene-contract.json`, `pipeline.json`, `studio.json`, host implementation and focused tests. The packaged instructions require the official runner, pinned contracts, actual human decisions, role-scoped tools, no fabricated review, and no fallback after external failures.
- Source runtime files were neither inspected nor edited. The sole source-side dependency exception was its package lock and existing installed modules. An initial `rg --files` package-lock inventory exposed paths, not source code.
- No credentials were opened, read, copied, or supplied. No live Codex crew, live provider metadata check, provider request, production run, media generation, browser download, or package download was performed. Focused broker tests generated only explicit isolated local synthetic fixtures with FFmpeg; these are mechanics tests, never production media or qualification evidence.

## Actual commands and results

The commands below ran successfully (exit 0), unless noted otherwise. Package-relative commands used the fresh extraction as their working directory.

```sh
mktemp -d /tmp/wiggly-tool-host-review.XXXXXX
tar -tzf /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz
tar -xzf /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz -C /tmp/wiggly-tool-host-review.zem9km
node --version
cmp package-lock.json /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/package-lock.json
shasum -a 256 package-lock.json /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/package-lock.json /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz
ln -s /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/node_modules node_modules
npm run check
npm run smoke
node --test tests/codex-host.test.mjs tests/crew.test.mjs
```

`node --version`: `v26.8.1`, satisfying packaged Node >=22. `cmp` reported no difference. Both dependency lockfiles have SHA-256 `dfc90fb3e3c019eb8d08c3f59e81d3cedab42466d1608e5fe57abf1203e4fb56`. The symlink was created only after this exact match; `npm ci` was unnecessary and was not run.

`npm run check`: exit 0. LangGraph/SQLite loaded, ffprobe/ffmpeg/tar available, packaged renderer hash verification succeeded, `credentialsRead:false`. Renderer reported `remotion-entry/RemotionAdScene.tsx → AdRenderSurface → memoir-film`. Studio snapshot SHA-256: `6aa725cf89906076ce82ed021d6efce30030e7c158111402bf1099face2d2fe9`.

`npm run smoke`: exit 0. Parent and grandparent examples passed persistent answers/script author-reviewer-human loops, SQLite restart, and audio-first gates. Output explicitly states `FREE SMOKE PASS. No model, media-generation or credential calls.` All approvals were labelled isolated fixtures.

Focused test command: exit 0; 23 tests passed, 0 failed, 0 skipped, 0 cancelled. Duration reported 2969.514209 ms. Fourteen tests were packaged Codex-host tests and nine were packaged crew/broker tests.

## Launch and scope findings

Packaged `runtime/codex-host.mjs:13–25` launches:

```text
codex app-server --stdio
  --enable code_mode_host
  --disable shell_tool
  --disable unified_exec
  --disable apps
  --disable plugins
  --disable multi_agent
  --disable code_mode
  --disable browser_use
  --disable computer_use
  --disable view_image
  --disable image_generation
  --disable in_app_browser
  -c web_search="disabled"
```

`code_mode_host` is enabled independently of the optional `code_mode` feature. The source comment identifies it as the local host needed to execute registered scoped function tools. The focused launch regression explicitly checks `--enable code_mode_host`, the listed ambient features (except `code_mode`, which is confirmed by source inspection), read-only sandbox, exact selected model with no provider-model fallback, and registered `wiggly_tool`.

At thread start (`runtime/codex-host.mjs:79`), workers use `approvalPolicy:'never'`, `sandbox:'read-only'`, `environments:[]`, and one dynamic-tool definition named `wiggly_tool`. Its strict schema accepts only name, asset hash, and nullable reference hash. It exposes no arbitrary path field. The callback requires the exact active thread and turn plus the tool name (`runtime/codex-host.mjs:53–61`). Unexpected host request methods are refused; fatal external tool failures reject the host turn.

The format broker (`runtime/crew.mjs:39–59`) intersects allowed task methods with the role permission ceiling, accepts only hashes belonging to the current task, and verifies file bytes before access. Configuration can narrow role permissions but cannot expand them (`runtime/instructions.mjs:7–11`). Unavailable perception remains an error/inconclusive capability; no synthetic production fallback is supplied. Workers can return only their assigned event; human approval, state writes, and provider execution are unavailable through the broker.

The passing tests exercise unknown-asset denial, write and generation-tool denial, reviewer-role denial, exact worker authority, actual-tool evidence requirements, natural audio measurement provenance, model/profile mismatch stops, provider-error stops, stale turn handling, bounded dispatch, SQLite gates, partial crew startup, completed-result recovery, and refusal to repeat uncertain turns. Allowed scoped image inputs bind their hashes and travel as native image inputs.

No blocking launch/configuration issue was found within this static and isolated-test scope.

## Limits

- No real `codex app-server` process or worker turn ran. The host tests inject an in-memory transport and override capability-profile lookup. They establish requested flags and protocol/broker behavior, not that the installed CLI/backend executes a successful live `wiggly_tool` call or exposes only this tool at runtime.
- Ambient feature flags are inspected and covered by the launch regression; live host inventory, globally configured connectors/MCP servers, operating-system isolation, and effective CLI sandbox enforcement were not audited. The package itself discloses a trusted local host-adapter boundary rather than a general OS sandbox.
- Reused dependency modules match the lockfile requirement but no clean install or native-addon rebuild was performed.
- The entire test suite, live providers, live media perception, reviewer qualification, production film quality, and end-to-end real-media finalization were outside scope. Synthetic fixtures do not establish any of these.
- This report does not authorize production work, provider spend, human approvals, or a crew refresh.

## Final expanded archive follow-up

The root agent subsequently fixed a real false mismatch between spoken “eight” and ASR “8”, rebuilt the package, and passed 45 focused source cases plus the 109 official package checks. The requested fresh-agent follow-up on this expanded archive could not start because the ChatGPT worker usage limit was reached. The earlier audit above applies to its recorded earlier archive only; it is not an independent audit of the final expanded archive. Final hash and actual live reviewer evidence are in the adjacent release JSON. No provider retry or media generation followed the usage limit.
