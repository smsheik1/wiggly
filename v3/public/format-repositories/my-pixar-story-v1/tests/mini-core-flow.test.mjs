// Invented protocol fixtures and local tones only; never real provider/film-quality proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Project,digest} from '../runtime/contracts.mjs';
import {initialProject,current,taskFor,assertAllowed,repairNotices,openWorkflow} from '../runtime/workflow.mjs';
import {executeVideo} from '../runtime/video-provider.mjs';
import {requestDescriptor} from '../runtime/providers.mjs';
import {validateVideoPlan,validateStudioContent,assemblyManifest} from '../runtime/studio.mjs';
import {audioMixArgs} from '../runtime/mix.mjs';
import {probe} from '../runtime/media.mjs';
import {crewTools} from '../runtime/crew.mjs';
import {presentDeliverable} from '../runtime/presentation.mjs';
import {supervisedVideoReady,supervisedCharacters,supervisedBackgrounds,confirmed} from './supervised-helpers.mjs';
import {inputs,send,approved,reviewed,produce,captureEvents} from './helpers.mjs';
import {author,image,registry,brief,prompt,ownerChecked} from './background-helpers.mjs';
import {shotPlan} from './shot-helpers.mjs';
import {videoPlan,videoPrompt,videoResult,videoReady,editPlan,inspection} from './studio-helpers.mjs';
const noSound={music:null,noMusicReason:'Core v1 uses only the storyteller narration; score deferred.',effects:[],noEffectsReason:'No story-serving effects needed.'};
const rejected=p=>reviewed(p,'rejected',{checks:taskFor(p).criteria.map(criterion=>({criterion,status:criterion==='anatomy'||criterion==='empty-environment'?'fail':'pass',location:'Left hand beside steering wheel',evidence:'Three distinct hands are visible on this person.',repair:'Restore two hands contacting their original props; preserve face and setting.'}))});
function masterReady(){let p=supervisedCharacters();p=approved(reviewed(author(p,{...registry,...shotPlan},'shot-planner')));p=approved(reviewed(author(p,registry)));p=approved(reviewed(author(p,brief(p))));return approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));}
function allVideos(){let p=supervisedVideoReady();while(p.step!=='soundPlan'){p=videoReady(p);p=confirmed(reviewed(produce(p,videoResult(p))));}return p;}
function narrationOnlyFilm(){let p=approved(reviewed(author(allVideos(),noSound,'sound-designer')));assert.equal(p.step,'editPlan');assertAllowed(p,'editPlan');p=approved(reviewed(author(p,editPlan(p),'film-editor')));assertAllowed(p,'film');return send(p,'rendered',{actor:'runtime',content:{files:[{...image(70),path:'/isolated-test/film.mp4',durationSeconds:60,width:1920,height:1080,fps:30,hasAudio:true}],editPlanDigest:current(p,'editPlan').digest,manifestDigest:digest(assemblyManifest(p)),inspection,contactSheet:image(71),provenance:p.artifacts.filter(a=>a.valid&&a.approvedBy).map(a=>({artifactId:a.id,digest:a.digest}))}});}

