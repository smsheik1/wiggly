---
name: my-pixar-story
description: "My Pixar Story: A 3D Pixar-style animated memoir format for parents and grandparents to tell their life story to their kids or spouse across 5 high-voltage emotional chapters."
---

# My Pixar Story — Format Operating Guide

This format turns a parent's real-life memories into an emotional, cinematic 3D animated short film in the warm, whimsical aesthetic of a classic Pixar prologue (e.g. *Up*, *Coco*).

## The Golden Rule
**1 Question = 1 Story Beat = 1 Rendered Scene.**  
Total video: exactly 5 scenes, ~60–75 seconds.

---

## 1. Requirements

### Local Tools
* Node.js $\ge$ 20
* `ffmpeg` (for local audio and video splicing)

### Required Environment Keys
* `CARTESIA_API_KEY`: Official voice cloning synthesis via Cartesia Sonic (from the user's 10-second reference clip).
* `SEADANCE_API_KEY`: Video generation engine.
  * **Draft & Building (Default):** SeaDance 2.0 Mini or SeaDance 2.5 @ 480p (low-cost, rapid preview).
  * **Final Export (Paid Gate):** SeaDance 2.5 at Full Resolution (1080p+).

*Note: In accordance with Wiggly policy, keys are read exclusively in memory from `secrets.env` (symlinked at repo root). Never commit keys or write them to `.env`.*

---

## 2. The 5 Story Beats

1. **Scene 1 (Ages 7–10): The Mischief & The Obsession**
   * *Prompt:* Partner-in-crime, silly childhood trouble, weird obsessive hobby.
   * *Visual:* Golden hour outdoor childhood adventure, wide curious eyes, messy bedroom packed with their specific obsession.
2. **Scene 2 (Ages 15–18): The Freedom Machine & Secret Identity**
   * *Prompt:* First vehicle/bike, night cruising, secret alter-ego / teen passion.
   * *Visual:* Cinematic night cruise in beat-up car, neon dashboard glow, real retro hairstyle.
3. **Scene 3 (Ages 19–25): The Leap of Faith**
   * *Prompt:* Leaving the nest, biggest gamble, scrappy survival, breakthrough moment.
   * *Visual:* Determined solitary figure stepping into the big city / studio apartment.
4. **Scene 4 (Ages 26–32): Mom & Dad's Origin Story**
   * *Prompt:* The meet-cute, clumsy/awkward first date laugh, the quiet moment they knew.
   * *Visual:* Two characters sharing coffee or caught under an umbrella, string-light bokeh.
5. **Scene 5 (Present Day): What I Wish You Knew & The Time-Machine Hug**
   * *Prompt:* The unspoken truth to their kids + what they'd whisper to their 8-year-old child self.
   * *Visual (The Tearjerker):* Adult character kneeling down to hug their 8-year-old self, transitioning into the modern family portrait.

---

## 3. Command Loop

### Step 1: Free Offline Smoke Test
Run the deterministic smoke test with zero paid API calls:
```bash
npx tsx features/formats/my-pixar-story/tests/smoke.test.ts
```

### Step 2: Input Validation
Validate the raw user input JSON against the pre-flight gate:
```typescript
import { validateMyPixarStoryInputs } from "./validate";
const result = validateMyPixarStoryInputs(inputPayload);
if (!result.valid) throw new Error(result.errors.join(", "));
```

### Step 3: Compile Storyboard & Prompts
Generate the complete 5-scene Pixar storyboard and SeaDance video prompts:
```typescript
import { compileStoryboard } from "./screenplay";
const storyboard = compileStoryboard(validatedInputs);
```

### Step 4: Preview Render (Draft Tier)
Submit the 5 scene video prompts to **SeaDance 2.0 Mini** (or **SeaDance 2.5 @ 480p**) and synthesize voiceover with **Cartesia Sonic**.

### Step 5: Final Export Pass
Upon user approval and checkout, trigger **SeaDance 2.5 Full Resolution (1080p+)** for final archival MP4 delivery.
