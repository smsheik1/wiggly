import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { File, text, digest } from '../runtime/contracts.mjs';
import { verifyFiles } from '../runtime/media.mjs';
const Check = z.object({ status: z.enum(['pass','fail','inconclusive']), evidence: text, location: text, repair: z.string() });
export const VisualCase = z.object({ id:text, group:text, split:z.enum(['calibration','holdout']), kind:z.enum(['image','video']), criterion:z.enum(['anatomy','identity','continuity']), media:File, references:z.array(File), label:Check.extend({ authority:z.literal('human'), confirmed:z.literal(true) }) });
export const VisualPrediction = z.object({ caseId:text, inputDigest:text, workerId:text, modelVersion:text, perception:z.enum(['direct-image','direct-video','unavailable']), check:Check });
export function visualTask(c) { const {label,split,group,...input}=c;return {caseId:c.id,input,inputDigest:digest(input),instruction:'Inspect actual supplied media and references; localize defects and repairs. Missing perception is inconclusive. Labels are withheld.'}; }
export async function qualifyVisual(raw, predictions, workerId, modelVersion) {
  const cases=z.array(VisualCase).parse(raw), rows=z.array(VisualPrediction).parse(predictions);
  const groups=new Map(), hashes=new Map(), ids=new Set(), examples=new Set();
  for(const c of cases){const example=`${c.kind}:${c.criterion}:${c.media.sha256}`;if(examples.has(example))throw new Error('Duplicate media within visual criterion; repeated files do not increase coverage.');examples.add(example);if(c.criterion!=='anatomy'&&!c.references.some(f=>f.sha256!==c.media.sha256))throw new Error('Identity/continuity qualification needs independent reference media.');if(c.label.status==='fail'&&!c.label.repair.trim())throw new Error('Human defect label needs a specific repair.');if(c.kind==='image'?!c.media.width||!c.media.height||!!c.media.durationSeconds:!c.media.width||!c.media.height||!c.media.fps||!c.media.durationSeconds)throw new Error('Visual case media kind/measurement mismatch.');if(ids.has(c.id))throw new Error('Duplicate visual case.');ids.add(c.id);for(const [map,key] of [[groups,c.group],...[c.media,...c.references].map(f=>[hashes,f.sha256])]){if(map.has(key)&&map.get(key)!==c.split)throw new Error('Visual calibration/holdout leakage.');map.set(key,c.split);}await verifyFiles(c.media);await verifyFiles(c.references);}
  const held=cases.filter(c=>c.split==='holdout'),byId=new Map();
  for(const p of rows){const c=held.find(c=>c.id===p.caseId);if(!c||byId.has(p.caseId)||p.inputDigest!==visualTask(c).inputDigest||p.workerId!==workerId||p.modelVersion!==modelVersion)throw new Error('Stale, duplicate or mismatched visual prediction.');if(p.check.status==='fail'&&!p.check.repair.trim())throw new Error('Every visual defect needs repair.');byId.set(p.caseId,p);}
  if(byId.size!==held.length)throw new Error('Complete held-out predictions required; no baseline substitution.');
  const metrics=[];
  for(const kind of ['image','video'])for(const criterion of ['anatomy','identity','continuity']){
    const subset=held.filter(c=>c.kind===kind&&c.criterion===criterion),passes=subset.filter(c=>c.label.status==='pass').length,defects=subset.filter(c=>c.label.status==='fail').length;
    const errors=subset.filter(c=>{const p=byId.get(c.id);return p.perception!==`direct-${kind}`||p.check.status!==c.label.status;}).length;
    metrics.push({kind,criterion,passes,defects,errors,qualified:passes>=2&&defects>=2&&errors===0});
  }
  return {workerId,modelVersion,datasetDigest:digest(cases),predictionDigest:digest(rows),metrics,qualifiedScopes:['image','video'].filter(kind=>metrics.filter(m=>m.kind===kind).every(m=>m.qualified)),verifiedMedia:true,evaluatedAt:new Date().toISOString(),cases:cases.length,productionApproval:false};
}
export function requireVisualQualification(report, scope) {
  if(!report?.verifiedMedia||!report.datasetDigest||!report.predictionDigest||!report.qualifiedScopes?.includes(scope)||!report.workerId||!report.modelVersion||!report.metrics?.filter(m=>m.kind===scope).length)throw new Error(`VISUAL_REVIEWER_NOT_QUALIFIED: ${scope}; evaluate actual human-labelled held-out good/broken examples first.`);
  for(const criterion of ['anatomy','identity','continuity']){const m=report.metrics.find(m=>m.kind===scope&&m.criterion===criterion);if(!m||m.passes<2||m.defects<2||m.errors!==0||!m.qualified)throw new Error('Incomplete or failing visual qualification metrics.');}
}

export async function verifyQualificationEvidence(report){
  const cases=JSON.parse(await readFile(join(report.evidenceDirectory,'dataset.json'),'utf8'));
  const predictions=JSON.parse(await readFile(join(report.evidenceDirectory,'predictions.json'),'utf8'));
  const recomputed=await qualifyVisual(cases,predictions,report.workerId,report.modelVersion);
  for(const field of ['datasetDigest','predictionDigest','metrics','qualifiedScopes','verifiedMedia','cases','productionApproval'])if(digest(recomputed[field])!==digest(report[field]))throw new Error(`QUALIFICATION_EVIDENCE_CHANGED: ${field}`);
  requireVisualQualification(recomputed,'image');requireVisualQualification(recomputed,'video');
}
