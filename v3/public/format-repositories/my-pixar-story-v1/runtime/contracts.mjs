import { z } from 'zod';
import { createHash } from 'node:crypto';
import {StudioSnapshot} from './instructions.mjs';

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
export const File = z.object({ path: text, sha256: text.regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive(), durationSeconds: z.number().positive().optional(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(), fps: z.number().positive().optional(), hasAudio: z.boolean().optional() });
const CastProposal = z.array(z.object({id:text.regex(/^[a-z][a-z0-9-]*$/),name:text,ageVariant:text,minor:z.boolean(),storyPurpose:text})).min(1).refine(xs=>new Set(xs.map(c=>c.id)).size===xs.length, 'Unique proposed character IDs');
const Script = z.object({
  proposedCast: CastProposal.optional(),
  beats: z.array(z.object({ beat: z.number().int(), durationSeconds: z.literal(15), narration: text,
    emotionalPurpose: text, sourceAnswers: z.array(z.enum(Object.keys(Inputs.shape.answers.shape))).min(1),
  })).length(4).refine(beats => beats.every((b, i) => b.beat === i + 1), 'Exactly four ordered 15-second beats'),
  commonSenseChecks: z.array(z.object({ category: z.enum(['character', 'age', 'location', 'prop', 'action', 'fact']),
    finding: text, resolution: text })),
});
const Character = z.object({ id: text.regex(/^[a-z][a-z0-9-]*$/), name: text, ageVariant: text,
  important: z.literal(true), references: z.array(File), notes: text });
const slug = text.regex(/^[a-z][a-z0-9-]*$/);
export const IntakeConfirmation=z.object({
 voiceConsent:z.literal(true),
 characters:z.array(z.object({id:slug,name:text,ageVariant:text,minor:z.boolean(),photoRights:z.literal(true),guardianAuthority:z.boolean().optional(),references:z.array(File),likeness:z.enum(['reference','interpreted','omit','await-reference']),decisionNotes:text})).min(1),
 resolvedFindings:z.array(z.object({findingDigest:text,resolution:text})),
}).strict();
const Scene = z.object({ id: slug, beat: z.number().int().min(1).max(4), description: text, action: text, characterIds: z.array(slug), sourceAnswers: z.array(z.enum(Object.keys(Inputs.shape.answers.shape))) });
const Brief = z.object({ direction: text, sceneIds: z.array(slug).min(1), knownDetails: z.array(text), proposedDetails: z.array(text), continuityNotes: text, references: z.array(File).default([]) });
const BackgroundPrompt = z.object({ prompt: text, recipeSha256: text, briefDigest: text, changeSummary: text });
const Origin = z.object({ source: z.enum(['generated','imported']), description: text, usageRights: text });
export const Content = {
  audioReviewerQualification: z.object({workerId:text,modelVersion:text,capabilityVersion:text,datasetDigest:text,predictionDigest:text,qualified:z.literal(true),verifiedMedia:z.literal(true),cases:z.number().int().positive(),evaluatedAt:text,productionApproval:z.literal(false),evidenceDirectory:text,metrics:z.array(z.object({criterion:z.enum(['integrity','transcript','natural-rate','voice-match','mix','safety']),passes:z.number().int().nonnegative(),defects:z.number().int().nonnegative(),errors:z.number().int().nonnegative(),qualified:z.boolean()}))}),
  reviewerQualification: z.object({ workerId:text, modelVersion:text, capabilityVersion:text.optional(), datasetDigest:text, predictionDigest:text, qualifiedScopes:z.array(z.enum(['image','video'])), verifiedMedia:z.literal(true), evaluatedAt:text, cases:z.number().int().positive(), productionApproval:z.literal(false), evidenceDirectory:text, metrics:z.array(z.object({kind:z.enum(['image','video']),criterion:z.enum(['anatomy','identity','continuity']),passes:z.number().int().nonnegative(),defects:z.number().int().nonnegative(),errors:z.number().int().nonnegative(),qualified:z.boolean()})) }),
  videoPlan: z.object({ resolution:z.enum(['480p','1080p']), clips:z.array(z.object({ id:slug, shotId:slug, startSeconds:z.number().nonnegative(), durationSeconds:z.number().positive(), generationSeconds:z.number().int().min(4).max(15), camera:text, action:text, anchors:text, atmosphere:text })).min(4) }),
  videoPrompt: z.object({ prompt:text, clipDigest:text, keyframeId:text, keyframeSha256:text, repairOnly:z.boolean().default(false) }),
  video: z.object({ files:z.array(File).length(1), prompt:text, keyframeSha256:text, providerJobId:text }),
  soundPlan: z.object({ music:z.object({ mode:z.enum(['generate','import']), prompt:text, durationSeconds:z.literal(60), provenance:Origin }).nullable(), noMusicReason:z.string().default(''), effects:z.array(z.object({id:slug,mode:z.enum(['generate','import']),prompt:text,startSeconds:z.number().nonnegative(),durationSeconds:z.number().min(.5).max(30),gainDb:z.number().min(-60).max(0),provenance:Origin})), noEffectsReason:z.string().default('') }),
  music: z.object({files:z.array(File).length(1),prompt:text,provenance:Origin}),
  effect: z.object({files:z.array(File).length(1),prompt:text,provenance:Origin}),
  editPlan: z.object({clips:z.array(z.object({clipId:slug,sourceOffsetSeconds:z.number().nonnegative()})).min(4),narrationGainDb:z.number().min(-20).max(12),musicGainDb:z.number().min(-60).max(-6),duckMusic:z.boolean(),effectGainDb:z.number().min(-60).max(0),musicFadeInSeconds:z.number().min(0).max(5),musicFadeOutSeconds:z.number().min(.1).max(10),audioHolds:z.tuple([text,text,text,text])}),
  film: z.object({files:z.array(File).length(1),rendererDigest:text.optional(),sceneDigest:text.optional(),editPlanDigest:text,manifestDigest:text,inspection:z.object({durationSeconds:z.number(),width:z.number(),height:z.number(),fps:z.number(),hasAudio:z.boolean(),integratedLufs:z.number(),truePeakDb:z.number(),blackSeconds:z.number().nonnegative(),freezeSeconds:z.number().nonnegative()}),contactSheet:File,provenance:z.array(z.object({artifactId:text,digest:text}))}),
  shots: z.object({ shots: z.array(z.object({ id: slug, sceneId: slug, locationId: slug, angleId: slug.nullable(), beat: z.number().int().min(1).max(4), startSeconds: z.number().nonnegative(), durationSeconds: z.number().positive().max(15), characterIds: z.array(slug), camera: text, action: text, staging: text, continuityNotes: text })).min(4) }),
  keyframePrompt: z.object({ prompt: text, shotDigest: text, references: z.array(z.object({ role: z.enum(['setting', 'character']), artifactId: text, sha256: text, characterId: slug.optional() })).min(1) }),
  keyframe: z.object({ files: z.array(File).length(1), prompt: text }),
  backgrounds: z.object({ locations: z.array(z.object({ id: slug, name: text, scenes: z.array(Scene).min(1), angles: z.array(z.object({ id: slug, sceneIds: z.array(slug).min(1), direction: text })) })).min(1) }),
  backgroundBrief: Brief, backgroundAngleBrief: Brief,
  backgroundPrompt: BackgroundPrompt, backgroundAnglePrompt: BackgroundPrompt,
  backgroundCandidates: z.object({ files: z.array(File).length(3), prompt: text }),
  backgroundAngle: z.object({ files: z.array(File).length(1), prompt: text }),
  answers: z.object({ inputs: Inputs, sourceInputDigest: text, commonSenseChecks: Script.shape.commonSenseChecks }),
  characterPrompt: z.object({prompt:text, characterDigest:text, referenceHashes:z.array(text), recipeSha256:text}),
  script: Script,
  voiceSample: z.object({ files: z.array(File).length(1), consent: z.literal(true), language: text }),
  clone: z.object({ voiceId: text, provider: z.literal('cartesia'), receiptId: text }),
  audition: z.object({ files: z.array(File).length(1), voiceId: text, transcript: text }),
  narration: z.object({ files: z.array(File).length(4), voiceId: text, transcripts: z.array(text).length(4), model: text, sourceFiles:z.array(File).length(4).optional(), tailSilenceSeconds:z.array(z.number().nonnegative()).length(4).optional() }),
  roster: z.object({ characters: z.array(Character).min(1).refine(xs => new Set(xs.map(c => c.id)).size === xs.length, 'Unique character IDs') }),
  candidates: z.object({ files: z.array(File).length(3), prompt: text }),
  sheetPrompt: z.object({ prompt: text, recipeSha256: text, referenceSha256: text,
    turnaround: z.tuple([z.literal('front'), z.literal('three-quarter'), z.literal('profile'), z.literal('back')]),
    expressions: z.array(text).length(8) }),
  sheet: z.object({ files: z.array(File).length(1), prompt: text }),
};
Content.shotIntentions = z.object({locations:Content.backgrounds.shape.locations,shots:Content.shots.shape.shots});
export const criteria = {
  audioReviewerQualification:['media-provenance','heldout-coverage','defect-recall','false-rejections'],
  reviewerQualification:['media-provenance','heldout-coverage','defect-recall','false-rejections'],
  videoPlan:['coverage','timing','keyframe-grounding','motion','continuity'],
  videoPrompt:['keyframe-grounding','motion','physical-anchors','camera','continuity'],
  video:['integrity','anatomy','identity','continuity','motion'],
  soundPlan:['story-fit','piano-score','effect-timing','provenance'],
  music:['integrity','piano-score','story-fit','no-vocals','provenance'],
  effect:['integrity','story-fit','timing','provenance'],
  editPlan:['timeline','narration-preservation','mix','continuity','provenance'],
  film:['technical','story','visual-continuity','motion','narration','mix','safety','provenance'],
  shotIntentions:['coverage','timing','scene-fit','references','staging','continuity'],
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
  answers: ['source-grounding','completeness','relationships','age-variants','locations','common-sense'],
  characterPrompt: ['cast-fit','reference-grounding','style','anatomy','composition'],
  script: ['facts', 'relationship', 'clarity', 'emotional-purpose', 'timing', 'common-sense'],
  audition: ['integrity', 'voice-match', 'delivery', 'safety'],
  narration: ['integrity', 'transcript', 'duration', 'natural-rate', 'voice-match', 'delivery', 'safety'],
  roster: ['completeness', 'age-variants', 'references'],
  candidates: ['likeness', 'style', 'anatomy', 'consistency'],
  sheetPrompt: ['reference-grounding', 'layout', 'identity'],
  sheet: ['likeness', 'style', 'anatomy', 'turnaround', 'expressions', 'consistency'],
};
export const Review = z.object({
  decision: z.enum(['approved', 'provisional', 'rejected', 'inconclusive']), repairTarget: z.enum(['current', 'script']).default('current'), repairArtifactId:text.optional(),
  perception: z.enum(['direct-text', 'direct-image', 'direct-audio', 'direct-video', 'direct-audiovisual', 'unavailable']),
  checks: z.array(z.object({ criterion: text, status: z.enum(['pass', 'fail', 'inconclusive']), evidence: text,
    location: text, repair: z.string().default('') })).min(1),
  modelVersion:text.optional(), capabilityVersion:text.optional(),
  coverage:z.object({artifactSha256:text,videoSeconds:z.number().positive().optional(),audioSeconds:z.number().positive().optional(),audioFiles:z.array(z.object({sha256:text,seconds:z.number().positive()})).optional()}).optional(),
  toolEvidence:z.array(z.object({tool:text,sha256:text,referenceSha256:text.optional(),seconds:z.number().positive().optional()})).optional(),
  measurements: z.object({
    transcripts: z.array(text).optional(), speechToTextMethod: text.optional(),
    speakerSimilarity: z.number().min(0).max(1).optional(), speakerSimilarityMethod: text.optional(),
    referenceSha256: text.optional(), speakingRateWpm: z.array(z.number().positive()).optional(),
    silenceSeconds: z.array(z.number().nonnegative()).optional(), measurementNotes: text.optional(),
  }).optional(),
});
export const Plans = z.object({ provider: z.enum(['cartesia', 'meta-muse', 'replicate', 'elevenlabs']), operation: z.enum(['clone', 'audition', 'narration', 'candidates', 'sheet', 'backgroundCandidates', 'backgroundAngle', 'keyframe', 'video', 'music', 'effect']),
  estimatedCostUsd: z.number().nonnegative(), parameters: z.object({ model: text.optional(), prompt: text.optional(), cartesiaVersion: text.optional() }).strict() }).strict();
const CreativeDirection=z.object({scope:z.enum(['script','cast']),direction:text,sourceMessages:z.array(text).min(1)}).strict();
export const Event = z.object({ taskId: text, action: z.enum(['configure-debug','debug-next','debug-stop','upgrade-studio','refresh-writing-instructions','configure-crew', 'configure-review','set-budget','reserve-compute', 'start-audio-review', 'audio-qualified', 'artifact', 'owner-review', 'start-backgrounds', 'start-shots', 'start-studio', 'qualified', 'rendered', 'review', 'approve', 'changes', 'redo', 'abandon', 'reject', 'note', 'resolve', 'plan', 'authorize', 'begin', 'job-id', 'receipt', 'provider-error', 'reconcile', 'allowance']),
  creativeDirection:CreativeDirection.optional(), debugEnabled:z.boolean().optional(),
  budgetLimitUsd:z.number().nonnegative().optional(), reservation:z.object({id:text,provider:z.enum(['gemini','cartesia-stt']),estimatedCostUsd:z.number().positive()}).strict().optional(),
  actor: z.enum(['agent', 'reviewer', 'human', 'runtime']), workerId: text.optional(),
  resolvedFindings:z.array(z.object({findingDigest:text,resolution:text})).optional(), intakeConfirmation:IntakeConfirmation.optional(), impactDigest:text.optional(), artifactId: text.optional(), artifactDigest: text.optional(), message: text.optional(), selection: z.number().int().optional(),
  reviewMode:z.enum(['supervised','qualified']).optional(), humanReview:Review.optional(), crew:z.unknown().optional(), content: z.unknown().optional(), review: Review.optional(), plan: Plans.optional(), jobId: text.optional(),
  providerJobId: text.optional(), result: z.unknown().optional(), allowance: z.object({ operations: z.array(Plans.shape.operation).min(1), maxRequests: z.number().int().positive(), maxCostUsd: z.number().nonnegative(), repairOf:z.string().optional() }).strict().optional(),
}).strict();
export const Project = z.object({
  formatVersion: z.literal(VERSION), schemaVersion: z.literal(2), id: text,
  studio:StudioSnapshot.optional(),
  debug:z.object({enabled:z.boolean(),paused:z.boolean()}).strict().optional(),
  workflowRevision:z.number().int().min(2).max(4).default(2),
  productionProfile:z.enum(['legacy-seedance-hd','seedance-mini-480p']).default('legacy-seedance-hd'),
  budget:z.object({maxCostUsd:z.number().nonnegative(),reservations:z.array(z.object({id:text,provider:z.enum(['gemini','cartesia-stt']),estimatedCostUsd:z.number().positive()}))}).optional(), lifecycle:z.enum(['active','abandoned']).default('active'), reviewMode:z.enum(['supervised','qualified']).default('qualified'), crew:z.unknown().optional(), inputs: Inputs, step: z.enum(['answers', 'characterPrompt', 'script', 'voiceSample', 'clone', 'audioReviewerQualification', 'audition', 'narration', 'roster', 'candidates', 'sheetPrompt', 'sheet', 'backgrounds', 'backgroundBrief', 'backgroundPrompt', 'backgroundCandidates', 'backgroundAngleBrief', 'backgroundAnglePrompt', 'backgroundAngle', 'shotIntentions', 'shots', 'keyframePrompt', 'keyframe', 'video', 'reviewerQualification', 'videoPlan', 'videoPrompt', 'soundPlan', 'music', 'effect', 'editPlan', 'film', 'complete']),
  gate: z.enum(['author', 'owner-review', 'review', 'human', 'produce', 'authorize', 'collect', 'escalate', 'pending']),
  characterId: z.string().nullable(), locationId: z.string().nullable().default(null), angleId: z.string().nullable().default(null), shotId: z.string().nullable().default(null), clipId:z.string().nullable().default(null), effectId:z.string().nullable().default(null), sequence: z.number().int().nonnegative(),
  artifacts: z.array(z.object({ id: text, key: text, kind: text, version: z.number().int().positive(), digest: text,
    content: z.unknown(), dependencies: z.array(text), valid: z.boolean(), authoredBy: text,
    resolvedFindings:z.array(z.object({findingDigest:text,resolution:text})).optional(), intakeConfirmation:IntakeConfirmation.optional(), humanReview:Review.optional(), visualReview:Review.optional(),audioReview:Review.optional(),visualReviewedBy:text.optional(),audioReviewedBy:text.optional(), ownerReview: Review.optional(), review: Review.optional(), reviewSequence:z.number().int().optional(), approvedBy: z.object({ message: text, at: text }).optional(), selection: z.number().int().optional(),
  })),
  jobs: z.array(z.object({ id: text, key: text, plan: Plans, request: z.record(z.string(), z.unknown()), allowanceId: text.optional(), digest: text, dependencies: z.array(text),
    status: z.enum(['planned', 'authorized', 'submitting', 'submitted', 'ready', 'failed', 'uncertain']),
    providerJobId: text.optional(), authorization: z.object({ message: text, at: text }).optional(), result: z.unknown().optional(), reconciliation:z.object({outcome:text,message:text,at:text}).optional(),
  })),
  history: z.array(z.object({ sequence: z.number(), action: text, actor: text, message: z.string(), at: text })),
  allowances: z.array(z.object({ id: text, operations: z.array(Plans.shape.operation), maxRequests: z.number().int().positive(), maxCostUsd: z.number().nonnegative(), repairOf:z.string().optional(), message: text, at: text })),
  creativeDirections:z.array(CreativeDirection.extend({message:text,at:text})).optional(),
  feedback: z.array(z.object({ key: text, message: text, intent:z.enum(['detail','redo']).optional() })), reviewDisagreements: z.number().int().nonnegative(),
});
