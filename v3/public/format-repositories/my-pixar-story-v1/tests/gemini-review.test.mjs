import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {importMedia} from '../runtime/media.mjs';
import {createGeminiReviewTools,GEMINI_REVIEW_MODEL,GEMINI_REVIEW_PROFILE} from '../runtime/gemini-review.mjs';
import {crewTools} from '../runtime/crew.mjs';
import {checkProvider} from '../runtime/providers.mjs';
import {digest} from '../runtime/contracts.mjs';

async function fixture(video=false,long=false){
 const dir=await mkdtemp(join(tmpdir(),'memoir-gemini-isolated-')),secretsPath=join(dir,'secrets.env'),path=join(dir,video?'source.mp4':'source.wav');
 await writeFile(secretsPath,'GEMINI_API_KEY=ISOLATED_SECRET\n');
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',video?'color=c=blue:s=160x90:r=30:d=0.2':`sine=frequency=440:sample_rate=48000:duration=${long?92:0.2}`,...(video?['-c:v','libx264','-pix_fmt','yuv420p']:['-c:a','pcm_s16le']),path]);
 const file=await importMedia(path,dir),worker={workerId:'isolated-ava',name:video?'Vera':'Ava',role:video?'visual-reviewer':'audio-reviewer'};
 const task={taskId:'isolated-task',step:video?'video':'music',artifact:{content:{files:[file]}},criteria:['ISOLATED actual perceptual coverage']};
 const report={perceptible:true,fullMediaInspected:true,summary:'ISOLATED protocol result, not quality qualification',observations:[],limitations:['ISOLATED synthetic fixture']};
 const response=()=>new Response(JSON.stringify({id:'isolated-interaction',model:GEMINI_REVIEW_MODEL,status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(report)}]}]}));
 return {dir,secretsPath,file,worker,task,report,response,options:{secretsPath,receiptDirectory:join(dir,'receipts'),maxCalls:1}};
}

test('Gemini listens to exact media bytes, binds receipts and reuses a finished request without paying again',async()=>{
 const f=await fixture();let calls=0,body;
 try{
  const tools=createGeminiReviewTools({...f.options,fetcher:async(url,options)=>{calls++;assert.match(url,/v1beta\/interactions$/);assert.equal(options.headers['x-goog-api-key'],'ISOLATED_SECRET');assert.equal(options.redirect,'error');body=JSON.parse(options.body);return f.response();}});
  const value=await tools.listenAudio(f);assert.equal(body.model,'gemini-3.8-flash');assert.equal(body.store,false);assert.equal(body.generation_config.thinking_level,'high');assert.equal(body.input[0].type,'audio');assert.deepEqual(Buffer.from(body.input[0].data,'base64'),await readFile(f.file.path));assert.equal(value.perception,'direct-audio');assert.equal(value.seconds,f.file.durationSeconds);assert.equal(value.modelVersion,GEMINI_REVIEW_PROFILE.model);assert.match(body.input.at(-1).text,/measured by ffprobe; do not estimate/);assert.ok(body.response_format.schema.required.includes('fullMediaInspected'));assert.equal(body.response_format.schema.properties.coverageEndSeconds,undefined);
  assert.deepEqual(await tools.listenAudio(f),value);assert.equal(calls,1);
  const noSpend=createGeminiReviewTools({...f.options,maxCalls:0,fetcher:async()=>{throw new Error('Must not call network');}});assert.deepEqual(await noSpend.listenAudio(f),value);
  const saved=JSON.parse(await readFile(join(value.receiptPath,'result.json'),'utf8'));saved.result.seconds=999;await writeFile(join(value.receiptPath,'result.json'),JSON.stringify(saved));await assert.rejects(tools.listenAudio(f),/RECEIPT_CHANGED/);
 }finally{await rm(f.dir,{recursive:true});}
});

