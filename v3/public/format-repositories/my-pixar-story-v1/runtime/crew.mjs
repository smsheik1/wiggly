import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import {text,File} from './contracts.mjs';
import {verifyFiles,measureAudio,probe} from './media.mjs';
// These are format capabilities, not arbitrary filesystem/network/shell access.
export const crewRoles={
 'script-writer':{name:'Leo',tools:['readAsset']},
 'text-reviewer':{name:'Sage',tools:['readAsset']},
 'cast-designer':{name:'Cleo',tools:['readAsset','viewImage']},
 'sheet-prompter':{name:'Pia',tools:['readAsset','viewImage']},
 'background-product-owner':{name:'Beau',tools:['readAsset','viewImage']},
 'pixar-prompter':{name:'Pia',tools:['readAsset','viewImage']},
 'shot-planner':{name:'Sam',tools:['readAsset','viewImage']},
 'composition-writer':{name:'Cam',tools:['readAsset','viewImage']},
 'motion-director':{name:'Mo',tools:['readAsset','viewImage']},
 'video-prompt-engineer':{name:'Vin',tools:['readAsset','viewImage']},
 'sound-designer':{name:'Finn',tools:['readAsset','listenAudio','measureAudio']},
 'film-editor':{name:'Eli',tools:['readAsset','viewImage','watchVideo','listenAudio','measureAudio']},
 'audio-reviewer':{name:'Ava',tools:['readAsset','listenAudio','measureAudio','transcribe','speakerSimilarity']},
 'visual-reviewer':{name:'Vera',tools:['readAsset','viewImage','watchVideo']},
 'generation-planner':{name:'Max',tools:['readAsset','viewImage']},
};
export const Crew=z.object({workers:z.array(z.object({workerId:text,name:text,role:z.enum(Object.keys(crewRoles)),modelVersion:text,capabilityVersion:text,execution:z.literal('host')})).min(1)}).strict().superRefine((crew,ctx)=>{
 if(new Set(crew.workers.map(w=>w.role)).size!==crew.workers.length||new Set(crew.workers.map(w=>w.workerId)).size!==crew.workers.length)ctx.addIssue({code:'custom',message:'Each role needs one distinct host worker; IDs cannot impersonate another role.'});
 if(Object.keys(crewRoles).some(role=>!crew.workers.some(w=>w.role===role)))ctx.addIssue({code:'custom',message:'Assign every format role; missing workers cannot silently fall back.'});
});
export function roleFor(p){
 if(p.gate==='owner-review')return 'background-product-owner';
 if(p.gate==='review')return p.step==='film'?(p.artifacts.findLast(a=>a.key==='film'&&a.valid)?.visualReview?.decision==='approved'?'audio-reviewer':'visual-reviewer'):['audition','narration','music','effect'].includes(p.step)?'audio-reviewer':['candidates','sheet','backgroundCandidates','backgroundAngle','keyframe','video'].includes(p.step)?'visual-reviewer':'text-reviewer';
 if(p.gate==='produce')return 'generation-planner';
 return ({script:'script-writer',roster:'cast-designer',sheetPrompt:'sheet-prompter',backgrounds:'background-product-owner',backgroundBrief:'background-product-owner',backgroundAngleBrief:'background-product-owner',backgroundPrompt:'pixar-prompter',backgroundAnglePrompt:'pixar-prompter',shots:'shot-planner',keyframePrompt:'composition-writer',videoPlan:'motion-director',videoPrompt:'video-prompt-engineer',soundPlan:'sound-designer',music:'sound-designer',effect:'sound-designer',editPlan:'film-editor'})[p.step]??'orchestrator';
}
export function assignedWorker(p){return p.crew?.workers.find(w=>w.role===roleFor(p));}
export function assertCrewEvent(p,event){
 if(!p.crew||!['artifact','owner-review','review','plan'].includes(event.action)||event.actor==='human')return;
 const worker=assignedWorker(p);
 if(!worker||event.workerId!==worker.workerId)throw new Error('CREW_PERMISSION_DENIED: only the assigned worker may submit this task.');
 if(['review','owner-review'].includes(event.action)&&(event.review?.modelVersion!==worker.modelVersion||event.review?.capabilityVersion!==worker.capabilityVersion))throw new Error('CREW_MODEL_CHANGED: review must bind the assigned model.');
}
function filesIn(value,out=new Map()){
 if(!value||typeof value!=='object')return out;
 if(value.path&&value.sha256&&value.bytes){const f=File.parse(value);out.set(f.sha256,f);return out;}
 for(const v of Object.values(value))filesIn(v,out);return out;
}
export function taskAssets(task){return filesIn({artifact:task.artifact,dependencies:task.dependencies,visualReferences:task.visualReferences,references:task.references,availableLocations:task.availableLocations,videoBinding:task.videoBinding,sample:task.voiceReference});}
export function crewTools(task,worker,adapters={},record=()=>{}){
 const allowed=crewRoles[worker.role]?.tools??[],assets=taskAssets(task);
 const get=async hash=>{const file=assets.get(hash);if(!file)throw new Error('ASSET_SCOPE_DENIED: use a hash from this current task.');await verifyFiles(file);return file;};
 const execute=async(name,parameters={})=>{
  if(!allowed.includes(name))throw new Error(`TOOL_PERMISSION_DENIED: ${worker.name} cannot call ${name}.`);
  const file=await get(parameters.sha256);
  if(name==='readAsset')return {file,bytes:await readFile(file.path)};
  if(name==='measureAudio'){if(!file.durationSeconds||file.width)throw new Error('Expected an audio-only file.');return measureAudio(file);}
  if(name==='speakerSimilarity'){const reference=await get(parameters.referenceSha256);if(!adapters[name])throw new Error('CAPABILITY_UNAVAILABLE: calibrated speaker comparison tool required.');return z.object({score:z.number().min(0).max(1),method:text,calibrationNotes:text}).parse(await adapters[name]({file,reference,worker}));}
  if(name==='viewImage'&&(!file.width||file.durationSeconds))throw new Error('Expected a still image.');
  if(name==='watchVideo'&&(!file.width||!file.durationSeconds))throw new Error('Expected a measured video.');
  if(['listenAudio','transcribe'].includes(name)&&(!file.durationSeconds||(file.width&&!(await probe(file.path)).hasAudio)))throw new Error('Expected an audible file.');
  if(!adapters[name])throw new Error(`CAPABILITY_UNAVAILABLE: host must connect actual ${name}; file access/metadata are insufficient.`);
  const result=await adapters[name]({file,worker});
  if(name==='transcribe')return z.object({transcript:text,method:text}).parse(result);
  if(name==='viewImage')return z.object({perception:z.literal('direct-image')}).passthrough().parse(result);
  return z.object({perception:z.literal(name==='watchVideo'?'direct-video':'direct-audio'),seconds:z.number().positive()}).passthrough().parse(result);
 };
 return async(name,parameters={})=>{const value=await execute(name,parameters);record({tool:name,sha256:parameters.sha256,referenceSha256:parameters.referenceSha256,seconds:value.seconds},value);return value;};
}
export async function runCrewTask(p,task,host){
 const worker=assignedWorker(p);if(!worker)throw new Error('CREW_NOT_CONFIGURED: bind real host workers first.');
 if(!['author','owner-review','review','produce'].includes(task.gate))throw new Error('Crew cannot operate a human/runtime gate.');
 if(typeof host.runTask!=='function')throw new Error('Host adapter must export runTask(task, {worker, callTool}).');
 const receipts=[],outputs=new Map();
 const event=await host.runTask({...task,worker,allowedTools:crewRoles[worker.role].tools},{worker,callTool:crewTools(task,worker,host.tools,(r,value)=>{receipts.push(r);outputs.set(`${r.tool}:${r.sha256}`,value);})});
 const expected=task.gate==='review'?'review':task.gate==='owner-review'?'owner-review':task.gate==='produce'?'plan':'artifact';
 if(event.taskId!==task.taskId||event.actor!==task.actor||event.action!==expected)throw new Error('CREW_PERMISSION_DENIED: worker may only submit its assigned deliverable; no human approvals, state writes or provider calls.');
 assertCrewEvent(p,event);
 if(['review','owner-review'].includes(event.action)&&event.review?.decision!=='inconclusive'){
  const required=worker.role==='audio-reviewer'?['listenAudio',...(['audition','narration'].includes(task.step)?['measureAudio','transcribe','speakerSimilarity']:[])]:worker.role==='visual-reviewer'?[['video','film'].includes(task.step)?'watchVideo':'viewImage']:[];
  for(const file of task.artifact?.content.files??[])for(const tool of required){const receipt=receipts.find(r=>r.tool===tool&&r.sha256===file.sha256);if(!receipt||['watchVideo','listenAudio'].includes(tool)&&receipt.seconds+.02<file.durationSeconds||tool==='speakerSimilarity'&&receipt.referenceSha256!==task.voiceReference?.content.files[0].sha256)throw new Error('PERCEPTION_NOT_PERFORMED: actual current-file perception/measurement tool calls are required before a verdict.');}
  if(worker.role==='audio-reviewer'&&['audition','narration'].includes(task.step)){
   const files=task.artifact.content.files,stt=files.map(f=>outputs.get(`transcribe:${f.sha256}`)),similarity=files.map(f=>outputs.get(`speakerSimilarity:${f.sha256}`)),measured=files.map(f=>outputs.get(`measureAudio:${f.sha256}`));
   event.review.measurements={...event.review.measurements,transcripts:stt.map(t=>t.transcript),speechToTextMethod:[...new Set(stt.map(t=>t.method))].join('; '),referenceSha256:task.voiceReference.content.files[0].sha256,speakerSimilarity:Math.min(...similarity.map(s=>s.score)),speakerSimilarityMethod:[...new Set(similarity.map(s=>s.method))].join('; '),silenceSeconds:measured.map(m=>m.silenceSeconds),speakingRateWpm:stt.map((t,i)=>(t.transcript.match(/[\p{L}\p{N}]+/gu)?.length??0)/measured[i].durationSeconds*60),measurementNotes:[event.review.measurements?.measurementNotes,...similarity.map(s=>s.calibrationNotes)].filter(Boolean).join('; ')};
  }
  event.review.toolEvidence=receipts;
 }
 return event;
}
