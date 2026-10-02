import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { shotReferences } from './shots.mjs';
import { digest } from './contracts.mjs';
import { assertAllowed, keyFor } from './gates.mjs';
import { importMedia, verifyFiles } from './media.mjs';
const artifact = (p, key) => p.artifacts.findLast(a => a.key === key && a.valid);
export function requestDescriptor(p, plan) {
  const sample = artifact(p, 'voiceSample')?.content;
  if (plan.operation === 'clone') return { endpoint: 'https://api.cartesia.ai/voices/clone', cartesiaVersion: plan.parameters.cartesiaVersion ?? '2026-08-14',
    clip: sample.files[0], language: sample.language, name: `${p.inputs.subject.preferredName} — ${p.id}`, access: 'private' };
  if (['audition', 'narration'].includes(plan.operation)) return { endpoint: 'https://api.cartesia.ai/tts/bytes', cartesiaVersion: plan.parameters.cartesiaVersion ?? '2026-08-14',
    model_id: plan.parameters.model ?? 'sonic-3.6-2026-08-27', voice: artifact(p, 'clone').content.voiceId, language: sample.language,
    transcripts: artifact(p, 'script').content.beats.slice(0, plan.operation === 'audition' ? 1 : 4).map(b => b.narration),
    output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 }, generation_config: { speed: 1, volume: 1 } };
  let images, n;
  if (plan.operation === 'keyframe') { images = shotReferences(p).map(r => r.file); n = 1; }
  else if (plan.operation === 'backgroundCandidates') { images = artifact(p, `backgroundBrief:${p.locationId}`).content.references; n = 3; }
  else if (plan.operation === 'backgroundAngle') {
    const master = artifact(p, `backgroundCandidates:${p.locationId}`);
    images = [master.content.files[master.selection]]; n = 1;
  } else {
    const selected = artifact(p, `candidates:${p.characterId}`);
    images = plan.operation === 'sheet' ? [selected.content.files[selected.selection]] : artifact(p, 'roster').content.characters.find(c => c.id === p.characterId).references;
    n = plan.operation === 'sheet' ? 1 : 3;
  }
  if (plan.estimatedCostUsd < n * 0.01) throw new Error('Muse estimate must account for every requested image ($0.01 each).');
  return { endpoint: `https://api.meta.ai/v1/images/${images.length ? 'edits' : 'generations'}`, model: 'muse-image-1.0', prompt: plan.parameters.prompt, images, n, size: '1536x864', response_format: 'b64_json', output_format: 'webp',
    tool_enablement: { enable_web_search: false, enable_image_search: false, enable_shell: false } };
}
export async function atomicJson(path, value) { const temp = `${path}.tmp`; await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); await rename(temp, path); }
export function remediation(provider, secretsPath) {
  const cartesia = provider === 'cartesia'; const key = cartesia ? 'CARTESIA_API_KEY' : 'META_API_KEY';
  return `STOP: ${provider} failed. No fallback or retry was submitted.\n1. Open ${cartesia ? 'https://play.cartesia.ai' : 'https://dev.meta.ai'} and sign in.\n2. Open the account's Billing/Usage page; check credits and payment, and add funds if needed.\n3. Open API Keys, verify access to ${cartesia ? 'voice cloning and Sonic TTS' : 'Muse Image'}, and copy a valid key.\n4. Open ${resolve(secretsPath)} and set ${key}=<your-key> on its own line. Never paste the key in chat.\n5. Read status and reconcile the recorded job before another request. For 429, wait for the provider retry window; for an outage, check the provider status/support page.`;
}
export async function loadKey(provider, secretsPath) {
  const name = provider === 'cartesia' ? 'CARTESIA_API_KEY' : 'META_API_KEY';
  const source = await readFile(secretsPath, 'utf8');
  const match = source.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.+)\\s*$`, 'm'));
  if (!match) throw new Error(`Missing named ${name} in ${resolve(secretsPath)}.`);
  const value = match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!value) throw new Error(`Empty ${name}.`); return value;
}
// Each subrequest has a durable started marker and result. Unknown outcomes are never retried.
export async function executeJob(p, job, runDir, apiKey, fetcher = fetch, collectOnly = false) {
  const recorded = p.jobs.find(j => j.id === job.id && j.digest === job.digest);
  if (p.gate !== 'collect' || p.step !== job.plan.operation || !recorded?.authorization || !['submitting', 'submitted', 'uncertain'].includes(recorded.status) || recorded.key !== keyFor(p) || digest({ plan: job.plan, request: job.request, dependencies: job.dependencies }) !== recorded.digest || job.dependencies.some(id => !p.artifacts.some(a => a.id === id && a.valid))) throw new Error('UNAUTHORIZED_PROVIDER_CALL: use the current recorded request after the runner checkpoints submission.');
  assertAllowed(p, p.step);
  const request = job.request; await verifyFiles(request);
  const dir = join(runDir, 'receipts', job.id); await mkdir(dir, { recursive: true });
  const post = async (index, body, headers, binary = false) => {
    const receipt = join(dir, `${index}.json`); const started = join(dir, `${index}.started`);
    try { return JSON.parse(await readFile(receipt, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (collectOnly) throw new Error(`UNCERTAIN_SUBREQUEST: ${job.id}/${index}; no completed receipt exists. Collection will not submit it.`);
    try { await writeFile(started, JSON.stringify({ jobId: job.id, digest: job.digest, index }), { flag: 'wx', mode: 0o600 }); }
    catch (e) { if (e.code === 'EEXIST') throw new Error(`UNCERTAIN_SUBREQUEST: ${job.id}/${index}. Reconcile its existing result; never duplicate it.`); throw e; }
    const response = await fetcher(request.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, ...headers }, body, signal: AbortSignal.timeout(180000) });
    if (!response.ok) { const diagnostic = (await response.text()).replaceAll(apiKey, '[redacted]').slice(0, 800); throw new Error(`HTTP ${response.status}: ${diagnostic}`); }
    let result;
    if (binary) { const path = join(dir, `${index}.wav`); await writeFile(path, Buffer.from(await response.arrayBuffer()), { mode: 0o600 }); result = { file: await importMedia(path, runDir) }; }
    else result = await response.json();
    await atomicJson(receipt, result); return result;
  };
  let result;
  if (job.plan.operation === 'clone') {
    const form = new FormData(); form.append('clip', new Blob([await readFile(request.clip.path)]), `sample${extname(request.clip.path)}`);
    form.append('language', request.language); form.append('name', request.name); form.append('access', 'private');
    const response = await post(0, form, { 'Cartesia-Version': request.cartesiaVersion });
    if (typeof response.id !== 'string' || !response.id) throw new Error('Clone response is missing voice ID.');
    result = { voiceId: response.id, provider: 'cartesia', receiptId: job.id };
  } else if (job.plan.provider === 'cartesia') {
    const files = [];
    for (const [i, transcript] of request.transcripts.entries()) {
      const { file } = await post(i, JSON.stringify({ model_id: request.model_id, voice: request.voice, transcript, language: request.language, output_format: request.output_format, generation_config: request.generation_config }),
        { 'Content-Type': 'application/json', 'Cartesia-Version': request.cartesiaVersion }, true);
      files.push(file);
    }
    result = job.plan.operation === 'audition' ? { files, voiceId: request.voice, transcript: request.transcripts[0] } : { files, voiceId: request.voice, transcripts: request.transcripts, model: request.model_id };
  } else {
    const images = await Promise.all(request.images.map(async f => ({ image_url: `data:image/${extname(f.path).slice(1).replace('jpg', 'jpeg')};base64,${(await readFile(f.path)).toString('base64')}` })));
    const { endpoint, images: _refs, ...body } = request;
    const response = await post(0, JSON.stringify({ ...body, ...(images.length ? { images } : {}) }), { 'Content-Type': 'application/json' });
    if (!Array.isArray(response.data) || response.data.length !== request.n || response.data.some(d => !d.b64_json)) throw new Error('Muse must return the exact requested image count as base64; no remote-image fallback.');
    const files = [];
    for (const [i, data] of response.data.entries()) { const path = join(dir, `${i}.${request.output_format}`); await writeFile(path, Buffer.from(data.b64_json, 'base64'), { mode: 0o600 }); files.push(await importMedia(path, runDir)); }
    result = { files, prompt: request.prompt };
  }
  await atomicJson(join(dir, 'result.json'), result); return result;
}
