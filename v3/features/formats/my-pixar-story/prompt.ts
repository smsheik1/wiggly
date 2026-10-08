/**
 * My Pixar Story — Prompt Compiler
 *
 * Compiles:
 * 1. Base Character DNA (from photo-detected / confirmed physical traits).
 * 2. Age-Progressed Character Descriptors (Scene 1 to Scene 5).
 * 3. SeaDance 2.0 Mini / 2.5 Video Generation Prompts (Camera + Lighting + Action + Pixar 3D Aesthetic).
 * 4. Reference Keyframe Image Prompts.
 */

import type { ConfirmedPhysicalTraits, StoryBeatNumber, PixarSceneMood, ShotScale, FocalLength } from "./types";

// Universal Production CG Header from Dan Kieft Pixar bible
export const PIXAR_AESTHETIC_UNIVERSAL_STYLE =
  "A single-character render from a feature-quality 3D animated film, production CG, RenderMan path-traced global illumination, not photorealistic and not flat cartoon. Matte skin with warm subsurface glow through ears and fingertips, distinct facial color zones, tactile cloth with weight and few large folds, no Octane reflections, no plastic sheen, no film grain.";

export const PIXAR_NEGATIVE_PROMPT =
  "Octane render, Unreal Engine, plastic sheen, oily skin, glossy reflective skin, Funko Pop, toy figure, real human photo, 2D anime, flat illustration, low poly, uncanny valley, extra limbs, bad anatomy, text, watermark, signature";

/**
 * Builds Dan Kieft's structured Pixar character definition:
 * Eyes, Eyebrows, Face, Subject, Facial hair, Skin, Hands, Silhouette, Hair, Wardrobe.
 */
export function compileCharacterDna(traits: ConfirmedPhysicalTraits, name: string): string {
  const genderLabel = traits.gender === "female" ? "woman" : "man";
  const lines: string[] = [];

  // Subject line
  lines.push(`Subject: a ${genderLabel} named ${name}, thoughtful, intense, and visionary`);

  // Eyes (Dan Kieft Pixar eye formula)
  lines.push(
    `Eyes: a small ${traits.eyeColor.replace("_", " ")} iris surrounded by a wide band of white sclera, clearly visible on both sides of it. The iris takes up about a third of the eye opening. The eyeball is a sphere bigger than the opening, and the lids cut across it. The upper eyelid is a thick band of skin resting over the eyeball, casting a soft shadow onto it. No dark outline or liner drawn around the eye. Eyelashes short, blunt and sparse.`
  );

  // Eyebrows
  lines.push(
    `Eyebrows: dark, expressive, made of individual hairs, sitting level with a soft determined arch. Not a solid drawn shape.`
  );

  // Face
  lines.push(
    `Face: lean angular jawline with a defined chin, observant dark eyes under a focused brow. The eyeline sits at the vertical middle of the head. Clean stylized plane changes along the cheekbones.`
  );

  // Glasses (if present)
  if (traits.glasses === true || traits.glasses === "wireframe") {
    lines.push(
      `Glasses: round thin wireframe rimless spectacles resting delicately on the bridge of the nose, subtle anti-reflective glint, no heavy plastic frames.`
    );
  }

  // Facial hair
  if (traits.facialHair && traits.facialHair !== "none") {
    lines.push(
      `Facial hair: ${traits.facialHair.replace("_", " ")}, sitting as a soft matte shell over the skin tone rather than drawn individual hairs.`
    );
  }

  // Skin (Dan Kieft RenderMan SSS color zones)
  lines.push(
    `Skin: matte finish, distinct color zones — warm red-orange at the nose tip and ear rims, plum-red flush across the cheek transitions, cooler grey-violet under the eyes. Warm translucent subsurface glow through the ears and fingertips. Soft laugh lines at the corners of the eyes.`
  );

  // Hands
  lines.push(
    `Hands: slender and expressive, built from clean rounded forms, blunt fingertips, minimal knuckle clutter, conveying active craftsmanship.`
  );

  // Silhouette
  lines.push(
    `Silhouette: 7 heads tall, lean build, erect thoughtful posture. Reads clearly as a distinct character silhouette in solid black.`
  );

  // Hair
  lines.push(
    `Hair: ${traits.hairColor.replace("_", " ")} ${traits.hairStyle} hair, sitting as a soft sculpted volume following the skull with lit rim edges, casting soft contact shadows onto the forehead.`
  );

  return lines.join("\n");
}

