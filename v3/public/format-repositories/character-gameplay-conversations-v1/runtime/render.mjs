import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
const W=480,H=640,FPS=25;
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const positive=n=>Number.isFinite(n)&&n>0;
function text(value,label,max=80){check(typeof value==='string'&&value.trim().length&&value.length<=max,`${label}: nonempty text up to ${max} characters required`);check(/^[A-Za-z0-9 .,:?!'-]+$/.test(value),`${label}: unsupported character (ASCII letters, digits and .,:?!'- only)`);return value;}
function relative(value){check(typeof value==='string'&&!path.isAbsolute(value)&&!/[\\:\x00-\x1f]/.test(value)&&value.split('/').every(p=>p&&p!=='.'&&p!=='..'),'Media path must be portable and relative to the Format Repo root');return value;}
async function media(root,value){let current=root;for(const part of relative(value).split('/')){current=path.join(current,part);check(!(await lstat(current)).isSymbolicLink(),'Media symlinks are unsupported');}const info=await lstat(current);check(info.isFile(),'Media must be a regular file');check(info.size<=100*1024*1024,'Each media file must be at most 100 MB');return current;}
const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024}));
function words(value){return value.toUpperCase().replace(/[^A-Z0-9 ]/g,'').replace(/\s+/g,' ').trim();}
export async function validate(input,inputDirectory){
 check(input.schemaVersion===1,'schemaVersion must be 1');
 text(input.header?.title,'header.title',25);text(input.header?.question,'header.question',36);text(input.topic,'topic',100);
 check(['same-universe','crossover'].includes(input.castMode),'castMode must be same-universe or crossover');
 check(Array.isArray(input.cast)&&input.cast.length>=2&&input.cast.length<=6,'Provide 2-6 cast members');
 const ids=new Set();for(const member of input.cast){text(member.id,'cast.id',18);text(member.name,'cast.name',20);text(member.universe,'cast.universe',36);check(!ids.has(member.id),'Duplicate cast id');ids.add(member.id);}
 const universes=new Set(input.cast.map(c=>c.universe));check(input.castMode==='same-universe'?universes.size===1:universes.size>=2,'castMode must agree with cast universes');
 check(Array.isArray(input.turns)&&input.turns.length>=2&&input.turns.length<=12,'Provide 2-12 dialogue turns');
 check(input.gameplay?.authorized===true&&typeof input.gameplay?.provenance==='string'&&input.gameplay.provenance.trim(),'Explicit gameplay authorization and provenance required');
 const gameplay=await media(inputDirectory,input.gameplay.file);const gameplayProbe=probe(gameplay);check(gameplayProbe.streams.some(s=>s.codec_type==='video'),'Gameplay needs a video stream');
 let total=0;const turns=[];const speakers=new Set();
 for(const turn of input.turns){
  check(ids.has(turn.speaker),'Unknown turn speaker');speakers.add(turn.speaker);text(turn.text,'turn.text',250);check(positive(turn.durationSeconds)&&Number.isInteger(Math.round(turn.durationSeconds*1000)/40),'Turn duration must be positive in 1/25-second increments');
  check(turn.audio?.authorized===true&&typeof turn.audio?.provenance==='string'&&turn.audio.provenance.trim(),'Each turn requires explicit audio authorization and provenance');
  const audio=await media(inputDirectory,turn.audio.file);const audioProbe=probe(audio);check(audioProbe.streams.some(s=>s.codec_type==='audio'),'Every turn needs a supplied audio stream');
  check(Math.abs(Number(audioProbe.format.duration)-turn.durationSeconds)<=0.06,'Audio duration must agree with turn duration within 0.06 seconds');
  check(Array.isArray(turn.captions)&&turn.captions.length>=1&&turn.captions.length<=10,'Each turn needs 1-10 timed caption phrases');let previous=0;
  for(const caption of turn.captions){text(caption.text,'caption.text',38);check(Number.isFinite(caption.start)&&caption.start>=previous&&positive(caption.end)&&caption.end>caption.start&&caption.end<=turn.durationSeconds,'Caption timings must be ordered, non-overlapping, and inside the turn');previous=caption.end;}
  check(words(turn.captions.map(c=>c.text).join(' '))===words(turn.text),'Caption text must cover the supplied turn text');
  turns.push({...turn,audio,start:total});total+=turn.durationSeconds;
 }
 check(speakers.size>=2,'At least two characters must speak');check(total<=60,'Maximum output is 60 seconds');
 check(Number(gameplayProbe.format.duration)+0.02>=total,'Supplied gameplay is shorter than the conversation; no looping fallback');
 return {input,gameplay,turns,total};
}
function captionLines(value){const result=[];for(const word of value.split(' ')){const last=result.length-1;if(last>=0&&result[last].length+word.length+1<=19)result[last]+=' '+word;else result.push(word);}check(result.length<=2&&result.every(v=>v.length<=19),'Caption must fit two 19-character lines; split long phrases');return result;}
const xml=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// Rasterize each timed overlay once. FFmpeg still owns the single composition path.
export async function renderOverlay(input,turn,caption){
 const layers=[];
 const label=async(value,top,size,fill,outline=false)=>{
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="100"><text x="10" y="60" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${size}" fill="${fill}"${outline?' stroke="#101010" stroke-width="4" stroke-linejoin="round" paint-order="stroke fill"':''}>${xml(value.toUpperCase())}</text></svg>`;
  const cropped=await sharp(Buffer.from(svg)).trim().png().toBuffer();
  const {data,info}=await sharp(cropped).resize({width:436,withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
  layers.push({input:data,left:Math.floor((W-info.width)/2),top});
 };
 const speaker=turn&&input.cast.find(c=>c.id===turn.speaker);
 await label(input.header.title,23,38,'#ce222a');
 await label(input.header.question,76,26,'#101010');
 if(caption){await label(speaker.name,420,16,'#ffe282',true);for(const [i,value]of captionLines(caption.text).entries())await label(value,451+i*38,34,'white',true);}
 const header=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><rect width="480" height="136" fill="white"/></svg>');
 return sharp(header).composite(layers).ensureAlpha().raw().toBuffer();
}
export async function render(inputFile,outputFile){
 const source=await readFile(inputFile);const prepared=await validate(JSON.parse(source),path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
 const {input,gameplay,turns,total}=prepared;for(const turn of turns)turn.captions.forEach(c=>captionLines(c.text));
 check(outputFile.endsWith('.mp4'),'Output must be .mp4');check(!await lstat(outputFile).catch(()=>null),'Output exists; use a new path');
 await mkdir(path.dirname(path.resolve(outputFile)),{recursive:true});
 const args=['-v','error','-n','-threads','1','-protocol_whitelist','file,pipe','-i',gameplay];for(const turn of turns)args.push('-protocol_whitelist','file,pipe','-i',turn.audio);
 const overlayIndex=turns.length+1;args.push('-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-protocol_whitelist','file,pipe','-i','pipe:0');
 const filters=[`[0:v]scale=480:504:force_original_aspect_ratio=increase,crop=480:504,pad=480:640:0:136:color=black,setsar=1,fps=25[base]`,`[base][${overlayIndex}:v]overlay=0:0:shortest=1[video]`];
 for(const [i,turn]of turns.entries())filters.push(`[${i+1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,apad,atrim=duration=${turn.durationSeconds},asetpts=PTS-STARTPTS[a${i}]`);
 filters.push(`${turns.map((_,i)=>`[a${i}]`).join('')}concat=n=${turns.length}:v=0:a=1[audio]`);
 args.push('-filter_complex_threads','1','-filter_complex',filters.join(';'),'-map','[video]','-map','[audio]','-t',String(total),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-threads','1','-c:a','aac','-b:a','128k','-movflags','+faststart',outputFile);
 const base=await renderOverlay(input);
 const child=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});let errors='',timedOut=false;child.stderr.on('data',b=>{errors=(errors+b).slice(-16000);});child.stdin.on('error',()=>{});
 const timeout=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},120000);
 const exited=new Promise((resolve,reject)=>{child.on('error',error=>{clearTimeout(timeout);reject(error);});child.on('close',code=>{clearTimeout(timeout);code===0?resolve():reject(new Error(`FFmpeg ${timedOut?'timed out':'failed'} (${code}): ${errors}`));});});exited.catch(()=>{});
 let cachedKey='',frame=base;
 try { for(let n=0;n<Math.round(total*FPS);n++){
  const t=n/FPS;const turn=turns.find(turn=>t>=turn.start&&t<turn.start+turn.durationSeconds);const caption=turn?.captions.find(c=>t-turn.start>=c.start&&t-turn.start<c.end);const key=caption?`${turn.start}:${caption.start}`:'';
  if(key!==cachedKey){cachedKey=key;frame=caption?await renderOverlay(input,turn,caption):base;}
  if(child.stdin.destroyed)break;if(!child.stdin.write(frame))await Promise.race([once(child.stdin,'drain'),exited]);
 }
 child.stdin.end();await exited; } finally {clearTimeout(timeout);if(child.exitCode===null)child.kill('SIGKILL');}
 const receipt={schemaVersion:1,argv:['node',path.relative(process.cwd(),fileURLToPath(import.meta.url)),path.relative(process.cwd(),inputFile),path.relative(process.cwd(),outputFile)],inputSha256:digest(source),runtimeSha256:digest(await readFile(fileURLToPath(import.meta.url))),outputSha256:digest(await readFile(outputFile)),durationSeconds:total,width:W,height:H,fps:FPS,gameplaySha256:digest(await readFile(gameplay)),audioSha256:await Promise.all(turns.map(async t=>digest(await readFile(t.audio)))),review:'Supplied-media composition completed. No direct moving-video or audio perception; voice identity, reference fidelity and creative approval remain unverified.'};
 await writeFile(`${outputFile}.receipt.json`,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output]=process.argv.slice(2);if(!input||!output){console.error('Usage: node runtime/render.mjs INPUT.json NEW-OUTPUT.mp4');process.exitCode=1;}else await render(path.resolve(input),path.resolve(output)).then(value=>console.log(JSON.stringify(value,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
