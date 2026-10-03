import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import {legacyGeneration,studioFor} from './instructions.mjs';
import { videoBinding, effectFor } from './studio.mjs';
import { executeVideo } from './video-provider.mjs';
import { shotReferences } from './shots.mjs';
import { digest } from './contracts.mjs';
import { assertAllowed, keyFor, miniProduction } from './gates.mjs';
import { importMedia, verifyFiles, narrationWindow } from './media.mjs';
const artifact = (p, key) => p.artifacts.findLast(a => a.key === key && a.valid);
export function requestDescriptor(p, plan) {
  const generation=studioFor(p)?.config.generation??legacyGeneration;
  if(p.studio&&['clone','audition','narration'].includes(plan.operation)&&(plan.parameters.model&&plan.parameters.model!==generation.voice.model||plan.parameters.cartesiaVersion&&plan.parameters.cartesiaVersion!==generation.voice.apiVersion))throw new Error('STUDIO_BINDING_CHANGED: use the pinned Cartesia model/API version.');
  if(plan.operation==='video'){if(plan.parameters.model)throw new Error('Video model is fixed by the project productionProfile; unsupported override.');const b=videoBinding(p),model=miniProduction(p)?generation.video.model:'seedance-2.0',resolution=miniProduction(p)?generation.video.resolution:'1080p';if(!(plan.estimatedCostUsd>0))throw new Error('Video needs an operator-verified positive cost estimate.');return {prompt:plan.parameters.prompt,endpoint:`https://api.replicate.com/v1/models/bytedance/${model}/predictions`,frame:b.frame.content.files[0],input:{prompt:plan.parameters.prompt,duration:b.clip.generationSeconds,resolution,aspect_ratio:'16:9',generate_audio:false}};}
  if(['music','effect'].includes(plan.operation)){if(plan.parameters.model)throw new Error('Sound adapters use their documented fixed models.');if(!(plan.estimatedCostUsd>0))throw new Error('Sound generation needs a verified positive cost estimate.');const target=plan.operation==='music'?artifact(p,'soundPlan').content.music:effectFor(p);if(target.mode!=='generate')throw new Error('Imported sound cannot invoke a provider.');return {prompt:plan.parameters.prompt,endpoint:`https://api.elevenlabs.io/v1/${plan.operation==='music'?'music':'sound-generation'}?output_format=mp3_44100_128`,body:plan.operation==='music'?{prompt:target.prompt,music_length_ms:60000,model_id:generation.music.model,force_instrumental:true}:{text:target.prompt,duration_seconds:target.durationSeconds,model_id:generation.effect.model,loop:false},provenance:target.provenance};}
  const sample = artifact(p, 'voiceSample')?.content;
  if (plan.operation === 'clone') return { endpoint: 'https://api.cartesia.ai/voices/clone', cartesiaVersion: plan.parameters.cartesiaVersion ?? generation.voice.apiVersion,
    clip: sample.files[0], language: sample.language, name: `${(artifact(p,'answers')?.content.inputs??p.inputs).subject.preferredName} — ${p.id}`, access: 'private' };
  if (['audition', 'narration'].includes(plan.operation)) return { endpoint: 'https://api.cartesia.ai/tts/bytes', cartesiaVersion: plan.parameters.cartesiaVersion ?? generation.voice.apiVersion,
    model_id: plan.parameters.model ?? generation.voice.model, voice: artifact(p, 'clone').content.voiceId, language: sample.language,
    transcripts: artifact(p, 'script').content.beats.slice(0, plan.operation === 'audition' ? 1 : 4).map(b => b.narration),
    ...(plan.operation==='narration'&&p.workflowRevision===3?{beatWindowSeconds:15}:{}),
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
  if (plan.estimatedCostUsd < n * generation.image.estimatedUnitCostUsd) throw new Error('Muse estimate must account for every requested image ($0.01 each).');
  return { endpoint: `https://api.meta.ai/v1/images/${images.length ? 'edits' : 'generations'}`, model: generation.image.model, prompt: plan.parameters.prompt, images, n, size: '1536x864', response_format: 'b64_json', output_format: 'webp',
    tool_enablement: { enable_web_search: false, enable_image_search: false, enable_shell: false } };
}
export async function atomicJson(path, value) { const temp = `${path}.tmp`; await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 }); await rename(temp, path); }
export function remediation(provider, secretsPath) {
  if(provider==='gemini')return `STOP: Gemini media review failed. No fallback or retry was submitted.\n1. Open https://aistudio.google.com/api-keys and sign in; select the key's Google Cloud project.\n2. Open Dashboard → Usage/Billing (https://aistudio.google.com/usage); check quota, billing and payment for that project.\n3. Open API keys → Create API key; verify Gemini API access and any key restrictions.\n4. Open ${resolve(secretsPath)} and set GEMINI_API_KEY=<your-key> on its own line. Never paste the key in chat.\n5. Inspect the run's gemini-reviews receipts before another request. An uncertain request is never automatically repeated; HTTP 429 requires waiting for the quota window.`;
  const cartesia = provider === 'cartesia'; const key = {cartesia:'CARTESIA_API_KEY','meta-muse':'META_API_KEY',replicate:'REPLICATE_API_TOKEN',elevenlabs:'ELEVENLABS_API_KEY'}[provider];
  return `STOP: ${provider} failed. No fallback or retry was submitted.\n1. Open ${{cartesia:'https://play.cartesia.ai','meta-muse':'https://dev.meta.ai',replicate:'https://replicate.com/account/billing',elevenlabs:'https://elevenlabs.io/app/settings/subscription'}[provider]} and sign in.\n2. Open the account's Billing/Usage page; check credits and payment, and add funds if needed.\n3. Open API Keys, verify access to ${{cartesia:'voice cloning and Sonic TTS','meta-muse':'Muse Image',replicate:'Seedance video; API tokens at https://replicate.com/account/api-tokens',elevenlabs:'Music/Sound Effects; API keys at https://elevenlabs.io/app/settings/api-keys'}[provider]}, and copy a valid key.\n4. Open ${resolve(secretsPath)} and set ${key}=<your-key> on its own line. Never paste the key in chat.\n5. Read status and reconcile the recorded job before another request. For 429, wait for the provider retry window; for an outage, check the provider status/support page.`;
}
export async function loadKey(provider, secretsPath) {
  const name = {cartesia:'CARTESIA_API_KEY','meta-muse':'META_API_KEY',replicate:'REPLICATE_API_TOKEN',elevenlabs:'ELEVENLABS_API_KEY',gemini:'GEMINI_API_KEY'}[provider];if(!name)throw new Error('Unknown provider.');
  const source = await readFile(secretsPath, 'utf8');
  const match = source.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.+)\\s*$`, 'm'));
  if (!match) throw new Error(`Missing named ${name} in ${resolve(secretsPath)}.`);
  const value = match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!value) throw new Error(`Empty ${name}.`); return value;
}
// Metadata-only checks cannot establish paid generation entitlement or output quality.
export async function checkProvider(provider,secretsPath,fetcher=fetch){
 const definitions={cartesia:{urls:['https://api.cartesia.ai/voices?limit=1'],docs:'https://docs.cartesia.ai/api-reference/voices/list'},'meta-muse':{urls:['https://api.meta.ai/v1/models/muse-image-1.0'],docs:'https://dev.meta.ai/docs/api-reference/models/retrieve-model'},replicate:{urls:['https://api.replicate.com/v1/account','https://api.replicate.com/v1/models/bytedance/seedance-2.0-mini'],docs:'https://replicate.com/docs/reference/http'},elevenlabs:{urls:['https://api.elevenlabs.io/v1/user/subscription'],docs:'https://elevenlabs.io/docs/api-reference/user/subscription/get'}};
 definitions.gemini={urls:['https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash'],docs:'https://ai.google.dev/api/models#method:-models.get'};
 const definition=definitions[provider];if(!definition)throw new Error('Use cartesia, meta-muse, replicate, elevenlabs or gemini.');
 let apiKey;
 try{
  apiKey=await loadKey(provider,secretsPath);const bodies=[];
  for(const url of definition.urls){
   const response=await fetcher(url,{method:'GET',headers:provider==='gemini'?{'x-goog-api-key':apiKey}:provider==='elevenlabs'?{'xi-api-key':apiKey}:{Authorization:`Bearer ${apiKey}`,...(provider==='cartesia'?{'Cartesia-Version':'2026-08-14'}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok){const body=await response.text();throw new Error(`GET ${url}: HTTP ${response.status}: ${body.replaceAll(apiKey,'[redacted]').slice(0,400)}`);}
   bodies.push(await response.json());
  }
  if(provider==='cartesia'&&!Array.isArray(bodies[0].data)||provider==='meta-muse'&&bodies[0].id!=='muse-image-1.0'||provider==='replicate'&&(!bodies[0].type||bodies[1].owner!=='bytedance'||bodies[1].name!=='seedance-2.0-mini')||provider==='elevenlabs'&&typeof bodies[0].status!=='string')throw new Error('Provider metadata response does not match its documented contract.');
  if(provider==='gemini'&&bodies[0].name!=='models/gemini-3.8-flash')throw new Error('Gemini metadata must identify the exact selected model.');
  return {provider,checkedAt:new Date().toISOString(),status:'metadata-verified',endpoints:definition.urls,documentation:definition.docs,authenticatedRead:true,...(provider==='elevenlabs'?{subscriptionStatus:bodies[0].status}:{}),generationReady:false,unverified:['paid generation entitlement and funds','account-specific price and spend estimate','actual generation/output quality'],mediaGenerationCalls:0,projectStateMutated:false};
 }catch(error){const message=apiKey?error.message.replaceAll(apiKey,'[redacted]'):error.message;throw new Error(`${message}\n${remediation(provider,secretsPath)}`);}
}
// Each subrequest has a durable started marker and result. Unknown outcomes are never retried.
export async function executeJob(p, job, runDir, apiKey, fetcher = fetch, collectOnly = false, onJobId) {
  const recorded = p.jobs.find(j => j.id === job.id && j.digest === job.digest);
  if (p.gate !== 'collect' || p.step !== job.plan.operation || !recorded?.authorization || !['submitting', 'submitted', 'uncertain'].includes(recorded.status) || recorded.key !== keyFor(p) || digest({ plan: job.plan, request: job.request, dependencies: job.dependencies }) !== recorded.digest || job.dependencies.some(id => !p.artifacts.some(a => a.id === id && a.valid))) throw new Error('UNAUTHORIZED_PROVIDER_CALL: use the current recorded request after the runner checkpoints submission.');
  assertAllowed(p, p.step);
  const request = job.request; await verifyFiles(request);
  const dir = join(runDir, 'receipts', job.id); await mkdir(dir, { recursive: true });
  if(job.plan.provider==='replicate'){const cached=join(dir,'result.json');try{return JSON.parse(await readFile(cached,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}const result=await executeVideo({...job,request:{...job.request,runDir}},dir,apiKey,fetcher,collectOnly,onJobId);if(!result.pending)await atomicJson(cached,result);return result;}
  const post = async (index, body, headers, binary = false) => {
    const receipt = join(dir, `${index}.json`); const started = join(dir, `${index}.started`);
    try { return JSON.parse(await readFile(receipt, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (collectOnly) throw new Error(`UNCERTAIN_SUBREQUEST: ${job.id}/${index}; no completed receipt exists. Collection will not submit it.`);
    try { await writeFile(started, JSON.stringify({ jobId: job.id, digest: job.digest, index }), { flag: 'wx', mode: 0o600 }); }
    catch (e) { if (e.code === 'EEXIST') throw new Error(`UNCERTAIN_SUBREQUEST: ${job.id}/${index}. Reconcile its existing result; never duplicate it.`); throw e; }
    const response = await fetcher(request.endpoint, { method: 'POST', headers: { ...(job.plan.provider==='elevenlabs'?{'xi-api-key':apiKey}:{Authorization:`Bearer ${apiKey}`}), ...headers }, body, signal: AbortSignal.timeout(180000) });
    if (!response.ok) { const diagnostic = (await response.text()).replaceAll(apiKey, '[redacted]').slice(0, 800); throw new Error(`HTTP ${response.status}: ${diagnostic}`); }
    let result;
    if (binary) { const path = join(dir, `${index}.${job.plan.provider==='elevenlabs'?'mp3':'wav'}`); await writeFile(path, Buffer.from(await response.arrayBuffer()), { mode: 0o600 }); result = { file: await importMedia(path, runDir) }; }
    else result = await response.json();
    await atomicJson(receipt, result); return result;
  };
  let result;
  if(job.plan.provider==='elevenlabs'){const response=await post(0,JSON.stringify(request.body),{'Content-Type':'application/json'},true);result={files:[response.file],prompt:job.plan.parameters.prompt,provenance:request.provenance};}
  else if (job.plan.operation === 'clone') {
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
    const windows=request.beatWindowSeconds===15?[]:null;
    if(windows)for(const [i,file] of files.entries())windows.push(await narrationWindow(file,runDir,join(dir,`window-${i}.wav`)));
    result = job.plan.operation === 'audition' ? { files, voiceId: request.voice, transcript: request.transcripts[0] } : { files:windows?windows.map(w=>w.file):files, voiceId: request.voice, transcripts: request.transcripts, model: request.model_id,...(windows?{sourceFiles:files,tailSilenceSeconds:windows.map(w=>w.tailSilenceSeconds)}:{}) };
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
