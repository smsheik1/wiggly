import { current, taskFor } from '../runtime/workflow.mjs';
import { author, brief, prompt, ownerChecked, locationComplete, image } from './background-helpers.mjs';
import { approved, reviewed, produce } from './helpers.mjs';
export function shotsProject() {
  let p = locationComplete();
  p = approved(reviewed(author(p, brief(p))));
  p = approved(reviewed(ownerChecked(author(p, prompt(p), 'pixar-prompter'))));
  p = approved(reviewed(produce(p, { files: [5,6,7].map(image), prompt: current(p, 'backgroundPrompt:shop').content.prompt })), { selection: 2 });
  return locationComplete(p);
}
export const shotPlan = { shots: ['home', 'shop'].flatMap((locationId, i) => [0,1].map(j => ({ id: `${locationId}-${j}-wide`, locationId, sceneId: `${locationId}-${j}`, angleId: j === 0 ? 'reverse' : null, beat: i * 2 + j + 1, startSeconds: 0, durationSeconds: 15, characterIds: ['alex'], camera: 'Wide view at child height.', action: 'Alex holds the bicycle steady.', staging: 'Feet on floor, hands contact bicycle, doorway clear.', continuityNotes: 'Preserve workbench and doorway.' }))) };
export function keyframeProject() { return approved(reviewed(author(shotsProject(), shotPlan, 'shot-planner'))); }
export function composition(p) { const task = taskFor(p); return { prompt: `Use image 1 for room geography and image 2 for Alex identity. ${task.shot.action} ${task.shot.staging} ${task.shot.camera} Single widescreen stylised 3D image.`, shotDigest: task.shotDigest, references: task.referenceBindings }; }
export function promptLocked(p = keyframeProject()) { return approved(reviewed(author(p, composition(p), 'composition-writer'))); }
export function generated(p = promptLocked()) { return produce(p, { files: [image(20)], prompt: current(p, `keyframePrompt:${p.shotId}`).content.prompt }); }
