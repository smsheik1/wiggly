import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { current,taskFor,assertAllowed,revisionImpact,openWorkflow } from '../runtime/workflow.mjs';
import { assemblyManifest,assertFilmInspection,validateStudioContent } from '../runtime/studio.mjs';
import {digest} from '../runtime/contracts.mjs';
import {rendererIdentity} from '../runtime/remotion.mjs';
import { audioMixArgs } from '../runtime/assemble.mjs';
import { requireVisualQualification } from '../evaluation/visual-qualification.mjs';
import { author } from './background-helpers.mjs';
import { send,approved,reviewed,produce,captureEvents,inputs } from './helpers.mjs';
import { visualProject,qualification,planLocked,videoPlan,videoPrompt,videoReady,videoResult,videosLocked,soundPlan,soundLocked,editPlan,renderReady,rendered,inspection } from './studio-helpers.mjs';

test('unqualified visual reviewer blocks video; reports cannot be self-certified by an agent',()=>{
 const p=visualProject();assert.equal(p.step,'reviewerQualification');assert.throws(()=>assertAllowed(p,'video'),/NOT_QUALIFIED/);
 assert.throws(()=>author(p,qualification),/cannot self-certify/);
 assert.throws(()=>send(p,'qualified',{actor:'runtime',content:{...qualification,metrics:qualification.metrics.slice(1)}}),/Incomplete/);
 assert.throws(()=>requireVisualQualification({...qualification,metrics:qualification.metrics.map(m=>({...m,errors:1}))},'video'),/Incomplete/);
});
test('video plan covers 60s with short clips; binds actual approved frame and positive spending estimate',()=>{
 let p=planLocked();const a=current(p,'videoPlan');assert.equal(a.content.clips.length,12);
 assert.throws(()=>author(p,{...videoPrompt(p),keyframeSha256:'wrong'}),/exact approved/);
 p=videoReady(p);const f=videoResult(p);
 assert.throws(()=>send(p,'plan',{plan:{provider:'replicate',operation:'video',estimatedCostUsd:0,parameters:{prompt:f.prompt}}}),/positive cost/);
 p=send(p,'allowance',{allowance:{operations:['video'],maxRequests:10,maxCostUsd:100},message:'ISOLATED broad allowance'});
 p=send(p,'plan',{plan:{provider:'replicate',operation:'video',estimatedCostUsd:1,parameters:{prompt:f.prompt}}});assert.equal(p.gate,'authorize');
 assert.equal(p.jobs.at(-1).request.frame.sha256,taskFor(p).videoBinding.keyframeSha256);assert.equal(p.jobs.at(-1).request.input.generate_audio,false);
});
test('qualified reviewer must see entire video; extra hand returns to prompt engineer before the user',()=>{
 const p=produce(videoReady(),videoResult(videoReady()));
 assert.throws(()=>reviewed(p,'approved',{modelVersion:'unqualified'}),/Qualified reviewer/);
 assert.throws(()=>reviewed(p,'approved',{coverage:{artifactSha256:current(p).content.files[0].sha256,videoSeconds:1}}),/entire/);
 const rejected=reviewed(p,'rejected');assert.equal(rejected.step,'videoPrompt');assert.equal(rejected.gate,'author');assert.equal(current(rejected,`video:${p.clipId}`),undefined);
 assert.ok(taskFor(rejected).feedback[0].message.includes('repair'));
});
test('automatic video repairs require bounded user allowance and real technical rejection; creative changes cannot use it',()=>{
 let p=videoReady();p=send(p,'allowance',{allowance:{operations:['video'],repairOf:`video:${p.clipId}`,maxRequests:1,maxCostUsd:1},message:'ISOLATED allow one evidenced repair'});
 p=produce(p,videoResult(p));p=videoReady(reviewed(p,'rejected'),true);
 p=send(p,'plan',{plan:{provider:'replicate',operation:'video',estimatedCostUsd:.5,parameters:{prompt:videoResult(p).prompt}}});assert.equal(p.gate,'collect');assert.equal(p.jobs.at(-1).allowanceId,'allowance-1');
 let other=videoReady();other=send(other,'allowance',{allowance:{operations:['video'],repairOf:`video:${other.clipId}`,maxRequests:2,maxCostUsd:10},message:'ISOLATED allow repairs'});
 other=approved(reviewed(produce(other,videoResult(other))));const first=current(other,'video:home-0-wide-0');other=send(other,'changes',{artifactId:first.id,artifactDigest:first.digest,message:'Make this a different camera move.'});
 other=videoReady(other,true);other=send(other,'plan',{plan:{provider:'replicate',operation:'video',estimatedCostUsd:.5,parameters:{prompt:videoResult(other).prompt}}});assert.equal(other.gate,'authorize');
});
test('repeated video defects escalate and generation cap survives prompt revisions',()=>{
 let p=reviewed(produce(videoReady(),videoResult(videoReady())),'rejected');p=videoReady(p,true);p=reviewed(produce(p,videoResult(p)),'rejected');assert.equal(p.gate,'escalate');
 p=send(p,'resolve',{message:'ISOLATED repair anatomy again'});p=videoReady(p,true);p=reviewed(produce(p,videoResult(p)),'rejected');assert.equal(p.gate,'escalate');
 p=send(p,'resolve',{message:'ISOLATED try again'});p=videoReady(p,true);assert.throws(()=>produce(p,videoResult(p)),/ATTEMPT_LIMIT/);
});
test('sound stages review imports, require provenance, and preserve unrelated assets on a clip change',()=>{
 const p=soundLocked();assert.equal(p.step,'editPlan');assertAllowed(p,'editPlan');
 const clip=current(p,'video:home-0-wide-0'),impact=revisionImpact(p,clip.id);
 assert.ok(impact.remainValid.includes(current(p,'music').id));assert.ok(impact.remainValid.includes(current(p,'effect:bell').id));assert.ok(impact.remainValid.includes(current(p,'reviewerQualification').id));assert.ok(impact.remainValid.includes(current(p,'video:shop-1-wide-2').id));
 const changed=send(p,'changes',{artifactId:current(p,'music').id,artifactDigest:current(p,'music').digest,message:'Use a different licensed score.'});assert.equal(changed.step,'music');assert.equal(changed.gate,'author');
});
test('assembly preserves four natural-rate stems, trims clips, ducks piano and records all assets',()=>{
 const p=renderReady(),m=assemblyManifest(p),args=audioMixArgs(m,'/isolated/film.mp4'),f=args[args.indexOf('-filter_complex')+1];
 assert.equal(m.clips.length,12);assert.deepEqual(m.narration.map(a=>a.durationSeconds),[12,12,12,12]);
 for(const delay of [0,15000,30000,45000])assert.ok(f.includes(`adelay=${delay}|${delay}`));assert.ok(f.includes('sidechaincompress'));assert.ok(f.includes('loudnorm=I=-16'));
 assert.doesNotMatch(f,/atempo|rubberband/);assert.doesNotMatch(f,/concat=|\[video\]|fps=|scale=/);assertFilmInspection({...inspection,freezeSeconds:8});
 for(const bad of [{durationSeconds:59},{integratedLufs:-5},{truePeakDb:0},{hasAudio:false},{blackSeconds:5}])assert.throws(()=>assertFilmInspection({...inspection,...bad}),/FINAL_TECHNICAL_GATE/);
});
test('final film needs full audiovisual review and human approval; malformed render cannot advance',()=>{
 const p=rendered();assert.equal(p.step,'film');assert.equal(p.gate,'review');
 assert.throws(()=>send(p,'review',{workerId:'reviewer',artifactId:current(p).id,artifactDigest:current(p).digest,review:{decision:'approved',perception:'direct-audio',checks:taskFor(p).criteria.map(criterion=>({criterion,status:'pass',evidence:'ISOLATED unsupported channel',location:'whole fixture'}))}}),/missing perception/);
 assert.throws(()=>reviewed(p,'approved',{coverage:{artifactSha256:current(p).content.files[0].sha256,videoSeconds:1}}),/entire/);
 const complete=approved(reviewed(p));assert.equal(complete.step,'complete');
 const root=current(complete,'video:home-0-wide-0');assert.ok(revisionImpact(complete,root.id).affected.includes(current(complete,'film').id));
});
test('every studio interrupt survives SQLite reopen; fixture workflow finishes without any provider call',async()=>{
 const {project,events}=captureEvents(()=>approved(reviewed(rendered())));const dir=await mkdtemp(join(tmpdir(),'memoir-studio-state-')),db=join(dir,'state.sqlite');let w=openWorkflow(db);
 try{await w.init('isolated',inputs);for(const e of events){await w.respond('isolated',e);w.close();w=openWorkflow(db);}const final=await w.status('isolated');assert.equal(final.project.step,'complete');assert.equal(final.project.sequence,project.sequence);assert.equal(final.project.jobs.length,project.jobs.length);assert.equal(current(final.project,'film').digest,current(project,'film').digest);}finally{w.close();await rm(dir,{recursive:true});}
});