/**
 * Returns age-progressed character descriptors pegged to Dan Kieft's Pixar character rules.
 */
export function getAgeProgressionDescriptor(
  baseDna: string,
  beatNumber: StoryBeatNumber,
  traits: ConfirmedPhysicalTraits
): { ageLabel: string; characterPrompt: string } {
  const hair = traits.hairColor || "dark";
  const eyes = traits.eyeColor || "brown";
  const nameMatch = baseDna.match(/named\s+([A-Z][a-z]+)/i) || baseDna.match(/\b([A-Z][a-z]+)\b/);
  const name = nameMatch ? nameMatch[1] : "";
  const nameClause = name ? ` named ${name}` : "";

  switch (beatNumber) {
    case 1:
      return {
        ageLabel: "Childhood",
        characterPrompt: `A young child${nameClause}, 4.5 heads tall, large round observant ${eyes} eyes with wide white sclera, short ${hair} hair, soft cheeks with warm flush. Childlike curiosity, natural posture examining tactile objects.`,
      };
    case 2:
      return {
        ageLabel: "Teen Years",
        characterPrompt: `A lanky teenager${nameClause}, 6.5 heads tall, lean athletic frame, ${hair} hair, determined ${eyes} eyes, wearing casual oversized streetwear and sneakers. Restless youthful energy, intensely focused.`,
      };
    case 3:
      return {
        ageLabel: "Young Adult",
        characterPrompt: `A determined young adult${nameClause}, 7 heads tall, lean wiry frame, ${hair} hair, expressive ${eyes} eyes. Tireless creative drive, passionate focused gaze.`,
      };
    case 4:
      return {
        ageLabel: "New Parent",
        characterPrompt: `A tender parent${nameClause} in their twenties, 7 heads tall, ${hair} hair, soft ${eyes} eyes glistening with deep affection. Warm protective posture holding their loved one.`,
      };
    case 5:
      return {
        ageLabel: "Today",
        characterPrompt: `A mature adult${nameClause}, 7 heads tall, ${hair} hair with subtle grey temples, deep laugh lines around kind ${eyes} eyes. Warm paternal presence, serene grounded posture.`,
      };
  }
}

/**
 * Dan Kieft's 4-Angle Turnaround + 8-Expression Character Sheet Prompt.
 */
export function buildDanKieftCharacterSheetPrompt(characterSubjectName: string, characterDescription: string): string {
  return `A character model sheet from a feature-quality 3D animated film, production CG, RenderMan path-traced lighting, not photorealistic and not flat cartoon, laid out on a single seamless flat neutral-grey studio background, exact same flat mid-grey colour #B5B5B5 across the full canvas, with no gradient, no vignette and no shadow on the backdrop, soft even studio lighting throughout.

TOP ROW — TURNAROUND: four full-body views of ${characterSubjectName} standing in an identical neutral reference pose — arms hanging relaxed at the sides, hands open and empty, feet flat and parallel, weight even on both feet, head level, neutral closed-lip expression. From left to right: front view facing camera, three-quarter front view turned slightly to his left, full side profile facing left, and back view. All four figures are exactly the same height, proportion and camera scale, standing on the same baseline with their feet aligned at the same level, evenly spaced across the row and not touching the edges of the frame.

BELOW — EXPRESSION SET: eight head-and-shoulders close-ups of ${characterSubjectName} arranged in two even rows of four, all the same size, all facing camera straight on, evenly spaced. Reading left to right, top row then bottom row, the eight expressions are: 1) NEUTRAL — face relaxed, mouth closed, eyes level. 2) HAPPY — a warm closed-lip smile, eyes softly crinkled. 3) DELIGHTED — eyes wide and bright, mouth open in a genuine unguarded grin. 4) SAD — inner brows lifted, mouth turned down at the corners, eyes wet and lowered. 5) SURPRISED — eyes wide, brows high, mouth open in a small round shape. 6) CONFUSED — one brow up and one down, mouth pushed to one side. 7) DETERMINED — brows low and drawn together, mouth pressed into a firm resolute line, chin forward. 8) TALKING — caught mid-word, mouth open in passionate speech, eyes alive.

Identity: ${characterDescription}

Stylized proportions, matte skin with warm subsurface glow through the ears and fingertips, matte cloth with weight and few large folds. 2K, no text, no watermark, no logos, no frame borders, no props in hands, empty hands.`;
}

