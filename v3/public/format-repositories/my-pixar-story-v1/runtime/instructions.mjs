import {z} from 'zod';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const checksum=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const sha=s=>createHash('sha256').update(s).digest('hex');
// Config may narrow permissions. It cannot grant ambient tools or another role's tools.
export const maximumTools={"script-writer": ["readAsset"], "text-reviewer": ["readAsset", "viewImage"], "cast-designer": ["readAsset", "viewImage"], "sheet-prompter": ["readAsset", "viewImage"], "background-product-owner": ["readAsset", "viewImage"], "pixar-prompter": ["readAsset", "viewImage"], "shot-planner": ["readAsset", "viewImage"], "composition-writer": ["readAsset", "viewImage"], "motion-director": ["readAsset", "viewImage"], "video-prompt-engineer": ["readAsset", "viewImage"], "sound-designer": ["readAsset", "listenAudio", "measureAudio"], "film-editor": ["readAsset", "viewImage", "watchVideo", "listenAudio", "measureAudio"], "audio-reviewer": ["readAsset", "listenAudio", "measureAudio", "transcribe", "speakerSimilarity"], "visual-reviewer": ["readAsset", "viewImage", "watchVideo"], "generation-planner": ["readAsset", "viewImage"]};
const text=z.string().trim().min(1);
const names={"script-writer": "Leo", "text-reviewer": "Sage", "cast-designer": "Cleo", "sheet-prompter": "Pia", "background-product-owner": "Beau", "pixar-prompter": "Pia", "shot-planner": "Sam", "composition-writer": "Cam", "motion-director": "Mo", "video-prompt-engineer": "Vin", "sound-designer": "Finn", "film-editor": "Eli", "audio-reviewer": "Ava", "visual-reviewer": "Vera", "generation-planner": "Max"};
const agents=z.object(Object.fromEntries(Object.entries(maximumTools).map(([role,tools])=>[role,z.object({name:z.literal(names[role]),model:text,skill:z.literal(`crew/${names[role].toLowerCase()}/SKILL.md`),tools:z.array(z.enum(tools)).min(1).refine(v=>new Set(v).size===v.length)}).strict()]))).strict();
export const StudioConfig=z.object({version:z.literal(1),writingPolicy:z.literal('grounded-v1').optional(),agents,
 generation:z.object({voice:z.object({provider:z.literal('cartesia'),model:text,apiVersion:text}).strict(),image:z.object({provider:z.literal('meta-muse'),model:z.literal('muse-image-1.0'),estimatedUnitCostUsd:z.literal(.01)}).strict(),video:z.object({provider:z.literal('replicate'),profile:z.literal('seedance-mini-480p'),model:z.literal('seedance-2.0-mini'),resolution:z.literal('480p')}).strict(),mediaReview:z.object({provider:z.literal('gemini'),model:z.literal('gemini-3.8-flash'),samplingFps:z.literal(4)}).strict(),music:z.object({provider:z.literal('elevenlabs'),model:z.literal('music_v2_5'),enabledByDefault:z.literal(false)}).strict(),effect:z.object({provider:z.literal('elevenlabs'),model:z.literal('eleven_text_to_sound_v2'),enabledByDefault:z.literal(false)}).strict()}).strict(),
 limits:z.object({generationAttempts:z.number().int().min(1).max(3),reviewDisagreements:z.number().int().min(1).max(2),finishedWorkerAttempts:z.number().int().min(1).max(3),crewTasksPerDispatch:z.number().int().min(1).max(32),initialSpendCeilingUsd:z.literal(0)}).strict(),
 reviewers:z.object({'text-reviewer':z.literal('evaluation/rubrics/text.md'),'audio-reviewer':z.literal('evaluation/rubrics/audio.md'),'visual-reviewer':z.literal('evaluation/rubrics/visual.md')}).strict(),
 recipes:z.object({characterPrompt:z.literal('character-prompter.md'),sheetPrompt:z.literal('character-sheet-recipe.md'),backgroundPrompt:z.literal('background-prompter.md'),backgroundAnglePrompt:z.literal('background-prompter.md')}).strict(),communication:z.literal('orchestrator-voice.md')}).strict();
const Document=z.object({content:z.string().min(1),sha256:text.regex(/^[a-f0-9]{64}$/)}).strict().refine(d=>sha(d.content)===d.sha256,'Instruction content hash changed.');
export const StudioSnapshot=z.object({config:StudioConfig,documents:z.record(z.string(),Document),sha256:text}).strict().superRefine((s,ctx)=>{
 if(checksum({config:s.config,documents:s.documents})!==s.sha256)ctx.addIssue({code:'custom',message:'STUDIO_SNAPSHOT_CHANGED: bundle hash mismatch.'});
 for(const path of [...Object.values(s.config.agents).map(a=>a.skill),...Object.values(s.config.reviewers),...Object.values(s.config.recipes),s.config.communication])if(!s.documents[path])ctx.addIssue({code:'custom',message:`Missing pinned instruction ${path}`});
});
export function loadStudio(root=new URL('../',import.meta.url)){
 const config=StudioConfig.parse(JSON.parse(readFileSync(new URL('studio.json',root),'utf8'))),documents={};
 for(const path of new Set([...Object.values(config.agents).map(a=>a.skill),...Object.values(config.reviewers),...Object.values(config.recipes),config.communication])){const content=readFileSync(new URL(path,root),'utf8');documents[path]={content,sha256:sha(content)};}
 return StudioSnapshot.parse({config,documents,sha256:checksum({config,documents})});
}
// Missing snapshot means an older project; never silently adopt current editable files.
export const studioFor=p=>p.studio?StudioSnapshot.parse(p.studio):null;
export const limitsFor=p=>studioFor(p)?.config.limits??{generationAttempts:3,reviewDisagreements:2,finishedWorkerAttempts:3,crewTasksPerDispatch:8,initialSpendCeilingUsd:0};
export function recipeFor(p,stage,fallback){const s=studioFor(p);return s?s.documents[s.config.recipes[stage]]:fallback;}
export function workerInstructions(p,role){const s=studioFor(p);if(!s)return null;const agent=s.config.agents[role];if(!agent)return null;return {skill:{path:agent.skill,...s.documents[agent.skill]},allowedTools:agent.tools,studioVersion:s.config.version,studioSha256:s.sha256};}
export function communicationFor(p){const s=studioFor(p);return s?{path:s.config.communication,...s.documents[s.config.communication]}:null;}

// Historical runs have no snapshot. Keep their supported defaults fixed.
export const legacyGeneration={voice:{model:'sonic-3.6-2026-08-27',apiVersion:'2026-08-14'},image:{model:'muse-image-1.0',estimatedUnitCostUsd:.01},video:{model:'seedance-2.0-mini',resolution:'480p'},music:{model:'music_v2_5'},effect:{model:'eleven_text_to_sound_v2'}};
