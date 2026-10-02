import { z } from 'zod';
import { createHash } from 'node:crypto';

export const VERSION = '2.0.0';
export const text = z.string().trim().min(1);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const Inputs = z.object({
  subject: z.object({ fullName: text, preferredName: text, recipientName: text,
    relationshipToRecipient: z.enum(['parent', 'grandparent', 'spouse']),
  }).passthrough(),
  answers: z.object(Object.fromEntries(['scene1Childhood', 'scene2TeenFreedom', 'scene3LeapOfFaith',
    'scene4Romance', 'scene5LegacyFinale'].map(key => [key, z.record(z.string(), text).refine(v => Object.keys(v).length > 0)]))),
}).passthrough();
export const File = z.object({ path: text, sha256: text.regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive(), durationSeconds: z.number().positive().optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional() });
const Script = z.object({
  beats: z.array(z.object({ beat: z.number().int(), durationSeconds: z.literal(15), narration: text,
    emotionalPurpose: text, sourceAnswers: z.array(z.enum(Object.keys(Inputs.shape.answers.shape))).min(1),
  })).length(4).refine(beats => beats.every((b, i) => b.beat === i + 1), 'Exactly four ordered 15-second beats'),
  commonSenseChecks: z.array(z.object({ category: z.enum(['character', 'age', 'location', 'prop', 'action', 'fact']),
    finding: text, resolution: text })),
});
const Character = z.object({ id: text.regex(/^[a-z][a-z0-9-]*$/), name: text, ageVariant: text,
  important: z.literal(true), references: z.array(File).min(1), notes: text });
const slug = text.regex(/^[a-z][a-z0-9-]*$/);
const Scene = z.object({ id: slug, beat: z.number().int().min(1).max(4), description: text, action: text, characterIds: z.array(slug), sourceAnswers: z.array(z.enum(Object.keys(Inputs.shape.answers.shape))) });
const Brief = z.object({ direction: text, sceneIds: z.array(slug).min(1), knownDetails: z.array(text), proposedDetails: z.array(text), continuityNotes: text, references: z.array(File).default([]) });
const BackgroundPrompt = z.object({ prompt: text, recipeSha256: text, briefDigest: text, changeSummary: text });
export const Content = {
  shots: z.object({ shots: z.array(z.object({ id: slug, sceneId: slug, locationId: slug, angleId: slug.nullable(), beat: z.number().int().min(1).max(4), startSeconds: z.number().nonnegative(), durationSeconds: z.number().positive().max(15), characterIds: z.array(slug), camera: text, action: text, staging: text, continuityNotes: text })).min(4) }),
  keyframePrompt: z.object({ prompt: text, shotDigest: text, references: z.array(z.object({ role: z.enum(['setting', 'character']), artifactId: text, sha256: text, characterId: slug.optional() })).min(1) }),
  keyframe: z.object({ files: z.array(File).length(1), prompt: text }),
  backgrounds: z.object({ locations: z.array(z.object({ id: slug, name: text, scenes: z.array(Scene).min(1), angles: z.array(z.object({ id: slug, sceneIds: z.array(slug).min(1), direction: text })) })).min(1) }),
  backgroundBrief: Brief, backgroundAngleBrief: Brief,
  backgroundPrompt: BackgroundPrompt, backgroundAnglePrompt: BackgroundPrompt,
  backgroundCandidates: z.object({ files: z.array(File).length(3), prompt: text }),
  backgroundAngle: z.object({ files: z.array(File).length(1), prompt: text }),
  script: Script,
  voiceSample: z.object({ files: z.array(File).length(1), consent: z.literal(true), language: text }),
  clone: z.object({ voiceId: text, provider: z.literal('cartesia'), receiptId: text }),
  audition: z.object({ files: z.array(File).length(1), voiceId: text, transcript: text }),
  narration: z.object({ files: z.array(File).length(4), voiceId: text, transcripts: z.array(text).length(4), model: text }),
  roster: z.object({ characters: z.array(Character).min(1).refine(xs => new Set(xs.map(c => c.id)).size === xs.length, 'Unique character IDs') }),
  candidates: z.object({ files: z.array(File).length(3), prompt: text }),
  sheetPrompt: z.object({ prompt: text, recipeSha256: text, referenceSha256: text,
    turnaround: z.tuple([z.literal('front'), z.literal('three-quarter'), z.literal('profile'), z.literal('back')]),
    expressions: z.array(text).length(8) }),
  sheet: z.object({ files: z.array(File).length(1), prompt: text }),
};
export const criteria = {
  shots: ['coverage', 'timing', 'scene-fit', 'references', 'staging', 'continuity'],
  keyframePrompt: ['scene-fit', 'reference-grounding', 'staging', 'camera', 'continuity'],
  keyframe: ['scene-fit', 'likeness', 'anatomy', 'setting-continuity', 'staging', 'style', 'composition'],
  backgrounds: ['scene-coverage', 'locations', 'angles', 'common-sense'],
  backgroundBrief: ['scene-fit', 'facts', 'spatial-action', 'continuity'],
  backgroundAngleBrief: ['scene-fit', 'facts', 'spatial-action', 'continuity'],
  backgroundPrompt: ['brief-fit', 'style', 'spatial-action', 'continuity'],
  backgroundAnglePrompt: ['brief-fit', 'style', 'spatial-action', 'continuity'],
  backgroundCandidates: ['scene-fit', 'style', 'empty-environment', 'spatial-action', 'continuity'],
  backgroundAngle: ['scene-fit', 'style', 'empty-environment', 'spatial-action', 'continuity'],
  script: ['facts', 'relationship', 'clarity', 'emotional-purpose', 'timing', 'common-sense'],
  audition: ['integrity', 'voice-match', 'delivery', 'safety'],
  narration: ['integrity', 'transcript', 'duration', 'natural-rate', 'voice-match', 'delivery', 'safety'],
  roster: ['completeness', 'age-variants', 'references'],
  candidates: ['likeness', 'style', 'anatomy', 'consistency'],
  sheetPrompt: ['reference-grounding', 'layout', 'identity'],
  sheet: ['likeness', 'style', 'anatomy', 'turnaround', 'expressions', 'consistency'],
};
export const Review = z.object({
  decision: z.enum(['approved', 'rejected', 'inconclusive']), repairTarget: z.enum(['current', 'script']).default('current'),
  perception: z.enum(['direct-text', 'direct-image', 'direct-audio', 'unavailable']),
  checks: z.array(z.object({ criterion: text, status: z.enum(['pass', 'fail', 'inconclusive']), evidence: text,
    location: text, repair: z.string().default('') })).min(1),
  measurements: z.object({
    transcripts: z.array(text).optional(), speechToTextMethod: text.optional(),
    speakerSimilarity: z.number().min(0).max(1).optional(), speakerSimilarityMethod: text.optional(),
    referenceSha256: text.optional(), speakingRateWpm: z.array(z.number().positive()).optional(),
    silenceSeconds: z.array(z.number().nonnegative()).optional(), measurementNotes: text.optional(),
  }).optional(),
});
export const Plans = z.object({ provider: z.enum(['cartesia', 'meta-muse']), operation: z.enum(['clone', 'audition', 'narration', 'candidates', 'sheet', 'backgroundCandidates', 'backgroundAngle', 'keyframe']),
  estimatedCostUsd: z.number().nonnegative(), parameters: z.object({ model: text.optional(), prompt: text.optional(), cartesiaVersion: text.optional() }).strict() }).strict();