test('Gemini video uses the approved 4 FPS profile with scoped references and permissions',async()=>{
 const f=await fixture(true);let body,calls=0;
 try{
  const imagePath=join(f.dir,'ref.png');execFileSync('ffmpeg',['-v','error','-i',f.file.path,'-frames:v','1',imagePath]);const ref=await importMedia(imagePath,f.dir);f.task.references=[{file:ref}];f.task.dependencies=[{id:'script@1',content:{beats:[{narration:'ISOLATED locked memory'}]}}];
  const tools=createGeminiReviewTools({...f.options,fetcher:async(_url,options)=>{calls++;body=JSON.parse(options.body);return f.response();}}),receipt=[];
  const scoped=crewTools(f.task,f.worker,tools,r=>receipt.push(r));const result=await scoped('watchVideo',{sha256:f.file.sha256});
  assert.equal(body.input.find(p=>p.type==='video').processing.fps,4);assert.equal(body.input.find(p=>p.type==='video').resolution,'high');assert.ok(body.input.some(p=>p.type==='image'));assert.match(body.input.at(-1).text,/ISOLATED locked memory/);assert.equal(result.samplingFps,4);assert.equal(result.sourceFps,30);assert.equal(receipt[0].modelVersion,'gemini-3.8-flash');
  await assert.rejects(scoped('watchVideo',{sha256:'0'.repeat(64)}),/SCOPE_DENIED/);
  await assert.rejects(crewTools(f.task,{...f.worker,role:'script-writer'},tools)('watchVideo',{sha256:f.file.sha256}),/PERMISSION_DENIED/);assert.equal(calls,1);
 }finally{await rm(f.dir,{recursive:true});}
});

test('missing allowance, incomplete coverage and provider failures never fake hearing, retry or fall back',async()=>{
 for(const mode of ['budget','http','partial','model']){
  const f=await fixture();let calls=0;
  try{
   const tools=createGeminiReviewTools({...f.options,maxCalls:mode==='budget'?0:1,fetcher:async()=>{calls++;if(mode==='http')return new Response('ISOLATED_SECRET bad credentials',{status:401});if(mode==='partial')f.report.fullMediaInspected=false;if(mode==='model')return new Response(JSON.stringify({model:'other-model',status:'completed',id:'isolated'}));return f.response();}});
   await assert.rejects(tools.listenAudio(f),e=>{assert.ok(!e.message.includes('ISOLATED_SECRET'));if(mode!=='budget'){assert.equal(e.stopDispatch,true);assert.match(e.message,/STOP: Gemini/);if(mode==='partial')assert.ok(!e.message.includes('Usage/Billing'));}return true;});
   assert.equal(calls,mode==='budget'?0:1);
   if(mode!=='budget'){await assert.rejects(tools.listenAudio(f),mode==='http'?/REVIEW_UNCERTAIN/:mode==='partial'?/PERCEPTION_INCONCLUSIVE/:/REVIEW_INCOMPLETE/);assert.equal(calls,1);}
   await assert.rejects(crewTools(f.task,f.worker,tools)('transcribe',{sha256:f.file.sha256}),/CAPABILITY_UNAVAILABLE/);
   assert.equal(tools.speakerSimilarity,undefined);
  }finally{await rm(f.dir,{recursive:true});}
 }
});

test('a completed stateless response without a provider ID recovers after a local result-write failure without resubmission',async()=>{
 const f=await fixture();let calls=0;
 try{
  const tools=createGeminiReviewTools({...f.options,fetcher:async()=>{calls++;const response=await f.response().json();delete response.id;return Response.json(response);}});const result=await tools.listenAudio(f);assert.equal(result.interactionId,null);
  await rm(join(result.receiptPath,'result.json'));const offline=createGeminiReviewTools({...f.options,maxCalls:0,fetcher:async()=>{throw new Error('Must not resubmit');}});assert.deepEqual(await offline.listenAudio(f),result);assert.equal(calls,1);
  const path=join(result.receiptPath,'response.json'),saved=JSON.parse(await readFile(path,'utf8'));saved.response.status='failed';await writeFile(path,JSON.stringify(saved));await rm(join(result.receiptPath,'result.json'));await assert.rejects(offline.listenAudio(f),/RECEIPT_CHANGED/);
 }finally{await rm(f.dir,{recursive:true});}
});

