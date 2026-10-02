import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { keyFor } from '../runtime/gates.mjs';
import { current } from '../runtime/workflow.mjs';
import { digest } from '../runtime/contracts.mjs';
import { importMedia } from '../runtime/media.mjs';
import { executeJob,requestDescriptor } from '../runtime/providers.mjs';
import { audioMixArgs,inspectFilm } from '../runtime/assemble.mjs';
import { videoReady,videosLocked,soundPlan } from './studio-helpers.mjs';
import { approved,reviewed } from './helpers.mjs';
import { author } from './background-helpers.mjs';
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'memoir-studio-http-'));const image=join(dir,'frame.png'),video=join(dir,'tiny.mp4'),audio=join(dir,'tone.mp3');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=32x18','-frames:v','1',image]);execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=32x18:r=30:d=2','-f','lavfi','-i','sine=frequency=220:duration=2','-shortest','-c:v','libx264','-c:a','aac',video]);execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=330:duration=1',audio]);return{dir,image:await importMedia(image,dir),video:await importMedia(video,dir),audio:await importMedia(audio,dir)};}
function bind(p,plan){const job={id:'isolated-job',key:keyFor(p),plan,request:requestDescriptor(p,plan),dependencies:[],status:'submitting',authorization:{message:'ISOLATED mock only',at:new Date().toISOString()}};job.digest=digest({plan,request:job.request,dependencies:[]});p.jobs=[job];p.gate='collect';return job;}
test('Seedance POST uses actual first-frame bytes and persists ID; polling/recovery never POSTs again',async()=>{
 const f=await fixture();try{const p=videoReady();current(p,`keyframe:${p.clipId.replace(/-0$/,'')}`).content.files=[f.image];const plan={provider:'replicate',operation:'video',estimatedCostUsd:1,parameters:{prompt:current(p,`videoPrompt:${p.clipId}`).content.prompt}},job=bind(p,plan);let posts=0,gets=0,ids=[];
 const mocked=async(url,options)=>{if(options.method==='POST'){posts++;const body=JSON.parse(options.body);assert.equal(body.input.image,`data:image/png;base64,${(await readFile(f.image.path)).toString('base64')}`);assert.equal(body.input.generate_audio,false);assert.equal(body.input.duration,5);return Response.json({id:'pred-1',status:'processing'});}gets++;if(url.includes('api.replicate.com'))return Response.json({id:'pred-1',status:'succeeded',output:'https://replicate.delivery/mock/clip.mp4'});return new Response(await readFile(f.video.path));};
 const pending=await executeJob(p,job,f.dir,'isolated-key',mocked,false,id=>ids.push(id));assert.equal(pending.pending,true);assert.equal(posts,1);
 const result=await executeJob(p,job,f.dir,'isolated-key',mocked,true,id=>ids.push(id));assert.equal(result.providerJobId,'pred-1');assert.equal(result.files[0].fps,30);assert.equal(result.files[0].hasAudio,true);assert.equal(posts,1);assert.equal(gets,2);
 await executeJob(p,job,f.dir,'',()=>{throw new Error('No replay network');},true);assert.equal(posts,1);assert.deepEqual(ids,['pred-1','pred-1']);
 }finally{await rm(f.dir,{recursive:true});}
});
test('unknown video POST result blocks resubmit; failed polling never invents a fresh generation',async()=>{
 const f=await fixture();try{const p=videoReady();current(p,'keyframe:home-0-wide').content.files=[f.image];const plan={provider:'replicate',operation:'video',estimatedCostUsd:1,parameters:{prompt:current(p,`videoPrompt:${p.clipId}`).content.prompt}},job=bind(p,plan);let calls=0;
 await assert.rejects(executeJob(p,job,f.dir,'isolated-key',async()=>{calls++;throw new Error('Connection disappeared');}),/disappeared/);
 await assert.rejects(executeJob(p,job,f.dir,'isolated-key',async()=>{calls++;}),/UNCERTAIN/);await assert.rejects(executeJob(p,job,f.dir,'isolated-key',async()=>{calls++;},true),/UNCERTAIN/);assert.equal(calls,1);
 await writeFile(join(f.dir,'receipts',job.id,'prediction.json'),JSON.stringify({id:'pred-1',status:'processing'}));
 await assert.rejects(executeJob(p,job,f.dir,'isolated-key',async(url,options)=>{assert.notEqual(options.method,'POST');return Response.json({id:'pred-1',status:'failed',error:'isolated-key provider failure'});},true),/\[redacted\] provider failure/);
 }finally{await rm(f.dir,{recursive:true});}
});
test('music/effects have fixed instrumental API payloads, provenance and durable binary receipts',async()=>{
 const f=await fixture();try{let p=videosLocked();const generated=structuredClone(soundPlan);generated.music.mode='generate';generated.music.provenance.source='generated';generated.effects[0].mode='generate';generated.effects[0].provenance.source='generated';p=approved(reviewed(author(p,generated,'sound-designer')));
 for(const operation of ['music','effect']){p.step=operation;p.effectId=operation==='effect'?'bell':null;const plan={provider:'elevenlabs',operation,estimatedCostUsd:1,parameters:{prompt:operation==='music'?generated.music.prompt:generated.effects[0].prompt}},job=bind(p,plan);job.id=`isolated-${operation}`;let calls=0;
 const result=await executeJob(p,job,f.dir,'isolated-key',async(url,options)=>{calls++;assert.equal(options.headers['xi-api-key'],'isolated-key');const b=JSON.parse(options.body);if(operation==='music'){assert.ok(url.includes('/v1/music?'));assert.equal(b.force_instrumental,true);assert.equal(b.music_length_ms,60000);}else{assert.ok(url.includes('/sound-generation?'));assert.equal(b.duration_seconds,1);assert.equal(b.loop,false);}return new Response(await readFile(f.audio.path));});assert.equal(result.provenance.source,'generated');assert.equal(result.prompt,plan.parameters.prompt);
 await executeJob(p,job,f.dir,'',()=>{throw new Error('No replay');},true);assert.equal(calls,1);}
 }finally{await rm(f.dir,{recursive:true});}
});
test('technical film inspection reads actual video/audio and reports an intentional freeze without claiming anatomy',async()=>{
 const f=await fixture();try{const measured=await inspectFilm(f.video);assert.equal(measured.durationSeconds,2);assert.equal(measured.fps,30);assert.equal(measured.hasAudio,true);assert.ok(Number.isFinite(measured.integratedLufs));assert.ok(measured.freezeSeconds>=1);assert.equal(measured.anatomy,undefined);}finally{await rm(f.dir,{recursive:true});}
});

