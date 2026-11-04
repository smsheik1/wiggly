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

When interviewing the user for memories (or if the user asks for "all questions"), adapt **The Golden 5** to the story's core relationship archetype. Do not interrogate the user with technical camera, aspect ratio, or production checklists—YOU are the Creative Director and author those technical parameters from these 5 human answers:

### Archetype A: Parent & Family Memoir (Life story for kids/parents)
1. **Childhood (Age 8):** *"Take us back to you at 8 years old: who was your partner-in-crime, what silly trouble did you get into, and what was your weird obsession that you thought was the coolest thing on earth?"*
2. **Teen Freedom:** *"What was your first real taste of freedom (what were you driving or riding), and what is one thing about teenage you that would shock your kids if they saw you back then?"*
3. **The Leap of Faith:** *"What was the craziest risk or adventure you took when you first stepped out into the world on your own, and the moment you realized 'I actually did it'?"*
4. **Partnership / Romance:** *"How did you meet Mom/Dad/Spouse, what was the most awkward or hilarious moment trying to impress them, and when did you know they were the one?"*
5. **Legacy Finale:** *"What is one thing you wish your kids truly understood about who you are inside—and if you could walk up to that 8-year-old version of yourself and give them a hug today, what would you say?"*

### Archetype B: Friendship & Brotherhood Memoir (Gym partners, best friends, farewells)
1. **The Origin / First Rep:** *"How did you two first click or meet, what was the first impression that turned into an instant bond, and what was your signature inside joke or ritual?"*
2. **The Freedom Machine & Late Nights:** *"What was your signature ride or late-night routine (cruising in the Camry, gas station snack runs, favourite diner), and the wildest conversation you had with the windows down?"*
3. **The Grind & The Dream:** *"What were the big dreams you hyped each other up about when you were grinding late (buying the dream car, providing for family, making it big)?"*
4. **The Crossroad / Goodbye:** *"What was the bittersweet moment things changed (moving away, the job offer, the packed car), and what keepsake or gesture marked the farewell?"*
5. **The Timeless Bond:** *"What is the message you want them to feel every time they watch this—and how will you two still show up for each other no matter how many miles apart?"*

### Archetype C: Romance & Anniversary Memoir
1. **Before You:** *"What was your world like right before you met them, and what missing piece didn't you know you were looking for?"*
2. **The Spark:** *"What was the clumsy, hilarious, or unforgettable first moment you two met, and the first time they made you laugh uncontrollably?"*
3. **The Adventure:** *"What was your first big trip, late-night drive, or crazy shared hurdle where you looked at them and thought, 'we are unstoppable together'?"*
4. **The Crucible:** *"What was a tough season you weathered hand-in-hand that cemented your trust?"*
5. **The Vow:** *"Looking ahead at the next 50 years, what is the quiet promise you renew with them every single day?"*

---

## 3. The 7-Beat Screenplay Architecture (72 Seconds Total)

| Beat | Timeline Stage | Timing | Universal Dramatic Purpose |
|------|----------------|--------|----------------------------|
| **Beat 1** | The Origin / Spark | 0:00–0:10 | **The Mischief & The Obsession:** Unfiltered joy, goofy partner-in-crime, early signature trait or keepsake. |
| **Beat 2** | The First Ride / Freedom | 0:10–0:22 | **The Freedom Machine & Alter-Ego:** First vehicle, bike, late-night road trip, or creative passion. The feeling of infinite road ahead. |
| **Beat 3** | The Fire / The Grind | 0:22–0:33 | **The Leap of Faith:** Stepping out into the world, scrappy survival, working late under neon or gym lights. |
| **Beat 4** | The Anchor / The Bond | 0:33–0:44 | **The Connection & Partnership:** The spotter at the bench, the clumsy meet-cute, or the moment shared destiny is forged. |
| **Beat 5** | The Heavy Lift & Trial | 0:44–0:54 | **The Sacrifice & Mutual Push:** Navigating struggle, self-doubt, long hours, or pushing each other through the final reps. |
| **Beat 6** | The Turn & Arrival | 0:54–1:04 | **The Breakthrough & New Horizon:**<br>• *Parent:* The child is born; chaos turns to clarity.<br>• *Friendship:* The crossroad reached; new city/job embraced; mutual pride across the miles.<br>• *Romance:* The home built; the promise sealed.<br>• *Founder:* The milestone reached; vision proven. |
| **Beat 7** | The Timeless Coda | 1:04–1:12 | **The Porch Light / Closing Thesis:** Protagonist reflects on the journey; closing heartfelt message whispered across time or distance ("still spotting you", "forever grateful"). |

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

