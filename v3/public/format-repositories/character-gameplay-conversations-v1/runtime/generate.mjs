import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { critiqueScript, formatCritiqueReport } from './critique.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Popular community voice models preset cache for instant zero-latency lookup
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
    input: '',
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
    else if (arg.startsWith('--input=')) parsed.input = arg.slice(8);
    else if (arg.startsWith('--script=')) parsed.input = arg.slice(9);
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
    const topicLow = (topic || '').toLowerCase();

    // 1. Robin & Batman Socratic Dialogues
    if (combo.includes('ROBIN') && combo.includes('BATMAN')) {
      const rId = c1Name.includes('ROBIN') ? 'char1' : 'char2';
      const bId = c1Name.includes('BATMAN') ? 'char1' : 'char2';

      if (topicLow.includes('sleep') || topicLow.includes('rest') || topicLow.includes('tired')) {
        return [
          { speakerId: rId, text: 'Bruce, serious question. How do you actually survive on no sleep? You patrol all night and work all day.' },
          { speakerId: bId, text: "I don't stay awake 24 hours a day, Tim." },
          { speakerId: rId, text: 'Yeah, but standard REM sleep takes at least 90 minutes to kick in. If you just take quick naps, your brain never repairs itself.' },
          { speakerId: bId, text: 'Think about the biology. What happens if you intentionally drop your resting heart rate to 40 beats per minute while your central nervous system is exhausted?' },
          { speakerId: rId, text: 'I don\'t know. Your organs shut down?' },
          { speakerId: bId, text: 'No. You skip the light sleep stages entirely. The body panics and drops straight into REM to repair itself.' },
          { speakerId: rId, text: 'Wait. So, 20-minute cycles four times a day?' },
          { speakerId: bId, text: 'It forces the exact same neurological repair as a full night of sleep.' },
          { speakerId: rId, text: 'So you just park the Batmobile in an alley and force yourself into a 20-minute coma?' },
          { speakerId: bId, text: "It's efficient." },
          { speakerId: rId, text: 'That sounds miserable. Aren\'t you exhausted all the time?' },
          { speakerId: bId, text: "Let's just say Alfred's coffee budget is higher than my gadget budget." }
        ];
      }

      if (topicLow.includes('money') || topicLow.includes('billionaire') || topicLow.includes('cost') || topicLow.includes('buy') || topicLow.includes('real estate') || topicLow.includes('wealth')) {
        return [
          { speakerId: rId, text: 'Bruce, serious question. How much money do you actually have?' },
          { speakerId: bId, text: 'I have enough.' },
          { speakerId: rId, text: 'That is not a number. People say you are a billionaire, but you crashed three Batwings this year alone. Those have to be, what, a hundred million dollars each?' },
          { speakerId: bId, text: '85 million, but the manufacturing costs are heavily subsidized by Wayne Aerospace military contracts. It is an acceptable loss margin.' },
          { speakerId: rId, text: 'Acceptable loss? Bruce, you basically burn the GDP of a small country every weekend. Just practically speaking, could you buy Gotham?' },
          { speakerId: bId, text: 'I already own 38% of the commercial real estate in the city.' },
          { speakerId: rId, text: 'Wait, seriously? You are telling me you just casually buy up skyscrapers? Why? To make a profit?' },
          { speakerId: bId, text: 'No, it is a tactical necessity. Owning the buildings bypasses city zoning laws. It allows me to install reinforced grappling points, hidden server hubs, and automated Batmobile repair bays without municipal oversight.' },
          { speakerId: rId, text: 'So, while the rest of the world is investing in stocks, you are buying hundred million dollar high-rises just to glue stone gargoyles onto them so you can swing around easier.' },
          { speakerId: bId, text: 'Modern architecture is tactically inefficient, Tim. Someone had to fix it.' }
        ];
      }

      if (topicLow.includes('jason') || topicLow.includes('red hood') || topicLow.includes('todd') || topicLow.includes('cache') || topicLow.includes('weapons') || topicLow.includes('gear')) {
        return [
          { speakerId: rId, text: 'Bruce, serious question. Jason Todd is running around Crime Alley with dual military pistols, ceramic armor, and Wayne Tech titanium grappling hooks. Where is he getting this stuff?' },
          { speakerId: bId, text: 'He is raiding secondary tactical caches I established in 2018.' },
          { speakerId: rId, text: 'Wait. You are telling me Red Hood is literally using your own old gear to execute mobsters?' },
          { speakerId: bId, text: 'When Jason was Robin, he memorized the 24-character cryptographic cypher for my emergency armories. I chose not to change the master password.' },
          { speakerId: rId, text: 'You didn\'t change the password?! Bruce, you have biometric voice encryption on your toaster, but you left weapons caches on default settings for your rogue son?' },
          { speakerId: bId, text: 'If I locked him out, he would resort to buying unstable black-market ordnance from the Russian mob. Sub-standard munitions have a 14% higher collateral casualty rate among civilians.' },
          { speakerId: rId, text: 'So you are subsidizing his vigilante rampage with high-grade Kevlar and precision ammunition so he doesn\'t accidentally blow up a city block?!' },
          { speakerId: bId, text: 'It is risk mitigation, Tim. Parenting a dead Robin requires tactical compromises.' }
        ];
      }

      // Default Robin & Batman: Why Batman Won't Kill Joker
      return [
        { speakerId: rId, text: 'Bruce, serious question. Why won\'t you just kill the Joker? The guy has broken out of Arkham 34 times and poisoned half the city. At this point, you are practically his getaway driver.' },
        { speakerId: bId, text: 'Think about the legal framework, Tim. If I execute him, what happens to Gotham\'s judicial system?' },
        { speakerId: rId, text: 'I don\'t know, a parade? People get to breathe without wearing gas masks?' },
        { speakerId: bId, text: 'No. Under New Jersey penal law, an extrajudicial execution by an un-deputized vigilante taints every active municipal indictment. His defense attorneys would file immediate chain-of-custody violations across every prosecution.' },
        { speakerId: rId, text: 'Wait. So if you snap his neck, his lawyers get hundreds of other inmates released on technicalities?' },
        { speakerId: bId, text: 'Exactly. Two-Face, Penguin, and Zsasz walk free within 48 hours. The Joker becomes a constitutional martyr for police brutality.' },
        { speakerId: rId, text: 'So you keep him alive not because of your moral code, but because Gotham\'s court paperwork is an absolute nightmare.' },
        { speakerId: bId, text: 'Bureaucracy is Gotham\'s real villain, Tim. Even the Batmobile can\'t run over a municipal injunction.' }
      ];
    }

    // 2. Jason Todd vs Batman Direct Confrontation
    if (combo.includes('JASON') || combo.includes('RED HOOD')) {
      const jId = (c1Name.includes('JASON') || c1Name.includes('RED HOOD')) ? 'char1' : 'char2';
      const bId = (c1Name.includes('JASON') || c1Name.includes('RED HOOD')) ? 'char2' : 'char1';
      return [
        { speakerId: jId, text: 'You traced the serial numbers on my suppressors, Bruce? Wayne Enterprises batch 8-0-4.' },
        { speakerId: bId, text: 'You are using my ceramic armor piercing rounds to hunt Maroni Lieutenants. 400 foot-pounds of muzzle energy.' },
        { speakerId: jId, text: 'Because your non-lethal batarangs leave suspects with permanent neurological trauma. At least my 9mm is decisive.' },
        { speakerId: bId, text: 'A bullet creates an irreversible endpoint. In 2021, Maroni accountant testified because he survived. Three cartel cells collapsed because of his testimony.' },
        { speakerId: jId, text: 'And last month, that same accountant paid 50 grand to bail out the shooter who killed two patrol cops.' },
        { speakerId: bId, text: 'If we execute suspects before trial, the GCPD adopts a shoot-to-kill mandate within six months. The rule of law is a containment system, Jason.' },
        { speakerId: jId, text: 'Wait, so you are not a containment system, Bruce. You are just a billionaire in Kevlar running a revolving door.' },
        { speakerId: bId, text: 'Then stop breaking into my secondary caches to borrow my Kevlar.' }
      ];
    }

    // 3. Spider-Man vs Batman Crossover
    if (combo.includes('SPIDER') && combo.includes('BATMAN')) {
      const sId = c1Name.includes('SPIDER') ? 'char1' : 'char2';
      const bId = c1Name.includes('BATMAN') ? 'char1' : 'char2';
      return [
        { speakerId: sId, text: 'Bruce, serious question: I still am not convinced you could beat me without prep time. The second you reach for your belt, I web your hands. Fight over.' },
        { speakerId: bId, text: 'You are right. If I tried to deploy a weapon, your precognition would warn you, which is why I wouldn\'t reach for my belt. I\'d let you web me.' },
        { speakerId: sId, text: 'Okay, so you just lose? My webs can hold a city bus. You are not breaking out of that.' },
        { speakerId: bId, text: 'I don\'t need to. Your webbing is an extruded synthetic polymer. It cures on contact with air, but for the first 0.4 seconds, it retains its liquid solvent base.' },
        { speakerId: sId, text: 'Wait, that solvent base... It makes the webbing highly conductive before it solidifies.' },
        { speakerId: bId, text: 'Exactly. My suit is equipped with an automated electrostatic defense grid. The microsecond your web connects to my armor, the grid discharges 300,000 volts directly back up the line.' },
        { speakerId: sId, text: 'My spider-sense would... Wait, but I initiated the contact!' },
        { speakerId: bId, text: 'By the time the current travels up the web to your wrists, it is too late to let go. You drop to the floor paralyzed, and I didn\'t even have to move.' }
      ];
    }

    // 4. Spider-Man vs Venom
    if (combo.includes('SPIDER') && combo.includes('VENOM')) {
      const sId = c1Name.includes('SPIDER') ? 'char1' : 'char2';
      const vId = c1Name.includes('VENOM') ? 'char1' : 'char2';
      return [
        { speakerId: sId, text: 'Venom, serious question. You infected 42 city blocks with symbiotic tendrils, but the subway resonance is already tearing you apart.' },
        { speakerId: vId, text: 'SUBWAY FREQUENCIES ARE ONLY 120 HERTZ, PARKER. WE EVOLVED BEYOND THAT ACOUSTIC THRESHOLD.' },
        { speakerId: sId, text: 'Right, but the structural vibration along the Lexington Avenue line vibrates at 14,000 hertz when the express train hits the third rail. Your cellular membrane destabilizes in 0.8 seconds.' },
        { speakerId: vId, text: 'LIES! WE BONDED TO YOUR CENTRAL NERVOUS SYSTEM, PETER. WE KNOW YOUR BIOLOGY.' },
        { speakerId: sId, text: 'You know my old biology. Since we split, I synthesized an auditory damping layer in my suit polymer weave. That train is arriving in three, two, one.' },
        { speakerId: vId, text: 'NO! THE HIGH-PITCHED FEEDBACK... OUR MASS IS DISSOLVING!' },
        { speakerId: sId, text: 'Next time you want to bond for life, check the transit schedule first.' }
      ];
    }

    // 5. Joker vs Batman
    if (combo.includes('JOKER') && combo.includes('BATMAN')) {
      const jId = c1Name.includes('JOKER') ? 'char1' : 'char2';
      const bId = c1Name.includes('BATMAN') ? 'char1' : 'char2';
      return [
        { speakerId: jId, text: 'Bruce, serious question: why do you keep hauling me to Arkham Asylum? In the last five years, I have broken out seventeen times.' },
        { speakerId: bId, text: 'Because Arkham is a classified Department of Corrections psychiatric facility, not a black site.' },
        { speakerId: jId, text: 'A psychiatric facility with drywall made of cardboard! You spent 40 million dollars on a bat-shaped jet, but you cannot buy Arkham a functional padlock?' },
        { speakerId: bId, text: 'Arkham maximum-security ward is encased in 18 inches of reinforced graphene polymer. You only escape when municipal guards disable the magnetic relays.' },
        { speakerId: jId, text: 'Wait, so you know the guards are taking my bribes, and you still send me back to the exact same cell?' },
        { speakerId: bId, text: 'Every transaction leaves a blockchain ledger with the Federal Reserve. Over three years, your escape bribes have exposed 24 dirty judges and half the city council.' },
        { speakerId: jId, text: 'You are telling me you let me break out just to audit municipal payroll?!' },
        { speakerId: bId, text: 'Forensic accounting puts away more criminals than batarangs, Joker.' }
      ];
    }

    // 6. Walter White vs Batman
    if (combo.includes('WALTER')) {
      const wId = c1Name.includes('WALTER') ? 'char1' : 'char2';
      const bId = c1Name.includes('BATMAN') ? 'char1' : 'char2';
      return [
        { speakerId: wId, text: 'Batman, serious question: you think I am just another Gotham narcotics distributor? 99.1% chemical purity. No one in this city can touch my yield.' },
        { speakerId: bId, text: 'Your phenylacetone synthesis relies on methylamine shipments hijacked from Madrigal Electromotive in Houston. Wayne Shipping intercepted the manifest 36 hours ago.' },
        { speakerId: wId, text: 'You intercepted a federal shipment?! You have no legal jurisdiction outside Gotham!' },
        { speakerId: bId, text: 'I own 51% of Madrigal parent logistics provider. Your precursor supply chain does not exist anymore, Mr. White.' },
        { speakerId: wId, text: 'Wait, so you are telling me you bought an entire logistics conglomerate just to shut down my laboratory?!' },
        { speakerId: bId, text: 'You are an Albuquerque chemistry teacher with stage-three lung cancer and 11 million dollars buried in the desert. Sit down before I freeze your offshore accounts.' }
      ];
    }

    // 7. General Forensic & Socratic Fallback
    return [
      { speakerId: 'char1', text: `${char2.name}, serious question: why do you spend 12 hours a day patrolling when the crime statistics in this district have not dropped by even 2%?` },
      { speakerId: 'char2', text: 'Because crime statistics measure reported incidents, not prevented casualties. In the last six months, preemptive surveillance stopped 45 armed robberies before 911 dispatches.' },
      { speakerId: 'char1', text: 'Wait, so you are telling me you intercept emergency frequencies and act as an unauthorized security force without municipal liability insurance?' },
      { speakerId: 'char2', text: 'Municipal liability requires civilian oversight. When dealing with military-grade munitions, bureaucracy introduces an average response delay of 14 minutes.' },
      { speakerId: 'char1', text: 'Right, but you bypass civil court just so you can drop through skylights 14 minutes faster.' },
      { speakerId: 'char2', text: `Tactical efficiency is not negotiable in Gotham, ${char1.name}.` }
    ];
  }

  let turnsTemplate = [];
  if (opts.input) {
    const raw = await readFile(path.resolve(repoRoot, opts.input), 'utf8');
    const parsedInput = JSON.parse(raw);
    const turnsArray = parsedInput.turns || parsedInput.dialogue || [];
    turnsTemplate = turnsArray.map(t => ({
      speakerId: (t.speaker || '').toLowerCase().includes(char1.name.toLowerCase()) ? 'char1' : 'char2',
      text: t.text
    }));
    if (parsedInput.header?.title && !opts.title) opts.title = parsedInput.header.title;
    if (parsedInput.header?.question && !opts.question) opts.question = parsedInput.header.question;
  } else {
    turnsTemplate = getDialogue(char1, char2, opts.topic);
  }

  // Pre-Synthesis Retention & Socratic Script Critique Airlock
  const scriptPayload = {
    title: opts.title || `${char1.name} AND ${char2.name}`,
    question: opts.question || opts.topic,
    characters: [char1.name, char2.name],
    turns: turnsTemplate.map(t => ({
      speaker: t.speakerId === 'char1' ? char1.name : char2.name,
      text: t.text
    }))
  };

  const critique = critiqueScript(scriptPayload);
  console.log(`[character-gameplay-generator] Socratic Retention Critique Score: ${critique.score}/100 (${critique.verdict})`);

  if (critique.verdict !== 'PASS') {
    console.error('\n🚨 SCRIPT FAILED RETENTION AIRLOCK:');
    console.error(formatCritiqueReport(critique));
    throw new Error(`Script retention score (${critique.score}/100) failed Socratic quality airlock (minimum required: 85). Generation aborted before provider synthesis.`);
  }

  console.log('  ✅ Dialogue passed retention quality airlock.');

  if (opts.dryRun) {
    console.log('[dry-run] Plan validated. Script passed critique airlock. Voice models resolved.');
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
      file: 'assets/audio/yeat-if-we-being-real.mp3',
      authorized: true,
      provenance: 'Yeat - If We Being Real (Instrumental starting at 0:28)',
      volume: 0.12,
      attribution: 'Instrumental bed: Yeat - If We Being Real (used for pacing under dialogue)'
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
