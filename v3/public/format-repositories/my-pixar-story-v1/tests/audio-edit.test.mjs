import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createAudioEditTools,AudioEditReceipt,AUDIO_EDIT_PROFILE,validateAudioEdit} from '../runtime/audio-edit.mjs';
import {importMedia,verifyFiles,sha} from '../runtime/media.mjs';
import {digest} from '../runtime/contracts.mjs';
import {current,taskFor,applyEvent} from '../runtime/workflow.mjs';
import {crewTools,runCrewTask,crewRoles} from '../runtime/crew.mjs';
import {createCartesiaTranscriptionTool} from '../runtime/cartesia-stt.mjs';
import {audioProject,file,script,reviewed,event} from './helpers.mjs';
const plan={kind:'pause-shortening',keepRanges:[{startSeconds:0,endSeconds:7},{startSeconds:9.2,endSeconds:17.2}],reason:'ISOLATED remove 2.2 seconds from a known synthetic silent region.'};
const crew={workers:Object.entries(crewRoles).map(([role,a])=>({role,name:a.name,workerId:`isolated-${role}`,modelVersion:'ISOLATED',capabilityVersion:'ISOLATED',execution:'host'}))};
function rejected(){
 let p=audioProject();p.step='narration';p.gate='review';const a=current(p);delete a.approvedBy;delete a.review;
 a.content.files=[file(101,15),file(102,17.2),file(103,15),file(104,15)];a.content.sourceFiles=structuredClone(a.content.files);a.content.tailSilenceSeconds=[0,0,0,0];a.digest=digest(a.content);
 p=reviewed(p,'rejected',{repairTarget:'script',checks:taskFor(p).criteria.map(c=>({criterion:c,status:c==='duration'?'fail':'pass',location:'ISOLATED beat 2',evidence:'ISOLATED 17.2s synthetic stem',repair:c==='duration'?'Try local pause shortening before rewriting.':''}))});
 return p;
}
function content(p,receipt){const result=structuredClone(current(p).content),i=receipt.beat-1;result.files[i]=receipt.outputFile;result.sourceFiles[i]=receipt.editedFile;result.tailSilenceSeconds[i]=receipt.tailSilenceSeconds;result.audioEdits=[receipt];return result;}
function investigation(p){const source=current(p).content.files[1];return {audioInvestigation:[{beat:2,sha256:source.sha256,inspection:{durationSeconds:source.durationSeconds,method:'ISOLATED pause inspection',pauses:[]},transcription:{transcript:'ISOLATED words',method:'ISOLATED ASR',words:[{word:'ISOLATED',start:0,end:1}]}}],toolEvidence:['listenAudio','inspectAudio','transcribe'].map(tool=>({tool,sha256:source.sha256,...(tool==='listenAudio'?{seconds:source.durationSeconds}:{})}))};}
function isolatedReceipt(p){
 const parent=current(p),task=taskFor(p),sourceFile=parent.content.files[1],editedFile=file(105,15);
 return AudioEditReceipt.parse({beat:2,parentArtifactId:parent.id,parentArtifactDigest:parent.digest,sourceFile,editedFile,outputFile:editedFile,tailSilenceSeconds:0,plan,editDigest:digest({profile:AUDIO_EDIT_PROFILE,taskId:task.taskId,workerId:'isolated-film-editor',artifactId:parent.id,artifactDigest:parent.digest,sourceSha256:sourceFile.sha256,plan}),receiptPath:'/isolated-test/audio-edit'});
}
test('scoped FFmpeg editor makes a measured immutable draft, rejects speech cuts and preserves receipts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-audio-edit-'));
 try{
  const path=join(dir,'source.wav');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=500:duration=17.2:sample_rate=44100','-af',"volume=0:enable='between(t,6,10)'",path]);
  const source=await importMedia(path,dir),tools=createAudioEditTools({runDir:dir}),worker=crew.workers.find(w=>w.role==='film-editor');
  const task={step:'narration',gate:'author',taskId:'isolated-edit',artifact:{id:'narration@1',digest:'ISOLATED',review:{decision:'rejected',checks:[{criterion:'delivery',status:'fail'}]},content:{files:[file(),source]}}};
  const args={file:source,task,worker,edit:plan},inspection=await tools.inspectAudio(args);assert.ok(inspection.pauses.some(p=>p.startSeconds<7&&p.endSeconds>9.2));
  const result=await tools.renderAudioEdit(args);assert.equal(result.beat,2);assert.equal(result.outputFile.durationSeconds,15);assert.equal(result.editedFile.durationSeconds,15);assert.equal(result.sourceFile.sha256,source.sha256);assert.notEqual(result.outputFile.sha256,source.sha256);await verifyFiles(source);await verifyFiles(result);
  assert.equal((await stat(result.receiptPath)).mode&0o777,0o700);assert.equal((await stat(join(result.receiptPath,'edited.wav'))).mode&0o777,0o600);
  const padded=await tools.renderAudioEdit({...args,edit:{...plan,keepRanges:[{startSeconds:0,endSeconds:7},{startSeconds:9.3,endSeconds:17.2}],reason:'ISOLATED padded draft'}});assert.equal((await stat(join(padded.receiptPath,'window.wav'))).mode&0o777,0o600);
  assert.deepEqual(await tools.renderAudioEdit(args),result);
  await assert.rejects(tools.renderAudioEdit({...args,edit:{...plan,keepRanges:[{startSeconds:2.2,endSeconds:17.2}]}}),/SPEECH_CUT_DENIED/);
  for(const keepRanges of [[{startSeconds:-1,endSeconds:14}],[{startSeconds:0,endSeconds:18}],[{startSeconds:4,endSeconds:7},{startSeconds:6,endSeconds:10}]])assert.throws(()=>validateAudioEdit(source,{...plan,keepRanges}));
  assert.throws(()=>validateAudioEdit(source,{...plan,playbackRate:1.1}));
  await assert.rejects(tools.renderAudioEdit({...args,worker:{...worker,role:'audio-reviewer'}}),/SCOPE_DENIED/);
  await assert.rejects(tools.renderAudioEdit({...args,task:{...task,artifact:{...task.artifact,approvedBy:{message:'locked'}}}}),/SCOPE_DENIED/);
  for(const reason of ['ISOLATED third draft'])await tools.renderAudioEdit({...args,edit:{...plan,reason}});
  await assert.rejects(tools.renderAudioEdit({...args,edit:{...plan,reason:'ISOLATED fourth draft'}}),/ATTEMPT_LIMIT/);
  const receiptPath=join(result.receiptPath,'result.json'),receipt=JSON.parse(await readFile(receiptPath));receipt.result.plan.reason='tampered';await writeFile(receiptPath,JSON.stringify(receipt));await assert.rejects(tools.renderAudioEdit(args),/RECEIPT_CHANGED/);
 }finally{await rm(dir,{recursive:true});}
});
test('narration repair routes to the editor, preserves sibling bytes and locks, and resumes at independent review',()=>{
  const p=rejected();p.crew=crew;const before=structuredClone(p),receipt=isolatedReceipt(p),draft=content(p,receipt);assert.equal(taskFor(p).formatRole,'film-editor');assert.equal(p.gate,'author');
  const submission=event(p,'artifact',{workerId:'isolated-film-editor',content:draft});const updated=applyEvent(p,submission);assert.equal(updated.gate,'review');assert.equal(taskFor(updated).formatRole,'audio-reviewer');assert.ok(!current(updated).approvedBy);
  for(const key of ['script','clone','audition'])assert.deepEqual(current(updated,key),current(before,key));for(const i of [0,2,3])assert.deepEqual(current(updated).content.files[i],current(before).content.files[i]);assert.deepEqual(updated.jobs,before.jobs);
  for(const alter of [r=>r.sourceFile.sha256='f'.repeat(64),r=>r.parentArtifactDigest='wrong',r=>r.editDigest='wrong',r=>r.outputFile.durationSeconds=14]){const bad=structuredClone(receipt);alter(bad);assert.throws(()=>applyEvent(p,{...submission,content:content(p,bad)}),/AUDIO_EDIT/);}
  const sibling=structuredClone(draft);sibling.files[0]=file(999,15);assert.throws(()=>applyEvent(p,{...submission,content:sibling}),/SOURCE_BINDING/);
  const voice=structuredClone(draft);voice.voiceId='wrong';assert.throws(()=>applyEvent(p,{...submission,content:voice}),/SOURCE_BINDING/);
  assert.throws(()=>applyEvent(updated,event(updated,'approve',{actor:'human',artifactId:current(updated).id,artifactDigest:current(updated).digest,message:'skip reviewer'})),/agent-passing/);
  const failed=reviewed({...updated,crew:undefined},'rejected');assert.equal(failed.gate,'escalate');
  assert.throws(()=>applyEvent(failed,event(failed,'resolve',{actor:'human',message:'Try indefinitely.'})),/ATTEMPT_LIMIT/);
  const refusal=event(p,'planning-blocked',{workerId:'isolated-film-editor',message:'ISOLATED safe cuts insufficient.',blocker:{kind:'editing-infeasible',beats:[2],problem:'Cannot cut speech safely.',solution:'Request affected-beat repair.',steps:['Show exact remaining defect.']}});
  assert.throws(()=>applyEvent(p,refusal),/INVESTIGATION_REQUIRED/);
  const blocked=applyEvent(p,{...refusal,...investigation(p)});assert.equal(blocked.gate,'escalate');assert.deepEqual(blocked.jobs,p.jobs);assert.deepEqual(blocked.history.at(-1).audioInvestigation,investigation(p).audioInvestigation);
  const resumed=applyEvent(blocked,event(blocked,'resolve',{actor:'human',message:'Try a different local cut.'}));assert.equal(resumed.gate,'author');assert.equal(resumed.reviewDisagreements,blocked.reviewDisagreements);
  const old=structuredClone(p);old.gate='escalate';old.studio.config.agents['film-editor'].tools=old.studio.config.agents['film-editor'].tools.filter(t=>!['transcribe','inspectAudio','renderAudioEdit'].includes(t));old.studio.sha256=digest({config:old.studio.config,documents:old.studio.documents});
  const enabled=applyEvent(old,event(old,'start-audio-edit',{actor:'human',message:'Enable the local audio editor.'}));assert.equal(enabled.gate,'author');assert.deepEqual(enabled.artifacts,old.artifacts);assert.deepEqual(enabled.budget,old.budget);
  const pinned=structuredClone(old);pinned.studio.config.agents['film-editor'].model='older-pinned-model';pinned.studio.config.agents['script-writer'].model='older-writer-model';const path='crew/leo/SKILL.md';pinned.studio.documents[path]={content:'ISOLATED older pinned writer instruction',sha256:sha('ISOLATED older pinned writer instruction')};pinned.studio.sha256=digest({config:pinned.studio.config,documents:pinned.studio.documents});
  const narrow=applyEvent(pinned,event(pinned,'start-audio-edit',{actor:'human',message:'Enable only editing.'}));assert.equal(narrow.studio.config.agents['film-editor'].model,'older-pinned-model');assert.equal(narrow.studio.config.agents['script-writer'].model,'older-writer-model');assert.deepEqual(narrow.studio.documents[path],pinned.studio.documents[path]);
  const noted=applyEvent(p,event(p,'note',{actor:'human',message:'Say AC; do not expand the abbreviation.'}));assert.equal(taskFor(noted).feedback.at(-1).message,'Say AC; do not expand the abbreviation.');assert.deepEqual(noted.artifacts,p.artifacts);
});
test('editor transcription really connects and an infeasibility verdict needs actual investigated evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-editor-investigation-'));
 try{
  const path=join(dir,'source.wav');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=500:duration=17.2',path]);const source=await importMedia(path,dir),p=rejected();p.crew=crew;current(p).content.files[1]=source;current(p).content.sourceFiles[1]=source;current(p).digest=digest(current(p).content);const task=taskFor(p),worker=task.crewWorker,args={sha256:source.sha256};
  const secretsPath=join(dir,'secrets.env');await writeFile(secretsPath,'CARTESIA_API_KEY=ISOLATED_EDITOR_SECRET\n');let calls=0;
  const tools={...createAudioEditTools({runDir:dir}),listenAudio:async({file})=>({perception:'direct-audio',seconds:file.durationSeconds}),...createCartesiaTranscriptionTool({secretsPath,receiptDirectory:join(dir,'stt'),maxCalls:1,fetcher:async()=>{calls++;return Response.json({type:'transcript',text:'ISOLATED A slash C',language:'en',duration:17.2,words:[{word:'A',start:4.9,end:5.2},{word:'slash C',start:5.2,end:6.2}]});}})};
  const preflight=crewTools(task,worker,tools);await preflight('listenAudio',args);await preflight('inspectAudio',args);await assert.rejects(preflight('renderAudioEdit',{...args,edit:{...plan,kind:'pronunciation-repair'}}),/WORD_TIMING_REQUIRED/);
  const noTiming=crewTools(task,worker,{...tools,transcribe:async()=>({transcript:'ISOLATED words',method:'ISOLATED untimed ASR',words:[]})});await noTiming('listenAudio',args);await noTiming('inspectAudio',args);await assert.rejects(noTiming('transcribe',args),e=>e.stopDispatch&&/WORD_TIMING_UNAVAILABLE/.test(e.message));await assert.rejects(noTiming('renderAudioEdit',{...args,edit:{...plan,kind:'pronunciation-repair'}}),/WORD_TIMING_REQUIRED/);
  const refusal=event(p,'planning-blocked',{workerId:worker.workerId,message:'ISOLATED fused word timing does not establish a safe internal cut.',blocker:{kind:'editing-infeasible',beats:[2],problem:'No established safe splice.',solution:'Show evidence before any script change.',steps:['Review the fused word timing.']},...investigation(p)});
  const host={tools,runTask:async()=>structuredClone(refusal)};
  await assert.rejects(runCrewTask(p,task,host),e=>e.knownFinished&&/INVESTIGATION_REQUIRED/.test(e.message));
  host.runTask=async(_,{callTool})=>{await callTool('listenAudio',args);await callTool('inspectAudio',args);return structuredClone(refusal);};await assert.rejects(runCrewTask(p,task,host),/INVESTIGATION_REQUIRED/);
  host.runTask=async(_,{callTool})=>{await callTool('listenAudio',args);await callTool('inspectAudio',args);await callTool('transcribe',args);return structuredClone(refusal);};
  const result=await runCrewTask(p,task,host);assert.equal(calls,1);assert.equal(result.audioInvestigation[0].transcription.words[1].word,'slash C');assert.equal(result.audioInvestigation[0].transcription.transcript,'ISOLATED A slash C');const stopped=applyEvent(p,result);assert.equal(stopped.gate,'escalate');assert.deepEqual(stopped.artifacts,p.artifacts);assert.deepEqual(stopped.history.at(-1).audioInvestigation,result.audioInvestigation);
  for(const mutate of [r=>r.audioInvestigation[0].sha256='wrong',r=>r.audioInvestigation[0].transcription.words[0].end=30,r=>r.audioInvestigation[0].transcription.words=[],r=>r.toolEvidence=r.toolEvidence.filter(e=>e.tool!=='transcribe'),r=>r.blocker.beats=[1],r=>r.blocker.kind='missing-input']){const bad=structuredClone(result);mutate(bad);assert.throws(()=>applyEvent(p,bad),/INVESTIGATION/);}
  for(const name of ['listenAudio','inspectAudio','transcribe'])await assert.rejects(crewTools(task,worker,{[name]:async()=>{throw new Error('ISOLATED tool access failed');}})(name,args),e=>e.stopDispatch===true);
  for(const badTask of [{...task,gate:'review'},{...task,step:'editPlan'},{...task,artifact:{...task.artifact,approvedBy:{message:'locked'}}}])await assert.rejects(tools.transcribe({file:source,task:badTask,worker}),/SCOPE_DENIED/);assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true});}
});
test('editing broker requires real listening and inspection and cannot grant edits to the reviewer',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'memoir-audio-edit-broker-'));
 try{
  const path=join(dir,'source.wav');execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=500:duration=17.2','-af',"volume=0:enable='between(t,6,10)'",path]);const source=await importMedia(path,dir);
  const p=rejected();p.crew=crew;current(p).content.files[1]=source;current(p).content.sourceFiles[1]=source;current(p).digest=digest(current(p).content);const task=taskFor(p),worker=task.crewWorker;
  const tools={...createAudioEditTools({runDir:dir}),listenAudio:async({file})=>({perception:'direct-audio',seconds:file.durationSeconds})},call=crewTools(task,worker,tools),args={sha256:source.sha256,edit:plan};
  await assert.rejects(call('renderAudioEdit',args),/LISTEN_REQUIRED/);await call('inspectAudio',args);await assert.rejects(call('renderAudioEdit',args),/LISTEN_REQUIRED/);await call('listenAudio',args);const receipt=await call('renderAudioEdit',args);
  const reviewer=crew.workers.find(w=>w.role==='audio-reviewer');await assert.rejects(crewTools({...task,gate:'review',allowedTools:['renderAudioEdit']},reviewer,tools)('renderAudioEdit',args),/PERMISSION_DENIED/);
  await assert.rejects(call('renderAudioEdit',{sha256:'f'.repeat(64),edit:plan}),/ASSET_SCOPE_DENIED/);
  const response=event(p,'artifact',{workerId:worker.workerId,content:content(p,receipt)});
  await assert.rejects(runCrewTask(p,task,{runTask:async()=>response}),/NOT_RENDERED/);
  const host={tools,runTask:async(_task,{callTool})=>{await callTool('listenAudio',args);await callTool('inspectAudio',args);const actual=await callTool('renderAudioEdit',args);return {...response,content:content(p,actual)};}};
  await assert.rejects(runCrewTask(p,task,host),/PREVIEW_REQUIRED/);
  host.runTask=async(_task,{callTool})=>{await callTool('listenAudio',args);await callTool('inspectAudio',args);const actual=await callTool('renderAudioEdit',args);await callTool('listenAudio',{sha256:actual.outputFile.sha256});return {...response,content:content(p,actual)};};
  const result=await runCrewTask(p,task,host);assert.equal(applyEvent(p,result).gate,'review');
 }finally{await rm(dir,{recursive:true});}
});

