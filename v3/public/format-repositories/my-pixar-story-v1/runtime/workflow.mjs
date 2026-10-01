import { extname } from 'node:path';
import { Annotation, Command, START, StateGraph, interrupt } from '@langchain/langgraph';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { requestDescriptor } from './providers.mjs';
import { VERSION, Inputs, Project, Content, Review, Event, Plans, criteria, digest } from './contracts.mjs';

import { keyFor, current, locked, audioLocked, assertAllowed } from './gates.mjs';
export { keyFor, current, locked, audioLocked, assertAllowed } from './gates.mjs';
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
export function revisionImpact(p, id) {
  const copy = structuredClone(p);
  if (!copy.artifacts.some(a => a.id === id && a.valid)) throw new Error('Artifact is stale or unknown.');
  const affected = invalidate(copy, id);
  return { affected, remainValid: copy.artifacts.filter(a => a.valid).map(a => a.id), note: 'Reopened approvals apply only to the listed dependencies.' };
}
export function dependencies(p) {
  const keys = {
    script: [], voiceSample: [], clone: ['voiceSample'], audition: ['clone', 'script'],
    narration: ['script', 'clone', 'audition'], roster: ['script'],
    candidates: ['roster'], sheetPrompt: [`candidates:${p.characterId}`],
    sheet: [`candidates:${p.characterId}`, `sheetPrompt:${p.characterId}`], backgrounds: ['roster'],
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
  p.gate = ['script', 'roster', 'sheetPrompt'].includes(p.step) ? 'author' : p.step === 'voiceSample' ? 'human' : p.step === 'backgrounds' ? 'pending' : 'produce';
  // Reopening a deliverable keeps unrelated locks; do not force their regeneration.
  const reusable = ['voiceSample', 'clone'].includes(p.step) ? !!current(p) : p.step === 'sheetPrompt' ? current(p)?.review?.decision === 'approved' : locked(p, keyFor(p));
  if (p.step !== 'backgrounds' && reusable) next(p);
}
function addArtifact(p, content, author) {
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
  if (['candidates', 'sheet'].includes(p.step) && parsed.files.some(f => !f.width || !f.height || f.durationSeconds)) throw new Error('Character generations must contain measured still images.');
  if (p.step === 'sheetPrompt') {
    const candidate = current(p, `candidates:${p.characterId}`);
    if (parsed.referenceSha256 !== candidate.content.files[candidate.selection].sha256) throw new Error('Sheet prompt must bind the actual selected character image.');
  }
  if (p.step === 'sheet' && parsed.prompt !== current(p, `sheetPrompt:${p.characterId}`).content.prompt) throw new Error('Sheet must use the reviewed prompt exactly.');
  const a = { id: `${key}@${version}`, key, kind: p.step, version, digest: digest(parsed), content: parsed,
    dependencies: dependencies(p), valid: true, authoredBy: author };
  p.artifacts.push(a);
  if (p.step === 'voiceSample' || p.step === 'clone') next(p);
  else p.gate = 'review';
}
export function taskFor(p) {
  const a = current(p);
  const job = p.jobs.findLast(j => j.key === keyFor(p) && !['ready', 'failed'].includes(j.status));
  return { taskId: digest({ id: p.id, sequence: p.sequence, step: p.step, gate: p.gate }), projectId: p.id,
    step: p.step, gate: p.gate, characterId: p.characterId, actor: p.gate === 'review' ? 'reviewer' : ['human', 'authorize', 'escalate'].includes(p.gate) ? 'human' : 'agent',
    artifact: a ?? null, job: job ?? null, inputs: p.inputs,
    dependencies: dependencies(p).map(id => p.artifacts.find(a => a.id === id)),
    feedback: p.feedback.filter(f => f.key === keyFor(p)), criteria: criteria[p.step] ?? [],
    instruction: p.gate === 'pending' ? 'Character design is locked. Background/video workflow design is pending; do not generate or finalize a film.' : p.gate === 'review' ? 'Inspect the actual current artifact. Every rejection needs localized evidence and a repair. Do not reject for taste. Missing direct perception is inconclusive. Use a different worker from the author.' : p.gate === 'produce' ? 'Prepare an exact generation plan and estimate; do not submit a paid call before its authorization. Use approved references and the selected clone.' : p.gate === 'collect' ? 'Collect or reconcile this same request. Never resubmit because polling or a process ended.' : 'Operate the current deliverable only. Use the packaged contracts and review rubric.',
  };
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
    const a = p.artifacts.find(a => a.id === e.artifactId && a.valid);
    if (!a || a.digest !== e.artifactDigest || !e.message) throw new Error('Revision needs the current artifact ID/digest and explicit user feedback.');
    invalidate(p, a.id);
    p.step = a.kind; p.characterId = a.key.includes(':') ? a.key.split(':')[1] : null;
    p.gate = ['script', 'roster', 'sheetPrompt'].includes(a.kind) ? 'author' : a.kind === 'voiceSample' ? 'human' : 'produce';
    p.feedback.push({ key: a.key, message: e.message }); p.reviewDisagreements = 0;
  } else if (e.action === 'artifact') {
    if (!(p.gate === 'author' || (p.step === 'voiceSample' && p.gate === 'human')) || !Content[p.step]) throw new Error('Artifact submission is not allowed here.');
    requiredActor(e, p.step === 'voiceSample' ? 'human' : 'agent');
    if (!e.workerId) throw new Error('Artifact author worker ID is required.');
    addArtifact(p, e.content, e.workerId);
  } else if (e.action === 'review') {
    requiredActor(e, 'reviewer');
    const a = current(p);
    if (p.gate !== 'review' || !a || e.artifactId !== a.id || e.artifactDigest !== a.digest || !e.workerId || e.workerId === a.authoredBy) throw new Error('Review must bind the current artifact and use a distinct reviewer worker.');
    const r = Review.parse(e.review);
    const names = r.checks.map(c => c.criterion);
    if (names.length !== criteria[p.step].length || new Set(names).size !== names.length || criteria[p.step].some(c => !names.includes(c))) throw new Error('Every required criterion needs exactly one evidenced finding.');
    const perception = ['audition', 'narration'].includes(p.step) ? 'direct-audio' : ['candidates', 'sheet'].includes(p.step) ? 'direct-image' : 'direct-text';
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
    a.review = r;
    if (r.decision === 'approved') { p.gate = p.step === 'sheetPrompt' ? 'produce' : 'human'; if (p.step === 'sheetPrompt') next(p); }
    else { p.reviewDisagreements++; p.feedback.push({ key: a.key, message: JSON.stringify(r.checks.filter(c => c.status !== 'pass')) });
      p.gate = r.decision === 'inconclusive' || r.repairTarget === 'script' || p.reviewDisagreements >= 2 ? 'escalate' : ['script', 'roster', 'sheetPrompt'].includes(p.step) ? 'author' : 'produce'; }
  } else if (e.action === 'approve') {
    requiredActor(e, 'human');
    const a = current(p);
    if (p.gate !== 'human' || !a || a.review?.decision !== 'approved' || e.artifactId !== a.id || e.artifactDigest !== a.digest || !e.message) throw new Error('Human approval needs the exact current agent-passing artifact and original user message.');
    if (p.step === 'candidates') { if (![0, 1, 2].includes(e.selection)) throw new Error('Choose one of the three candidate indexes: 0, 1, 2.'); a.selection = e.selection; }
    a.approvedBy = { message: e.message, at: new Date().toISOString() }; next(p);
  } else if (e.action === 'resolve') {
    requiredActor(e, 'human');
    if (p.jobs.some(j => j.key === keyFor(p) && j.status === 'uncertain')) throw new Error('UNCERTAIN_JOB: reconcile the existing request; do not resolve into a new generation.');
    if (p.gate !== 'escalate' || !e.message) throw new Error('Resolution needs explicit user direction at an escalation.');
    p.feedback.push({ key: keyFor(p), message: e.message }); p.reviewDisagreements = 0;
    p.gate = current(p)?.review?.decision === 'inconclusive' ? 'review' : ['script', 'roster', 'sheetPrompt'].includes(p.step) ? 'author' : 'produce';
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
    if (plan.operation !== p.step || plan.provider !== (['candidates', 'sheet'].includes(p.step) ? 'meta-muse' : 'cartesia')) throw new Error('Provider/operation does not match the current stage.');
    if (['candidates', 'sheet'].includes(p.step) && !plan.parameters.prompt) throw new Error('Image plan needs an authored prompt.');
    if (p.step === 'sheet' && plan.parameters.prompt !== current(p, `sheetPrompt:${p.characterId}`).content.prompt) throw new Error('Use the approved sheet prompt exactly.');
    if (p.jobs.filter(j => j.key === keyFor(p) && JSON.stringify(j.dependencies) === JSON.stringify(dependencies(p)) && ['submitting', 'submitted', 'ready', 'uncertain'].includes(j.status)).length >= 3) throw new Error('ATTEMPT_LIMIT: three generation requests for these dependencies. Stop and resolve the deliverable with the user.');
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
    if (e.action === 'receipt') { if (['candidates', 'sheet'].includes(p.step) && e.result?.prompt !== j.request.prompt) throw new Error('Receipt prompt differs from authorized request.'); if (['audition', 'narration'].includes(p.step) && e.result?.voiceId !== j.request.voice) throw new Error('Receipt voice differs from authorized request.'); if (!['submitting', 'submitted', 'uncertain'].includes(j.status)) throw new Error('No submitted job to collect.'); addArtifact(p, e.result, 'provider-runtime'); j.status = 'ready'; j.result = e.result; }
    if (e.action === 'provider-error') { if (!e.message) throw new Error('Provider error needs diagnostics.'); j.status = 'uncertain'; p.gate = 'escalate'; }
  } else throw new Error('Unsupported action.');
  p.sequence++;
  p.history.push({ sequence: p.sequence, action: e.action, actor: e.actor, message: e.message ?? '', at: new Date().toISOString() });
  return Project.parse(p);
}

export function openWorkflow(databasePath) {
  const saver = SqliteSaver.fromConnString(databasePath);
  const State = Annotation.Root({ project: Annotation({ reducer: (_old, value) => value }) });
  const route = state => ['author', 'review', 'human', 'produce', 'authorize', 'collect', 'escalate', 'pending'].includes(state.project.gate) ? state.project.gate : 'pending';
  const builder = new StateGraph(State);
  // Nodes contain no external side effects. A resumed interrupt may replay this node safely.
  for (const name of ['author', 'review', 'human', 'produce', 'authorize', 'collect', 'escalate', 'pending']) {
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
