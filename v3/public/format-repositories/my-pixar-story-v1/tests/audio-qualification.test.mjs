import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {importMedia,verifyFiles} from '../runtime/media.mjs';
import {audioCriteria,audioTask,qualifyAudio,requireAudioQualification} from '../evaluation/audio-qualification.mjs';
// Synthetic tones and stipulated labels exercise mechanics only, never hearing expertise.
async function fixtures(){
 const dir=await mkdtemp(join(tmpdir(),'memoir-audio-qualification-'));const cases=[];
 try{for(const [j,criterion]of audioCriteria.entries())for(let i=0;i<4;i++){
  const path=join(dir,`${j}-${i}.wav`);execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`sine=frequency=${300+j*100+i*10}:duration=0.12`,path]);
  const media=await importMedia(path,dir);cases.push({id:`${criterion}-${i}`,group:`group-${j}-${i}`,split:'holdout',criterion,media,references:[],expectedText:'ISOLATED fixture words',label:{authority:'human',confirmed:true,status:i<2?'pass':'fail',evidence:'ISOLATED stipulated label; no real audio-quality assessment.',location:'whole synthetic fixture',repair:i<2?'':'ISOLATED repair'}});
 }for(const c of cases.filter(c=>c.criterion==='voice-match'))c.references=[cases[0].media];return {dir,cases};}catch(e){await rm(dir,{recursive:true});throw e;}
}
const predictions=cases=>cases.map(c=>({caseId:c.id,inputDigest:audioTask(c).inputDigest,workerId:'isolated-ava',modelVersion:'isolated-model',capabilityVersion:'isolated-tools',perception:'direct-audio',check:{status:c.label.status,evidence:'ISOLATED prediction, not genuine perception.',location:'whole fixture',repair:c.label.repair}}));
test('audio qualification separately measures all six held-out scopes and verifies saved sources',async()=>{
 const {dir,cases}=await fixtures();try{
  const task=audioTask(cases[0]);assert.equal(task.input.label,undefined);assert.equal(task.input.split,undefined);
  const rows=predictions(cases),report=await qualifyAudio(cases,rows,'isolated-ava','isolated-model','isolated-tools');requireAudioQualification(report);assert.equal(report.productionApproval,false);
  for(const [name,data]of Object.entries({dataset:cases,predictions:rows}))await writeFile(join(dir,name+'.json'),JSON.stringify(data));
  await verifyFiles({...report,evidenceDirectory:dir});rows[0].check.evidence='changed after qualification';await writeFile(join(dir,'predictions.json'),JSON.stringify(rows));await assert.rejects(verifyFiles({...report,evidenceDirectory:dir}),/EVIDENCE_CHANGED/);
  const wrong=predictions(cases);wrong[0].check.status='fail';wrong[0].check.repair='repair';assert.equal((await qualifyAudio(cases,wrong,'isolated-ava','isolated-model','isolated-tools')).qualified,false);
  const missing=predictions(cases);missing[0].perception='unavailable';assert.equal((await qualifyAudio(cases,missing,'isolated-ava','isolated-model','isolated-tools')).qualified,false);
  await assert.rejects(qualifyAudio(cases,predictions(cases).slice(1),'isolated-ava','isolated-model','isolated-tools'),/Complete/);
  await assert.rejects(qualifyAudio(cases,predictions(cases),'isolated-ava','changed-model','isolated-tools'),/mismatched/);
  await assert.rejects(qualifyAudio(cases.map(c=>c.criterion==='voice-match'?{...c,references:[]}:c),predictions(cases),'isolated-ava','isolated-model','isolated-tools'),/separate sample/);
  const leak=[...cases,{...cases[0],id:'leak',split:'calibration',criterion:'mix',group:'unrelated'}];await assert.rejects(qualifyAudio(leak,[],'isolated-ava','isolated-model','isolated-tools'),/leakage|Duplicate/);
 }finally{await rm(dir,{recursive:true});}
});
