import { readFile } from 'node:fs/promises';
import { initialProject, applyEvent, taskFor, current } from '../runtime/workflow.mjs';
import { criteria } from '../runtime/contracts.mjs';
export const inputs = JSON.parse(await readFile(new URL('../examples/parent.json', import.meta.url), 'utf8'));
export const script = {
  beats: [
    ['Dad taught me to fix bicycles. When the bell fell off, we both laughed.', 'scene1Childhood'],
    ['My first ride alone ended with a flat tire. Dad came to help.', 'scene2TeenFreedom'],
    ['Years later, I opened a bike shop. Dad painted the sign. Your mom brought coffee.', 'scene3LeapOfFaith'],
    ['Mia, now I hold your bicycle steady. Falling is okay. We can try again together.', 'scene5LegacyFinale'],
  ].map(([narration, source], i) => ({ beat: i + 1, durationSeconds: 15, narration, emotionalPurpose: ['connection', 'care', 'courage', 'belonging'][i], sourceAnswers: [source] })),
  commonSenseChecks: [{ category: 'age', finding: 'Alex appears as a child and adult.', resolution: 'User must provide reference photos for both ages before character generation.' }],
};
export const file = (n = 0, durationSeconds = 12) => ({ path: `/isolated-test/asset-${n}.wav`, sha256: String(n).padStart(64, '0'), bytes: 1024, durationSeconds });
export const audioQualification={workerId:'audio-reviewer',modelVersion:'ISOLATED-audio-v1',capabilityVersion:'ISOLATED-tools-v1',datasetDigest:'isolated-audio-labels',predictionDigest:'isolated-audio-predictions',qualified:true,verifiedMedia:true,cases:24,evaluatedAt:'2026-10-02T00:00:00Z',productionApproval:false,evidenceDirectory:'/isolated-test/audio-qualification',metrics:['integrity','transcript','natural-rate','voice-match','mix','safety'].map(criterion=>({criterion,passes:2,defects:2,errors:0,qualified:true}))};
export const qualifyTestAudio=p=>approved(reviewed(send(p,'audio-qualified',{actor:'runtime',content:audioQualification})));
let capture = null;
export function captureEvents(fn) { capture = []; try { const project = fn(); return { project, events: capture }; } finally { capture = null; } }
export function event(p, action, extra = {}) { const value = { taskId: taskFor(p).taskId, action, actor: ['approve', 'changes', 'reject', 'resolve', 'authorize', 'allowance', 'reconcile'].includes(action) ? 'human' : action === 'review' ? 'reviewer' : ['begin', 'job-id', 'receipt', 'provider-error'].includes(action) ? 'runtime' : 'agent', ...extra }; if (capture) capture.push(structuredClone(value)); return value; }
export const send = (p, action, extra) => applyEvent(p, event(p, action, extra));
export const authored = p => send(p, 'artifact', { workerId: 'writer', content: script });
export function reviewed(p, decision = 'approved', extra = {}) {
  if(p.step==='film'&&decision==='approved'&&!current(p).visualReview&&extra.perception!=='direct-video'){p=reviewed(p,'approved',{...extra,perception:'direct-video',checks:taskFor(p).criteria.map(criterion=>({criterion,status:'pass',evidence:'ISOLATED visual check',location:'whole fixture',repair:''}))});}
  const a = current(p); const audio=['audition','narration','music','effect'].includes(p.step)||(p.step==='film'&&!!a.visualReview); const perception = ['audition', 'narration'].includes(p.step) ? 'direct-audio' : ['candidates', 'sheet', 'backgroundCandidates', 'backgroundAngle', 'keyframe'].includes(p.step) ? 'direct-image' : p.step==='video'?'direct-video':p.step==='film'?(audio?'direct-audio':'direct-video'):['music','effect'].includes(p.step)?'direct-audio':'direct-text';
  const measurements = ['audition', 'narration'].includes(p.step) ? { transcripts: p.step === 'audition' ? [script.beats[0].narration] : script.beats.map(b => b.narration), speechToTextMethod: 'ISOLATED TEST STT',
    referenceSha256: file().sha256, speakerSimilarity: 0.9, speakerSimilarityMethod: 'ISOLATED TEST embedding model', speakingRateWpm: Array(p.step === 'audition' ? 1 : 4).fill(80),
    silenceSeconds: Array(p.step === 'audition' ? 1 : 4).fill(0), measurementNotes: 'ISOLATED TEST ONLY: no audio-quality claim.' } : undefined;
  return send(p, 'review', { workerId: audio?'audio-reviewer':'reviewer', artifactId: a.id, artifactDigest: a.digest,
    review: { decision, perception, checks: taskFor(p).criteria.map((criterion, i) => ({ criterion, status: decision === 'approved' ? 'pass' : i === 0 ? 'fail' : 'pass', location: 'beat 1',
      evidence: decision === 'approved' ? 'Isolated contract test finding.' : 'Locked intake says bicycle; draft incorrectly says airplane.', repair: decision === 'approved' ? '' : 'Restore the bicycle.' })), measurements,...(audio?{modelVersion:'ISOLATED-audio-v1',capabilityVersion:'ISOLATED-tools-v1',coverage:{artifactSha256:a.content.files[0].sha256,audioFiles:a.content.files.map(f=>({sha256:f.sha256,seconds:f.durationSeconds}))}}:{}), ...(['video','film'].includes(p.step)&&!audio?{modelVersion:'ISOLATED-visual-v1',coverage:{artifactSha256:a.content.files[0].sha256,videoSeconds:a.content.files[0].durationSeconds,...(p.step==='film'?{audioSeconds:a.content.files[0].durationSeconds}:{})}}:{}), ...extra } });
}
export function approved(p, extra = {}) { const a = current(p); return send(p, 'approve', { artifactId: a.id, artifactDigest: a.digest, message: 'ISOLATED TEST human approval', ...extra }); }
export function produce(p, result, extra = {}) {
  p = send(p, 'plan', { plan: { provider: ['candidates', 'sheet', 'backgroundCandidates', 'backgroundAngle', 'keyframe'].includes(p.step) ? 'meta-muse' : p.step==='video'?'replicate':['music','effect'].includes(p.step)?'elevenlabs':'cartesia', operation: p.step, estimatedCostUsd: 0.05, parameters: ['candidates', 'sheet', 'backgroundCandidates', 'backgroundAngle', 'keyframe'].includes(p.step) ||['video','music','effect'].includes(p.step) ? { prompt: p.step === 'sheet' ? current(p, `sheetPrompt:${p.characterId}`).content.prompt : result.prompt } : {} } });
  if (p.gate === 'authorize') { const job = p.jobs.at(-1); p = send(p, 'authorize', { jobId: job.id, artifactDigest: job.digest, message: 'ISOLATED TEST request authorization' }); }
  const job = p.jobs.at(-1); p = send(p, 'begin', { jobId: job.id, artifactDigest: job.digest });
  return send(p, 'receipt', { jobId: job.id, artifactDigest: job.digest, result, ...extra });
}
export function audioProject() {
  let p = approved(reviewed(authored(initialProject('isolated', inputs))));
  p = send(p, 'artifact', { actor: 'human', workerId: 'human', content: { files: [file()], consent: true, language: 'en' } });
  p = produce(p, { provider: 'cartesia', voiceId: 'private-clone-test', receiptId: 'job-1' });
  p = qualifyTestAudio(p);
  p = approved(reviewed(produce(p, { files: [file(1)], voiceId: 'private-clone-test', transcript: script.beats[0].narration })));
  p = approved(reviewed(produce(p, { files: [1, 2, 3, 4].map(n => file(n)), voiceId: 'private-clone-test', transcripts: script.beats.map(b => b.narration), model: 'test-only' })));
  return p;
}
