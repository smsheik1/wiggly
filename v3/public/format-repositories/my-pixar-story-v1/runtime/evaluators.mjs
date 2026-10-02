import { keyFor } from './gates.mjs';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { Content, Review, digest, criteria } from './contracts.mjs';
import { sha, probe, measureAudio } from './media.mjs';
export const EVALUATOR_VERSION = 'local-rules-1';
const check = (criterion, status, evidence, location, repair = '') => ({ criterion, status, evidence, location, repair });
const unknown = (criterion, reason, location = 'whole artifact') => check(criterion, 'inconclusive', reason, location);
export const words = text => text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
export function transcriptDiff(expected, observed) {
  const a = words(expected), b = words(observed);
  // Levenshtein distance counts insertions, deletions and substitutions; punctuation is ignored.
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row.push(Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    previous = row;
  }
  return { expectedWords: a.length, observedWords: b.length, editDistance: previous[b.length], wordErrorRate: a.length ? previous[b.length] / a.length : b.length ? 1 : 0 };
}
export function scriptChecks(script) {
  const result = Content.script.safeParse(script);
  const structure = result.success ? check('structure', 'pass', 'Four ordered 15-second beats with narration, emotional purpose and source citations satisfy the script schema.', 'beats 1–4') :
    check('structure', 'fail', result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '), 'script contract', 'Repair the cited contract fields; preserve the questionnaire and four-beat timing.');
  return [structure, ...criteria.script.map(c => unknown(c, 'Requires an independent host reviewer to compare the actual questionnaire and draft. Schema validity cannot establish this criterion.'))];
}
export function audioChecks({ durations, lockedTexts, audioHashes, sampleHash, stt, similarity }) {
  const checks = [durations.length && durations.every(d => Number.isFinite(d) && d > 0) ?
    check('duration', durations.some(d => d > 15) ? 'fail' : 'pass', `Measured durations: ${durations.join(', ')} seconds; maximum is 15 per beat.`, 'audio stems', durations.some(d => d > 15) ? 'Return affected copy to the writer; do not accelerate speech or truncate words.' : '') : unknown('duration', 'Measured, positive durations are missing.')];
  const bound = stt?.method && stt.audioHashes && digest(stt.audioHashes) === digest(audioHashes) && Array.isArray(stt.transcripts) && stt.transcripts.length === lockedTexts?.length;
  let diffs = null;
  if (bound) { diffs = lockedTexts.map((t, i) => transcriptDiff(t, stt.transcripts[i]));
    checks.push(check('transcript', diffs.some(d => d.editDistance) ? 'fail' : 'pass', `${stt.method}: word edit distances ${diffs.map(d => d.editDistance).join(', ')}.`, 'locked text versus STT per stem', diffs.some(d => d.editDistance) ? 'Regenerate or repair the affected spoken words against the locked text; do not rewrite it silently.' : ''));
  } else checks.push(unknown('transcript', 'No STT result is bound to these exact audio hashes and locked texts.'));
  // No uncalibrated numeric score is turned into a likeness approval.
  checks.push(unknown('voice-match', !sampleHash ? 'Genuine storyteller reference sample is missing.' : !similarity?.method || !Array.isArray(similarity.audioHashes) || !Number.isFinite(similarity.score) || similarity.referenceSha256 !== sampleHash || digest(similarity.audioHashes) !== digest(audioHashes) ? 'Measured speaker similarity is missing or bound to different media.' : `Speaker score ${similarity.score} is recorded by ${similarity.method}; this voice/model needs an independently calibrated acceptance policy.`));
  for (const c of ['integrity', 'natural-rate', 'delivery', 'safety']) checks.push(unknown(c, 'Measurement alone is insufficient. A qualified reviewer must inspect/listen and explain the finding.'));
  const speakingRateWpm = bound && durations.length === lockedTexts.length ? stt.transcripts.map((t, i) => words(t).length * 60 / durations[i]) : null;
  return { checks, transcriptDiffs: diffs, speakingRateWpm, rateMethod: speakingRateWpm ? 'STT words divided by measured whole-stem duration, including pauses; not an acceleration detector.' : null };
}
export async function verifiedMedia(record, mediaRoot, audio = false) {
  const root = await realpath(resolve(mediaRoot)); let path = resolve(root, record.locator);
  const inside = value => { const rel = relative(root, value); return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep); };
  if (!inside(path)) throw new Error('Media locator must stay inside the supplied media root.');
  path = await realpath(path);
  if (!inside(path)) throw new Error('Media locator symlink must stay inside the supplied media root.');
  const bytes = await readFile(path);
  if (sha(bytes) !== record.sha256 || bytes.length !== record.bytes) throw new Error(`ASSET_CHANGED: ${record.locator}`);
  const metadata = await probe(path);
  if (audio && !metadata.durationSeconds) throw new Error('Expected an audio stream.');
  return { path, sha256: record.sha256, bytes: record.bytes, ...metadata };
}
export async function evaluateTask(task, { mediaRoot } = {}) {
  const { kind, input } = task; let finding; let measurements = null; let mediaVerified = false;
  if (kind === 'script-structure') finding = scriptChecks(input.script).find(c => c.criterion === 'structure');
  else if (kind === 'composition') {
    const m = input.manifest, t = input.target;
    const pass = m.beatNumbers.length === t.beats && m.beatNumbers.every((n, i) => n === i + 1) && m.beatDurations.length === t.beats && m.beatDurations.every(d => d === t.beatSeconds) && m.totalDurationSeconds === t.totalSeconds;
    finding = check('composition', pass ? 'pass' : 'fail', `${m.beatNumbers.length} beats, durations [${m.beatDurations}], total ${m.totalDurationSeconds}; explicit target is ${t.beats} × ${t.beatSeconds} = ${t.totalSeconds}.`, 'manifest timeline', pass ? '' : 'Create a separately approved script satisfying the target; never silently migrate legacy state.');
  } else if (kind === 'review-evidence') {
    const r = Review.safeParse(input.review); const names = r.success ? r.data.checks.map(c => c.criterion) : [];
    const complete = r.success && new Set(names).size === names.length && names.length === input.requiredCriteria.length && input.requiredCriteria.every(c => names.includes(c));
    const valid = complete && (r.data.decision !== 'approved' || (r.data.perception === input.expectedPerception && r.data.checks.every(c => c.status === 'pass'))) && (r.data.decision !== 'rejected' || r.data.checks.some(c => c.status === 'fail')) && r.data.checks.every(c => c.status !== 'fail' || c.repair.trim());
    finding = check('review-evidence', valid ? 'pass' : 'fail', valid ? 'Review has complete unique evidenced checks, explicit perception and repair for every failure.' : 'Review lacks a complete valid evidence/perception/repair contract; an approval token is not sufficient.', 'review record', valid ? '' : 'Obtain a qualified reviewer with one localized finding per required criterion.');
  } else if (kind === 'audio-duration') {
    let duration = input.media.durationSeconds;
    if (mediaRoot) { const file = await verifiedMedia(input.media, mediaRoot, true); measurements = await measureAudio(file); duration = measurements.durationSeconds; mediaVerified = true; }
    const measured = Number.isFinite(duration) && duration > 0;
    finding = !measured ? unknown('duration', 'Positive measured duration is unavailable.') : check('duration', duration <= input.windowSeconds ? 'pass' : 'fail', `${mediaRoot ? 'Verified actual file' : 'Saved measurement snapshot'} duration ${duration}s; maximum ${input.windowSeconds}s.`, 'whole stem', duration <= input.windowSeconds ? '' : 'Return affected copy/timing to the writer; never speed narration up or truncate words.');
  } else if (kind === 'audio-voice') { if (mediaRoot) { await verifiedMedia(input.media, mediaRoot, true); mediaVerified = true; } finding = unknown('voice-match', 'No qualified direct listening and calibrated speaker comparison against the genuine reference sample are available.'); }
  else if (kind === 'video-anatomy') {
    if (mediaRoot) { await verifiedMedia(input.media, mediaRoot); mediaVerified = true; }
    finding = unknown('anatomy', 'File/metadata verification cannot detect extra limbs. A qualified video/frame reviewer must inspect actual media and provide localized evidence.');
  } else throw new Error(`Unknown evaluator task kind: ${kind}`);
  return { caseId: task.caseId, inputDigest: task.inputDigest, evaluator: EVALUATOR_VERSION, check: finding,
    basis: { mode: mediaVerified ? 'actual-file-measurement' : input.media ? 'snapshot-or-unavailable' : 'direct-structured-text', mediaVerified, scope: finding.criterion }, measurements, productionApproval: false };
}

