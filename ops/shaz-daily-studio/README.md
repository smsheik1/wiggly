# Shaz Daily Studio (`ops/shaz-daily-studio`)

Private automation wrapper for generating daily Animate Shaz candidate batches, dispatching previews to Telegram, and publishing approved winners via Buffer. Kept outside `v3/public/` so it is neither served by the website nor packaged into the public format kit.

## Morning Scheduled Run

Run from the pinned clean checkout of `main` so `secrets.env` resolves from the repo root:

```bash
cd /Users/shaz/wiggly-studio-main && node ops/shaz-daily-studio/studio-daily.mjs --batch=3
```

## Required Keys (`secrets.env`)

Key names read from `secrets.env` (or process environment):
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_OPERATOR_USER_ID`
- `BUFFER_API_KEY` (or `SHAZSKISBUFFER_API_KEY`)
- `SERPER_API_KEY`
- `NEWSMCP_API_KEY`
- `TYPESAFE_API_KEY` (or `JEV_API_KEY`, when `"director": "jev"` in `studio.config.json`)
- `CARTESIA_API_KEY` (required; zero fallback to Fish in the studio)

## Director Mode & Blind A/B (`studio.config.json`)

- `"director": "jev"` (default) uses Jev per-beat choices restricted to approved poses in `poses/performance-approvals.json`.
- `"director": "agent"` plans shots with `agent-director.mjs` (`askActiveAgent`) against approved poses and headline spacing rules (`--director=agent`).
- Blind side-by-side harness (reuses an existing run's audio/transcript/media with zero Cartesia/Serper calls):
  `node ops/shaz-daily-studio/tools/director-ab.mjs --run=<runId> [--dry-run]`

## Script Room (`scriptFlow` in `studio.config.json`)

`"scriptFlow": "room"` (default) writes each script in four steps (`script-room.mjs`):

1. The writer agent writes **3 drafts, each with a different angle**, against `voice-guide.md`.
2. A fresh agent call **judges them blind** (shuffled, labelled A/B/C) and picks a winner and a runner-up.
3. If none is good enough: **one rewrite** with the judge's notes, judged again. Still weak → the better version ships, marked **"fine, not great"** with the judge's notes in Telegram.
4. A separate "paperwork" call adds headline, cards, image searches, room and tags. Spoken words are locked.

Every run saves `script-room.json` (all drafts, scores, winner, runner-up). In Telegram, the runner-up script is
sent under each video with **"Runner-up was better" / "Winner was right"** buttons. These are feedback only and
never pick or post. Votes go to `~/.wiggly/shaz-daily-studio/script-feedback.jsonl`.

Weekly review: `node tools/review-script-feedback.mjs` (summary) or `--propose` (asks the agent for voice-guide
edits, written to `~/.wiggly/shaz-daily-studio/voice-guide-proposals/<date>.md`; never edits the guide itself).
`[pause]` marks are stripped before voice until pause timing ships. `"scriptFlow": "single"` keeps the old one-shot writer.

## Tests

```bash
npm --prefix ops/shaz-daily-studio test
```