test('generated sound receipts traverse the graph with exact saved prompt and validated duration',()=>{
 let p=videosLocked();const plan=structuredClone(soundPlan);plan.music.mode='generate';plan.music.provenance.source='generated';plan.effects[0].mode='generate';plan.effects[0].provenance.source='generated';p=approved(reviewed(author(p,plan,'sound-designer')));
 const audio=(hash,durationSeconds)=>({path:'/isolated-test/sound.mp3',sha256:hash.repeat(64),bytes:1024,durationSeconds});
 p=approved(reviewed(produce(p,{files:[audio('a',60)],prompt:plan.music.prompt,provenance:plan.music.provenance})));
 assert.equal(p.step,'effect');p=approved(reviewed(produce(p,{files:[audio('b',1)],prompt:plan.effects[0].prompt,provenance:plan.effects[0].provenance})));assert.equal(p.step,'editPlan');
});
test('a film mix rejection reopens edit with evidence; a source defect reopens only its own video prompt',()=>{
 let p=rendered(),film=current(p),edit=current(p,'editPlan');p=reviewed(p,'rejected');assert.equal(p.step,'editPlan');assert.equal(p.gate,'author');assert.equal(current(p,'film'),undefined);assert.equal(current(p,'editPlan'),undefined);assert.ok(taskFor(p).feedback[0].message.includes('repair'));assert.ok(current(p,'video:shop-1-wide-2'));
 p=rendered();const video=current(p,'video:home-0-wide-0');p=reviewed(p,'rejected',{repairArtifactId:video.id});assert.equal(p.step,'videoPrompt');assert.equal(p.clipId,'home-0-wide-0');assert.equal(current(p,'video:home-0-wide-0'),undefined);assert.ok(current(p,'video:shop-1-wide-2'));assert.ok(current(p,'music'));
 const broken=rendered();assert.throws(()=>reviewed(broken,'rejected',{repairArtifactId:current(broken,'reviewerQualification').id}),/current component/);
});
test('an imported sound defect returns to import author, never the generated-sound provider',()=>{
 let p=approved(reviewed(author(videosLocked(),soundPlan,'sound-designer')));p=author(p,{files:[{path:'/isolated-test/music.wav',sha256:'c'.repeat(64),bytes:1024,durationSeconds:60}],prompt:soundPlan.music.prompt,provenance:soundPlan.music.provenance},'composer');p=reviewed(p,'rejected');assert.equal(p.step,'music');assert.equal(p.gate,'author');
});