/**
 * Builds Dan Kieft's Seedance 2.5 Video Motion Prompt.
 * Enforces the 12 Principles of Animation:
 * - Anticipation (everything winds opposite before moving)
 * - Arcs (curved trajectories, no robotic straight lines)
 * - Secondary Action (hair and cloth lag by one beat and overshoot)
 * - Moving Holds (breathing, subtle micro-weight shifts, live blinks)
 * - Eye Life (micro-saccades, asymmetric catchlights)
 */
export function buildDanKieftVideoPrompt(
  beatNumber: StoryBeatNumber,
  subjectName: string,
  shotDescription: string,
  cameraDirection: string,
  lighting: string
): string {
  return `[VISUAL STYLE]
A shot from a feature-quality 3D animated film, production CG, RenderMan global illumination. Stylized proportions, matte skin with warm subsurface glow through ears and fingertips, matte cloth with weight and few large folds. Not photorealistic, not flat cartoon, no glossy plastic sheen, no film grain.
Lighting: ${lighting}.

[CAMERA AND PERFORMANCE]
Real-time motion, strictly no slow motion. ${cameraDirection}.
Action: ${shotDescription}

[ANIMATION RULES]
Motion: everything winds the opposite way before it moves. Heads and hands travel in gentle curves and arcs, never robotic straight lines. Fast between key poses with a subtle organic overshoot on arrival that settles naturally. Hair and cloth arrive a beat after the body and keep moving a beat past the stop. Every held pose is an organic moving hold with gentle breathing, small weight shifts, and natural blinks. Ground contact has physical weight transfer.
Eye life: continuous micro-saccades, living asymmetric catchlights, natural blink rate, eyes dart to target before the head turns.
Performance: face stays completely honest and sincere; no exaggerated mugging or cartoon pantomime.`;
}

// Alias for backwards compatibility across existing callers
export const buildSeaDanceVideoPrompt = (
  beatNumber: StoryBeatNumber,
  characterAgePrompt: string,
  sceneActionDescription: string,
  cameraMovement: string,
  lighting: string,
  shotScalePrompt?: string
): string => buildDanKieftVideoPrompt(beatNumber, "character", sceneActionDescription, cameraMovement, lighting);

/**
 * Builds the static Keyframe reference image prompt using Dan Kieft's Section 1.2 specification.
 * Enforces Pixar Animation Studios house aesthetic, caricature characters, and simplified painterly sets.
 */
