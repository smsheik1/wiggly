// Synthetic assets and stipulated labels exercise evaluator mechanics only, never production reviewer competence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { verifyFiles,importMedia } from '../runtime/media.mjs';
import { qualifyVisual,visualTask,requireVisualQualification } from '../evaluation/visual-qualification.mjs';
async function casesFixture(){const dir=await mkdtemp(join(tmpdir(),'memoir-visual-eval-')),cases=[];const referencePath=join(dir,'reference.png');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=gray:s=32x18','-frames:v','1',referencePath]);const reference=await importMedia(referencePath,dir);for(const kind of ['image','video'])for(let i=0;i<4;i++){const path=join(dir,`${kind}-${i}.${kind==='image'?'png':'mp4'}`);execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`color=c=${['red','green','blue','yellow'][i]}:s=32x18:r=30:d=0.4`,...(kind==='image'?['-frames:v','1']:['-c:v','libx264']),path]);const media=await importMedia(path,dir);for(const criterion of ['anatomy','identity','continuity'])cases.push({id:`${kind}-${criterion}-${i}`,group:`${kind}-${i}`,split:'holdout',kind,criterion,media,references:[reference],label:{status:i<2?'pass':'fail',evidence:'ISOLATED stipulated fixture label, not model competence.',location:'whole fixture',repair:i<2?'':'ISOLATED repair direction.',authority:'human',confirmed:true}});}return{dir,cases};}
const predictions=cases=>cases.map(c=>({caseId:c.id,inputDigest:visualTask(c).inputDigest,workerId:'isolated-worker',modelVersion:'test-only',perception:`direct-${c.kind}`,check:{status:c.label.status,evidence:'ISOLATED stipulated prediction, no perception claim outside test.',location:'whole fixture',repair:c.label.repair}}));
test('held-out evaluator measures six scopes against exact files, never exposes labels in worker task',async()=>{
 const{dir,cases}=await casesFixture();try{const task=visualTask(cases[0]);assert.equal(task.input.label,undefined);assert.equal(task.input.split,undefined);const report=await qualifyVisual(cases,predictions(cases),'isolated-worker','test-only');assert.deepEqual(report.qualifiedScopes,['image','video']);assert.equal(report.metrics.length,6);assert.equal(report.productionApproval,false);requireVisualQualification(report,'video');const failed=predictions(cases);failed[0].check.status='fail';failed[0].check.repair='ISOLATED repair';const result=await qualifyVisual(cases,failed,'isolated-worker','test-only');assert.deepEqual(result.qualifiedScopes,['video']);}finally{await rm(dir,{recursive:true});}
});
test('missing perception, skipped labels, stale predictions and duplicate/leaked files cannot qualify a judge',async()=>{
 const{dir,cases}=await casesFixture();try{const missing=predictions(cases);missing[0].perception='unavailable';assert.deepEqual((await qualifyVisual(cases,missing,'isolated-worker','test-only')).qualifiedScopes,['video']);await assert.rejects(qualifyVisual(cases,predictions(cases).slice(1),'isolated-worker','test-only'),/Complete held-out/);const stale=predictions(cases);stale[0].inputDigest='stale';await assert.rejects(qualifyVisual(cases,stale,'isolated-worker','test-only'),/Stale/);
 const duplicate=[...cases,{...cases[0],id:'duplicate'}];await assert.rejects(qualifyVisual(duplicate,[],'isolated-worker','test-only'),/Duplicate media/);const leaked=[...cases,{...cases[0],id:'leak',criterion:'identity',split:'calibration'}];await assert.rejects(qualifyVisual(leaked,[],'isolated-worker','test-only'),/leakage|Duplicate media/);
 const sparse=cases.filter(c=>!c.id.endsWith('-3'));const report=await qualifyVisual(sparse,predictions(sparse),'isolated-worker','test-only');assert.deepEqual(report.qualifiedScopes,[]);
 }finally{await rm(dir,{recursive:true});}
});

test('qualification evidence remains available to review and changed labels/predictions cannot authorize production',async()=>{
 const{dir,cases}=await casesFixture();try{const rows=predictions(cases),computed=await qualifyVisual(cases,rows,'isolated-worker','test-only'),report={...computed,evidenceDirectory:dir};await writeFile(join(dir,'dataset.json'),JSON.stringify(cases));await writeFile(join(dir,'predictions.json'),JSON.stringify(rows));await verifyFiles(report);const changed=structuredClone(rows);changed[0].check.evidence='Changed after report';await writeFile(join(dir,'predictions.json'),JSON.stringify(changed));await assert.rejects(verifyFiles(report),/QUALIFICATION_EVIDENCE_CHANGED/);
 const newPath=join(dir,'calibration-target.png');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=black:s=32x18','-frames:v','1',newPath]);const newMedia=await importMedia(newPath,dir);const leakage=[...cases,{...cases[0],id:'reference-leak',group:'different-group',split:'calibration',media:newMedia,references:[cases[0].media]}];await assert.rejects(qualifyVisual(leakage,[],'isolated-worker','test-only'),/leakage/);
 }finally{await rm(dir,{recursive:true});}
});

test('visual evidence with a bound tool profile remains visual and detects profile changes',async()=>{
 const {dir,cases}=await casesFixture();try{const rows=predictions(cases).map(p=>({...p,capabilityVersion:'ISOLATED-vision-tools'})),computed=await qualifyVisual(cases,rows,'isolated-worker','test-only','ISOLATED-vision-tools'),report={...computed,evidenceDirectory:dir};await writeFile(join(dir,'dataset.json'),JSON.stringify(cases));await writeFile(join(dir,'predictions.json'),JSON.stringify(rows));await verifyFiles(report);await assert.rejects(qualifyVisual(cases,rows,'isolated-worker','test-only','changed-tools'),/mismatched/);}finally{await rm(dir,{recursive:true});}
});