test('human film feedback reopens its editor; narration-source repair pauses for broad dependency impact',()=>{
 let p=approved(reviewed(rendered()));const film=current(p,'film');p=send(p,'changes',{artifactId:film.id,artifactDigest:film.digest,message:'Lower the piano in this final film.'});assert.equal(p.step,'editPlan');assert.equal(p.gate,'author');assert.equal(current(p,'film'),undefined);
 p=rendered();const narration=current(p,'narration');p=reviewed(p,'rejected',{repairArtifactId:narration.id});assert.equal(p.step,'film');assert.equal(p.gate,'escalate');assert.ok(current(p,'video:shop-1-wide-2'));assert.ok(taskFor(p).feedback.some(f=>f.message.includes('downstream')));p=send(p,'resolve',{message:'ISOLATED confirm source narration repair and its dependency impact.'});assert.equal(p.step,'narration');assert.equal(p.gate,'produce');assert.ok(current(p,'script'));assert.ok(current(p,'clone'));
});

test('film approval binds concrete renderer inventory; older renderer manifests cannot advance',()=>{
 const p=renderReady(),manifest=assemblyManifest(p),film=current(rendered(),'film').content;
 assert.equal(manifest.rendererDigest,digest(rendererIdentity()));
 validateStudioContent(p,film);
 const prior={...manifest,rendererDigest:'0'.repeat(64)};
 assert.throws(()=>validateStudioContent(p,{...film,manifestDigest:digest(prior)}),/exact current assets/);
 const legacy={...manifest};delete legacy.rendererDigest;
 assert.throws(()=>validateStudioContent(p,{...film,manifestDigest:digest(legacy)}),/exact current assets/);
});
