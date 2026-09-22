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
- **Expressive Poses:** You can specify `poseId` (from `poses/index.json`) to give Shaz an emotional stance while speaking with full lip-sync:
  - `"neutral-listening"`: Calm default baseline listening/talking pose.
  - `"chin-stroke"`: Swagger / smug chin-stroke with sly smirk and hand on hip (great for teasing revelations, hot takes, "nobody asked for this" moments).
  - `"present"`: Open hand gesture presenting ideas outward (great for intros, explanations).
  - `"aha"`: Raised index finger with realization (great for key insights, epiphanies, wrap-ups).
  - `"point"`: Direct forward point for strong directional emphasis and claims.
  - `"confident"`: Confident hands-on-hips delivery.
  - `"shrug"`: Gentle questioning or disbelief stance.
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
- **What it is:** Chibi Shaz pops in with classical squash/stretch animation physics to react to, explain, and emphasize on-screen Topic Cards or media.
- **Physical Hold Vocabulary (Acting Presence):**
  These poses are NOT emotion buckets—they are physical kinetic postures that match speech rhythms:
  - `"talk-gesture"`: Front-facing conversational anchor; relaxed open elbows (casual explanation / baseline).
  - `"present-card"`: Body angled left, right arm extended pointing toward card/topic (introducing a concept or graphic).
  - `"think-chin"`: Head tilted down, hand propping up chin (pondering, deliberating, recalling, or confusion).
  - `"shrug-open"`: Shoulders raised, hands open to sides (acknowledging reality, playful disbelief, "what can you do?").
  - `"point-emphasis"`: Arm extended pointing forward/side (decisive takeaway, rule enforcement, emphatic conclusion).
- **Choreographing with `chibiRoutine`:**
  - The Director LLM should choreograph a sequence of holds matching the vocal clauses in `chibiRoutine`. Target density is **1 pose every ~15 to 30 frames (0.6s to 1.2s)**, matching the animator reference:
    ```json
    "chibiRoutine": ["talk-gesture", "present-card", "think-chin", "shrug-open"]
    ```
  - The runtime automatically synthesizes the 1-2 frame squash, anticipation windup, recoil, and smear cushions connecting each hold, along with the smear entrance and apex exit leap.
  - **Root-Level Guardrail for Blind Agents:** If an agent provides only a single hold (e.g. `chibiPose: "present-card"`) for a shot $\ge 48$ frames (2.0s), the runtime automatically expands it via `deriveChibiRoutine` into a multi-pose progression so Chibi Shaz never freezes.
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
  - Comedic reaction moments where physical acting (like presenting then shrugging) amplifies the voiceover.
- **Duration guidelines:** Typically 2.0 to 5.0 seconds.

### 4. `b-roll` (Full-Screen Concept Illustration with Ken Burns)
- **What it is:** Full-screen visual illustrations of the concept, place, or object being discussed, brought to life with dynamic camera motion (pan / zoom).
- **Available Motions:**
  - `zoom-in`: Smooth camera push into the center of the illustration (adds focus, intensity, or revelation).
  - `zoom-out`: Smooth camera pull back (reveals scale, context, or landscape).
  - `pan-left`: Smooth horizontal tracking from right to left.
  - `pan-right`: Smooth horizontal tracking from left to right.
  - `pan-up`: Smooth vertical tilt upward.
  - `pan-down`: Smooth vertical tilt downward.
- **Custom Artwork:**
  - The Director can provide an image path in `brollMedia` (e.g. `"assets/backgrounds/concept-art.png"`).
  - If omitted, the shot smoothly animates the designated scene background.
