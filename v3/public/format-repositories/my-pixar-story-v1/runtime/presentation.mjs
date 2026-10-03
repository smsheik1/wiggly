import {communicationFor} from './instructions.mjs';
import {isAbsolute} from 'node:path';
import {verifyFiles} from './media.mjs';
import {current,reviewPassed,supervised} from './gates.mjs';
// This is chat delivery formatting, not a new media renderer or approval engine.
export async function presentDeliverable(status){
 const {project,pending}=status,a=current(project);
 if(pending.artifact?.id!==a?.id||pending.artifact?.digest!==a?.digest)throw new Error('DELIVERY_BLOCKED: stale presentation does not match the current deliverable.');
 if(project.gate!=='human'||pending.gate!=='human'||!a?.valid||!reviewPassed(a.review))throw new Error('DELIVERY_BLOCKED: only the current agent-passing deliverable at its human gate may be presented.');
 if(a.kind==='film'&&(!reviewPassed(a.visualReview)||!reviewPassed(a.audioReview)))throw new Error('DELIVERY_BLOCKED: final film needs both independent discipline passes.');
 await verifyFiles(project.artifacts.filter(a=>a.valid));
 const files=a.content.files??[];
 if(a.kind==='narration'&&files.length!==4)throw new Error('Narration delivery requires all four separate stems.');
 const media=files.map((file,i)=>{
  if(!isAbsolute(file.path)||/[<>\r\n]/.test(file.path))throw new Error('Media preview requires an absolute local path safe for Markdown.');
  const label=a.kind==='narration'?`Beat ${i+1}`:['candidates','backgroundCandidates'].includes(a.kind)?`Option ${i+1} (selection ${i})`:a.kind==='film'?'Finished film':'Current deliverable';
  return {label,path:file.path,sha256:file.sha256,markdown:`![${label}](<${file.path}>)`};
 });
 const sample=['audition','narration'].includes(a.kind)?current(project,'voiceSample')?.content.files[0]:null;
 if(sample&&(!isAbsolute(sample.path)||/[<>\r\n]/.test(sample.path)))throw new Error('Unsafe original voice reference path.');
 const referenceMedia=sample?{label:'Original storyteller sample — compare voice identity',path:sample.path,sha256:sample.sha256,markdown:`![Original storyteller sample](<${sample.path}>)`}:null;
 let markdown=a.kind==='script'?a.content.beats.map(b=>`Beat ${b.beat} (${(b.beat-1)*15}–${b.beat*15}s)\n\n${b.narration}`).join('\n\n'):media.length?media.map(m=>m.markdown).join('\n\n'):a.content.prompt??JSON.stringify(a.content,null,2);
 if(referenceMedia)markdown=referenceMedia.markdown+'\n\n'+markdown;
 return {communication:communicationFor(project),referenceMedia,checkpointId:status.checkpointId,sequence:project.sequence,taskId:pending.taskId,artifactId:a.id,artifactDigest:a.digest,kind:a.kind,content:a.content,media,markdown,reviewPolicy:pending.reviewPolicy,reviewStatus:supervised(project)?'unqualified-advisory':'qualified',humanCriteria:supervised(project)?(a.kind==='film'?[...new Set([...a.visualReview.checks,...a.audioReview.checks].map(c=>c.criterion))]:pending.criteria):[],voiceReference:sample??null,budget:pending.budget,intakeConfirmationRequired:supervised(project)&&['answers','script'].includes(a.kind),actions:['approve','changes','redo','abandon'],requiresSelection:['candidates','backgroundCandidates'].includes(a.kind),approvalInstruction:'Present this exact current deliverable. Submit an event only after the actual human decision, with the current taskId/artifactId/artifactDigest and the real message. Explain revisionImpact before requested changes.',providerCalls:0,projectStateMutated:false};
}

// The host chat reads the pinned communication file; no extra LLM call or state.
export function producerUpdate(status){
 const {project,pending}=status;
 const decisions={author:'The assigned author is preparing this deliverable.',review:'The independent reviewer checks this version next.','owner-review':'Beau checks the prompt against the approved scene brief.',human:'Review this version, then approve, request a detail change, redo or abandon.',produce:project.step==='film'?'The approved edit is ready for the official local render.':'An exact provider plan and estimate are needed next.',authorize:'Approve this exact request and its spend before generation.',collect:'Collect the recorded request; do not submit it again.',escalate:'Your decision is needed on the recorded issue before work continues.',pending:project.step==='complete'?'The final approved film is ready.':'This saved workflow is paused; follow its explicit resume instruction.'};
 const nextDecision=project.debug?.enabled&&project.debug.paused?'Debug paused. Inspect this step’s output and evidence, then choose the next action.':decisions[pending.gate];
 return {stage:pending.step,gate:pending.gate,nextDecision,message:`Current stage: ${pending.step}. ${nextDecision}`};
}
