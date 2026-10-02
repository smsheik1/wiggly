import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assemblyManifest, assertFilmInspection } from './studio.mjs';
import { current, assertAllowed } from './gates.mjs';
import { digest } from './contracts.mjs';
import { importMedia, verifyFiles, probe } from './media.mjs';
import { prepareComposition, renderComposition } from './remotion.mjs';
const exec=promisify(execFile);
export {audioMixArgs} from './mix.mjs';
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
 try {
  const prepared=await prepareComposition(manifest,dir);
  await renderComposition(prepared,out,fraction=>progress({status:'rendering',seconds:fraction*60}));

 const file=await importMedia(out,runDir),inspection=await inspectFilm(file);assertFilmInspection(inspection);
 const sheet=join(dir,'contact-sheet.png');await exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',out,'-vf','fps=1/5,scale=480:-1,tile=4x3','-frames:v','1',sheet]);const contactSheet=await importMedia(sheet,runDir);
 const provenance=p.artifacts.filter(a=>a.valid&&a.approvedBy).map(a=>({artifactId:a.id,digest:a.digest}));
 const result={files:[file],rendererDigest:prepared.rendererDigest,sceneDigest:digest(prepared.scene),editPlanDigest:current(p,'editPlan').digest,manifestDigest:digest(manifest),inspection,contactSheet,provenance};await writeFile(join(dir,'manifest.json'),JSON.stringify({manifest,result},null,2),{mode:0o600});progress({status:'ready-for-review',seconds:60});await updates;return result;
 } catch(e) {progress({status:'failed',seconds:0});await updates;throw e;}
}
