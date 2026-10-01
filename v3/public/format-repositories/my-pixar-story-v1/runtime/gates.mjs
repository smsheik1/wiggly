export const keyFor = p => ['candidates', 'sheetPrompt', 'sheet'].includes(p.step) ? `${p.step}:${p.characterId}` : p.step;
export const current = (p, key = keyFor(p)) => p.artifacts.findLast(a => a.key === key && a.valid);
export const locked = (p, key) => { const a = current(p, key); return !!(a?.approvedBy && a.review?.decision === 'approved'); };
export const audioLocked = p => ['script', 'audition', 'narration'].every(key => locked(p, key)) && !!current(p, 'clone');
export function assertAllowed(p, kind) {
  if (['candidates', 'sheet', 'keyframe', 'background', 'video'].includes(kind) && !audioLocked(p)) throw new Error('AUDIO_LOCK_REQUIRED: current script, clone audition and all four narration beats need agent and human approval.');
  if (['background', 'keyframe', 'video'].includes(kind)) {
    const roster = current(p, 'roster');
    if (!locked(p, 'roster') || !roster.content.characters.every(c => locked(p, `sheet:${c.id}`))) throw new Error('CHARACTER_LOCK_REQUIRED: every required character needs its own approved sheet.');
    throw new Error('PRODUCTION_NOT_SPECIFIED: background, shot and video workflows are not yet defined.');
  }
}
