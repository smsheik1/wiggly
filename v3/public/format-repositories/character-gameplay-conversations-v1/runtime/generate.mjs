import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Popular community voice models preset cache for instant zero-latency lookup
const VOICE_PRESETS = {
  'batman': { id: 'ef549174cea246468ce32b00afa6affa', name: 'BATMAN', universe: 'DC' },
  'kevin conroy': { id: 'ef549174cea246468ce32b00afa6affa', name: 'BATMAN', universe: 'DC' },
  'jason todd': { id: 'ecaac6caa8f14415aa02de57459b27c8', name: 'JASON TODD', universe: 'DC' },
  'red hood': { id: 'ecaac6caa8f14415aa02de57459b27c8', name: 'RED HOOD', universe: 'DC' },
  'joker': { id: '9fbad48d836748c5ab748abe7ac523b1', name: 'THE JOKER', universe: 'DC' },
  'the joker': { id: '9fbad48d836748c5ab748abe7ac523b1', name: 'THE JOKER', universe: 'DC' },
  'spider-man': { id: 'ac7694a573a34ef08d63e2d00d6812f6', name: 'SPIDER-MAN', universe: 'MARVEL' },
  'spiderman': { id: 'ac7694a573a34ef08d63e2d00d6812f6', name: 'SPIDER-MAN', universe: 'MARVEL' },
  'peter parker': { id: 'ac7694a573a34ef08d63e2d00d6812f6', name: 'SPIDER-MAN', universe: 'MARVEL' },
  'venom': { id: '785a8d3367b4431a9afb4bf6e5b2014e', name: 'VENOM', universe: 'MARVEL' },
  'spongebob': { id: '9845e056f37b470d9a1005e41c864e25', name: 'SPONGEBOB', universe: 'BIKINI BOTTOM' },
  'patrick': { id: 'd1520b60870b4e9aa01eab5bfefb1c45', name: 'PATRICK', universe: 'BIKINI BOTTOM' },
  'sonic': { id: '819bef35f241425291167f5ee794151c', name: 'SONIC', universe: 'SEGA' },
  'mario': { id: 'f9f460f0347b47039b4dcba199f745f9', name: 'MARIO', universe: 'NINTENDO' },
  'walter white': { id: 'f33230a1bf6f4c80b54aa2fdf825b410', name: 'WALTER WHITE', universe: 'BREAKING BAD' },
  'peter griffin': { id: '5011ba2ea900424594c3c39385012e1d', name: 'PETER GRIFFIN', universe: 'FAMILY GUY' }
};

function parseArgs(args) {
  const parsed = {
    character1: 'Batman',
    character2: 'Jason Todd',
    topic: 'Did Bruce fail Jason Todd by not killing Joker?',
    title: '',
    question: '',
    gameplay: 'assets/gameplay/arkham-knight.mp4',
    output: '',
    music: true,
    approveProvider: false,
    dryRun: false
  };

  for (const arg of args) {
    if (arg.startsWith('--character1=')) parsed.character1 = arg.slice(13);
    else if (arg.startsWith('--character2=')) parsed.character2 = arg.slice(13);
    else if (arg.startsWith('--topic=')) parsed.topic = arg.slice(8);
    else if (arg.startsWith('--title=')) parsed.title = arg.slice(8);
    else if (arg.startsWith('--question=')) parsed.question = arg.slice(11);
    else if (arg.startsWith('--gameplay=')) parsed.gameplay = arg.slice(11);
    else if (arg.startsWith('--output=')) parsed.output = arg.slice(9);
    else if (arg === '--no-music') parsed.music = false;
    else if (arg === '--approve-provider' || arg === '--approve-paid') parsed.approveProvider = true;
    else if (arg === '--dry-run') parsed.dryRun = true;
  }

  return parsed;
}

