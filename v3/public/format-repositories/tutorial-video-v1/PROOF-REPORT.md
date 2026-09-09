# Tutorial Video 0.3.0 proof report

## Failure addressed

Version 0.2.0 accepted a finished `sourceVideo` and only re-encoded it. A fresh
agent therefore had no executable visual grammar and could substitute a generic
slide deck. Version 0.3.0 rejects `sourceVideo` and ships the actual compositor,
validator, grid assets, examples, and inspection tooling.

## Runtime proof

`runtime/tutorial-video.jsx` renders the retro grids, macOS window chrome,
numbered step badges, neon checkpoint cards, timed captions, native-result
frames, and progress rail. `runtime/contract.mjs` requires editable ingredients
and verifies media authorization, provenance, path safety, duration, and
timeline structure before rendering.

Two meaningfully different inputs were rendered without changing the runtime:

- `examples/batman-arkham-first-run/input.json` produced a 40.981-second
  Batman Arkham Conversations tutorial.
- `examples/animal-conversations-compositor/input.json` produced a 23.787-
  second Animal Conversations tutorial.

Both are 1920 × 1080, 30 fps H.264/AAC, contain audio, carry input/runtime/output
hash receipts, and report `providerCalls: 0`. Their contact sheets visibly show
the packaged signature features. Automated inspection cannot judge narration
intelligibility or perceived sync; complete human audiovisual approval remains
an explicit finalization gate.

A context-free agent then received only a clean extracted 0.3.0 download and
the Batman request. After the package's preflight identified the required local
Remotion browser/port permission, the agent validated, rendered once, and
inspected successfully without accessing the source checkout, network, or any
provider. See `evidence/blind-agent-run.json`.

## Reproduction

```text
npm ci --ignore-scripts --no-audit --no-fund
npm test
node runner.mjs validate --input=examples/batman-arkham-first-run/input.json
node runner.mjs render --input=examples/batman-arkham-first-run/input.json --output=/tmp/tutorial.mp4
node runner.mjs inspect --input=/tmp/tutorial.mp4 --report=/tmp/tutorial-report.json
```

Local Remotion/FFmpeg rendering and all included evidence used zero paid model
or media calls. A real run remains $0 in provider cost when the user supplies
the permitted captures, narration, and result video; coding-agent usage and any
separately approved asset generation are outside this runtime.
