import { z } from 'zod';

export const CharacterSchema = z.object({
  tag: z.string().describe('Unique tag, e.g. @Shaz_Adult or @Mia_Child'),
  name: z.string().describe('Character display name'),
  ageOrStage: z.string().describe('Life stage or age, e.g. "8-year-old child" or "34-year-old adult"'),
  referencePhotoUrls: z.array(z.string().url()).default([]).describe('Real family photo URLs for facial likeness and continuity'),
});

export const HeroPropSchema = z.object({
  tag: z.string().describe('Unique prop tag, e.g. @2000_Honda_Accord or @Acoustic_Guitar'),
  name: z.string().describe('Prop name'),
  description: z.string().describe('Physical description of the vehicle, instrument, or keepsake'),
  referencePhotoUrls: z.array(z.string().url()).optional().default([]).describe('Optional photo URLs of the real object'),
});

export const StoryBeatSchema = z.object({
  beatId: z.number().int().min(1).max(10).describe('1-based story beat index'),
  durationSec: z.number().min(4).max(30).default(10).describe('Duration in seconds'),
  action: z.string().describe('Wordless emotional character action and visual staging'),
  camera: z.string().describe('Camera move, angle, and framing (e.g. "Low tracking shot, 16:9")'),
  narrationLine: z.string().optional().describe('Parent reflective voiceover line spoken during this scene'),
  foleyDescription: z.string().optional().default('warm atmospheric room tone, gentle breeze').describe('Ambient foley and room tone (no background music)'),
});

export const StoryboardSchema = z.object({
  title: z.string().min(1).describe('Title of the memoir film'),
  subject: z.string().min(1).describe('Subject or recipient, e.g. "Shaz" or "Mia"'),
  beats: z.array(StoryBeatSchema).min(1).max(10).describe('Chronological story beats'),
  characters: z.array(CharacterSchema).min(1).describe('Family cast members with photo references'),
  heroProps: z.array(HeroPropSchema).optional().default([]).describe('Hero objects requiring visual turnaround sheets'),
});

export const VoiceoverSchema = z.object({
  type: z.enum(['parent_clone', 'studio_narrator']).default('studio_narrator').describe('Voiceover delivery type'),
  voiceSampleUrl: z.string().url().optional().describe('10-second reference audio for voice cloning (if parent_clone selected)'),
});

export const SubmitFilmInputSchema = z.object({
  idempotencyKey: z.string().min(8).describe('Unique client-generated idempotency key to prevent double billing'),
  storyboard: StoryboardSchema,
  voiceover: VoiceoverSchema.optional().default({ type: 'studio_narrator' }),
  tier: z.enum(['standard_preview', 'theatrical_1080p']).optional().default('standard_preview').describe('Target quality tier'),
});

export const GetFilmInputSchema = z.object({
  jobId: z.string().min(1).describe('The unique film job ID returned by wiggly_submit_film'),
});

export const FinalizeFilmInputSchema = z.object({
  jobId: z.string().min(1).describe('The unique film job ID returned by wiggly_submit_film'),
  action: z.enum(['reroll_shot', 'order_1080p_master']).describe('Approval action: order 1080p master or reroll a defective shot'),
  rerollShotId: z.number().int().min(1).optional().describe('The beatId/shotId to reroll (required when action is reroll_shot)'),
  rerollNotes: z.string().optional().describe('Director notes explaining the defect or adjustment for the reroll'),
});

export type CharacterInput = z.infer<typeof CharacterSchema>;
export type HeroPropInput = z.infer<typeof HeroPropSchema>;
export type StoryBeatInput = z.infer<typeof StoryBeatSchema>;
export type StoryboardInput = z.infer<typeof StoryboardSchema>;
export type VoiceoverInput = z.infer<typeof VoiceoverSchema>;
export type SubmitFilmInput = z.infer<typeof SubmitFilmInputSchema>;
export type GetFilmInput = z.infer<typeof GetFilmInputSchema>;
export type FinalizeFilmInput = z.infer<typeof FinalizeFilmInputSchema>;
