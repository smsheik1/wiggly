#!/usr/bin/env node
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { z } from 'zod';
import { VERSION, Content, Event, Review, Plans, Inputs } from './runtime/contracts.mjs';
import { openWorkflow, revisionImpact } from './runtime/workflow.mjs';
import { importMedia, verifyFiles, measureAudio } from './runtime/media.mjs';
import { executeJob, loadKey, remediation } from './runtime/providers.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const command = args.shift();
function option(name, fallback) { const i = args.indexOf(`--${name}`); if (i < 0) return fallback; const value = args[i + 1]; if (!value || value.startsWith('--')) throw new Error(`--${name} needs a value.`); args.splice(i, 2); return value; }
const runDir = resolve(option('run', join(root, 'agent-runs', 'draft')));
const secretsPath = resolve(option('secrets', join(root, 'secrets.env')));
const print = value => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const json = async path => JSON.parse(await readFile(resolve(path), 'utf8'));
async function lock() {
  await mkdir(runDir, { recursive: true }); const path = join(runDir, 'writer.lock');
  try { await writeFile(path, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 }); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const prior = JSON.parse(await readFile(path, 'utf8')); let active = true;
    try { process.kill(prior.pid, 0); } catch (error) { if (error.code === 'ESRCH') active = false; else throw error; }
    if (active) throw new Error(`RUN_BUSY: process ${prior.pid} owns this run.`);
    await unlink(path); await writeFile(path, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  }
  return () => unlink(path);
}
function presentation(status) {
  const { project, pending } = status;
  // A failed candidate never becomes the ordinary user-facing deliverable.
  const visible = pending.artifact?.review?.decision === 'approved' || pending.gate === 'review' || pending.gate === 'author';
  return { formatVersion: VERSION, checkpointId: status.checkpointId, sequence: project.sequence, pending: { ...pending, artifact: visible ? pending.artifact : null },
    validArtifacts: project.artifacts.filter(a => a.valid).map(a => ({ id: a.id, digest: a.digest, kind: a.kind, approved: !!a.approvedBy })),
    jobs: project.jobs.map(j => ({ id: j.id, status: j.status, digest: j.digest, providerJobId: j.providerJobId })), allowances: project.allowances };
}
async function main() {
  if (command === 'eval' || command === 'eval-tasks' || command === 'eval-export') {
    const { validateDataset, selectCases, taskForCase, runEvaluation, langsmithExamples } = await import('./evaluation/harness.mjs');
    const dataset = validateDataset(await json(option('dataset', join(root, 'evaluation', 'dataset.json'))));
    const split = option('split', 'calibration'); const output = option('out'); const responses = option('predictions'); const mediaRoot = option('media-root');
    if (args.length) throw new Error(`Unknown evaluation arguments: ${args.join(' ')}`);
    const result = command === 'eval-tasks' ? selectCases(dataset, split).map(taskForCase) : command === 'eval-export' ? langsmithExamples(dataset, split) :
      await runEvaluation(dataset, { split, predictions: responses ? await json(responses) : undefined, mediaRoot });
    if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(resolve(output), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 }); print({ path: resolve(output), productionStateMutated: false, apiCalls: 0 }); }
    else print(result);
    return;
  }
  if (command === 'recipe' || command === 'background-recipe') { const content = await readFile(join(root, command === 'background-recipe' ? 'background-prompter.md' : 'character-sheet-recipe.md'), 'utf8'); print({ path: join(root, command === 'background-recipe' ? 'background-prompter.md' : 'character-sheet-recipe.md'), sha256: (await import('./runtime/media.mjs')).sha(Buffer.from(content)), content }); return; }
  if (command === 'check') {
    const tools = Object.fromEntries(['ffprobe', 'ffmpeg', 'tar'].map(tool => [tool, spawnSync(tool, ['-version'], { stdio: 'ignore' }).error?.code !== 'ENOENT']));
    print({ formatVersion: VERSION, node: process.version, tools, dependencies: 'LangGraph + SQLite loaded',
      requiredKeys: ['CARTESIA_API_KEY', 'META_API_KEY'], credentialsRead: false, productionStageLimit: 'approved scene keyframes; video not specified' });
    if (Object.values(tools).some(v => !v)) process.exitCode = 1; return;
  }
  if (command === 'schema') {
    const name = args[0]; const schema = name === 'event' ? Event : name === 'review' ? Review : name === 'plan' ? Plans : name === 'inputs' ? Inputs : Content[name];
    if (!schema) throw new Error('schema needs event/review/plan/inputs or a supported artifact kind.'); print(z.toJSONSchema(schema)); return;
  }
  if (command === 'finalize' || command === 'render') throw new Error('PRODUCTION_NOT_SPECIFIED: this checkpoint implements orchestration through approved scene keyframes. No film can be rendered/finalized yet.');
  const release = await lock(); const workflow = openWorkflow(join(runDir, 'checkpoints.sqlite'));
  try {
    if (command === 'init') {
      const inputs = await json(args[0]); print(presentation(await workflow.init('project', inputs))); return;
    }
    if (command === 'import') { print(await importMedia(args[0], runDir)); return; }
    const status = await workflow.status('project');
    if (command === 'status' || command === 'inspect') { print(presentation(status)); return; }
    if (command === 'impact') { print(revisionImpact(status.project, args[0])); return; }
    if (command === 'validate') { for (const a of status.project.artifacts.filter(a => a.valid)) await verifyFiles(a.content); print({ valid: true, pending: status.pending.step, sequence: status.project.sequence }); return; }
    if (command === 'measure') { const a = status.project.artifacts.findLast(a => a.key === args[0] && a.valid); if (!a?.content.files) throw new Error('Specify an existing audio artifact key, e.g. narration or audition.'); print(await Promise.all(a.content.files.map(measureAudio))); return; }
    if (command === 'respond') {
      const event = await json(args[0]);
      if (event.actor === 'runtime') throw new Error('Runtime events are reserved for the provider collector.');
      if (status.pending.step === 'sheetPrompt' && event.action === 'artifact') { const recipe = (await import('./runtime/media.mjs')).sha(await readFile(join(root, 'character-sheet-recipe.md'))); if (event.content?.recipeSha256 !== recipe) throw new Error('Sheet prompt must use the packaged recipe hash; run recipe.'); }
      await verifyFiles(event.content); await verifyFiles(status.pending.artifact?.content); await verifyFiles(status.pending.dependencies);
      print(presentation(await workflow.respond('project', event))); return;
    }
    if (command === 'work') {
      if (!['author', 'owner-review', 'review', 'produce'].includes(status.pending.gate)) { print(presentation(status)); return; }
      const modulePath = args[0];
      const task = status.pending.gate === 'review' ? { ...status.pending, evaluatorEvidence: await (await import('./runtime/evaluators.mjs')).artifactEvidence(status.project), reviewerRubric: await readFile(join(root, 'evaluation', 'reviewer.md'), 'utf8') } : status.pending;
      if (!modulePath) { print({ task, responseSchema: z.toJSONSchema(Event), contentSchema: Content[status.pending.step] ? z.toJSONSchema(Content[status.pending.step]) : null,
        instruction: 'The operating host agent must perform this task, write an event JSON, then call respond. An explicitly configured module exporting runTask(task) may automate that exchange.' }); return; }
      const worker = await import(pathToFileURL(resolve(modulePath)).href);
      if (typeof worker.runTask !== 'function') throw new Error('Worker module must export runTask(task).');
      const event = await worker.runTask(task);
      if (event.actor !== status.pending.actor || !['artifact', 'owner-review', 'review', 'plan'].includes(event.action)) throw new Error('Worker may only author, review or plan; it cannot approve for the user or call providers.');
      if (status.pending.step === 'sheetPrompt' && event.action === 'artifact') { const recipe = (await import('./runtime/media.mjs')).sha(await readFile(join(root, 'character-sheet-recipe.md'))); if (event.content?.recipeSha256 !== recipe) throw new Error('Sheet prompt must use the packaged recipe hash; run recipe.'); }
      await verifyFiles(event.content); await verifyFiles(status.pending.dependencies); await verifyFiles(status.pending.artifact?.content);
      print(presentation(await workflow.respond('project', event))); return;
    }
    if (command === 'generate' || command === 'collect') {
      const { project, pending } = status; const job = pending.job;
      if (pending.gate !== 'collect' || !job) throw new Error('Only a current authorized generation request can be executed/collected.');
      const event = (action, extra = {}) => ({ taskId: pending.taskId, actor: 'runtime', jobId: job.id, artifactDigest: job.digest, action, ...extra });
      const receiptPath = join(runDir, 'receipts', job.id, 'result.json');
      try {
        const result = await json(receiptPath); await verifyFiles(result); print(presentation(await workflow.respond('project', event('receipt', { result })))); return;
      } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (command === 'collect') { const result = await executeJob(project, job, runDir, '', () => { throw new Error('Collection cannot call the provider.'); }, true); print(presentation(await workflow.respond('project', event('receipt', { result })))); return; }
      if (job.status !== 'authorized') { if (['submitting', 'submitted'].includes(job.status)) await workflow.respond('project', event('provider-error', { message: 'Process ended after submission began. Outcome unknown; reconcile existing request.' })); throw new Error('ALREADY_SUBMITTED: this request already started. Use collect/reconciliation; never resubmit.'); }
      await verifyFiles(job.request);
      let key;
      try { key = await loadKey(job.plan.provider, secretsPath); }
      catch (e) { throw new Error(`${e.message}\n${remediation(job.plan.provider, secretsPath)}`); }
      const begun = await workflow.respond('project', event('begin'));
      try {
        const result = await executeJob(begun.project, begun.pending.job, runDir, key); await verifyFiles(result);
        print(presentation(await workflow.respond('project', { ...event('receipt', { result }), taskId: begun.pending.taskId })));
      } catch (e) {
        const diagnostic = e.message.replaceAll(key, '[redacted]');
        await workflow.respond('project', { ...event('provider-error', { message: diagnostic }), taskId: begun.pending.taskId });
        throw new Error(`${diagnostic}\n${remediation(job.plan.provider, secretsPath)}`);
      } return;
    }
    throw new Error('Use check, schema, init, status, work, respond, import, measure, validate, impact, generate or collect. See SKILL.md.');
  } finally { workflow.close(); await release(); }
}
main().catch(e => { process.stderr.write(`${e.message}\n`); process.exitCode = 1; });