- **Visual Prompting Engine (AI Concept Art / B-roll):**
  - When generating custom concept art or B-roll for a narrative beat in Google Flow:
    1. **Agent Instructions Setup in Flow (Mandatory):**
       - In Google Flow, open the **Agent instructions** drawer (top-right next to Settings) and ensure both canonical reference images are attached and toggled **ON** (`checked = true`):
         - **Style Reference** (`shaz-style-reference.png`): *"Clean 2D flat cartoon cel animation with bold, clean, uniform black outlines and solid flat color fills. Simple circular cartoon eyes, simple curved bean mouth, no cross-hatching, no colored pencil texture, no wood grain, no painterly realism. Warm saturated palette (yellow-orange, coral red, tan, salmon). Minimalist flat graphic backgrounds with simple geometry."*
         - **Character Reference** (`shaz-turnaround.jpg`): *"Maintain exact character model consistency for Shaz: light tan skin, fluffy medium-brown hair, expressive large cartoon eyes with black pupils, salmon-pink striped hooded sweatshirt with high neck and front drawstrings, light cyan/teal pants, slip-on shoes. Keep character anatomy, proportions, and minimalist 2D cartoon style identical across all poses and camera angles."*
    2. **Prompting Structure (Cel Anchor + Explicit Negative Constraints):**
       - Flow's default diffusion prior defaults to textured storybook/painterly illustrations if unguided.
       - Every prompt MUST explicitly reinforce the cel medium:
         `"2D flat animation art style matching the active Style Reference and Character Turnaround instructions: [Subject / Action / Scene], flat solid colors, bold clean black outlines, simple graphic background, no texture, no hatch shading"`
    3. **Ken Burns Motion Pairing:** Every generated image is paired with a camera motion preset (`zoom-in`, `zoom-out`, `pan-left`, `pan-right`, `pan-up`, `pan-down`) that matches the narrative energy (e.g. push-in for intimacy/revelation, pan for scale).
- **Google Flow Browser Automation Protocol:**
  - **Why:** Leverages the user's active Google AI Pro subscription on `flow.google.com` (with 1,000+ Pro credits) for cutting-edge image generation without incurring extra cloud API costs or hardcoded keys.
  - **When to use:** Whenever new bespoke B-roll assets are required for a multi-shot video run. If offline or in automated headless CI, the runtime falls back gracefully to animating the registered scene backgrounds with Ken Burns transforms.
  - **Prerequisite (One-time macOS setup):**
    - Chrome menu: **View > Developer > Allow JavaScript from Apple Events**.
    - This allows background AppleScript/DOM automation without hijacking the user's physical mouse cursor or moving windows across spaces.
  - **Execution Path:**
    1. Verify active Flow tab in Chrome (`https://flow.google.com/`).
    2. Ensure both **Style Reference** and **Character Turnaround** instructions in Flow are toggled active.
    3. Inject prompt into the Flow input editor (`div.ProseMirror`) with the required flat cel reinforcement tags.
    4. Retrieve the resulting high-res generation into `agent-runs/<run>/assets/broll/`.
    5. Link asset path into `brollMedia` on the shot sheet.
- **When to use:**
  - Storytelling moments describing a specific scene, world, memory, or complex concept.
  - Giving visual breathing room when the voiceover paints a picture or dives into descriptive lore.
- **Duration guidelines:** Typically 2.5 to 5.0 seconds. Long enough for the Ken Burns motion to glide cleanly across the canvas.

---

## Jev System One Actor Intuition Engine (Optional BYOK)

When a `TYPESAFE_API_KEY` is configured in `secrets.env` or the environment, `deriveMultiShotPlanWithJev` automatically queries TypeSafe AI's Jev model (`jev-latest`).
- **Sub-200ms Decision Engine:** Jev evaluates each commentary sentence at **\$0.042/1M tokens** with sub-200ms latency to select the most natural, human-feeling:
  - **`chibiPose`** (`talk-gesture`, `present-card`, `think-chin`, `shrug-open`, `point-emphasis`)
  - **`badge`** category tags (e.g. `THEORY`, `LEAK`, `RUMOR`, `VERDICT`)
  - **Camera Motion** (`zoom-in`, `pan-left`, `pan-right`, etc.)
- **Graceful Fallback:** If no API key is provided, the director falls back seamlessly to the deterministic keyword analyzer at zero cost and zero network overhead.

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