test('large media uploads retain sessions, poll recorded files and never automatically repeat unknown uploads',async()=>{
 const f=await fixture(false,true);let requests=[];
 try{
  const fetcher=async(url,options)=>{requests.push({url,options});
   if(url.includes('/upload/v1beta/files'))return new Response('',{headers:{'x-goog-upload-url':'https://generativelanguage.googleapis.com/upload/session-isolated'}});
   if(url.endsWith('/upload/session-isolated'))return new Response(JSON.stringify({file:{name:'files/isolated',uri:'https://generativelanguage.googleapis.com/v1beta/files/isolated',state:'PROCESSING'}}));
   if(options.method==='GET')return new Response(JSON.stringify({name:'files/isolated',uri:'https://generativelanguage.googleapis.com/v1beta/files/isolated',state:'ACTIVE'}));
   const body=JSON.parse(options.body);assert.ok(body.input[0].uri);assert.equal(body.input[0].data,undefined);return f.response();
  };
  const tools=createGeminiReviewTools({...f.options,fetcher,wait:async()=>{}});await tools.listenAudio(f);assert.equal(requests.length,4);assert.equal(requests.filter(r=>r.url.endsWith('/interactions')).length,1);
  const uploaded=JSON.parse(await readFile(join(f.options.receiptDirectory,'uploads',f.file.sha256+'.json'),'utf8'));assert.equal(uploaded.file.state,'ACTIVE');
  const other={...f.task,taskId:'new-isolated-task',criteria:['ISOLATED changed review inputs']};await assert.rejects(tools.listenAudio({...f,task:other}),/BUDGET_REQUIRED/);assert.equal(requests.length,4);
 }finally{await rm(f.dir,{recursive:true});}
 const unknown=await fixture(false,true);let posts=0;
 try{
  const options={...unknown.options,fetcher:async()=>{posts++;throw new Error('ISOLATED transport outcome unknown');}};const tools=createGeminiReviewTools(options);await assert.rejects(tools.listenAudio(unknown),/outcome unknown/);await assert.rejects(createGeminiReviewTools(options).listenAudio(unknown),/UPLOAD_UNCERTAIN/);assert.equal(posts,1);
 }finally{await rm(unknown.dir,{recursive:true});}
});

test('concurrent perception calls cannot race past the explicit inference cap',async()=>{
 const f=await fixture();let calls=0;
 try{const tools=createGeminiReviewTools({...f.options,fetcher:async()=>{calls++;return f.response();}});
  const results=await Promise.allSettled([tools.listenAudio(f),tools.listenAudio({...f,task:{...f.task,taskId:'other-isolated-task',criteria:['ISOLATED changed review inputs']}})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.match(results.find(r=>r.status==='rejected').reason.message,/BUDGET_REQUIRED/);assert.equal(calls,1);
 }finally{await rm(f.dir,{recursive:true});}
});

test('identical concurrent Gemini requests share a result without consuming the next legitimate allowance',async()=>{
 const f=await fixture();let calls=0;
 try{const tools=createGeminiReviewTools({...f.options,maxCalls:2,fetcher:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,20));return f.response();}});
  const [first,duplicate]=await Promise.all([tools.listenAudio(f),tools.listenAudio(f)]);assert.deepEqual(first,duplicate);assert.equal(calls,1);
  await tools.listenAudio({...f,task:{...f.task,taskId:'next-legitimate-task',criteria:['ISOLATED changed review inputs']}});assert.equal(calls,2);
 }finally{await rm(f.dir,{recursive:true});}
});

test('Gemini readiness is one authenticated metadata GET for the selected model, never inference',async()=>{
 const f=await fixture();let count=0;
 try{const report=await checkProvider('gemini',f.secretsPath,async(url,options)=>{count++;assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.headers['x-goog-api-key'],'ISOLATED_SECRET');assert.ok(url.endsWith('/models/gemini-3.8-flash'));return new Response(JSON.stringify({name:'models/gemini-3.8-flash'}));});assert.equal(count,1);assert.equal(report.generationReady,false);assert.equal(report.projectStateMutated,false);}finally{await rm(f.dir,{recursive:true});}
});

