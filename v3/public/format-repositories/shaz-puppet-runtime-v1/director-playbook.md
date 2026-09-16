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

### 3. `chibi-commentary` (Chibi Shaz Reaction & Topic Commentary)
- **What it is:** Chibi Shaz pops in from the bottom right corner with a 2-frame smear whip, reacting to and presenting an on-screen Topic Card or image.
- **Available Poses:** `talk-excited-1`, `talk-excited-2`, `talk-gesture-1`, `talk-gesture-2`, `talk-smile`, `present-open`, `present-gesture`, `think-chin`, `think-down`, `shrug-smile`, `listen-side`, `talk-laugh`, `point-side`, `point-up`, `celebrate`.
- **On-The-Fly Topic Card Generation:**
  - The Director can specify a `card` object directly in the shot to generate a custom vector card on the fly:
    ```json
    "card": {
      "badge": "CATEGORY BADGE",
      "headline": "SHORT PUNCHY TITLE",
      "quote": "Memorable quote or takeaway",
      "theme": "warm-red | cold-blue | energy-orange | deep-purple | emerald-green | sunburst-gold",
      "icon": "trophy | puppy | clash | burger | question | heart-paw | idea | star"
    }
    ```
- **When to use:**
  - Topic explanations, breakdowns, theories, or reactions where visual grounding helps the viewer follow.
  - Comedic reaction moments where a pose (like `think-chin` or `shrug-smile`) amplifies the voiceover.
- **Duration guidelines:** Typically 2.0 to 5.0 seconds.

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
