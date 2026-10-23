---
name: my-pixar-story
description: Turn real questionnaire memories into a cinematic 3D animated memoir (Pixar-style) with consistent characters across life stages, hero props, and authentic parent voiceover.
version: 2.1.0
author: Wiggly Studio
---

# My Pixar Story — 3D Animated Family Memoir

Transform a family's questionnaire answers and real reference photos into an emotional 72-second 3D animated short film in the warm, whimsical visual aesthetic of a classic Pixar prologue (e.g. *Up*, *Coco*).

## Trigger Phrases
- "Make a Pixar-style story for my daughter"
- "3D animated family memoir from our memories"
- "Warm big-eyed feature-animation film about my dad"
- "Pixar-style tribute for my mom's birthday"
- "Create an animated storybook legacy film"

---

## 1. The Core Philosophy
1. **Real Memories, Never Stock Avatars:** Every character, location, and hero prop is generated from authentic questionnaire answers and family reference photos. No borrowed characters or generic house mascots.
2. **Character & Prop Continuity First:** A 4K character lineup sheet and hero prop turnaround sheet are locked *before* rendering any video. Once approved, all life stages and key objects maintain persistent identity across every scene.
3. **The "Opening of Up" Audio Architecture:** Rather than risking uncanny AI lip-flap desync, characters act wordlessly with rich emotional expressions, set against a continuous 72-second emotional piano score, ambient foley, and the real parent's authentic voiceover narrating across the scene cuts.
4. **Zero-Setup Studio MCP Interface:** The client agent acts as the Creative Director; heavy rendering (Seedance 2.5 on Replicate) and 1080p upscaling (`bytedance/video-upscaler`) run asynchronously on Wiggly's managed studio cloud GPUs via `@wiggly/mcp-server`.

---

## 2. The 7-Beat Screenplay Architecture (72 Seconds Total)

| Beat | Life Stage | Timing | Dramatic Purpose |
|------|------------|--------|-------------------|
| **Beat 1** | Childhood (Ages 7–10) | 0:00–0:10 | **The Mischief & The Obsession:** Unfiltered joy, goofy partner-in-crime, early signature trait or keepsake. |
| **Beat 2** | Teen (Ages 15–18) | 0:10–0:22 | **The Freedom Machine & Alter-Ego:** First vehicle, bike, or creative passion. The feeling of infinite road ahead. |
| **Beat 3** | Young Adult (Ages 19–24) | 0:22–0:33 | **The Leap of Faith:** Leaving home, scrappy survival, working late under fluorescent or neon lights. |
| **Beat 4** | Adult (Ages 25–30) | 0:33–0:44 | **The Meet-Cute & Partnership:** The clumsy, heartfelt moment with spouse/partner. The quiet realization of shared destiny. |
| **Beat 5** | Adult (Ages 30–35) | 0:44–0:54 | **The Sacrifice & The Heavy Lift:** Navigating struggle, self-doubt, or long hours for the family's future. |
| **Beat 6** | Present Day | 0:54–1:04 | **The Turn & Arrival:** The child is born; the chaos becomes clarity; the sacrifice pays off. |
| **Beat 7** | The Timeless Coda | 1:04–1:12 | **The Porch Light / Closing Thesis:** Adult protagonist reflects on the journey; closing heartfelt message whispered across time. |

---

## 3. Character & Hero Prop Prompt Recipes (Nano Banana 2.1)

To guarantee visual consistency, generate a single 4K multi-character lineup sheet and hero prop turnaround before animating:

### Character Lineup Prompt Formula:
> `3D stylized character lineup compilation sheet, Pixar feature animation aesthetic, showcasing [CharacterName] across three distinct life stages from left to right: (1) 8-year-old child with messy hair, oversized graphic t-shirt, and oversized expressive round eyes with bright specular catchlights; (2) 17-year-old teenager in retro faded denim jacket, lean posture; (3) 34-year-old adult father with gentle smile, warm crow's feet, neatly groomed beard, and cozy olive knit sweater. Matching real-life facial features from reference photos: [PhotoURLs]. Neutral photographic studio backdrop, warm rim lighting, rich subsurface scattering on skin, tactile cloth textures, 8k resolution, cinematic character turn-around sheet.`