test('official audio mix executes on a two-second synthetic component fixture (not a story proof)',async()=>{
 const f=await fixture();try{const m={clips:Array.from({length:4},(_,i)=>({id:`c${i}`,durationSeconds:.5,file:f.video})),narration:Array(4).fill(f.audio),music:f.audio,effects:[],edit:{clips:Array.from({length:4},(_,i)=>({clipId:`c${i}`,sourceOffsetSeconds:0})),narrationGainDb:0,musicGainDb:-18,duckMusic:true,effectGainDb:0,musicFadeInSeconds:.1,musicFadeOutSeconds:.1}};const out=join(f.dir,'component.wav'),args=audioMixArgs(m,out);args[args.indexOf('-t')+1]='2';execFileSync('ffmpeg',args,{stdio:'pipe'});const output=await importMedia(out,f.dir);assert.equal(output.durationSeconds,2);assert.equal(output.width,undefined);assert.ok(output.bytes>0);}finally{await rm(f.dir,{recursive:true});}
});

test('video duration uses moving-video stream, never a longer accompanying audio track',async()=>{
 const f=await fixture();try{const path=join(f.dir,'short-video-long-audio.mp4');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=32x18:r=30:d=1','-f','lavfi','-i','sine=frequency=220:duration=5','-c:v','libx264','-c:a','aac',path]);const imported=await importMedia(path,f.dir);assert.equal(imported.durationSeconds,1);assert.equal(imported.hasAudio,true);}finally{await rm(f.dir,{recursive:true});}
});
