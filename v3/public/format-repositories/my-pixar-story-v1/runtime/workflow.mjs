import {loadStudio,studioFor,limitsFor,recipeFor,workerInstructions,communicationFor,legacyGeneration} from './instructions.mjs';
import {legacyInstruction} from './legacy-instructions.mjs';
import {assertDebugReady} from './debug.mjs';
import {spendSummary,requireBudget} from './budget.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { Annotation, Command, START, StateGraph, interrupt } from '@langchain/langgraph';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import {Crew,roleFor,assignedWorker,assertCrewEvent} from './crew.mjs';
import {requireAudioQualification} from '../evaluation/audio-qualification.mjs';
import { studioSteps, studioDependencies, studioNext, validateStudioContent, videoBinding, effectFor } from './studio.mjs';
import { requireVisualQualification } from '../evaluation/visual-qualification.mjs';
import { shotFor, shotReferences, referenceBindings, planningReferences, validateShots, validateLocationRegistry, validateKeyframePrompt } from './shots.mjs';
import { requestDescriptor,planningAccountGuide,generationEstimate } from './providers.mjs';
import {scriptQuoteChecks,transcriptDiff} from './evaluators.mjs';
import {AudioEditReceipt,AUDIO_EDIT_PROFILE,validateAudioEdit,validateEditingInvestigation} from './audio-edit.mjs';
import { VERSION, Inputs, Project, Content, Review, Event, Plans, IntakeConfirmation, VoiceChoiceInput, VoiceLookup, criteria, digest } from './contracts.mjs';

