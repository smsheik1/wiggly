import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkProvider} from '../runtime/providers.mjs';
import {presentDeliverable} from '../runtime/presentation.mjs';
import {importMedia} from '../runtime/media.mjs';
import {digest} from '../runtime/contracts.mjs';
import {openWorkflow,taskFor} from '../runtime/workflow.mjs';
import {inputs,script,event} from './helpers.mjs';
import {crewRoles} from '../runtime/crew.mjs';

test('explicit provider metadata checks use only documented GETs, redact failures and never authorize generation',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-provider-readiness-')),secrets=join(dir,'secrets.env'),key='ISOLATED-private-key';
 try{await writeFile(secrets,['CARTESIA_API_KEY','META_API_KEY','REPLICATE_API_TOKEN','ELEVENLABS_API_KEY'].map(name=>`${name}=${key}`).join('\n'));
  for(const provider of ['cartesia','meta-muse','replicate','elevenlabs']){
   const calls=[];const fetcher=async(url,options)=>{calls.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);assert.equal(options.headers[provider==='elevenlabs'?'xi-api-key':'Authorization'],provider==='elevenlabs'?key:`Bearer ${key}`);return Response.json(provider==='cartesia'?{data:[]}:provider==='meta-muse'?{id:'muse-image-1.0'}:provider==='replicate'?url.endsWith('/account')?{type:'user',username:'Do not disclose'}:{owner:'bytedance',name:'seedance-2.0'}:{status:'active',tier:'Do not disclose'});};
   const report=await checkProvider(provider,secrets,fetcher);assert.equal(report.status,'metadata-verified');assert.equal(report.generationReady,false);assert.equal(report.mediaGenerationCalls,0);assert.equal(report.projectStateMutated,false);assert.equal(calls.length,provider==='replicate'?2:1);assert.ok(!JSON.stringify(report).includes(key));assert.ok(!JSON.stringify(report).includes('Do not disclose'));
  }
  let calls=0;await assert.rejects(checkProvider('replicate',secrets,async()=>{calls++;return new Response(`invalid key ${key}`,{status:401});}),error=>{assert.match(error.message,/HTTP 401/);assert.match(error.message,/STOP: replicate/);assert.match(error.message,/REPLICATE_API_TOKEN=<your-key>/);assert.ok(!error.message.includes(key));return true;});assert.equal(calls,1);
  await assert.rejects(checkProvider('meta-muse',secrets,async()=>Response.json({id:'wrong-model'})),/documented contract/);
  await assert.rejects(checkProvider('unsupported',secrets,()=>{throw new Error('Should not call');}),/Use cartesia/);
  await writeFile(secrets,'UNRELATED_SECRET=do-not-disclose');await assert.rejects(checkProvider('cartesia',secrets,()=>{throw new Error('Should not call');}),error=>{assert.match(error.message,/Missing named CARTESIA_API_KEY/);assert.ok(!error.message.includes('do-not-disclose'));return true;});
 }finally{await rm(dir,{recursive:true});}
});