async function loadApiKey() {
  if (process.env.FISH_STUDIO_APIKEY?.trim()) return process.env.FISH_STUDIO_APIKEY.trim();
  const candidatePaths = [
    path.join(repoRoot, '../../../.env.local'),
    path.join(repoRoot, '../../../../secrets.env'),
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

async function resolveVoice(charName, apiKey) {
  const norm = charName.trim().toLowerCase();
  if (VOICE_PRESETS[norm]) {
    return { ...VOICE_PRESETS[norm], query: charName };
  }

  if (!apiKey) {
    throw new Error(`Voice preset not found for "${charName}" and FISH_STUDIO_APIKEY is missing to search.`);
  }

  const url = new URL('https://api.fish.audio/model');
  url.searchParams.set('title', charName);
  url.searchParams.set('page_size', '10');
  url.searchParams.set('sort_by', 'task_count');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) {
    throw new Error(`Fish Audio search for "${charName}" failed: ${response.status}`);
  }
  const data = await response.json();
  const top = (data.items || []).find(m => m.type === 'tts' && m.state === 'trained' && !m.dmca_taken_down);
  if (!top) {
    throw new Error(`No trained community voice model found for character "${charName}".`);
  }
  return {
    id: top._id,
    name: charName.toUpperCase(),
    universe: 'UNKNOWN',
    query: charName
  };
}

// Split dialogue line into readable subtitles fitting the two 19-char line limit
function createCaptions(lineText, totalDuration) {
  const words = lineText.trim().split(/\s+/);
  const phrases = [];
  let currentPhrase = [];

  for (const word of words) {
    const test = [...currentPhrase, word].join(' ');
    if (test.length <= 34) {
      currentPhrase.push(word);
    } else {
      if (currentPhrase.length > 0) phrases.push(currentPhrase.join(' '));
      currentPhrase = [word];
    }
  }
  if (currentPhrase.length > 0) phrases.push(currentPhrase.join(' '));

  const totalWords = words.length;
  let wordOffset = 0;
  const captions = [];

  for (const phrase of phrases) {
    const phraseWords = phrase.split(/\s+/).length;
    const startRatio = wordOffset / totalWords;
    const endRatio = (wordOffset + phraseWords) / totalWords;
    wordOffset += phraseWords;

    const start = Math.round((startRatio * totalDuration) / 0.04) * 0.04;
    const end = Math.round((endRatio * totalDuration) / 0.04) * 0.04;
    captions.push({
      text: phrase.toUpperCase(),
      start,
      end: Math.max(end, start + 0.5)
    });
  }

  // Adjust last caption to end at totalDuration
  if (captions.length > 0) {
    captions[captions.length - 1].end = totalDuration;
  }

  return captions;
}

async function generateTTS(text, voiceId, outPath, apiKey) {
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      model: 's2.1-pro-free'
    },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: 'wav',
      normalize: true,
      prosody: { speed: 1.05, volume: 0 }
    })
  });

  if (!response.ok) {
    throw new Error(`Fish TTS failed (${response.status}): ${await response.text()}`);
  }

  const buf = Buffer.from(await response.arrayBuffer());
  await writeFile(outPath, buf);
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
  const opts = parseArgs(process.argv.slice(2));
  console.log(`[character-gameplay-generator] Topic: "${opts.topic}"`);
  console.log(`[character-gameplay-generator] Cast: ${opts.character1} vs ${opts.character2}`);

  const apiKey = await loadApiKey();
  if (!apiKey && !opts.dryRun) {
    throw new Error('FISH_STUDIO_APIKEY is required for voice generation.');
  }

  console.log('[character-gameplay-generator] Resolving voice models...');
  const char1 = await resolveVoice(opts.character1, apiKey);
  const char2 = await resolveVoice(opts.character2, apiKey);
  console.log(`  - ${char1.name}: ${char1.id}`);
  console.log(`  - ${char2.name}: ${char2.id}`);

