import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assemblyManifest, assertFilmInspection } from './studio.mjs';
import { current, assertAllowed } from './gates.mjs';
import { digest } from './contracts.mjs';
import { importMedia, verifyFiles, probe } from './media.mjs';
const exec=promisify(execFile);
export function assemblyArgs(manifest,out){
 const {clips,narration,music,effects,edit}=manifest,inputs=[...clips.map(c=>c.file),...narration,music,...effects.map(e=>e.file)],filters=[];const n=clips.length;
 clips.forEach((c,i)=>filters.push(`[${i}:v]trim=start=${edit.clips[i].sourceOffsetSeconds}:duration=${c.durationSeconds},setpts=PTS-STARTPTS,fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${i}]`));
 filters.push(`${clips.map((_,i)=>`[v${i}]`).join('')}concat=n=${n}:v=1:a=0[video]`);
 narration.forEach((file,i)=>filters.push(`[${n+i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${edit.narrationGainDb}dB,adelay=${i*15000}|${i*15000},apad=whole_dur=60,atrim=duration=60[a${i}]`));
 filters.push('[a0][a1][a2][a3]amix=inputs=4:normalize=0:dropout_transition=0[vo]');
 filters.push(`[${n+4}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=60,asetpts=PTS-STARTPTS,volume=${edit.musicGainDb}dB,afade=t=in:d=${edit.musicFadeInSeconds},afade=t=out:st=${60-edit.musicFadeOutSeconds}:d=${edit.musicFadeOutSeconds}[music]`);
 if(edit.duckMusic){filters.push('[vo]asplit=2[voice][side]','[music][side]sidechaincompress=threshold=0.015:ratio=8:attack=20:release=300[score]');}else filters.push('[vo]anull[voice]','[music]anull[score]');
 effects.forEach((e,i)=>filters.push(`[${n+5+i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${e.durationSeconds},asetpts=PTS-STARTPTS,volume=${e.gainDb+edit.effectGainDb}dB,adelay=${Math.round(e.startSeconds*1000)}|${Math.round(e.startSeconds*1000)},apad=whole_dur=60,atrim=duration=60[fx${i}]`));
 filters.push(`[voice][score]${effects.map((_,i)=>`[fx${i}]`).join('')}amix=inputs=${2+effects.length}:normalize=0:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[mix]`);
 return ['-hide_banner','-y',...inputs.flatMap(f=>['-i',f.path]),'-filter_complex',filters.join(';'),'-map','[video]','-map','[mix]','-t','60','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-movflags','+faststart','-progress','pipe:1','-nostats',out];
}
export async function inspectFilm(file){
 await verifyFiles(file);const metadata=await probe(file.path);
 const {stderr}=await exec('ffmpeg',['-hide_banner','-i',file.path,'-vf','blackdetect=d=0.2:pix_th=0.10,freezedetect=n=-50dB:d=1','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'],{maxBuffer:8*1024*1024});
 const block=stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g)?.at(-1);if(!block)throw new Error('Loudness measurements unavailable.');const loud=JSON.parse(block);
 const blackSeconds=[...stderr.matchAll(/black_duration:([0-9.]+)/g)].reduce((n,m)=>n+Number(m[1]),0);
 let freezeSeconds=[...stderr.matchAll(/freeze_duration: ([0-9.]+)/g)].reduce((n,m)=>n+Number(m[1]),0);
 const starts=[...stderr.matchAll(/freeze_start: ([0-9.]+)/g)],ends=[...stderr.matchAll(/freeze_end: ([0-9.]+)/g)];if(starts.length>ends.length)freezeSeconds+=metadata.durationSeconds-Number(starts.at(-1)[1]);
 const measured={...metadata,integratedLufs:Number(loud.input_i),truePeakDb:Number(loud.input_tp),blackSeconds,freezeSeconds};if(!Number.isFinite(measured.integratedLufs)||!Number.isFinite(measured.truePeakDb))throw new Error('Silent/unmeasurable film audio.');return measured;
}
export async function renderFilm(p,runDir){
 assertAllowed(p,'film');if(p.step!=='film'||p.gate!=='produce')throw new Error('Render requires current locked edit plan.');const manifest=assemblyManifest(p);await verifyFiles(manifest);
 const dir=join(runDir,'assembly',digest(manifest));await mkdir(dir,{recursive:true});const out=join(dir,'film.mp4');let updates=Promise.resolve();
 const progress=value=>{updates=updates.then(async()=>{const data={...value,manifestDigest:digest(manifest)};await writeFile(join(dir,'progress.json'),JSON.stringify(data,null,2));await writeFile(join(dir,'progress.html'),`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>Memoir render</title></head><body><h2>Memoir assembly</h2><progress max="60" value="${value.seconds??0}"></progress><p>${value.status}: ${(value.seconds??0).toFixed(1)} / 60 seconds</p></body></html>`);});};progress({status:'rendering',seconds:0});
 await new Promise((resolve,reject)=>{const child=spawn('ffmpeg',assemblyArgs(manifest,out));let logs='',buffer='';child.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){const match=line.match(/^out_time_us=(\d+)/);if(match)progress({status:'rendering',seconds:Math.min(60,Number(match[1])/1e6)});}});child.stderr.on('data',chunk=>{logs=(logs+chunk).slice(-16000);});child.on('error',reject);child.on('close',code=>{if(code===0)resolve();else reject(new Error(`Assembly failed (${code}): ${logs}`));});}).catch(async e=>{progress({status:'failed',seconds:0});await updates;throw e;});
 const file=await importMedia(out,runDir),inspection=await inspectFilm(file);assertFilmInspection(inspection);
 const sheet=join(dir,'contact-sheet.png');await exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',out,'-vf','fps=1/5,scale=480:-1,tile=4x3','-frames:v','1',sheet]);const contactSheet=await importMedia(sheet,runDir);
 const provenance=p.artifacts.filter(a=>a.valid&&a.approvedBy).map(a=>({artifactId:a.id,digest:a.digest}));
 const result={files:[file],editPlanDigest:current(p,'editPlan').digest,manifestDigest:digest(manifest),inspection,contactSheet,provenance};await writeFile(join(dir,'manifest.json'),JSON.stringify({manifest,result},null,2),{mode:0o600});progress({status:'ready-for-review',seconds:60});await updates;return result;
}
