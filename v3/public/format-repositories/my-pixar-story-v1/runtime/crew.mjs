import {z} from 'zod';
import {assertDebugReady} from './debug.mjs';
import {readFile} from 'node:fs/promises';
import {text,File,digest} from './contracts.mjs';
import {loadStudio,studioFor,maximumTools} from './instructions.mjs';
import {taskFor} from './workflow.mjs';
import {assertAllowed,keyFor,current} from './gates.mjs';
import {verifyFiles,measureAudio,probe} from './media.mjs';
import {supervised,reviewPassed} from './gates.mjs';
import {artifactEvidence} from './evaluators.mjs';
// These are format capabilities, not arbitrary filesystem/network/shell access.
export const crewRoles=loadStudio().config.agents;
export const Crew=z.object({workers:z.array(z.object({workerId:text,name:text,role:z.enum(Object.keys(crewRoles)),modelVersion:text,capabilityVersion:text,execution:z.literal('host')})).min(1)}).strict().superRefine((crew,ctx)=>{
 if(new Set(crew.workers.map(w=>w.role)).size!==crew.workers.length||new Set(crew.workers.map(w=>w.workerId)).size!==crew.workers.length)ctx.addIssue({code:'custom',message:'Each role needs one distinct host worker; IDs cannot impersonate another role.'});
 if(Object.keys(crewRoles).some(role=>!crew.workers.some(w=>w.role===role)))ctx.addIssue({code:'custom',message:'Assign every format role; missing workers cannot silently fall back.'});
});
export function roleFor(p){
 if(p.step==='narration'&&p.gate==='author')return 'film-editor';
 if(p.gate==='owner-review')return 'background-product-owner';
 if(p.gate==='review')return p.step==='film'?(reviewPassed(p.artifacts.findLast(a=>a.key==='film'&&a.valid)?.visualReview)?'audio-reviewer':'visual-reviewer'):['audition','narration','music','effect'].includes(p.step)?'audio-reviewer':['candidates','sheet','backgroundCandidates','backgroundAngle','keyframe','video'].includes(p.step)?'visual-reviewer':'text-reviewer';
 if(p.gate==='produce')return 'generation-planner';
 return ({answers:'script-writer',characterPrompt:'cast-designer',script:'script-writer',roster:'cast-designer',sheetPrompt:'sheet-prompter',backgrounds:'background-product-owner',backgroundBrief:'background-product-owner',backgroundAngleBrief:'background-product-owner',backgroundPrompt:'pixar-prompter',backgroundAnglePrompt:'pixar-prompter',shotIntentions:'shot-planner',shots:'shot-planner',keyframePrompt:'composition-writer',videoPlan:'motion-director',videoPrompt:'video-prompt-engineer',soundPlan:'sound-designer',music:'sound-designer',effect:'sound-designer',editPlan:'film-editor'})[p.step]??'orchestrator';
}
export function assignedWorker(p){return p.crew?.workers.find(w=>w.role===roleFor(p));}
export function assertCrewEvent(p,event){
 if(!p.crew||!['artifact','owner-review','review','plan','planning-blocked'].includes(event.action)||event.actor==='human')return;
 const worker=assignedWorker(p);
 if(!worker||event.workerId!==worker.workerId)throw new Error('CREW_PERMISSION_DENIED: only the assigned worker may submit this task.');
 if(['review','owner-review'].includes(event.action)&&(event.review?.modelVersion!==worker.modelVersion||event.review?.capabilityVersion!==worker.capabilityVersion))throw new Error('CREW_MODEL_CHANGED: review must bind the assigned model.');
}
function filesIn(value,out=new Map()){
 if(!value||typeof value!=='object')return out;
 if(value.path&&value.sha256&&value.bytes){const f=File.parse(value);out.set(f.sha256,f);return out;}
 for(const v of Object.values(value))filesIn(v,out);return out;
}
export function taskAssets(task){return filesIn({artifact:task.artifact,dependencies:task.dependencies,visualReferences:task.visualReferences,references:task.references,availableLocations:task.availableLocations,videoBinding:task.videoBinding,sample:task.voiceReference,intake:task.intakeConfirmation,characters:task.characterReferences,narration:task.narration});}
export function crewTools(task,worker,adapters={},record=()=>{}){
 const observed=new Set();
 const allowed=(task.allowedTools??maximumTools[worker.role]??[]).filter(t=>maximumTools[worker.role]?.includes(t)),assets=taskAssets(task);
 const get=async hash=>{const file=assets.get(hash);if(!file)throw new Error('ASSET_SCOPE_DENIED: use a hash from this current task.');await verifyFiles(file);return file;};
 const execute=async(name,parameters={})=>{
  if(!allowed.includes(name))throw new Error(`TOOL_PERMISSION_DENIED: ${worker.name} cannot call ${name}.`);
  const file=await get(parameters.sha256);
  if(name==='readAsset')return {file,bytes:await readFile(file.path)};
  if(name==='measureAudio'){if(!file.durationSeconds||file.width)throw new Error('Expected an audio-only file.');return measureAudio(file);}
  if(['inspectAudio','renderAudioEdit'].includes(name)){
   if(task.step!=='narration'||task.gate!=='author'||worker.role!=='film-editor'||!task.artifact?.content.files.some(f=>f.sha256===file.sha256))throw new Error('AUDIO_EDIT_SCOPE_DENIED');
   if(name==='renderAudioEdit'&&(!observed.has(`listenAudio:${file.sha256}`)||!observed.has(`inspectAudio:${file.sha256}`)))throw new Error('AUDIO_EDIT_LISTEN_REQUIRED: actually listen and inspect this source before choosing cuts.');
   if(!adapters[name])throw new Error('CAPABILITY_UNAVAILABLE: connect the local audio editor.');
   const result=await adapters[name]({file,task,worker,edit:parameters.edit});
   if(name==='renderAudioEdit')for(const draft of [result.editedFile,result.outputFile])assets.set(draft.sha256,draft);
   return result;
  }
  if(name==='speakerSimilarity'){if(!task.voiceReference||parameters.referenceSha256!==task.voiceReference.content.files[0].sha256)throw new Error('VOICE_REFERENCE_UNAVAILABLE: similarity needs the genuine bound original recording; never compare synthesized speech to itself.');const reference=await get(parameters.referenceSha256);if(!adapters[name])throw new Error('CAPABILITY_UNAVAILABLE: calibrated speaker comparison tool required.');return z.object({score:z.number().min(0).max(1),method:text,calibrationNotes:text}).parse(await adapters[name]({file,reference,worker}));}
  if(name==='viewImage'&&(!file.width||file.durationSeconds))throw new Error('Expected a still image.');
  if(name==='watchVideo'&&(!file.width||!file.durationSeconds))throw new Error('Expected a measured video.');
  if(['listenAudio','transcribe'].includes(name)&&(!file.durationSeconds||(file.width&&!(await probe(file.path)).hasAudio)))throw new Error('Expected an audible file.');
  if(!adapters[name])throw new Error(`CAPABILITY_UNAVAILABLE: host must connect actual ${name}; file access/metadata are insufficient.`);
  const result=await adapters[name]({file,worker,task});
  if(name==='transcribe')return z.object({transcript:text,method:text}).passthrough().parse(result);
  if(name==='viewImage')return z.object({perception:z.literal('direct-image')}).passthrough().parse(result);
  const perceived=z.object({perception:z.literal(name==='watchVideo'?'direct-video':'direct-audio'),seconds:z.number().positive()}).passthrough().parse(result);
  if(name==='listenAudio'&&worker.role==='film-editor'&&task.step==='narration'&&task.gate==='author'&&perceived.seconds+.02<file.durationSeconds)throw new Error('AUDIO_EDIT_LISTEN_REQUIRED: complete source listening required.');
  return perceived;
 };
 return async(name,parameters={})=>{const value=await execute(name,parameters);observed.add(`${name}:${parameters.sha256}`);record({tool:name,sha256:parameters.sha256,referenceSha256:parameters.referenceSha256,seconds:value.seconds,...(value.provider?{provider:value.provider,modelVersion:value.modelVersion,requestDigest:value.requestDigest,receiptPath:value.receiptPath,samplingFps:value.samplingFps}: {})},value);return value;};
}
export async function prepareCrewTask(p,task){
 const expected=taskFor(p);
 if(task.taskId!==expected.taskId||task.step!==p.step||task.gate!==p.gate)throw new Error('STALE_TASK: read current status before dispatch.');
 // No worker can receive replaced, omitted, stale or invented project context.
 const fields=['generationEstimate','planningGuide','generationTexts','voiceBasis','voiceChoice','creativeDirections','workflowRevision','proposedCast','locationEntry','characterReferences','narration','projectId','artifact','dependencies','approvedScript','lockedAnswers','inputs','sourceInputs','sourceInputDigest','originalInputsRequired','questionnaire','castEntry','recipe','references','referenceBindings','availableLocations','shotIntentions','immediateScenes','shot','videoBinding','visualReferences','voiceReference','intakeConfirmation','feedback','criteria','formatRole','crewWorker','skill','allowedTools','studioConfig','studioSha256','instruction'];
 for(const field of fields)if(digest(task[field]??null)!==digest(expected[field]??null))throw new Error(`TASK_INPUT_MISMATCH: ${field} is missing, changed or stale; read the current task packet.`);
 if(['author','produce'].includes(p.gate))assertAllowed(p,p.step);
 for(const a of expected.dependencies??[])if(!a.valid||(!a.approvedBy&&a.kind!=='clone')||current(p,a.key)?.id!==a.id)throw new Error(`TASK_INPUT_NOT_LOCKED: ${a.key}`);
 if(['review','owner-review'].includes(task.gate)&&(!task.artifact||current(p,keyFor(p))?.id!==task.artifact.id))throw new Error('TASK_INPUT_MISSING: exact current artifact required for review.');
 const inputChecklist=[{input:'current task and role',source:'SQLite',status:'verified'},...expected.dependencies.map(a=>({input:a.key,artifactId:a.id,artifactDigest:a.digest,source:'SQLite locked artifact',status:'verified'})),...(task.artifact?[{input:'current deliverable',artifactId:task.artifact.id,artifactDigest:task.artifact.digest,source:'SQLite draft (not human approval)',status:'verified'}]:[])];
 for(const ref of expected.characterReferences??[])if(!current(p,`sheet:${ref.characterId}`)?.approvedBy)throw new Error(`TASK_INPUT_NOT_LOCKED: sheet:${ref.characterId}`);
 if(expected.narration&&!current(p,'narration')?.approvedBy)throw new Error('TASK_INPUT_NOT_LOCKED: narration');
 inputChecklist.push(...(expected.characterReferences??[]).map(ref=>({input:`sheet:${ref.characterId}`,artifactId:ref.artifactId,sha256:ref.file.sha256,source:'SQLite approved reference',status:'verified'})),...(expected.narration?[{input:'narration',artifactId:expected.narration.id,artifactDigest:expected.narration.digest,source:'SQLite locked narration',status:'verified'}]:[]));
 const {communication,...workPacket}=expected;
 const canonical={...workPacket,inputChecklist,...(task.repairFeedback?{repairFeedback:task.repairFeedback}:{})};
 if(task.gate!=='review')return canonical;
 const studio=studioFor(p),path=studio?.config.reviewers[expected.formatRole];
 return {...canonical,supervisionInstruction:supervised(p)?'Your review is unqualified advisory evidence. Use provisional only with direct perception and no known failures; mark unavailable calibrated voice-match inconclusive, never invent a score. Human must confirm actual media before lock. Missing listening/viewing stays inconclusive.':'Qualified review required.',evaluatorEvidence:await artifactEvidence(p),reviewerRubric:studio?studio.documents[path].content:await readFile(new URL('../evaluation/reviewer.md',import.meta.url),'utf8'),reviewerRubricSource:path?{path,sha256:studio.documents[path].sha256}:null};
}
export async function runCrewTask(p,task,host){
 assertDebugReady(p);
 const worker=assignedWorker(p);if(!worker)throw new Error('CREW_NOT_CONFIGURED: bind real host workers first.');
 if(!['author','owner-review','review','produce'].includes(task.gate))throw new Error('Crew cannot operate a human/runtime gate.');
 if(typeof host.runTask!=='function')throw new Error('Host adapter must export runTask(task, {worker, callTool}).');
 task=await prepareCrewTask(p,task);
 const receipts=[],outputs=new Map();
 const event=await host.runTask({...task,worker,allowedTools:task.allowedTools??crewRoles[worker.role].tools},{worker,callTool:crewTools(task,worker,host.tools,(r,value)=>{receipts.push(r);outputs.set(`${r.tool}:${r.sha256}`,value);})});
 try{
 const expected=task.gate==='review'?'review':task.gate==='owner-review'?'owner-review':task.gate==='produce'?'plan':'artifact';
 if(event.taskId!==task.taskId||event.actor!==task.actor||!(event.action===expected||(task.gate==='produce'||task.step==='narration'&&task.gate==='author')&&event.action==='planning-blocked'))throw new Error('CREW_PERMISSION_DENIED: worker may only submit its assigned deliverable; no human approvals, state writes or provider calls.');
 assertCrewEvent(p,event);
 if(task.step==='narration'&&task.gate==='author'&&event.action==='artifact'){
  const rendered=[...outputs.entries()].filter(([key])=>key.startsWith('renderAudioEdit:')).map(([,value])=>value);
  for(const edit of event.content?.audioEdits??[])if(edit.parentArtifactId===task.artifact.id){
   if(!rendered.some(r=>digest(r)===digest(edit)))throw new Error('AUDIO_EDIT_NOT_RENDERED: submit the exact receipt from your current scoped editing tool.');
   if(!receipts.some(r=>r.tool==='listenAudio'&&r.sha256===edit.outputFile.sha256&&r.seconds+.02>=edit.outputFile.durationSeconds))throw new Error('AUDIO_EDIT_PREVIEW_REQUIRED: listen to the full rendered draft before submitting it for independent review.');
  }
  if(!rendered.length)throw new Error('AUDIO_EDIT_NOT_RENDERED');
 }
 if(task.step==='characterPrompt'&&event.review?.decision!=='inconclusive')for(const f of task.castEntry?.references??[]){if(!receipts.some(r=>r.tool==='viewImage'&&r.sha256===f.sha256))throw new Error('CHARACTER_REFERENCES_NOT_VIEWED: prompt author/reviewer must inspect every actual source photo, not its metadata.');}
 if(['review','owner-review'].includes(event.action)&&event.review?.decision!=='inconclusive'){
  const required=worker.role==='audio-reviewer'?['listenAudio',...(['audition','narration'].includes(task.step)?['measureAudio','transcribe',...(!supervised(p)?['speakerSimilarity']:[])]:[])]:worker.role==='visual-reviewer'?[['video','film'].includes(task.step)?'watchVideo':'viewImage']:[];
  for(const file of task.artifact?.content.files??[])for(const tool of required){const receipt=receipts.find(r=>r.tool===tool&&r.sha256===file.sha256);if(!receipt||['watchVideo','listenAudio'].includes(tool)&&receipt.seconds+.02<file.durationSeconds||tool==='speakerSimilarity'&&receipt.referenceSha256!==task.voiceReference?.content.files[0].sha256)throw new Error('PERCEPTION_NOT_PERFORMED: actual current-file perception/measurement tool calls are required before a verdict.');}
  if(worker.role==='audio-reviewer'&&['audition','narration'].includes(task.step)){
   const files=task.artifact.content.files,stt=files.map(f=>outputs.get(`transcribe:${f.sha256}`)),similarity=files.map(f=>outputs.get(`speakerSimilarity:${f.sha256}`)),measured=files.map(f=>outputs.get(`measureAudio:${f.sha256}`));
   event.review.measurements={...event.review.measurements,transcripts:stt.map(t=>t.transcript),speechToTextMethod:[...new Set(stt.map(t=>t.method))].join('; '),referenceSha256:task.voiceReference?.content.files[0].sha256,identityBasis:task.voiceReference?'recorded-reference':'human-recognition',...(similarity.every(Boolean)?{speakerSimilarity:Math.min(...similarity.map(s=>s.score)),speakerSimilarityMethod:[...new Set(similarity.map(s=>s.method))].join('; ')}:{speakerSimilarity:undefined,speakerSimilarityMethod:undefined}),silenceSeconds:measured.map(m=>m.silenceSeconds),speakingRateWpm:stt.map((t,i)=>(t.transcript.match(/[\p{L}\p{N}]+/gu)?.length??0)/(task.artifact.content.sourceFiles?.[i]?.durationSeconds??measured[i].durationSeconds)*60),measurementNotes:[event.review.measurements?.measurementNotes,'Speaking rate uses the unpadded source duration when available, including natural pauses; this is not an acceleration detector.',...similarity.filter(Boolean).map(s=>s.calibrationNotes),...(similarity.every(Boolean)?[]:['Calibrated speaker comparison unavailable; human confirms their voice by listening.'])].filter(Boolean).join('; ')};
  }
  event.review.toolEvidence=receipts;
 }
 return event;
 }catch(error){throw Object.assign(error,{knownFinished:true,finishedResult:event});}
}
