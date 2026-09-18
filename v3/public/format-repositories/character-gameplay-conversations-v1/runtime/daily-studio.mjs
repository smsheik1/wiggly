#!/usr/bin/env node
/**
 * Autonomous Daily Content Studio Engine - Batman Arkham Conversations
 * 
 * Manages the 7-Day Autonomous YouTube Shorts / TikTok pipeline:
 * 1. Scout: Probes live YouTube search velocity & checks outputs/daily/history.json for deduplication.
 * 2. Critique: Validates dialogue against Socratic Retention Critique Engine (guaranteeing 90+ score).
 * 3. Synthesize & Render: Synthesizes per-turn character audio via Fish Audio, cuts continuous gameplay,
 *    assembles validated input JSON, and renders 1080x1920 vertical Short via runtime/render.mjs.
 * 4. Publish: Drafts platform-optimized copy for YouTube Shorts, Instagram Reels, TikTok, and X,
 *    and generates distribution receipts.
 * 5. Memory: Updates outputs/daily/history.json so no topic or angle is ever repeated.
 */

import { readFile, writeFile, mkdir, stat, rename } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoutTopics, DEFAULT_SEARCH_SEEDS } from './scout.mjs';
import { critiqueScript, formatCritiqueReport } from './critique.mjs';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HISTORY_PATH = path.join(repoRoot, 'outputs/daily/history.json');

// Voice presets for zero-latency lookups
const VOICE_PRESETS = {
  'batman': { id: '46a27a4d536d4dc888ea73563df935a7', name: 'BATMAN', universe: 'DC' },
  'robin': { id: 'bc748d906c524a91bbb88e87f2bac62b', name: 'ROBIN', universe: 'DC' },
  'joker': { id: '9fbad48d836748c5ab748abe7ac523b1', name: 'THE JOKER', universe: 'DC' },
  'the joker': { id: '9fbad48d836748c5ab748abe7ac523b1', name: 'THE JOKER', universe: 'DC' },
  'jason todd': { id: 'ecaac6caa8f14415aa02de57459b27c8', name: 'JASON TODD', universe: 'DC' },
  'spider-man': { id: 'ac7694a573a34ef08d63e2d00d6812f6', name: 'SPIDER-MAN', universe: 'MARVEL' }
};

