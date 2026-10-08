export const backgroundSteps = ['backgroundBrief', 'backgroundPrompt', 'backgroundCandidates', 'backgroundAngleBrief', 'backgroundAnglePrompt', 'backgroundAngle'];
export const imageSteps = ['candidates', 'sheet', 'backgroundCandidates', 'backgroundAngle', 'keyframe'];
export const authorSteps = ['script', 'roster', 'sheetPrompt', 'backgrounds', 'backgroundBrief', 'backgroundPrompt', 'backgroundAngleBrief', 'backgroundAnglePrompt', 'shots', 'keyframePrompt', 'reviewerQualification', 'videoPlan', 'videoPrompt', 'soundPlan', 'editPlan'];
export const keyFor = p => ['videoPrompt','video'].includes(p.step) ? `${p.step}:${p.clipId}` : p.step === 'effect' ? `effect:${p.effectId}` : ['keyframePrompt', 'keyframe'].includes(p.step) ? `${p.step}:${p.shotId}` : backgroundSteps.includes(p.step) ? `${p.step}:${p.locationId}${p.step.startsWith('backgroundAngle') ? ':' + p.angleId : ''}` : ['candidates', 'sheetPrompt', 'sheet'].includes(p.step) ? `${p.step}:${p.characterId}` : p.step;
export const current = (p, key = keyFor(p)) => p.artifacts.findLast(a => a.key === key && a.valid);
export const locked = (p, key) => { const a = current(p, key); return !!(a?.approvedBy && a.review?.decision === 'approved'); };
export const audioLocked = p => ['script', 'audition', 'narration'].every(key => locked(p, key)) && !!current(p, 'clone');
export function assertAllowed(p, kind) {
  if (['reviewerQualification','videoPlan','videoPrompt','video','soundPlan','music','effect','editPlan','film'].includes(kind)) {
    if (!audioLocked(p)) throw new Error('AUDIO_LOCK_REQUIRED');
    if (!locked(p,'shots') || !current(p,'shots').content.shots.every(s=>locked(p,`keyframe:${s.id}`))) throw new Error('KEYFRAME_LOCK_REQUIRED: all current keyframes need agent and human approval.');
    if (kind !== 'reviewerQualification' && !locked(p,'reviewerQualification')) throw new Error('VISUAL_REVIEWER_NOT_QUALIFIED');
    if (['videoPrompt','video'].includes(kind) && !locked(p,'videoPlan')) throw new Error('VIDEO_PLAN_LOCK_REQUIRED');
    if (kind === 'video' && !locked(p,`videoPrompt:${p.clipId}`)) throw new Error('VIDEO_PROMPT_LOCK_REQUIRED');
    if (['music','effect','editPlan','film'].includes(kind) && !locked(p,'soundPlan')) throw new Error('SOUND_PLAN_LOCK_REQUIRED');
    if (['soundPlan','editPlan','film'].includes(kind) && !current(p,'videoPlan').content.clips.every(c=>locked(p,`video:${c.id}`))) throw new Error('VIDEO_LOCK_REQUIRED');
    if (kind === 'film' && (!locked(p,'editPlan') || !locked(p,'music') || !current(p,'soundPlan').content.effects.every(e=>locked(p,`effect:${e.id}`)))) throw new Error('EDIT_SOUND_LOCK_REQUIRED');
    return;
  }
  if ([...imageSteps, ...backgroundSteps, 'backgrounds', 'shots', 'keyframePrompt', 'keyframe', 'background', 'video'].includes(kind) && !audioLocked(p)) throw new Error('AUDIO_LOCK_REQUIRED: current script, clone audition and all four narration beats need agent and human approval.');
  if ([...backgroundSteps, 'backgrounds', 'shots', 'keyframePrompt', 'background', 'keyframe', 'video'].includes(kind)) {
    const roster = current(p, 'roster');
    if (!locked(p, 'roster') || !roster.content.characters.every(c => locked(p, `sheet:${c.id}`))) throw new Error('CHARACTER_LOCK_REQUIRED: every required character needs its own approved sheet.');
    if (['shots', 'keyframePrompt', 'keyframe'].includes(kind)) {
      const registry = current(p, 'backgrounds');
      if (!locked(p, 'backgrounds') || !registry.content.locations.every(l => locked(p, `backgroundCandidates:${l.id}`) && l.angles.every(a => locked(p, `backgroundAngle:${l.id}:${a.id}`)))) throw new Error('BACKGROUND_LOCK_REQUIRED: all required masters and angles need agent and human approval.');
      if (kind !== 'shots' && !locked(p, 'shots')) throw new Error('SHOT_LOCK_REQUIRED: approve the current shot plan first.');
    }
    if (['background'].includes(kind)) throw new Error('PRODUCTION_NOT_SPECIFIED: shot and video workflows are not yet defined.');
  }
}