test('new projects bind Mini 480p; missing saved profile keeps legacy model and resolution',()=>{
 const p=videoReady(supervisedVideoReady()),plan={provider:'replicate',operation:'video',estimatedCostUsd:.5,parameters:{prompt:current(p)?.content?.prompt??current(p,`videoPrompt:${p.clipId}`).content.prompt}};
 const request=requestDescriptor(p,plan);assert.equal(request.endpoint,'https://api.replicate.com/v1/models/bytedance/seedance-2.0-mini/predictions');assert.equal(request.input.resolution,'480p');assert.equal(request.input.generate_audio,false);assert.equal(request.frame.sha256,taskFor(p).videoBinding.keyframeSha256);assert.equal(request.input.duration,5);
 assert.equal(initialProject('new',inputs,{workflowRevision:3}).productionProfile,'seedance-mini-480p');
 const saved=structuredClone(initialProject('older',inputs,{workflowRevision:3}));delete saved.productionProfile;const legacy=Project.parse(saved);assert.equal(legacy.productionProfile,'legacy-seedance-hd');
 const old=videoReady(),oldRequest=requestDescriptor(old,plan);assert.ok(oldRequest.endpoint.endsWith('/seedance-2.0/predictions'));assert.equal(oldRequest.input.resolution,'1080p');
 assert.throws(()=>validateVideoPlan(p,{...videoPlan(p),resolution:'1080p'}),/VIDEO_PROFILE_MISMATCH/);
 assert.throws(()=>validateVideoPlan(old,{...videoPlan(old),resolution:'480p'}),/VIDEO_PROFILE_MISMATCH/);
 assert.throws(()=>requestDescriptor(p,{...plan,parameters:{...plan.parameters,model:'seedance-2.5'}}),/unsupported override/);
 const receipt=videoResult(p);validateStudioContent(p,receipt);
 for(const dimensions of [{width:432,height:248},{width:864,height:864},{width:1280,height:720}])assert.throws(()=>validateStudioContent(p,{...receipt,files:[{...receipt.files[0],...dimensions}]}),/source dimensions/);
});

test('a missing approved scene keyframe blocks the video stage before any request',()=>{
 const p=videoReady(supervisedVideoReady());current(p,`keyframe:${taskFor(p).videoBinding.clip.shotId}`).approvedBy=undefined;assert.throws(()=>assertAllowed(p,'video'),/KEYFRAME_LOCK_REQUIRED/);
});

test('video defects report localized evidence, reopen Vin, and require exact spending approval again',async()=>{
 let p=videoReady(supervisedVideoReady());p=send(p,'allowance',{allowance:{operations:['video'],repairOf:`video:${p.clipId}`,maxRequests:10,maxCostUsd:10},message:'ISOLATED broad repair allowance'});
 p=produce(p,videoResult(p));const failed=current(p),jobs=p.jobs.length;p=rejected(p);
 assert.equal(p.step,'videoPrompt');assert.equal(p.gate,'author');assert.equal(taskFor(p).formatRole,'video-prompt-engineer');assert.equal(p.jobs.length,jobs);
 const notice=taskFor(p).repairNotices.at(-1);assert.equal(notice.artifactId,failed.id);assert.equal(notice.status,'repair-pending');assert.match(notice.findings[0].evidence,/Three/);assert.match(notice.findings[0].repair,/two hands/);assert.equal(notice.findings[0].location,'Left hand beside steering wheel');assert.ok(!JSON.stringify(notice).includes(failed.content.files[0].path));
 await assert.rejects(presentDeliverable({project:p,pending:taskFor(p)}),/DELIVERY_BLOCKED/);
 p=videoReady(p,true);p=send(p,'plan',{plan:{provider:'replicate',operation:'video',estimatedCostUsd:.5,parameters:{prompt:videoResult(p).prompt}}});assert.equal(p.gate,'authorize');assert.equal(p.jobs.at(-1).allowanceId,undefined);assert.equal(taskFor(p).reviewPolicy.automaticVideoRepairAllowed,false);
 const j=p.jobs.at(-1);assert.throws(()=>send(p,'begin',{jobId:j.id,artifactDigest:j.digest}),/authoriz|submission/i);
 p=send(p,'authorize',{jobId:j.id,artifactDigest:j.digest,message:'ISOLATED actual second-request approval'});p=send(p,'begin',{jobId:j.id,artifactDigest:j.digest});p=send(p,'receipt',{jobId:j.id,artifactDigest:j.digest,result:videoResult(p)});p=confirmed(reviewed(p));assert.equal(repairNotices(p).at(-1).status,'repaired-and-approved');
 const vera={name:'Vera',role:'visual-reviewer'};for(const tool of ['generateImage','generateVideo','authorize','writeFile'])await assert.rejects(crewTools(taskFor(p),vera)(tool,{}),/TOOL_PERMISSION_DENIED/);
});

