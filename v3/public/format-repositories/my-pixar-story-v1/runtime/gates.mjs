export const backgroundSteps = ['backgroundBrief', 'backgroundPrompt', 'backgroundCandidates', 'backgroundAngleBrief', 'backgroundAnglePrompt', 'backgroundAngle'];
export const imageSteps = ['candidates', 'sheet', 'backgroundCandidates', 'backgroundAngle', 'keyframe'];
export const authorSteps = ['script', 'roster', 'sheetPrompt', 'backgrounds', 'backgroundBrief', 'backgroundPrompt', 'backgroundAngleBrief', 'backgroundAnglePrompt', 'shots', 'keyframePrompt'];
export const keyFor = p => ['keyframePrompt', 'keyframe'].includes(p.step) ? `${p.step}:${p.shotId}` : backgroundSteps.includes(p.step) ? `${p.step}:${p.locationId}${p.step.startsWith('backgroundAngle') ? ':' + p.angleId : ''}` : ['candidates', 'sheetPrompt', 'sheet'].includes(p.step) ? `${p.step}:${p.characterId}` : p.step;
export const current = (p, key = keyFor(p)) => p.artifacts.findLast(a => a.key === key && a.valid);
export const locked = (p, key) => { const a = current(p, key); return !!(a?.approvedBy && a.review?.decision === 'approved'); };
export const audioLocked = p => ['script', 'audition', 'narration'].every(key => locked(p, key)) && !!current(p, 'clone');
export function assertAllowed(p, kind) {
  if ([...imageSteps, ...backgroundSteps, 'backgrounds', 'shots', 'keyframePrompt', 'keyframe', 'background', 'video'].includes(kind) && !audioLocked(p)) throw new Error('AUDIO_LOCK_REQUIRED: current script, clone audition and all four narration beats need agent and human approval.');
  if ([...backgroundSteps, 'backgrounds', 'shots', 'keyframePrompt', 'background', 'keyframe', 'video'].includes(kind)) {
    const roster = current(p, 'roster');
    if (!locked(p, 'roster') || !roster.content.characters.every(c => locked(p, `sheet:${c.id}`))) throw new Error('CHARACTER_LOCK_REQUIRED: every required character needs its own approved sheet.');
    if (['shots', 'keyframePrompt', 'keyframe'].includes(kind)) {
      const registry = current(p, 'backgrounds');
      if (!locked(p, 'backgrounds') || !registry.content.locations.every(l => locked(p, `backgroundCandidates:${l.id}`) && l.angles.every(a => locked(p, `backgroundAngle:${l.id}:${a.id}`)))) throw new Error('BACKGROUND_LOCK_REQUIRED: all required masters and angles need agent and human approval.');
      if (kind !== 'shots' && !locked(p, 'shots')) throw new Error('SHOT_LOCK_REQUIRED: approve the current shot plan first.');
    }
    if (['background', 'video'].includes(kind)) throw new Error('PRODUCTION_NOT_SPECIFIED: shot and video workflows are not yet defined.');
  }
}
