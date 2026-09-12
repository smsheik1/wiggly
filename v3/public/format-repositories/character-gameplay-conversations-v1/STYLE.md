# Content Studio Style Rules

## Hard Rules
- NO em dashes (---, —) anywhere. Ever. In captions, post copy, scripts, code comments, filenames, receipts, docs. Use a plain hyphen or rewrite the sentence.

## Voice Presets
- Batman voice model ID: `46a27a4d536d4dc888ea73563df935a7`
## Audio & Dialogue Levels
- All synthesized character speech lines must be loudness-normalized to -16 LUFS (via `ffmpeg -af loudnorm=I=-16:TP=-1.5:LRA=11`) so all characters match dialogue volume.
- Background music mixes flat without ducking by default (`duckUnderDialogue: false`). This keeps the instrumental punchy and audible throughout dialogue without unwanted volume dips.