import { keyFor, current, locked, audioLocked, assertAllowed, backgroundSteps, imageSteps, authorSteps, supervised, reviewPassed, refinedWorkflow, miniProduction, voiceBasis } from './gates.mjs';
export { keyFor, current, locked, audioLocked, assertAllowed, voiceBasis } from './gates.mjs';
const characterRecipe=readFileSync(new URL('../character-sheet-recipe.md',import.meta.url),'utf8');
export const characterRecipeSha256=createHash('sha256').update(characterRecipe).digest('hex');
export const backgroundRecipe = readFileSync(new URL('../background-prompter.md', import.meta.url), 'utf8');
export const backgroundRecipeSha256 = createHash('sha256').update(backgroundRecipe).digest('hex');
const characterPromptRecipe=readFileSync(new URL('../character-prompter.md',import.meta.url),'utf8');
export const characterPromptRecipeSha256=createHash('sha256').update(characterPromptRecipe).digest('hex');
const effectiveInputs=p=>current(p,'answers')?.content.inputs??p.inputs;
const questionnaire=JSON.parse(readFileSync(new URL('../questionnaire.json',import.meta.url),'utf8'));
const location = p => current(p, 'backgrounds')?.content.locations.find(l => l.id === p.locationId);
const briefKey = p => `${p.step === 'backgroundAnglePrompt' ? 'backgroundAngleBrief' : 'backgroundBrief'}:${p.locationId}${p.step === 'backgroundAnglePrompt' ? ':' + p.angleId : ''}`;
const promptKey = p => `${p.step === 'backgroundAngle' ? 'backgroundAnglePrompt' : 'backgroundPrompt'}:${p.locationId}${p.step === 'backgroundAngle' ? ':' + p.angleId : ''}`;
const isPrompt = p => ['backgroundPrompt', 'backgroundAnglePrompt'].includes(p.step);
const audioEditingEnabled=p=>studioFor(p)?.config.agents['film-editor'].tools.includes('renderAudioEdit');
export function initialProject(id, inputs, options = {}) {
  const workflowRevision=options.workflowRevision ?? (options.reviewMode==='qualified'?2:4),studio=options.studio??loadStudio();
  return Project.parse({ formatVersion: VERSION, schemaVersion: 2, studio, workflowRevision, productionProfile:options.productionProfile??studio.config.generation.video.profile, id, reviewMode:options.reviewMode ?? 'supervised', budget:{maxCostUsd:studio.config.limits.initialSpendCeilingUsd,reservations:[]}, inputs: Inputs.parse(inputs), step: workflowRevision>=3?'answers':'script', gate: 'author', characterId: null,
    sequence: 0, artifacts: [], jobs: [], history: [], allowances: [], feedback: [], reviewDisagreements: 0 });
}
function invalidate(p, id) {
  const affected = new Set([id]);
  for (const a of p.artifacts) if (a.dependencies.some(dep => affected.has(dep))) affected.add(a.id);
  for (const a of p.artifacts) if (affected.has(a.id)) a.valid = false;
  return [...affected];
}
function revisionRoot(p, a) {
  if(a.kind==='film')return current(p,'editPlan')??a;
  if (a.kind === 'video') return current(p, a.key.replace('video:', 'videoPrompt:')) ?? a;
  if (a.kind === 'keyframe') return current(p, a.key.replace('keyframe:', 'keyframePrompt:')) ?? a;
  if (!['backgroundCandidates', 'backgroundAngle'].includes(a.kind)) return a;
  const key = a.key.replace(a.kind, a.kind === 'backgroundCandidates' ? 'backgroundBrief' : 'backgroundAngleBrief');
  return current(p, key) ?? a;
}
export function revisionImpact(p, id) {
  const copy = structuredClone(p);
  if (!copy.artifacts.some(a => a.id === id && a.valid)) throw new Error('Artifact is stale or unknown.');
  const affected = invalidate(copy, revisionRoot(copy, copy.artifacts.find(a => a.id === id)).id);
  const impact={artifactId:id,artifactDigest:copy.artifacts.find(a=>a.id===id).digest,sequence:p.sequence,affected,remainValid:copy.artifacts.filter(a=>a.valid).map(a=>a.id)};
  return {...impact,impactDigest:digest(impact),rerunEstimate:{known:false,reason:'New scoped request plans and account estimates are required; prior costs do not promise rerun prices or times.'},note:'Reopened approvals apply only to the listed dependencies; redo preserves facts/history and does not reset budget or attempt caps.'};
}
export function dependencies(p) {
  const keys = studioDependencies(p) ?? {
    answers: [], script: refinedWorkflow(p)?['answers']:[], voiceSample: [], clone: p.voiceChoice?.reuseWithoutSample&&!current(p,'voiceSample')?[]:['voiceSample'], audioReviewerQualification: [], audition: ['clone', 'script','audioReviewerQualification'],
    narration: ['script', 'clone', 'audition','audioReviewerQualification'], roster: p.workflowRevision>=4?['script','narration']:['script'],
    characterPrompt:['roster','script'], candidates: refinedWorkflow(p)?['roster',`characterPrompt:${p.characterId}`]:['roster'], sheetPrompt: [`candidates:${p.characterId}`],
    shotIntentions:['script','narration','roster',...(current(p,'roster')?.content.characters??[]).map(c=>`sheet:${c.id}`)],
    sheet: [`candidates:${p.characterId}`, `sheetPrompt:${p.characterId}`], backgrounds: [...(supervised(p)?['shotIntentions']:[]),'script', 'narration', 'roster', ...(current(p, 'roster')?.content.characters ?? []).map(c => `sheet:${c.id}`)],
    backgroundBrief: ['backgrounds'], backgroundPrompt: [`backgroundBrief:${p.locationId}`],
    backgroundCandidates: [`backgroundPrompt:${p.locationId}`],
    backgroundAngleBrief: ['backgrounds', `backgroundCandidates:${p.locationId}`],
    backgroundAnglePrompt: [`backgroundAngleBrief:${p.locationId}:${p.angleId}`, `backgroundCandidates:${p.locationId}`],
    backgroundAngle: [`backgroundAnglePrompt:${p.locationId}:${p.angleId}`, `backgroundCandidates:${p.locationId}`], shots: [...(supervised(p)?['shotIntentions']:[]),'backgrounds', 'script', 'narration'],
    keyframePrompt: ['shots', ...(['keyframePrompt', 'keyframe'].includes(p.step) ? shotReferences(p).map(r => p.artifacts.find(a => a.id === r.artifactId).key) : [])],
    keyframe: ['shots', `keyframePrompt:${p.shotId}`, ...(['keyframePrompt', 'keyframe'].includes(p.step) ? shotReferences(p).map(r => p.artifacts.find(a => a.id === r.artifactId).key) : [])],
  }[p.step];
  return keys.filter(key=>!supervised(p)||!['audioReviewerQualification','reviewerQualification'].includes(key)).map(key => { const a = current(p, key); if (!a) throw new Error(`Missing current dependency ${key}`); return a.id; });
}
function next(p) {
  p.reviewDisagreements = 0;
  if(studioNext(p)){const reusable=locked(p,keyFor(p));if(p.step!=='complete'&&reusable)next(p);return;}
  const steps = ['answers','script', 'voiceSample', 'clone', 'audioReviewerQualification', 'audition', 'narration', 'roster'];
  const i = steps.indexOf(p.step);
  if (i >= 0 && i < steps.length - 1) p.step = steps[i + 1];
  else if (p.step === 'roster') { p.characterId = current(p, 'roster').content.characters[0].id; p.step = refinedWorkflow(p)?'characterPrompt':'candidates'; }
  else if (p.step === 'characterPrompt') p.step='candidates';
  else if (p.step === 'candidates') p.step = 'sheetPrompt';
  else if (p.step === 'sheetPrompt') p.step = 'sheet';
  else if (p.step === 'sheet') {
    const missing = current(p, 'roster').content.characters.find(c => !locked(p, `sheet:${c.id}`));
    p.characterId = missing?.id ?? null;
    p.step = missing ? (refinedWorkflow(p)?'characterPrompt':'candidates') : supervised(p)?'shotIntentions':'backgrounds';
  }
  else if(p.step==='shotIntentions')p.step='backgrounds';
  else if (p.step === 'backgrounds') { p.locationId = current(p, 'backgrounds').content.locations[0].id; p.angleId = null; p.step = 'backgroundBrief'; }
  else if (p.step === 'backgroundBrief') p.step = 'backgroundPrompt';
  else if (p.step === 'backgroundPrompt') p.step = 'backgroundCandidates';
  else if (p.step === 'backgroundAngleBrief') p.step = 'backgroundAnglePrompt';
  else if (p.step === 'backgroundAnglePrompt') p.step = 'backgroundAngle';
  else if (['backgroundCandidates', 'backgroundAngle'].includes(p.step)) {
    const angle = location(p).angles.find(a => !locked(p, `backgroundAngle:${p.locationId}:${a.id}`));
    if (angle) { p.angleId = angle.id; p.step = 'backgroundAngleBrief'; }
    else {
      const missing = current(p, 'backgrounds').content.locations.find(l => !locked(p, `backgroundCandidates:${l.id}`) || l.angles.some(a => !locked(p, `backgroundAngle:${l.id}:${a.id}`)));
      p.locationId = missing?.id ?? null; p.angleId = null; p.step = missing ? 'backgroundBrief' : 'shots';
    }
  }
  else if (p.step === 'shots') { p.shotId = current(p, 'shots').content.shots[0].id; p.step = 'keyframePrompt'; }
  else if (p.step === 'keyframePrompt') p.step = 'keyframe';
  else if (p.step === 'keyframe') { const missing = current(p, 'shots').content.shots.find(s => !locked(p, `keyframe:${s.id}`)); p.shotId = missing?.id ?? null; p.step = missing ? 'keyframePrompt' : supervised(p)?'videoPlan':'reviewerQualification'; }
  if(p.step==='voiceSample'&&p.voiceChoice?.reuseWithoutSample&&current(p,'clone'))p.step='clone';
  if(supervised(p)&&p.step==='audioReviewerQualification')p.step='audition';
  p.gate = authorSteps.includes(p.step) ? 'author' : p.step === 'voiceSample' ? 'human' : p.step === 'complete' ? 'pending' : 'produce';
  // Reopening a deliverable keeps unrelated locks; do not force their regeneration.
  const reusable = ['voiceSample', 'clone'].includes(p.step) ? !!current(p) : p.step === 'sheetPrompt' && !supervised(p) ? current(p)?.review?.decision === 'approved' : locked(p, keyFor(p));
  if (p.step !== 'complete' && reusable) next(p);
}
function addArtifact(p, content, author) {
  if (['script','characterPrompt'].includes(p.step) || studioSteps.includes(p.step) || backgroundSteps.includes(p.step) || ['backgrounds', 'shotIntentions', 'shots', 'keyframePrompt', 'keyframe'].includes(p.step)) assertAllowed(p, p.step);
  const key = keyFor(p);
  const previous=current(p);
  for (const a of p.artifacts.filter(a => a.key === key && a.valid)) invalidate(p, a.id);
  const version = p.artifacts.filter(a => a.key === key).length + 1;
  const parsed = Content[p.step].parse(content);
  if(p.step==='clone'&&p.voiceChoice){
    const choice=p.voiceChoice,expected={kind:'existing',lookup:choice.lookup,selectionMessage:choice.selectedBy.message,consentMessage:choice.consentMessage};
    if(!choice.lookup||parsed.voiceId!==choice.voiceId||parsed.receiptId!==`voice-lookup:${digest(choice.lookup)}`||digest(parsed.origin??null)!==digest(expected))throw new Error('EXISTING_VOICE_MISMATCH: imported clone must bind the selected verified voice and lookup provenance.');
  }else if(p.step==='clone'&&parsed.origin)throw new Error('EXISTING_VOICE_MISMATCH: no verified human voice selection.');
  if (p.step === 'voiceSample' && (parsed.files[0].bytes > 16 * 1024 * 1024 || !['.wav', '.mp3', '.flac', '.ogg'].includes(extname(parsed.files[0].path).toLowerCase()))) throw new Error('Cartesia sample must be WAV/MP3/FLAC/OGG under 16 MB. Convert it locally without changing tempo before submission.');
  if(p.step==='answers'){
    if(parsed.inputs.subject.fullName!==p.inputs.subject.fullName)throw new Error('STORYTELLER_CHANGE_REQUIRES_NEW_PROJECT: preserve the original storyteller identity; a different storyteller needs a fresh sample/clone and project.');
    if(parsed.sourceInputDigest!==digest(p.inputs))throw new Error('ANSWER_SOURCE_MISMATCH: bind the immutable original questionnaire.');
    if(digest(parsed.inputs)!==digest(p.inputs)&&!p.feedback.some(f=>f.key==='answers'&&f.intent&&f.message))throw new Error('ANSWER_CLARIFICATION_REQUIRED: changed answers require recorded human feedback before independent review and human confirmation.');
  }
  if(p.step==='script'&&p.studio?.config.writingPolicy==='grounded-v1'){const quoted=scriptQuoteChecks(parsed,effectiveInputs(p));if(quoted.status==='fail')throw new Error(`QUOTATION_BINDING_REQUIRED: ${quoted.evidence} ${quoted.repair}`);}
  if(p.workflowRevision>=4&&p.step==='script'&&!parsed.proposedCast)throw new Error('SCRIPT_CAST_PROPOSAL_REQUIRED: the writer must propose the necessary on-screen people and age variants, with a story purpose.');
  if(p.step==='characterPrompt'){
    const cast=current(p,'roster').content.characters.find(c=>c.id===p.characterId);
    if(!locked(p,'roster')||parsed.characterDigest!==digest(cast)||digest(parsed.referenceHashes)!==digest(cast.references.map(f=>f.sha256))||parsed.recipeSha256!==recipeFor(p,'characterPrompt',{sha256:characterPromptRecipeSha256}).sha256)throw new Error('CHARACTER_PROMPT_BINDING_REQUIRED: bind the exact approved cast, ordered photos and packaged recipe.');
  }
  if(refinedWorkflow(p)&&p.step==='candidates'&&parsed.prompt!==current(p,`characterPrompt:${p.characterId}`).content.prompt)throw new Error('Candidates must use the human-approved character prompt exactly.');
  if (p.step === 'voiceSample' && (!parsed.files[0].durationSeconds || parsed.files[0].durationSeconds < 10)) throw new Error('Voice sample must contain at least 10 seconds of measured audio.');
  if (p.step === 'audition' && (parsed.voiceId !== current(p, 'clone').content.voiceId || parsed.transcript !== current(p, 'script').content.beats[0].narration)) throw new Error('Audition must use the current clone and locked narration.');
  if (p.step === 'narration') {
    if(p.gate==='author'){
      if(!audioEditingEnabled(p)||!previous||previous.approvedBy||previous.review?.decision!=='rejected'||author!==assignedWorker(p)?.workerId&&p.crew)throw new Error('AUDIO_EDIT_SCOPE_DENIED');
      if(p.artifacts.filter(a=>a.kind==='narration'&&a.content.audioEdits).length>=limitsFor(p).generationAttempts)throw new Error('AUDIO_EDIT_ATTEMPT_LIMIT');
      if(!parsed.audioEdits||parsed.voiceId!==previous.content.voiceId||parsed.model!==previous.content.model||digest(parsed.transcripts)!==digest(previous.content.transcripts))throw new Error('AUDIO_EDIT_SOURCE_BINDING_REQUIRED: preserve clone, generation model and locked text.');
      const edits=parsed.audioEdits.map(e=>AudioEditReceipt.parse(e));
      if(new Set(edits.map(e=>e.beat)).size!==edits.length)throw new Error('AUDIO_EDIT_SOURCE_BINDING_REQUIRED');
      let changes=0;
      for(let i=0;i<4;i++){
        const edit=edits.find(e=>e.beat===i+1),changed=parsed.files[i].sha256!==previous.content.files[i].sha256;
        if(!changed){if(digest(parsed.files[i])!==digest(previous.content.files[i])||digest(parsed.sourceFiles?.[i])!==digest(previous.content.sourceFiles?.[i])||parsed.tailSilenceSeconds?.[i]!==previous.content.tailSilenceSeconds?.[i]||edit&&digest(edit)!==digest(previous.content.audioEdits?.find(e=>e.beat===i+1)))throw new Error('AUDIO_EDIT_UNCHANGED_BEAT_MISMATCH');continue;}
        changes++;
        if(!edit||edit.parentArtifactId!==previous.id||edit.parentArtifactDigest!==previous.digest||digest(edit.sourceFile)!==digest(previous.content.files[i])||digest(edit.outputFile)!==digest(parsed.files[i])||digest(edit.editedFile)!==digest(parsed.sourceFiles?.[i])||edit.tailSilenceSeconds!==parsed.tailSilenceSeconds?.[i])throw new Error('AUDIO_EDIT_SOURCE_BINDING_REQUIRED');
        const {retainedSeconds}=validateAudioEdit(edit.sourceFile,edit.plan);
        const expected=digest({profile:AUDIO_EDIT_PROFILE,taskId:taskFor(p).taskId,workerId:author,artifactId:previous.id,artifactDigest:previous.digest,sourceSha256:edit.sourceFile.sha256,plan:edit.plan});
        if(edit.editDigest!==expected||Math.abs(edit.editedFile.durationSeconds-retainedSeconds)>.001||edit.outputFile.durationSeconds!==15)throw new Error('AUDIO_EDIT_RENDER_MISMATCH');
      }
      if(!changes)throw new Error('AUDIO_EDIT_NO_CHANGE');
    }else if(parsed.audioEdits)throw new Error('AUDIO_EDIT_SCOPE_DENIED: provider receipts cannot impersonate an editor.');
    if(refinedWorkflow(p)){
      if(!parsed.sourceFiles||!parsed.tailSilenceSeconds)throw new Error('NARRATION_WINDOW_PROVENANCE_REQUIRED: bind unmodified source stems and explicit silence-only holds.');
      for(const [i,f] of parsed.files.entries()){const source=parsed.sourceFiles[i],hold=parsed.tailSilenceSeconds[i];if(!source.durationSeconds||source.width||f.width||Math.abs(hold-Math.max(0,15-source.durationSeconds))>1e-6||(source.durationSeconds<=15&&f.durationSeconds!==15)||(source.durationSeconds>=15&&f.sha256!==source.sha256))throw new Error('NARRATION_WINDOW_MISMATCH: pad shorter sources only; longer sources require evidenced local editing or explicit script repair.');}
    }
    if (parsed.voiceId !== current(p, 'clone').content.voiceId) throw new Error('Narration must use the current clone.');
    if (parsed.files.some(f => !f.durationSeconds)) throw new Error('Narration needs measured durations.');
    if (parsed.transcripts.some((t, i) => t !== current(p, 'script').content.beats[i].narration)) throw new Error('Generated narration transcripts must equal locked script text.');
  }
  if (p.step === 'roster' && parsed.characters.some(c => c.references.some(f => !f.width || !f.height || f.durationSeconds))) throw new Error('Character references must be measured still images.');
  if(p.step==='roster'){
   if(!supervised(p)&&parsed.characters.some(c=>!c.references.length))throw new Error('Character photo references required in qualified mode.');
   if(supervised(p)&&p.workflowRevision<4){
    const inventory=current(p,'script').intakeConfirmation.characters.filter(c=>c.likeness!=='omit');
    if(inventory.length!==parsed.characters.length||inventory.some(c=>!parsed.characters.some(x=>x.id===c.id&&x.name===c.name&&x.ageVariant===c.ageVariant&&digest(x.references)===digest(c.references))))throw new Error('INTAKE_ROSTER_MISMATCH: cast/age/reference inventory must match the human-confirmed script intake; revise the script to change it.');
    for(const c of parsed.characters){const i=inventory.find(i=>i.id===c.id);if(i.likeness==='interpreted'&&!c.notes.includes(i.decisionNotes))throw new Error('INTERPRETED_LIKENESS_REQUIRED: preserve the human-approved uncertainty/interpretation in character notes.');}
   }
  }

  if (imageSteps.includes(p.step) && parsed.files.some(f => !f.width || !f.height || f.durationSeconds)) throw new Error('Character generations must contain measured still images.');
  if (p.step === 'sheetPrompt') {
    const candidate = current(p, `candidates:${p.characterId}`);
    if(parsed.recipeSha256!==recipeFor(p,'sheetPrompt',{sha256:characterRecipeSha256}).sha256)throw new Error('Sheet prompt must bind the packaged character sheet recipe hash.');
    if (parsed.referenceSha256 !== candidate.content.files[candidate.selection].sha256) throw new Error('Sheet prompt must bind the actual selected character image.');
  }
  if (p.step === 'sheet' && parsed.prompt !== current(p, `sheetPrompt:${p.characterId}`).content.prompt) throw new Error('Sheet must use the reviewed prompt exactly.');
  if(p.step==='shotIntentions'){validateLocationRegistry(p,parsed.locations);validateShots(p,parsed,true);}
  if(p.step==='backgrounds'){
    validateLocationRegistry(p,parsed.locations);
    if(supervised(p)&&digest(parsed.locations)!==digest(current(p,'shotIntentions').content.locations))throw new Error('Background registry must derive exactly from the approved shot intentions; revise intentions to change scene/angle requirements.');
  }
  if (['backgroundBrief', 'backgroundAngleBrief'].includes(p.step)) {
    const allowed = p.step === 'backgroundAngleBrief' ? location(p).angles.find(a => a.id === p.angleId).sceneIds : location(p).scenes.map(s => s.id);
    if (new Set(parsed.sceneIds).size !== parsed.sceneIds.length || allowed.some(id => !parsed.sceneIds.includes(id)) || parsed.sceneIds.some(id => !allowed.includes(id))) throw new Error('Brief must cover exactly its immediate scenes.');
    if (parsed.references.some(f => !f.width || !f.height || f.durationSeconds)) throw new Error('Background references must be measured still images.');
  }
  if (isPrompt(p)) {
    const brief = current(p, briefKey(p));
    if (!locked(p, brief.key) || author === brief.authoredBy || parsed.briefDigest !== brief.digest || parsed.recipeSha256 !== recipeFor(p,p.step,{sha256:backgroundRecipeSha256}).sha256) throw new Error('Prompter must be distinct from owner and bind the approved brief and packaged Pixar recipe.');
  }
  if (['backgroundCandidates', 'backgroundAngle'].includes(p.step) && parsed.files.some(f => Math.abs(f.width / f.height - 16 / 9) > 0.03)) throw new Error('Background plates must be measured 16:9 widescreen.');
  if (['backgroundCandidates', 'backgroundAngle'].includes(p.step) && parsed.prompt !== current(p, promptKey(p)).content.prompt) throw new Error('Background must use the approved prompt exactly.');
  if (p.step === 'shots') validateShots(p, parsed);
  if (p.step === 'keyframePrompt') validateKeyframePrompt(p, parsed);
  if (p.step === 'keyframe' && (parsed.prompt !== current(p, `keyframePrompt:${p.shotId}`).content.prompt || parsed.files.some(f => Math.abs(f.width / f.height - 16 / 9) > 0.03 || f.width < 1280 || f.height < 720))) throw new Error('Keyframe must use the approved prompt and measured 16:9 production image (at least 1280×720).');
  if(p.step==='audioReviewerQualification')requireAudioQualification(parsed);
  if(studioSteps.includes(p.step))validateStudioContent(p,parsed);
  const a = { id: `${key}@${version}`, key, kind: p.step, version, digest: digest(parsed), content: parsed,
    dependencies: dependencies(p), valid: true, authoredBy: author };
  p.artifacts.push(a);
  if (p.step === 'voiceSample' || p.step === 'clone') next(p);
  else p.gate = isPrompt(p) ? 'owner-review' : 'review';
  importExistingVoice(p);
}
function importExistingVoice(p){
  if(p.step==='voiceSample'&&p.voiceChoice?.reuseWithoutSample&&p.voiceChoice.lookup){p.step='clone';p.gate='produce';}
  if(p.step!=='clone'||!p.voiceChoice)return;
  if(!p.voiceChoice.lookup){p.gate='escalate';return;}
  if(!p.voiceChoice.reuseWithoutSample&&!current(p,'voiceSample')?.content.consent)throw new Error('Existing voice still requires a genuine consented reference sample.');
  const choice=p.voiceChoice;
  addArtifact(p,{voiceId:choice.voiceId,provider:'cartesia',receiptId:`voice-lookup:${digest(choice.lookup)}`,origin:{kind:'existing',lookup:choice.lookup,selectionMessage:choice.selectedBy.message,consentMessage:choice.consentMessage}},'provider-runtime');
}
// Derived from persisted review history; no second notification or approval state.
export function repairNotices(p){
 return p.artifacts.filter(a=>a.content.files&&a.review?.decision==='rejected').map(a=>({
  noticeId:`${a.id}:review:${a.reviewSequence}`,artifactId:a.id,artifactDigest:a.digest,key:a.key,
  files:a.content.files.map(f=>({sha256:f.sha256})),
  findings:a.review.checks.filter(c=>c.status==='fail').map(c=>({criterion:c.criterion,location:c.location,evidence:c.evidence,repair:c.repair})),
  status:p.artifacts.some(b=>b.key===a.key&&b.valid&&b.approvedBy&&b.reviewSequence>a.reviewSequence)?'repaired-and-approved':'repair-pending',
  instruction:'Report these observed defects and repair status to the human. Never present the failed media as an approval-ready deliverable. Use noticeId to avoid repeating unchanged notices; reviewer supplies notes, orchestrator routes repairs. Every new Mini video request needs fresh exact human approval.'
 }));
}
const generationScope=p=>current(p,p.step==='candidates'?'roster':p.step==='sheet'?`candidates:${p.characterId}`:p.step==='backgroundCandidates'?`backgroundBrief:${p.locationId}`:p.step==='backgroundAngle'?`backgroundAngleBrief:${p.locationId}:${p.angleId}`:p.step==='keyframe'?'shots':'videoPlan').id;
function hasDependency(p,ids,target){
 const queue=[...ids],seen=new Set();while(queue.length){const id=queue.pop();if(id===target)return true;if(seen.has(id))continue;seen.add(id);queue.push(...(p.artifacts.find(a=>a.id===id)?.dependencies??[]));}return false;
}
export function taskFor(p) {
  const a = current(p), loaded=workerInstructions(p,roleFor(p));
  const shot = ['keyframePrompt', 'keyframe'].includes(p.step) ? shotFor(p) : ['videoPrompt','video'].includes(p.step)?videoBinding(p).shot:null;
  const sceneLocation = shot ? current(p, 'backgrounds').content.locations.find(l => l.id === shot.locationId) : location(p);
  const job = p.jobs.findLast(j => j.key === keyFor(p) && !['ready', 'failed'].includes(j.status));
  return { ...loaded, communication:communicationFor(p),studioConfig:studioFor(p)?.config??null,taskId: digest({ id: p.id, sequence: p.sequence, step: p.step, gate: p.gate }), projectId: p.id,
    reviewPolicy:{mode:p.reviewMode,qualificationRequired:!supervised(p),humanMediaConfirmationRequired:supervised(p),speakerMeasurementRequired:!supervised(p),automaticVideoRepairAllowed:!supervised(p)&&!miniProduction(p)},
    lifecycle:p.lifecycle,budget:spendSummary(p),
    productionProfile:p.productionProfile,repairNotices:repairNotices(p),workflowRevision:p.workflowRevision, step: p.step, gate: p.gate, clipId:p.clipId,effectId:p.effectId, characterId: p.characterId, locationId: p.locationId, angleId: p.angleId, shotId: p.shotId,
    shot,
    ...(backgroundSteps.includes(p.step)?{locationEntry:sceneLocation,characterReferences:(current(p,'roster')?.content.characters??[]).filter(c=>sceneLocation?.scenes.some(scene=>scene.characterIds.includes(c.id))).map(c=>{const sheet=current(p,`sheet:${c.id}`);return {characterId:c.id,name:c.name,ageVariant:c.ageVariant,artifactId:sheet.id,file:sheet.content.files[0]};})}:{}),
    ...(['videoPlan','videoPrompt','video'].includes(p.step)?{narration:current(p,'narration')}:{}),
    ...(['videoPlan','film'].includes(p.step)?{visualReferences:current(p,'shots').content.shots.map(shot=>({shot,keyframe:current(p,`keyframe:${shot.id}`),references:shotReferences(p,shot)}))}:{}),
    shotIntentions:current(p,'shotIntentions')??null,
    ...(p.step === 'shots' ? { availableLocations: planningReferences(p) } : {}),
    ...(['keyframePrompt', 'keyframe'].includes(p.step) ? { references: shotReferences(p), referenceBindings: referenceBindings(p), shotDigest: digest(shotFor(p)) } : {}),
    crewWorker:assignedWorker(p)??null, formatRole:roleFor(p),
    planningGuide:p.gate==='produce'&&p.step!=='film'?planningAccountGuide(p):null,
    generationEstimate:p.gate==='produce'?generationEstimate(p):null,
    generationTexts:['audition','narration'].includes(p.step)?{scriptId:current(p,'script').id,scriptDigest:current(p,'script').digest,beats:current(p,'script').content.beats.slice(0,p.step==='audition'?1:4).map(b=>({beat:b.beat,text:b.narration}))}:null,
    voiceReference:['audio-reviewer','film-editor'].includes(roleFor(p))?current(p,'voiceSample')??null:null,voiceChoice:p.voiceChoice??null,voiceBasis:voiceBasis(p),
    role: p.gate === 'review' ? 'independent-reviewer' : p.gate==='author'&&p.step==='videoPlan'?'motion-director':p.gate==='author'&&p.step==='videoPrompt'?'video-prompt-engineer':p.gate==='author'&&p.step==='soundPlan'?'sound-designer':p.gate==='author'&&p.step==='editPlan'?'film-editor': p.gate === 'author' && ['shotIntentions','shots'].includes(p.step) ? 'shot-planner' : p.gate === 'author' && p.step === 'keyframePrompt' ? 'composition-writer' : p.gate === 'owner-review' || ['backgrounds', 'backgroundBrief', 'backgroundAngleBrief'].includes(p.step) ? 'background-product-owner' : isPrompt(p) && p.gate === 'author' ? 'pixar-prompter' : 'orchestrator',
    immediateScenes: sceneLocation?.scenes.filter(s => shot ? s.id === shot.sceneId : !p.angleId || sceneLocation.angles.find(a => a.id === p.angleId)?.sceneIds.includes(s.id)) ?? [],
    lockedAnswers:current(p,'answers')??null,
    ...(p.step==='answers'?{questionnaire,sourceInputs:p.inputs,sourceInputDigest:digest(p.inputs),originalInputsRequired:!p.feedback.some(f=>f.key==='answers'&&f.intent&&f.message)}:{}),
    ...(['characterPrompt','candidates','sheetPrompt','sheet'].includes(p.step)?{castEntry:current(p,'roster')?.content.characters.find(c=>c.id===p.characterId)}:{}),
    approvedScript: current(p, 'script') ?? null, inputPriority: ['characterPrompt','candidates','sheetPrompt','sheet'].includes(p.step)?['approvedScript','castEntry','castEntry.references','inputs.answers']:['immediateScenes', 'approvedScript', 'inputs.answers'],
    ...(p.step==='characterPrompt'?{recipe:recipeFor(p,'characterPrompt',{content:characterPromptRecipe,sha256:characterPromptRecipeSha256})}:{}),
    ...(p.step==='sheetPrompt'?{recipe:recipeFor(p,'sheetPrompt',{content:characterRecipe,sha256:characterRecipeSha256})}:{}),
    ...(isPrompt(p) ? { recipe: recipeFor(p,p.step,{content:backgroundRecipe,sha256:backgroundRecipeSha256}), ownerWorkerId: current(p, briefKey(p))?.authoredBy } : {}),
    ...(p.step==='videoPrompt'||p.step==='video'?{videoBinding:videoBinding(p)}:{}),
    ...(p.step==='music'?{soundDirection:current(p,'soundPlan').content.music}:p.step==='effect'?{soundDirection:effectFor(p)}:{}),
    actor: p.gate === 'review' ? 'reviewer' : ['human', 'authorize', 'escalate'].includes(p.gate) ? 'human' : 'agent',
    proposedCast:current(p,'script')?.content.proposedCast??null, intakeConfirmation:current(p,'roster')?.intakeConfirmation??current(p,'script')?.intakeConfirmation??current(p,'answers')?.intakeConfirmation??null, artifact: a ?? null, job: job ?? null, inputs: effectiveInputs(p),
    dependencies: dependencies(p).map(id => p.artifacts.find(a => a.id === id)),
    creativeDirections:p.creativeDirections??[],
    feedback: p.feedback.filter(f => f.key === keyFor(p)), criteria: p.step==='film'&&p.gate==='review'?filmCriteria(p):criteria[p.step] ?? [],
    instruction: p.gate==='produce'&&p.step!=='film' ? `Prepare the assigned generation plan from the canonical task inputs. For audition, generationTexts contains the FIRST locked story beat; no separate audition text or approval is needed. For narration it contains all four locked beats. Use generationEstimate when supplied: it is a sourced conservative reservation, not verified account billing. Unknown credit balance, untested generation access, or a zero project budget do not block PLANNING. Return a plan; the runtime owns authorization, budget enforcement and submission. Do not demand a dashboard screenshot or admin key merely to plan. If a rate truly is unavailable and no generationEstimate is supplied, return planning-blocked using the canonical planningGuide. If essential inputs are missing, return missing-input with specific evidence and baby steps. Actual provider errors stop submission through the runtime, with no fallback or automatic retry. Never invent prices, provider receipts, approvals or a new recording requirement for an existing clone. Follow the attached skill for the remaining procedure.` : loaded && ['author','owner-review','review','produce'].includes(p.gate) ? `Follow the attached ${loaded.skill.path} for this ${p.step}/${p.gate} task and return only the assigned Event.` : legacyInstruction(p),
  };
}
function repairVisual(p, message) {
  if(miniProduction(p)&&['sheet','backgroundCandidates','backgroundAngle'].includes(p.step)){const step={sheet:'sheetPrompt',backgroundCandidates:'backgroundPrompt',backgroundAngle:'backgroundAnglePrompt'}[p.step],key=p.step==='sheet'?`${step}:${p.characterId}`:`${step}:${p.locationId}${p.step==='backgroundAngle'?':'+p.angleId:''}`,prompt=current(p,key);invalidate(p,prompt.id);p.feedback.push({key,message});p.step=step;p.gate='author';return;}
  if(p.step==='candidates'){const prompt=current(p,`characterPrompt:${p.characterId}`);invalidate(p,prompt.id);p.feedback.push({key:prompt.key,message});p.step='characterPrompt';p.gate='author';return;}
  const video=p.step==='video'; const prompt = current(p, video?`videoPrompt:${p.clipId}`:`keyframePrompt:${p.shotId}`); invalidate(p, prompt.id);
  p.feedback.push({ key: prompt.key, message });
  p.step = video?'videoPrompt':'keyframePrompt'; p.gate = 'author';
}
function reopen(p,a,message){
  invalidate(p,a.id);
    p.step = a.kind; const parts = a.key.split(':'); p.characterId = ['characterPrompt','candidates', 'sheetPrompt', 'sheet'].includes(a.kind) ? parts[1] : null; p.locationId = backgroundSteps.includes(a.kind) ? parts[1] : null; p.angleId = a.kind.startsWith('backgroundAngle') ? parts[2] : null; p.shotId = ['keyframePrompt', 'keyframe'].includes(a.kind) ? parts[1] : null; p.clipId=['videoPrompt','video'].includes(a.kind)?parts[1]:null;p.effectId=a.kind==='effect'?parts[1]:null;
    p.gate = authorSteps.includes(a.kind) || (a.kind==='music'&&current(p,'soundPlan').content.music.mode==='import') || (a.kind==='effect'&&effectFor(p).mode==='import') ? 'author' : a.kind === 'voiceSample' ? 'human' : 'produce';
    p.feedback.push({ key: a.key, message: message }); p.reviewDisagreements = 0;
}
export const filmVisualCriteria=['technical','story','visual-continuity','motion','safety','provenance'];
export const filmAudioCriteria=['narration','mix','safety','provenance'];
const filmCriteria=p=>reviewPassed(current(p)?.visualReview)?filmAudioCriteria:filmVisualCriteria;
const requiredActor = (e, actor) => { if (e.actor !== actor) throw new Error(`${e.action} requires ${actor} authority.`); };
export function applyEvent(project, raw) {
  const p = structuredClone(Project.parse(project));
  const e = Event.parse(raw);
  if (e.taskId !== taskFor(p).taskId) throw new Error('STALE_TASK: read current status before responding.');
  if(p.lifecycle==='abandoned'){
    if(!['note','reconcile'].includes(e.action))throw new Error('PROJECT_ABANDONED: no new production or approvals; reconcile saved provider outcomes only.');
    if(e.action==='reconcile'){requiredActor(e,'human');const job=p.jobs.find(j=>j.id===e.jobId);if(!job||job.digest!==e.artifactDigest||!e.message||!['confirmed-no-result','confirmed-unusable-result','confirmed-completed'].includes(e.result?.outcome))throw new Error('Abandoned reconciliation needs exact job, original human direction and confirmed outcome.');job.status=e.result.outcome==='confirmed-completed'?'ready':'failed';job.reconciliation={outcome:e.result.outcome,message:e.message,at:new Date().toISOString()};}
    else if(!e.message)throw new Error('Note needs text.');
    p.sequence++;p.history.push({sequence:p.sequence,action:e.action,actor:e.actor,message:e.message,at:new Date().toISOString()});return Project.parse(p);
  }
  if(p.crew)Crew.parse(p.crew);
  assertCrewEvent(p,e);
  const worker=['agent','reviewer'].includes(e.actor)?p.crew?.workers.find(w=>w.workerId===e.workerId):null;
  const submittedKey=keyFor(p);
  const activity={step:p.step,...(e.blocker?{blocker:e.blocker}:{}),...(e.audioInvestigation?{audioInvestigation:e.audioInvestigation,toolEvidence:e.toolEvidence}:{}),...(worker?{worker:{workerId:worker.workerId,name:worker.name,role:worker.role}}:{}),
    ...(e.artifactId?{artifactId:e.artifactId,artifactDigest:e.artifactDigest}:{}),...(e.jobId?{jobId:e.jobId}:{})};
  if(['configure-debug','debug-next','debug-stop'].includes(e.action)){
    requiredActor(e,e.action==='debug-stop'?'runtime':'human');if(!e.message)throw new Error('Debug control needs the human instruction or runtime diagnostic.');
    if(e.action==='configure-debug'){
      if(e.debugEnabled===undefined)throw new Error('Specify debugEnabled.');
      p.debug={enabled:e.debugEnabled,paused:e.debugEnabled};
    }else if(e.action==='debug-next'){
      if(!p.debug?.enabled||!p.debug.paused)throw new Error('DEBUG_NOT_PAUSED: enable debug mode and inspect a paused step first.');
      p.debug.paused=false;
    }else{
      if(!p.debug?.enabled)throw new Error('DEBUG_DISABLED');
      p.debug.paused=true;
    }
    // Operator controls do not change creative task IDs or invalidate recoverable receipts.
    p.history.push({sequence:p.sequence,action:e.action,actor:e.actor,message:e.message,at:new Date().toISOString()});
    return Project.parse(p);
  }
  if(['artifact','owner-review','review','plan','planning-blocked','begin','rendered','qualified','audio-qualified'].includes(e.action)&&!(e.action==='artifact'&&e.actor==='human'&&p.step==='voiceSample'&&p.gate==='human'))assertDebugReady(p);
  if(['reuse-voice','choose-voice','voice-verification-start','voice-verified'].includes(e.action)){
    if(!locked(p,'script')||!['voiceSample','clone'].includes(p.step)||!(p.step==='voiceSample'&&p.gate==='human'||p.step==='clone'&&['produce','escalate'].includes(p.gate))||p.jobs.length||current(p,'clone'))throw new Error('EXISTING_VOICE_LOCKED: select an existing voice only after script approval and before any provider jobs or clone binding.');
    if(e.action==='reuse-voice'){
      requiredActor(e,'human');if(!e.message||!p.voiceChoice?.lookup)throw new Error('EXISTING_VOICE_NOT_VERIFIED: explicit human reuse needs the saved authenticated lookup.');
      p.voiceChoice.reuseWithoutSample=true;importExistingVoice(p);
    }else if(e.action==='choose-voice'){
      requiredActor(e,'human');if(!e.message)throw new Error('Voice selection needs the actual human instruction.');
      p.voiceChoice={...VoiceChoiceInput.parse(e.content),selectedBy:{message:e.message,at:new Date().toISOString()}};
    }else if(e.action==='voice-verification-start'){
      requiredActor(e,'runtime');if(!p.voiceChoice)throw new Error('Select the actual human-provided voice first.');delete p.voiceChoice.lookup;
    }else{
      requiredActor(e,'runtime');const lookup=VoiceLookup.parse(e.content),choice=p.voiceChoice;
      if(!choice||lookup.voiceId!==choice.voiceId||lookup.name!==choice.name||lookup.apiVersion!==(studioFor(p)?.config.generation??legacyGeneration).voice.apiVersion||lookup.endpoint!==`https://api.cartesia.ai/voices/${choice.voiceId}`)throw new Error('EXISTING_VOICE_MISMATCH: bind the selected ID/name and exact authenticated Cartesia lookup.');
      p.voiceChoice.lookup=lookup;importExistingVoice(p);
    }
  }else if(e.action==='reserve-compute'){
    requiredActor(e,'runtime');if(!e.reservation)throw new Error('Compute reservation required.');
    p.budget??={maxCostUsd:0,reservations:[]};const existing=p.budget.reservations.find(r=>r.id===e.reservation.id);
    if(existing&&digest(existing)!==digest(e.reservation))throw new Error('BUDGET_RESERVATION_CHANGED');
    if(!existing){requireBudget(p,e.reservation.estimatedCostUsd);p.budget.reservations.push(e.reservation);p.history.push({sequence:p.sequence,action:e.action,actor:'runtime',message:e.reservation.id,at:new Date().toISOString()});}
    // Accounting does not rewrite the creative task; exact receipts remain recoverable.
    return Project.parse(p);
  }else if(e.action==='upgrade-studio'){
    requiredActor(e,'human');if(!e.message||p.artifacts.length||p.jobs.length||p.crew)throw new Error('STUDIO_UPGRADE_LOCKED: upgrade only a pristine project before work/crew binding; use a separate new project for a different bundle after work begins. No approvals are migrated.');
    p.studio=loadStudio();
  }else if(e.action==='refresh-writing-instructions'){
    requiredActor(e,'human');
    if(!e.message||p.step!=='script'||!p.studio||locked(p,'script')||p.jobs.length||p.artifacts.some(a=>a.approvedBy&&a.kind!=='answers'))throw new Error('WRITING_REFRESH_LOCKED: explicitly refresh only unapproved script work before media; approved answers and prior review evidence remain unchanged.');
    const next=loadStudio(),allowed=['crew/leo/SKILL.md','evaluation/rubrics/text.md'];
    if(digest(next.config)!==digest(p.studio.config)||Object.keys(next.documents).length!==Object.keys(p.studio.documents).length||Object.keys(next.documents).some(path=>!allowed.includes(path)&&digest(next.documents[path])!==digest(p.studio.documents[path])))throw new Error('WRITING_REFRESH_SCOPE: only writer skill and text rubric may change; tools, models, budgets, recipes and other instructions stay pinned.');
    p.studio=next;p.gate=current(p)?'review':'author';if(p.debug?.enabled)p.debug.paused=true;
  }else if(e.action==='refresh-planning-instructions'){
    requiredActor(e,'human');
    if(!e.message||!p.studio||p.jobs.length||!['clone','audition','narration'].includes(p.step)||!['produce','escalate'].includes(p.gate))throw new Error('PLANNING_REFRESH_LOCKED: explicit pre-provider instruction refresh only; preserve existing approvals and bindings.');
    const path=p.studio.config.agents['generation-planner'].skill;
    const documents={...p.studio.documents,[path]:loadStudio().documents[path]};
    p.studio={...p.studio,documents,sha256:digest({config:p.studio.config,documents})};
  }else if(e.action==='start-audio-edit'){
    requiredActor(e,'human');
    const a=current(p);
    if(!e.message||!p.studio||p.step!=='narration'||a?.review?.decision!=='rejected'||a.approvedBy||!locked(p,'script')||!locked(p,'audition')||p.jobs.some(j=>['submitting','submitted','uncertain'].includes(j.status))||!['author','escalate'].includes(p.gate)||p.reviewDisagreements>=limitsFor(p).reviewDisagreements)throw new Error('AUDIO_EDIT_START_DENIED: explicitly enable editing only for rejected, unlocked narration with reconciled jobs and remaining attempts.');
    const next=loadStudio(),config=structuredClone(p.studio.config),documents={...p.studio.documents};
    config.agents['film-editor'].tools=[...new Set([...config.agents['film-editor'].tools,'listenAudio','transcribe','inspectAudio','renderAudioEdit'])];
    for(const path of ['crew/eli/SKILL.md','crew/ava/SKILL.md','evaluation/rubrics/audio.md'])documents[path]=next.documents[path];
    p.studio={config,documents,sha256:digest({config,documents})};p.gate='author';if(p.debug?.enabled)p.debug.paused=true;
  }else if(e.action==='refresh-audio-instructions'){
    requiredActor(e,'human');if(!e.message||!p.studio||!['voiceSample','clone','audition'].includes(p.step)||p.jobs.length||p.artifacts.some(a=>a.approvedBy&&['audition','narration'].includes(a.kind)))throw new Error('AUDIO_REFRESH_LOCKED: refresh voice-review instructions explicitly before provider work or audio approval.');
    const next=loadStudio(),allowed=['crew/ava/SKILL.md','evaluation/rubrics/audio.md'];
    if(digest(next.config)!==digest(p.studio.config)||Object.keys(next.documents).length!==Object.keys(p.studio.documents).length||Object.keys(next.documents).some(path=>!allowed.includes(path)&&digest(next.documents[path])!==digest(p.studio.documents[path])))throw new Error('AUDIO_REFRESH_SCOPE: only Ava skill and audio rubric may change; all other bindings stay pinned.');
    p.studio=next;
  }else if(e.action==='set-budget'){
    requiredActor(e,'human');if(e.budgetLimitUsd===undefined||!e.message||e.budgetLimitUsd+1e-9<spendSummary(p).totalReservedUsd)throw new Error('Budget needs explicit human limit covering existing reservations.');
    p.budget??={maxCostUsd:0,reservations:[]};p.budget.maxCostUsd=e.budgetLimitUsd;
  }else if(e.action==='abandon'){
    requiredActor(e,'human');if(!e.message)throw new Error('Abandon requires explicit human instruction.');
    p.lifecycle='abandoned';p.gate='pending';
  }else if(e.action==='configure-crew'){requiredActor(e,'human');if(p.jobs.some(j=>['submitting','submitted','uncertain'].includes(j.status))||!e.message)throw new Error('Configure crew explicitly with reconciled jobs; never change existing bindings silently.');
    const crew=Crew.parse(e.crew);if(p.crew&&digest(p.crew)===digest(crew))throw new Error('Crew is already configured with these bindings.');
    const changed=role=>p.crew&&digest(p.crew.workers.find(w=>w.role===role))!==digest(crew.workers.find(w=>w.role===role));
    const audioChanged=changed('audio-reviewer'),visualChanged=changed('visual-reviewer');
    // Explicit host-code refresh keeps the same worker/model and historical
    // review evidence. Replacing a reviewer after approved media stays forbidden.
    const replaced=role=>changed(role)&&digest({...p.crew.workers.find(w=>w.role===role),capabilityVersion:null})!==digest({...crew.workers.find(w=>w.role===role),capabilityVersion:null});
    if(supervised(p)&&p.artifacts.some(a=>a.valid&&a.approvedBy&&a.content.files&&(replaced('audio-reviewer')&&['audition','narration','music','effect','film'].includes(a.kind)||replaced('visual-reviewer')&&[...imageSteps,'video','film'].includes(a.kind))))throw new Error('REVIEW_CREW_LOCKED: keep the approved-media reviewer identity and model for this v1 project; an explicit same-worker host refresh preserves historical approvals.');
    const audio=current(p,'audioReviewerQualification'),visual=current(p,'reviewerQualification');
    if(visualChanged&&visual)invalidate(p,visual.id);
    if(!supervised(p)&&audioChanged&&audio){invalidate(p,audio.id);p.step='audioReviewerQualification';p.gate='author';}
    else if(!supervised(p)&&visualChanged&&visual){p.step='reviewerQualification';p.gate='author';}
    const hostRefresh=p.crew&&p.crew.workers.length===crew.workers.length&&p.crew.workers.every(w=>digest({...w,capabilityVersion:null})===digest({...crew.workers.find(n=>n.role===w.role),capabilityVersion:null}));
    p.crew=crew;
    // Same-worker tool refresh is setup: retain creative task/draft identities.
    if(hostRefresh){p.history.push({sequence:p.sequence,action:e.action,actor:e.actor,message:e.message,at:new Date().toISOString()});return Project.parse(p);}
  }else if(e.action==='configure-review'){
    requiredActor(e,'human');
    if(!e.message||!e.reviewMode||!['answers','script','voiceSample','clone','audioReviewerQualification','reviewerQualification'].includes(p.step)||p.jobs.some(j=>!['ready','failed'].includes(j.status))||p.artifacts.some(a=>a.valid&&a.approvedBy&&['audition','narration','keyframe','video','film'].includes(a.kind)))throw new Error('Review policy change requires an explicit pre-production decision and reconciled jobs.');
    if(p.reviewMode===e.reviewMode)throw new Error('Review policy already selected.');
    p.reviewMode=e.reviewMode;
    if(supervised(p)&&['audioReviewerQualification','reviewerQualification'].includes(p.step)){p.step=p.step==='audioReviewerQualification'?'audition':'videoPlan';p.gate=p.step==='audition'?'produce':'author';}
  }else if(e.action==='start-audio-review'){requiredActor(e,'human');if(locked(p,'audioReviewerQualification')||!current(p,'clone')||p.jobs.some(j=>['submitting','submitted','uncertain'].includes(j.status))||!e.message)throw new Error('Explicit audio-review upgrade requires an existing clone, no qualified audio lock and reconciled jobs.');for(const a of p.artifacts.filter(a=>a.valid&&['audition','narration'].includes(a.kind)))invalidate(p,a.id);p.step='audioReviewerQualification';p.gate='author';
  }else if(e.action==='audio-qualified'){requiredActor(e,'runtime');if(p.step!=='audioReviewerQualification'||p.gate!=='author')throw new Error('Audio qualification requires its current task.');const report=Content.audioReviewerQualification.parse(e.content),worker=p.crew?.workers.find(w=>w.role==='audio-reviewer');if(worker&&(worker.workerId!==report.workerId||worker.modelVersion!==report.modelVersion||worker.capabilityVersion!==report.capabilityVersion))throw new Error('Audio qualification must match assigned Ava model/tool profile.');addArtifact(p,report,'verified-local-audio-evaluator');
  }else if (e.action === 'qualified') {
    requiredActor(e,'runtime');if(p.step!=='reviewerQualification'||p.gate!=='author')throw new Error('Qualification requires current qualification task.');const worker=p.crew?.workers.find(w=>w.role==='visual-reviewer');if(worker&&(worker.workerId!==e.content?.workerId||worker.modelVersion!==e.content?.modelVersion||worker.capabilityVersion!==e.content?.capabilityVersion))throw new Error('Visual qualification must match assigned Vera model.');addArtifact(p,e.content,'verified-local-evaluator');
  } else if (e.action === 'note') {
    if (!e.message) throw new Error('Note needs text.');
    if(e.actor==='human'&&p.step==='narration'&&['author','escalate'].includes(p.gate))p.feedback.push({key:keyFor(p),message:e.message});
    if(e.creativeDirection){
      requiredActor(e,'human');
      if(!['answers','script'].includes(p.step)||locked(p,'script')||p.jobs.some(j=>['submitting','submitted','uncertain'].includes(j.status)))throw new Error('CREATIVE_DIRECTION_REWIND_REQUIRED: new writing/cast direction belongs to an unapproved script; use impact-confirmed changes to reopen locked work first.');
      p.creativeDirections??=[];p.creativeDirections.push({...e.creativeDirection,message:e.message,at:new Date().toISOString()});
      if(p.step==='script'&&current(p)){p.gate='review';if(p.debug?.enabled)p.debug.paused=true;}
    }
  } else if (['changes', 'redo', 'reject'].includes(e.action)) {
    requiredActor(e, 'human');
    if (p.jobs.some(j => ['submitting', 'submitted', 'uncertain'].includes(j.status))) throw new Error('Reconcile all outstanding requests before a revision.');
    let a = p.artifacts.find(a => a.id === e.artifactId && a.valid);
    if (!a || a.digest !== e.artifactDigest || !e.message) throw new Error('Revision needs the current artifact ID/digest and explicit user feedback.');
    const impact=revisionImpact(p,a.id);
    if(supervised(p)&&impact.affected.some(id=>p.artifacts.find(a=>a.id===id)?.approvedBy)&&e.impactDigest!==impact.impactDigest)throw new Error('REVISION_IMPACT_CONFIRMATION_REQUIRED: show current impact and obtain human confirmation of its digest.');
    a = revisionRoot(p, a);
    reopen(p,a,e.message);
    p.feedback.at(-1).intent=e.action==='redo'?'redo':'detail';
  } else if (e.action === 'artifact') {
    if(p.step==='audioReviewerQualification')throw new Error('Use qualify-audio; a worker cannot self-certify audio expertise.');
    if(p.step==='reviewerQualification')throw new Error('Use qualify-visual to compute a report from actual held-out files; a worker cannot self-certify.');
    if (!(p.gate === 'author' || (p.step === 'voiceSample' && p.gate === 'human')) || !Content[p.step]) throw new Error('Artifact submission is not allowed here.');
    requiredActor(e, p.step === 'voiceSample' ? 'human' : 'agent');
    if (!e.workerId) throw new Error('Artifact author worker ID is required.');
    addArtifact(p, e.content, e.workerId);
  } else if (e.action==='start-studio'){requiredActor(e,'human');if(p.step!=='video'||p.gate!=='pending'||!e.message)throw new Error('Only an older video-pending checkpoint can start studio.');assertAllowed(p,'reviewerQualification');p.step='reviewerQualification';p.gate='author';
  } else if(e.action==='rendered'){requiredActor(e,'runtime');if(p.step!=='film'||p.gate!=='produce')throw new Error('Film render not allowed here.');addArtifact(p,e.content,'official-assembler');
  } else if (e.action === 'start-shots') {
    requiredActor(e, 'human');
    if (p.step !== 'shots' || p.gate !== 'pending' || !e.message) throw new Error('Only an older shots-pending checkpoint can explicitly start shots.');
    assertAllowed(p, 'shots'); p.gate = 'author';
  } else if (e.action === 'start-backgrounds') {
    requiredActor(e, 'human');
    if (p.step !== 'backgrounds' || p.gate !== 'pending' || !e.message) throw new Error('Only an older background-pending checkpoint can explicitly start backgrounds.');
    assertAllowed(p, 'backgrounds'); p.gate = 'author';
  } else if (['review', 'owner-review'].includes(e.action)) {
    const ownerReview = e.action === 'owner-review';
    requiredActor(e, ownerReview ? 'agent' : 'reviewer');
    const a = current(p);
    if (p.gate !== (ownerReview ? 'owner-review' : 'review') || !a || e.artifactId !== a.id || e.artifactDigest !== a.digest || !e.workerId || e.workerId === a.authoredBy) throw new Error('Review must bind the current artifact and use a distinct reviewer worker.');
    if (isPrompt(p) && (ownerReview ? e.workerId !== current(p, briefKey(p)).authoredBy : e.workerId === current(p, briefKey(p)).authoredBy || a.ownerReview?.decision !== 'approved')) throw new Error('Prompt requires the original owner check followed by a distinct independent reviewer.');
    const r = Review.parse(e.review);
    if(['audition','narration'].includes(p.step)&&voiceBasis(p).kind==='existing-clone'){
      const m=r.measurements,identity=r.checks.find(c=>c.criterion==='voice-match');
      if(m?.referenceSha256!==undefined||m?.speakerSimilarity!==undefined||m?.speakerSimilarityMethod!==undefined||m?.identityBasis!==undefined&&m.identityBasis!=='human-recognition'||identity?.status==='pass'||r.toolEvidence?.some(t=>t.tool==='speakerSimilarity'||t.referenceSha256!==undefined))throw new Error('HUMAN_VOICE_IDENTITY_REQUIRED: no original reference; never invent speaker similarity, source hashes or an automated identity pass.');
      if(reviewPassed(r)&&(!supervised(p)||identity?.status!=='inconclusive'||m?.identityBasis!=='human-recognition'))throw new Error('HUMAN_VOICE_IDENTITY_REQUIRED: use supervised human recognition without an original recording.');
    }
    const required=p.step==='film'?filmCriteria(p):criteria[p.step];
    const names = r.checks.map(c => c.criterion);
    if (names.length !== required.length || new Set(names).size !== names.length || required.some(c => !names.includes(c))) throw new Error('Every required criterion needs exactly one evidenced finding.');
    const perception = ['audition', 'narration'].includes(p.step) ? 'direct-audio' : imageSteps.includes(p.step) ? 'direct-image' : p.step==='video'?'direct-video':p.step==='film'?(reviewPassed(a.visualReview)?'direct-audio':'direct-video'):['music','effect'].includes(p.step)?'direct-audio':'direct-text';
    if(r.decision==='provisional'&&(!supervised(p)||r.perception!==perception||r.checks.some(c=>c.status==='fail')))throw new Error('Provisional review requires supervised mode, actual perception and no known failures.');
    if (r.decision === 'approved' && (r.perception !== perception || r.checks.some(c => c.status !== 'pass'))) throw new Error('Cannot approve missing perception or failing/inconclusive checks.');
    if (r.decision === 'rejected' && !r.checks.some(c => c.status === 'fail' && c.repair.trim())) throw new Error('Rejection requires a failed criterion and a specific repair.');
    if (r.checks.some(c => c.status === 'fail' && !c.repair.trim())) throw new Error('Every failure requires a specific repair.');
    const filmRepair = p.step==='film'&&r.decision==='rejected' ? (r.repairArtifactId ? p.artifacts.find(a=>a.id===r.repairArtifactId&&a.valid) : current(p,'editPlan')) : null;
    if(p.step==='film'&&r.decision==='rejected'&&r.repairTarget!=='script'&&(!filmRepair||!['editPlan','video','music','effect','keyframe','narration'].includes(filmRepair.kind)||!revisionImpact(p,filmRepair.id).affected.includes(a.id)))throw new Error('Final-film repair must target a current component used by this film.');
    const filmAudio=p.step==='film'&&reviewPassed(a.visualReview);
    if(r.decision!=='inconclusive'&&(p.step==='video'||p.step==='film'&&!filmAudio)){const q=supervised(p)?{workerId:e.workerId,modelVersion:r.modelVersion,capabilityVersion:r.capabilityVersion}:current(p,'reviewerQualification').content;if(!supervised(p))requireVisualQualification(q,'video');if(r.perception!==perception||e.workerId!==q.workerId||r.modelVersion!==q.modelVersion||(q.capabilityVersion&&r.capabilityVersion!==q.capabilityVersion)||r.coverage?.artifactSha256!==a.content.files[0].sha256||(!r.coverage.videoSeconds||r.coverage.videoSeconds+1/30<a.content.files[0].durationSeconds))throw new Error('Qualified reviewer must directly inspect the entire current video/audio and bind its hash/model.');}
    if(r.decision!=='inconclusive'&&(['audition','narration','music','effect'].includes(p.step)||filmAudio)){const q=supervised(p)?{workerId:e.workerId,modelVersion:r.modelVersion,capabilityVersion:r.capabilityVersion}:current(p,'audioReviewerQualification')?.content;if(!supervised(p))requireAudioQualification(q);if(r.perception!==perception||!supervised(p)&&!locked(p,'audioReviewerQualification')||e.workerId!==q.workerId||r.modelVersion!==q.modelVersion||r.capabilityVersion!==q.capabilityVersion||e.workerId===a.visualReviewedBy)throw new Error('Qualified independent audio reviewer must bind its model and tool profile.');const coverage=r.coverage?.audioFiles;if(!coverage||coverage.length!==a.content.files.length||a.content.files.some((f,i)=>coverage[i].sha256!==f.sha256||coverage[i].seconds+.02<f.durationSeconds))throw new Error('Audio reviewer must hear every entire current file and bind its hash.');}
    if (reviewPassed(r) && ['audition', 'narration'].includes(p.step)) {
      if (a.content.files.some(f => f.durationSeconds > 15)) throw new Error('Overlong narration cannot be approved; return the affected text to the writer, never accelerate it.');
      const m = r.measurements,basis=voiceBasis(p);
      if (!m || !m.speechToTextMethod || (!supervised(p)&&(!m.speakerSimilarityMethod || m.speakerSimilarity === undefined)) || !m.measurementNotes || basis.kind==='unavailable' || (basis.kind==='recorded-reference'&&m.referenceSha256!==basis.referenceSha256) || m.transcripts?.length !== a.content.files.length || m.speakingRateWpm?.length !== a.content.files.length || m.silenceSeconds?.length !== a.content.files.length) throw new Error('Audio review requires transcript, speaking-rate/silence measurements, notes and truthful identity evidence for the current voice basis.');
      if (m.transcripts.some((t, i) => transcriptDiff(current(p, 'script').content.beats[i].narration,t).editDistance)) throw new Error('Speech-to-text differs from the locked script.');
    }
    if(p.step==='film'){if(filmAudio){a.audioReview=structuredClone(r);a.audioReviewedBy=e.workerId;}else{a.visualReview=r;a.visualReviewedBy=e.workerId;if(reviewPassed(r)){if(p.debug?.enabled)p.debug.paused=true;p.sequence++;p.history.push({sequence:p.sequence,action:'review',actor:e.actor,...activity,message:'Visual film review passed; awaiting independent audio review.',at:new Date().toISOString()});return Project.parse(p);}}if(filmAudio&&reviewPassed(r)){r.perception='direct-audiovisual';r.checks=criteria.film.map(c=>r.checks.find(x=>x.criterion===c)??a.visualReview.checks.find(x=>x.criterion===c));}}
    if (ownerReview) a.ownerReview = r;
    if (ownerReview && r.decision === 'approved') p.gate = 'review';
    else {
    a.review = r; a.reviewSequence=p.sequence+1;
    if (reviewPassed(r)) { p.gate = 'human'; if (p.step === 'sheetPrompt'&&!supervised(p)) next(p); }
    else {
      if ((['keyframe','video','film'].includes(p.step)||refinedWorkflow(p)&&p.step==='candidates'||miniProduction(p)&&imageSteps.includes(p.step)) && r.decision === 'rejected') {
        p.reviewDisagreements = 0;
        for (const frame of p.artifacts.filter(f => f.key === a.key && hasDependency(p,f.dependencies,generationScope(p)) && f.review).toReversed()) {
          if (frame.review.decision !== 'rejected') break;
          p.reviewDisagreements++;
        }
      } else p.reviewDisagreements++;
      p.feedback.push({ key: a.key, message: JSON.stringify(r.checks.filter(c => c.status !== 'pass')) });
      const audioRepair=p.step==='narration'&&!a.approvedBy&&r.decision==='rejected'&&audioEditingEnabled(p)&&p.reviewDisagreements<limitsFor(p).reviewDisagreements;
      p.gate = audioRepair?'author':r.decision === 'inconclusive' || r.repairTarget === 'script' || filmRepair?.kind==='narration' || p.reviewDisagreements >= limitsFor(p).reviewDisagreements ? 'escalate' : (authorSteps.includes(p.step)||p.step==='music'&&current(p,'soundPlan').content.music.mode==='import'||p.step==='effect'&&effectFor(p).mode==='import') ? 'author' : 'produce'; }
    }
    if(filmRepair?.kind==='narration')p.feedback.push({key:a.key,message:'Source narration repair reopens its downstream visuals and film in this v1 dependency model. Run impact on the narration artifact and obtain explicit human direction before rebuilding.'});
    if(p.step==='film'&&r.decision==='rejected'&&p.gate==='produce'){reopen(p,revisionRoot(p,filmRepair),JSON.stringify(r.checks.filter(c=>c.status!=='pass')));}
    if ((['keyframe','video'].includes(p.step)||refinedWorkflow(p)&&p.step==='candidates'||miniProduction(p)&&imageSteps.includes(p.step)) && r.decision === 'rejected' && p.gate === 'produce') {
      repairVisual(p, JSON.stringify(r.checks.filter(c => c.status !== 'pass')));
    }
  } else if (e.action === 'approve') {
    requiredActor(e, 'human');
    const a = current(p);
    if(p.step==='film'&&(!a?.visualReview||!a?.audioReview||a.visualReviewedBy===a.audioReviewedBy))throw new Error('Film requires separate visual and audio reviewer passes.');
    if (p.gate !== 'human' || !a || !reviewPassed(a.review) || e.artifactId !== a.id || e.artifactDigest !== a.digest || !e.message) throw new Error('Human approval needs the exact current agent-passing artifact and original user message.');
    if(supervised(p)&&p.workflowRevision>=4&&['answers','script'].includes(p.step)){
      const findings=a.content.commonSenseChecks.map(c=>digest({category:c.category,finding:c.finding}));
      const resolutions=e.resolvedFindings??[];
      if(new Set(resolutions.map(x=>x.findingDigest)).size!==resolutions.length||findings.some(h=>!resolutions.some(x=>x.findingDigest===h)))throw new Error('INTAKE_UNRESOLVED: resolve essential factual/story findings; source photos and casting decisions belong to roster approval.');
      a.resolvedFindings=resolutions;
    }
    if(supervised(p)&&(p.workflowRevision<4&&['answers','script'].includes(p.step)||p.workflowRevision>=4&&p.step==='roster')){
      const confirmation=e.intakeConfirmation ?? (refinedWorkflow(p)&&p.step==='script'?current(p,'answers')?.intakeConfirmation:null);
      if(!confirmation)throw new Error('INTAKE_CONFIRMATION_REQUIRED: confirm rights, voice consent, character/age/reference decisions and essential findings at this workflow’s confirmation gate.');
      const intake=IntakeConfirmation.parse(confirmation);
      if(new Set(intake.characters.map(c=>c.id)).size!==intake.characters.length||intake.characters.some(c=>c.likeness==='await-reference'||c.minor&&!c.guardianAuthority||c.likeness==='reference'&&!c.references.length||c.references.some(f=>!f.width||!f.height||f.durationSeconds)))throw new Error('INTAKE_UNRESOLVED: resolve missing age/photo rights/guardian authority and use measured still references.');
      if(p.workflowRevision===3&&p.step==='script'){const prior=current(p,'answers').intakeConfirmation;if(digest({voiceConsent:intake.voiceConsent,characters:intake.characters})!==digest({voiceConsent:prior.voiceConsent,characters:prior.characters}))throw new Error('ANSWERS_INVENTORY_LOCKED: revise the answers lock to change agreed people, ages, consent or source photos.');}
      const findings=[...(refinedWorkflow(p)&&p.step==='script'?current(p,'answers').content.commonSenseChecks:[]),...(a.content.commonSenseChecks??[])].map(c=>digest({category:c.category,finding:c.finding}));
      if(!refinedWorkflow(p)&&findings.length!==intake.resolvedFindings.length)throw new Error('INTAKE_UNRESOLVED: resolve exactly the current findings.');
      if(new Set(intake.resolvedFindings.map(c=>c.findingDigest)).size!==intake.resolvedFindings.length||findings.some(h=>!intake.resolvedFindings.some(c=>c.findingDigest===h)))throw new Error('INTAKE_UNRESOLVED: each actual common-sense finding needs an explicit human resolution.');
      if(p.workflowRevision>=4){
        const proposed=current(p,'script').content.proposedCast,inventory=intake.characters.filter(c=>c.likeness!=='omit');
        if(intake.characters.length!==proposed.length||proposed.some(c=>!intake.characters.some(i=>i.id===c.id&&i.name===c.name&&i.ageVariant===c.ageVariant&&i.minor===c.minor)))throw new Error('SCRIPT_CAST_MISMATCH: reference decisions must cover the approved script cast; revise the script to change who appears.');
        if(inventory.length!==a.content.characters.length||inventory.some(i=>!a.content.characters.some(c=>c.id===i.id&&c.name===i.name&&c.ageVariant===i.ageVariant&&digest(c.references)===digest(i.references)&&(i.likeness!=='interpreted'||c.notes.includes(i.decisionNotes)))))throw new Error('INTAKE_ROSTER_MISMATCH: roster must use the exact human-confirmed references and interpretation notes.');
      }
      a.intakeConfirmation=intake;
    }
    if (['candidates', 'backgroundCandidates'].includes(p.step)) { if (![0, 1, 2].includes(e.selection)) throw new Error('Choose one of the three candidate indexes: 0, 1, 2.'); a.selection = e.selection; }
    if(supervised(p)&&a.content.files){
      const h=Review.parse(e.humanReview);const needed=criteria[p.step],humanPerception=p.step==='film'?'direct-audiovisual':imageSteps.includes(p.step)?'direct-image':p.step==='video'?'direct-video':'direct-audio';
      if(h.decision!=='approved'||h.perception!==humanPerception||h.checks.length!==needed.length||needed.some(c=>!h.checks.some(x=>x.criterion===c&&x.status==='pass')))throw new Error('HUMAN_MEDIA_REVIEW_REQUIRED: confirm every criterion on the actual current media.');
      a.humanReview=h;
    }
    a.approvedBy = { message: e.message, at: new Date().toISOString() }; next(p);
  } else if (e.action === 'resolve') {
    requiredActor(e, 'human');
    if (p.jobs.some(j => j.key === keyFor(p) && j.status === 'uncertain')) throw new Error('UNCERTAIN_JOB: reconcile the existing request; do not resolve into a new generation.');
    if (p.gate !== 'escalate' || !e.message) throw new Error('Resolution needs explicit user direction at an escalation.');
    const planningBlocked=p.history.findLast(h=>['planning-blocked','review','provider-error'].includes(h.action));
    const resumePlanning=planningBlocked?.action==='planning-blocked'&&planningBlocked.step===p.step;
    const resumeEditing=p.step==='narration'&&audioEditingEnabled(p)&&current(p)?.review?.decision==='rejected';
    if(resumeEditing&&p.reviewDisagreements>=limitsFor(p).reviewDisagreements)throw new Error('AUDIO_EDIT_ATTEMPT_LIMIT: exhausted review/repair loop; inspect the evidence before a scoped script change.');
    p.feedback.push({ key: keyFor(p), message: e.message,...(p.step==='answers'?{intent:'detail'}:{}) }); if(!resumePlanning&&!resumeEditing)p.reviewDisagreements = 0;
    p.gate = resumeEditing?'author':isPrompt(p) && current(p)?.ownerReview?.decision === 'inconclusive' ? 'owner-review' : current(p)?.review?.decision === 'inconclusive' ? 'review' : (authorSteps.includes(p.step)||p.step==='music'&&current(p,'soundPlan').content.music.mode==='import'||p.step==='effect'&&effectFor(p).mode==='import') ? 'author' : 'produce';
    if(p.step==='film'&&p.gate==='produce'){const target=current(p)?.review?.repairArtifactId;const a=target?p.artifacts.find(a=>a.id===target&&a.valid):current(p,'editPlan');reopen(p,revisionRoot(p,a),e.message);}
    if ((['keyframe','video'].includes(p.step)||refinedWorkflow(p)&&p.step==='candidates'||miniProduction(p)&&imageSteps.includes(p.step)) && p.gate === 'produce'&&!resumePlanning) repairVisual(p, e.message);
  } else if (e.action === 'reconcile') {
    requiredActor(e, 'human'); const j = p.jobs.find(j => j.id === e.jobId);
    if (p.gate !== 'escalate' || !j || j.key !== keyFor(p) || j.status !== 'uncertain' || j.digest !== e.artifactDigest || !e.message) throw new Error('Reconciliation needs the exact uncertain job and explicit user direction.');
    const outcome=e.result?.outcome??'collect-existing';
    if(!['confirmed-no-result','confirmed-unusable-result','confirmed-completed','collect-existing'].includes(outcome))throw new Error('Reconciliation needs a confirmed outcome or direction to collect the existing request.');
    j.reconciliation={outcome,message:e.message,at:new Date().toISOString()};
    if (['confirmed-no-result','confirmed-unusable-result'].includes(outcome)) { j.status = 'failed'; p.gate = 'produce'; } else p.gate = 'collect';
  } else if (e.action === 'allowance') {
    requiredActor(e, 'human');
    if (!e.allowance || !e.message) throw new Error('Allowance requires explicit user limits and original message.');
    p.allowances.push({ ...e.allowance, id: `allowance-${p.allowances.length + 1}`, message: e.message, at: new Date().toISOString() });
  } else if(e.action==='planning-blocked'){
    requiredActor(e,'agent');if(!(p.gate==='produce'&&p.step!=='film'||p.step==='narration'&&p.gate==='author')||!e.message||e.plan)throw new Error('PLANNING_BLOCKER_SCOPE: only the assigned planner/editor may report an evidenced blocker; no plan or approval.');
    if(e.blocker?.kind==='editing-infeasible'&&!(p.step==='narration'&&p.gate==='author'))throw new Error('AUDIO_EDIT_SCOPE_DENIED');
    if(!e.blocker)throw new Error('PLANNING_HELP_REQUIRED: report the problem, solution and baby steps with the diagnostic.');
    if(p.step==='narration'&&p.gate==='author'){if(e.blocker.kind!=='editing-infeasible')throw new Error('AUDIO_EDIT_INVESTIGATION_REQUIRED: editor refusals require investigated editing evidence; tool failures are not infeasibility.');validateEditingInvestigation(taskFor(p),e);}
    if(e.blocker.kind==='account-readiness'){const {kind,...help}=e.blocker;if(digest(help)!==digest(planningAccountGuide(p)))throw new Error('PLANNING_HELP_BINDING: use canonical account guidance; never invent payment requirements, URLs or account failures.');}
    p.gate='escalate';p.feedback.push({key:keyFor(p),message:e.message});
  } else if (e.action === 'plan') {
    requiredActor(e, 'agent');
    if (p.gate !== 'produce') throw new Error('Generation planning is not allowed here.');
    if(p.step==='clone'&&p.voiceChoice)throw new Error('EXISTING_VOICE_SELECTED: verify and reuse the selected voice; never create a replacement clone.');
    assertAllowed(p, p.step);
    const plan = Plans.parse(e.plan);
    if (plan.operation !== p.step || plan.provider !== (imageSteps.includes(p.step)?'meta-muse':p.step==='video'?'replicate':['music','effect'].includes(p.step)?'elevenlabs':'cartesia')) throw new Error('Provider/operation does not match the current stage.');
    if(refinedWorkflow(p)&&p.step==='candidates'&&plan.parameters.prompt!==current(p,`characterPrompt:${p.characterId}`).content.prompt)throw new Error('Use the human-approved character design prompt exactly.');
    if (imageSteps.includes(p.step) && !plan.parameters.prompt) throw new Error('Image plan needs an authored prompt.');
    if (['backgroundCandidates', 'backgroundAngle'].includes(p.step) && (!locked(p, promptKey(p)) || plan.parameters.prompt !== current(p, promptKey(p)).content.prompt)) throw new Error('Use the human-approved background prompt exactly.');
    if(p.step==='video'&&plan.parameters.prompt!==current(p,`videoPrompt:${p.clipId}`).content.prompt)throw new Error('Use exact human-approved video prompt.');
    if(['music','effect'].includes(p.step)&&plan.parameters.prompt!==(p.step==='music'?current(p,'soundPlan').content.music:effectFor(p)).prompt)throw new Error('Use approved sound prompt.');
    if (p.step === 'keyframe' && (!locked(p, `keyframePrompt:${p.shotId}`) || plan.parameters.prompt !== current(p, `keyframePrompt:${p.shotId}`).content.prompt)) throw new Error('Use the human-approved keyframe prompt exactly.');
    if (p.step === 'sheet' && plan.parameters.prompt !== current(p, `sheetPrompt:${p.characterId}`).content.prompt) throw new Error('Use the approved sheet prompt exactly.');
    if (p.jobs.filter(j => j.key === keyFor(p) && ((['keyframe','video'].includes(p.step)||refinedWorkflow(p)&&p.step==='candidates'||miniProduction(p)&&imageSteps.includes(p.step)) ? hasDependency(p,j.dependencies,generationScope(p)) : JSON.stringify(j.dependencies) === JSON.stringify(dependencies(p))) && ['submitting', 'submitted', 'ready', 'uncertain', 'failed'].includes(j.status)).length >= limitsFor(p).generationAttempts) throw new Error('ATTEMPT_LIMIT: configured generation request limit reached for these dependencies. Stop and resolve the deliverable with the user.');
    const request = requestDescriptor(p, plan);
    const bound = { plan, request, dependencies: dependencies(p) };
    const technicalRepair = p.step==='video' && p.artifacts.findLast(a=>a.review?.decision==='rejected'&&a.dependencies.includes(current(p,'videoPlan').id)&&((a.key===keyFor(p)&&a.review.checks.some(c=>c.status==='fail'&&['integrity','anatomy','identity','continuity','motion'].includes(c.criterion)))||(a.kind==='film'&&p.artifacts.find(v=>v.id===a.review.repairArtifactId)?.key===keyFor(p)&&a.review.checks.some(c=>c.status==='fail'&&['technical','visual-continuity'].includes(c.criterion)))));
    const userRevision = p.history.findLast(h=>['changes','redo','reject','resolve'].includes(h.action));
    const repairIsCurrent = technicalRepair && (!userRevision || technicalRepair.reviewSequence>userRevision.sequence);
    const allowance = p.allowances.findLast(a => { const used = p.jobs.filter(j => j.allowanceId === a.id); return a.operations.includes(plan.operation) && (plan.operation!=='video'||(!supervised(p)&&!miniProduction(p)&&a.repairOf===keyFor(p)&&repairIsCurrent&&current(p,`videoPrompt:${p.clipId}`).content.repairOnly)) && used.length < a.maxRequests && used.reduce((n, j) => n + j.plan.estimatedCostUsd, 0) + plan.estimatedCostUsd <= a.maxCostUsd; });
    if(allowance)requireBudget(p,plan.estimatedCostUsd);
    p.jobs.push({ id: `job-${p.jobs.length + 1}`, key: keyFor(p), plan, request, dependencies: bound.dependencies, digest: digest(bound), status: allowance ? 'authorized' : 'planned', ...(allowance ? { allowanceId: allowance.id, authorization: { message: allowance.message, at: new Date().toISOString() } } : {}) }); p.gate = allowance ? 'collect' : 'authorize';
  } else if (e.action === 'authorize') {
    requiredActor(e, 'human'); const j = p.jobs.findLast(j => j.key === keyFor(p));
    if (p.gate !== 'authorize' || j.status !== 'planned' || e.jobId !== j.id || e.artifactDigest !== j.digest || !e.message) throw new Error('Authorization must bind the exact generation request, estimate and current dependencies.');
    requireBudget(p,j.plan.estimatedCostUsd);j.status = 'authorized'; j.authorization = { message: e.message, at: new Date().toISOString() }; p.gate = 'collect';
  } else if (['begin', 'job-id', 'receipt', 'provider-error'].includes(e.action)) {
    requiredActor(e, 'runtime'); const j = p.jobs.find(j => j.id === e.jobId);
    if (p.gate !== 'collect' || !j || j.key !== keyFor(p) || j.digest !== e.artifactDigest || j.dependencies.some(id => !p.artifacts.some(a => a.id === id && a.valid))) throw new Error('Job does not belong to the current authorized stage/dependencies.');
    assertAllowed(p, p.step);
    if (e.action === 'begin') { if (j.status !== 'authorized') throw new Error('ALREADY_SUBMITTED: collect/reconcile this job; do not make a duplicate paid request.'); j.status = 'submitting'; }
    if (e.action === 'job-id') { if (!['submitting', 'submitted', 'uncertain'].includes(j.status) || !e.providerJobId) throw new Error('No submitted job to bind.'); j.providerJobId = e.providerJobId; j.status = 'submitted'; }
    if (e.action === 'receipt') { if ([...imageSteps,'video','music','effect'].includes(p.step) && e.result?.prompt !== j.request.prompt) throw new Error('Receipt prompt differs from authorized request.'); if (['audition', 'narration'].includes(p.step) && e.result?.voiceId !== j.request.voice) throw new Error('Receipt voice differs from authorized request.'); if (!['submitting', 'submitted', 'uncertain'].includes(j.status)) throw new Error('No submitted job to collect.'); addArtifact(p, e.result, 'provider-runtime'); j.status = 'ready'; j.result = e.result; }
    if (e.action === 'provider-error') { if (!e.message) throw new Error('Provider error needs diagnostics.'); j.status = 'uncertain'; p.gate = 'escalate'; }
  } else throw new Error('Unsupported action.');
  if(p.debug?.enabled&&e.action!=='begin')p.debug.paused=true;
  p.sequence++;
  if(['artifact','receipt','rendered'].includes(e.action)){const a=current(p,submittedKey);activity.artifactId=a.id;activity.artifactDigest=a.digest;}
  if(e.action==='plan')activity.jobId=p.jobs.at(-1).id;
  p.history.push({ sequence: p.sequence, action: e.action, actor: e.actor, ...activity, message: e.message ?? '', at: new Date().toISOString() });
  return Project.parse(p);
}

