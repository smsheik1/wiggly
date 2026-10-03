# Final fresh-package offline debug audit

Result: PASS for audited offline operator/debug mechanics. The original concrete recovery blocker is fixed. No remaining blocker was found in this audit scope.

Corrected archive: /Users/shaz/.codex/worktrees/2f6f/wiggly/v3/public/format-repositories/my-pixar-story-v1/my-pixar-story-v2.0.0.tgz

Corrected SHA-256: 3f7925f9656e62e0265f87bcd23c7658b25365117ecd7798160ef870d618ab04

Original SHA-256: 2bde4f40031cda9c9f948c1f308a776c6fb29d838a5a933d8ccfa9b70ab9ba5b

Corrected archive extracted fresh into /tmp/wiggly-blind-debug-final.4kcls1. The packaged AGENTS.md was reread; SKILL.md was confirmed byte-identical to the original fully read packaged skill. Package-lock.json is byte-identical by cmp. Reused the original audit's task-owned npm-ci dependencies via node_modules symlink to /tmp/wiggly-blind-debug.PDaYh3/node_modules. No sibling app runtime or source dependencies were used. Node v26.8.1.

## Corrected-package verification

- npm run check: PASS. See audit-check.log. Package renderer contract and dependencies load; ffmpeg/ffprobe/tar found; credentialsRead:false.
- npm run smoke: PASS. Two persistent parent/grandparent answers/script and audio-first isolated fixtures. See audit-smoke.log.
- node --test tests/debug-mode.test.mjs tests/codex-host.test.mjs: 18/18 PASS (9 debug, 9 host). No skipped/cancelled tests. See audit-tests.log.
- Five independent audit-probes.mjs checks: PASS. See audit-probes.log and task-owned probe receipt folders.

Original package additionally passed 17 requested tests and 43 existing exact-gate/flow tests. Those 43 were not repeated against the corrected archive because changes were limited to completion verification and debug job-id pausing; focused corrected regressions and independent probes cover both changes.

## Original failure and fixed reproduction

The original archive stored a valid-schema backgroundBrief worker response with one nonexistent optional reference as completed before verifySubmission checked actual file bytes. verifyFiles(event.content) then threw ENOENT. After the error pause and genuine continuation, repairInvalid:true repeatedly reused that invalid completed result and never called the worker for repair (worker calls stayed 1). Report and original evidence remain at /tmp/wiggly-blind-debug.PDaYh3/BLIND-AUDIT.md and /tmp/wiggly-blind-debug.PDaYh3/probe-receipts-1791068861700/2ac3f2cf4b996e5731314e746275fdf762d9b3dd1e43b875b0e2dd1c7cf7b288.json.

Rerunning the same authored missing optional-reference scenario on the corrected archive now:

1. Actual file validation fails, preserves the finished event/error as status:rejected, keeps the task ID, and pauses debug.
2. repairInvalid:true while paused completes zero work and adds zero calls.
3. A simulated explicit human continuation in the isolated fixture permits exactly one repair call. The worker returns references:[], actual validation succeeds, receipt becomes completed, and the batch stops paused at the independent review gate.

Total calls are 2 (bad finished result + one repair). Evidence: probe-receipts-1791069173510/2ac3f2cf4b996e5731314e746275fdf762d9b3dd1e43b875b0e2dd1c7cf7b288.json plus its retained rejected-attempt receipt.

Historical recovery was tested using an unchanged copy of the genuine original completed-bad receipt in an explicitly isolated fixture. The corrected driver revalidates and classifies it rejected without dispatching a worker; after human continuation, one bounded repair succeeds and pauses. Evidence: probe-historical-1791069173530/2ac3f2cf4b996e5731314e746275fdf762d9b3dd1e43b875b0e2dd1c7cf7b288.json. No original receipt, checkpoint row or approved asset bytes were edited.

## Other independent probes

- Async submission boundary: exact authorized video fixture -> debug-next -> begin -> job-id now ends submitted / collect / debug enabled:true paused:true. Original package ended paused:false. No provider call was made; only protocol events were tested.
- Safe collection: real local isolated test-tone bytes + cached clone subrequest recover while debug is paused. Fake network handler was called zero times. Receipt leaves job ready and debug paused.
- Exact spending and narration gates: debug continuation cannot begin an unauthorized planned video; wrong exact request digest cannot authorize; early visuals remain blocked before narration lock. Zero real provider calls.

The 18 passing focused cases independently retain human-only debug control, persisted mode/task IDs, one output per batch, rejected-output stop, malformed-result bounded repair, uncertain outcome non-repeat, paused worker/provider/render refusal, saved submitted-job collection, scoped host tools/model/profile binding and completed-result recovery after checkpoint failure.

## Scope and remaining limitations

No real API calls, actual Codex model dispatch, credential reads or AI media generation occurred. Test tones are explicit isolated local fixtures. No source or shared docs were modified. Browser validation was unnecessary for these CLI/runtime changes; film render refusal was tested before side effects. This does not prove live model perception, media quality, paid-provider entitlement, calibrated speaker similarity or an actual production movie. Existing truthful human approvals and exact spend authorizations remain required.

Audit-only files and dependencies are retained for reproducibility; cleanup may remove only these task-owned /tmp folders when no longer needed.
