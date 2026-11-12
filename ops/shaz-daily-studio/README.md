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

## Tests

```bash
npm --prefix ops/shaz-daily-studio test
```