export function openWorkflow(databasePath) {
  const saver = SqliteSaver.fromConnString(databasePath);
  const State = Annotation.Root({ project: Annotation({ reducer: (_old, value) => value }) });
  const route = state => ['author', 'owner-review', 'review', 'human', 'produce', 'authorize', 'collect', 'escalate', 'pending'].includes(state.project.gate) ? state.project.gate : 'pending';
  const builder = new StateGraph(State);
  // Nodes contain no external side effects. A resumed interrupt may replay this node safely.
  for (const name of ['author', 'owner-review', 'review', 'human', 'produce', 'authorize', 'collect', 'escalate', 'pending']) {
    builder.addNode(name, state => {
      const response = interrupt(taskFor(state.project));
      return { project: applyEvent(state.project, response) };
    });
    builder.addConditionalEdges(name, route);
  }
  builder.addConditionalEdges(START, route);
  const graph = builder.compile({ checkpointer: saver });
  const config = id => ({ configurable: { thread_id: id }, durability: 'sync' });
  return {
    async init(id, inputs, options = {}) {
      if ((await graph.getState(config(id))).values.project) throw new Error('Run already exists. Existing runs are never reset or silently migrated.');
      await graph.invoke({ project: initialProject(id, inputs, options) }, config(id)); return this.status(id);
    },
    async status(id) {
      const state = await graph.getState(config(id));
      if (!state.values.project) throw new Error('Unknown run. Initialize a new v2 run; legacy state.json is not migrated.');
      const project = Project.parse(state.values.project);
      return { project, pending: taskFor(project), checkpointId: state.config?.configurable?.checkpoint_id };
    },
    async respond(id, event) {
      const { project } = await this.status(id);
      applyEvent(project, event); // Validate before storing a resume value, so bad submissions cannot poison the interrupt.
      await graph.invoke(new Command({ resume: event }), config(id)); return this.status(id);
    },
    close() { saver.db.close(); },
  };
}
