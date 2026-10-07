import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {audioProject,send,reviewed} from './helpers.mjs';
import {current,taskFor} from '../runtime/workflow.mjs';
import {executeJob,requestDescriptor,generationEstimate} from '../runtime/providers.mjs';
import {importMedia,narrationWindow} from '../runtime/media.mjs';
import {digest} from '../runtime/contracts.mjs';

async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'memoir-scoped-narration-')),path=join(dir,'original.wav'),freshPath=join(dir,'fresh.wav');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=220:duration=14',path]);
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=14',freshPath]);
 const source=await importMedia(path,dir),window=await narrationWindow(source,dir,join(dir,'window.wav'));let p=audioProject();p.step='narration';p.gate='review';p.workflowRevision=3;
 const a=current(p);delete a.approvedBy;delete a.review;a.content.files=Array(4).fill(window.file);a.content.sourceFiles=Array(4).fill(source);a.content.tailSilenceSeconds=Array(4).fill(window.tailSilenceSeconds);a.content.model=p.studio.config.generation.voice.model;
 const script=current(p,'script');script.content.beats[1].narration='I drove my own car with no A/C.';script.digest=digest(script.content);a.content.transcripts=script.content.beats.map(b=>b.narration);a.digest=digest(a.content);
 p.reviewMode='supervised';current(p,'audition').humanReview=structuredClone(current(p,'audition').review);p.budget={maxCostUsd:100,reservations:[]};
 const scope={beat:2,spokenText:'I drove my own car with no AC.'},start={actor:'human',artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED replace only beat 2, say AC',narrationRegeneration:scope};
 return {dir,freshPath,p,start};
}

test('one-beat regeneration preserves siblings/locks, posts once and recovers without network from durable receipts',async()=>{
 const f=await fixture();
 try{
  const before=structuredClone(f.p),p=send(f.p,'start-narration-regeneration',f.start);assert.equal(p.gate,'produce');assert.equal(current(p).id,current(before).id);
  for(const key of ['script','clone','audition'])assert.deepEqual(current(p,key),current(before,key));
  assert.deepEqual(taskFor(p).generationTexts.beats,[{beat:2,text:f.start.narrationRegeneration.spokenText}]);
  assert.equal(generationEstimate(p).characters,f.start.narrationRegeneration.spokenText.length);
  const planned=send(p,'plan',{workerId:'isolated-planner',plan:{provider:'cartesia',operation:'narration',estimatedCostUsd:.01,parameters:{}}}),job=planned.jobs.at(-1);assert.equal(planned.gate,'authorize');assert.equal(job.request.transcripts.length,1);assert.deepEqual(job.request.generation_config,{speed:1,volume:1});
  await assert.rejects(executeJob(planned,job,f.dir,'ISOLATED',()=>{throw new Error('Forbidden');}),/UNAUTHORIZED/);
  let submitted=send(planned,'authorize',{jobId:job.id,artifactDigest:job.digest,message:'ISOLATED exact one-cent request'});submitted=send(submitted,'begin',{jobId:job.id,artifactDigest:job.digest});let calls=0;
  const result=await executeJob(submitted,submitted.jobs.at(-1),f.dir,'ISOLATED',async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(url,'https://api.cartesia.ai/tts/bytes');assert.equal(body.transcript,'I drove my own car with no AC.');assert.equal(body.voice,current(before,'clone').content.voiceId);return new Response(await readFile(f.freshPath));});assert.equal(calls,1);
  for(const n of [0,2,3]){assert.deepEqual(result.files[n],current(before).content.files[n]);assert.deepEqual(result.sourceFiles[n],current(before).content.sourceFiles[n]);assert.equal(result.tailSilenceSeconds[n],current(before).content.tailSilenceSeconds[n]);}
  assert.notEqual(result.files[1].sha256,current(before).content.files[1].sha256);assert.equal(result.files[1].durationSeconds,15);assert.deepEqual(result.transcripts,current(before).content.transcripts);
  await writeFile(join(f.dir,'saved-project.json'),JSON.stringify(submitted));const restarted=JSON.parse(await readFile(join(f.dir,'saved-project.json')));
  // Adapter recovery reuses the exact recorded request and completed subreceipt.
  const recovered=await executeJob(restarted,restarted.jobs.at(-1),f.dir,'',()=>{throw new Error('Forbidden replay');},true);assert.deepEqual(recovered,result);assert.equal(calls,1);
  const receipt={jobId:job.id,artifactDigest:job.digest,result};const done=send(submitted,'receipt',receipt);assert.equal(done.gate,'review');assert.equal(done.narrationRegeneration,undefined);assert.ok(!current(done).approvedBy);
  const measurements={transcripts:current(done,'script').content.beats.map((b,i)=>i===1?'I drove my own car with no AC.':b.narration),speechToTextMethod:'ISOLATED mock STT',referenceSha256:current(done,'voiceSample').content.files[0].sha256,speakerSimilarity:.9,speakerSimilarityMethod:'ISOLATED mock identity',speakingRateWpm:[80,80,80,80],silenceSeconds:[1,1,1,1],measurementNotes:'ISOLATED contract evidence only.'};
  assert.equal(reviewed(done,'approved',{measurements}).gate,'human');
  const unapproved=structuredClone(done);delete current(unapproved).content.audioRegenerations;
  assert.throws(()=>reviewed(unapproved,'approved',{measurements}),/Speech-to-text/);
  const changed=structuredClone(measurements);changed.transcripts[1]='I drove my own boat with no AC.';assert.throws(()=>reviewed(done,'approved',{measurements:changed}),/Speech-to-text/);
  for(const mutate of [x=>x.files[0]=x.files[1],x=>x.audioRegenerations[0].requestDigest='wrong',x=>x.transcripts[1]='invented story',x=>x.voiceId='wrong']){const bad=structuredClone(result);mutate(bad);assert.throws(()=>send(submitted,'receipt',{...receipt,result:bad}),/NARRATION|voice/);}
  const stale=structuredClone(submitted);current(stale).digest='changed';await assert.rejects(executeJob(stale,stale.jobs.at(-1),f.dir,'ISOLATED',()=>{throw new Error('Forbidden');}),/STALE/);
 }finally{await rm(f.dir,{recursive:true});}
});