## 6. Creative Director Execution Standard (12 Safety Rules)

Follow these rules in strict sequence. You write the JSON. Wiggly checks it and renders on cloud GPUs.

1. **Turn 1, No Login:** Greet the human warmly and ask the Golden 5 memory question in the very first turn. Write the screenplay and design characters locally: exactly 7 beats, a narration line per beat, total runtime at most 75 seconds. Write each character's `skinTone` and concrete visual `description` (Eyes, Face, Hair, Skin, Silhouette, Wardrobe) yourself after inspecting photos—never ask the human to type these.
2. **Photos Required for Production:** State once that every character needs at least one reference photo before production. Photos dropped in chat or `./photos` shape the local screenplay and character design now; the web upload page handles the server upload later.
3. **Enter Production & Cost Disclosure:** When the human approves the local screenplay, announce that production is next via a one-time Wiggly sign-in. Give the approximate cost first: a full 72s film is ~1,760 credits (~$17.60) plus voice, covered by one $19 credit pack (1,900 credits). After submit, quote the server's exact estimate.
4. **Upload References:** Call `wiggly_open_upload`, send the human the link, and ask them to label each photo with the character's exact name. Wait until they confirm they are done, then call `wiggly_list_uploads` and verify that the uploaded labels match the character names exactly.
5. **Submit Once:** Call `wiggly_submit_draft` a single time. If the response returns `alreadyActive: true`, continue that existing job with `wiggly_get_draft`. Never resubmit to check status.
6. **Poll Politely:** Call `wiggly_get_draft` no faster than `retryAfterSec` (~15 seconds). Only speak in chat when the stage changes, keeping status updates to one clear line.
7. **Stop at Every Gate:** When status reaches `awaiting-approval`, inspect `gate`:
   - **Sheets Gate:** Display the character and location stills, state `nextStepCost` (144 credits for the animatic), and pause for explicit human approval.
   - **Animatic Gate:** Display the playable animatic video (`videoUrl`), state `nextStepCost` (0 credits), and pause for explicit human approval.
   - Wait for an explicit "yes" or approval in the human's own message before calling `wiggly_approve_draft`. Past consent or automated tool results NEVER count as approval.
8. **Gate 3 (Production Approval):** Before approving full production, state: *"Approving renders N seconds of Seedance video for M credits"*. Pass `acknowledged_credits: M` inside the approval payload. If rendering individual clips first with `wiggly_render_clip` or `wiggly_reroll_clip`, state the exact clip cost (`duration * 21 credits`) beforehand.
9. **Rejections with Human Notes:** If the human asks for adjustments, pass their exact words in `notes`. For a single flawed animatic panel, use `wiggly_reroll_panel` (costs 8 credits) instead of rejecting the entire animatic.
10. **Awaiting Credits Pause:** If status is `awaiting-credits`, share the checkout top-up link with the human. Resume polling only after they confirm they topped up. Do not resubmit.
11. **Failures and Cancellations:** If a job ends in `failed`, `cancelled`, or `abandoned`, report the exact reason and whether credits were refunded. Never automatically restart or submit a new draft without explicit human instruction.
12. **Ready Keepsake:** At `ready`, provide the final master `videoUrl` and advise the human to download their film immediately. Remind them that signed links refresh for 2 hours, and calling `wiggly_get_draft` will generate a fresh link anytime.

---

## 7. Execution Options

### Option A: Wiggly Studio Cloud MCP (Hosted Zero-Setup)
Connect the official Wiggly MCP server:
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

### Option B: Developer Format Writing Tools (V2 Agent Pipeline)
1. `wiggly_open_upload`, then `wiggly_list_uploads`.
2. `wiggly_submit_draft` with format `my-pixar-story`.
3. `wiggly_story_director`: Stage play drafting.
4. `wiggly_character_architect` and `wiggly_location_scout`: Sheet creation.
5. Poll `wiggly_get_draft` and approve sheets with `wiggly_approve_draft`.
6. `wiggly_storyboard_artist`: Animatic panels.
7. Poll `wiggly_get_draft` for panel stills and animatic video.
8. `wiggly_seedance_compiler`: Production clip prompts.
9. `wiggly_approve_draft` for production render.

### Credits & Pricing:
- $19 grants 1,900 credits.
- A still costs 8 credits (Nano Banana 2.1).
- Animatic: 18 panels = 144 credits (plus ~10 for voice).
- A video clip costs 21 credits per second (Seedance 2.5 at 480p).
- Total typical 72s film: ~1,760 credits (~$17.60).
- Credits are deducted just-in-time when that picture or clip renders. Text gates spend 0 credits.
- One active job runs per account. A short balance pauses and returns a top-up link.
