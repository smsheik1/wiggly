# Dan Kieft's Pixar Prompter — The Official Wiggly Standard

Purpose: The single canonical standard for the entire Pixar format pipeline.

**Single source of truth:** Pacing numbers, beat counts and fidelity rules live in this file only. Wrapper prompts and agent instructions must not restate, change or override them. If a wrapper conflicts with this file, this file wins.

- Part Zero: Ideation & Screenplay Engineering (for the Screenplay Author Agent)
- Part One: Character & Keyframe Render Contracts (for the Image Technical Director)
- Part Two: Seedance 2.5 Video Generation & Motion Physics (for the Video Prompt Engineer)
- Part Three: Operating Method & Pre-Flight Checklists

House Style Throughout: Stylized feature-animation 3D. Production CG, RenderMan path-traced lighting, not photorealistic and not flat cartoon.

---

## PART ZERO — IDEATION AND SCRIPT (Scriptwriter Agent)

Nothing gets prompted until the story works. Assets built on a shaky script get rebuilt.

### 0.1 Adapt the Voice to the Relationship

People use this format for diverse personal stories. The screenwriter agent must identify the relationship between subject and recipient, locking one consistent point of view from Beat 1 through Beat 5:

- **Parent to Child (Father/Mother to Daughter/Son):** An intimate, bedside conversation. The subject speaks directly to the child (${recipientName}) in first person across all five beats. Simple, honest, vulnerable words. The message is never a resume of achievements. It is about love, human imperfection, and what the child changed in the parent. At least one beat must admit a fear, a mistake, or a cost, using the parent's own words from the answers.
- **Grandparent to Grandchildren:** Generational legacy and love. A warm elder passing down their life story to the grandchildren ("Before I go, I want you to know where our journey started...").
- **Founder to Customers / Community:** Humanizing the brand. The founder speaks directly and vulnerably to the community about the real struggle, doubt and passion behind why the company or craft was created.
- **Curated Mythic Storyteller:** If third-person narration is chosen, maintain a warm, observant fable tone consistently across all 5 beats. Never switch POV halfway through.

### 0.2 Never Transcribe Q&A Verbatim (with one exception)

Interview answers are raw memory mines, NOT spoken dialogue. Extract the single strongest memory for each beat, never the literal sentences.

- Strip out resume bullet points, Wikipedia timelines and dense corporate exposition.
- Keep physical, tactile objects that anchor memory, and take them from the parent's answers. For illustration only: a flour-dusted apron, a drum stool with a cracked seat, a lunchbox with a dented lid, rare snow on asphalt.
- **Exception:** a line someone actually said aloud in the answers is kept word for word (see 0.10).

### 0.3 Pacing (the only place these numbers live)

- **The 60-Second Master Architecture:** 5 chapters $\times$ 12 seconds baseline = 60 seconds total film (variable pacing allows 12s / 12s / 11s / 13s / 12s to let emotional beats breathe).
- **18 to 24 words per beat**, one memory per beat. At the measured voice pace of about 2.8 words per second, that is roughly 6 to 8.5 seconds of speech.
- **Final beat: 14 to 18 words**, then a silent hold.
- **The 3-Second Silence Floor:** Every clip keeps at least 3 seconds without speech. Never fill the whole clip with voiceover.
- **Tail-Trimming Law:** Raw 15-second diffusion clips (Seedance 2.0 Mini) are trimmed strictly from the tail (head frames 0 to 372 @ 30fps = 12.4s). Never trim the head, which destroys the master keyframe anchor.
- **Dissolve Overlap Parity:** 5 clips at 12.4 seconds each with 0.5-second cross-dissolves across 4 cut points yields exactly 60.0 seconds of master broadcast runtime ($5 \times 12.4\text{s} - 4 \times 0.5\text{s} = 60.0\text{s}$).
- Short, natural sentences that breathe. The voiceover sets the emotional frequency; the acoustic piano score, silence and physical character business carry the drama.

### 0.4 Directing Rules