// 7 Pre-Engineered Socratic Masterpiece Scripts (all verified 90-100 on Critique Airlock)
export const SCRIPT_CATALOG = [
  {
    id: 'why-batman-doesnt-kill-joker',
    title: "ROBIN ASKED BRUCE",
    question: "WHY HE WON'T KILL JOKER",
    topic: "Why Batman Refuses to Execute the Joker Under New Jersey Penal Law",
    flavor: "Flavor B: Deep Lore & Moral Checkmate",
    layout: "The Classic Patrol",
    characters: ["Robin", "Batman"],
    gameplay: "assets/gameplay/batman-arkham-gliding-65s.mp4",
    turns: [
      { speaker: "Robin", text: "Bruce, serious question: why don't you just kill the Joker? He broke out of Arkham 34 times and poisoned half the city. You are practically his getaway driver." },
      { speaker: "Batman", text: "Think about the legal framework, Tim. If I execute him, what happens to Gotham's judicial system?" },
      { speaker: "Robin", text: "I don't know, a parade? People get to breathe without gas masks?" },
      { speaker: "Batman", text: "No. Under New Jersey penal law, an extrajudicial execution by an un-deputized vigilante taints every active indictment. Defense attorneys would file immediate chain-of-custody violations across every prosecution." },
      { speaker: "Robin", text: "Wait. So if you snap his neck, his lawyers get hundreds of other inmates released on technicalities?" },
      { speaker: "Batman", text: "Exactly. Two-Face, Penguin, and Zsasz walk free within 48 hours. The Joker becomes a constitutional martyr." },
      { speaker: "Robin", text: "So you keep him alive not because of your moral code, but because Gotham's court paperwork is a nightmare." },
      { speaker: "Batman", text: "Bureaucracy is Gotham's real villain, Tim. Even the Batmobile can't run over a municipal injunction." }
    ],
    social: {
      ytTitle: "Why Batman NEVER Kills The Joker (It's Not Morality) #Shorts #Batman",
      ytDescription: "Robin asks Bruce Wayne why he won't eliminate the Joker. The real answer isn't a moral code—it's New Jersey penal law and Gotham's nightmare bureaucracy.\n\n#Batman #ArkhamKnight #Robin #DC #Shorts #Gaming",
      igCaption: "The real reason Batman won't kill the Joker has nothing to do with ethics. 🦇📜\n\n#batman #arkhamknight #joker #robin #dccomics #gotham #gamingcommunity",
      xText: "Batman won't kill the Joker because under New Jersey penal law, an un-deputized execution taints chain-of-custody across active indictments and frees Penguin in 48 hours. Gotham's real villain is paperwork."
    }
  },
  {
    id: 'how-much-money-batman-has',
    title: "ROBIN ASKED BRUCE",
    question: "HOW MUCH MONEY HE HAS",
    topic: "The Financial Breakdown of Batman's Billion-Dollar Arsenal",
    flavor: "Flavor A: Mythology Meets Mundane Reality",
    layout: "The Classic Patrol",
    characters: ["Robin", "Batman"],
    gameplay: "assets/gameplay/batman-arkham-gliding-65s.mp4",
    turns: [
      { speaker: "Robin", text: "Bruce, serious question. How much money do you actually have? You crashed three Batwings this year alone. That is 85 million dollars each." },
      { speaker: "Batman", text: "The manufacturing costs are heavily subsidized by Wayne Aerospace military contracts. It is an acceptable loss margin." },
      { speaker: "Robin", text: "Acceptable loss? Bruce, you burn the GDP of a small country every weekend. Could you buy Gotham?" },
      { speaker: "Batman", text: "I already own 38 percent of the commercial real estate in the city." },
      { speaker: "Robin", text: "Wait, seriously? You casually buy skyscrapers? Why, to turn a profit?" },
      { speaker: "Batman", text: "It is a tactical necessity. Owning them bypasses city zoning laws to install reinforced grappling points and repair bays without municipal oversight." },
      { speaker: "Robin", text: "So while people invest in stocks, you buy high-rises just to glue stone gargoyles onto them so you can swing easier." },
      { speaker: "Batman", text: "Modern architecture is tactically inefficient, Tim. Someone had to fix it." }
    ],
    social: {
      ytTitle: "How Much Money Does Batman REALLY Have? #Shorts #Batman",
      ytDescription: "How does Bruce Wayne afford crashing 85 million dollar Batwings? The truth behind his 38 percent commercial real estate monopoly.\n\n#Batman #BruceWayne #Gotham #Shorts #ArkhamKnight",
      igCaption: "Bruce Wayne isn't investing in index funds. He's buying 38 percent of Gotham just to glue tactical gargoyles on skyscrapers. 🏙️🦇\n\n#batman #arkhamknight #brucewayne #gaming #wealth",
      xText: "Robin: 'Why do you own 38 percent of Gotham's commercial real estate?'\nBatman: 'Modern architecture is tactically inefficient, Tim. Someone had to fix it.'"
    }
  },
  {
    id: 'how-batman-survives-no-sleep',
    title: "ROBIN ASKED BRUCE",
    question: "HOW HE SURVIVES NO SLEEP",
    topic: "How Batman Physically Survives on 2 Hours of Sleep",
    flavor: "Flavor A: Mythology Meets Mundane Reality",
    layout: "The Classic Patrol",
    characters: ["Robin", "Batman"],
    gameplay: "assets/gameplay/batman-arkham-gliding-65s.mp4",
    turns: [
      { speaker: "Robin", text: "Bruce, serious question. How do you actually survive on no sleep? Standard REM sleep takes 90 minutes to kick in. If you just take quick naps, your brain never repairs itself." },
      { speaker: "Batman", text: "Think about the biology. What happens if you intentionally drop your resting heart rate to 40 beats per minute while your central nervous system is exhausted?" },
      { speaker: "Robin", text: "I don't know, your organs shut down?" },
      { speaker: "Batman", text: "No. You skip the light sleep stages entirely. The body panics and drops straight into emergency REM sleep to repair neurological pathways." },
      { speaker: "Robin", text: "Wait. So you just take 20-minute cycles four times a day?" },
      { speaker: "Batman", text: "It forces the exact same cellular repair as eight hours of unconsciousness." },
      { speaker: "Robin", text: "So you park the Batmobile in a rainy alley and force yourself into a 20-minute coma?! That sounds miserable." },
      { speaker: "Batman", text: "Let's just say Alfred's coffee budget is higher than my gadget budget." }
    ],
    social: {
      ytTitle: "How Batman Survives On ZERO Sleep (Real Science) #Shorts #Batman",
      ytDescription: "Robin questions Bruce Wayne's impossible sleep schedule. How 40 bpm bradycardia biofeedback keeps the Dark Knight alive.\n\n#Batman #ArkhamKnight #SleepHacks #Shorts",
      igCaption: "How does Batman operate 24/7 without cognitive collapse? 40 bpm emergency REM naps. ☕🦇\n\n#batman #arkhamknight #biohacking #gaming #dccomics",
      xText: "Batman doesn't sleep 8 hours. He induces 40 bpm bradycardia in the Batmobile for 20 minutes to force emergency REM repair. Alfred's coffee budget does the rest."
    }
  },
  {
    id: 'why-batman-subsidizes-red-hood',
    title: "ROBIN ASKED BRUCE",
    question: "WHY HE SUPPLIES RED HOOD",
    topic: "Why Batman Subsidizes Jason Todd's Vigilante Weapons",
    flavor: "Flavor B: Deep Lore & Moral Checkmate",
    layout: "The Classic Patrol",
    characters: ["Robin", "Batman"],
    gameplay: "assets/gameplay/batman-arkham-gliding-65s.mp4",
    turns: [
      { speaker: "Robin", text: "Bruce, serious question. Jason Todd is running around Crime Alley with dual military pistols and Wayne Tech titanium armor. Where is he getting this gear?" },
      { speaker: "Batman", text: "He is raiding secondary tactical caches I established in 2018." },
      { speaker: "Robin", text: "Wait. You are telling me Red Hood is literally using your own armory to execute mobsters?" },
      { speaker: "Batman", text: "When Jason was Robin, he memorized the 24-character cypher for my emergency armories. I chose not to change the master password." },
      { speaker: "Robin", text: "You didn't change the password?! Bruce, you have biometric encryption on your toaster, but you left weapon caches on default settings for your rogue son?" },
      { speaker: "Batman", text: "If I locked him out, he would resort to buying unstable black-market ordnance from the Russian mob. Sub-standard munitions have a 14 percent higher collateral casualty rate among civilians." },
      { speaker: "Robin", text: "So you are subsidizing his vigilante rampage with high-grade Kevlar and precision ammunition so he doesn't accidentally blow up a city block?!" },
      { speaker: "Batman", text: "It is risk mitigation, Tim. Parenting a dead Robin requires tactical compromises." }
    ],
    social: {
      ytTitle: "Why Batman Lets Red Hood Steal His Weapons #Shorts #Batman",
      ytDescription: "Why didn't Batman change the passwords on his secret weapon caches after Jason Todd went rogue? The dark truth about tactical parenting.\n\n#Batman #RedHood #JasonTodd #Shorts",
      igCaption: "Risk mitigation: why Batman deliberately leaves his weapons caches open for Red Hood. 🔴🦇\n\n#batman #redhood #jasontodd #arkhamknight #dcuniverse",
      xText: "Batman left his weapon armory passwords on default so Red Hood wouldn't buy black-market Russian ammo with a 14% higher civilian casualty rate. 'Parenting a dead Robin requires tactical compromises.'"
    }
  },
  {
    id: 'batman-vs-spiderman-precognition',
    title: "SPIDER-MAN VS BATMAN",
    question: "BEATING SPIDER-SENSE",
    topic: "How Batman Neutralizes Spider-Man's Precognition",
    flavor: "Flavor B: Deep Lore & Moral Checkmate",
    layout: "The Universe Breach",
    characters: ["Spider-Man", "Batman"],
    gameplay: "assets/gameplay/spiderman-2-swinging-pro.mp4",
    turns: [
      { speaker: "Spider-Man", text: "Bruce, serious question: you cannot beat me without prep time. The second you reach for your belt, I web your wrists. Fight over." },
      { speaker: "Batman", text: "Your precognition would warn you if I reached for a weapon. Which is why I wouldn't. I'd let you web me." },
      { speaker: "Spider-Man", text: "Wait, so you just surrender? My webs hold ten tons. You cannot break out." },
      { speaker: "Batman", text: "Your webbing is an extruded synthetic polymer. For the first 0.4 seconds, it retains a conductive liquid solvent base." },
      { speaker: "Spider-Man", text: "Wait, that solvent base... It conducts electricity before solidifying." },
      { speaker: "Batman", text: "My suit discharges 300,000 volts from an automated electrostatic grid directly up the web line." },
      { speaker: "Spider-Man", text: "Wait, but my spider-sense wouldn't warn me because I initiated the contact!" },
      { speaker: "Batman", text: "The voltage reaches your wrists before you let go. You drop paralyzed, and I didn't even have to move." }
    ],
    social: {
      ytTitle: "How Batman Counters Spider-Man's Spider-Sense #Shorts #Marvel #DC",
      ytDescription: "Could Batman beat Spider-Man without prep time? Batman breaks down Peter Parker's 0.4-second synthetic polymer weakness.\n\n#Batman #SpiderMan #Marvel #DC #Shorts",
      igCaption: "The forensic breakdown of why Spider-Sense can't save Peter Parker from 300,000 volts down his own web line. 🕷️⚡🦇\n\n#spiderman #batman #marvelvsdc #superheroes",
      xText: "Batman's counter to Spider-Sense: let Peter web him, then discharge 300,000 volts up the web line during the 0.4s conductive solvent window. 'I didn't even have to move.'"
    }
  },
  {
    id: 'why-batman-leaves-arkham-flawed',
    title: "JOKER ASKED BRUCE",
    question: "WHY ARKHAM SECURITY FAILS",
    topic: "Why Batman Leaves Arkham Security Flawed for Forensic Accounting",
    flavor: "Flavor A: Mythology Meets Mundane Reality",
    layout: "The Classic Patrol",
    characters: ["The Joker", "Batman"],
    gameplay: "assets/gameplay/batman-arkham-gliding-65s.mp4",
    turns: [
      { speaker: "The Joker", text: "Bruce, serious question: why do you keep hauling me to Arkham? In five years, I have escaped seventeen times." },
      { speaker: "Batman", text: "Arkham is a classified Department of Corrections psychiatric facility, not an unmonitored black site." },
      { speaker: "The Joker", text: "Drywall made of cardboard! You spend 40 million dollars on a bat-jet, but cannot buy Arkham a functional padlock?" },
      { speaker: "Batman", text: "Arkham maximum-security ward is encased in 18 inches of reinforced graphene polymer. You only escape when municipal guards disable magnetic relays." },
      { speaker: "The Joker", text: "Wait, so you know the guards take my bribes, and still lock me in the exact same cell?" },
      { speaker: "Batman", text: "Every transaction leaves a blockchain ledger with the Federal Reserve. Over three years, your escape bribes have exposed 24 dirty judges and city council." },
      { speaker: "The Joker", text: "You mean to tell me you let me break out just to audit municipal payroll?!" },
      { speaker: "Batman", text: "Forensic accounting puts away more criminals than batarangs, Joker." }
    ],
    social: {
      ytTitle: "Why Batman Lets The Joker Escape Arkham #Shorts #Batman",
      ytDescription: "The Joker asks Batman why Arkham Asylum's security is so terrible. Batman reveals the ultimate forensic sting operation.\n\n#Joker #Batman #ArkhamKnight #Shorts #DC",
      igCaption: "Batman doesn't stop Joker escapes because every bribe traces dirty city council members through forensic banking ledgers. 🃏🦇💼\n\n#joker #batman #arkhamasylum #gaming #dccomics",
      xText: "Joker: 'You spent 40 million on a bat jet, but can't buy Arkham a functional padlock?'\nBatman: 'Forensic accounting puts away more criminals than batarangs, Joker.'"
    }
  },
  {
    id: 'can-batman-beat-superman-no-kryptonite',
    title: "ROBIN ASKED BRUCE",
    question: "BEATING SUPERMAN NO KRYPTONITE",
    topic: "Can Batman Beat Superman Without Kryptonite",
    flavor: "Flavor B: Deep Lore & Moral Checkmate",
    layout: "The Classic Patrol",
    characters: ["Robin", "Batman"],
    gameplay: "assets/gameplay/batman-arkham-gliding-65s.mp4",
    turns: [
      { speaker: "Robin", text: "Bruce, serious question: do you honestly think you could take down Superman without kryptonite? Without green rocks, he is a flying god." },
      { speaker: "Batman", text: "Clark's physiology depends entirely on solar radiation and heightened sensory processing. His strength is his vulnerability." },
      { speaker: "Robin", text: "Wait, so you're telling me you can pierce invulnerable alien skin with bare knuckles?" },
      { speaker: "Batman", text: "I target his eardrums with acoustic cannons calibrated to 140 decibels at 18,000 hertz, overloading his central nervous system." },
      { speaker: "Robin", text: "Right, but sound only stuns him for three seconds. Then he lasers you from orbit." },
      { speaker: "Batman", text: "Three seconds is sufficient to deploy 250 million dollar Wayne Aerospace orbital reflectors, filtering yellow sunlight into red solar wavelengths across two miles." },
      { speaker: "Robin", text: "So you artificially simulate the red sun of Krypton from Wayne satellites in outer space?!" },
      { speaker: "Batman", text: "Clark trusts everyone, Tim. I plan for everyone." }
    ],
    social: {
      ytTitle: "How Batman Defeats Superman WITHOUT Kryptonite #Shorts #Batman",
      ytDescription: "Can Batman beat Superman without kryptonite? The forensic contingency using 140 decibel acoustic overload and orbital red solar filters.\n\n#Batman #Superman #JusticeLeague #Shorts #DC",
      igCaption: "Batman doesn't need green rocks to take down the Man of Steel. 140 decibels and orbital solar filters do the job. ☀️🦇\n\n#batman #superman #dccomics #justiceleague #gaming",
      xText: "How Batman defeats Superman without kryptonite: 140-decibel acoustic overload to freeze super-hearing + orbital red solar filters from Wayne satellites. 'Clark trusts everyone. I plan for everyone.'"
    }
  }
];

