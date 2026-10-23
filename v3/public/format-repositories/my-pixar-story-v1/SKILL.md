---
name: my-pixar-story
description: Turn real questionnaire memories into a cinematic 3D animated memoir (Pixar-style) with consistent characters across life stages, hero props, and native synced dialogue.
version: 2.0.0
author: Wiggly Studio
---

# My Pixar Story — 3D Animated Family Memoir

Transform a family's questionnaire answers into an emotional 72-second 3D animated short film in the warm, whimsical visual aesthetic of a classic Pixar prologue (e.g. *Up*, *Coco*).

## Trigger Phrases
- "Make a Pixar-style story for my daughter"
- "3D animated family memoir from our memories"
- "Warm big-eyed feature-animation film about my dad"
- "Pixar-style tribute for my mom's birthday"
- "Create an animated storybook legacy film"

---

## 1. The Core Philosophy
1. **Real Memories, Never Stock Avatars:** Every character, location, and hero prop is generated from authentic questionnaire answers. No borrowed characters or generic house mascots.
2. **Character & Prop Continuity First:** A 4K character lineup sheet and hero prop sheet are locked *before* rendering any video. Once approved, all life stages and key objects maintain persistent identity across every scene.
3. **Native Multimodal Audio:** Video clips are generated with ByteDance Seedance 2.5 using native emergent latent audio. Speech, acoustic room tone, and character Foley are synthesized simultaneously in the video latent space—eliminating artificial TTS lip flap desync.
4. **Mandatory Director Approval Gates:** The human user reviews and approves:
   - The 7-Beat Screenplay & Spoken Dialogue
   - The 4K Character Lineup & Hero Prop Sheet
   - The 8-Panel Directorial Storyboard
   No GPU credits are spent until the creative blueprint is signed off.

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

## 3. Character & Hero Prop Prompt Recipe (Nano Banana 2.1)

To guarantee visual consistency, generate a single 4K multi-character lineup sheet before animating:

### Character Lineup Prompt Formula:
> `3D stylized character lineup compilation sheet, Pixar feature animation aesthetic, showcasing [CharacterName] across three distinct life stages from left to right: (1) 8-year-old child with messy hair, oversized graphic t-shirt, and oversized expressive round eyes with bright specular catchlights; (2) 17-year-old teenager in retro faded denim jacket, lean posture; (3) 34-year-old adult father with gentle smile, warm crow's feet, neatly groomed beard, and cozy olive knit sweater. Also featuring [SecondaryCharacter] standing alongside. Clean neutral photographic studio backdrop, warm rim lighting, rich subsurface scattering on skin, tactile cloth textures, 8k resolution, cinematic character turn-around sheet.`

### Hero Prop Sheet Formula:
> `Multi-angle model sheet of a [Year Make Model Prop, e.g., 2000 Honda Accord coupe], Pixar-style 3D stylized vehicle turnaround: front 3/4 view, side profile, and rear 3/4 view. Characterized by slightly rounded exaggerated proportions, glossy slightly weathered paint, detailed dashboard with nostalgic air freshener. Neutral gray studio lighting, crisp shadows, feature animation production asset.`

---

## 4. Scene Prompting Architecture (Seedance 2.5 Native Audio)

Every video prompt must author **Visual Action**, **Camera Direction**, and **Synchronized Spoken Line** in a single block:

### Prompt Structure:
> `[Framing & Camera Move]: Medium cinematic tracking shot, 16:9 widescreen, 24fps.`  
> `[Visual Subject]: 3D Pixar stylized young father holding his baby daughter wrapped in a yellow blanket on the front porch.`  
> `[Action & Acting]: He gently sways, smiling down with tearful joyful eyes as a warm breeze rustles the trees behind them.`  
> `[Spoken Dialogue]: Character speaks softly in a warm, sincere, slightly raspy male voice: "I didn't know where the road would lead, Mia... but every step brought me here."`  
> `[Acoustic Audio & Ambience]: Quiet night crickets chirping in the distance, soft porch floorboard creak, gentle acoustic guitar melody softly fingerpicked under dialogue, warm natural room acoustics, high fidelity synchronized speech.`

---

## 5. Post-Production & Delivery Pass

1. **4K Upscaling:** Run raw 480p/720p clips through `SeedVR2` on Modal H100 GPUs for temporal consistency and crisp theatrical details.
2. **Lossless Concat:** Use FFmpeg demuxer (`ffmpeg -f concat -safe 0 -i clips.txt -c copy master.mp4`) to prevent generational quality loss.
3. **Contact Sheet Dailies:** Extract 9 key emotional milestone frames into a 3x3 story grid for instant screening review.

---

## 6. Execution Options

### Option A: Wiggly MCP Tollbooth (Hosted Zero-Setup)
Connect the official Wiggly MCP server to handle image generation, Seedance video synthesis, Modal upscaling, and FFmpeg assembly automatically:
```json
{
  "mcpServers": {
    "wiggly": {
      "command": "npx",
      "args": ["-y", "@wiggly/mcp-server@latest"],
      "env": {
        "WIGGLY_API_KEY": "your_api_key_or_leave_blank_for_byok"
      }
    }
  }
}
```

### Option B: Bring Your Own Keys (BYOK)
Set environment variables directly:
- `REPLICATE_API_TOKEN`: Access to `bytedance/seedance-2.5`
- `MODAL_TOKEN`: Access to `seedvr2` upscaler endpoint