// Advisory evidence for the existing reviewer task, never a workflow transition or approval.
export async function artifactEvidence(project) {
  const key = keyFor(project);
  const artifact = project.artifacts.findLast(a => a.key === key && a.valid);
  if (!artifact) throw new Error('No current artifact to evaluate.');
  let checks, measurements = null;
  if (project.step === 'script') checks = scriptChecks(artifact.content);
  else if (['audition', 'narration'].includes(project.step)) {
    measurements = await Promise.all(artifact.content.files.map(measureAudio));
    const script = project.artifacts.findLast(a => a.key === 'script' && a.valid).content;
    const sample = project.artifacts.findLast(a => a.key === 'voiceSample' && a.valid).content.files[0];
    checks = audioChecks({ durations: measurements.map(m => m.durationSeconds), audioHashes: artifact.content.files.map(f => f.sha256), sampleHash: sample.sha256,
      lockedTexts: script.beats.slice(0, project.step === 'audition' ? 1 : 4).map(b => b.narration) }).checks;
  } else checks = (criteria[project.step] ?? []).map(c => unknown(c, 'The host reviewer must directly inspect the actual references/artifact. Contract or file validity cannot establish creative quality.'));
  return { evaluator: EVALUATOR_VERSION, artifactId: artifact.id, artifactDigest: artifact.digest, checks, measurements, productionApproval: false,
    instruction: 'These are scoped measurements and missing-capability findings, not a completed review. Resolve each required criterion with genuine independent perception and measured evidence; return the normal bound review event. Do not treat structural passes as semantic/audio/image approval.' };
}
