import { audioProject, send, approved, reviewed, produce, file } from './helpers.mjs';
import { current, taskFor, backgroundRecipeSha256 } from '../runtime/workflow.mjs';
import { criteria } from '../runtime/contracts.mjs';
export const image = n => ({ path: `/isolated-test/background-${n}.png`, sha256: file(n).sha256, bytes: 100, width: 1600, height: 900 });
export function backgroundProject() {
  let p = audioProject();
  p = approved(reviewed(send(p, 'artifact', { workerId: 'cast-owner', content: { characters: [{ id: 'alex', name: 'Alex', ageVariant: 'adult', important: true, references: [image(1)], notes: 'isolated fixture' }] } })));
  p = approved(reviewed(produce(p, { files: [1,2,3].map(image), prompt: 'character' })), { selection: 0 });
  p = reviewed(send(p, 'artifact', { workerId: 'sheet-writer', content: { prompt: 'sheet', recipeSha256: file().sha256, referenceSha256: image(1).sha256, turnaround: ['front','three-quarter','profile','back'], expressions: Array(8).fill('expression') } }));
  return approved(reviewed(produce(p, { files: [image(4)], prompt: 'sheet' })));
}
export const registry = { locations: ['home', 'shop'].map((id,i) => ({ id, name: id, scenes: [1,2].map((_,j) => ({ id: `${id}-${j}`, beat: i*2+j+1, description: 'A remembered bicycle repair.', action: 'Space to hold a bicycle.', characterIds: ['alex'], sourceAnswers: [] })), angles: [{ id: 'reverse', sceneIds: [`${id}-0`], direction: 'Reverse view preserving bicycle space.' }] })) };
export const author = (p, content, workerId = 'background-owner') => send(p, 'artifact', { workerId, content });
export function brief(p) { return { direction: 'A warm lived-in room with space to repair a bicycle. No people.', sceneIds: taskFor(p).immediateScenes.map(s => s.id), knownDetails: ['Bicycle repair'], proposedDetails: ['A wooden workbench'], continuityNotes: 'Keep the doorway and bicycle staging space.', references: [] }; }
export function prompt(p) { const b = p.artifacts.findLast(a => a.valid && a.kind === (p.step === 'backgroundPrompt' ? 'backgroundBrief' : 'backgroundAngleBrief') && a.key.includes(`:${p.locationId}`)); return { prompt: p.step === 'backgroundPrompt' ? 'An empty stylised 3D room, workbench beside doorway, bicycle staging space.' : 'Using the reference room, reverse the camera and preserve its doorway and furnishings.', recipeSha256: backgroundRecipeSha256, briefDigest: b.digest, changeSummary: 'Staged the requested view.' }; }
export function ownerChecked(p, decision = 'approved') { const a=current(p); return send(p,'owner-review',{ workerId:'background-owner',artifactId:a.id,artifactDigest:a.digest,review:{ decision,perception:'direct-text',checks:criteria[p.step].map((criterion,i)=>({criterion,status:decision==='approved'?'pass':i===0?'fail':'pass',evidence:'Isolated evidenced fixture.',location:'prompt camera clause',repair:decision==='approved'?'':'Restore doorway.'})) } }); }
export function readyForMaster() {
  let p = approved(reviewed(author(backgroundProject(),registry)));
  p = approved(reviewed(author(p,brief(p))));
  return approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));
}
export function masterLocked() { let p=readyForMaster(); return approved(reviewed(produce(p,{files:[5,6,7].map(image),prompt:current(p,'backgroundPrompt:home').content.prompt})),{selection:1}); }
export function locationComplete(p=masterLocked()) {
  p=approved(reviewed(author(p,brief(p)))); p=approved(reviewed(ownerChecked(author(p,prompt(p),'pixar-prompter'))));
  return approved(reviewed(produce(p,{files:[image(8)],prompt:current(p,`backgroundAnglePrompt:${p.locationId}:${p.angleId}`).content.prompt})));
}
