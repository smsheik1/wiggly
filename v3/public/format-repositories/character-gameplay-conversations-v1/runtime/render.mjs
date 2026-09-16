import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
export const layout=Object.freeze({width:1080,height:1920,fps:25,headerHeight:306,textWidth:900,speakerTop:1260,captionTop:1350,captionLineHeight:86});
const {width:W,height:H,fps:FPS}=layout;
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
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

 const gameplayClips={};
 if(input.gameplays!==undefined){
  check(typeof input.gameplays==='object'&&input.gameplays!==null&&Object.keys(input.gameplays).length>=1,'gameplays must be an object with at least 1 clip');
  for(const [key,gp] of Object.entries(input.gameplays)){
   check(gp?.authorized===true&&typeof gp?.provenance==='string'&&gp.provenance.trim(),`Explicit gameplay authorization and provenance required for "${key}"`);
   const file=await media(inputDirectory,gp.file);const info=probe(file);check(info.streams.some(s=>s.codec_type==='video'),`Gameplay "${key}" needs a video stream`);
   gameplayClips[key]={key,file,duration:Number(info.format.duration)};
  }
 }else{
  check(input.gameplay?.authorized===true&&typeof input.gameplay?.provenance==='string'&&input.gameplay.provenance.trim(),'Explicit gameplay authorization and provenance required');
  const gameplay=await media(inputDirectory,input.gameplay.file);const gameplayProbe=probe(gameplay);check(gameplayProbe.streams.some(s=>s.codec_type==='video'),'Gameplay needs a video stream');
  gameplayClips.default={key:'default',file:gameplay,duration:Number(gameplayProbe.format.duration)};
 }

 let total=0;const turns=[];const speakers=new Set();
 const primaryGpKey=Object.keys(gameplayClips)[0];
 for(const turn of input.turns){
  check(ids.has(turn.speaker),'Unknown turn speaker');speakers.add(turn.speaker);text(turn.text,'turn.text',250);check(positive(turn.durationSeconds)&&Number.isInteger(Math.round(turn.durationSeconds*1000)/40),'Turn duration must be positive in 1/25-second increments');
  const gpKey=turn.gameplay||primaryGpKey;
  check(gameplayClips[gpKey],`Unknown gameplay "${turn.gameplay}"`);
  check(turn.audio?.authorized===true&&typeof turn.audio?.provenance==='string'&&turn.audio.provenance.trim(),'Each turn requires explicit audio authorization and provenance');
  const audio=await media(inputDirectory,turn.audio.file);const audioProbe=probe(audio);check(audioProbe.streams.some(s=>s.codec_type==='audio'),'Every turn needs a supplied audio stream');
  check(Math.abs(Number(audioProbe.format.duration)-turn.durationSeconds)<=0.06,'Audio duration must agree with turn duration within 0.06 seconds');
  check(Array.isArray(turn.captions)&&turn.captions.length>=1&&turn.captions.length<=10,'Each turn needs 1-10 timed caption phrases');let previous=0;
  for(const caption of turn.captions){text(caption.text,'caption.text',38);check(Number.isFinite(caption.start)&&caption.start>=previous&&positive(caption.end)&&caption.end>caption.start&&caption.end<=turn.durationSeconds,'Caption timings must be ordered, non-overlapping, and inside the turn');previous=caption.end;}
  check(words(turn.captions.map(c=>c.text).join(' '))===words(turn.text),'Caption text must cover the supplied turn text');
  turns.push({...turn,gameplayKey:gpKey,audio,start:total});total+=turn.durationSeconds;
 }
 check(speakers.size>=2,'At least two characters must speak');check(total<=60,'Maximum output is 60 seconds');

 const durationsPerClip={};
 for(const turn of turns){
  durationsPerClip[turn.gameplayKey]=(durationsPerClip[turn.gameplayKey]||0)+turn.durationSeconds;
 }
 for(const [key,reqDur] of Object.entries(durationsPerClip)){
  check(gameplayClips[key].duration+0.02>=reqDur,`Supplied gameplay "${key}" is shorter than the conversation; no looping fallback`);
 }

 const segments=[];
 let currentSeg=null;
 const clipOffsets={};
 for(const turn of turns){
  if(!currentSeg||currentSeg.gpKey!==turn.gameplayKey){
   const offset=clipOffsets[turn.gameplayKey]||0;
   currentSeg={gpKey:turn.gameplayKey,startTime:turn.start,duration:turn.durationSeconds,clipOffset:offset};
   segments.push(currentSeg);
  }else{
   currentSeg.duration+=turn.durationSeconds;
  }
  clipOffsets[turn.gameplayKey]=(clipOffsets[turn.gameplayKey]||0)+turn.durationSeconds;
 }

 let music=null;
 if(input.music!==undefined){
  check(input.music?.authorized===true&&typeof input.music.provenance==='string'&&input.music.provenance.trim(),'Music requires explicit authorization and provenance');
  const volume=input.music.volume??0.1;check(positive(volume)&&volume<=0.25,'Music volume must be greater than 0 and at most 0.25');
  const file=await media(inputDirectory,input.music.file);const info=probe(file);check(info.streams.some(s=>s.codec_type==='audio'),'Music needs an audio stream');
  check(Number(info.format.duration)+0.02>=total,'Supplied music is shorter than the conversation; provide a full-length bed');
  check(input.music.attribution===undefined||(typeof input.music.attribution==='string'&&input.music.attribution.trim().length>0&&input.music.attribution.length<=2000),'Music attribution must be nonempty text up to 2000 characters');
  music={file,volume,attribution:input.music.attribution??null};
 }
 if(input.ranking!==undefined){
  check(Array.isArray(input.ranking)&&input.ranking.length>=2&&input.ranking.length<=10,"ranking must have 2-10 items");
  for(const item of input.ranking){
   check(positive(item.rank)&&Number.isInteger(item.rank),"item.rank must be a positive integer");
   text(item.label,"ranking.label",40);
   if(item.image)await media(inputDirectory,item.image);
  }
 }
 return {input,gameplayClips,segments,turns,total,music,gameplay:gameplayClips[primaryGpKey].file};
}

