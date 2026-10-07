import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {importMedia} from '../runtime/media.mjs';
import {createCartesiaTranscriptionTool,CARTESIA_STT_PROFILE} from '../runtime/cartesia-stt.mjs';
import {crewTools} from '../runtime/crew.mjs';

async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'memoir-stt-isolated-')),secretsPath=join(dir,'secrets.env'),path=join(dir,'source.wav');
 await writeFile(secretsPath,'CARTESIA_API_KEY=ISOLATED_STT_SECRET\n');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=0.2','-c:a','pcm_s16le',path]);
 const file=await importMedia(path,dir),worker={workerId:'isolated-ava',name:'Ava',role:'audio-reviewer'};
 const task={taskId:'isolated-transcription',step:'narration',artifact:{content:{files:[file]}},voiceReference:{content:{language:'en',files:[file]}},dependencies:[{content:{beats:[{narration:'LOCKED_SCRIPT_MUST_NOT_HINT_ASR'}]}}]};
 const response={type:'transcript',text:'ISOLATED decoded words',language:'en',duration:file.durationSeconds,request_id:'isolated-request',words:[{word:'ISOLATED',start:0,end:0.1}]};
 return {dir,secretsPath,file,worker,task,response,options:{secretsPath,receiptDirectory:join(dir,'receipts'),maxCalls:1}};
}

test('independent STT sends exact audio without the script, retains provider evidence and recovers without another paid call',async()=>{
 const f=await fixture();let calls=0;
 try{
  const tools=createCartesiaTranscriptionTool({...f.options,fetcher:async(url,options)=>{
   calls++;assert.equal(url,'https://api.cartesia.ai/stt');assert.equal(options.redirect,'error');assert.equal(options.headers['Cartesia-Version'],'2026-08-14');assert.equal(options.headers.Authorization,'Bearer ISOLATED_STT_SECRET');
   assert.deepEqual([...options.body.keys()],['file','model','language','timestamp_granularities[]']);assert.equal(options.body.get('model'),CARTESIA_STT_PROFILE.model);assert.equal(options.body.get('language'),'en');assert.deepEqual(Buffer.from(await options.body.get('file').arrayBuffer()),await readFile(f.file.path));
   return Response.json(f.response);
  }}),receipts=[];
  const result=await crewTools(f.task,f.worker,tools,r=>receipts.push(r))('transcribe',{sha256:f.file.sha256});
  assert.equal(result.transcript,f.response.text);assert.equal(receipts[0].provider,'cartesia');assert.equal(receipts[0].modelVersion,'ink-whisper');assert.equal(receipts[0].requestDigest,result.requestDigest);
  const offline=createCartesiaTranscriptionTool({...f.options,maxCalls:0,fetcher:async()=>{throw new Error('No second call');}});
  assert.deepEqual(await offline.transcribe(f),result);await rm(join(result.receiptPath,'result.json'));assert.deepEqual(await offline.transcribe(f),result);assert.equal(calls,1);
  const path=join(result.receiptPath,'response.json'),saved=JSON.parse(await readFile(path,'utf8'));saved.response.text='tampered';await writeFile(path,JSON.stringify(saved));await rm(join(result.receiptPath,'result.json'));await assert.rejects(offline.transcribe(f),/RECEIPT_CHANGED/);
 }finally{await rm(f.dir,{recursive:true});}
});

test('STT rejects wrong worker, out-of-scope files, language and missing allowance before network',async()=>{
 const f=await fixture();let calls=0;
 try{
  const tools=createCartesiaTranscriptionTool({...f.options,maxCalls:0,fetcher:async()=>{calls++;return Response.json(f.response);}});
  await assert.rejects(tools.transcribe({...f,worker:{...f.worker,role:'script-writer'}}),/SCOPE_DENIED/);
  await assert.rejects(tools.transcribe({...f,task:{...f.task,voiceReference:null}}),/LANGUAGE_REQUIRED/);
  await assert.rejects(crewTools(f.task,f.worker,tools)('transcribe',{sha256:'0'.repeat(64)}),/SCOPE_DENIED/);
  await assert.rejects(tools.transcribe(f),/BUDGET_REQUIRED/);assert.equal(calls,0);
 }finally{await rm(f.dir,{recursive:true});}
});

