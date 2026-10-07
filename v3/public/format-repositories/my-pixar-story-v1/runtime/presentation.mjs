import {communicationFor} from './instructions.mjs';
import {isAbsolute,join} from 'node:path';
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
 if(a.kind==='script'&&a.content.proposedCast)markdown+='\n\nProposed on-screen cast\n\n'+a.content.proposedCast.map(c=>`- ${c.name} (${c.ageVariant}): ${c.storyPurpose}`).join('\n');
 if(referenceMedia)markdown=referenceMedia.markdown+'\n\n'+markdown;
 return {communication:communicationFor(project),referenceMedia,checkpointId:status.checkpointId,sequence:project.sequence,taskId:pending.taskId,artifactId:a.id,artifactDigest:a.digest,kind:a.kind,content:a.content,media,markdown,reviewPolicy:pending.reviewPolicy,reviewStatus:supervised(project)?'unqualified-advisory':'qualified',humanCriteria:supervised(project)?(a.kind==='film'?[...new Set([...a.visualReview.checks,...a.audioReview.checks].map(c=>c.criterion))]:pending.criteria):[],voiceReference:sample??null,budget:pending.budget,intakeConfirmationRequired:supervised(project)&&(project.workflowRevision>=4?a.kind==='roster':['answers','script'].includes(a.kind)),actions:['approve','changes','redo','abandon'],requiresSelection:['candidates','backgroundCandidates'].includes(a.kind),approvalInstruction:'Present this exact current deliverable. Submit an event only after the actual human decision, with the current taskId/artifactId/artifactDigest and the real message. Explain revisionImpact before requested changes.',providerCalls:0,projectStateMutated:false};
}