test('chat delivery exposes four separate verified narration stems only after a passing review, and blocks stale/failed/tampered work',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-delivery-'));
 try{const files=[];for(let i=0;i<4;i++){const path=join(dir,`stem ${i}.wav`);execFileSync('ffmpeg',['-v','error','-f','lavfi','-i',`sine=frequency=${400+i*100}:duration=0.1`,path]);files.push(await importMedia(path,dir));}
  const content={files},a={id:'narration@1',key:'narration',kind:'narration',digest:digest(content),content,valid:true,review:{decision:'approved'}},project={step:'narration',gate:'human',sequence:8,artifacts:[a]},pending={gate:'human',step:'narration',taskId:'isolated-delivery',artifact:a},status={project,pending,checkpointId:'isolated'};
  const report=await presentDeliverable(status);assert.equal(report.media.length,4);assert.deepEqual(report.media.map(m=>m.label),['Beat 1','Beat 2','Beat 3','Beat 4']);assert.deepEqual(report.media.map(m=>m.sha256),files.map(f=>f.sha256));assert.equal(report.artifactDigest,a.digest);assert.equal(report.providerCalls,0);assert.equal(report.projectStateMutated,false);assert.equal(report.markdown.match(/!\[Beat/g).length,4);
  const sample={id:'voiceSample@1',key:'voiceSample',kind:'voiceSample',valid:true,content:{files:[files[0]]}};const supervised={...status,project:{...project,reviewMode:'supervised',artifacts:[sample,{...a,review:{decision:'provisional'}}]},pending:{...pending,artifact:{...a,review:{decision:'provisional'}},criteria:['integrity','voice-match']}};const advisory=await presentDeliverable(supervised);assert.equal(advisory.reviewStatus,'unqualified-advisory');assert.equal(advisory.referenceMedia.sha256,files[0].sha256);assert.match(advisory.markdown,/Original storyteller sample/);assert.deepEqual(advisory.humanCriteria,['integrity','voice-match']);assert.equal(advisory.media.length,4);
  await assert.rejects(presentDeliverable({...status,project:{...project,gate:'review'}}),/DELIVERY_BLOCKED/);
  await assert.rejects(presentDeliverable({...status,pending:{...pending,artifact:{...a,id:'narration@0'}}}),/stale presentation/);
  await assert.rejects(presentDeliverable({...status,project:{...project,artifacts:[{...a,review:{decision:'rejected'}}]}}),/DELIVERY_BLOCKED/);
  await writeFile(files[1].path,'tampered');await assert.rejects(presentDeliverable(status),/ASSET_CHANGED/);
 }finally{await rm(dir,{recursive:true});}
});

test('present CLI delivers a persisted reviewed script without changing SQLite or inventing a human approval',async()=>{
 const pipeline=JSON.parse(await readFile(new URL('../pipeline.json',import.meta.url),'utf8'));assert.match(pipeline.defaultReviewPolicy,/supervised/);assert.ok(pipeline.stages.findIndex(s=>s.startsWith('Sam shot intentions'))<pipeline.stages.findIndex(s=>s.startsWith('background scene')));
 const dir=await mkdtemp(join(tmpdir(),'memoir-chat-cli-')),workflow=openWorkflow(join(dir,'checkpoints.sqlite'));
 const crew={workers:Object.entries(crewRoles).map(([role,{name}])=>({workerId:`isolated-${role}`,role,name,modelVersion:'isolated',capabilityVersion:'isolated',execution:'host'}))};
 try{let s=await workflow.init('project',inputs);s=await workflow.respond('project',event(s.project,'configure-crew',{actor:'human',message:'ISOLATED',crew}));s=await workflow.respond('project',event(s.project,'artifact',{workerId:'isolated-script-writer',content:script}));
  const a=s.pending.artifact;s=await workflow.respond('project',event(s.project,'review',{workerId:'isolated-text-reviewer',artifactId:a.id,artifactDigest:a.digest,review:{decision:'approved',perception:'direct-text',modelVersion:'isolated',capabilityVersion:'isolated',checks:taskFor(s.project).criteria.map(criterion=>({criterion,status:'pass',location:'ISOLATED fixture',evidence:'ISOLATED test evidence'}))}}));
  const result=JSON.parse(execFileSync(process.execPath,[new URL('../runner.mjs',import.meta.url).pathname,'present','--run',dir],{encoding:'utf8'}));assert.match(result.markdown,/Beat 1 \(0–15s\)/);assert.match(result.markdown,/Dad taught me/);assert.equal(result.artifactDigest,a.digest);
  const after=await workflow.status('project');assert.equal(after.project.sequence,s.project.sequence);assert.equal(after.project.gate,'human');assert.equal(after.project.jobs.length,0);
 }finally{workflow.close();await rm(dir,{recursive:true});}
});
