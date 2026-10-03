// ISOLATED protocol rehearsal. No generated film, provider calls or human quality labels.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {current,taskFor,openWorkflow,revisionImpact} from '../runtime/workflow.mjs';
import {digest} from '../runtime/contracts.mjs';
import {assemblyManifest} from '../runtime/studio.mjs';
import {confirmed,supervisedVideoReady} from './supervised-helpers.mjs';
import {author,image} from './background-helpers.mjs';
import {videoPrompt,videoResult,soundPlan,editPlan,inspection} from './studio-helpers.mjs';
import {send,approved,reviewed,file,inputs,captureEvents} from './helpers.mjs';
function complete(){
 let p=supervisedVideoReady();
 while(p.step!=='soundPlan'){
  p=approved(reviewed(author(p,videoPrompt(p),'video-engineer')));
  const result=videoResult(p);
  p=send(p,'plan',{plan:{provider:'replicate',operation:'video',estimatedCostUsd:.05,parameters:{prompt:result.prompt}}});
  assert.equal(p.gate,'authorize');const j=p.jobs.at(-1);
  p=send(p,'authorize',{jobId:j.id,artifactDigest:j.digest,message:'ISOLATED human exact spending authorization'});
  p=send(p,'begin',{jobId:j.id,artifactDigest:j.digest});p=send(p,'receipt',{jobId:j.id,artifactDigest:j.digest,result});
  p=confirmed(reviewed(p));
 }
 p=approved(reviewed(author(p,soundPlan,'sound-designer')));
 p=confirmed(reviewed(author(p,{files:[file(60,60)],prompt:soundPlan.music.prompt,provenance:soundPlan.music.provenance},'composer')));
 p=confirmed(reviewed(author(p,{files:[file(61,1)],prompt:soundPlan.effects[0].prompt,provenance:soundPlan.effects[0].provenance},'sound-designer')));
 p=approved(reviewed(author(p,editPlan(p),'film-editor')));
 p=send(p,'rendered',{actor:'runtime',content:{files:[{...image(70),path:'/isolated-test/film.mp4',durationSeconds:60,width:1920,height:1080,fps:30,hasAudio:true}],editPlanDigest:current(p,'editPlan').digest,manifestDigest:digest(assemblyManifest(p)),inspection,contactSheet:image(71),provenance:p.artifacts.filter(a=>a.valid&&a.approvedBy).map(a=>({artifactId:a.id,digest:a.digest}))}});
 return confirmed(reviewed(p));
}
test('supervised studio reaches completion across every SQLite restart, without qualifying itself or authorizing video implicitly',async()=>{
 const {project,events}=captureEvents(complete),dir=await mkdtemp(join(tmpdir(),'memoir-supervised-studio-')),db=join(dir,'state.sqlite');let w=openWorkflow(db);
 try{
  await w.init('invented-supervised',inputs);
  for(const e of events){await w.respond('invented-supervised',e);w.close();w=openWorkflow(db);}
  const s=await w.status('invented-supervised');assert.equal(s.project.step,'complete');assert.equal(s.project.sequence,project.sequence);
  assert.equal(s.project.artifacts.some(a=>a.kind.includes('Qualification')),false);
  const media=s.project.artifacts.filter(a=>a.valid&&a.content.files&&!['voiceSample'].includes(a.kind));assert.ok(media.every(a=>a.humanReview?.decision==='approved'));
  assert.ok(s.project.jobs.filter(j=>j.plan.operation==='video').every(j=>j.authorization&&!j.allowanceId));
  assert.equal(current(s.project,'film').digest,current(project,'film').digest);
  assert.notEqual(current(s.project,'film').visualReviewedBy,current(s.project,'film').audioReviewedBy);
  assert.ok(revisionImpact(s.project,current(s.project,'video:home-0-wide-0').id).remainValid.includes(current(s.project,'video:shop-1-wide-2').id));
 }finally{w.close();await rm(dir,{recursive:true});}
});
