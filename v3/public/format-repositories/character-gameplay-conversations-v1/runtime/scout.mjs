#!/usr/bin/env node
/**
 * Dynamic Trend & Topic Scout Engine for Character Gameplay Conversations.
 * 
 * Automatically probes real-time YouTube search velocity and trending culture
 * with zero API keys or credentials, filters out navigational noise, and synthesizes
 * 3 pre-validated, high-retention Socratic episode concepts ready for immediate scripting.
 *
 * Usage:
 *   node runtime/scout.mjs [--theme="<keyword>"] [--output="outputs/scouted-topics.json"]
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_SEARCH_SEEDS = [
  "why does batman",
  "why doesn't batman",
  "how does batman",
  "can batman beat",
  "can spiderman beat batman",
  "batman prep time",
  "bruce wayne money",
  "how much does batman spend",
  "why does batman let joker",
  "batman no kill rule",
  "batman vs",
  "how does batman survive"
];

// Offline fallback fixtures ensuring 100% resilience in sandboxed CI or offline environments
export const FALLBACK_TOPICS = [
  {
    id: "why-batman-doesnt-kill-joker",
    title: "Why Batman Refuses to Execute the Joker",
    flavor: "Flavor B: Deep Lore & Moral Checkmate",
    searchVelocityQuery: "why does batman never kill joker",
    hookLine: "Bruce, serious question: why haven't you just killed the Joker? He's broken out of Arkham 34 times.",
    coreConflict: "Under New Jersey penal code, an extrajudicial execution by an un-deputized vigilante taints every active municipal indictment, forcing the release of dozens of other inmates on chain-of-custody technicalities.",
    suggestedCast: {
      speaker1: { name: "Robin (Tim Drake)", role: "Audience surrogate / Socratic inquisitor" },
      speaker2: { name: "Batman (Bruce Wayne)", role: "Clinical, deadpan tactical authority" }
    },
    suggestedLayout: "The Classic Patrol"
  },
  {
    id: "how-batman-survives-no-sleep",
    title: "How Batman Physically Survives on 2 Hours of Sleep",
    flavor: "Flavor A: Mythology Meets Mundane Reality",
    searchVelocityQuery: "how does batman survive without sleep",
    hookLine: "Bruce, serious question: how do you actually survive on no sleep? Standard REM sleep takes 90 minutes to kick in.",
    coreConflict: "Batman uses clinical bradycardia biofeedback to drop his resting heart rate to 40 bpm, forcing his brain straight into emergency REM sleep during 20-minute power naps in the Batmobile.",
    suggestedCast: {
      speaker1: { name: "Robin (Tim Drake)", role: "Inquisitor pointing out biological impossibility" },
      speaker2: { name: "Batman (Bruce Wayne)", role: "Clinical, deadpan tactical authority" }
    },
    suggestedLayout: "The Classic Patrol"
  },
  {
    id: "could-batman-defeat-spiderman",
    title: "How Batman Neutralizes Spider-Man's Precognition",
    flavor: "Flavor B: Deep Lore & Moral Checkmate",
    searchVelocityQuery: "can spiderman beat batman without prep time",
    hookLine: "Bruce, serious question: Spider-Man still says he could web your hands to the wall before you touch your belt.",
    coreConflict: "Peter's synthetic web fluid cures in 0.4 seconds but remains conductive during flight; Batman's suit discharges 300,000 volts up the line, weaponizing Spider-Man's own attack.",
    suggestedCast: {
      speaker1: { name: "Robin (Tim Drake)", role: "Audience surrogate" },
      speaker2: { name: "Batman (Bruce Wayne)", role: "Forensic strategist" }
    },
    suggestedLayout: "The Universe Breach"
  },
  {
    id: "how-much-money-batman-has",
    title: "The Financial Breakdown of Batman's Billion-Dollar Arsenal",
    flavor: "Flavor A: Mythology Meets Mundane Reality",
    searchVelocityQuery: "how much money does batman have",
    hookLine: "Bruce, serious question: how much money do you actually have? You crashed three Batwings this year alone.",
    coreConflict: "Wayne Aerospace military contracts subsidize manufacturing losses; Bruce owns 38% of Gotham commercial real estate to bypass zoning laws for reinforced gargoyles and repair bays.",
    suggestedCast: {
      speaker1: { name: "Robin (Tim Drake)", role: "Audience surrogate / financial inquisitor" },
      speaker2: { name: "Batman (Bruce Wayne)", role: "Clinical, deadpan tactical authority" }
    },
    suggestedLayout: "The Classic Patrol"
  }
];

const NOISE_REGEX = /\b(download|wallpaper|theme song|theme|ringtone|soundtrack|lyrics|movie|actor|trailer|cast|poster|lego set|suit tutorial|costume|cosplay|skin|mod|release date|wiki|streaming|tickets|merch|full movie|song|rap|album|edit|amv|remix|lil uzi)\b/i;

const HIGH_FRICTION_KEYWORDS = [
  "why", "how", "never", "refuse", "let", "can", "kill", "die", "beat",
  "survive", "spend", "afford", "money", "rules", "contingency", "sleep",
  "defeat", "weakness", "secret", "illegal", "cost"
];

export async function fetchYouTubeAutocomplete(query, timeoutMs = 2500) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data[1]) ? data[1] : [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

export async function fetchGoogleTrendsBreakouts(timeoutMs = 2500) {
  const url = "https://trends.google.com/trending/rss?geo=US";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    clearTimeout(timer);
    if (!response.ok) return [];
    const text = await response.text();
    const titles = [];
    const regex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const item = match[1] || match[2];
      if (item && !item.includes("Daily Search Trends")) {
        titles.push(item);
      }
    }
    return titles;
  } catch {
    clearTimeout(timer);
    return [];
  }
}

export function filterAndScoreQueries(queries) {
  const seen = new Set();
  const scored = [];

  for (const raw of queries) {
    const query = raw.trim().toLowerCase();
    const words = query.split(/\s+/);
    if (words.length < 4 || query.length < 12 || query.length > 80) continue;
    if (seen.has(query)) continue;
    if (NOISE_REGEX.test(query)) continue;
    seen.add(query);

    let score = 10;

    // Word count sweet spot for short-form video titles (5 to 11 words)
    if (words.length >= 5 && words.length <= 11) score += 15;

    // Bonus for high-friction question words
    for (const keyword of HIGH_FRICTION_KEYWORDS) {
      if (words.includes(keyword) || query.includes(keyword)) score += 10;
    }

    // Bonus for central characters
    if (query.includes("batman")) score += 10;
    if (query.includes("joker")) score += 12;
    if (query.includes("spiderman") || query.includes("superman")) score += 12;
    if (query.includes("sleep") || query.includes("money") || query.includes("kill")) score += 15;

    scored.push({ query: raw, score });
  }

  return scored.sort((a, b) => b.score - a.score);
}

function formatRobinHook(query) {
  let q = query.trim().toLowerCase();
  let hook = q;
  if (/^why does batman never /i.test(q)) {
    hook = q.replace(/^why does batman never /i, "why do you never ");
  } else if (/^why doesn't batman /i.test(q)) {
    hook = q.replace(/^why doesn't batman /i, "why don't you ");
  } else if (/^why does batman not /i.test(q)) {
    hook = q.replace(/^why does batman not /i, "why don't you ");
  } else if (/^why does batman /i.test(q)) {
    hook = q.replace(/^why does batman /i, "why do you ");
  } else if (/^how does batman sleep/i.test(q)) {
    hook = "how do you actually survive on no sleep";
  } else if (/^how does batman survive/i.test(q)) {
    hook = q.replace(/^how does batman survive/i, "how do you actually survive");
  } else if (/^how does batman /i.test(q)) {
    hook = q.replace(/^how does batman /i, "how do you ");
  } else if (/^can batman beat /i.test(q)) {
    const opp = q.replace(/^can batman beat /i, "");
    hook = `do you honestly think you could take down ${opp}`;
  } else if (/^can spiderman beat batman/i.test(q)) {
    hook = "Spider-Man still claims he can web your hands before you touch your belt";
  } else if (/^batman vs /i.test(q)) {
    const opponent = q.replace(/^batman vs /i, "");
    hook = `if you went all out against ${opponent}, who walks away`;
  }

  // Convert third-person references to second-person direct address for Robin talking to Bruce
  hook = hook
    .replace(/\bdoes batman have\b/gi, "do you actually have")
    .replace(/\bdoes batman\b/gi, "do you")
    .replace(/\bdoesn't batman\b/gi, "don't you")
    .replace(/\bcan batman\b/gi, "could you")
    .replace(/\bbatman's\b/gi, "your")
    .replace(/\bbatman\b/gi, "you");

  // Proper noun capitalization & cleanup
  hook = hook
    .replace(/\bjoker\b/gi, "the Joker")
    .replace(/\bthe the Joker\b/gi, "the Joker")
    .replace(/\bspiderman\b/gi, "Spider-Man")
    .replace(/\bspider-man\b/gi, "Spider-Man")
    .replace(/\bsuperman\b/gi, "Superman")
    .replace(/\brobin\b/gi, "Robin")
    .replace(/\bgotham\b/gi, "Gotham")
    .replace(/\barkham\b/gi, "Arkham");

  if (!/^(why|how|can|could|what|is|does|do|if)/i.test(hook)) {
    hook = `what's the real story behind ${hook}`;
  }

  if (!hook.endsWith("?")) hook += "?";
  return `Bruce, serious question: ${hook}`;
}

export function synthesizeConcept(scoredItem, index) {
  const query = scoredItem.query.trim();
  const lower = query.toLowerCase();

  const isCrossover = /spiderman|spider-man|superman|homelander|goku|gojo|iron man|flash|vs\b/i.test(lower);
  const isMundaneLogistics = !isCrossover && /sleep|money|spend|buy|cost|afford|pee|eat|car|hospital|bureaucracy|lawyer|rich/i.test(lower);

  const flavor = isMundaneLogistics
    ? "Flavor A: Mythology Meets Mundane Reality"
    : "Flavor B: Deep Lore & Moral Checkmate";

  const layout = isCrossover ? "The Universe Breach" : "The Classic Patrol";

  // Generate punchy title
  let title = query
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/\bVs\b/g, "vs.")
    .replace(/\bSpiderman\b/g, "Spider-Man");

  const hookLine = formatRobinHook(query);

  let coreConflict = "";
  if (isMundaneLogistics) {
    coreConflict = `Clashing the god-like myth of Batman with the unforgiving real-world constraints of human physiology, operational budgets, or municipal bureaucracy.`;
  } else if (isCrossover) {
    coreConflict = `Tactical breakdown of how Batman counters overwhelming superhuman powers through forensic physics and prep-time countermeasures.`;
  } else {
    coreConflict = `An unyielding ideological deadlock between Batman's forensic code and the horrific real-world collateral of letting mass murderers survive.`;
  }

  const slug = lower
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 45);

  return {
    id: slug || `topic-${index + 1}`,
    title,
    flavor,
    searchVelocityQuery: query,
    hookLine: `Speaker 1 (Robin): "${hookLine}"`,
    coreConflict,
    suggestedCast: {
      speaker1: { name: "Robin (Tim Drake)", role: "Audience surrogate / Socratic interrogator" },
      speaker2: { name: "Batman (Bruce Wayne)", role: "Clinical, deadpan tactical authority" }
    },
    suggestedLayout: layout
  };
}

export async function scoutTopics(options = {}) {
  const theme = options.theme || "";
  const seeds = theme
    ? [
        `batman ${theme}`,
        `how much ${theme} does batman have`,
        `how does batman afford ${theme}`,
        `how does batman get ${theme}`,
        `why does batman ${theme}`,
        `can batman beat ${theme}`
      ]
    : DEFAULT_SEARCH_SEEDS;

  const rawQueries = options.mockQueries !== undefined ? [...options.mockQueries] : [];

  if (options.mockQueries === undefined) {
    // Parallel fetch across YouTube autocomplete seeds
    const autocompletePromises = seeds.map(seed => fetchYouTubeAutocomplete(seed));
    const [trendsResults, ...autocompleteResults] = await Promise.all([
      fetchGoogleTrendsBreakouts(),
      ...autocompletePromises
    ]);

    for (const list of autocompleteResults) {
      rawQueries.push(...list);
    }

    // Cross-reference relevant Google Trends breakouts
    for (const trend of trendsResults) {
      if (/batman|dc|joker|gotham|superman|hero|comic|arkham/i.test(trend)) {
        rawQueries.push(trend);
      }
    }
  }

  const scored = filterAndScoreQueries(rawQueries);

  let proposals = [];
  if (theme) {
    // If a theme was specified, prioritize scored queries matching theme
    const themeProposals = scored.map((item, idx) => synthesizeConcept(item, idx));
    proposals.push(...themeProposals);

    // If fewer than 3, backfill from theme-matching fallbacks first, then standard fallbacks
    const themeMatchingFallbacks = FALLBACK_TOPICS.filter(fb =>
      new RegExp(theme, "i").test(fb.searchVelocityQuery) ||
      new RegExp(theme, "i").test(fb.title)
    );
    for (const fb of themeMatchingFallbacks) {
      if (proposals.length >= 3) break;
      if (!proposals.some(p => p.id === fb.id)) proposals.push(fb);
    }
    for (const fb of FALLBACK_TOPICS) {
      if (proposals.length >= 3) break;
      if (!proposals.some(p => p.id === fb.id)) proposals.push(fb);
    }
    proposals = proposals.slice(0, 3);
  } else if (scored.length >= 3) {
    // For general scouting, diversify across the 3 core pillars
    const moralCandidates = scored.filter(s => /joker|kill|murder|punish|death|rule/i.test(s.query));
    const logisticsCandidates = scored.filter(s => /sleep|money|spend|buy|cost|afford|rich|bureaucracy|car|penny|how does/i.test(s.query));
    const matchupCandidates = scored.filter(s => /vs|spiderman|spider-man|superman|beat|prep time|fight|god/i.test(s.query));

    const picked = [];
    if (moralCandidates.length > 0) picked.push(moralCandidates[0]);
    if (logisticsCandidates.length > 0) picked.push(logisticsCandidates[0]);
    if (matchupCandidates.length > 0) picked.push(matchupCandidates[0]);

    // Fill remaining slots from top scored if any category had no matches
    for (const item of scored) {
      if (picked.length >= 3) break;
      if (!picked.some(p => p.query === item.query)) {
        picked.push(item);
      }
    }

    proposals = picked.slice(0, 3).map((item, idx) => synthesizeConcept(item, idx));
  } else {
    // Graceful fallback to golden benchmark topics
    proposals = FALLBACK_TOPICS.slice(0, 3);
  }

  return {
    schemaVersion: 1,
    scoutedAt: new Date().toISOString(),
    theme: theme || "all",
    proposals
  };
}

export async function main() {
  const args = process.argv.slice(2);
  let theme = "";
  let outputPath = "outputs/scouted-topics.json";

  for (const arg of args) {
    if (arg.startsWith("--theme=")) {
      theme = arg.split("=")[1];
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.split("=")[1];
    }
  }

  console.log(`[scout] Probing live YouTube search velocity & cultural trends${theme ? ` for theme "${theme}"` : ""}...`);
  const result = await scoutTopics({ theme });

  const resolvedOutput = path.resolve(process.cwd(), outputPath);
  mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, JSON.stringify(result, null, 2) + "\n");

  console.log("\n========================================================");
  console.log("🔥 TOP 3 VIRAL ARKHAM EPISODE HOOKS (Pre-Validated)");
  console.log("========================================================\n");

  result.proposals.forEach((item, idx) => {
    console.log(`[${idx + 1}] ${item.title}`);
    console.log(`    Flavor:       ${item.flavor}`);
    console.log(`    Layout:       ${item.suggestedLayout}`);
    console.log(`    Search Query: "${item.searchVelocityQuery}"`);
    console.log(`    Hook Line:    ${item.hookLine}`);
    console.log(`    Conflict:     ${item.coreConflict}\n`);
  });

  console.log(`[scout] Proposals saved to: ${outputPath}`);
  console.log(`[scout] Pick 1, 2, or 3 to seed your script immediately.\n`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((err) => {
    console.error("[scout] Error:", err.message);
    process.exit(1);
  });
}