test('project reservation blocks network first and completed cache consumes no additional reservation',async()=>{
 const f=await fixture();let calls=0,reserved=0;
 try{
  const denied=createGeminiReviewTools({...f.options,beforeRequest:async()=>{throw new Error('PROJECT_BUDGET_EXCEEDED');},fetcher:async()=>{calls++;throw new Error('Must not fetch');}});
  await assert.rejects(denied.listenAudio(f),/PROJECT_BUDGET_EXCEEDED/);assert.equal(calls,0);
  const tools=createGeminiReviewTools({...f.options,beforeRequest:async({requestDigest,task})=>{reserved++;assert.ok(requestDigest);assert.equal(task.taskId,f.task.taskId);},fetcher:async()=>{calls++;return f.response();}});
  await tools.listenAudio(f);await tools.listenAudio(f);assert.equal(reserved,1);assert.equal(calls,1);
 }finally{await rm(f.dir,{recursive:true});}
});

test('ffprobe owns duration; full inspection is required and routing refresh reuses only compatible evidence',async()=>{
 const f=await fixture();let calls=0;
 try{
  const tools=createGeminiReviewTools({...f.options,fetcher:async()=>{calls++;return f.response();}});
  const first=await tools.listenAudio(f);assert.equal(first.seconds,f.file.durationSeconds);assert.equal(first.report.fullMediaInspected,true);assert.equal(first.report.coverageEndSeconds,undefined);
  await rm(join(first.receiptPath,'result.json')); // Recover raw response after validation-code maintenance.
  const noSpend=createGeminiReviewTools({...f.options,maxCalls:0,fetcher:async()=>{throw new Error('Must not repeat inference');}});
  const current={...f,task:{...f.task,taskId:'refreshed-routing'}};
  const recovered=await noSpend.listenAudio(current);assert.equal(recovered.requestDigest,first.requestDigest);assert.equal(recovered.receiptPath,first.receiptPath);assert.equal(calls,1);
  await assert.rejects(noSpend.listenAudio({...current,worker:{...f.worker,workerId:'different-reviewer'}}),/BUDGET_REQUIRED/);
  await assert.rejects(noSpend.listenAudio({...current,task:{...current.task,criteria:['changed criteria']}}),/BUDGET_REQUIRED/);
  const descriptor=JSON.parse(await readFile(join(first.receiptPath,'started.json'),'utf8'));
  delete descriptor.profile.report; // Prior endpoint-based contract must not become a new full-inspection claim.
  const legacyDir=join(f.options.receiptDirectory,digest(descriptor));await mkdir(legacyDir);
  await writeFile(join(legacyDir,'started.json'),JSON.stringify(descriptor));
  const reply=JSON.parse(await readFile(join(first.receiptPath,'response.json'),'utf8'));
  reply.requestDigest=digest(descriptor);await writeFile(join(legacyDir,'response.json'),JSON.stringify(reply));
  await rm(first.receiptPath,{recursive:true});
  await assert.rejects(noSpend.listenAudio({...current,task:{...current.task,taskId:'new-contract'}}),/BUDGET_REQUIRED/);assert.equal(calls,1);
  await mkdir(first.receiptPath);descriptor.profile=GEMINI_REVIEW_PROFILE;
  await writeFile(join(first.receiptPath,'started.json'),JSON.stringify(descriptor));
  await assert.rejects(noSpend.listenAudio({...f,task:{...f.task,taskId:'another-routing'}}),/REVIEW_UNCERTAIN/);
 }finally{await rm(f.dir,{recursive:true});}
 for(const mode of ['partial','missing','legacy','unavailable','observation','video-observation']){
  const f=await fixture(mode==='video-observation');
  try{
   if(mode==='partial')f.report.fullMediaInspected=false;
   if(mode==='missing')delete f.report.fullMediaInspected;
   if(mode==='legacy'){delete f.report.fullMediaInspected;f.report.coverageStartSeconds=0;f.report.coverageEndSeconds=15.23;}
   if(mode==='unavailable')f.report.perceptible=false;
   if(mode==='observation'||mode==='video-observation')f.report.observations=[{startSeconds:0,endSeconds:f.file.durationSeconds+.04,finding:'ISOLATED impossible timestamp',repair:'Inspect',severity:'major'}];
   const tools=createGeminiReviewTools({...f.options,fetcher:async()=>f.response()});
   await assert.rejects(tools[mode==='video-observation'?'watchVideo':'listenAudio'](f),e=>e.stopDispatch===true);
  }finally{await rm(f.dir,{recursive:true});}
 }
});