- **Ordinary world must be ordinary:** Contrast drives comedy and emotional impact.
- **Rule of three:** Establish pattern, repeat, then break it.
- **Escalate running gags:** Give physical ladders to recurring elements.
- **Payoff planted early:** If an object or phrase pays off in the final beat, plant it in Beat 1 or Beat 2. (Illustration: a dented lunchbox seen on a school morning returns in the last frame.)
- **Business beats dialogue:** Physical action (kneading dough, tying a skate lace, wiping a fogged window) speaks louder than exposition. Choose actions that appear in the parent's answers.
- **Cut to the reaction:** The reaction shot is worth more than the action shot.

### 0.5 Lock Dialogue Before Shot Listing

- Every spoken line verbatim in {}.
- Spoken words drive shot duration, audio pacing and lip animation.

### 0.6 The Storyboard Prompt

- Painted color boards, not rough line art.
- 16:9 landscape panels on warm off-white canvas (#B5B5B5 or #E4E6D9).
- Two sentences per panel:
  1. What is in frame (shot size, angle, characters, action).
  2. The lighting and palette.

### 0.7 Fidelity: Facts Come Only From the Answers

- Every name, date, age, place, object and prop in the script must appear in the parent's answers. Never add outside knowledge about the subject, even when the subject is a public figure.
- Era labels use only ages or years the parent gave, or a plain life stage (Childhood, Teen Years, Young Adult, New Parent, Today). Never add real-world years, career-era names or ages that were not provided.
- Ages and life stages must ascend across beats.
- If a detail is missing, stay general. Never invent one.
- Examples in this file illustrate technique only. Never reuse their objects, phrases, openings or endings.

### 0.8 Answer-to-Beat Map

| Beat | Built from |
|---|---|
| Beat 1 | scene1 (childhood) |
| Beat 2 | scene2 (teen freedom) |
| Beat 3 | scene3 (leap of faith) |
| Beat 4 | scene4 (the anchor: arrival, everyday memory, the moment everything changed) |
| Beat 5 | scene5 (legacy and wisdom) |

- Each beat is built from the ONE strongest answer in its scene, plus at least one concrete detail from that answer. Leftover answers are cut, not squeezed in.
- Beat 5 is built from what the parent wishes the child understood, or what the parent feared, in the parent's own words. It never defaults to a generic statement of pride.

### 0.9 Script Pre-Flight (all must pass before any asset is built)

- [ ] POV, recipient name and relationship are consistent in every beat
- [ ] Every name, age, place and prop traces back to the answers (0.7)
- [ ] Ages and life stages ascend
- [ ] Each beat is one memory at 18 to 24 words (Beat 5: 14 to 18)
- [ ] One object or phrase from Beat 1 or 2 pays off in Beat 5
- [ ] At least one beat admits a fear, mistake or cost, in the parent's own words
- [ ] Any line someone actually said in the answers is kept word for word (0.10)
- [ ] No stock phrases: "proud doesn't begin to cover it," "my whole world," "meant everything," "my greatest masterpiece," or any "Long before..." opener
- [ ] The final line is one specific image or sentence, not a statement of feeling
- [ ] Every sentence has a clear grammatical subject (no dangling modifiers, no two locations in one sentence)

### 0.10 Keep Real Quotes

If an answer contains a line someone actually said (a child's words, a friend's joke, a parent's advice), keep it word for word and let it carry its beat. It is the one thing the script cannot improve on.

---

## PART ONE — IMAGES (Image Technical Director)

### 1.1 The Character Contract

The prompt is split into FIXED lines (unbreakable studio rendering rules) and SWAP lines (character-specific DNA).

**Design Rules**

- **Dominant Silhouette:** Reads clearly in solid black; describable in 3 words.
- **One Exaggeration + Counterpart:** If eyes are large, mouth and chin are small. (Otherwise diffusion models average it back.)
- **Head Proportions:**
  - Toddler: 4 heads
  - Child (6–10): 4.5–5 heads (long torso, short legs, low center of gravity)
  - Teen: 6–6.5 heads
  - Adult: 7 heads (never put child proportion riders on adults!)
- **Hands:** Large, rounded forms, thick blunt fingertips, minimal knuckle clutter, soft simple palms.
- **Signature Worn Item:** One worn or attached item carrying the ONLY saturated color in an otherwise muted palette (e.g. red suspenders, turquoise scrunchie, bright blue sneakers).
- **Wear Tells a Story:** Grime where hands touch, pale scuffed edges.
- **Facial Hair:** Soft matte shell over the skin, NOT individual drawn strands.

**The Canonical Character Template**

```text
A single-character full-body render from a feature-quality 3D animated film, production CG, RenderMan path-traced global illumination, not photorealistic and not flat cartoon.
Eyes: a small iris surrounded by a wide band of white sclera, clearly visible on both sides of it. The iris takes up about a third of the eye opening. The eyeball is a sphere bigger than the opening, and the lids cut across it. The upper eyelid is a thick band of skin resting over the eyeball, casting a shadow onto it. No dark outline or liner drawn around the eye. Eyelashes short, blunt and sparse.
Eyebrows: [Groomed / Graphic / Sparse]
Face: [The exaggeration and its counterparts]. [Plane changes]. A dimensional mouth with rounded lips.
Subject: [Age, sex, build, skin tone, one-line personality].
Facial hair: [Soft matte shell tint, or omit if none].
Skin: [Light or Deep SSS zoning]. Matte skin with distinct color zones (red-orange nose and ear rims, plum-red cheek transition, cool grey-violet under eyes). Warm subsurface glow through ears and fingertips.
Hands: slender or worked, built from large rounded forms, blunt fingertips, minimal knuckle detail.
Silhouette: [N] heads tall, [Dominant shape]. Reads clearly as [Shape] in black silhouette.
Hair: [Length, color, texture], sculpted volume with lit rim edges, casting soft contact shadows onto forehead. Matte.
Wardrobe: [Garments]. [Signature element worn] is the only saturated colour in an otherwise muted palette. Cloth with weight, few large folds, grime in creases, unbranded.
Pose: neutral reference stance, weight on one leg, hip out, head level, light closed-lip smile, eyes to camera, hands empty at sides.
Camera: 50mm straight on at chest height, full body with feet in frame.
Background: flat grey studio backdrop, empty (#B5B5B5).
```

**Unbreakable Image Rules**

- **Nothing in hands:** Reference sheets must have empty hands.
- **No ink or pen marks on skin:** Models always render ink as tattoos.
- **No Octane / Unreal Engine 5:** Banned forever. Use RenderMan path-traced lighting.

### 1.2 The Master Scene Keyframe Contract (One Frame Per Chapter)

Each chapter has ONE master scene keyframe (t = 0s) that establishes the shot. No "End Frame B" is used. Seedance animates directly from this single master keyframe.

**The Scene Keyframe Rules**

- **Pixar Feature Film House Aesthetic:** Must open with: A wide cinematic film still from a feature-length 3D animated film by Pixar Animation Studios (in the signature stylized animation aesthetic of Up, Ratatouille, and The Incredibles). RenderMan path-traced global illumination.
- **Caricature Characters, NOT Video Game Humans:**
  - Characters MUST adhere strictly to the approved character model sheets.
  - Stylized expressive facial planes, large animated eyes with spherical geometry and soft drop shadows, smooth matte skin with soft translucent peach subsurface scattering on ears and cheeks.
  - Strictly banned: photorealistic human skin pores, hyper-realistic facial wrinkles, realistic arm/body hair, and video-game textures.
- **Painterly Graphic Environments, NOT Industrial Clutter:**
  - Backgrounds must feature simplified, appealing geometric shapes and warm painterly textures.
  - Do NOT list 10 specific part numbers or hardware brands. Focus on atmospheric warmth (golden sunbeams, dusty air motes, soft textured surfaces) and build the setting only from places and objects named in the parent's answers.
- **Framing & Aspect Ratio:**
  - 16:9 widescreen landscape composition (1344x768).
  - Accordion lens focal length (50mm -> 35mm -> 50mm -> 65mm -> 85mm).

---

## PART TWO — VIDEO (Video Prompt Engineer)

### 1. Source Hierarchy

- **Authoritative:** Seedance 2.0 Mini keyframe-conditioned motion, reference binding and audio-first pacing.
- **Performance:** Acting, eye life, objective-driven movement, moving holds.
- **Never Live-Action:** Strip all 35mm film stock, grain, shutter angles and pore texture language.

### 2. The 12 Principles of Animation (Seedance Physics)

- **Anticipation:** Movement winds the opposite way before it moves.
- **Arcs:** Heads and hands travel in curved trajectories, never robotic linear paths.
- **Snap and Settle:** Fast between key poses; arrivals overshoot slightly and settle back.
- **Secondary Action & Follow-Through:** Hair mass and cloth lag by one beat and settle past the stop.
- **Moving Holds:** A held pose is never frozen: subtle breathing, weight shifts and blinks.
- **Eye Life:** Continuous micro-saccades, living asymmetric catchlights, eyes reach target before head turns.
- **Performance:** Body plays broad; face stays honest and sincere. Zero cartoon mugging.

### 3. The Unbreakable Single Chapter Shot Law

- Each 12.4-second chapter is a single, continuous cinematic shot generated from its approved master keyframe (`keyframe-[N]`).
- Seedance generates a 15-second diffusion clip anchored on the master keyframe at t = 0s.
- Tail-Trimming Law: Remotion strictly trims the clip from the tail (head frames 0 to 372 @ 30fps = 12.4s). The keyframe anchor at t = 0s is preserved untouched.
- Strictly NO internal cuts, scene transitions, or camera jumps within a chapter clip.

### 4. Video Prompt Syntax Block

```text
[REFERENCE ANCHOR]
@keyframe = keyframe-[N] (t = 0s master keyframe establishing composition, lighting, character likeness)

[CHARACTER & SCENE CONTINUITY]
Subject: [Character name, age, attire from approved keyframe]
Setting: [Authentic location from approved keyframe]

[PERFORMANCE & CAMERA ARC]
Camera: [Cinematic 5-Beat Accordion lens & movement: e.g. slow atmospheric push-in, gentle organic drift]
Action: [Subject physical business, subtle breathing, hand gestures, eye movement]
Emotion: [Sincere, grounded acting, warm subtle smile, zero cartoon mugging]

[ANIMATION PHYSICS (Seedance 2.0 Mini)]
Real-time motion, strictly no slow motion.
Motion: Anticipation, curved arcs, snap and settle, hair and cloth follow-through, moving holds with natural breathing.
Eye life: Micro-saccades, living catchlights, eyes dart to target before head turns.

[EXCLUSIONS]
No extra cuts or scene transitions inside the shot — continuous 12.4s single take.
No live-action photorealism, no plastic sheen, no distorted anatomy, no warped props.
```

---

## PART THREE — OPERATING METHOD (Antigravity Agent)

### Operating Rules

- Every revision opens with what changed.
- Always output the prompt in full. Never output fragments, loose shots, or "same as above except".
- Hard 30-second ceiling per segment.
- Dialogue in {} on its own line, speaker first.
- No empty placeholders or generic avoids.

### Pre-Flight Checklists

**Script gate (before Part One begins):** Run the 0.9 checklist against the screenplay. Revise until every box passes, and report the result at the top of the script output.

**Image gate:**

- [ ] Reference sheets have empty hands
- [ ] No ink or pen marks on skin
- [ ] No Octane / Unreal Engine 5 language; RenderMan path-traced lighting only
- [ ] Master keyframe is 16:9 (1344x768), opens with the Pixar feature-film line, and uses only settings and props from the answers

**Video gate:**

- [ ] One block = one shot; shot and transition counts stated explicitly
- [ ] No segment over 30 seconds; timecodes in whole seconds
- [ ] Dialogue in {} on its own line, speaker first, matching the locked script
- [ ] EXCLUSIONS and MAINTAIN CONSISTENCY blocks are filled in, with no placeholders