test('one exact human audio recovery preserves exhausted limits and cannot be reused',()=>{
 const p=rejected();p.gate='escalate';p.reviewDisagreements=p.studio.config.limits.reviewDisagreements;
 const a=current(p),e=event(p,'recover-audio-edit',{actor:'human',artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED approve one additional repair.'});
 const next=applyEvent(p,e);assert.equal(next.gate,'author');assert.equal(next.reviewDisagreements,p.reviewDisagreements);
 for(const key of ['artifacts','jobs','budget','studio','crew'])assert.deepEqual(next[key],p[key]);
 assert.equal(next.history.at(-1).artifactDigest,a.digest);assert.equal(next.history.at(-1).message,e.message);
 for(const extra of [{actor:'agent'},{artifactDigest:'stale'},{message:''}])assert.throws(()=>applyEvent(p,{...e,...extra}),/RECOVERY_DENIED|authority|too_small/);
 const uncertain=structuredClone(p);uncertain.jobs[0].status='uncertain';assert.throws(()=>applyEvent(uncertain,e),/RECOVERY_DENIED/);
 const locked=structuredClone(p);current(locked).approvedBy={message:'ISOLATED locked',at:new Date().toISOString()};assert.throws(()=>applyEvent(locked,e),/RECOVERY_DENIED/);
 const repeated={...next,gate:'escalate'};assert.throws(()=>applyEvent(repeated,event(repeated,'recover-audio-edit',{actor:'human',artifactId:a.id,artifactDigest:a.digest,message:'ISOLATED repeat.'})),/RECOVERY_DENIED/);
 assert.throws(()=>applyEvent(repeated,event(repeated,'resolve',{actor:'human',message:'ISOLATED bypass.'})),/ATTEMPT_LIMIT/);
});
