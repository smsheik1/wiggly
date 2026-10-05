export const backgroundSteps = ['backgroundBrief', 'backgroundPrompt', 'backgroundCandidates', 'backgroundAngleBrief', 'backgroundAnglePrompt', 'backgroundAngle'];
export const imageSteps = ['candidates', 'sheet', 'backgroundCandidates', 'backgroundAngle', 'keyframe'];
export const authorSteps = ['answers','characterPrompt','audioReviewerQualification','script', 'roster', 'sheetPrompt', 'shotIntentions','backgrounds', 'backgroundBrief', 'backgroundPrompt', 'backgroundAngleBrief', 'backgroundAnglePrompt', 'shots', 'keyframePrompt', 'reviewerQualification', 'videoPlan', 'videoPrompt', 'soundPlan', 'editPlan'];
export const keyFor = p => ['videoPrompt','video'].includes(p.step) ? `${p.step}:${p.clipId}` : p.step === 'effect' ? `effect:${p.effectId}` : ['keyframePrompt', 'keyframe'].includes(p.step) ? `${p.step}:${p.shotId}` : backgroundSteps.includes(p.step) ? `${p.step}:${p.locationId}${p.step.startsWith('backgroundAngle') ? ':' + p.angleId : ''}` : ['characterPrompt','candidates', 'sheetPrompt', 'sheet'].includes(p.step) ? `${p.step}:${p.characterId}` : p.step;
export const current = (p, key = keyFor(p)) => p.artifacts.findLast(a => a.key === key && a.valid);
export const supervised = p => p.reviewMode === 'supervised';
export function voiceBasis(p){
 const sample=current(p,'voiceSample'),clone=current(p,'clone');
 return {kind:sample?'recorded-reference':clone?.content.origin?.kind==='existing'&&p.voiceChoice?.reuseWithoutSample?'existing-clone':'unavailable',language:sample?.content.language??clone?.content.origin?.lookup.language??null,referenceSha256:sample?.content.files[0].sha256??null,voiceId:clone?.content.voiceId??null};
}
export const miniProduction = p => p.productionProfile === 'seedance-mini-480p';
export const refinedWorkflow = p => p.workflowRevision >= 3;
export const reviewPassed = r => ['approved','provisional'].includes(r?.decision);
export const locked = (p, key) => { const a = current(p, key); return !!(a?.approvedBy && reviewPassed(a.review) && (!supervised(p) || !a.content.files || a.humanReview?.decision === 'approved') && (a.kind!=='film'||reviewPassed(a.visualReview)&&reviewPassed(a.audioReview)&&a.visualReviewedBy!==a.audioReviewedBy)); };
const matchesWorker=(p,role,q)=>{const w=p.crew?.workers.find(w=>w.role===role);return !w||w.workerId===q?.workerId&&w.modelVersion===q?.modelVersion&&w.capabilityVersion===q?.capabilityVersion;};
export const narrationLocked = p => (supervised(p) || matchesWorker(p,'audio-reviewer',current(p,'audioReviewerQualification')?.content) && locked(p,'audioReviewerQualification')) && [...(refinedWorkflow(p)?['answers']:[]),'script','audition','narration'].every(key=>locked(p,key)) && !!current(p,'clone');
// Compatibility export for existing host integrations/checkpoints.
export const audioLocked = narrationLocked;
export function assertAllowed(p, kind) {
  if(p.workflowRevision>=4&&kind==='roster'&&!audioLocked(p))throw new Error('NARRATION_LOCK_REQUIRED: establish cast references only after narration approval.');
  if(refinedWorkflow(p)&&kind==='script'&&!locked(p,'answers'))throw new Error('ANSWERS_LOCK_REQUIRED: questionnaire review and exact human confirmation must precede writing.');
  if(p.lifecycle==='abandoned')throw new Error('PROJECT_ABANDONED: new production is prohibited.');
  if (['reviewerQualification','videoPlan','videoPrompt','video','soundPlan','music','effect','editPlan','film'].includes(kind)) {
    if (!audioLocked(p)) throw new Error('NARRATION_LOCK_REQUIRED (AUDIO_LOCK_REQUIRED compatibility)');
    if (!locked(p,'shots') || !current(p,'shots').content.shots.every(s=>locked(p,`keyframe:${s.id}`))) throw new Error('KEYFRAME_LOCK_REQUIRED: all current keyframes need agent and human approval.');
    if (!supervised(p) && kind !== 'reviewerQualification' && (!locked(p,'reviewerQualification')||!matchesWorker(p,'visual-reviewer',current(p,'reviewerQualification')?.content))) throw new Error('VISUAL_REVIEWER_NOT_QUALIFIED');
    if (['videoPrompt','video'].includes(kind) && !locked(p,'videoPlan')) throw new Error('VIDEO_PLAN_LOCK_REQUIRED');
    if (kind === 'video' && !locked(p,`videoPrompt:${p.clipId}`)) throw new Error('VIDEO_PROMPT_LOCK_REQUIRED');
    if (['music','effect','editPlan','film'].includes(kind) && !locked(p,'soundPlan')) throw new Error('SOUND_PLAN_LOCK_REQUIRED');
    if (['soundPlan','editPlan','film'].includes(kind) && !current(p,'videoPlan').content.clips.every(c=>locked(p,`video:${c.id}`))) throw new Error('VIDEO_LOCK_REQUIRED');
    if (kind === 'film' && (!locked(p,'editPlan') || current(p,'soundPlan').content.music && !locked(p,'music') || !current(p,'soundPlan').content.effects.every(e=>locked(p,`effect:${e.id}`)))) throw new Error('EDIT_SOUND_LOCK_REQUIRED');
    return;
  }
  if ([...imageSteps, 'characterPrompt', ...backgroundSteps, 'backgrounds', 'shotIntentions', 'shots', 'keyframePrompt', 'keyframe', 'background', 'video'].includes(kind) && !audioLocked(p)) throw new Error('NARRATION_LOCK_REQUIRED (AUDIO_LOCK_REQUIRED compatibility): current script, clone audition and all four narration beats need agent and human approval.');
  if(refinedWorkflow(p)&&kind==='candidates'&&(!locked(p,'roster')||!locked(p,`characterPrompt:${p.characterId}`)))throw new Error('CHARACTER_DESIGN_PROMPT_LOCK_REQUIRED: review and approve this character prompt before candidates.');
  if(supervised(p)&&kind==='sheet'&&(!locked(p,`candidates:${p.characterId}`)||!locked(p,`sheetPrompt:${p.characterId}`)))throw new Error('CHARACTER_PROMPT_LOCK_REQUIRED: approve the selected character and sheet prompt before sheet generation.');
  if ([...backgroundSteps, 'backgrounds', 'shotIntentions', 'shots', 'keyframePrompt', 'background', 'keyframe', 'video'].includes(kind)) {
    const roster = current(p, 'roster');
    if (!locked(p, 'roster') || !roster.content.characters.every(c => locked(p, `sheet:${c.id}`))) throw new Error('CHARACTER_LOCK_REQUIRED: every required character needs its own approved sheet.');
    if(supervised(p)&&kind==='backgrounds'&&!locked(p,'shotIntentions'))throw new Error('SHOT_INTENTIONS_REQUIRED: plan story shots before backgrounds.');
    if (['shots', 'keyframePrompt', 'keyframe'].includes(kind)) {
      const registry = current(p, 'backgrounds');
      if (!locked(p, 'backgrounds') || !registry.content.locations.every(l => locked(p, `backgroundCandidates:${l.id}`) && l.angles.every(a => locked(p, `backgroundAngle:${l.id}:${a.id}`)))) throw new Error('BACKGROUND_LOCK_REQUIRED: all required masters and angles need agent and human approval.');
      if (kind !== 'shots' && !locked(p, 'shots')) throw new Error('SHOT_LOCK_REQUIRED: approve the current shot plan first.');
    }
    if (['background'].includes(kind)) throw new Error('PRODUCTION_NOT_SPECIFIED: shot and video workflows are not yet defined.');
  }
}