test('STT provider failures redact credentials and stop without fallback or retry',async()=>{
 const f=await fixture();let calls=0;
 try{
  const tools=createCartesiaTranscriptionTool({...f.options,fetcher:async()=>{calls++;return new Response('ISOLATED_STT_SECRET denied',{status:401});}});
  await assert.rejects(tools.transcribe(f),e=>{assert.equal(e.stopDispatch,true);assert.match(e.message,/HTTP 401/);assert.match(e.message,/batch speech-to-text/);assert.ok(!e.message.includes('ISOLATED_STT_SECRET'));return true;});
  await assert.rejects(createCartesiaTranscriptionTool({...f.options,fetcher:async()=>{calls++;throw new Error('Never retry');}}).transcribe(f),/REQUEST_UNCERTAIN/);assert.equal(calls,1);
 }finally{await rm(f.dir,{recursive:true});}
});

test('invalid transcript responses never become measured approval evidence',async()=>{
 for(const change of [{text:''},{language:'es'},{duration:9},{words:[{word:'bad',start:0.15,end:0.1}]}]){
  const f=await fixture();let calls=0;
  try{const tools=createCartesiaTranscriptionTool({...f.options,fetcher:async()=>{calls++;return Response.json({...f.response,...change});}});await assert.rejects(tools.transcribe(f),e=>e.stopDispatch===true);await assert.rejects(tools.transcribe(f));assert.equal(calls,1);}finally{await rm(f.dir,{recursive:true});}
 }
});

test('parallel transcriptions cannot exceed a cap and completed results are bound to task and language',async()=>{
 const f=await fixture();let calls=0;
 try{const tools=createCartesiaTranscriptionTool({...f.options,fetcher:async()=>{calls++;return Response.json(f.response);}});
  const results=await Promise.allSettled([tools.transcribe(f),tools.transcribe({...f,task:{...f.task,taskId:'another-task'}})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/BUDGET_REQUIRED/);assert.equal(calls,1);
  await assert.rejects(createCartesiaTranscriptionTool({...f.options,maxCalls:0}).transcribe({...f,task:{...f.task,voiceReference:{content:{language:'es'}}}}),/BUDGET_REQUIRED/);
 }finally{await rm(f.dir,{recursive:true});}
});

test('identical concurrent STT requests share a result without consuming the next legitimate allowance',async()=>{
 const f=await fixture();let calls=0;
 try{const tools=createCartesiaTranscriptionTool({...f.options,maxCalls:2,fetcher:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,20));return Response.json(f.response);}});
  const [first,duplicate]=await Promise.all([tools.transcribe(f),tools.transcribe(f)]);assert.deepEqual(first,duplicate);assert.equal(calls,1);
  await tools.transcribe({...f,task:{...f.task,taskId:'next-legitimate-task'}});assert.equal(calls,2);
 }finally{await rm(f.dir,{recursive:true});}
});

test('project reservation blocks network first and completed cache consumes no additional reservation',async()=>{
 const f=await fixture();let calls=0,reserved=0;
 try{
  const denied=createCartesiaTranscriptionTool({...f.options,beforeRequest:async()=>{throw new Error('PROJECT_BUDGET_EXCEEDED');},fetcher:async()=>{calls++;throw new Error('Must not fetch');}});
  await assert.rejects(denied.transcribe(f),/PROJECT_BUDGET_EXCEEDED/);assert.equal(calls,0);
  const tools=createCartesiaTranscriptionTool({...f.options,beforeRequest:async({requestDigest,task})=>{reserved++;assert.ok(requestDigest);assert.equal(task.taskId,f.task.taskId);},fetcher:async()=>{calls++;return Response.json(f.response);}});
  await tools.transcribe(f);await tools.transcribe(f);assert.equal(reserved,1);assert.equal(calls,1);
 }finally{await rm(f.dir,{recursive:true});}
});