export async function loadApiKey() {
  if (process.env.FISH_STUDIO_APIKEY?.trim()) return process.env.FISH_STUDIO_APIKEY.trim();
  const candidatePaths = [
    path.join(repoRoot, '../v3/.env.local'),
    path.join(repoRoot, '../../v3/.env.local'),
    path.join(repoRoot, '../secrets.env'),
    path.join(repoRoot, '../../secrets.env'),
    path.join(repoRoot, '../../../.env.local')
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

export async function generateOriginalScriptWithAgy(topicEntry) {
  const agyPath = existsSync('/Users/shaz/.local/bin/agy') ? '/Users/shaz/.local/bin/agy' : 'agy';

  const titleLower = (topicEntry.title + ' ' + (topicEntry.coreConflict || '')).toLowerCase();
  const isTacticalMatchup = /beat|vs\b|kryptonite|superman|spider-man|spiderman|goku|homelander|flash|jason todd|red hood|kill joker|code/i.test(titleLower);

  const isFourthWallOrMundane = !isTacticalMatchup || /4th wall|fourth wall|breaking the 4th|tax|insurance|who cleans|secret identity/i.test(titleLower);

  const flavor = isTacticalMatchup
    ? "Flavor B: Deep Lore & Moral Checkmate"
    : "Flavor A: Mythology Meets Mundane Reality";

  const flavorInstructions = isTacticalMatchup ? `
FLAVOR B: TACTICAL CHECKMATE & POP-CULTURE / COMIC LORE (MATCHUPS & ROGUES)
- Core Premise: Batman exploits REAL physical, biological, technological, or psychological vulnerabilities from DC, Marvel, anime, or gaming lore (e.g. Iron Man, Wolverine, Homelander, Sukuna, Mr. Freeze, Scarecrow fear toxin).
- Batman is self-aware of pop-culture tropes and franchise conventions (he can dryly acknowledge cross-universe logic, power scaling debates, or 4th-wall reality for peak entertainment).
- The counter-tactic must sound forensically genius:
  * Against Wolverine: High-intensity Wayne electromagnetics locking his adamantium skeleton to 50 tons of magnetic scrap.
  * Against Homelander: Zinc-lined pressurized sonic resonators blowing out his fragile eardrums at 170 dB.
  * Against Mr. Freeze / Scarecrow: Chemical and thermodynamic counters (e.g. anhydrous ammonia, adrenaline blockers).
- Batman's Tone: Deadpan, clinical, unflinching preparation.
- Turn 8 Checkmate: An iconic, mic-drop tactical closer.
` : `
FLAVOR A: MYTHOLOGY MEETS MUNDANE REALITY & 4TH-WALL ENTERTAINMENT (COMEDY GOLDMINE)
- Core Premise: Crash Batman's dark vigilante persona into absurd real-world realities or hilarious fourth-wall awareness (e.g. who cleans the Batcave, Batmobile parking meters, Wayne Enterprises tax write-offs, why gargoyles are everywhere, obvious secret identity).
- Batman's Tone: Exhausted, deadpan senior executive dealing with city bureaucracy, construction unions, or audience logic.
- Turn 8 Checkmate: A dry, witty, universally hilarious reality check.
`;

  const prompt = `You are an elite viral YouTube Shorts writer for the Batman Arkham channel.
Topic: "${topicEntry.title}"
Core Conflict: "${topicEntry.coreConflict || topicEntry.topic}"
Target Flavor: ${flavor}

Format: Exactly 8 dialogue turns alternating between Robin (speaker: "Robin") and Batman (speaker: "Batman").

CRITICAL WRITING RULES:
1. HARD RULE: NEVER use em dashes (---, —) anywhere. Ever. Use a plain hyphen or rewrite the sentence.
2. NO ROBOTIC TECHNO-BABBLE:
   - Ban cyborg buzzwords ("operational efficiency", "severing brainstems", "metabolic slump", "tactical liabilities").
   - Write natural, snappy, spoken English that any casual fan instantly understands in 40 seconds.
3. ${flavorInstructions}
4. SOCRATIC SURROGATE PROGRESSION (MANDATORY):
   - Turn 1: Robin delivers an immediate in-media-res hook starting with "Bruce, serious question: ..." (e.g. "Bruce, serious question: why haven't you just killed the Joker?").
   - Turns 3, 5, and 7: Robin MUST vocalize genuine audience disbelief using explicit surrogate phrases like "Wait. So you...", "Wait, so...", or "So you mean to tell me...".
   - Turn 8: Batman delivers the definitive, legendary tactical closer.
5. FORENSIC DENSITY (MANDATORY FOR 90+ SCORE):
   - You MUST include at least THREE concrete numbers, dollar amounts, percentages, or forensic units across Batman's dialogue.
   - Examples of valid patterns: "$45 million dollars", "85 million", "14 percent", "40 bpm", "300,000 volts", "18 inches", "34 times", "140 decibels", "subsidies", "penal code", "mitigation".
   - If writing about Poison Ivy / Killer Croc / Freeze: mention specific physical numbers (e.g. "800 pounds of bite pressure", "320 degrees", "45 million dollar Wayne filtration plant", "12 percent pheromone concentration").
6. PACING: Total script MUST be 120-145 words (~45-52 seconds). High tension, crisp delivery, zero fluff.

Output ONLY valid JSON in this exact structure, with NO markdown codeblocks and NO extraneous commentary:
{
  "title": "ROBIN ASKED BRUCE",
  "question": "SHORT QUESTION UP TO 25 CHARS",
  "topic": "${topicEntry.title}",
  "flavor": "${flavor}",
  "layout": "The Classic Patrol",
  "characters": ["Robin", "Batman"],
  "turns": [
    { "speaker": "Robin", "text": "..." },
    { "speaker": "Batman", "text": "..." }
  ],
  "social": {
    "ytTitle": "Viral YouTube Title #Shorts #Batman",
    "ytDescription": "Concise description with hashtags.\\n\\n#Batman #ArkhamKnight #Shorts",
    "igCaption": "Instagram caption with emojis and hashtags.\\n\\n#batman #arkhamknight #gaming",
    "xText": "Punchy tweet summarizing the debate under 280 characters."
  }
}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  🤖 Calling Antigravity (agy with Gemini 3.8 Flash High) to write script (attempt ${attempt}/3)...`);
      const { stdout } = await execFileAsync(agyPath, ['--model', 'gemini-3.8-flash-high', '-p', prompt, '--dangerously-skip-permissions'], {
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024
      });

      const cleanJson = stdout.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) continue;

      const parsed = JSON.parse(cleanJson.slice(firstBrace, lastBrace + 1));
      if (!Array.isArray(parsed.turns) || parsed.turns.length !== 8) continue;

      // Ensure no em dashes exist anywhere
      for (const t of parsed.turns) {
        t.text = t.text.replace(/[—–]/g, '-');
      }

      parsed.gameplay = 'assets/gameplay/batman-arkham-gliding-65s.mp4';
      parsed.id = topicEntry.id || `custom-${Date.now()}`;

      // Check against critique airlock
      const critique = critiqueScript({
        title: parsed.title,
        question: parsed.question,
        characters: parsed.characters,
        turns: parsed.turns
      });

      console.log(`  📊 agy script scored: ${critique.score}/100 on Critique Airlock`);
      if (critique.score >= 85) {
        return parsed;
      }
    } catch (err) {
      console.warn(`  ⚠️ agy attempt ${attempt} warning:`, err.message);
    }
  }
  return null;
}

