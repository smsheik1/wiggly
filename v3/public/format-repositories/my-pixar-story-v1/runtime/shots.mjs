import { current, locked, supervised } from './gates.mjs';
import { digest } from './contracts.mjs';
export const shotFor = p => current(p, 'shots')?.content.shots.find(s => s.id === p.shotId);
export function shotReferences(p, shot = shotFor(p)) {
  const background = current(p, shot.angleId ? `backgroundAngle:${shot.locationId}:${shot.angleId}` : `backgroundCandidates:${shot.locationId}`);
  const setting = background.content.files[shot.angleId ? 0 : background.selection];
  return [{ role: 'setting', artifactId: background.id, sha256: setting.sha256, file: setting }, ...shot.characterIds.map(characterId => {
    const sheet = current(p, `sheet:${characterId}`), file = sheet.content.files[0];
    return { role: 'character', characterId, artifactId: sheet.id, sha256: file.sha256, file };
  })];
}
export const referenceBindings = p => shotReferences(p).map(({ file, ...binding }) => binding);
export function validateLocationRegistry(p,locations){
 const ids=locations.map(l=>l.id),scenes=locations.flatMap(l=>l.scenes);
 if(new Set(ids).size!==ids.length||new Set(scenes.map(s=>s.id)).size!==scenes.length||[1,2,3,4].some(b=>!scenes.some(s=>s.beat===b)))throw new Error('Background registry needs unique locations/scenes covering all four beats.');
 const cast=current(p,'roster').content.characters.map(c=>c.id);
 for(const l of locations)if(new Set(l.angles.map(a=>a.id)).size!==l.angles.length||l.angles.some(a=>a.sceneIds.some(id=>!l.scenes.some(s=>s.id===id)))||l.scenes.some(s=>s.characterIds.some(id=>!cast.includes(id))))throw new Error('Background scenes/angles must bind established characters and local scenes.');
}
export function validateShots(p, content, planning=false) {
  const ids = content.shots.map(s => s.id);
  if (new Set(ids).size !== ids.length) throw new Error('Shot IDs must be unique.');
  for (const beat of [1,2,3,4]) {
    let end = 0;
    for (const shot of content.shots.filter(s => s.beat === beat)) {
      if (Math.abs(shot.startSeconds - end) > 0.000001) throw new Error('Shots must cover each beat without gaps or overlaps in timeline order.');
      end += shot.durationSeconds;
    }
    if (Math.abs(end - 15) > 0.000001) throw new Error('Each beat requires exactly 15 seconds of planned shots.');
  }
  if (content.shots.some((s, i) => i > 0 && s.beat < content.shots[i - 1].beat)) throw new Error('Shots must be ordered by beat.');
  const covered = new Set();
  for (const shot of content.shots) {
    const location = (planning?content.locations:current(p,'backgrounds').content.locations).find(l => l.id === shot.locationId);
    const scene = location?.scenes.find(s => s.id === shot.sceneId);
    if (!scene || scene.beat !== shot.beat || (shot.angleId && !location.angles.some(a => a.id === shot.angleId && a.sceneIds.includes(shot.sceneId)))) throw new Error('Shot must use its established scene, beat and approved local angle.');
    if (new Set(shot.characterIds).size !== shot.characterIds.length || shot.characterIds.length !== scene.characterIds.length || scene.characterIds.some(id => !shot.characterIds.includes(id))) throw new Error('Shot cast must match established scene characters and age variants.');
    if (!planning && shotReferences(p, shot).some(r => !locked(p, p.artifacts.find(a => a.id === r.artifactId).key))) throw new Error('Every shot reference must be agent and human locked.');
    covered.add(scene.id);
  }
  if ((planning?content.locations:current(p,'backgrounds').content.locations).flatMap(l => l.scenes).some(s => !covered.has(s.id))) throw new Error('Every established scene must have a planned shot.');
  if(!planning&&supervised(p)){const intents=current(p,'shotIntentions').content.shots,keys=['id','sceneId','locationId','angleId','beat','startSeconds','durationSeconds','characterIds','camera','action'];if(content.shots.length!==intents.length||content.shots.some((shot,i)=>keys.some(key=>digest(shot[key])!==digest(intents[i][key]))))throw new Error('Final staging must preserve approved shot intentions; explicitly revise intentions for creative changes.');}
}
export function validateKeyframePrompt(p, content) {
  if (content.shotDigest !== digest(shotFor(p)) || digest(content.references) !== digest(referenceBindings(p))) throw new Error('Composition prompt must bind this shot and exact approved setting/character reference images in order.');
}

export function planningReferences(p) {
  return current(p, 'backgrounds').content.locations.map(l => ({ id: l.id, name: l.name, scenes: l.scenes,
    master: current(p, `backgroundCandidates:${l.id}`),
    angles: l.angles.map(a => ({ ...a, artifact: current(p, `backgroundAngle:${l.id}:${a.id}`) })),
    characterSheets: [...new Set(l.scenes.flatMap(s => s.characterIds))].map(id => current(p, `sheet:${id}`)),
  }));
}