function captionLines(value){const result=[];for(const word of value.split(' ')){const last=result.length-1;if(last>=0&&result[last].length+word.length+1<=19)result[last]+=' '+word;else result.push(word);}check(result.length<=2&&result.every(v=>v.length<=19),'Caption must fit two 19-character lines; split long phrases');return result;}
const xml=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

export async function renderOverlay(input,turn,caption,fx=null){
 const layers=[];
 const label=async(value,top,size,fill,outline=false)=>{
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="256"><text x="24" y="180" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${size}" fill="${fill}"${outline?' stroke="#101010" stroke-width="8" stroke-linejoin="round" paint-order="stroke fill"':''}>${xml(value.toUpperCase())}</text></svg>`;
  const cropped=await sharp(Buffer.from(svg)).trim().png().toBuffer();
  const {data,info}=await sharp(cropped).resize({width:layout.textWidth,withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
  layers.push({input:data,left:Math.floor((W-info.width)/2),top});
 };
 const speaker=turn&&input.cast.find(c=>c.id===turn.speaker);
 await label(input.header.title,52,86,'#ce222a');
 await label(input.header.question,171,58,'#101010');
 const RANK_COLORS=['#ffe282','#e2e8f0','#f97316','#ffffff','#38bdf8','#a855f7'];
 if(Array.isArray(input.ranking)){
  const ladderTop=350;const slotHeight=155;
  for(let idx=0;idx<input.ranking.length;idx++){
   const r=input.ranking[idx];const y=ladderTop+idx*slotHeight;const color=RANK_COLORS[idx%RANK_COLORS.length];
   const pillSvg=`<svg width="100" height="135"><filter id="glow"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/></filter><text x="50" y="96" font-family="Impact, Arial Black, sans-serif" font-weight="900" font-size="78" fill="${color}" stroke="#000000" stroke-width="8" paint-order="stroke fill" text-anchor="middle" filter="url(#glow)">${r.rank}.</text></svg>`;
   layers.push({input:Buffer.from(pillSvg),left:24,top:y});
   const revealed=turn&&turn.revealedRanks&&turn.revealedRanks.includes(r.rank);
   if(revealed&&r.image){
    try{
     const imgBuf=await sharp(path.resolve(repoRoot,r.image)).resize({width:135,height:135,fit:'cover'}).composite([{input:Buffer.from('<svg width="135" height="135"><rect width="131" height="131" x="2" y="2" rx="16" fill="none" stroke="white" stroke-width="4"/><rect width="135" height="135" rx="16" fill="none" stroke="black" stroke-width="2"/></svg>')}]).png().toBuffer();
     layers.push({input:imgBuf,left:135,top:y});
    }catch{}
   }
  }
 }
 if(turn&&turn.featuredCard&&turn.featuredCard.image){
  try{
   const offset=Array.isArray(input.ranking)?90:0;
   const cardImg=await sharp(path.resolve(repoRoot,turn.featuredCard.image)).resize({width:440,height:440,fit:'cover'}).composite([{input:Buffer.from('<svg width="440" height="440"><rect width="432" height="432" x="4" y="4" rx="28" fill="none" stroke="#ffe282" stroke-width="8"/><rect width="440" height="440" rx="28" fill="none" stroke="black" stroke-width="3"/></svg>')}]).png().toBuffer();
   layers.push({input:cardImg,left:Math.floor((W-440)/2)+offset,top:460});
  }catch{}
 }
 const captionColor=speaker?.color||'white';
 if(caption){await label(speaker.name,layout.speakerTop,36,'#ffe282',true);for(const [i,value]of captionLines(caption.text).entries())await label(value,layout.captionTop+i*layout.captionLineHeight,76,captionColor,true);}
 if(fx&&fx.type==='black'){
  const blackCover=Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="black"/></svg>`);
  layers.push({input:blackCover,left:0,top:0});
 }else if(fx&&fx.type==='glitch'){
  const f=fx.frame||0;
  const glitchSvg=`<svg width="${W}" height="${H}">
   <rect x="0" y="${layout.headerHeight + 80 + f*45}" width="${W}" height="28" fill="rgba(255,255,255,0.75)"/>
   <rect x="0" y="${layout.headerHeight + 320 - f*35}" width="${W}" height="42" fill="rgba(56,189,248,0.55)"/>
   <rect x="0" y="${layout.headerHeight + 680 + f*60}" width="${W}" height="24" fill="rgba(239,68,68,0.55)"/>
   <rect x="0" y="${layout.headerHeight + 960 - f*25}" width="${W}" height="35" fill="rgba(255,255,255,0.8)"/>
  </svg>`;
  layers.push({input:Buffer.from(glitchSvg),left:0,top:0});
 }
 const header=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${layout.headerHeight}" fill="white"/></svg>`);
 return sharp(header).composite(layers).ensureAlpha().raw().toBuffer();
}

export async function render(inputFile,outputFile){
 const source=await readFile(inputFile);const prepared=await validate(JSON.parse(source),path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
 const {input,gameplayClips,segments,turns,total,music}=prepared;for(const turn of turns)turn.captions.forEach(c=>captionLines(c.text));
 check(outputFile.endsWith('.mp4'),'Output must be .mp4');check(!await lstat(outputFile).catch(()=>null),'Output exists; use a new path');
 await mkdir(path.dirname(path.resolve(outputFile)),{recursive:true});

 const gameplayKeys=Object.keys(gameplayClips);
 const args=['-v','error','-n','-threads','1'];
 for(const key of gameplayKeys){
  args.push('-protocol_whitelist','file,pipe','-i',gameplayClips[key].file);
 }
 for(const turn of turns){
  args.push('-protocol_whitelist','file,pipe','-i',turn.audio);
 }

 let sfxFile=null;
 try{
  const testSfx=path.resolve(repoRoot,'assets/sfx/glitch-whoosh.wav');
  const info=await lstat(testSfx);
  if(info.isFile())sfxFile=testSfx;
 }catch{}

 const sfxIndex = sfxFile ? gameplayKeys.length + turns.length : null;
 if(sfxFile) args.push('-protocol_whitelist','file,pipe','-i',sfxFile);

 const musicIndex = (sfxIndex !== null ? sfxIndex + 1 : gameplayKeys.length + turns.length);
 if(music) args.push('-protocol_whitelist','file,pipe','-i',music.file);

 const overlayIndex = (music ? musicIndex + 1 : (sfxIndex !== null ? sfxIndex + 1 : gameplayKeys.length + turns.length));
 args.push('-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-protocol_whitelist','file,pipe','-i','pipe:0');

 const gameplayHeight=H-layout.headerHeight;
 const filters=[];

 if(gameplayKeys.length===1&&segments.length===1){
  filters.push(`[0:v]scale=${W}:${gameplayHeight}:force_original_aspect_ratio=increase,crop=${W}:${gameplayHeight},pad=${W}:${H}:0:${layout.headerHeight}:color=black,setsar=1,fps=${FPS}[base]`);
 }else{
  for(const [idx,seg] of segments.entries()){
   const clipIdx=gameplayKeys.indexOf(seg.gpKey);
   filters.push(`[${clipIdx}:v]trim=start=${seg.clipOffset}:duration=${seg.duration},setpts=PTS-STARTPTS,scale=${W}:${gameplayHeight}:force_original_aspect_ratio=increase,crop=${W}:${gameplayHeight},setsar=1,fps=${FPS}[seg${idx}v]`);
  }
  filters.push(`${segments.map((_,i)=>`[seg${i}v]`).join('')}concat=n=${segments.length}:v=1:a=0,pad=${W}:${H}:0:${layout.headerHeight}:color=black[base]`);
 }
 filters.push(`[base][${overlayIndex}:v]overlay=0:0:shortest=1[video]`);

 const audioInputOffset=gameplayKeys.length;
 for(const [i,turn] of turns.entries()){
  filters.push(`[${audioInputOffset+i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,apad,atrim=duration=${turn.durationSeconds},asetpts=PTS-STARTPTS[a${i}]`);
 }
 filters.push(`${turns.map((_,i)=>`[a${i}]`).join('')}concat=n=${turns.length}:v=0:a=1[dialogueRaw]`);

 const transitions = segments.slice(1).map(s => s.startTime);
 const sfxTimes = [0, ...transitions];

 if(sfxIndex !== null){
  for(const [i,tSfx] of sfxTimes.entries()){
   const delayMs = Math.round(tSfx * 1000);
   filters.push(`[${sfxIndex}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,atrim=0:0.25,asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs}[sfx${i}]`);
  }
  filters.push(`${sfxTimes.map((_,i)=>`[sfx${i}]`).join('')}amix=inputs=${sfxTimes.length}:normalize=0[allSfx]`);
  filters.push(`[dialogueRaw][allSfx]amix=inputs=2:normalize=0[dialogue]`);
 }else{
  filters.push(`[dialogueRaw]acopy[dialogue]`);
 }

 if(music){
  const fadeIn=Math.min(0.35,total/2),fadeOut=Math.min(0.7,total/2);
  filters.push(`[dialogue]asplit=2[voice][ducking]`);
  filters.push(`[${musicIndex}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,atrim=duration=${total},asetpts=PTS-STARTPTS,volume=${music.volume},afade=t=in:d=${fadeIn},afade=t=out:st=${total-fadeOut}:d=${fadeOut}[bed]`);
  filters.push('[bed][ducking]sidechaincompress=threshold=0.035:ratio=6:attack=15:release=250[quietbed]');
  filters.push('[voice][quietbed]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=false:latency=true[audio]');
 }else{
  filters.push(`[dialogue]alimiter=limit=0.95:level=false:latency=true[audio]`);
 }

 if(music?.attribution)args.push('-metadata',`comment=${music.attribution}`);
 args.push('-filter_complex_threads','1','-filter_complex',filters.join(';'),'-map','[video]','-map','[audio]','-t',String(total),'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-threads','1','-c:a','aac','-b:a','128k','-movflags','+faststart',outputFile);

 const base=await renderOverlay(input);
 const child=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});let errors='',timedOut=false;child.stderr.on('data',b=>{errors=(errors+b).slice(-16000);});child.stdin.on('error',()=>{});
 const timeout=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},180000);
 const exited=new Promise((resolve,reject)=>{child.on('error',error=>{clearTimeout(timeout);reject(error);});child.on('close',code=>{clearTimeout(timeout);code===0?resolve():reject(new Error(`FFmpeg ${timedOut?'timed out':'failed'} (${code}): ${errors}`));});});exited.catch(()=>{});

 let cachedKey='',frame=base;
 try { for(let n=0;n<Math.round(total*FPS);n++){
  const t=n/FPS;const turn=turns.find(turn=>t>=turn.start&&t<turn.start+turn.durationSeconds);const caption=turn?.captions.find(c=>t-turn.start>=c.start&&t-turn.start<c.end);
  let fx=null;
  if(n===0){
   fx={type:'black'};
  }else if(n>=1&&n<=3){
   fx={type:'glitch',frame:n};
  }else{
   const tr=transitions.find(tr=>t>=tr&&t<tr+0.16);
   if(tr){
    const f=Math.round((t-tr)*FPS);
    fx={type:'glitch',frame:f};
   }
  }
  const key = `${turn?.start ?? ''}:${caption?.start ?? ''}:${turn?.revealedRanks?.join(',') ?? ''}:${turn?.featuredCard?.image ?? ''}:${fx?.type ?? ''}:${fx?.frame ?? ''}`;
  if(key!==cachedKey){cachedKey=key;frame=await renderOverlay(input,turn,caption,fx);}
  if(child.stdin.destroyed)break;if(!child.stdin.write(frame))await Promise.race([once(child.stdin,'drain'),exited]);
 }
 child.stdin.end();await exited; } finally {clearTimeout(timeout);if(child.exitCode===null)child.kill('SIGKILL');}

 const receipt={schemaVersion:1,argv:['node',path.relative(process.cwd(),fileURLToPath(import.meta.url)),path.relative(process.cwd(),inputFile),path.relative(process.cwd(),outputFile)],inputSha256:digest(source),runtimeSha256:digest(await readFile(fileURLToPath(import.meta.url))),outputSha256:digest(await readFile(outputFile)),durationSeconds:total,width:W,height:H,fps:FPS,gameplaySha256:await Promise.all(gameplayKeys.map(async k=>digest(await readFile(gameplayClips[k].file)))),audioSha256:await Promise.all(turns.map(async t=>digest(await readFile(t.audio)))),review:'Supplied-media composition completed. No direct moving-video or audio perception; voice identity, reference fidelity and creative approval remain unverified.'};
 if(music)receipt.music={sha256:digest(await readFile(music.file)),volume:music.volume,duckedUnderDialogue:true,fadeInSeconds:Math.min(0.35,total/2),fadeOutSeconds:Math.min(0.7,total/2),attribution:music.attribution};
 await writeFile(`${outputFile}.receipt.json`,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args[0]==='--validate'){
  const input=args[1];
  if(!input){console.error('Usage: node runtime/render.mjs --validate INPUT.json');process.exitCode=1;}
  else {
   try {
    const source=await readFile(path.resolve(input),'utf8');
    const prepared=await validate(JSON.parse(source),repoRoot);
    console.log(JSON.stringify({valid:true,durationSeconds:prepared.total,turnsCount:prepared.turns.length,hasRanking:Array.isArray(prepared.input.ranking),rankingCount:prepared.input.ranking?.length??0,segmentsCount:prepared.segments?.length??1},null,2));
   } catch(err){console.error(JSON.stringify({valid:false,error:err.message},null,2));process.exitCode=1;}
  }
 } else {
  const [input,output]=args;if(!input||!output){console.error('Usage: node runtime/render.mjs INPUT.json NEW-OUTPUT.mp4');process.exitCode=1;}else await render(path.resolve(input),path.resolve(output)).then(value=>console.log(JSON.stringify(value,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;});
 }
}