test('regeneration refuses text rewrites, locked/stale media, actors, budgets and unknown requests',async()=>{
 const f=await fixture();try{
  assert.throws(()=>send(f.p,'start-narration-regeneration',{...f.start,actor:'agent'}),/human authority/);
  assert.throws(()=>send(f.p,'start-narration-regeneration',{...f.start,artifactDigest:'wrong'}),/DENIED/);
  assert.throws(()=>send(f.p,'start-narration-regeneration',{...f.start,narrationRegeneration:{beat:2,spokenText:'A shorter newly written story.'}}),/SCRIPT_APPROVAL/);
  const locked=structuredClone(f.p);current(locked).approvedBy={message:'locked',at:'now'};assert.throws(()=>send(locked,'start-narration-regeneration',f.start),/DENIED/);
  const p=send(f.p,'start-narration-regeneration',f.start);p.budget.maxCostUsd=0;
  const planned=send(p,'plan',{workerId:'planner',plan:{provider:'cartesia',operation:'narration',estimatedCostUsd:.01,parameters:{}}}),job=planned.jobs.at(-1);assert.throws(()=>send(planned,'authorize',{jobId:job.id,artifactDigest:job.digest,message:'go'}),/BUDGET_EXCEEDED/);
  planned.budget.maxCostUsd=100;let submitted=send(planned,'authorize',{jobId:job.id,artifactDigest:job.digest,message:'ISOLATED paid mock'});submitted=send(submitted,'begin',{jobId:job.id,artifactDigest:job.digest});
  const {mkdir}=await import('node:fs/promises');const receiptDir=join(f.dir,'receipts',job.id);await mkdir(receiptDir,{recursive:true});await writeFile(join(receiptDir,'0.started'),JSON.stringify({jobId:job.id,digest:job.digest,index:0}));
  for(const collectOnly of [false,true])await assert.rejects(executeJob(submitted,submitted.jobs.at(-1),f.dir,'ISOLATED',()=>{throw new Error('Forbidden duplicate');},collectOnly),/UNCERTAIN_SUBREQUEST/);
  const blocked=structuredClone(f.p);blocked.jobs.at(-1).status='uncertain';assert.throws(()=>send(blocked,'start-narration-regeneration',f.start),/DENIED/);
 }finally{await rm(f.dir,{recursive:true});}
});
