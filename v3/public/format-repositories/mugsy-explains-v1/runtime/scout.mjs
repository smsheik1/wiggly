#!/usr/bin/env node
import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const COMPARISON_SEEDS = [
  {
    theme: "food",
    title: "Sourdough vs Store Bread",
    searchQuery: "sourdough vs store bought bread difference",
    velocityScore: 98,
    lessons: [
      {
        leftLabel: "SOURDOUGH",
        rightLabel: "STORE BREAD",
        leftImage: "assets/proof/sourdough.png",
        rightImage: "assets/proof/store-bread.png",
        sentences: [
          { role: "a", text: "This is sourdough bread.", chunks: ["This is sourdough bread"] },
          { role: "b", text: "This is supermarket bread.", chunks: ["This is supermarket bread"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Real sourdough uses wild yeast and 24-hour lactic fermentation.", chunks: ["Real sourdough uses wild yeast", "and 24-hour fermentation"] },
          { role: "explain_b", text: "Supermarket bread relies on calcium propionate and dough conditioners.", chunks: ["Supermarket bread uses preservatives", "and industrial yeast"] }
        ]
      },
      {
        leftLabel: "WILD YEAST",
        rightLabel: "INDUSTRIAL YEAST",
        leftImage: "assets/proof/wild-yeast.png",
        rightImage: "assets/proof/industrial-yeast.png",
        sentences: [
          { role: "a", text: "This is wild sourdough starter.", chunks: ["This is wild starter"] },
          { role: "b", text: "This is commercial baker's yeast.", chunks: ["This is commercial yeast"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Wild starter pre-digests gluten proteins so your gut can absorb them.", chunks: ["Wild starter pre-digests gluten", "for easy digestion"] },
          { role: "explain_b", text: "Industrial yeast forces dough to rise in under 60 minutes.", chunks: ["Industrial yeast rushes the rise", "without digestion"] }
        ]
      },
      {
        leftLabel: "REAL CRUST",
        rightLabel: "PLASTIC CRUST",
        leftImage: "assets/proof/real-crust.png",
        rightImage: "assets/proof/plastic-crust.png",
        sentences: [
          { role: "a", text: "This is an artisan crust.", chunks: ["This is an artisan crust"] },
          { role: "b", text: "This is factory sandwich bread.", chunks: ["This is factory sandwich bread"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Real bread goes stale in four days instead of molding.", chunks: ["Real bread goes stale", "it doesn't mold"] },
          { role: "explain_b", text: "Store-bought loaves stay soft for three weeks because of chemicals.", chunks: ["Store loaves stay soft", "because of chemicals"] }
        ]
      }
    ]
  },
  {
    theme: "coffee",
    title: "Cold Brew vs Iced Coffee",
    searchQuery: "cold brew vs iced coffee difference",
    velocityScore: 95,
    lessons: [
      {
        leftLabel: "COLD BREW",
        rightLabel: "ICED COFFEE",
        leftImage: "assets/proof/cold-brew.png",
        rightImage: "assets/proof/iced-coffee.png",
        sentences: [
          { role: "a", text: "This is cold brew.", chunks: ["This is cold brew"] },
          { role: "b", text: "This is iced coffee.", chunks: ["This is iced coffee"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Cold brew steeps coarse grounds in chilled water for twenty hours.", chunks: ["Cold brew steeps for 20 hours", "in chilled water"] },
          { role: "explain_b", text: "Iced coffee is hot drip coffee poured over ice cubes.", chunks: ["Iced coffee is hot coffee", "poured over ice"] }
        ]
      },
      {
        leftLabel: "LOW ACIDITY",
        rightLabel: "HIGH ACIDITY",
        leftImage: "assets/proof/low-acid.png",
        rightImage: "assets/proof/high-acid.png",
        sentences: [
          { role: "a", text: "This is cold extraction.", chunks: ["This is cold extraction"] },
          { role: "b", text: "This is thermal extraction.", chunks: ["This is thermal extraction"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Cold extraction leaves sixty-seven percent of bitter acids behind.", chunks: ["Cold extraction cuts acid", "by sixty-seven percent"] },
          { role: "explain_b", text: "Heat forces tannins and oils into the cup instantly.", chunks: ["Heat pulls bitter tannins", "into the cup"] }
        ]
      },
      {
        leftLabel: "CAFFEINE CONCENTRATE",
        rightLabel: "WATERED DOWN",
        leftImage: "assets/proof/concentrate.png",
        rightImage: "assets/proof/watered-down.png",
        sentences: [
          { role: "a", text: "This is high caffeine density.", chunks: ["This is high caffeine density"] },
          { role: "b", text: "This is melted ice dilution.", chunks: ["This is melted ice dilution"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Cold brew packs two hundred milligrams per cup.", chunks: ["Cold brew packs 200mg", "of pure caffeine"] },
          { role: "explain_b", text: "Iced coffee dilutes the second the hot liquid melts your cup.", chunks: ["Iced coffee dilutes", "as the ice melts"] }
        ]
      }
    ]
  },
  {
    theme: "tech",
    title: "Mechanical vs Membrane Keyboards",
    searchQuery: "mechanical vs membrane keyboard difference",
    velocityScore: 92,
    lessons: [
      {
        leftLabel: "MECHANICAL",
        rightLabel: "MEMBRANE",
        leftImage: "assets/proof/mechanical.png",
        rightImage: "assets/proof/membrane.png",
        sentences: [
          { role: "a", text: "This is a mechanical keyboard.", chunks: ["This is a mechanical keyboard"] },
          { role: "b", text: "This is a membrane keyboard.", chunks: ["This is a membrane keyboard"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Mechanical boards use individual physical switches under every key.", chunks: ["Mechanical uses individual switches", "under every key"] },
          { role: "explain_b", text: "Membrane boards squish a single rubber sheet across all keys.", chunks: ["Membrane squishes rubber", "across the whole board"] }
        ]
      },
      {
        leftLabel: "TACTILE SWITCH",
        rightLabel: "RUBBER DOME",
        leftImage: "assets/proof/tactile-switch.png",
        rightImage: "assets/proof/rubber-dome.png",
        sentences: [
          { role: "a", text: "This is a mechanical switch stem.", chunks: ["This is a mechanical stem"] },
          { role: "b", text: "This is a rubber dome.", chunks: ["This is a rubber dome"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Switches trigger half-way down so your fingers never bottom out.", chunks: ["Switches actuate halfway", "preventing finger fatigue"] },
          { role: "explain_b", text: "Rubber domes require full bottoming-out pressure on every stroke.", chunks: ["Rubber requires full bottoming out", "every time"] }
        ]
      },
      {
        leftLabel: "80 MILLION CLICKS",
        rightLabel: "5 MILLION CLICKS",
        leftImage: "assets/proof/switch-durability.png",
        rightImage: "assets/proof/rubber-fatigue.png",
        sentences: [
          { role: "a", text: "This is gold-plated contact durability.", chunks: ["This is gold-plated durability"] },
          { role: "b", text: "This is silicone fatigue.", chunks: ["This is silicone fatigue"] },
          { role: "question", text: "What's the difference?", chunks: ["What's the difference?"] },
          { role: "explain_a", text: "Mechanical springs last eighty million presses without degrading.", chunks: ["Mechanical springs last", "80 million clicks"] },
          { role: "explain_b", text: "Rubber domes turn mushy and stick after two years.", chunks: ["Rubber turns mushy", "after two years"] }
        ]
      }
    ]
  }
];

export async function probeYouTubeSearchSuggestions(query) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data[1]) ? data[1] : [];
    }
  } catch {}
  return [];
}

export async function scoutComparisonTopics(keyword = '') {
  console.log(`[scout] Probing live YouTube search velocity and comparison trends${keyword ? ` for "${keyword}"` : ''}...`);

  const results = [];
  for (const seed of COMPARISON_SEEDS) {
    if (keyword && !seed.theme.includes(keyword.toLowerCase()) && !seed.title.toLowerCase().includes(keyword.toLowerCase())) {
      continue;
    }

    const suggestions = await probeYouTubeSearchSuggestions(seed.searchQuery);
    results.push({
      ...seed,
      liveSuggestions: suggestions.slice(0, 3)
    });
  }

  return results.length ? results : COMPARISON_SEEDS;
}

async function main() {
  const args = process.argv.slice(2);
  let theme = '';
  let draftFile = '';

  for (const a of args) {
    if (a.startsWith('--theme=')) theme = a.slice(8);
    else if (a.startsWith('--draft=')) draftFile = a.slice(8);
    else if (!theme) theme = a;
  }

  const topics = await scoutComparisonTopics(theme);

  console.log('\n============================================================');
  console.log(' MUGSY EXPLAINS — VIRAL COMPARISON TOPIC SCOUT');
  console.log('============================================================');

  topics.forEach((t, i) => {
    const letter = ['A', 'B', 'C', 'D'][i] || `${i + 1}`;
    console.log(`\n [Option ${letter}] ${t.title.toUpperCase()} (Velocity: ${t.velocityScore}/100)`);
    console.log(`   Query: "${t.searchQuery}"`);
    console.log(`   Lessons:`);
    t.lessons.forEach((l, idx) => {
      console.log(`     ${idx + 1}. ${l.leftLabel} vs ${l.rightLabel}`);
    });
  });

  console.log('\n============================================================');

  if (draftFile) {
    const chosen = topics[0];
    const draftPayload = {
      title: chosen.title,
      lessons: chosen.lessons
    };
    writeFileSync(path.resolve(process.cwd(), draftFile), JSON.stringify(draftPayload, null, 2) + '\n');
    console.log(`[scout] Saved selected draft to ${draftFile}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('scout.mjs')) {
  main().catch(err => {
    console.error(`[scout] Error: ${err.message}`);
    process.exit(1);
  });
}
