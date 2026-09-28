# Wiggly Talking Fish News

Turn one real news story into a short, deadpan vertical fish report.

## Start

```bash
npm install
npm run format:talking-fish-news -- check
npm run format:talking-fish-news -- init --run=my-report
```

The agent researches one trustworthy source, rejects visuals that do not read clearly at phone size, creates five setup-to-payoff concepts, writes one approved four-beat report, shows the script and estimate, and asks before making the voice. If you already have a source, add `--source-url=https://example.com/story` to `init`.

## Assembly line

`Research -> Concepts -> Script -> Direct -> Voice -> Render -> Deliver`

1. **Research** saves sourced facts plus official local visuals, credits, and a phone-size readability verdict.
2. **Concepts** creates exactly five setup → escalation → reveal → payoff arcs.
3. **Script** turns the selected arc into four spoken story beats.
4. **Direct** choreographs broadcast camera motion, news ticker badges, and fish anchor expressions using Jev System One.
5. **Voice** uses the fixed Fish voice and times exact captions after approval.
6. **Render** creates one local 1080x1920 MP4 through Wiggly's shared renderer.
7. **Deliver** checks media, captions, evidence, and hashes, then waits for the user to approve the finished video.

## Cost

- Research and official images: host-agent web tools
- Five concepts and script: host-agent reasoning
- Jev System One director: BYOK via secrets.env (Rule 12: Zero silent fallbacks)
- Fish S2.1 Pro Free voice: $0 provider cost
- Deepgram caption timing: BYOK usage, usually pennies or less
- Local Remotion render: $0 provider cost

No image generation, video generation, music generation, or Replicate call is used.

If Deepgram rejects a key after Fish succeeds, fix the key and run the same voice command again. The runner reuses the saved narration and does not make another Fish call.

## Resume

Every run is saved under `public/format-repositories/talking-fish-news-v1/agent-runs/<run-id>`.

```bash
npm run format:talking-fish-news -- resume --run=my-report
```

Provider failures stop loudly. The runner never retries or changes providers. `smoke --run=<id>` renders only the bundled fixture locally and never calls a provider.

The runner uses `REMOTION_BROWSER_EXECUTABLE` when set, then checks common Chrome and Chromium locations before Remotion attempts its normal browser setup.