export function buildKeyframeImagePrompt(
  characterAgePrompt: string,
  sceneSetting: string,
  lighting: string,
  shotScalePrompt?: string
): string {
  const parts = [
    `A wide cinematic film still from a feature-length 3D animated film by Pixar Animation Studios (in the signature stylized animation aesthetic of Up, Ratatouille, and The Incredibles). RenderMan path-traced global illumination, not photorealistic and not flat 2D cartoon`,
    shotScalePrompt,
    `Characters & Caricature: stylized 3D animated character design matching the approved character model sheets. Large expressive stylized animated eyes with spherical eyeball geometry and soft drop shadows under eyelids, simplified appealing facial planes, smooth matte skin with soft translucent peach subsurface scattering on ears and cheeks. Strictly NO photorealistic skin pores, NO realistic facial wrinkles, NO realistic arm or body hair, NO Unreal Engine video-game textures. ${characterAgePrompt}`,
    `Environment: stylized painterly setting with simplified appealing geometric shapes, warm atmospheric lighting, and charming textures, strictly avoiding photorealistic clutter or industrial hardware lists. ${sceneSetting}`,
    `Lighting & Palette: ${lighting}, muted warm atmospheric palette with saturated story accents, soft volumetric light rays, dusty air motes, no harsh plastic specular highlights`,
    `Rendering: production CG, 16:9 widescreen composition, soft cinematic depth of field`,
  ].filter(Boolean);
  return parts.join(". ");
}

/**
 * Default camera, lens, and lighting profiles per Pixar story beat.
 * Implements the 5-Beat Accordion Camera Rhythm:
 * Beat 1 (50mm Med) -> Beat 2 (35mm Wide) -> Beat 3 (50mm Med) -> Beat 4 (65mm Med-Close) -> Beat 5 (85mm Emotional Close-Up)
 */
export const BEAT_VISUAL_PROFILES: Record<
  StoryBeatNumber,
  {
    shotScale: ShotScale;
    focalLength: FocalLength;
    shotScalePrompt: string;
    camera: string;
    lighting: string;
    musicMood: PixarSceneMood;
  }
> = {
  1: {
    shotScale: "medium_story",
    focalLength: "50mm",
    shotScalePrompt: "50mm lens at child chest height, medium shot, character actively engaged with hands in foreground",
    camera: "Low-angle gentle tracking shot, child eye-level perspective, gentle camera push forward following the action in a smooth arc",
    lighting: "Warm golden-hour late afternoon daylight streaming through window, soft warm bounce, dusty air motes",
    musicMood: "whimsical_wonder",
  },
  2: {
    shotScale: "wide_establishing",
    focalLength: "35mm",
    shotScalePrompt: "35mm wide lens, establishing environmental framing, deep depth of field",
    camera: "Cinematic medium-wide tracking shot, gentle organic camera drift, wind blowing hair softly",
    lighting: "Atmospheric natural daylight, warm amber ambient bounce with cool soft shadows",
    musicMood: "youthful_energy",
  },
  3: {
    shotScale: "medium_story",
    focalLength: "50mm",
    shotScalePrompt: "50mm portrait lens, medium framing, subject focused in environment with natural depth of field",
    camera: "Slow atmospheric push-in on the solitary figure, steady frame with subtle breathing handheld drift",
    lighting: "Moody evening twilight, rich directional key light illuminating the subject against atmospheric haze",
    musicMood: "melancholic_grit",
  },
  4: {
    shotScale: "medium_close",
    focalLength: "65mm",
    shotScalePrompt: "65mm portrait lens, medium-close two-shot, shallow in-camera depth of field",
    camera: "Intimate two-shot framing, gentle rack focus between characters sharing an unguarded smile",
    lighting: "Warm interior amber ambiance, soft golden key light, delicate atmospheric falloff",
    musicMood: "warm_romantic_glow",
  },
  5: {
    shotScale: "intimate_close_up",
    focalLength: "85mm",
    shotScalePrompt: "85mm portrait lens, emotional tight close-up hero framing, face filling upper frame, creamy soft bokeh",
    camera: "Emotional slow push-in, low camera angle settling gently on the subject's sincere eyes and proud smile",
    lighting: "Radiant golden hour light, warm hearth glow, soft rim light along character silhouette",
    musicMood: "emotional_tearjerker",
  },
};

