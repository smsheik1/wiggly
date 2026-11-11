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
- `BUFFER_API_KEY` (or `SHAZSKISBUFFER_API_KEY`)
- `SERPER_API_KEY`
- `NEWSMCP_API_KEY`
- `TYPESAFE_API_KEY` (or `JEV_API_KEY`)
- `CARTESIA_API_KEY` (or `FISH_STUDIO_APIKEY`)

## Tests

```bash
npm --prefix ops/shaz-daily-studio test
```
