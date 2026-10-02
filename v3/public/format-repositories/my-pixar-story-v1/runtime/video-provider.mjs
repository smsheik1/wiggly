import { readFile, writeFile, rename } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { importMedia } from './media.mjs';
async function save(path,value){const tmp=`${path}.tmp`;await writeFile(tmp,JSON.stringify(value,null,2),{mode:0o600});await rename(tmp,path);}
async function read(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function executeVideo(job,dir,key,fetcher,collectOnly,onJobId){
 const saved=await read(join(dir,'prediction.json'));let prediction=saved;
 if(saved){if(!/^[a-z0-9-]+$/i.test(saved.id??''))throw new Error('Invalid saved prediction ID.');await onJobId?.(saved.id);}
 if(!prediction){
  if(collectOnly)throw new Error('UNCERTAIN_SUBREQUEST: no recorded prediction; collection never resubmits.');
  try{await writeFile(join(dir,'video.started'),JSON.stringify({digest:job.digest}),{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')throw new Error('UNCERTAIN_SUBREQUEST: reconcile the existing video request.');throw e;}
  const bytes=await readFile(job.request.frame.path);const image=`data:image/${extname(job.request.frame.path).slice(1)};base64,${bytes.toString('base64')}`;
  const response=await fetcher(job.request.endpoint,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({input:{...job.request.input,image}}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}: ${(await response.text()).replaceAll(key,'[redacted]').slice(0,800)}`);
  prediction=await response.json();if(!/^[a-z0-9-]+$/i.test(prediction.id??''))throw new Error('Video provider response lacks a valid prediction ID.');
  await save(join(dir,'prediction.json'),prediction);await onJobId?.(prediction.id);
 }else if(!['succeeded','failed','canceled'].includes(prediction.status)){
  const response=await fetcher(`https://api.replicate.com/v1/predictions/${prediction.id}`,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}: ${(await response.text()).replaceAll(key,'[redacted]').slice(0,800)}`);
  const polled=await response.json();if(polled.id!==prediction.id)throw new Error('Prediction ID mismatch.');prediction=polled;await save(join(dir,'prediction.json'),prediction);
 }
 if(['failed','canceled'].includes(prediction.status))throw new Error(`Video prediction ${prediction.id} ${prediction.status}: ${String(prediction.error??'provider cancellation').replaceAll(key,'[redacted]').slice(0,800)}`);
 if(prediction.status!=='succeeded')return {pending:true,providerJobId:prediction.id,status:prediction.status};
 const url=Array.isArray(prediction.output)?prediction.output[0]:prediction.output;const host=new URL(url).hostname;
 if(new URL(url).protocol!=='https:'||!(host==='replicate.delivery'||host.endsWith('.replicate.delivery')))throw new Error('Unexpected video output host; no credential forwarding.');
 const response=await fetcher(url,{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Video download HTTP ${response.status}`);
 const path=join(dir,'output.mp4');await writeFile(path,Buffer.from(await response.arrayBuffer()),{mode:0o600});
 return {files:[await importMedia(path,job.request.runDir)],prompt:job.request.input.prompt,keyframeSha256:job.request.frame.sha256,providerJobId:prediction.id};
}
