import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {z} from 'zod';
import {digest} from './contracts.mjs';
import {verifyFiles,sha} from './media.mjs';
import {loadKey,remediation,atomicJson} from './providers.mjs';

export const CARTESIA_STT_PROFILE={model:'ink-whisper',api:'POST /stt',version:'2026-08-14',language:'canonical voice basis language',timestamps:'word',scriptHint:false};
const ResponseSchema=z.object({type:z.literal('transcript'),text:z.string().trim().min(1),request_id:z.string().min(1).optional(),language:z.string().optional(),duration:z.number().positive().optional(),words:z.array(z.object({word:z.string(),start:z.number().nonnegative(),end:z.number().nonnegative()})).optional()});
const mime={'.wav':'audio/wav','.mp3':'audio/mpeg','.m4a':'audio/mp4','.flac':'audio/flac','.ogg':'audio/ogg'};
async function readJson(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}

// Independent ASR: send only audio and its declared language, never the script.
export function createCartesiaTranscriptionTool({secretsPath,receiptDirectory,maxCalls=0,beforeRequest,fetcher=fetch}={}){
 if(!secretsPath||!receiptDirectory)throw new Error('Cartesia transcription needs canonical secrets and durable receipts.');
 if(!Number.isInteger(maxCalls)||maxCalls<0||maxCalls>32)throw new Error('Use a bounded --transcription-calls between 0 and 32.');
 let submitted=0;const inFlight=new Map();
 return {transcribe:async({file,worker,task})=>{
  const language=task?.voiceBasis?.language??task?.voiceReference?.content.language;
  const editor=worker?.role==='film-editor'&&task?.step==='narration'&&task.gate==='author'&&task.artifact?.review?.decision==='rejected'&&!task.artifact.approvedBy;
  if(!task?.taskId||!(worker?.role==='audio-reviewer'||editor)||!worker.workerId)throw new Error('STT_SCOPE_DENIED: transcription requires a current audio-reviewer task or rejected-narration editor task.');
  if(!/^[a-z]{2,3}$/.test(language??''))throw new Error('STT_LANGUAGE_REQUIRED: use the canonical voice basis ISO language.');
  const mimeType=mime[extname(file.path).toLowerCase()];
  if(!mimeType||file.width||!file.durationSeconds)throw new Error('Cartesia transcription requires a measured audio-only file.');
  await verifyFiles(file);
  const descriptor={tool:'transcribe',profile:CARTESIA_STT_PROFILE,taskId:task.taskId,workerId:worker.workerId,sha256:file.sha256,seconds:file.durationSeconds,language};
  const requestDigest=digest(descriptor),dir=join(receiptDirectory,requestDigest);await mkdir(dir,{recursive:true});
  if(inFlight.has(requestDigest))return inFlight.get(requestDigest);
  const run=async()=>{
  const finish=async raw=>{
   const response=ResponseSchema.parse(raw);
   if(response.language&&response.language!==language||response.duration&&Math.abs(response.duration-file.durationSeconds)>.1||response.words?.some(w=>w.end<w.start||w.end>file.durationSeconds+.1))throw new Error('STT_RESPONSE_MISMATCH: language, duration or word timestamps differ from actual audio.');
   const result={transcript:response.text,method:'Cartesia Ink-Whisper batch ASR; no script hint',provider:'cartesia',modelVersion:CARTESIA_STT_PROFILE.model,requestDigest,receiptPath:dir,providerRequestId:response.request_id??null,seconds:file.durationSeconds,language,words:response.words??[]};
   await atomicJson(join(dir,'result.json'),{requestDigest,resultDigest:digest(result),result});return result;
  };
  const cached=await readJson(join(dir,'result.json'));
  if(cached){if(cached.requestDigest!==requestDigest||cached.resultDigest!==digest(cached.result))throw new Error('STT_RECEIPT_CHANGED');return cached.result;}
  const started=await readJson(join(dir,'started.json')),finished=await readJson(join(dir,'response.json'));
  if(finished){if(!started||digest(started)!==requestDigest||finished.requestDigest!==requestDigest||finished.responseDigest!==digest(finished.response))throw new Error('STT_RECEIPT_CHANGED');return finish(finished.response);}
  if(started)throw new Error(`STT_REQUEST_UNCERTAIN: inspect ${dir}; no automatic resubmission.`);
  if(submitted>=maxCalls)throw new Error('STT_BUDGET_REQUIRED: supply explicit bounded --transcription-calls; no request submitted.');
  submitted++; // Reserve synchronously before reading credentials/audio.
  await beforeRequest?.({provider:'cartesia-stt',requestDigest,task});
  let key;
  try{
   key=await loadKey('cartesia',secretsPath);
   const bytes=await readFile(file.path);if(sha(bytes)!==file.sha256)throw new Error('ASSET_CHANGED during STT read.');
   const form=new FormData();form.append('file',new Blob([bytes],{type:mimeType}),'narration'+extname(file.path));form.append('model',CARTESIA_STT_PROFILE.model);form.append('language',language);form.append('timestamp_granularities[]','word');
   await writeFile(join(dir,'started.json'),JSON.stringify(descriptor)+'\n',{flag:'wx',mode:0o600});
   const response=await fetcher('https://api.cartesia.ai/stt',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Cartesia-Version':CARTESIA_STT_PROFILE.version},body:form,redirect:'error',signal:AbortSignal.timeout(180000)});
   if(!response.ok)throw new Error(`Cartesia STT HTTP ${response.status}: ${(await response.text()).replaceAll(key,'[redacted]').slice(0,600)}`);
   const raw=await response.json();await atomicJson(join(dir,'response.json'),{requestDigest,responseDigest:digest(raw),response:raw});
   return await finish(raw);
  }catch(error){const message=error.code==='EEXIST'?`STT_REQUEST_UNCERTAIN: inspect ${dir}; another process owns this request; no duplicate submitted.`:key?error.message.replaceAll(key,'[redacted]'):error.message;throw Object.assign(new Error(`${message}\n${remediation('cartesia',secretsPath).replace('voice cloning and Sonic TTS','batch speech-to-text (Ink-Whisper)')}\nInspect ${dir} before any further transcription.`),{stopDispatch:true});}
  };
  const pending=run();inFlight.set(requestDigest,pending);
  try{return await pending;}finally{inFlight.delete(requestDigest);}
 }};
}