test('background image repair returns to Pia while preserving Beau brief and bounds retries across prompt versions',()=>{
 let p=masterReady(),briefId=current(p,'backgroundBrief:home').id;const result=()=>({files:[5,6,7].map(image),prompt:current(p,'backgroundPrompt:home').content.prompt});
 p=rejected(produce(p,result()));assert.equal(p.step,'backgroundPrompt');assert.equal(p.gate,'author');assert.equal(taskFor(p).formatRole,'pixar-prompter');assert.equal(current(p,'backgroundBrief:home').id,briefId);assert.equal(current(p,'backgroundCandidates:home'),undefined);assert.equal(p.jobs.filter(j=>j.plan.operation==='backgroundCandidates').length,1);
 p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));p=rejected(produce(p,result()));assert.equal(p.gate,'escalate');
 p=send(p,'resolve',{message:'ISOLATED explicit further repair'});assert.equal(p.step,'backgroundPrompt');p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));p=rejected(produce(p,result()));assert.equal(p.gate,'escalate');p=send(p,'resolve',{message:'ISOLATED attempt to repair again'});p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));assert.throws(()=>produce(p,result()),/ATTEMPT_LIMIT/);
});

test('sheet and derived angle defects return to their prompt authors instead of directly generating',()=>{
 // Re-open a fixture at its media review to inject a planted defect; no quality claim.
 for(const [key,step,expected]of [['sheet:alex','sheet','sheetPrompt'],['backgroundAngle:home:reverse','backgroundAngle','backgroundAnglePrompt']]){
  const p=supervisedBackgrounds(),a=current(p,key);delete a.approvedBy;delete a.humanReview;p.step=step;p.gate='review';p.characterId=step==='sheet'?'alex':null;p.locationId=step==='backgroundAngle'?'home':null;p.angleId=step==='backgroundAngle'?'reverse':null;
  const q=rejected(p);assert.equal(q.step,expected);assert.equal(q.gate,'author');assert.equal(q.jobs.length,p.jobs.length);assert.ok(taskFor(q).feedback.some(f=>f.message.includes('two hands')));
 }
});

test('narration-only film retains separate Vera and Ava review gates and survives every SQLite restart',async()=>{
 const {project,events}=captureEvents(()=>confirmed(reviewed(narrationOnlyFilm()))),dir=await mkdtemp(join(tmpdir(),'memoir-mini-flow-'));let w=openWorkflow(join(dir,'state.sqlite'));
 try{await w.init('invented-supervised',inputs,{workflowRevision:3});for(const e of events){await w.respond('invented-supervised',e);w.close();w=openWorkflow(join(dir,'state.sqlite'));}const {project:p}=await w.status('invented-supervised');assert.equal(p.step,'complete');assert.equal(current(p,'film').digest,current(project,'film').digest);const manifest=assemblyManifest(p);assert.equal(manifest.music,null);assert.deepEqual(manifest.effects,[]);assert.ok(!p.jobs.some(j=>['music','effect'].includes(j.plan.operation)));assert.notEqual(current(p,'film').visualReviewedBy,current(p,'film').audioReviewedBy);assert.ok(p.jobs.filter(j=>j.plan.operation==='video').every(j=>j.authorization&&!j.allowanceId));}finally{w.close();await rm(dir,{recursive:true});}
 let p=narrationOnlyFilm();p=reviewed(p,'approved',{perception:'direct-video'});assert.equal(p.gate,'review');assert.equal(taskFor(p).formatRole,'audio-reviewer');assert.throws(()=>confirmed(p),/separate visual and audio|agent-passing/);p=reviewed(p);assert.equal(p.gate,'human');assert.equal(confirmed(p).step,'complete');
});