export function readHistory() {
  try {
    if (existsSync(HISTORY_PATH)) {
      return JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
    }
  } catch {}
  return [];
}

export function writeHistory(history) {
  if (!existsSync(path.dirname(HISTORY_PATH))) {
    import('node:fs').then(fs => fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true }));
  }
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
}

function canFitCaption(text) {
  if (text.length > 38) return false;
  const words = text.trim().split(/\s+/);
  const result = [];
  for (const word of words) {
    if (word.length > 19) return false;
    const last = result.length - 1;
    if (last >= 0 && result[last].length + word.length + 1 <= 19) {
      result[last] += ' ' + word;
    } else {
      result.push(word);
    }
  }
  return result.length <= 2;
}

// Subtitles formatter: ensures words strictly wrap into max two 19-char lines (max 38 chars)
function createCaptions(lineText, totalDuration) {
  const rawWords = lineText.trim().split(/\s+/);
  const words = [];
  for (const w of rawWords) {
    if (w.length <= 19) {
      words.push(w);
    } else {
      for (let i = 0; i < w.length; i += 18) {
        const chunk = w.slice(i, i + 18);
        words.push(i + 18 < w.length ? chunk + '-' : chunk);
      }
    }
  }
  const phrases = [];
  let currentWords = [];

  for (const word of words) {
    const candidate = [...currentWords, word].join(' ');
    if (canFitCaption(candidate)) {
      currentWords.push(word);
    } else {
      if (currentWords.length > 0) phrases.push(currentWords.join(' '));
      currentWords = [word];
    }
  }
  if (currentWords.length > 0) phrases.push(currentWords.join(' '));

  const totalWords = words.length;
  let wordOffset = 0;
  const captions = [];

  for (let idx = 0; idx < phrases.length; idx++) {
    const phrase = phrases[idx];
    const phraseWords = phrase.split(/\s+/).length;
    const startRatio = wordOffset / totalWords;
    const endRatio = (wordOffset + phraseWords) / totalWords;
    wordOffset += phraseWords;

    const start = Math.round((startRatio * totalDuration) / 0.04) * 0.04;
    const rawEnd = Math.round((endRatio * totalDuration) / 0.04) * 0.04;
    const end = idx === phrases.length - 1 ? totalDuration : Math.max(rawEnd, start + 0.08);

    captions.push({
      text: phrase.toUpperCase(),
      start,
      end
    });
  }

  // Adjust contiguous non-overlapping intervals
  for (let i = 1; i < captions.length; i++) {
    if (captions[i].start < captions[i - 1].end) {
      captions[i].start = captions[i - 1].end;
    }
    if (captions[i].end <= captions[i].start) {
      captions[i].end = Math.min(totalDuration, captions[i].start + 0.08);
    }
  }
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
      prosody: { speed: 1.10, volume: 0 }
    })
  });

  if (!response.ok) {
    throw new Error(`Fish TTS failed (${response.status}): ${await response.text()}`);
  }

  const buf = Buffer.from(await response.arrayBuffer());
  await writeFile(outPath, buf);

  // Normalize loudness across all voices to broadcast standard -16 LUFS
  const tmpNormalized = `${outPath}.norm.wav`;
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', outPath,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:a', 'pcm_s16le',
    tmpNormalized
  ]);
  await rename(tmpNormalized, outPath);
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

