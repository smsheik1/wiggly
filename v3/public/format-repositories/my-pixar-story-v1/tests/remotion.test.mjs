import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {compositionScene,prepareComposition,renderComposition,verifyRenderer,servePreview} from '../runtime/remotion.mjs';
import {importMedia} from '../runtime/media.mjs';
import {digest} from '../runtime/contracts.mjs';

test('composition uses integer frames and binds the exact mixed timeline without changing speed',()=>{
 const m={clips:[{id:'a',durationSeconds:1/30},{id:'b',durationSeconds:60-1/30}],edit:{clips:[{sourceOffsetSeconds:1},{sourceOffsetSeconds:0}]}};
 const scene=compositionScene(m,['/a.mp4','/b.mp4'],'/mix.wav');assert.equal(scene.layout.clips[0].durationFrames,1);assert.equal(scene.layout.clips[1].startFrame,1);assert.equal(scene.layout.clips[1].durationFrames,1799);assert.equal(scene.layout.clips[0].sourceOffsetSeconds,1);assert.equal(scene.layout.manifestDigest,digest(m));assert.equal(scene.audio.durationMs,60000);assert.equal(scene.audio.url,'/mix.wav');assert.equal(scene.layout.clips[0].playbackRate,undefined);
});
test('packaged official Remotion renderer renders a synthetic two-second component with source trim and exact cut',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-remotion-component-'));
 try{
 const source=join(dir,'red-blue.mp4'),green=join(dir,'green.mp4'),tone=join(dir,'tone.wav');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=160x90:r=30:d=1','-f','lavfi','-i','color=c=blue:s=160x90:r=30:d=1','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-c:v','libx264',source]);
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=160x90:r=30:d=2','-c:v','libx264',green]);
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=330:duration=0.3',tone]);
 const a=await importMedia(source,dir),b=await importMedia(green,dir),audio=await importMedia(tone,dir);
 const m={clips:Array.from({length:60},(_,i)=>({id:`c${i}`,durationSeconds:1,file:i?b:a})),narration:Array(4).fill(audio),music:audio,effects:[],edit:{clips:Array.from({length:60},(_,i)=>({clipId:`c${i}`,sourceOffsetSeconds:i?0:1})),narrationGainDb:0,musicGainDb:-18,duckMusic:true,effectGainDb:0,musicFadeInSeconds:.1,musicFadeOutSeconds:.1}};
 await verifyRenderer();const prepared=await prepareComposition(m,dir);const out=join(dir,'component.mp4');await renderComposition(prepared,out,()=>{},[0,59]);const output=await importMedia(out,dir);assert.equal(output.durationSeconds,2);assert.equal(output.width,1920);assert.equal(output.height,1080);assert.equal(output.fps,30);assert.equal(output.hasAudio,true);
 const pixel=t=>execFileSync('ffmpeg',['-v','error','-ss',String(t),'-i',out,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','-']);const first=pixel(.2),second=pixel(1.2);assert.ok(first[2]>first[0]+100,'Source offset must select blue, not original red.');assert.ok(second[1]>second[0]+50,'Next clip must start at exactly one second.');
 const preview=await servePreview(prepared);try{const html=await fetch(preview.url).then(r=>r.text());assert.ok(html.includes('preview.js'));const saved=await fetch(preview.url.replace('preview.html','scene.json')).then(r=>r.json());assert.deepEqual(saved,prepared.scene);const clip=await fetch(new URL('/memoir/clip-0.mp4',preview.url),{headers:{Range:'bytes=0-99'}});assert.equal(clip.status,206);assert.equal((await clip.arrayBuffer()).byteLength,100);const mix=await fetch(new URL('/memoir/mix.wav',preview.url),{method:'HEAD'});assert.equal(mix.status,200);assert.ok(Number(mix.headers.get('content-length'))>0);}finally{await new Promise(ok=>preview.server.close(ok));}
 }finally{if(process.env.MEMOIR_KEEP_COMPONENT)console.log(`ISOLATED component directory: ${dir}`);else await rm(dir,{recursive:true});}
});
