# Shaz Multi-Shot Director Playbook

This playbook defines how an LLM agent directs a high-retention video using the Shaz Puppet Runtime format.

## The Goal

A video that stays on one shot type for too long feels robotic and monotonous.
Conversely, random or templated cuts (e.g. cutting every 3 seconds) feel arbitrary and disruptive.

The Director's job is to read the full **Whisper word-timestamped transcript**, understand the narrative and comedic pacing, and create a **Shot Sheet (`shaz-multi-shot-v1`)** where cuts emphasize meaning, punchlines, and emotional transitions.

---

## The 4 Shot Palette

In this version of the format, the director has access to:

### 1. `talk-to-camera` (Shaz Talking Head)
- **What it is:** Shaz waist-up facing camera with Cherry lip-sync.
- **When to use:**
  - Intros, greetings, personal address (*"Hey guys, today I want to talk about..."*).
  - Conversational delivery, personal anecdotes, asking questions to the viewer.
  - Comedic beats, sarcastic reactions, and punchlines.
- **Duration guidelines:** Typically 3 to 7 seconds. Rarely hold on talking head longer than 6 seconds without a beat change.

### 2. `text-card` (Slow/Fast Moments & Transitions)
- **What it is:** Bold, punchy typography placed on the room wall (e.g. Sisters Room), with key words highlighted in vibrant accent colors (e.g. `#00b4d8` cyan, `#b5179e` purple).
- **When to use:**
  - Hard thesis statements or big claims (*"Without her constant help and encouragement."*).
  - Pacing transitions: resetting the tempo after a dense sentence.
  - Chapter title moments, rhetorical questions, or dramatic pauses in the voiceover.
- **Duration guidelines:** Typically 1.5 to 3.5 seconds. Enough time for the viewer to easily read the phrase while hearing it spoken.

### 3. `commentary` *(Coming soon)*
- Inset topic frame / board where Shaz gestures towards an external subject or graphic.

### 4. `b-roll` *(Coming soon)*
- Full-screen scene illustrations or narrative story art over voiceover.

---

## Directing Rules

1. **Never Cut in the Middle of a Spoken Word:**
   - Cuts must happen at sentence boundaries, clause boundaries, or during audible pauses between words.
   - Use the `endMs` of the preceding word and `startMs` of the next word from the Whisper transcript.
   - Frame formula: `frame = round(ms * 24 / 1000)`.

2. **Vary the Rhythm:**
   - Alternate between shot types to keep the audience visually re-engaged.
   - Example pacing curve:
     - Shot 1: `talk-to-camera` (0s - 3.5s) -> Hook / setup
     - Shot 2: `text-card` (3.5s - 5.8s) -> Key insight highlight
     - Shot 3: `talk-to-camera` (5.8s - 10.2s) -> Elaboration / reaction

3. **Highlights in Text Cards:**
   - Always choose 1 or 2 high-impact phrases to highlight with color.
   - Use playful contrasting tones: cyan (`#00b4d8`), purple (`#b5179e`), warm orange (`#f77f00`), or coral (`#e63946`).
