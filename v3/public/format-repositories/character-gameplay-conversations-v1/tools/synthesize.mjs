#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VOICE_PRESETS = {
  'batman': { id: 'ef549174cea246468ce32b00afa6affa', name: 'BATMAN', universe: 'DC' },
  'kevin conroy': { id: 'ef549174cea246468ce32b00afa6affa', name: 'BATMAN', universe: 'DC' },
  'robin': { id: 'bc748d906c524a91bbb88e87f2bac62b', name: 'ROBIN', universe: 'DC' },
  'tim drake': { id: 'bc748d906c524a91bbb88e87f2bac62b', name: 'ROBIN', universe: 'DC' },
  'nightwing': { id: '5ff622f2dd30418ebb5bce8c1b920bdf', name: 'NIGHTWING', universe: 'DC' },
  'jason todd': { id: 'ecaac6caa8f14415aa02de57459b27c8', name: 'JASON TODD', universe: 'DC' },
  'red hood': { id: 'ecaac6caa8f14415aa02de57459b27c8', name: 'RED HOOD', universe: 'DC' },
  'joker': { id: '9fbad48d836748c5ab748abe7ac523b1', name: 'THE JOKER', universe: 'DC' },
  'the joker': { id: '9fbad48d836748c5ab748abe7ac523b1', name: 'THE JOKER', universe: 'DC' },
  'spider-man': { id: 'ac7694a573a34ef08d63e2d00d6812f6', name: 'SPIDER-MAN', universe: 'MARVEL' },
  'spiderman': { id: 'ac7694a573a34ef08d63e2d00d6812f6', name: 'SPIDER-MAN', universe: 'MARVEL' },
  'venom': { id: '785a8d3367b4431a9afb4bf6e5b2014e', name: 'VENOM', universe: 'MARVEL' },
  'spongebob': { id: '9845e056f37b470d9a1005e41c864e25', name: 'SPONGEBOB', universe: 'BIKINI BOTTOM' },
  'patrick': { id: 'd1520b60870b4e9aa01eab5bfefb1c45', name: 'PATRICK', universe: 'BIKINI BOTTOM' },
  'sonic': { id: '819bef35f241425291167f5ee794151c', name: 'SONIC', universe: 'SEGA' },
  'mario': { id: 'f9f460f0347b47039b4dcba199f745f9', name: 'MARIO', universe: 'NINTENDO' },
  'walter white': { id: 'f33230a1bf6f4c80b54aa2fdf825b410', name: 'WALTER WHITE', universe: 'BREAKING BAD' },
  'peter griffin': { id: '5011ba2ea900424594c3c39385012e1d', name: 'PETER GRIFFIN', universe: 'FAMILY GUY' }
};

async function loadApiKey() {
  if (process.env.FISH_STUDIO_APIKEY?.trim()) return process.env.FISH_STUDIO_APIKEY.trim();
  const candidatePaths = [
    path.join(repoRoot, '../../../.env.local'),
    path.join(repoRoot, '../../../../secrets.env'),
    path.join(repoRoot, '../../../secrets.env'),
    path.join(repoRoot, '../../.env.local')
  ];
  for (const candidate of candidatePaths) {
    try {
      const content = await readFile(candidate, 'utf8');
      const match = content.match(/FISH_STUDIO_APIKEY=([^\r\n]+)/);
      if (match && match[1].trim()) return match[1].trim();
    } catch {}
  }
  return null;
}

async function resolveVoice(nameOrId, apiKey) {
  const norm = nameOrId.trim().toLowerCase();
  if (VOICE_PRESETS[norm]) return VOICE_PRESETS[norm];
  if (/^[a-f0-9]{32}$/i.test(nameOrId)) {
    return { id: nameOrId, name: nameOrId, universe: 'CUSTOM' };
  }
  if (!apiKey) throw new Error(`Unknown speaker "${nameOrId}" and no API key to search.`);
  const url = new URL('https://api.fish.audio/model');
  url.searchParams.set('title', nameOrId);
  url.searchParams.set('page_size', '5');
  url.searchParams.set('sort_by', 'task_count');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await res.json();
  const top = (data.items || []).find(m => m.type === 'tts' && m.state === 'trained' && !m.dmca_taken_down);
  if (!top) throw new Error(`No trained community voice model found for "${nameOrId}".`);
  return { id: top._id, name: nameOrId.toUpperCase(), universe: 'CUSTOM' };
}

async function getAudioDuration(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath
  ]);
  return parseFloat(stdout.trim());
}

async function main() {
  const args = process.argv.slice(2);
  let speaker = '';
  let text = '';
  let outPath = '';

  for (const a of args) {
    if (a.startsWith('--speaker=')) speaker = a.slice(10);
    else if (a.startsWith('--text=')) text = a.slice(7);
    else if (a.startsWith('--output=') || a.startsWith('--out=')) outPath = a.split('=')[1];
  }

  if (!speaker || !text || !outPath) {
    console.error('Usage: node tools/synthesize.mjs --speaker="batman" --text="..." --output="path.wav"');
    process.exit(1);
  }

  const apiKey = await loadApiKey();
  if (!apiKey) throw new Error('FISH_STUDIO_APIKEY is required for voice synthesis.');

  const voice = await resolveVoice(speaker, apiKey);
  const fullOut = path.resolve(process.cwd(), outPath);
  await mkdir(path.dirname(fullOut), { recursive: true });

  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      model: 's2.1-pro-free'
    },
    body: JSON.stringify({
      text,
      reference_id: voice.id,
      format: 'wav',
      normalize: true,
      prosody: { speed: 1.05, volume: 0 }
    })
  });

  if (!res.ok) throw new Error(`TTS synthesis failed (${res.status}): ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(fullOut, buf);

  const rawDuration = await getAudioDuration(fullOut);
  const durationSeconds = Math.round(rawDuration / 0.04) * 0.04;

  const result = {
    file: outPath,
    speaker: voice.name,
    durationSeconds,
    authorized: true,
    provenance: `Fish Audio s2.1-pro-free (${voice.name} voice ${voice.id})`
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('[synthesize] Error:', err.message);
  process.exit(1);
});