// Derive producer speech from checkpoint evidence, not another model or state store.
const stageNames={answers:'Your memories',script:'Story and cast',voiceSample:'Your voice sample',clone:'Voice clone',audition:'Short sample using your cloned voice',narration:'Narration',roster:'Character references',characterPrompt:'Character prompt',candidates:'Character designs',sheetPrompt:'Character sheet prompt',sheet:'Character sheet',shotIntentions:'Shot planning',backgrounds:'Locations',backgroundBrief:'Background brief',backgroundPrompt:'Background prompt',backgroundCandidates:'Background designs',backgroundAngleBrief:'Background angle brief',backgroundAnglePrompt:'Background angle prompt',backgroundAngle:'Background angle',shots:'Scene staging',keyframePrompt:'Scene keyframe prompt',keyframe:'Scene keyframe',videoPlan:'Motion planning',videoPrompt:'Video prompt',video:'Video clip',soundPlan:'Sound planning',music:'Music',effect:'Sound effect',editPlan:'Film edit',film:'Finished film',complete:'Final film'};
function workerLabel(worker,step){
 const roles={'script-writer':step==='answers'?'Questionnaire Organizer':'Script Engineer','text-reviewer':step==='answers'?'Questionnaire Reviewer':step==='script'?'Script Reviewer':'Prompt Reviewer','cast-designer':'Character Designer','sheet-prompter':'Character Sheet Prompter','background-product-owner':'Background Producer','pixar-prompter':'Background Prompt Engineer','shot-planner':'Shot Planner','composition-writer':'Scene Keyframe Engineer','motion-director':'Motion Director','video-prompt-engineer':'Video Prompt Engineer','sound-designer':'Sound Designer','film-editor':'Film Editor','audio-reviewer':'Audio Reviewer','visual-reviewer':'Visual Reviewer','generation-planner':'Generation Planner'};
 return worker?`${worker.name} (${worker.role==='film-editor'&&step==='narration'?'Audio Editor':roles[worker.role]??worker.role})`:null;
}
function lastResult(project){
 const h=project.history?.findLast(h=>(h.artifactId||h.jobId||h.action==='planning-blocked')&&['artifact','review','owner-review','approve','receipt','rendered','plan','authorize','begin','job-id','provider-error','reconcile','planning-blocked'].includes(h.action));
 if(!h)return null; // Historical rows without provenance never acquire invented worker identities.
 if(h.action==='planning-blocked')return {sequence:h.sequence,actor:h.actor,worker:h.worker??null,action:h.action,message:h.blocker?.kind==='editing-infeasible'?`${workerLabel(h.worker,h.step)} could not make a clean repair to the existing recording.`:project.gate==='escalate'?`${workerLabel(h.worker,h.step)??'The generation planner'} is blocked because required planning information is missing.`:`${workerLabel(h.worker,h.step)??'The generation planner'} previously reported missing planning information.`,blocker:h.blocker??null,diagnostic:h.message,findings:[]};
 if(!h.artifactId){
  const job=project.jobs.find(j=>j.id===h.jobId);if(!job)return null;
  const reconciled=job.reconciliation?.outcome;
  const messages={reconcile:reconciled==='confirmed-no-result'?'You confirmed the original request produced no result. A fresh scoped plan is required.':reconciled==='confirmed-unusable-result'?'You confirmed the original result is unusable. A fresh scoped plan is required.':'You directed collection of the existing request. No replacement request is authorized.',plan:`${workerLabel(h.worker,h.step)??'The planner'} prepared a request and cost estimate for ${(stageNames[job.plan.operation]??job.plan.operation).toLowerCase()}.`,authorize:'You authorized the exact request and spend.',begin:'The runtime started submitting the authorized request; its outcome is not confirmed.', 'job-id':'The provider accepted the request; the saved job is awaiting collection.', 'provider-error':'Provider error: execution stopped. The original request needs reconciliation before any retry.'};
  return {sequence:h.sequence,actor:h.actor,worker:h.worker??null,jobId:job.id,requestDigest:job.digest,message:messages[h.action],findings:[],...(h.action==='provider-error'?{diagnostic:h.message}:{})};
 }
 const a=project.artifacts.find(a=>a.id===h.artifactId&&a.digest===h.artifactDigest);
 if(!a||h.action==='approve'&&(!a.valid||!a.approvedBy)||h.action==='review'&&a.kind!=='film'&&project.step===a.kind&&project.gate==='review')return null;
 const who=workerLabel(h.worker,h.step),label=stageNames[h.step]??h.step;
 let message,findings=[];
 if(h.action==='approve')message=`${label} locked by your approval.`;
 else if(['review','owner-review'].includes(h.action)){
  const r=h.action==='owner-review'?a.ownerReview:h.step==='film'?(h.worker?.role==='visual-reviewer'?a.visualReview:a.audioReview):a.review;
  if(!r||h.action==='review'&&h.step!=='film'&&a.reviewSequence!==h.sequence)return null;
  findings=r.checks.filter(c=>c.status!=='pass');
  message=`${who??'The reviewer'} completed the review: ${r.decision==='rejected'?'rejected with repair notes':r.decision==='inconclusive'?'inconclusive':`${r.checks.filter(c=>c.status==='pass').length} checks passed${findings.length?`, ${findings.length} unresolved`:''}`}.`;
 }else message=`${who??(h.actor==='human'?'You':'The runtime')} ${h.action==='artifact'?'submitted':h.action==='rendered'?'rendered':'collected'} ${label.toLowerCase()}.`;
 return {sequence:h.sequence,actor:h.actor,worker:h.worker??null,artifactId:a.id,artifactDigest:a.digest,message,findings};
}
export function producerUpdate(status,runDir){
 const {project,pending}=status,paused=!!(project.debug?.enabled&&project.debug.paused);
 const label=stageNames[pending.step]??pending.step,who=workerLabel(pending.crewWorker,pending.step);
 if(project.lifecycle==='abandoned')return {reporter:'Orchestrator (Producer)',stage:pending.step,stageLabel:label,gate:pending.gate,completion:null,nextWorker:null,inputRequest:null,debugNote:null,nextDecision:'Reconcile existing provider outcomes only; no new production.',message:'Project abandoned. No new production will run.'};
 const halt=project.history?.findLast(h=>h.action==='debug-stop'&&h.sequence===project.sequence);
 if(halt?.action==='debug-stop')return {reporter:'Orchestrator (Producer)',stage:pending.step,stageLabel:label,gate:pending.gate,completion:null,nextWorker:null,inputRequest:null,debugNote:'Work is blocked after an error.',diagnostic:halt.message,nextDecision:'Inspect the saved failure and dispatch receipt before deciding whether repair or reconciliation is needed. Do not repeat an unknown request.',message:'STOP — Work is blocked after an error. Check the saved reason before continuing.'};
 const completion=lastResult(project);
 if(pending.gate==='escalate'&&completion?.blocker){
  const b=completion.blocker,reportedBy=workerLabel(completion.worker,pending.step);
  return {reporter:'Orchestrator (Producer)',stage:pending.step,stageLabel:label,gate:pending.gate,completion,nextWorker:null,inputRequest:null,debugNote:null,diagnostic:completion.diagnostic,alert:{severity:'stop',reportedBy,...b},nextDecision:b.solution,
   message:`STOP — ${label} is blocked. ${reportedBy??'The generation planner'} reported: ${b.problem}\n\n${b.solution}\n\n${b.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\nNo new generation was started.`};
 }
 const request=pending.step==='voiceSample'&&pending.gate==='human'&&!project.voiceChoice?.reuseWithoutSample?{
  kind:'voice-sample',minimumDurationSeconds:10,recommendedDurationSeconds:[20,30],formats:['wav','mp3','flac','ogg'],maxBytes:16*1024*1024,
  ...(runDir?{folder:join(runDir,'incoming-voice')}:{}),
  message:project.voiceChoice?'Add your original cloning recording, or a clean 20–30-second recording of yourself speaking naturally, to the voice-sample folder, then say “done”. We need your real voice to compare the generated voice sample; we will reuse the selected clone.':'Record 20–30 seconds of yourself speaking naturally, with only your voice and no background music. Add the recording to the voice-sample folder, then say “done”.',
  hostAction:'Run input-folder --open to prepare and show the folder. Import and measure the actual supplied recording; never invent a sample or consent.'
 }:null;
 const decisions={author:`${who??'The assigned author'} is next to write ${label.toLowerCase()}.`,review:`${who??'The independent reviewer'} is next to review this version. Nothing is locked by that review.`,
  'owner-review':`${who??'The background producer'} is next to check the prompt against the approved scene brief.`,
  human:request?.message??(pending.step==='roster'?'Confirm the proposed character references and rights; missing references stay unresolved.':['candidates','backgroundCandidates'].includes(pending.step)?'Review the passing options and pick one.':'Review this version, then approve or ask for changes.'),
  produce:project.step==='film'?'The approved edit is ready for the official local render.':pending.job?.status==='authorized'?'The exact authorized request is ready for submission.':`${who??'The generation planner'} is next to prepare the exact request and cost estimate. No new generation was started.`,
  authorize:'Approve the exact request and its spend before generation.',collect:pending.job?.status==='authorized'?'The exact authorized request is ready for submission.':['collect-existing','confirmed-completed'].includes(pending.job?.reconciliation?.outcome)?'Collect the existing request; do not submit a replacement.':['submitting','uncertain'].includes(pending.job?.status)?'The submission outcome is not confirmed. Inspect or reconcile the original request; do not repeat it.':'Collect the recorded request; do not submit it again.',escalate:'We need the missing information or a decision about the reported problem before continuing.',pending:project.step==='complete'?'Your final approved film is ready.':'Follow the saved resume instruction.'};
 if(pending.gate==='human'&&['audition','narration'].includes(pending.step)&&!current(project,'voiceSample')&&project.voiceChoice?.reuseWithoutSample)decisions.human='Listen and confirm this sounds like your voice, then approve or ask for changes.';
 if(pending.step==='voiceSample'&&project.voiceChoice?.reuseWithoutSample)decisions.human='Verify the selected existing clone before creating a short sample using your cloned voice. No new recording is required.';
 const needsContinuation=paused&&(['author','review','owner-review','produce'].includes(pending.gate)||pending.gate==='collect'&&pending.job?.status==='authorized');
 if(project.voiceChoice&&pending.step==='clone'&&!project.voiceChoice.lookup)decisions.escalate='Verify the selected Cartesia voice with verify-voice before creating a short sample using your cloned voice. No replacement clone is allowed.';
 const nextDecision=needsContinuation?`Inspect the last output, then say “continue” to release one ${who??'runtime'} step. This approves nothing.`:decisions[pending.gate];
 const workerStatus=who&&['author','review','owner-review','produce'].includes(pending.gate)&&pending.job?.status!=='authorized'?{worker:pending.crewWorker,label:who,status:paused?'waiting-for-debug-continuation':'ready-for-dispatch'}:null;
 const lockedScript=pending.step==='voiceSample'&&current(project,'script')?.approvedBy;
 const result=completion?.message??(lockedScript?'Story and cast locked by your approval.':`Current stage: ${label.toLowerCase()}.`);
 const debugNote=needsContinuation?'Waiting for you to inspect the last result before the next step.':null;
 const voice=project.voiceChoice,voiceMessage=voice&&['voiceSample','clone','audition'].includes(pending.step)?` ${voice.name} is selected${voice.lookup?' and verified as active and owned by your account':'; account verification is still required'}. You will hear a short sample before approving the voice.${voice.reuseWithoutSample?' No new recording is required.':''}`:'';
 return {reporter:'Orchestrator (Producer)',stage:pending.step,stageLabel:label,gate:pending.gate,completion,nextWorker:workerStatus,inputRequest:request,debugNote,nextDecision,
  ...(completion?.diagnostic?{diagnostic:completion.diagnostic}:{}),
  ...(voice?{voiceChoice:{voiceId:voice.voiceId,name:voice.name,verified:!!voice.lookup,access:voice.lookup?.access??null}}:{}),
  message:`${pending.gate==='escalate'?'STOP — ':''}${result}${voiceMessage} ${request?request.message:decisions[pending.gate]}${needsContinuation?' Waiting for your debug check: inspect the last result, then say “continue” for the next step.':''}`};
}
