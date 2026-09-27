# Wiggly Brand Jingle

Turn one website or one-sentence brief into a short, evidence-backed song.

No website? The brief only needs the brand name and what the song should promote.

The agent does the free thinking.
The runner validates the plan, shows the cost, makes local cover art, and gates one ElevenLabs Music call.

## Quick start

```bash
cd wiggly-brand-jingle-format-kit/v3
npm install
# Add ELEVENLABS_API_KEY and BUFFER_API_KEY to secrets.env or export in environment
npm run format:jingle -- check
npm run format:jingle -- init --run=my-jingle --url=https://example.com
```

Then:

1. Fill `agent-runs/my-jingle/research.json`.
2. Fill `agent-runs/my-jingle/jingle-plan.json`.
3. Validate and preview the free work.

```bash
npm run format:jingle -- validate --run=my-jingle
npm run format:jingle -- cover --run=my-jingle
npm run format:jingle -- estimate --run=my-jingle
```

After the user approves one song attempt:

```bash
npm run format:jingle -- generate --run=my-jingle --approve-music
npm run format:jingle -- inspect --run=my-jingle
npm run format:jingle -- finalize --run=my-jingle --approve-final
```

The final folder contains:

- `jingle.mp3`
- `cover.svg`
- `research.json`
- `jingle-plan.json`
- `inspection.json`
- `final.json`

Music video generation is intentionally excluded.
