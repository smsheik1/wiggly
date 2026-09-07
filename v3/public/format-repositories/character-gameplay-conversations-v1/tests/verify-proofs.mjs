import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { layout } from '../runtime/render.mjs';
const files=process.argv.slice(2);
assert.equal(files.length,2,'Pass same-universe and crossover output MP4 paths');
const run=(tool,args)=>execFileSync(tool,['-v','error','-protocol_whitelist','file,pipe',...args],{timeout:30000,maxBuffer:16*1024*1024});
const results=[];
for(const [index,file]of files.entries()){
 const frequencies=index===0?[220,440,220,440]:[660,330,660];
 const probe=JSON.parse(run('ffprobe',['-show_format','-show_streams','-of','json',file]).toString());
 const video=probe.streams.find(s=>s.codec_type==='video');assert.equal(video.width,1080);assert.equal(video.height,1920);assert.equal(video.sample_aspect_ratio,'1:1');assert.equal(video.r_frame_rate,'25/1');assert.ok(Math.abs(Number(probe.format.duration)-frequencies.length*2)<0.08);assert.ok(probe.streams.some(s=>s.codec_type==='audio'));
 const measured=[];const captionFrames=[];
 for(const [i,hz]of frequencies.entries()){
  const pcm=run('ffmpeg',['-ss',String(i*2+0.5),'-i',file,'-t','0.5','-vn','-ac','1','-ar','48000','-f','f32le','pipe:1']);
  let crossings=0,squares=0,prior=pcm.readFloatLE(0);for(let k=4;k<pcm.length;k+=4){const current=pcm.readFloatLE(k);if(prior<=0&&current>0)crossings++;squares+=current*current;prior=current;}
  const actual=crossings/(pcm.length/4/48000),rms=Math.sqrt(squares/(pcm.length/4));assert.ok(Math.abs(actual-hz)<=4,`${file} turn ${i}: ${actual} Hz != ${hz} Hz`);assert.ok(rms>0.04,'Audio must contain the supplied tone, not silence');measured.push({turn:i+1,expectedHz:hz,measuredHz:actual,rms});
  const rgb=run('ffmpeg',['-ss',String(i*2+0.5),'-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
  assert.equal(rgb.length,1080*1920*3);assert.ok(rgb[0]>240&&rgb[1]>240&&rgb[2]>240,'Header corner should be white');
  const captionEnd=layout.captionTop+2*layout.captionLineHeight;
  let white=0;for(let k=layout.captionTop*layout.width*3;k<captionEnd*layout.width*3;k+=3)if(rgb[k]>220&&rgb[k+1]>220&&rgb[k+2]>220)white++;assert.ok(white>100,'Expected visible white caption pixels');
  captionFrames.push(createHash('sha256').update(rgb.subarray(layout.speakerTop*layout.width*3,captionEnd*layout.width*3)).digest('hex'));
 }
 assert.ok(new Set(captionFrames).size===frequencies.length,'Caption/speaker regions should differ across turns');results.push({file,durationSeconds:Number(probe.format.duration),width:1080,height:1920,fps:25,measuredAudio:measured,captionRegionHashes:captionFrames});
}
console.log(JSON.stringify({status:'passed',limitations:'Numerical stream/tone/pixel checks only; not direct audiovisual review or voice fidelity approval.',results},null,2));