### Hero Prop Sheet Formula:
> `Multi-angle model sheet of a [Year Make Model Prop, e.g., 2000 Honda Accord coupe], Pixar-style 3D stylized vehicle turnaround: front 3/4 view, side profile, and rear 3/4 view. Characterized by slightly rounded exaggerated proportions, glossy slightly weathered paint, detailed dashboard with nostalgic air freshener. Neutral gray studio lighting, crisp shadows, feature animation production asset.`

---

## 4. Scene Prompting Architecture (Seedance 2.5 Negative Audio Lock)

Every video prompt authors **Visual Action**, **Camera Direction**, and **Negative Audio Directives** to ensure diffusion video clips never clash with the continuous musical score:

### Prompt Structure:
> `[Framing & Camera Move]: Medium cinematic tracking shot, 16:9 widescreen, 24fps.`  
> `[Visual Subject]: 3D Pixar stylized young father holding his baby daughter wrapped in a yellow blanket on the front porch.`  
> `[Action & Acting]: Wordless acting. He gently sways, smiling down with tearful joyful eyes as a warm breeze rustles the trees behind them.`  
> `[Audio Directives]: No background music, no spoken dialogue, atmospheric ambient room tone and foley effects only (gentle crickets, soft porch floorboard creak, night breeze).`

---

## 5. The 3-Tool Asynchronous Studio Cloud Engine

Client agents communicate with Wiggly using three discrete tools from `@wiggly/mcp-server`:

### Step 1: Submit Film (`wiggly_submit_film`)
Dispatches the draft generation pass. Returns a durable `jobId` in <500ms:
```json
{
  "idempotencyKey": "unique-client-order-uuid-12345",
  "storyboard": {
    "title": "Shaz for Mia",
    "subject": "Mia",
    "beats": [...],
    "characters": [
      {
        "tag": "@Shaz_Adult",
        "name": "Shaz",
        "ageOrStage": "34-year-old adult father",
        "referencePhotoUrls": ["https://cdn.wiggly.com/uploads/shaz-dad.jpg"]
      }
    ],
    "heroProps": [
      {
        "tag": "@2000_Honda_Accord",
        "name": "2000 Honda Accord Coupe",
        "description": "Silver 2-door coupe with slightly weathered paint",
        "referencePhotoUrls": ["https://cdn.wiggly.com/uploads/honda.jpg"]
      }
    ]
  },
  "voiceover": {
    "type": "parent_clone",
    "voiceSampleUrl": "https://cdn.wiggly.com/uploads/shaz-voice-10s.mp3"
  }
}
```

### Step 2: Poll Status (`wiggly_get_film`)
Checks pipeline progress without open-socket timeouts. Returns `retryAfterSec: 15`:
```json
{
  "jobId": "film_1730000000_abc123"
}
```
*Returns:* Current stage (`lineup_generation`, `rendering_shots`, `vision_qc`, `ready_for_review`), 720p watermarked draft video URL, and 3x3 dailies contact sheet.

### Step 3: Human Approval Gate (`wiggly_finalize_film`)
Enables the user to reroll a single defective shot (max 1 free auto-retry per shot, max 3 per film) or order the final 1080p theatrical master:
```json
{
  "jobId": "film_1730000000_abc123",
  "action": "order_1080p_master"
}
```

---

## 6. Execution Options

### Option A: Wiggly Studio Cloud MCP (Hosted Zero-Setup)
Connect the official Wiggly MCP server to handle image generation, Seedance video synthesis, Replicate upscaling, and FFmpeg assembly automatically:
```json
{
  "mcpServers": {
    "wiggly": {
      "command": "npx",
      "args": ["-y", "@wiggly/mcp-server@latest"],
      "env": {
        "WIGGLY_API_KEY": "your_wiggly_api_key"
      }
    }
  }
}
```

### Pricing:
* **720p Draft Preview:** **\$19.00**
* **Theatrical 1080p Master:** **\$69.00** (Includes 4K character sheet, 3x3 contact sheet, continuous piano score, and parent voiceover mix).
