import { z } from 'zod';
import { digest, text } from '../runtime/contracts.mjs';
import { evaluateTask } from '../runtime/evaluators.mjs';
const status = z.enum(['pass', 'fail', 'inconclusive']);
const Check = z.object({ criterion: text, status, evidence: text, location: text, repair: z.string() }).strict().refine(c => c.status !== 'fail' || c.repair.trim(), 'Failed findings require a specific repair.');
const kinds = { 'audio-duration': 'duration', composition: 'composition', 'review-evidence': 'review-evidence', 'script-structure': 'structure', 'video-anatomy': 'anatomy', 'audio-voice': 'voice-match' };
const Case = z.object({ id: text, group: text, split: z.enum(['calibration', 'holdout']), kind: z.enum(Object.keys(kinds)), origin: text,
  input: z.record(z.string(), z.unknown()), label: z.object({ criterion: text, status, evidence: text, location: text, repair: z.string(), authority: z.enum(['objective', 'direct-frame-inspection', 'capability-audit', 'human', 'agent-provisional']), confirmed: z.boolean() }).strict() });
export const Prediction = z.object({ caseId: text, inputDigest: text, evaluator: text, check: Check,
  basis: z.object({ mode: text, mediaVerified: z.boolean(), scope: text }).passthrough(), measurements: z.unknown().optional(), productionApproval: z.literal(false) }).strict();
export function validateDataset(raw) {
  if (raw.schemaVersion !== 1 || raw.caseCount !== raw.cases?.length || !raw.id) throw new Error('Invalid dataset manifest.');
  const ids = new Set(), groups = new Map(), hashes = new Map();
  for (const value of raw.cases) {
    const c = Case.parse(value); const label = Check.parse({ criterion: c.label.criterion, status: c.label.status, evidence: c.label.evidence, location: c.label.location, repair: c.label.repair });
    if (c.label.authority === 'agent-provisional' && c.label.confirmed) throw new Error('PROVISIONAL_LABEL: agent-provisional findings cannot be calibration truth.');
    if (!c.label.authority || typeof c.label.confirmed !== 'boolean' || label.criterion !== kinds[c.kind]) throw new Error('Label needs declared authority, confirmation and the scoped criterion.');
    if (ids.has(c.id)) throw new Error(`Duplicate case ID: ${c.id}`); ids.add(c.id);
    if (groups.has(c.group) && groups.get(c.group) !== c.split) throw new Error(`RELATED_CASE_LEAKAGE: ${c.group}`); groups.set(c.group, c.split);
    const h = c.input.media?.sha256 ?? c.input.source?.sha256 ?? digest(c.input);
    if (hashes.has(h) && hashes.get(h) !== c.split) throw new Error(`ASSET_LEAKAGE: ${c.id}`); hashes.set(h, c.split);
  }
  return raw;
}
export function taskForCase(c) {
  const input = structuredClone(c.input);
  return { caseId: c.id, inputDigest: digest({ kind: c.kind, input }), kind: c.kind, input, criterion: kinds[c.kind],
    instruction: 'Inspect only the supplied input and actual available media. Return one scoped check with status, localized evidence and repair for a failure. Missing perception/reference is inconclusive. A scope pass never authorizes a production artifact.',
    responseContract: 'Prediction schema: caseId, inputDigest, evaluator, check {criterion,status,evidence,location,repair}, basis {mode,mediaVerified,scope}, productionApproval:false' };
}
export function selectCases(dataset, split) {
  if (!['calibration', 'holdout', 'all'].includes(split)) throw new Error('Choose calibration, holdout or all.');
  return dataset.cases.filter(c => split === 'all' || c.split === split);
}
export async function runEvaluation(dataset, { split = 'calibration', predictions, mediaRoot } = {}) {
  validateDataset(dataset); const selected = selectCases(dataset, split); const known = new Map(selected.map(c => [c.id, taskForCase(c)])); const supplied = new Map();
  for (const raw of predictions ?? []) {
    const p = Prediction.parse(raw); const task = known.get(p.caseId);
    if (!task || p.inputDigest !== task.inputDigest || p.check.criterion !== task.criterion || p.basis.scope !== task.criterion || supplied.has(p.caseId)) throw new Error(`STALE_OR_DUPLICATE_PREDICTION: ${p.caseId}`);
    if (['video-anatomy', 'audio-voice'].includes(task.kind) && p.check.status !== 'inconclusive' && (!p.basis.mediaVerified || !(task.kind === 'audio-voice' ? ['direct-audio'] : ['direct-image', 'direct-video']).includes(p.basis.mode))) throw new Error('Perceptual verdict requires declared direct perception of actual verified media.');
    supplied.set(p.caseId, p);
  }
  if (predictions !== undefined && supplied.size !== selected.length) throw new Error('INCOMPLETE_PREDICTIONS: supply exactly one response per selected case; baseline and reviewer results cannot be mixed.');
  const results = []; const metrics = {};
  for (const c of selected) {
    const task = known.get(c.id); const prediction = supplied.get(c.id) ?? await evaluateTask(task, { mediaRoot });
    const scored = c.label.confirmed;
    results.push({ caseId: c.id, group: c.group, split: c.split, expected: c.label, prediction, scored });
    if (!scored) continue;
    const m = metrics[c.label.criterion] ??= { cases: 0, expectedDefects: 0, flaggedDefects: 0, missedDefects: 0, falseApprovals: 0, incorrectRejections: 0, unresolved: 0, scopedMatches: 0 };
    m.cases++; if (prediction.check.status === 'inconclusive') m.unresolved++;
    if (prediction.check.status === c.label.status) m.scopedMatches++;
    if (c.label.status === 'fail') { m.expectedDefects++; if (prediction.check.status === 'fail') m.flaggedDefects++; else m.missedDefects++; if (prediction.check.status === 'pass') m.falseApprovals++; }
    if (c.label.status === 'pass' && prediction.check.status === 'fail') m.incorrectRejections++;
  }
  return { schemaVersion: 1, datasetId: dataset.id, datasetDigest: digest(dataset), split, cases: selected.length, evaluatedAt: new Date().toISOString(),
    apiCalls: 0, credentialsRead: false, productionApproval: false, productionStateMutated: false,
    metrics, results, qualification: { semanticScriptJudge: false, voiceJudge: false, anatomyJudge: false,
      reason: 'Small scoped dataset; no calibrated live judge, held-out anatomy defect or human semantic labels. Do not activate automatic model-based production acceptance.' } };
}
export function langsmithExamples(dataset, split) {
  validateDataset(dataset); return selectCases(dataset, split).map(c => ({ inputs: taskForCase(c), outputs: { criterion: c.label.criterion, status: c.label.status },
    metadata: { caseId: c.id, group: c.group, split: c.split, authority: c.label.authority, confirmed: c.label.confirmed, scope: c.label.criterion, origin: c.origin } }));
}