test('omitting music requires an explicit reviewed decision; effects still require locks',()=>{
 const p=allVideos();assert.throws(()=>author(p,{...noSound,noMusicReason:''},'sound-designer'),/NO_MUSIC_DECISION_REQUIRED/);assert.throws(()=>author(p,{...noSound,noEffectsReason:''},'sound-designer'),/no-effects/);
 const effect={id:'bell',mode:'import',prompt:'Quiet bell',startSeconds:20,durationSeconds:1,gainDb:-12,provenance:{source:'imported',description:'ISOLATED',usageRights:'ISOLATED'}};
 let q=approved(reviewed(author(p,{...noSound,effects:[effect]},'sound-designer')));assert.equal(q.step,'effect');q=confirmed(reviewed(author(q,{files:[{path:'/isolated-test/bell.wav',sha256:'e'.repeat(64),bytes:1024,durationSeconds:1}],prompt:effect.prompt,provenance:effect.provenance},'sound-designer')));assert.equal(q.step,'editPlan');q=approved(reviewed(author(q,editPlan(q),'film-editor')));assertAllowed(q,'film');current(q,'effect:bell').approvedBy=undefined;assert.throws(()=>assertAllowed(q,'film'),/EDIT_SOUND_LOCK_REQUIRED/);
});

test('real local audio mixing supports narration alone and effects without music or tempo changes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-mini-tone-'));try{const source=join(dir,'tone.wav');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=0.5',source]);const file={path:source},edit={narrationGainDb:0,musicGainDb:-18,duckMusic:true,effectGainDb:0,musicFadeInSeconds:1,musicFadeOutSeconds:1};
 for(const effects of [[],[{file,startSeconds:10,durationSeconds:.5,gainDb:-12}]]){const out=join(dir,`mix-${effects.length}.wav`),args=audioMixArgs({narration:Array(4).fill(file),music:null,effects,edit},out),filter=args[args.indexOf('-filter_complex')+1];assert.doesNotMatch(filter,/atempo|rubberband|sidechaincompress|\[music\]|\[score\]/);assert.equal(args.filter(a=>a==='-i').length,4+effects.length);execFileSync('ffmpeg',args,{stdio:'ignore'});const m=await probe(out);assert.equal(m.durationSeconds,60);assert.equal(m.width,undefined);}
 }finally{await rm(dir,{recursive:true});}
});


test('Mini mocked POST sends actual first-frame bytes and recovers the same request ID without another POST',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-mini-http-'));try{const path=join(dir,'frame.png');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=32x18','-frames:v','1',path]);
 const p=videoReady(supervisedVideoReady()),plan={provider:'replicate',operation:'video',estimatedCostUsd:.5,parameters:{prompt:current(p,`videoPrompt:${p.clipId}`).content.prompt}},request=requestDescriptor(p,plan);request.frame={...request.frame,path};request.runDir=dir;const job={digest:'ISOLATED',request};let posts=0,gets=0;const ids=[];
 const fetcher=async(url,options)=>{if(options.method==='POST'){posts++;assert.equal(url,'https://api.replicate.com/v1/models/bytedance/seedance-2.0-mini/predictions');const body=JSON.parse(options.body);assert.equal(body.input.resolution,'480p');assert.equal(body.input.aspect_ratio,'16:9');assert.equal(body.input.generate_audio,false);assert.equal(body.input.image,`data:image/png;base64,${(await readFile(path)).toString('base64')}`);return Response.json({id:'isolated-mini',status:'processing'});}gets++;assert.equal(url,'https://api.replicate.com/v1/predictions/isolated-mini');return Response.json({id:'isolated-mini',status:'processing'});};
 assert.equal((await executeVideo(job,dir,'ISOLATED_KEY',fetcher,false,id=>ids.push(id))).pending,true);assert.equal((await executeVideo(job,dir,'ISOLATED_KEY',fetcher,true,id=>ids.push(id))).pending,true);assert.equal(posts,1);assert.equal(gets,1);assert.deepEqual(ids,['isolated-mini','isolated-mini']);
 }finally{await rm(dir,{recursive:true});}
});
