import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, render } from '../runtime/render.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const scratch=await mkdtemp(path.join(root,'.music-test-'));
after(()=>rm(scratch,{recursive:true,force:true}));
const base=JSON.parse(await readFile(path.join(root,'inputs/same-universe.json'),'utf8'));
const bed=path.join(scratch,'bed.wav');
execFileSync('ffmpeg',['-v','error','-n','-f','lavfi','-i','sine=frequency=83:sample_rate=48000:duration=8',bed],{timeout:30000});
const withMusic=()=>({...structuredClone(base),music:{file:path.relative(root,bed),authorized:true,provenance:'Original 83 Hz diagnostic tone; not music or speech.',attribution:'Diagnostic test credit',volume:0.1}});

test('music is optional and accepts an authorized full-length bed',async()=>{
 assert.equal((await validate(base,root)).music,null);
 const input=withMusic();delete input.music.volume;
 const result=await validate(input,root);assert.equal(result.music.volume,0.1);assert.equal(result.total,8);
});
for(const [name,mutate,pattern]of [
 ['reject unauthorized music',m=>m.authorized=false,/authorization and provenance/],
 ['reject missing music provenance',m=>m.provenance='',/authorization and provenance/],
 ['reject missing music',m=>m.file='assets/missing-music.wav',/ENOENT/],
 ['reject external music paths',m=>m.file='../music.wav',/portable and relative/],
 ['reject a music file without audio',m=>m.file='assets/warm.mp4',/audio stream/],
 ['reject a short bed instead of looping silently',m=>m.file='assets/low.wav',/shorter than the conversation/],
 ['reject a loud music setting',m=>m.volume=0.5,/at most 0.25/],
 ['reject invalid music gain',m=>m.volume='0.1',/Music volume/],
 ['reject invalid attribution',m=>m.attribution={},/Music attribution/]
])test(name,async()=>{const input=withMusic();mutate(input.music);await assert.rejects(validate(input,root),pattern);});

const pcm=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-vn','-ac','1','-ar','48000','-f','f32le','pipe:1'],{timeout:30000,maxBuffer:4*1024*1024});
function amplitude(bytes,hz,start=0.8,duration=0.4){
 const offset=Math.round(start*48000),count=Math.round(duration*48000);let re=0,im=0;
 for(let n=0;n<count;n++){const sample=bytes.readFloatLE((offset+n)*4),angle=2*Math.PI*hz*n/48000;re+=sample*Math.cos(angle);im+=sample*Math.sin(angle);}
 return 2*Math.hypot(re,im)/count;
}
test('official renderer mixes a quieter bed, preserves dialogue and carries credit',async()=>{
 const input=withMusic(),inputPath=path.join(scratch,'episode.json'),output=path.join(scratch,'episode.mp4');
 await writeFile(inputPath,JSON.stringify(input));const receipt=await render(inputPath,output);
 const decoded=pcm(output),voice=amplitude(decoded,220),music=amplitude(decoded,83);
 assert.ok(voice>0.1&&voice<0.14,`Voice gain changed: ${voice}`);
 assert.ok(music>0.001&&music<0.009,`Music missing or not ducked: ${music}`);
 assert.ok(voice/music>12,'Dialogue must remain clearly above the diagnostic music signal');
 assert.ok(amplitude(decoded,83,7.8,0.12)<music*0.55,'Music must fade before the ending');
 let peak=0;for(let n=0;n<decoded.length;n+=4)peak=Math.max(peak,Math.abs(decoded.readFloatLE(n)));assert.ok(peak<0.97,'Mix must not clip');
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',output],{encoding:'utf8'}));
 assert.ok(Math.abs(Number(probe.format.duration)-8)<0.08);assert.equal(probe.format.tags.comment,input.music.attribution);
 assert.equal(receipt.music.attribution,input.music.attribution);assert.equal(receipt.music.duckedUnderDialogue,true);assert.equal(receipt.music.sha256.length,64);
 assert.deepEqual([receipt.width,receipt.height],[1080,1920]);
});