export const Event = z.object({ taskId: text, action: z.enum(['artifact', 'owner-review', 'start-backgrounds', 'start-shots', 'review', 'approve', 'changes', 'reject', 'note', 'resolve', 'plan', 'authorize', 'begin', 'job-id', 'receipt', 'provider-error', 'reconcile', 'allowance']),
  actor: z.enum(['agent', 'reviewer', 'human', 'runtime']), workerId: text.optional(),
  artifactId: text.optional(), artifactDigest: text.optional(), message: text.optional(), selection: z.number().int().optional(),
  content: z.unknown().optional(), review: Review.optional(), plan: Plans.optional(), jobId: text.optional(),
  providerJobId: text.optional(), result: z.unknown().optional(), allowance: z.object({ operations: z.array(Plans.shape.operation).min(1), maxRequests: z.number().int().positive(), maxCostUsd: z.number().nonnegative() }).strict().optional(),
}).strict();
export const Project = z.object({
  formatVersion: z.literal(VERSION), schemaVersion: z.literal(2), id: text,
  inputs: Inputs, step: z.enum(['script', 'voiceSample', 'clone', 'audition', 'narration', 'roster', 'candidates', 'sheetPrompt', 'sheet', 'backgrounds', 'backgroundBrief', 'backgroundPrompt', 'backgroundCandidates', 'backgroundAngleBrief', 'backgroundAnglePrompt', 'backgroundAngle', 'shots', 'keyframePrompt', 'keyframe', 'video']),
  gate: z.enum(['author', 'owner-review', 'review', 'human', 'produce', 'authorize', 'collect', 'escalate', 'pending']),
  characterId: z.string().nullable(), locationId: z.string().nullable().default(null), angleId: z.string().nullable().default(null), shotId: z.string().nullable().default(null), sequence: z.number().int().nonnegative(),
  artifacts: z.array(z.object({ id: text, key: text, kind: text, version: z.number().int().positive(), digest: text,
    content: z.unknown(), dependencies: z.array(text), valid: z.boolean(), authoredBy: text,
    ownerReview: Review.optional(), review: Review.optional(), approvedBy: z.object({ message: text, at: text }).optional(), selection: z.number().int().optional(),
  })),
  jobs: z.array(z.object({ id: text, key: text, plan: Plans, request: z.record(z.string(), z.unknown()), allowanceId: text.optional(), digest: text, dependencies: z.array(text),
    status: z.enum(['planned', 'authorized', 'submitting', 'submitted', 'ready', 'failed', 'uncertain']),
    providerJobId: text.optional(), authorization: z.object({ message: text, at: text }).optional(), result: z.unknown().optional(),
  })),
  history: z.array(z.object({ sequence: z.number(), action: text, actor: text, message: z.string(), at: text })),
  allowances: z.array(z.object({ id: text, operations: z.array(Plans.shape.operation), maxRequests: z.number().int().positive(), maxCostUsd: z.number().nonnegative(), message: text, at: text })),
  feedback: z.array(z.object({ key: text, message: text })), reviewDisagreements: z.number().int().nonnegative(),
});
