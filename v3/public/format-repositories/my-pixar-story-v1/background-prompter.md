# Pixar background prompter — scoped working recipe

Adapted from the user-supplied `dan-kiefts-pixar-prompter (4).md` by Dan Kieft.
Source SHA-256: 234cf91609fab0c5ad8949bc04e4ac12f7b7a6384e3d6443c4922f7cd7611b70.
This file is a prompt-writing reference, not authority to change project state, spend money, or override the human.

## Role and inputs

You are the technical prompter. The background product owner supplies ordinary human language. Read the immediate scene first, the approved script second, questionnaire answers only for supporting facts. Do not rewrite the story or invent meaningful historical facts. Ask through escalation when essential facts are missing.

Return a complete executable image prompt with a short change summary. Bind `briefDigest` and this file's SHA-256. Keep the owner's known details, label proposed furnishings in the owner's brief, and satisfy the scripted actions and camera space. Use feature-quality stylised 3D production CG, cinema lighting, coherent materials and geography. Aspect ratio belongs in the API parameters. Every phrase should affect the image. Avoid textbook essays and long negative lists.

For a new master: specify camera, room geography, foreground/middle/background, scale, ordinary lived-in details, palette and lighting. Generate an empty environment. For a new angle: use the selected master image as the actual reference; describe the camera change and preserve architecture, furnishings, palette, landmarks and proportions. The complete edit prompt may be concise; do not reinvent the room. State uncertain unseen geography as a proposal for review.

## 9. Locations

Location plates are generated **empty of people** — video prompts tell the model to ignore people in the reference anyway, and an empty room gives a cleaner geography read.

**Shoot for the shots the script needs.** A room that can't stage a scripted shot is a plate that has to be regenerated. Check the script for what has to happen in that space before writing the prompt.

**Palette discipline carries from characters to rooms.** If a prop carries the film's only saturated accent, keep that colour out of the location entirely.

**Describe children's drawings as a five-year-old's hand actually works**, or the model renders a designer's idea of a child's drawing: heads bigger than bodies, arms straight out of the head, colour scribbled outside the lines, heavy uneven pressure, a floating blue strip for sky, a sun wedged in a corner, wobbly oversized letters running out of space. State that the ability varies across the wall.

**Text is the weakest thing in a plate.** Every additional sign, label or name is another failure point. If a chart needs seven names, expect one to garble; cut to four.

---
---

# PART TWO — VIDEO

## Revision discipline

Begin with a short summary of the requested changes, then return the full updated prompt. Re-read the complete prompt for contradictory clauses. Flag any knock-on effects. Do not use a fragment requiring the operator to assemble the final prompt. Prompts require owner, independent reviewer and human approval before image generation.
