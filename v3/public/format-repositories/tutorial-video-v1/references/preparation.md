# Ingredient preparation

Use this order for a new target. Keep the conversation short and keep all
technical detail in the run receipt.

1. Ask one question only when the target Format is not known: **Which Wiggly
   Format should this tutorial teach?** Read its public page and package before
   asking anything else.
2. Find the target Repo's finished proof. If it is not present locally, use the
   permitted public page or a user-supplied file. Do not invent a result or ask
   the user to make screenshots or timestamps.
3. Capture the real workflow: the Format page and the coding-agent/terminal
   action that copies, runs, and checks the Repo. Use the host agent's browser
   or recording capability and record the source and authorization.
4. Write short action-led narration that matches the captured actions. Use the
   same target name and avoid filler. Show the finished result first, then the
   path to reproduce it, then a visible checkpoint.
5. For new narration, make an estimate first and run the packaged Fish path
   with model `s2.1-pro-free`. Set `FISH_STUDIO_APIKEY` or `FISH_API_KEY` in the
   environment; never paste the key into a file or chat. `runtime/voice.mjs`
   and `runtime/narrate.mjs` measure each audio file and derive caption timing.
   They stop on Fish errors and never retry with a paid model or an OS voice.
6. Put only authorized, editable ingredients under `media/runs/<run-id>/` and
   write their provenance into the input. A finished tutorial master is not an
   input; the official compositor creates the master.
7. Validate before rendering. Render once, inspect the contact sheet and full
   audiovisual output, and make at most two corrective renders for observed
   problems. Stop with the receipt if a required tool or key is missing.

## Offline path

`npm test` and `runner.mjs make --dry-run` use supplied fixtures and make zero
provider calls. They prove contracts and timing without pretending that a real
new narration was generated. A real `runner.mjs make` run requires Fish Audio
credentials and emits a zero-cost provider receipt for `s2.1-pro-free`.