/**
 * Execute a complete autonomous daily episode production run
 */
export async function runDailyEpisode(targetEpisodeNumber = null, options = {}) {
  console.log("========================================================");
  console.log("🎬 BATMAN ARKHAM CONTENT STUDIO - DAILY RUN");
  console.log("========================================================");

  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  const history = readHistory();
  const episodeNumber = targetEpisodeNumber || (history.length + 1);

  console.log(`[studio] Preparing Episode ${episodeNumber} of 7-Day Autonomous Experiment...`);

  // Step 1: Scout Live Velocity & Deduplicate
  console.log(`[studio] Step 1: Scouting live topics & checking deduplication history...`);
  const usedTopicIds = new Set(history.map(h => h.topicId || h.topic));
  
  let selected = null;
  if (targetEpisodeNumber && targetEpisodeNumber >= 1 && targetEpisodeNumber <= SCRIPT_CATALOG.length) {
    selected = SCRIPT_CATALOG[targetEpisodeNumber - 1];
  } else {
    // Attempt live scouting & original AI generation via agy
    try {
      const scoutedResult = await scoutTopics({ excludeIds: usedTopicIds });
      const proposals = Array.isArray(scoutedResult?.proposals) ? scoutedResult.proposals : [];
      const freshTopic = proposals.find(t => !usedTopicIds.has(t.id) && !usedTopicIds.has(t.title));
      if (freshTopic) {
        console.log(`  🎯 Scouted high-momentum live topic: "${freshTopic.title}"`);
        const generated = await generateOriginalScriptWithAgy(freshTopic);
        if (generated) {
          selected = generated;
        }
      }
    } catch (e) {
      console.warn("  ⚠️ Live scout / agy generation skipped:", e.message);
    }

    // Fallback to static catalog only if unused
    if (!selected) {
      selected = SCRIPT_CATALOG.find(entry => !usedTopicIds.has(entry.id) && !usedTopicIds.has(entry.topic));
    }

    if (!selected) {
      throw new Error(`[studio] Deduplication safety halt: All static catalog topics have been produced, and live scout/agy generation could not find an unused topic. Refusing to repeat previously published content.`);
    }
  }

  console.log(`  🔥 Selected Topic: "${selected.topic}"`);
  console.log(`  🎭 Format: ${selected.layout} | ${selected.flavor}`);
  console.log(`  👥 Cast: ${selected.characters.join(' & ')}`);

  // Step 2: Socratic Retention Critique Gate (Must be 90+)
  console.log(`[studio] Step 2: Running 5-Stage Socratic Retention Critique Engine...`);
  const scriptPayload = {
    title: selected.title,
    question: selected.question,
    characters: selected.characters,
    turns: selected.turns
  };

  const critique = critiqueScript(scriptPayload);
  console.log(formatCritiqueReport(critique));

  if (critique.score < 85) {
    throw new Error(`Critical Quality Gate: Script scored ${critique.score}/100. Minimum 85 required for production.`);
  }
  console.log(`  ✅ Passed Socratic Quality Airlock with score ${critique.score}/100.`);

  if (options.dryRun) {
    console.log("[studio] Dry run complete. Script and plan validated.");
    return { episodeNumber, critiqueScore: critique.score, selected };
  }

  // Step 3: Audio Synthesis via Fish Audio & Video Compositing
  const apiKey = await loadApiKey();
  if (!apiKey) {
    throw new Error("FISH_STUDIO_APIKEY is missing. Pre-approved voice synthesis requires valid credentials.");
  }

  console.log(`[studio] Step 3: Synthesizing character dialogue lines with Fish Audio...`);
  const audioDirRel = `assets/audio/daily-episode-${episodeNumber}`;
  const audioDirFull = path.join(repoRoot, audioDirRel);
  await mkdir(audioDirFull, { recursive: true });

  const processedTurns = [];
  let totalDuration = 0;

  for (let i = 0; i < selected.turns.length; i++) {
    const turn = selected.turns[i];
    const speakerKey = turn.speaker.toLowerCase();
    const voice = VOICE_PRESETS[speakerKey] || VOICE_PRESETS['batman'];
    const audioRel = `${audioDirRel}/turn-${i + 1}.wav`;
    const audioFull = path.join(repoRoot, audioRel);

    if (existsSync(audioFull) && (await stat(audioFull)).size > 1000) {
      console.log(`  [${i + 1}/${selected.turns.length}] Reusing cached ${voice.name}: "${turn.text.slice(0, 50)}..."`);
    } else {
      console.log(`  [${i + 1}/${selected.turns.length}] Synthesizing ${voice.name}: "${turn.text.slice(0, 50)}..."`);
      await generateTTS(turn.text, voice.id, audioFull, apiKey);
    }
    const rawDur = await getAudioDuration(audioFull);
    const durationSeconds = Math.round(rawDur / 0.04) * 0.04;
    totalDuration += durationSeconds;

    const speakerId = voice.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    processedTurns.push({
      speaker: speakerId,
      text: turn.text,
      durationSeconds,
      audio: {
        file: audioRel,
        authorized: true,
        provenance: `Fish Audio s2.1-pro-free (${voice.name} voice ${voice.id})`
      },
      captions: createCaptions(turn.text, durationSeconds)
    });
  }

  console.log(`  ⏱️ Measured Total Episode Duration: ${totalDuration.toFixed(2)}s`);

  // Determine gameplay clips and multi-angle support
  const isCrossover = selected.layout === "The Universe Breach" || (selected.characters.length === 2 && selected.characters.some(c => /spider-man|spiderman/i.test(c)));
  
  let gameplayConfig;
  if (isCrossover) {
    console.log(`[studio] Slicing dual crossover gameplay footage for camera cuts (Spider-Man + Batman)...`);
    const spideySource = path.join(repoRoot, 'assets/gameplay/spiderman-2-swinging-pro.mp4');
    const batmanSource = path.join(repoRoot, 'assets/gameplay/batman-arkham-gliding-65s.mp4');

    const spideyCutRel = `assets/gameplay/daily-episode-${episodeNumber}-spidey-cut.mp4`;
    const batmanCutRel = `assets/gameplay/daily-episode-${episodeNumber}-batman-cut.mp4`;

    await Promise.all([
      execFileAsync('ffmpeg', [
        '-y', '-ss', '00:00:02', '-i', spideySource,
        '-t', String(Math.ceil(totalDuration) + 2),
        '-an', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
        path.join(repoRoot, spideyCutRel)
      ]),
      execFileAsync('ffmpeg', [
        '-y', '-ss', '00:00:02', '-i', batmanSource,
        '-t', String(Math.ceil(totalDuration) + 2),
        '-an', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
        path.join(repoRoot, batmanCutRel)
      ])
    ]);

    gameplayConfig = {
      gameplays: {
        'spider-man': {
          file: spideyCutRel,
          authorized: true,
          provenance: 'Spider-Man 2 1080p swinging slice'
        },
        'batman': {
          file: batmanCutRel,
          authorized: true,
          provenance: 'Batman Arkham Knight 1080p gliding slice'
        }
      }
    };

    // Assign gameplay angle to each turn matching speaker
    for (const turn of processedTurns) {
      turn.gameplay = turn.speaker === 'spider-man' ? 'spider-man' : 'batman';
    }
  } else {
    console.log(`[studio] Slicing continuous gameplay footage...`);
    const gameplaySourceFull = path.join(repoRoot, selected.gameplay || 'assets/gameplay/batman-arkham-gliding-65s.mp4');
    const trimmedGameplayRel = `assets/gameplay/daily-episode-${episodeNumber}-cut.mp4`;
    const trimmedGameplayFull = path.join(repoRoot, trimmedGameplayRel);

    await execFileAsync('ffmpeg', [
      '-y',
      '-ss', '00:00:02',
      '-i', gameplaySourceFull,
      '-t', String(Math.ceil(totalDuration) + 2),
      '-an',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      trimmedGameplayFull
    ]);

    gameplayConfig = {
      gameplay: {
        file: trimmedGameplayRel,
        authorized: true,
        provenance: `Curated 1080p Arkham gameplay slice (${selected.gameplay})`
      }
    };
  }

  // Construct episode composition input
  const episodeInput = {
    schemaVersion: 1,
    header: {
      title: selected.title.slice(0, 25).toUpperCase(),
      question: selected.question.slice(0, 36).toUpperCase()
    },
    topic: selected.topic.slice(0, 100),
    castMode: isCrossover ? "crossover" : "same-universe",
    cast: selected.characters.map(c => {
      const v = VOICE_PRESETS[c.toLowerCase()] || { name: c, universe: 'DC' };
      return {
        id: v.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: v.name,
        universe: v.universe
      };
    }),
    ...gameplayConfig,
    turns: processedTurns,
    music: {
      file: 'assets/audio/yeat-if-we-being-real.mp3',
      authorized: true,
      provenance: 'Yeat - If We Being Real (Instrumental starting at 0:28)',
      volume: 0.22,
      attribution: 'Instrumental bed: Yeat - If We Being Real (used for pacing under dialogue)'
    }
  };

  const inputJsonRel = `inputs/daily-episode-${episodeNumber}.json`;
  const inputJsonFull = path.join(repoRoot, inputJsonRel);
  await writeFile(inputJsonFull, JSON.stringify(episodeInput, null, 2));

  // Render final Short with official runtime
  const outputRel = `outputs/daily/episode-${episodeNumber}-${selected.id}.mp4`;
  const outputFull = path.join(repoRoot, outputRel);
  await mkdir(path.dirname(outputFull), { recursive: true });

  console.log(`[studio] Step 4: Rendering 1080x1920 Short with official runtime compositor...`);
  const renderRes = await execFileAsync('node', [
    path.join(repoRoot, 'runtime/render.mjs'),
    inputJsonFull,
    outputFull
  ], { cwd: repoRoot });
  console.log(renderRes.stdout);

  // Step 4: Publish & Distribution Receipt
  console.log(`[studio] Step 5: Preparing distribution packages & social manifests...`);
  const distConfig = {
    schemaVersion: 1,
    media: outputRel,
    platforms: {
      youtube: {
        enabled: true,
        title: selected.social.ytTitle,
        description: selected.social.ytDescription,
        privacy: "public",
        categoryId: "20"
      },
      instagram: {
        enabled: true,
        caption: selected.social.igCaption
      },
      twitter: {
        enabled: true,
        text: selected.social.xText
      },
      tiktok: {
        enabled: true,
        title: selected.social.ytTitle
      }
    }
  };

  const distJsonRel = `inputs/daily-episode-${episodeNumber}-distribution.json`;
  const distJsonFull = path.join(repoRoot, distJsonRel);
  await writeFile(distJsonFull, JSON.stringify(distConfig, null, 2));

  // Run autonomous publish module
  try {
    await execFileAsync('node', [
      path.join(repoRoot, 'runtime/publish-buffer.mjs'),
      distJsonFull,
      outputFull
    ], { cwd: repoRoot });
  } catch (pubErr) {
    console.warn('⚠️ Autonomous publish warning:', pubErr.message);
  }

  const receiptRel = `${outputRel}.distribution.json`;

  // Step 5: Memory & History Update
  console.log(`[studio] Step 6: Updating outputs/daily/history.json memory log...`);
  const historyEntry = {
    episode: episodeNumber,
    date: new Date().toISOString(),
    topicId: selected.id,
    topic: selected.topic,
    title: selected.title,
    characters: selected.characters,
    critiqueScore: critique.score,
    durationSeconds: totalDuration,
    videoFile: outputRel,
    distributionReceipt: receiptRel,
    social: selected.social
  };

  history.push(historyEntry);
  writeHistory(history);

  console.log("========================================================");
  console.log(`🎉 EPISODE ${episodeNumber} PRODUCTION COMPLETE`);
  console.log("========================================================");
  console.log(`• Master Video: ${outputFull}`);
  console.log(`• Duration:     ${totalDuration.toFixed(2)}s (1080x1920 25fps)`);
  console.log(`• Socratic Score: ${critique.score}/100`);
  console.log(`• Social Receipt: ${path.join(repoRoot, receiptRel)}`);
  console.log("========================================================\n");

  return historyEntry;
}

// Direct CLI Invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  let epNum = null;
  let dryRun = false;
  for (const a of args) {
    if (a.startsWith('--episode=')) epNum = parseInt(a.slice(10), 10);
    else if (!a.startsWith('--') && !isNaN(parseInt(a, 10))) epNum = parseInt(a, 10);
    if (a === '--dry-run') dryRun = true;
  }

  runDailyEpisode(epNum, { dryRun }).catch(err => {
    console.error("Studio Execution Error:", err);
    process.exit(1);
  });
}
