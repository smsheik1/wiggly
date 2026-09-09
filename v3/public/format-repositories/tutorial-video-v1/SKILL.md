# Tutorial Video Wiggly Repo

Use this skill when a user wants a new-user tutorial for a Wiggly Format.
The tutorial must show the finished result first, then the real path from
format choice to coding-agent handoff to approved local render.

## Required loop

1. Identify the source format and the audience's first successful outcome.
2. Gather only permitted source media and preserve its provenance.
3. Analyze the reference as evidence: result, promise, source, handoff,
   approvals, runtime, inspection, cost, and limitations.
4. Draft a short narrated storyboard with captions and a 16:9 safe area.
5. Show the user the exact handoff and ask for approval before any paid call.
6. Run `node runner.mjs check --input=<input.json>`.
7. Run the local render, inspect the MP4, and fix only evidence-backed issues.
8. Package the kit after two distinct editorial inputs pass the same runtime.

## Ground rules

- Lead with proof of the finished Wiggly result, not an abstract feature list.
- Use plain verbs: pick, send, approve, render, inspect, watch.
- Show what the user must provide and what the package supplies.
- Keep the coding-agent handoff real. Do not stage a fake regular-chat flow or
  pretend that a browser-only chat can operate a local repository.
- Treat `yt-dlp` HTTP 403 as access refusal, not proof that a video is missing;
  offer a permitted local file instead.
- Do not claim automatic transcription, diarization, voice identity, or role
  approval. The agent may propose a timed plan; the user approves every beat.
- Do not imply that the Wiggly runtime accepts a social URL when the host agent
  must resolve it and save a local file first.
- Keep cost and timing visible. Runtime provider cost is `$0` with supplied
  media; coding-agent usage is separate. Any paid generation requires an
  estimate-and-approval gate.
- Inspect the entire delivered MP4 with audio when possible. A passing hash or
  metadata check cannot prove intelligibility or perceived sync.

## Commands

```bash
node runner.mjs doctor
node runner.mjs check --input examples/animal-conversations-first-run/input.json
node runner.mjs render --input examples/animal-conversations-first-run/input.json --output /tmp/tutorial.mp4
node runner.mjs inspect --input /tmp/tutorial.mp4
npm test
```

## Multi-Platform Social Distribution (Optional)

When a tutorial video is rendered and approved, the agent can distribute it across YouTube, Instagram, TikTok, and X via the packaged `runtime/publish.mjs` CLI or connected Buffer MCP tools:

1. **Author platform-tailored copy in `inputs/distribution.json`:**
   - **YouTube:** High-retention title (≤100 chars), categoryId (`27` for Education or `28` for Science & Technology). Handles standard 16:9 video or vertical Shorts automatically based on aspect ratio.
   - **Twitter/X:** Engaging educational hook with key takeaways (≤280 chars total).
   - **Instagram:** Informative caption with relevant hashtags (feed video or Reels).
   - **TikTok:** Engaging caption with trending tutorial tags (≤2200 chars).
2. **Dry-run validation:**
   ```sh
   node runtime/publish.mjs --dry-run inputs/distribution.json examples/animal-conversations-first-run/final.mp4
   ```
3. **Live dispatch requires explicit human sign-off:**
   - Confirm target channels and copy with the user (`approvalRequired: true`).
   - Execute with connected Buffer MCP tools or `node runtime/publish.mjs inputs/distribution.json /path/to/final.mp4`.
   - Generates a verified distribution receipt (`<video>.distribution.json`) with zero secret leakage.

