import {rendererIdentity} from './remotion.mjs';
import { current, locked } from './gates.mjs';
import { shotReferences } from './shots.mjs';
import { digest } from './contracts.mjs';
import { requireVisualQualification } from '../evaluation/visual-qualification.mjs';
export const studioSteps=['reviewerQualification','videoPlan','videoPrompt','video','soundPlan','music','effect','editPlan','film'];
export const clipFor=p=>current(p,'videoPlan')?.content.clips.find(c=>c.id===p.clipId);
export const effectFor=p=>current(p,'soundPlan')?.content.effects.find(c=>c.id===p.effectId);
export const motionPrompt=c=>`Camera: ${c.camera}\nAction: ${c.action}\nPhysical anchors: ${c.anchors}\nAtmosphere: ${c.atmosphere}`;
export function videoBinding(p){const clip=clipFor(p),frame=current(p,`keyframe:${clip.shotId}`);const shot=current(p,'shots').content.shots.find(s=>s.id===clip.shotId);return {clip,frame,shot,references:shotReferences(p,shot),clipDigest:digest(clip),keyframeId:frame.id,keyframeSha256:frame.content.files[0].sha256,prompt:motionPrompt(clip)};}
export function validateVideoPlan(p,plan){
 if(new Set(plan.clips.map(c=>c.id)).size!==plan.clips.length)throw new Error('Unique video clip IDs required.');
 const shots=current(p,'shots').content.shots;
 for(const shot of shots){let end=0;for(const c of plan.clips.filter(c=>c.shotId===shot.id)){if(Math.abs(c.startSeconds-end)>1e-6||c.durationSeconds>c.generationSeconds||Math.abs(c.durationSeconds*30-Math.round(c.durationSeconds*30))>1e-6)throw new Error('Clips must cover each shot in 30fps edit order without gaps/overlaps or time stretching.');end+=c.durationSeconds;}if(Math.abs(end-shot.durationSeconds)>1e-6)throw new Error('Video clips must cover the entire approved shot duration.');}
 if(plan.clips.some(c=>!shots.some(s=>s.id===c.shotId)))throw new Error('Unknown video shot.');
 const order=plan.clips.map(c=>shots.findIndex(s=>s.id===c.shotId));if(order.some((n,i)=>i&&n<order[i-1]))throw new Error('Video clips must follow shot order.');
}
export function validateStudioContent(p,c){
 if(p.step==='reviewerQualification'){requireVisualQualification(c,'image');requireVisualQualification(c,'video');}
 if(p.step==='videoPlan')validateVideoPlan(p,c);
 if(p.step==='videoPrompt'){const b=videoBinding(p);if(c.clipDigest!==b.clipDigest||c.keyframeId!==b.keyframeId||c.keyframeSha256!==b.keyframeSha256)throw new Error('Video prompt must bind the exact approved clip and keyframe.');if(c.prompt.length>4000)throw new Error('Seedance prompt exceeds 4000 characters.');if(c.repairOnly&&!p.feedback.some(f=>f.key===`videoPrompt:${p.clipId}`))throw new Error('Repair-only prompt needs evidenced feedback.');}
 if(p.step==='video'){const prompt=current(p,`videoPrompt:${p.clipId}`).content,f=c.files[0];if(c.prompt!==prompt.prompt||c.keyframeSha256!==prompt.keyframeSha256||!f.durationSeconds||f.durationSeconds+1/30<clipFor(p).durationSeconds||!f.fps||f.width<1280||f.height<720||Math.abs(f.width/f.height-16/9)>.03)throw new Error('Video receipt needs exact prompt/keyframe, measured playable duration and widescreen HD.');}
 if(p.step==='soundPlan'){if(!c.effects.length&&!c.noEffectsReason.trim())throw new Error('Explicit no-effects decision required.');if(new Set(c.effects.map(e=>e.id)).size!==c.effects.length||c.effects.some(e=>e.startSeconds+e.durationSeconds>60))throw new Error('Effects must have unique IDs and stay inside 60 seconds.');if(c.music.provenance.source!==(c.music.mode==='generate'?'generated':'imported')||c.effects.some(e=>e.provenance.source!==(e.mode==='generate'?'generated':'imported')))throw new Error('Sound provenance must match selected source mode.');}
 if(['music','effect'].includes(p.step)){const target=p.step==='music'?current(p,'soundPlan').content.music:effectFor(p);if(c.prompt!==target.prompt||digest(c.provenance)!==digest(target.provenance)||!c.files[0].durationSeconds||c.files[0].width||c.files[0].durationSeconds+.05<target.durationSeconds)throw new Error('Sound asset must match approved prompt/provenance and cover its duration as audio only.');}
 if(p.step==='editPlan'){const clips=current(p,'videoPlan').content.clips;if(c.clips.length!==clips.length||c.clips.some((e,i)=>e.clipId!==clips[i].id||Math.abs(e.sourceOffsetSeconds*30-Math.round(e.sourceOffsetSeconds*30))>1e-6||e.sourceOffsetSeconds+clips[i].durationSeconds>current(p,`video:${e.clipId}`).content.files[0].durationSeconds+.02))throw new Error('Edit must bind all approved clips in order within measured source durations.');}
 if(p.step==='film'){if(c.editPlanDigest!==current(p,'editPlan').digest||c.manifestDigest!==digest(assemblyManifest(p)))throw new Error('Film must bind the approved edit and exact current assets.');assertFilmInspection(c.inspection);}
}
export function assemblyManifest(p){return {renderer:'wiggly-remotion-memoir-v1',rendererDigest:digest(rendererIdentity()),formatVersion:p.formatVersion,projectId:p.id,shots:current(p,'shots').content,videoPlan:current(p,'videoPlan').content,edit:current(p,'editPlan').content,narration:current(p,'narration').content.files,music:current(p,'music').content.files[0],effects:current(p,'soundPlan').content.effects.map(e=>({...e,file:current(p,`effect:${e.id}`).content.files[0]})),clips:current(p,'videoPlan').content.clips.map(c=>({...c,file:current(p,`video:${c.id}`).content.files[0]}))};}
export function assertFilmInspection(m){if(Math.abs(m.durationSeconds-60)>.05||m.width!==1920||m.height!==1080||Math.abs(m.fps-30)>.001||!m.hasAudio||m.integratedLufs< -18||m.integratedLufs> -14||m.truePeakDb> -1||m.blackSeconds>.25)throw new Error('FINAL_TECHNICAL_GATE: need 60s/1080p/30fps/audio, -18…-14 LUFS, ≤-1dB true peak, no long black regions. Freeze measurements require direct review to distinguish defects from intentional holds.');}
export function studioDependencies(p){
 switch(p.step){
 case 'reviewerQualification':return []; // Reviewer calibration is independent of this story's assets.
 case 'videoPlan':return ['shots','reviewerQualification'];
 case 'videoPrompt':return ['videoPlan','reviewerQualification',`keyframe:${clipFor(p).shotId}`];
 case 'video':return ['videoPlan','reviewerQualification',`videoPrompt:${p.clipId}`,`keyframe:${clipFor(p).shotId}`];
 case 'soundPlan':return ['script','narration','videoPlan'];
 case 'music':case 'effect':return ['soundPlan'];
 case 'editPlan':case 'film':case 'complete':return ['shots','videoPlan','narration','soundPlan','music',...current(p,'soundPlan').content.effects.map(e=>`effect:${e.id}`),...current(p,'videoPlan').content.clips.map(c=>`video:${c.id}`),...(p.step!=='editPlan'?['editPlan']:[])];
 }
}
export function studioNext(p){
 if(p.step==='reviewerQualification'){p.step='videoPlan';p.gate='author';}
 else if(p.step==='videoPlan'){p.clipId=current(p,'videoPlan').content.clips[0].id;p.step='videoPrompt';p.gate='author';}
 else if(p.step==='videoPrompt'){p.step='video';p.gate='produce';}
 else if(p.step==='video'){const missing=current(p,'videoPlan').content.clips.find(c=>!locked(p,`video:${c.id}`));p.clipId=missing?.id??null;p.step=missing?'videoPrompt':'soundPlan';p.gate='author';}
 else if(p.step==='soundPlan'){p.step='music';p.gate=current(p,'soundPlan').content.music.mode==='generate'?'produce':'author';}
 else if(['music','effect'].includes(p.step)){const missing=current(p,'soundPlan').content.effects.find(e=>!locked(p,`effect:${e.id}`));p.effectId=missing?.id??null;p.step=missing?'effect':'editPlan';p.gate=missing&&missing.mode==='generate'?'produce':'author';}
 else if(p.step==='editPlan'){p.step='film';p.gate='produce';}
 else if(p.step==='film'){p.step='complete';p.gate='pending';}
 else return false;
 return true;
}
