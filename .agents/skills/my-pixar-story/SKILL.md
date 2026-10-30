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

## 2. The Intake Standard: The Golden 5

When interviewing the user for family memories (or if the user asks for "all questions"), use **The Golden 5**. Do not interrogate the user with technical camera, aspect ratio, or production checklists—YOU are the Creative Director and author those technical parameters from these 5 human answers:

1. **Chapter 1 (Childhood, Age 8):** *"Take us back to you at 8 years old: who was your partner-in-crime, what silly trouble did you get into, and what was your weird obsession that you thought was the coolest thing on earth?"*
2. **Chapter 2 (Teen Freedom):** *"What was your first real taste of freedom (what were you driving or riding), and what is one thing about teenage you that would shock your kids if they saw you back then?"*
3. **Chapter 3 (The Leap of Faith):** *"What was the craziest risk or adventure you took when you first stepped out into the world on your own, and the moment you realized 'I actually did it'?"*
4. **Chapter 4 (Romance / Origin Story):** *"How did you meet Mom/Dad/Spouse, what was the most awkward or hilarious moment trying to impress them, and when did you know they were the one?"*
5. **Chapter 5 (What I Wish You Knew / Legacy Finale):** *"What is one thing you wish your kids truly understood about who you are inside—and if you could walk up to that 8-year-old version of yourself and give them a hug today, what would you say?"*

---

## 3. The 7-Beat Screenplay Architecture (72 Seconds Total)

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

## 4. Character & Hero Prop Prompt Recipes (Nano Banana 2.1)

To guarantee visual consistency, generate a single 4K multi-character lineup sheet and hero prop turnaround before animating:

### Character Lineup Prompt Formula:
> `3D stylized character lineup compilation sheet, Pixar feature animation aesthetic, showcasing [CharacterName] across three distinct life stages from left to right: (1) 8-year-old child with messy hair, oversized graphic t-shirt, and oversized expressive round eyes with bright specular catchlights; (2) 17-year-old teenager in retro faded denim jacket, lean posture; (3) 34-year-old adult father with gentle smile, warm crow's feet, neatly groomed beard, and cozy olive knit sweater. Matching real-life facial features from reference photos: [PhotoURLs]. Neutral photographic studio backdrop, warm rim lighting, rich subsurface scattering on skin, tactile cloth textures, 8k resolution, cinematic character turn-around sheet.`

### Hero Prop Sheet Formula:
> `Multi-angle model sheet of a [Year Make Model Prop, e.g., 2000 Honda Accord coupe], Pixar-style 3D stylized vehicle turnaround: front 3/4 view, side profile, and rear 3/4 view. Characterized by slightly rounded exaggerated proportions, glossy slightly weathered paint, detailed dashboard with nostalgic air freshener. Neutral gray studio lighting, crisp shadows, feature animation production asset.`

---

## 5. Scene Prompting Architecture (Seedance 2.5 Negative Audio Lock)

Every video prompt authors **Visual Action**, **Camera Direction**, and **Negative Audio Directives** to ensure diffusion video clips never clash with the continuous musical score:

### Prompt Structure:
> `[Framing & Camera Move]: Medium cinematic tracking shot, 16:9 widescreen, 24fps.`  
> `[Visual Subject]: 3D Pixar stylized young father holding his baby daughter wrapped in a yellow blanket on the front porch.`  
> `[Action & Acting]: Wordless acting. He gently sways, smiling down with tearful joyful eyes as a warm breeze rustles the trees behind them.`  
> `[Audio Directives]: No background music, no spoken dialogue, atmospheric ambient room tone and foley effects only (gentle crickets, soft porch floorboard creak, night breeze).`

---

## 6. Wiggly writes nothing. You write the JSON. Wiggly checks it and renders.

Call the tools in this order. Look at every image block. Fix every gate error and call the same tool again, up to three tries. Poll `wiggly_get_draft` while stills or clips are rendering, and show those pictures before you ask the person to approve. A rejection names `story-director` or `storyboard-artist`. Call that tool again with the notes. Do not write a still prompt or a clip prompt outside these tools. Do not approve assets, the animatic, or production yourself.

1. `wiggly_open_upload`, then `wiggly_list_uploads`. You look at each photo and you write `skinTone` and `description`.
2. `wiggly_submit_draft` with format `my-pixar-story`. This spends nothing.
3. `wiggly_story_director`. Call it with no draft first. Send the JSON back as `draft`.
4. `wiggly_character_architect` and `wiggly_location_scout`, in either order, after the story director passes. Look at the character photo.
5. Poll `wiggly_get_draft` until the sheet stills are back. Show them. The person approves with `wiggly_approve_draft`.
6. `wiggly_storyboard_artist` only after that approval.
7. Poll `wiggly_get_draft` for the panel stills. The person approves the animatic. A rejection sends you back to step 3 or step 6.
8. `wiggly_seedance_compiler` only after the animatic is approved.
9. The person approves production. Clips render. Poll until `ready`, then the video URL is on `wiggly_get_draft`.

A still costs 8 credits. A clip costs 21 credits per second. Credits are taken when that picture or clip is about to render. There is no quote. Text gates spend nothing.

---

## 7. Execution Options

### Option A: Wiggly Studio Cloud MCP (Hosted Zero-Setup)
Connect the official Wiggly MCP server to handle image generation (Nano Banana 2.1), Seedance 2.5 video synthesis, and audio/video assembly automatically:
```json
{
  "mcpServers": {
    "wiggly": {
      "url": "https://wiggly.agentenamel.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_WIGGLY_ACCOUNT_TOKEN"
      }
    }
  }
}
```

### Credits & Pricing:
- $19 grants 1900 credits.
- A still costs 8 credits (Nano Banana 2.1).
- A clip costs 21 credits per second (Seedance 2.5 at 480p).
- Credits are deducted just-in-time when that picture or clip is about to render.
- Text gates spend 0 credits.
- One job runs at a time. A short balance pauses and returns a top-up link. There is no quote.