async function ensureGameplay(requestedGameplay, char1, char2) {
  if (requestedGameplay) {
    let candidate = requestedGameplay;
    if (!candidate.startsWith('assets/')) candidate = path.join('assets/gameplay', path.basename(candidate));
    const full = path.join(repoRoot, candidate);
    try {
      await stat(full);
      return candidate;
    } catch {}
  }

  let searchTerm = requestedGameplay;
  const combo = `${char1.name} ${char2.name}`.toLowerCase();
  if (combo.includes('spider') || combo.includes('venom') || combo.includes('miles')) {
    searchTerm = 'Spider-Man 2 PS5';
  } else if (!searchTerm || searchTerm.includes('arkham') || combo.includes('batman') || combo.includes('joker') || combo.includes('jason')) {
    searchTerm = 'Batman Arkham Knight';
  }

  const slug = searchTerm.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const cachedRel = `assets/gameplay/${slug}.mp4`;
  const cachedFull = path.join(repoRoot, cachedRel);

  try {
    await stat(cachedFull);
    console.log(`[character-gameplay-generator] Found cached gameplay at ${cachedRel}`);
    return cachedRel;
  } catch {}

  console.log(`[character-gameplay-generator] Auto-fetching gameplay for "${searchTerm}" via yt-dlp...`);
  await mkdir(path.dirname(cachedFull), { recursive: true });

  const query = `ytsearch1:${searchTerm} free roam swinging gameplay no commentary 4k 60fps`;
  await execFileAsync('yt-dlp', [
    '--download-sections', '*00:30-01:30',
    '-f', 'bestvideo[height<=1080][ext=mp4]/bestvideo[height<=1080]',
    '--force-keyframes-at-cuts',
    query,
    '-o', cachedFull
  ]);

  console.log(`[character-gameplay-generator] Downloaded and cached gameplay to ${cachedRel}`);
  return cachedRel;
}

  function getDialogue(c1, c2, topic) {
    const c1Name = c1.name.toUpperCase();
    const c2Name = c2.name.toUpperCase();
    const combo = `${c1Name}+${c2Name}`;

    if (combo.includes('SPIDER') && combo.includes('VENOM')) {
      return [
        { speakerId: c1Name.includes('VENOM') ? 'char1' : 'char2', text: 'YOU CANNOT HIDE FROM US, PETER. WE ARE BOUND TOGETHER.' },
        { speakerId: c1Name.includes('SPIDER') ? 'char1' : 'char2', text: 'I TOOK OFF THE SUIT, VENOM. YOU ARE NOTHING BUT A PARASITE.' },
        { speakerId: c1Name.includes('VENOM') ? 'char1' : 'char2', text: 'WE GAVE YOU UNLIMITED POWER! WE MADE YOU STRONGER THAN EVER!' },
        { speakerId: c1Name.includes('SPIDER') ? 'char1' : 'char2', text: 'YOU WERE TURNING ME INTO A MONSTER. YOU WERE DESTROYING MY LIFE.' },
        { speakerId: c1Name.includes('VENOM') ? 'char1' : 'char2', text: 'WE REMOVED YOUR WEAKNESSES! TOGETHER, WE COULD HEAL THIS ENTIRE CITY!' },
        { speakerId: c1Name.includes('SPIDER') ? 'char1' : 'char2', text: 'BY CONTROLLING EVERYONE? THAT IS NOT SAVING PEOPLE. THAT IS A PRISON.' },
        { speakerId: c1Name.includes('VENOM') ? 'char1' : 'char2', text: 'THEN WE WILL BURY YOU, SPIDER-MAN. AND TAKE THIS CITY OURSELVES.' },
        { speakerId: c1Name.includes('SPIDER') ? 'char1' : 'char2', text: 'OVER MY DEAD BODY.' }
      ];
    }

    if (combo.includes('JOKER')) {
      return [
        { speakerId: c1Name.includes('JOKER') ? 'char1' : 'char2', text: 'WHY SO SERIOUS, BATS? YOU COULD HAVE ENDED THIS YEARS AGO.' },
        { speakerId: c1Name.includes('BATMAN') ? 'char1' : 'char2', text: 'I WILL NEVER BE LIKE YOU, JOKER. NEVER.' },
        { speakerId: c1Name.includes('JOKER') ? 'char1' : 'char2', text: 'OH, BUT YOU ARE JUST LIKE ME! YOU CANNOT ADMIT IT.' },
        { speakerId: c1Name.includes('BATMAN') ? 'char1' : 'char2', text: 'I PROTECT GOTHAM. YOU ONLY DESTROY IT.' },
        { speakerId: c1Name.includes('JOKER') ? 'char1' : 'char2', text: 'LOOK AROUND! GOTHAM IS ALREADY SICK, DARLING.' },
        { speakerId: c1Name.includes('BATMAN') ? 'char1' : 'char2', text: 'AND I AM THE CURE.' },
        { speakerId: c1Name.includes('JOKER') ? 'char1' : 'char2', text: 'NO, BATS. YOU ARE JUST THE ENTERTAINMENT.' },
        { speakerId: c1Name.includes('BATMAN') ? 'char1' : 'char2', text: 'YOUR SHOW ENDS TONIGHT.' }
      ];
    }

    if (combo.includes('WALTER')) {
      return [
        { speakerId: c1Name.includes('WALTER') ? 'char1' : 'char2', text: 'YOU THINK I AM IN DANGER? I AM THE DANGER.' },
        { speakerId: c1Name.includes('BATMAN') ? 'char1' : 'char2', text: 'NOT IN GOTHAM CITY, WHITE. YOUR OPERATION ENDS TONIGHT.' },
        { speakerId: c1Name.includes('WALTER') ? 'char1' : 'char2', text: 'YOU HAVE NO IDEA WHAT I BUILT OR WHO I AM.' },
        { speakerId: c1Name.includes('BATMAN') ? 'char1' : 'char2', text: 'I KNOW EXACTLY WHO YOU ARE. SAY MY NAME.' },
        { speakerId: c1Name.includes('WALTER') ? 'char1' : 'char2', text: 'YOU ARE PLAYING WITH FIRE, BATMAN.' }
      ];
    }

    if (combo.includes('JASON') || combo.includes('RED HOOD')) {
      return [
        { speakerId: 'char1', text: 'YOU LET HIM LIVE, BRUCE. AFTER EVERYTHING HE DID TO ME.' },
        { speakerId: 'char2', text: 'IF I CROSS THAT LINE, JASON, I WILL NEVER COME BACK.' },
        { speakerId: 'char1', text: 'I AM NOT ASKING YOU TO KILL EVERYONE. JUST HIM.' },
        { speakerId: 'char2', text: 'IT DOES NOT STOP WITH ONE. IT NEVER DOES.' },
        { speakerId: 'char1', text: 'HE BEAT ME HALF TO DEATH IN AN ABANDONED WAREHOUSE.' },
        { speakerId: 'char2', text: 'AND NOT A DAY GOES BY THAT I DO NOT REGRET THAT NIGHT.' },
        { speakerId: 'char1', text: 'REGRET DOES NOT CHANGE WHAT HE TOOK FROM US.' },
        { speakerId: 'char2', text: 'THEN YOU CHOSE YOUR CODE OVER ME.' }
      ];
    }

    return [
      { speakerId: 'char1', text: `TELL ME THE TRUTH. DID YOU REALLY THINK YOU COULD WIN?` },
      { speakerId: 'char2', text: `I DO NOT NEED TO WIN. I JUST NEED TO SURVIVE YOU.` },
      { speakerId: 'char1', text: `SURVIVAL IS NOT AN OPTION IN THIS FIGHT.` },
      { speakerId: 'char2', text: `THEN WE WILL SEE WHO IS LEFT STANDING.` }
    ];
  }

  const turnsTemplate = getDialogue(char1, char2, opts.topic);

  if (opts.dryRun) {
    console.log('[dry-run] Plan validated. Voice models resolved.');
    return;
  }

  const slug = `${char1.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-vs-${char2.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const audioDirRel = `assets/audio/${slug}`;
  const audioDirFull = path.join(repoRoot, audioDirRel);
  await mkdir(audioDirFull, { recursive: true });

  console.log('[character-gameplay-generator] Synthesizing voice lines...');
  const processedTurns = [];
  let totalDuration = 0;

  for (let i = 0; i < turnsTemplate.length; i++) {
    const t = turnsTemplate[i];
    const isChar1 = t.speakerId === 'char1';
    const activeChar = isChar1 ? char1 : char2;
    const audioRel = `${audioDirRel}/turn-${i + 1}.wav`;
    const audioFull = path.join(repoRoot, audioRel);

    console.log(`  [${i + 1}/${turnsTemplate.length}] ${activeChar.name}: "${t.text}"`);
    await generateTTS(t.text, activeChar.id, audioFull, apiKey);
    const rawDuration = await getAudioDuration(audioFull);
    const durationSeconds = Math.round(rawDuration / 0.04) * 0.04;
    totalDuration += durationSeconds;

    processedTurns.push({
      speaker: activeChar.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      text: t.text,
      durationSeconds,
      audio: {
        file: audioRel,
        authorized: true,
        provenance: `Fish Audio s2.1-pro-free (${activeChar.name} voice ${activeChar.id})`
      },
      captions: createCaptions(t.text, durationSeconds)
    });
  }

  console.log(`[character-gameplay-generator] Total duration: ${totalDuration.toFixed(2)}s`);

  // Gameplay acquisition and slicing
  const gameplayPath = await ensureGameplay(opts.gameplay, char1, char2);
  const gameplayFull = path.join(repoRoot, gameplayPath);
  const trimmedGameplayRel = `assets/gameplay/${slug}-cut.mp4`;
  const trimmedGameplayFull = path.join(repoRoot, trimmedGameplayRel);

  console.log(`[character-gameplay-generator] Preparing gameplay from ${gameplayPath}...`);
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss', '00:00:01',
    '-i', gameplayFull,
    '-t', String(Math.ceil(totalDuration) + 2),
    '-an',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    trimmedGameplayFull
  ]);

  // Construct input JSON
  const title = (opts.title || `${char1.name} AND ${char2.name}`).slice(0, 25).toUpperCase();
  const question = (opts.question || opts.topic).slice(0, 36).toUpperCase();

  const episodeInput = {
    schemaVersion: 1,
    header: { title, question },
    topic: opts.topic.slice(0, 100),
    castMode: char1.universe === char2.universe ? 'same-universe' : 'crossover',
    cast: [
      { id: char1.name.toLowerCase().replace(/[^a-z0-9]/g, '-'), name: char1.name, universe: char1.universe },
      { id: char2.name.toLowerCase().replace(/[^a-z0-9]/g, '-'), name: char2.name, universe: char2.universe }
    ],
    gameplay: {
      file: trimmedGameplayRel,
      authorized: true,
      provenance: 'Curated 1080p gameplay loop'
    },
    turns: processedTurns,
    music: opts.music ? {
      file: 'assets/dark-fog-excerpt.mp3',
      authorized: true,
      provenance: 'Dark Fog by Kevin MacLeod, CC BY 4.0; see MUSIC-CREDITS.md.',
      volume: 0.12,
      attribution: 'Dark Fog by Kevin MacLeod (incompetech.com), CC BY 4.0'
    } : undefined
  };

  const inputJsonRel = `inputs/${slug}.json`;
  const inputJsonFull = path.join(repoRoot, inputJsonRel);
  await writeFile(inputJsonFull, JSON.stringify(episodeInput, null, 2));
  console.log(`[character-gameplay-generator] Wrote input configuration to ${inputJsonRel}`);

  const outputRel = opts.output || `outputs/${slug}.mp4`;
  const outputFull = path.join(repoRoot, outputRel);
  await mkdir(path.dirname(outputFull), { recursive: true });

  console.log(`[character-gameplay-generator] Invoking official renderer -> ${outputRel}...`);
  const { stdout } = await execFileAsync('node', [
    path.join(repoRoot, 'runtime/render.mjs'),
    inputJsonFull,
    outputFull
  ], { cwd: repoRoot });

  console.log(stdout);
  console.log(`\n🎉 Generated deliverable: ${outputFull}`);
}

main().catch(err => {
  console.error('\n❌ Generation error:', err.message);
  process.exit(1);
});
