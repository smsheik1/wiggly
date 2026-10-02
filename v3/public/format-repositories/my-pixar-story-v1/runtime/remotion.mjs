import {cp, mkdir, copyFile, writeFile, readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {createReadStream,readFileSync} from 'node:fs';
import {stat} from 'node:fs/promises';
import {selectComposition, renderMedia} from '@remotion/renderer';
import {digest} from './contracts.mjs';
import {verifyFiles} from './media.mjs';
import {audioMixArgs} from './mix.mjs';
const exec=promisify(execFile),kit=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function compositionScene(manifest,sources,audioUrl){
 let startFrame=0;
 const clips=manifest.clips.map((c,i)=>{const clip={id:c.id,src:sources[i],startFrame,durationFrames:Math.round(c.durationSeconds*30),sourceOffsetSeconds:manifest.edit.clips[i].sourceOffsetSeconds};startFrame+=clip.durationFrames;return clip;});
 if(startFrame!==1800)throw new Error('Composition must cover exactly 60 seconds.');
 return {version:1,format:'memoir-film',brand:{name:'Family memories',url:'',host:'',title:'',description:'',faviconUrl:null,logoUrl:null,ogImageUrl:null,screenshotUrl:null,colors:[],fonts:{feel:'sans'},vibeTags:[],receipts:{specificClaims:[],buyerMoments:[],exactSiteLanguage:[],namedProof:[]}},creative:{angleId:'memoir',headline:'',subheadline:'',ctaText:'',headlineType:'transformation',selectedPain:'',selectedProof:''},style:{backgroundColor:'#000000',textColor:'#ffffff',accentColor:'#ffffff',fontFeel:'sans'},audio:{status:'generated',storageId:digest(manifest),url:audioUrl,mimeType:'audio/wav',durationMs:60000,durationSeconds:60,transcript:'',captions:[],provider:'upload',model:'approved-mix',generatedAt:0},layout:{preset:'memoir-film',durationMs:60000,fps:30,manifestDigest:digest(manifest),clips},metadata:{candidateIndex:0,generationBatchId:manifest.projectId??'isolated',researchRunId:'',brandSnapshotId:'',model:'approved-edit',provider:'deterministic',generatedAt:0}};
}
export const rendererIdentity=()=>JSON.parse(readFileSync(join(kit,'build','remotion','renderer-manifest.json'),'utf8'));
export async function verifyRenderer(){
 const root=join(kit,'build','remotion'),manifest=JSON.parse(await readFile(join(root,'renderer-manifest.json'),'utf8'));
 if(manifest.remotionVersion!=='4.0.473'||!['bundle.js','preview.js','index.html'].every(name=>manifest.files?.some(f=>f.path===name)))throw new Error('Incomplete or incompatible official renderer inventory.');
 for(const file of manifest.files){if(!file.path||file.path.includes('..')||file.path.startsWith('/'))throw new Error('Invalid renderer inventory.');const {createHash}=await import('node:crypto');if(createHash('sha256').update(await readFile(join(root,file.path))).digest('hex')!==file.sha256)throw new Error('Packaged renderer changed; rebuild/reinstall the official package.');}
 return {root,manifest};
}
export async function prepareComposition(manifest,dir){
 await verifyFiles(manifest);const renderer=await verifyRenderer();const bundle=join(dir,'composition');await cp(renderer.root,bundle,{recursive:true});const assets=join(bundle,'public','memoir');await mkdir(assets,{recursive:true});
 const sources=[];for(const [i,c]of manifest.clips.entries()){const name=`clip-${i}.mp4`;await copyFile(c.file.path,join(assets,name));sources.push(`/memoir/${name}`);}
 const mix=join(assets,'mix.wav');await exec('ffmpeg',audioMixArgs(manifest,mix),{maxBuffer:8*1024*1024});
 const scene=compositionScene(manifest,sources,'/memoir/mix.wav');await writeFile(join(bundle,'scene.json'),JSON.stringify(scene,null,2),{mode:0o600});
 await writeFile(join(bundle,'preview.html'),'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Memoir composition preview</title></head><body style="margin:0;background:#111;color:white;font-family:system-ui"><main style="max-width:1100px;margin:24px auto;padding:16px"><h1>Memoir composition preview</h1><p>Approved edit · 60 seconds · 16:9. Preview does not approve or generate media.</p><div id="preview"></div></main><script src="./preview.js"></script></body></html>');
 return {bundle,scene,rendererDigest:digest(renderer.manifest)};
}
export async function renderComposition(prepared,out,onProgress=()=>{},frameRange){
 const inputProps={scene:prepared.scene},browserExecutable=process.env.MEMOIR_BROWSER_EXECUTABLE||undefined;
 const composition=await selectComposition({serveUrl:prepared.bundle,id:'AdSceneMp4',inputProps,browserExecutable});
 if(composition.width!==1920||composition.height!==1080||composition.fps!==30||composition.durationInFrames!==1800)throw new Error('Official memoir composition metadata mismatch.');
 await renderMedia({serveUrl:prepared.bundle,composition,inputProps,browserExecutable,outputLocation:out,codec:'h264',audioCodec:'aac',audioBitrate:'192k',crf:18,concurrency:2,onProgress:p=>onProgress(p.progress),...(frameRange?{frameRange}: {})});
}
export async function servePreview(prepared){
 const root=resolve(prepared.bundle),types={html:'text/html',js:'text/javascript',json:'application/json',mp4:'video/mp4',wav:'audio/wav',css:'text/css'};
 const server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),path=resolve(root,'.'+(pathname==='/'?'/preview.html':pathname.startsWith('/memoir/')?'/public'+pathname:pathname));
  if(!path.startsWith(root+'/')){res.writeHead(403).end();return;}
  const info=await stat(path);if(!info.isFile()){res.writeHead(404).end();return;}
  const headers={'Content-Type':types[path.split('.').at(-1)]??'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  let start=0,end=info.size-1;if(req.headers.range){if(!range){res.writeHead(416).end();return;}start=Number(range[1]);end=range[2]?Number(range[2]):end;if(start>end||end>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
  res.writeHead(range?206:200,{...headers,'Content-Length':end-start+1});if(req.method==='HEAD'){res.end();return;}createReadStream(path,{start,end}).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404).end();}});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});return{server,url:`http://127.0.0.1:${server.address().port}/preview.html`};
}
