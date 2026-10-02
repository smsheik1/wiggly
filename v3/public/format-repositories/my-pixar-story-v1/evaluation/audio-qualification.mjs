import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {File,text,digest} from '../runtime/contracts.mjs';
import {verifyFiles} from '../runtime/media.mjs';
export const audioCriteria=['integrity','transcript','natural-rate','voice-match','mix','safety'];
const Check=z.object({status:z.enum(['pass','fail','inconclusive']),evidence:text,location:text,repair:z.string()});
export const AudioCase=z.object({id:text,group:text,split:z.enum(['calibration','holdout']),criterion:z.enum(audioCriteria),media:File,references:z.array(File),expectedText:z.string(),label:Check.extend({authority:z.literal('human'),confirmed:z.literal(true)})});
export const AudioPrediction=z.object({caseId:text,inputDigest:text,workerId:text,modelVersion:text,capabilityVersion:text,perception:z.enum(['direct-audio','unavailable']),check:Check});
export function audioTask(c){const {label,split,group,...input}=c;return {caseId:c.id,input,inputDigest:digest(input),instruction:'Hear actual audio; use independent transcription/speaker tools for those criteria. Missing capability is inconclusive; localize every defect and repair. Labels withheld.'};}
export async function qualifyAudio(raw,predictions,workerId,modelVersion,capabilityVersion){
 const cases=z.array(AudioCase).min(1).parse(raw),rows=z.array(AudioPrediction).parse(predictions),groups=new Map(),hashes=new Map(),ids=new Set(),examples=new Set();
 for(const c of cases){
  if(ids.has(c.id)||examples.has(`${c.criterion}:${c.media.sha256}`))throw new Error('Duplicate audio case/media cannot increase criterion coverage.');ids.add(c.id);examples.add(`${c.criterion}:${c.media.sha256}`);
  if(!c.media.durationSeconds||c.media.width)throw new Error('Qualification must use measured audio-only files.');
  if(c.criterion==='voice-match'&&!c.references.some(f=>f.sha256!==c.media.sha256&&f.durationSeconds&&!f.width))throw new Error('Voice-match cases require a genuine separate sample.');
  if(c.criterion==='transcript'&&!c.expectedText.trim())throw new Error('Transcript cases require locked text.');
  if(c.label.status==='fail'&&!c.label.repair.trim())throw new Error('Human audio defect labels require repair.');
  for(const [map,key]of [[groups,c.group],...[c.media,...c.references].map(f=>[hashes,f.sha256])]){if(map.has(key)&&map.get(key)!==c.split)throw new Error('Audio calibration/holdout leakage.');map.set(key,c.split);}await verifyFiles([c.media,...c.references]);
 }
 const held=cases.filter(c=>c.split==='holdout'),byId=new Map();
 for(const p of rows){const c=held.find(c=>c.id===p.caseId);if(!c||byId.has(p.caseId)||p.inputDigest!==audioTask(c).inputDigest||p.workerId!==workerId||p.modelVersion!==modelVersion||p.capabilityVersion!==capabilityVersion)throw new Error('Stale, duplicate or mismatched audio prediction.');if(p.check.status==='fail'&&!p.check.repair.trim())throw new Error('Audio defects require repairs.');byId.set(p.caseId,p);}
 if(byId.size!==held.length)throw new Error('Complete held-out audio predictions required.');
 const metrics=audioCriteria.map(criterion=>{const subset=held.filter(c=>c.criterion===criterion),passes=subset.filter(c=>c.label.status==='pass').length,defects=subset.filter(c=>c.label.status==='fail').length,errors=subset.filter(c=>byId.get(c.id).perception!=='direct-audio'||byId.get(c.id).check.status!==c.label.status).length;return {criterion,passes,defects,errors,qualified:passes>=2&&defects>=2&&errors===0};});
 return {workerId,modelVersion,capabilityVersion,datasetDigest:digest(cases),predictionDigest:digest(rows),metrics,qualified:metrics.every(m=>m.qualified),verifiedMedia:true,cases:cases.length,evaluatedAt:new Date().toISOString(),productionApproval:false};
}
export function requireAudioQualification(report){
 if(!report?.qualified||!report.verifiedMedia||!report.workerId||!report.modelVersion||!report.capabilityVersion||!report.datasetDigest||!report.predictionDigest)throw new Error('AUDIO_REVIEWER_NOT_QUALIFIED: evaluate actual held-out human-labelled audio first.');
 for(const criterion of audioCriteria){const m=report.metrics?.find(m=>m.criterion===criterion);if(!m?.qualified||m.passes<2||m.defects<2||m.errors!==0)throw new Error('Incomplete or failing audio qualification metrics.');}
}
export async function verifyAudioQualificationEvidence(report){
 const cases=JSON.parse(await readFile(join(report.evidenceDirectory,'dataset.json'),'utf8')),predictions=JSON.parse(await readFile(join(report.evidenceDirectory,'predictions.json'),'utf8'));
 const actual=await qualifyAudio(cases,predictions,report.workerId,report.modelVersion,report.capabilityVersion);
 for(const key of ['datasetDigest','predictionDigest','metrics','qualified','verifiedMedia','cases','productionApproval'])if(digest(actual[key])!==digest(report[key]))throw new Error(`AUDIO_QUALIFICATION_EVIDENCE_CHANGED: ${key}`);
 requireAudioQualification(actual);
}
