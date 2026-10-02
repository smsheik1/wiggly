import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { Annotation, Command, START, StateGraph, interrupt } from '@langchain/langgraph';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { shotFor, shotReferences, referenceBindings, planningReferences, validateShots, validateKeyframePrompt } from './shots.mjs';
import { requestDescriptor } from './providers.mjs';
import { VERSION, Inputs, Project, Content, Review, Event, Plans, criteria, digest } from './contracts.mjs';

import { keyFor, current, locked, audioLocked, assertAllowed, backgroundSteps, imageSteps, authorSteps } from './gates.mjs';
export { keyFor, current, locked, audioLocked, assertAllowed } from './gates.mjs';
export const backgroundRecipe = readFileSync(new URL('../background-prompter.md', import.meta.url), 'utf8');
export const backgroundRecipeSha256 = createHash('sha256').update(backgroundRecipe).digest('hex');
const location = p => current(p, 'backgrounds')?.content.locations.find(l => l.id === p.locationId);
const briefKey = p => `${p.step === 'backgroundAnglePrompt' ? 'backgroundAngleBrief' : 'backgroundBrief'}:${p.locationId}${p.step === 'backgroundAnglePrompt' ? ':' + p.angleId : ''}`;
const promptKey = p => `${p.step === 'backgroundAngle' ? 'backgroundAnglePrompt' : 'backgroundPrompt'}:${p.locationId}${p.step === 'backgroundAngle' ? ':' + p.angleId : ''}`;
const isPrompt = p => ['backgroundPrompt', 'backgroundAnglePrompt'].includes(p.step);
export function initialProject(id, inputs) {
  return Project.parse({ formatVersion: VERSION, schemaVersion: 2, id, inputs: Inputs.parse(inputs), step: 'script', gate: 'author', characterId: null,
    sequence: 0, artifacts: [], jobs: [], history: [], allowances: [], feedback: [], reviewDisagreements: 0 });
}
function invalidate(p, id) {
  const affected = new Set([id]);
  for (const a of p.artifacts) if (a.dependencies.some(dep => affected.has(dep))) affected.add(a.id);
  for (const a of p.artifacts) if (affected.has(a.id)) a.valid = false;
  return [...affected];
}
function revisionRoot(p, a) {
  if (a.kind === 'keyframe') return current(p, a.key.replace('keyframe:', 'keyframePrompt:')) ?? a;
  if (!['backgroundCandidates', 'backgroundAngle'].includes(a.kind)) return a;
  const key = a.key.replace(a.kind, a.kind === 'backgroundCandidates' ? 'backgroundBrief' : 'backgroundAngleBrief');
  return current(p, key) ?? a;
}
export function revisionImpact(p, id) {
  const copy = structuredClone(p);
  if (!copy.artifacts.some(a => a.id === id && a.valid)) throw new Error('Artifact is stale or unknown.');
  const affected = invalidate(copy, revisionRoot(copy, copy.artifacts.find(a => a.id === id)).id);
  return { affected, remainValid: copy.artifacts.filter(a => a.valid).map(a => a.id), note: 'Reopened approvals apply only to the listed dependencies.' };
}
export function dependencies(p) {
  const keys = {
    script: [], voiceSample: [], clone: ['voiceSample'], audition: ['clone', 'script'],
    narration: ['script', 'clone', 'audition'], roster: ['script'],
    candidates: ['roster'], sheetPrompt: [`candidates:${p.characterId}`],
    sheet: [`candidates:${p.characterId}`, `sheetPrompt:${p.characterId}`], backgrounds: ['script', 'narration', 'roster', ...(current(p, 'roster')?.content.characters ?? []).map(c => `sheet:${c.id}`)],
    backgroundBrief: ['backgrounds'], backgroundPrompt: [`backgroundBrief:${p.locationId}`],
    backgroundCandidates: [`backgroundPrompt:${p.locationId}`],
    backgroundAngleBrief: ['backgrounds', `backgroundCandidates:${p.locationId}`],
    backgroundAnglePrompt: [`backgroundAngleBrief:${p.locationId}:${p.angleId}`, `backgroundCandidates:${p.locationId}`],
    backgroundAngle: [`backgroundAnglePrompt:${p.locationId}:${p.angleId}`, `backgroundCandidates:${p.locationId}`], shots: ['backgrounds', 'script', 'narration'],
    keyframePrompt: ['shots', ...(['keyframePrompt', 'keyframe'].includes(p.step) ? shotReferences(p).map(r => p.artifacts.find(a => a.id === r.artifactId).key) : [])],
    keyframe: ['shots', `keyframePrompt:${p.shotId}`, ...(['keyframePrompt', 'keyframe'].includes(p.step) ? shotReferences(p).map(r => p.artifacts.find(a => a.id === r.artifactId).key) : [])], video: ['shots'],
  }[p.step];
  return keys.map(key => { const a = current(p, key); if (!a) throw new Error(`Missing current dependency ${key}`); return a.id; });
}
function next(p) {
  p.reviewDisagreements = 0;
  const steps = ['script', 'voiceSample', 'clone', 'audition', 'narration', 'roster'];
  const i = steps.indexOf(p.step);
  if (i >= 0 && i < steps.length - 1) p.step = steps[i + 1];
  else if (p.step === 'roster') { p.characterId = current(p, 'roster').content.characters[0].id; p.step = 'candidates'; }
  else if (p.step === 'candidates') p.step = 'sheetPrompt';
  else if (p.step === 'sheetPrompt') p.step = 'sheet';
  else if (p.step === 'sheet') {
    const missing = current(p, 'roster').content.characters.find(c => !locked(p, `sheet:${c.id}`));
    p.characterId = missing?.id ?? null;
    p.step = missing ? 'candidates' : 'backgrounds';
  }
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
  else if (p.step === 'keyframe') { const missing = current(p, 'shots').content.shots.find(s => !locked(p, `keyframe:${s.id}`)); p.shotId = missing?.id ?? null; p.step = missing ? 'keyframePrompt' : 'video'; }
  p.gate = authorSteps.includes(p.step) ? 'author' : p.step === 'voiceSample' ? 'human' : p.step === 'video' ? 'pending' : 'produce';
  // Reopening a deliverable keeps unrelated locks; do not force their regeneration.
  const reusable = ['voiceSample', 'clone'].includes(p.step) ? !!current(p) : p.step === 'sheetPrompt' ? current(p)?.review?.decision === 'approved' : locked(p, keyFor(p));
  if (p.step !== 'video' && reusable) next(p);
}
function addArtifact(p, content, author) {
  if (backgroundSteps.includes(p.step) || ['backgrounds', 'shots', 'keyframePrompt', 'keyframe'].includes(p.step)) assertAllowed(p, p.step);
  const key = keyFor(p);
  for (const a of p.artifacts.filter(a => a.key === key && a.valid)) invalidate(p, a.id);
  const version = p.artifacts.filter(a => a.key === key).length + 1;
  const parsed = Content[p.step].parse(content);
  if (p.step === 'voiceSample' && (parsed.files[0].bytes > 16 * 1024 * 1024 || !['.wav', '.mp3', '.flac', '.ogg'].includes(extname(parsed.files[0].path).toLowerCase()))) throw new Error('Cartesia sample must be WAV/MP3/FLAC/OGG under 16 MB. Convert it locally without changing tempo before submission.');
  if (p.step === 'voiceSample' && (!parsed.files[0].durationSeconds || parsed.files[0].durationSeconds < 10)) throw new Error('Voice sample must contain at least 10 seconds of measured audio.');
  if (p.step === 'audition' && (parsed.voiceId !== current(p, 'clone').content.voiceId || parsed.transcript !== current(p, 'script').content.beats[0].narration)) throw new Error('Audition must use the current clone and locked narration.');
  if (p.step === 'narration') {
    if (parsed.voiceId !== current(p, 'clone').content.voiceId) throw new Error('Narration must use the current clone.');
    if (parsed.files.some(f => !f.durationSeconds)) throw new Error('Narration needs measured durations.');
    if (parsed.transcripts.some((t, i) => t !== current(p, 'script').content.beats[i].narration)) throw new Error('Generated narration transcripts must equal locked script text.');
  }
  if (p.step === 'roster' && parsed.characters.some(c => c.references.some(f => !f.width || !f.height || f.durationSeconds))) throw new Error('Character references must be measured still images.');
  if (imageSteps.includes(p.step) && parsed.files.some(f => !f.width || !f.height || f.durationSeconds)) throw new Error('Character generations must contain measured still images.');
  if (p.step === 'sheetPrompt') {
    const candidate = current(p, `candidates:${p.characterId}`);
    if (parsed.referenceSha256 !== candidate.content.files[candidate.selection].sha256) throw new Error('Sheet prompt must bind the actual selected character image.');
  }
  if (p.step === 'sheet' && parsed.prompt !== current(p, `sheetPrompt:${p.characterId}`).content.prompt) throw new Error('Sheet must use the reviewed prompt exactly.');
  if (p.step === 'backgrounds') {
    const ids = parsed.locations.map(l => l.id), scenes = parsed.locations.flatMap(l => l.scenes);
    if (new Set(ids).size !== ids.length || new Set(scenes.map(s => s.id)).size !== scenes.length || [1,2,3,4].some(b => !scenes.some(s => s.beat === b))) throw new Error('Background registry needs unique locations/scenes covering all four beats.');
    const cast = current(p, 'roster').content.characters.map(c => c.id);
    for (const l of parsed.locations) {
      if (new Set(l.angles.map(a => a.id)).size !== l.angles.length || l.angles.some(a => a.sceneIds.some(id => !l.scenes.some(s => s.id === id))) || l.scenes.some(s => s.characterIds.some(id => !cast.includes(id)))) throw new Error('Background scenes/angles must bind established characters and local scenes.');
    }
  }
  if (['backgroundBrief', 'backgroundAngleBrief'].includes(p.step)) {
    const allowed = p.step === 'backgroundAngleBrief' ? location(p).angles.find(a => a.id === p.angleId).sceneIds : location(p).scenes.map(s => s.id);
    if (new Set(parsed.sceneIds).size !== parsed.sceneIds.length || allowed.some(id => !parsed.sceneIds.includes(id)) || parsed.sceneIds.some(id => !allowed.includes(id))) throw new Error('Brief must cover exactly its immediate scenes.');
    if (parsed.references.some(f => !f.width || !f.height || f.durationSeconds)) throw new Error('Background references must be measured still images.');
  }
  if (isPrompt(p)) {
    const brief = current(p, briefKey(p));
    if (!locked(p, brief.key) || author === brief.authoredBy || parsed.briefDigest !== brief.digest || parsed.recipeSha256 !== backgroundRecipeSha256) throw new Error('Prompter must be distinct from owner and bind the approved brief and packaged Pixar recipe.');
  }
  if (['backgroundCandidates', 'backgroundAngle'].includes(p.step) && parsed.files.some(f => Math.abs(f.width / f.height - 16 / 9) > 0.03)) throw new Error('Background plates must be measured 16:9 widescreen.');
  if (['backgroundCandidates', 'backgroundAngle'].includes(p.step) && parsed.prompt !== current(p, promptKey(p)).content.prompt) throw new Error('Background must use the approved prompt exactly.');
  if (p.step === 'shots') validateShots(p, parsed);
  if (p.step === 'keyframePrompt') validateKeyframePrompt(p, parsed);
  if (p.step === 'keyframe' && (parsed.prompt !== current(p, `keyframePrompt:${p.shotId}`).content.prompt || parsed.files.some(f => Math.abs(f.width / f.height - 16 / 9) > 0.03 || f.width < 1280 || f.height < 720))) throw new Error('Keyframe must use the approved prompt and measured 16:9 production image (at least 1280×720).');
  const a = { id: `${key}@${version}`, key, kind: p.step, version, digest: digest(parsed), content: parsed,
    dependencies: dependencies(p), valid: true, authoredBy: author };
  p.artifacts.push(a);
  if (p.step === 'voiceSample' || p.step === 'clone') next(p);
  else p.gate = isPrompt(p) ? 'owner-review' : 'review';
}
export function taskFor(p) {
  const a = current(p);
  const shot = ['keyframePrompt', 'keyframe'].includes(p.step) ? shotFor(p) : null;
  const sceneLocation = shot ? current(p, 'backgrounds').content.locations.find(l => l.id === shot.locationId) : location(p);
  const job = p.jobs.findLast(j => j.key === keyFor(p) && !['ready', 'failed'].includes(j.status));
  return { taskId: digest({ id: p.id, sequence: p.sequence, step: p.step, gate: p.gate }), projectId: p.id,
    step: p.step, gate: p.gate, characterId: p.characterId, locationId: p.locationId, angleId: p.angleId, shotId: p.shotId,
    shot,
    ...(p.step === 'shots' ? { availableLocations: planningReferences(p) } : {}),
    ...(['keyframePrompt', 'keyframe'].includes(p.step) ? { references: shotReferences(p), referenceBindings: referenceBindings(p), shotDigest: digest(shotFor(p)) } : {}),
    role: p.gate === 'review' ? 'independent-reviewer' : p.gate === 'author' && p.step === 'shots' ? 'shot-planner' : p.gate === 'author' && p.step === 'keyframePrompt' ? 'composition-writer' : p.gate === 'owner-review' || ['backgrounds', 'backgroundBrief', 'backgroundAngleBrief'].includes(p.step) ? 'background-product-owner' : isPrompt(p) && p.gate === 'author' ? 'pixar-prompter' : 'orchestrator',
    immediateScenes: sceneLocation?.scenes.filter(s => shot ? s.id === shot.sceneId : !p.angleId || sceneLocation.angles.find(a => a.id === p.angleId)?.sceneIds.includes(s.id)) ?? [],
    approvedScript: current(p, 'script') ?? null, inputPriority: ['immediateScenes', 'approvedScript', 'inputs.answers'],
    ...(isPrompt(p) ? { recipe: { content: backgroundRecipe, sha256: backgroundRecipeSha256 }, ownerWorkerId: current(p, briefKey(p))?.authoredBy } : {}),
    actor: p.gate === 'review' ? 'reviewer' : ['human', 'authorize', 'escalate'].includes(p.gate) ? 'human' : 'agent',
    artifact: a ?? null, job: job ?? null, inputs: p.inputs,
    dependencies: dependencies(p).map(id => p.artifacts.find(a => a.id === id)),
    feedback: p.feedback.filter(f => f.key === keyFor(p)), criteria: criteria[p.step] ?? [],
    instruction: p.gate === 'pending' ? p.step === 'shots' ? 'Older checkpoint paused at shots; explicit human start-shots opens shot planning without resetting state.' : p.step === 'backgrounds' ? 'Older checkpoint paused at backgrounds; explicit human start-backgrounds opens the new workflow without resetting state.' : 'Keyframes are locked. Video workflow design is pending; do not generate or finalize a film.' : p.gate === 'owner-review' ? 'The original background owner checks the complete technical prompt against the approved plain-language brief. Evidence and specific repairs are mandatory.' : p.gate === 'review' ? 'Inspect the actual current artifact. Every rejection needs localized evidence and a repair. Do not reject for taste. Missing direct perception is inconclusive. Use a different worker from the author.' : p.gate === 'produce' ? 'Prepare an exact generation plan and estimate; do not submit a paid call before its authorization. Use approved references and the selected clone.' : p.gate === 'collect' ? 'Collect or reconcile this same request. Never resubmit because polling or a process ended.' : ['backgroundBrief', 'backgroundAngleBrief'].includes(p.step) ? 'Write ordinary human direction as the background product owner, not a technical image prompt. Immediate scene first, approved script second, questionnaire supporting only. Separate known facts from proposed furnishings; ask about missing meaningful facts. Preserve the selected master for each angle.' : p.step === 'shots' ? 'Plan shots for the approved immediate scenes. Cover exactly four 15-second beats without gaps/overlaps. Bind scene, cast/age variants and approved background angle. These are still keyframes; shot duration does not authorize any video generation.' : p.step === 'keyframePrompt' ? 'Write the full composition prompt using the actual setting and character reference images in supplied order. Setting controls geography; sheets control identity/age/wardrobe. Stage correct hands, contacts, props, proportions, camera and emotional acting. Single full-frame 16:9 production image, never a collage or storyboard crop. Bind shotDigest and referenceBindings. Repair only evidenced defects.' : 'Operate the current deliverable only. Use the packaged contracts and review rubric.',
  };
}
function repairKeyframe(p, message) {
  const prompt = current(p, `keyframePrompt:${p.shotId}`); invalidate(p, prompt.id);
  p.feedback.push({ key: prompt.key, message });
  p.step = 'keyframePrompt'; p.gate = 'author';
}
const requiredActor = (e, actor) => { if (e.actor !== actor) throw new Error(`${e.action} requires ${actor} authority.`); };
export function applyEvent(project, raw) {
  const p = structuredClone(Project.parse(project));
  const e = Event.parse(raw);
  if (e.taskId !== taskFor(p).taskId) throw new Error('STALE_TASK: read current status before responding.');
  if (e.action === 'note') {
    if (!e.message) throw new Error('Note needs text.');
  } else if (['changes', 'reject'].includes(e.action)) {
    requiredActor(e, 'human');
    if (p.jobs.some(j => ['submitting', 'submitted', 'uncertain'].includes(j.status))) throw new Error('Reconcile all outstanding requests before a revision.');
    let a = p.artifacts.find(a => a.id === e.artifactId && a.valid);
    if (!a || a.digest !== e.artifactDigest || !e.message) throw new Error('Revision needs the current artifact ID/digest and explicit user feedback.');
    a = revisionRoot(p, a);
    invalidate(p, a.id);
    p.step = a.kind; const parts = a.key.split(':'); p.characterId = ['candidates', 'sheetPrompt', 'sheet'].includes(a.kind) ? parts[1] : null; p.locationId = backgroundSteps.includes(a.kind) ? parts[1] : null; p.angleId = a.kind.startsWith('backgroundAngle') ? parts[2] : null; p.shotId = ['keyframePrompt', 'keyframe'].includes(a.kind) ? parts[1] : null;
    p.gate = authorSteps.includes(a.kind) ? 'author' : a.kind === 'voiceSample' ? 'human' : 'produce';
    p.feedback.push({ key: a.key, message: e.message }); p.reviewDisagreements = 0;
  } else if (e.action === 'artifact') {
    if (!(p.gate === 'author' || (p.step === 'voiceSample' && p.gate === 'human')) || !Content[p.step]) throw new Error('Artifact submission is not allowed here.');
    requiredActor(e, p.step === 'voiceSample' ? 'human' : 'agent');
    if (!e.workerId) throw new Error('Artifact author worker ID is required.');
    addArtifact(p, e.content, e.workerId);
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
    const names = r.checks.map(c => c.criterion);
    if (names.length !== criteria[p.step].length || new Set(names).size !== names.length || criteria[p.step].some(c => !names.includes(c))) throw new Error('Every required criterion needs exactly one evidenced finding.');
    const perception = ['audition', 'narration'].includes(p.step) ? 'direct-audio' : imageSteps.includes(p.step) ? 'direct-image' : 'direct-text';
    if (r.decision === 'approved' && (r.perception !== perception || r.checks.some(c => c.status !== 'pass'))) throw new Error('Cannot approve missing perception or failing/inconclusive checks.');
    if (r.decision === 'rejected' && !r.checks.some(c => c.status === 'fail' && c.repair.trim())) throw new Error('Rejection requires a failed criterion and a specific repair.');
    if (r.checks.some(c => c.status === 'fail' && !c.repair.trim())) throw new Error('Every failure requires a specific repair.');
    if (r.decision === 'approved' && ['audition', 'narration'].includes(p.step)) {
      if (a.content.files.some(f => f.durationSeconds > 15)) throw new Error('Overlong narration cannot be approved; return the affected text to the writer, never accelerate it.');
      const m = r.measurements;
      if (!m || !m.speechToTextMethod || !m.speakerSimilarityMethod || m.speakerSimilarity === undefined || !m.measurementNotes || m.referenceSha256 !== current(p, 'voiceSample').content.files[0].sha256 || m.transcripts?.length !== a.content.files.length || m.speakingRateWpm?.length !== a.content.files.length || m.silenceSeconds?.length !== a.content.files.length) throw new Error('Audio pass requires transcript, speaking rate, silence and speaker-similarity measurements against the actual sample.');
      const words = s => s.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(' ') ?? '';
      if (m.transcripts.some((t, i) => words(t) !== words(current(p, 'script').content.beats[i].narration))) throw new Error('Speech-to-text differs from the locked script.');
    }
    if (ownerReview) a.ownerReview = r;
    if (ownerReview && r.decision === 'approved') p.gate = 'review';
    else {
    a.review = r;
    if (r.decision === 'approved') { p.gate = p.step === 'sheetPrompt' ? 'produce' : 'human'; if (p.step === 'sheetPrompt') next(p); }
    else {
      if (p.step === 'keyframe' && r.decision === 'rejected') {
        p.reviewDisagreements = 0;
        for (const frame of p.artifacts.filter(f => f.key === a.key && f.dependencies.includes(current(p, 'shots').id) && f.review).toReversed()) {
          if (frame.review.decision !== 'rejected') break;
          p.reviewDisagreements++;
        }
      } else p.reviewDisagreements++;
      p.feedback.push({ key: a.key, message: JSON.stringify(r.checks.filter(c => c.status !== 'pass')) });
      p.gate = r.decision === 'inconclusive' || r.repairTarget === 'script' || p.reviewDisagreements >= 2 ? 'escalate' : authorSteps.includes(p.step) ? 'author' : 'produce'; }
    }
    if (p.step === 'keyframe' && r.decision === 'rejected' && p.gate === 'produce') {
      repairKeyframe(p, JSON.stringify(r.checks.filter(c => c.status !== 'pass')));
    }
  } else if (e.action === 'approve') {
    requiredActor(e, 'human');
    const a = current(p);
    if (p.gate !== 'human' || !a || a.review?.decision !== 'approved' || e.artifactId !== a.id || e.artifactDigest !== a.digest || !e.message) throw new Error('Human approval needs the exact current agent-passing artifact and original user message.');
    if (['candidates', 'backgroundCandidates'].includes(p.step)) { if (![0, 1, 2].includes(e.selection)) throw new Error('Choose one of the three candidate indexes: 0, 1, 2.'); a.selection = e.selection; }
    a.approvedBy = { message: e.message, at: new Date().toISOString() }; next(p);
  } else if (e.action === 'resolve') {
    requiredActor(e, 'human');
    if (p.jobs.some(j => j.key === keyFor(p) && j.status === 'uncertain')) throw new Error('UNCERTAIN_JOB: reconcile the existing request; do not resolve into a new generation.');
    if (p.gate !== 'escalate' || !e.message) throw new Error('Resolution needs explicit user direction at an escalation.');
    p.feedback.push({ key: keyFor(p), message: e.message }); p.reviewDisagreements = 0;
    p.gate = isPrompt(p) && current(p)?.ownerReview?.decision === 'inconclusive' ? 'owner-review' : current(p)?.review?.decision === 'inconclusive' ? 'review' : authorSteps.includes(p.step) ? 'author' : 'produce';
    if (p.step === 'keyframe' && p.gate === 'produce') repairKeyframe(p, e.message);
  } else if (e.action === 'reconcile') {
    requiredActor(e, 'human'); const j = p.jobs.find(j => j.id === e.jobId);
    if (p.gate !== 'escalate' || !j || j.key !== keyFor(p) || j.status !== 'uncertain' || j.digest !== e.artifactDigest || !e.message) throw new Error('Reconciliation needs the exact uncertain job and explicit user direction.');
    if (e.result?.outcome === 'confirmed-no-result') { j.status = 'failed'; p.gate = 'produce'; } else p.gate = 'collect';
  } else if (e.action === 'allowance') {
    requiredActor(e, 'human');
    if (!e.allowance || !e.message) throw new Error('Allowance requires explicit user limits and original message.');
    p.allowances.push({ ...e.allowance, id: `allowance-${p.allowances.length + 1}`, message: e.message, at: new Date().toISOString() });
  } else if (e.action === 'plan') {
    requiredActor(e, 'agent');
    if (p.gate !== 'produce') throw new Error('Generation planning is not allowed here.');
    assertAllowed(p, p.step);
    const plan = Plans.parse(e.plan);
    if (plan.operation !== p.step || plan.provider !== (imageSteps.includes(p.step) ? 'meta-muse' : 'cartesia')) throw new Error('Provider/operation does not match the current stage.');
    if (imageSteps.includes(p.step) && !plan.parameters.prompt) throw new Error('Image plan needs an authored prompt.');
    if (['backgroundCandidates', 'backgroundAngle'].includes(p.step) && (!locked(p, promptKey(p)) || plan.parameters.prompt !== current(p, promptKey(p)).content.prompt)) throw new Error('Use the human-approved background prompt exactly.');
    if (p.step === 'keyframe' && (!locked(p, `keyframePrompt:${p.shotId}`) || plan.parameters.prompt !== current(p, `keyframePrompt:${p.shotId}`).content.prompt)) throw new Error('Use the human-approved keyframe prompt exactly.');
    if (p.step === 'sheet' && plan.parameters.prompt !== current(p, `sheetPrompt:${p.characterId}`).content.prompt) throw new Error('Use the approved sheet prompt exactly.');
    if (p.jobs.filter(j => j.key === keyFor(p) && (p.step === 'keyframe' ? j.dependencies.includes(current(p, 'shots').id) : JSON.stringify(j.dependencies) === JSON.stringify(dependencies(p))) && ['submitting', 'submitted', 'ready', 'uncertain'].includes(j.status)).length >= 3) throw new Error('ATTEMPT_LIMIT: three generation requests for these dependencies. Stop and resolve the deliverable with the user.');
    const request = requestDescriptor(p, plan);
    const bound = { plan, request, dependencies: dependencies(p) };
    const allowance = p.allowances.findLast(a => { const used = p.jobs.filter(j => j.allowanceId === a.id); return a.operations.includes(plan.operation) && used.length < a.maxRequests && used.reduce((n, j) => n + j.plan.estimatedCostUsd, 0) + plan.estimatedCostUsd <= a.maxCostUsd; });
    p.jobs.push({ id: `job-${p.jobs.length + 1}`, key: keyFor(p), plan, request, dependencies: bound.dependencies, digest: digest(bound), status: allowance ? 'authorized' : 'planned', ...(allowance ? { allowanceId: allowance.id, authorization: { message: allowance.message, at: new Date().toISOString() } } : {}) }); p.gate = allowance ? 'collect' : 'authorize';
  } else if (e.action === 'authorize') {
    requiredActor(e, 'human'); const j = p.jobs.findLast(j => j.key === keyFor(p));
    if (p.gate !== 'authorize' || j.status !== 'planned' || e.jobId !== j.id || e.artifactDigest !== j.digest || !e.message) throw new Error('Authorization must bind the exact generation request, estimate and current dependencies.');
    j.status = 'authorized'; j.authorization = { message: e.message, at: new Date().toISOString() }; p.gate = 'collect';
  } else if (['begin', 'job-id', 'receipt', 'provider-error'].includes(e.action)) {
    requiredActor(e, 'runtime'); const j = p.jobs.find(j => j.id === e.jobId);
    if (p.gate !== 'collect' || !j || j.key !== keyFor(p) || j.digest !== e.artifactDigest || j.dependencies.some(id => !p.artifacts.some(a => a.id === id && a.valid))) throw new Error('Job does not belong to the current authorized stage/dependencies.');
    assertAllowed(p, p.step);
    if (e.action === 'begin') { if (j.status !== 'authorized') throw new Error('ALREADY_SUBMITTED: collect/reconcile this job; do not make a duplicate paid request.'); j.status = 'submitting'; }
    if (e.action === 'job-id') { if (!['submitting', 'submitted'].includes(j.status) || !e.providerJobId) throw new Error('No submitted job to bind.'); j.providerJobId = e.providerJobId; j.status = 'submitted'; }
    if (e.action === 'receipt') { if (imageSteps.includes(p.step) && e.result?.prompt !== j.request.prompt) throw new Error('Receipt prompt differs from authorized request.'); if (['audition', 'narration'].includes(p.step) && e.result?.voiceId !== j.request.voice) throw new Error('Receipt voice differs from authorized request.'); if (!['submitting', 'submitted', 'uncertain'].includes(j.status)) throw new Error('No submitted job to collect.'); addArtifact(p, e.result, 'provider-runtime'); j.status = 'ready'; j.result = e.result; }
    if (e.action === 'provider-error') { if (!e.message) throw new Error('Provider error needs diagnostics.'); j.status = 'uncertain'; p.gate = 'escalate'; }
  } else throw new Error('Unsupported action.');
  p.sequence++;
  p.history.push({ sequence: p.sequence, action: e.action, actor: e.actor, message: e.message ?? '', at: new Date().toISOString() });
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
    async init(id, inputs) {
      if ((await graph.getState(config(id))).values.project) throw new Error('Run already exists. Existing runs are never reset or silently migrated.');
      await graph.invoke({ project: initialProject(id, inputs) }, config(id)); return this.status(id);
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
