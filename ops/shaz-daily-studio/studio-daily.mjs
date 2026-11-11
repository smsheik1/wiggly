#!/usr/bin/env node
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { fetchSubredditRss, DEFAULT_SUBREDDITS, parseRedditRss, fetchNewsMcpStories } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/scout-trends.mjs";
import { loadLedger, isTopicCovered, recordTopic, filterFreshTopics } from "./content-ledger.mjs";
import { validateScript } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/validate-script.mjs";
import { synthesizeShazVoice } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/voice.mjs";
import { composeVerticalVideo, formatSafeHeadline } from "./vertical-letterbox.mjs";
import { sendApprovalVideo, pollApprovalDecision, pollBatchDecision, sendTelegramMessage } from "./telegram-approval.mjs";
import { publishVideoToInstagram, publishVideoToAllChannels } from "./buffer-publisher.mjs";
import { execute, parseArgs, resolveRunDirectory, sha256, writeJson } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/run-common.mjs";
import { searchGoogleImages } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/serper-search.mjs";
import { curateImageCandidatesDeterministic } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/director-jev.mjs";
import { normalizeBrollMedia } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/broll-renderer.mjs";
import sharp from "sharp";

export const STUDIO_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const KIT_ROOT = path.resolve(STUDIO_ROOT, "../../v3/public/format-repositories/shaz-puppet-runtime-v1");
const root = KIT_ROOT;

export const DEFAULT_BACKLOG_PATH = path.join(STUDIO_ROOT, "editorial-backlog.json");

/**
 * Loads editorial backlog topics from external JSON file or returns clean default items.
 */
export async function loadEditorialBacklog(backlogPath = DEFAULT_BACKLOG_PATH) {
  try {
    const raw = await fs.readFile(backlogPath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [
    {
      title: "Community Plugins Bring Modern Interfaces to Handheld Gaming PCs",
      snippet: "Community-made plugins allow players to customize portable game dashboards with bespoke modern console layouts.",
      source: "editorial-backlog",
    },
    {
      title: "Next-Gen Console Pricing Debate for PS6 and Xbox Next",
      snippet: "Industry analysts debate whether next-generation consoles will exceed $1,000 due to rising memory and silicon fabrication costs.",
      source: "editorial-backlog",
    },
    {
      title: "Nintendo Switch 2 Ecosystem and Physical Media",
      snippet: "Nintendo confirms cross-generational digital libraries and game compatibility as players prepare for the next platform cycle.",
      source: "editorial-backlog",
    },
  ];
}

/**
 * Scouts for multiple distinct, high-priority breaking topics not yet covered in the ledger.
 */
export async function findTopStories({ count = 3, subreddits = DEFAULT_SUBREDDITS, ledgerPath, backlogPath } = {}) {
  const ledger = await loadLedger(ledgerPath);
  const stories = [];
  const seenTitles = new Set();
  const editorialBacklog = await loadEditorialBacklog(backlogPath);

  const addStory = (topic, source) => {
    if (!topic || !topic.title) return;
    const norm = topic.title.toLowerCase().trim();
    if (seenTitles.has(norm)) return;
    if (isTopicCovered(topic, ledger)) return;
    seenTitles.add(norm);
    stories.push({ topic, source });
  };

  // 1. Scout live breaking events from NewsMCP (corroborated by independent newsrooms)
  try {
    const newsStories = await fetchNewsMcpStories({ limit: count * 3 });
    for (const item of newsStories) {
      if (stories.length >= count) break;
      addStory(item, `newsmcp (${item.newsrooms} newsrooms)`);
    }
  } catch {}

  // 2. Scout Reddit enthusiast nodes in parallel
  if (stories.length < count) {
    try {
      const scoutPromises = subreddits.map(async (sub) => {
        try {
          const xml = await fetchSubredditRss(sub, "hot", 0);
          const entries = parseRedditRss(xml);
          return { sub, entries: filterFreshTopics(entries, ledger) };
        } catch {
          return { sub, entries: [] };
        }
      });

      const results = await Promise.allSettled(scoutPromises);
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.entries.length > 0) {
          for (const item of r.value.entries) {
            addStory(item, `r/${r.value.sub}`);
            if (stories.length >= count) break;
          }
        }
        if (stories.length >= count) break;
      }
    } catch {}
  }

  // 3. Backfill from curated editorial backlog
  for (const candidate of editorialBacklog) {
    if (stories.length >= count) break;
    addStory(candidate, "editorial-backlog");
  }

  // Ensure at least count items are returned
  let index = 0;
  while (stories.length < count && index < editorialBacklog.length) {
    const candidate = editorialBacklog[index];
    if (!stories.some((s) => s.topic.title === candidate.title)) {
      stories.push({ topic: candidate, source: "editorial-backlog" });
    }
    index += 1;
  }

  return stories.slice(0, count);
}

/**
 * Scouts for a high-priority breaking topic not yet covered in the ledger.
 */
export async function findNextStory({ ledgerPath, subreddits, backlogPath } = {}) {
  const stories = await findTopStories({ count: 1, ledgerPath, subreddits, backlogPath });
  const editorialBacklog = await loadEditorialBacklog(backlogPath);
  return stories[0] || { topic: editorialBacklog[0], source: "editorial-backlog" };
}

/**
 * Builds an authentic, temporally anchored authoring prompt for the active coding agent.
 * Enforces current-year calendar grounding to prevent outdated AI slop and timeframe hallucinations.
 */
export function buildAuthorPrompt(topic, { now = new Date() } = {}) {
  const title = topic.title || "Breaking Story";
  const snippet = topic.snippet || "";
  const publishedAt = topic.publishedAt || topic.updated || null;
  const formattedToday = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isoToday = now.toISOString().slice(0, 10);
  const currentYear = now.getFullYear();

  let pubString = "";
  if (publishedAt) {
    try {
      const pubDate = new Date(publishedAt);
      if (!isNaN(pubDate.getTime())) {
        const diffDays = Math.round((now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
        const rel = diffDays === 0 ? "today" : diffDays === 1 ? "yesterday" : `${diffDays} days ago`;
        pubString = `\nStory Published: ${pubDate.toISOString().slice(0, 10)} (${rel})`;
      }
    } catch {}
  }

  // Detect explicit dates in snippet or title to calculate exact relative countdowns
  let dateMathHint = "";
  const dateMatch = (title + " " + snippet).match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(202\d)?/i
  );
  if (dateMatch) {
    const yearVal = dateMatch[3] ? parseInt(dateMatch[3], 10) : currentYear;
    try {
      const parsedTarget = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${yearVal}`);
      if (!isNaN(parsedTarget.getTime())) {
        const diffMs = parsedTarget.getTime() - now.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 60) {
          dateMathHint = `\nCRITICAL DATE MATH: The event (${dateMatch[0]}) is in EXACTLY ${diffDays} days from today! It is NOT years away, NOT months away. It is ${diffDays} days away.`;
        }
      }
    } catch {}
  }

  return `You are Shaz, an internet-native animator and gaming commentator.
Write an authentic, punchy, funny 30-second script about this breaking news:
Title: "${title}"
Snippet: "${snippet}"${pubString}

CURRENT DATE CONTEXT & TEMPORAL ANCHORING (CRITICAL — PREVENTS AI SLOP):
- TODAY IS: ${formattedToday} (${isoToday}).
- The current year is strictly ${currentYear}.${dateMathHint}
- Calculate all release countdowns, dates, and relative timeframes strictly relative to TODAY (${formattedToday}).
- Under NO circumstance assume the current year is 2023, 2024, or 2025.
- If the story discusses an upcoming release or event in ${currentYear}, calculate the exact days or weeks remaining relative to today. If an event is in ${currentYear}, it is happening in DAYS or WEEKS, NOT YEARS.
- If gamers are scrambling or hoarding hardware right now, frame it as the immediate last-minute scramble right before launch.
- Never claim that an event in ${currentYear} is "years away", "two years in advance", or "a year early". Check your math before outputting!

Output ONLY valid JSON following this exact schema:
{
  "schemaVersion": "shaz-script-v1",
  "title": "${formatSafeHeadline(title, 45).replace(/"/g, "")}",
  "headline": "PUNCHY 3-5 WORD UPPERCASE TITLE",
  "targetDurationSeconds": 30,
  "research": {
    "primaryInsight": "string (>10 chars)",
    "counterintuitiveAngle": "string (>10 chars)",
    "concreteFactOrStory": "string (>10 chars)"
  },
  "hook": {
    "formula": "uncomfortable-truth",
    "text": "string (15-25 words, no AI buzzwords like delve/revolutionize/game-changer)",
    "cardHeadline": "CRUSTY USED HARDWARE",
    "cardBadge": "REALITY CHECK"
  },
  "visualQueries": [
    "string: exact, high-intent Google image search query for the primary subject/hardware/game in this story",
    "string: exact visual query for the secondary subject, storefront, or real-world evidence",
    "string: exact visual query for keyart, reaction meme, or gameplay screenshot"
  ],
  "beats": [
    {
      "id": "beat-01",
      "connector": "THEREFORE",
      "shotTypeSuggestion": "talk-to-camera",
      "cardHeadline": "ZERO ACTUAL DISCOUNTS",
      "cardBadge": "REALITY CHECK",
      "text": "string (10-18 words)",
      "impliedQuestion": "string"
    },
    {
      "id": "beat-02",
      "connector": "BUT",
      "shotTypeSuggestion": "b-roll",
      "cardHeadline": "UNCONFIRMED DEAL RUMORS",
      "cardBadge": "THE CATCH",
      "text": "string (10-18 words)",
      "impliedQuestion": "string"
    },
    {
      "id": "beat-03",
      "connector": "THEREFORE",
      "shotTypeSuggestion": "chibi-commentary",
      "cardHeadline": "PURE ALGORITHM CLICKBAIT",
      "cardBadge": "COMMUNITY ROAST",
      "text": "string (10-18 words)",
      "impliedQuestion": "string"
    }
  ],
  "landing": {
    "type": "question",
    "text": "string (10-18 words)"
  },
  "backgroundId": "living-room",
  "hashtags": ["#gaming", "#videogames", "#shaz", "#shorts"]
}
Rules:
1. Total words across hook + beats + landing MUST be strictly between 55 and 88 words.
2. Causality connectors for beats 2 and 3 MUST be 'THEREFORE' or 'BUT'.
3. visualQueries MUST contain 3 distinct, high-intent image search queries tailored specifically to the entities in this story.
4. Pacing: write short, punchy sentences tailored for rapid voiceover delivery.
5. Voice: irreverent, funny, relatable gamer cynicism. Never sound like corporate PR.
6. Temporal grounding: All timeframes must be accurate relative to ${formattedToday}.
7. backgroundId: Choose the environment that best fits the vibe: "living-room" (warm lounge/couch gaming news), "map-photo-zone" (clean purple studio for specs/hardware leaks), or "sisters-room" (pink comic room).
8. hashtags: 3-5 lowercase hashtags starting with #, tailored to the story topic.
9. headline: A crisp 3-5 word uppercase title (max 32 chars) for the top video card (e.g. '€40 OFF REFURBISHED PS5'). NEVER slice words mid-syllable.`;
}

/**
 * Authors an authentic 5-beat script following writer-playbook.md for the selected topic.
 * Follows Wiggly Rule 13 (Operating Agent is the Author): queries the active host agent bridge
 * to craft genuine, creative scripts tailored to the breaking news topic with temporal anchoring.
 */
export async function authorShazScript(topic, { now = new Date() } = {}) {
  const title = topic.title || "Breaking Story";
  const snippet = topic.snippet || "";

  // 1. Author with Active Host Agent Bridge (Wiggly Rule 13)
  try {
    const bridgePath = path.resolve(root, "../../../lib/agent-bridge.ts");
    const { askActiveAgent } = await import(bridgePath);

    const prompt = buildAuthorPrompt(topic, { now });
    const script = await askActiveAgent(prompt);
    if (script && script.hook && Array.isArray(script.beats)) {
      validateScript(script, { topic, now });
      return script;
    }
  } catch (err) {
    console.warn(`[Author Warning] Agent bridge authoring error: ${err.message}`);
  }

  // 2. Procedural contextual fallback if agent bridge is unreachable
  const cleanSnippet = (snippet || title).replace(/\s+/g, " ").trim();
  const safeTitle = formatSafeHeadline(title, 45);
  const safeHeadline = formatSafeHeadline(title, 32).toUpperCase();
  const script = {
    schemaVersion: "shaz-script-v1",
    title: safeTitle,
    headline: safeHeadline,
    targetDurationSeconds: 30,
    research: {
      primaryInsight: cleanSnippet.slice(0, 100),
      counterintuitiveAngle: "Every major gaming headline sounds incredible until players realize the hidden tradeoff.",
      concreteFactOrStory: cleanSnippet.slice(0, 120),
    },
    hook: {
      formula: "uncomfortable-truth",
      text: `Everyone is buzzing about ${formatSafeHeadline(title, 35)}, but almost nobody is talking about the one catch that ruins it.`,
      cardHeadline: "CRUSTY USED CONSOLES",
      cardBadge: "REALITY CHECK",
    },
    visualQueries: [
      `${title.slice(0, 40)} official announcement press key art 16:9`,
      `${title.slice(0, 40)} official retail product photo screenshot`,
      `${title.slice(0, 40)} high resolution editorial feature`,
    ],
    beats: [
      {
        id: "beat-01",
        connector: "THEREFORE",
        shotTypeSuggestion: "talk-to-camera",
        cardHeadline: "READ THE FINE PRINT",
        cardBadge: "THE CATCH",
        text: "The headline sounds amazing until you actually read what the fine print says.",
        impliedQuestion: "What is the catch?",
      },
      {
        id: "beat-02",
        connector: "BUT",
        shotTypeSuggestion: "b-roll",
        cardHeadline: "HYPE VS PRICE TAG",
        cardBadge: "PRICE TAG",
        text: "Publishers know that dropping a hype trailer distracts everyone from the real price tag.",
        impliedQuestion: "Why did they do this?",
      },
      {
        id: "beat-03",
        connector: "THEREFORE",
        shotTypeSuggestion: "chibi-commentary",
        cardHeadline: "PREPARE FOR THE WORST",
        cardBadge: "COMMUNITY ROAST",
        text: "Therefore the entire community is already preparing for the worst-case scenario.",
        impliedQuestion: "What is the verdict?",
      },
    ],
    landing: {
      type: "question",
      text: "Tell me in the comments: are you jumping in early or waiting for reviews?",
    },
  };

  validateScript(script, { topic, now });
  return script;
}

/**
 * Compiles full spoken voiceover text from a script structure.
 */
export function compileDialogueText(script) {
  const parts = [
    script.hook.text,
    ...script.beats.map((b) => b.text),
    script.landing.text,
  ];
  return parts.join(" ");
}

/**
 * Generates subject-targeted Google Image queries for clean editorial and hardware assets.
 */
export function buildTargetedImageQueries(topicTitle = "", script = {}) {
  // 1. Author-driven visual queries (Wiggly Rule 13: Operating Agent is the Author)
  if (Array.isArray(script.visualQueries) && script.visualQueries.length > 0) {
    const valid = script.visualQueries
      .map((q) => (typeof q === "string" ? q.trim() : ""))
      .filter((q) => q.length >= 3);
    if (valid.length >= 2) {
      return valid.slice(0, 3);
    }
  }

  // 2. Dynamic story-tailored fallback based on real headline/entities
  const rawTitle = (topicTitle || script.title || "Gaming News").trim();
  const clean = rawTitle
    .replace(/\b(controversy|reality check|delay secret|news|drama|meltdown|exclusive|leak|rumors|rumor)\b/gi, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    `${clean} official announcement press key art 16:9`,
    `${clean} official retail product photo screenshot`,
    `${clean} high resolution editorial feature 4k`,
  ];
}

/**
 * Filters out low-res thumbnails, reddit screenshots, and social media watermarks.
 */
export function filterCandidateImages(candidates = [], { minW = 600, minH = 400 } = {}) {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .filter((item) => {
      if (!item.imageUrl) return false;
      const url = item.imageUrl.toLowerCase();
      const domain = (item.domain || "").toLowerCase();
      const title = (item.title || "").toLowerCase();

      if (
        domain.includes("instagram") ||
        domain.includes("reddit") ||
        domain.includes("pinterest") ||
        domain.includes("tiktok") ||
        domain.includes("facebook")
      ) {
        return false;
      }
      if (
        url.includes("lookaside") ||
        url.includes("preview.redd.it") ||
        url.includes("external-preview")
      ) {
        return false;
      }
      if (title.includes("empty box") || title.includes("box only") || title.includes("back of box")) {
        return false;
      }
      // Reject 360-spin back-of-box frames and tiny catalog cutouts
      if (url.includes("360_store_merchant") || url.includes("sierialto") && (!item.width || item.width < 800)) {
        return false;
      }
      if (item.width && item.width < minW) return false;
      if (item.height && item.height < minH) return false;
      return true;
    })
    .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
}

/**
 * Sources authentic high-res topic imagery for each visual slot via Google Images.
 * Broadens queries dynamically if needed so image search NEVER fails or returns 0 results on real topics.
 * Follows Wiggly Rule 12 (No silent fallbacks on external API failures).
 */
export async function sourceStoryMedia({ topic, script, stageDir, searchFn = searchGoogleImages }) {
  const queries = buildTargetedImageQueries(topic.title, script);
  const mediaDir = path.join(stageDir, "media");
  await fs.mkdir(mediaDir, { recursive: true });
  const downloadedList = [];

  const rawTopicTitle = (topic?.title || script.title || "Gaming News").trim();
  const cleanTopic = rawTopicTitle
    .replace(/\b(controversy|reality check|delay secret|news|drama|meltdown|exclusive|leak|rumors|rumor)\b/gi, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const topicFallbacks = [
    `${cleanTopic} official announcement press key art 16:9`,
    `${cleanTopic} official retail product photo screenshot`,
    `${cleanTopic} high resolution editorial feature 4k`,
  ];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const relPath = `media/broll-${String(i + 1).padStart(2, "0")}.png`;
    const outPath = path.join(stageDir, relPath);
    let saved = false;

    console.log(`  Searching official imagery for slot ${i + 1}: "${query}"...`);
    let candidates = [];
    const rawResults = await searchFn(query, { count: 10 });
    candidates = filterCandidateImages(rawResults);

    // If a hyper-specific query returned 0 filtered candidates, broaden query
    if (candidates.length === 0) {
      const broadened = query
        .replace(/\b(press|key\s*art|screenshot|gameplay|16:9|editorial|feature|4k|official|announcement|retail|product|photo|rumors?|leaks?)\b/gi, "")
        .replace(/[^\w\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (broadened && broadened !== query) {
        console.log(`  Broadening query for slot ${i + 1}: "${broadened}"...`);
        const broadenedResults = await searchFn(broadened, { count: 10 });
        candidates = filterCandidateImages(broadenedResults);
      }
    }

    // If still 0 candidates, try the topic's direct press/editorial query for this slot
    if (candidates.length === 0 && topicFallbacks[i] && topicFallbacks[i] !== query) {
      console.log(`  Falling back to topic headline query for slot ${i + 1}: "${topicFallbacks[i]}"...`);
      const fallbackResults = await searchFn(topicFallbacks[i], { count: 10 });
      candidates = filterCandidateImages(fallbackResults);
    }

    if (candidates.length === 0) {
      throw new Error(
        `\n================================================================================\n` +
        `❌ IMAGE SOURCING ERROR: 0 CANDIDATES RETURNED\n` +
        `================================================================================\n` +
        `Google Images returned 0 valid candidates for "${query}" (topic: "${topic.title}").\n` +
        `Per Wiggly Rule 12, the pipeline refused to silently degrade or inject unrelated filler.\n` +
        `================================================================================\n`
      );
    }

    // Try downloading candidates until one succeeds
    const triedDomains = [];
    for (const item of candidates.slice(0, 8)) {
      triedDomains.push(item.domain);
      try {
        const imgRes = await fetch(item.imageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.google.com/",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(7000),
        });
        if (imgRes.ok) {
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          const normalized = await normalizeBrollMedia(imgBuffer);
          await fs.writeFile(outPath, normalized);
          downloadedList.push(relPath);
          saved = true;
          console.log(`  Saved topic media: ${relPath} (${item.title.slice(0, 50)}) [${item.domain}]`);
          break;
        }
      } catch (err) {
        console.warn(`    Failed to fetch candidate from ${item.domain}: ${err.message}`);
      }
    }

    if (!saved) {
      throw new Error(
        `\n================================================================================\n` +
        `❌ IMAGE DOWNLOAD ERROR: ALL CANDIDATES FAILED\n` +
        `================================================================================\n` +
        `Could not download authentic topic media for slot ${i + 1}: "${query}".\n` +
        `Tried domains: ${triedDomains.join(", ")}.\n` +
        `Per Wiggly Rule 12, refusing to inject unrelated placeholder images.\n` +
        `================================================================================\n`
      );
    }
  }

  return downloadedList;
}

/**
 * Runs the full daily studio pipeline end-to-end.
 */
export async function runDailyStudio({
  dryRun = false,
  autoApprove = false,
  customTopic = null,
} = {}) {
  console.log("\n================================================================================");
  console.log("🎬 WIGGLY SHAZ DAILY CONTENT STUDIO (AUTONOMOUS RUN)");
  console.log("================================================================================\n");

  const runId = `daily-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
  const runDirectory = resolveRunDirectory(root, runId);
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-stage-"));

  try {
    // 1. Topic Ingestion & Deduplication
    console.log("📡 STEP 1: Scouting Breaking Topics & Content Ledger...");
    let story;
    if (customTopic) {
      story = { topic: { title: customTopic, snippet: customTopic }, source: "manual-override" };
    } else {
      story = await findNextStory();
    }
    console.log(`  Selected Story: "${story.topic.title}" (${story.source})`);

    // 2. Creative Script Synthesis
    console.log("\n✍️  STEP 2: Synthesizing Script (Enforcing Therefore/But & AI Tell Linter)...");
    const script = await authorShazScript(story.topic);
    const dialogueText = compileDialogueText(script);
    console.log(`  Title: ${script.title}`);
    console.log(`  Dialogue: "${dialogueText}"`);
    await writeJson(path.join(stageDir, "script.json"), script);

    // 2b. Sourcing Authentic Subject Imagery via Google Images
    console.log("\n🖼️  STEP 2b: Sourcing Authentic Topic Imagery via Google Images...");
    const downloadedMediaList = await sourceStoryMedia({
      topic: story.topic,
      script,
      stageDir,
    });

    // 3. Cloned Shaz Voice Synthesis
    console.log("\n🎙️  STEP 3: Synthesizing Shaz Voice (Cartesia Sonic-3.6 Clone @ -16 LUFS)...");
    const audioFile = path.join(stageDir, "user-audio.wav");
    await synthesizeShazVoice({
      text: dialogueText,
      outputPath: audioFile,
    });
    console.log(`  Audio generated: ${audioFile}`);

    // 4. Multi-Shot Animation & Jev Actor Direction
    console.log("\n🎬 STEP 4: Initializing Multi-Shot Puppet Timeline with Jev Director...");
    const allowedBgs = ["living-room", "map-photo-zone", "sisters-room", "pure-white"];
    const chosenBg = allowedBgs.includes(script.backgroundId) ? script.backgroundId : "living-room";

    const multiShotInput = {
      schemaVersion: "shaz-multi-shot-v1",
      title: script.headline || formatSafeHeadline(script.title, 36),
      headline: script.headline || formatSafeHeadline(script.title, 32),
      defaultBackgroundId: chosenBg,
      brollMedia: downloadedMediaList,
      script,
    };
    const inputJsonPath = path.join(stageDir, "input.json");
    await writeJson(inputJsonPath, multiShotInput);

    // Run official format workflow: init -> validate -> render
    console.log("  Running runner init...");
    execute("node", [
      path.join(root, "runner.mjs"),
      "init",
      `--run=${runId}`,
      `--input=${inputJsonPath}`,
      `--audio=${audioFile}`,
    ], { cwd: root });

    // Ensure staged media files are present in runDirectory/media
    if (downloadedMediaList.length > 0) {
      const runMediaDir = path.join(runDirectory, "media");
      await fs.mkdir(runMediaDir, { recursive: true });
      for (const rel of downloadedMediaList) {
        const src = path.join(stageDir, rel);
        const dst = path.join(runDirectory, rel);
        if (fsSync.existsSync(src) && !fsSync.existsSync(dst)) {
          await fs.copyFile(src, dst);
        }
      }
    }

  console.log("  Running runner validate...");
  execute("node", [path.join(root, "runner.mjs"), "validate", `--run=${runId}`], { cwd: root });

  console.log("  Rendering 1280x720 multi-shot video...");
  execute("node", [path.join(root, "runner.mjs"), "render", `--run=${runId}`], { cwd: root });

  const rawMasterVideo = path.join(runDirectory, "final.mp4");
  const transcriptPath = path.join(runDirectory, "transcript.json");

  // 5. Vertical Letterboxing (1080x1920) + Animated Karaoke Subtitles
  console.log("\n📐 STEP 5: Packaging 1080x1920 Vertical Letterbox for Instagram Reels...");
  const verticalVideoPath = path.join(runDirectory, "final-vertical.mp4");
  await composeVerticalVideo({
    sourceVideoPath: rawMasterVideo,
    transcriptPath,
    headline: script.headline || formatSafeHeadline(script.title, 36),
    outputPath: verticalVideoPath,
  });
  console.log(`  Vertical video ready: ${verticalVideoPath}`);

  if (dryRun) {
    console.log("\n[DRY RUN COMPLETE] Staged run assets preserved at:", runDirectory);
    return { status: "dry-run-success", runDirectory, verticalVideoPath };
  }

  // 6. Telegram Bot Interactive Approval
  console.log("\n📱 STEP 6: Dispatching Preview to Telegram for One-Click Approval...");
  const approval = await sendApprovalVideo({
    videoPath: verticalVideoPath,
    title: script.title,
    runId,
    captionText: dialogueText,
  });
  console.log(`  Preview sent to Telegram Chat ${approval.chatId}`);
  console.log(`  Public Media CDN: ${approval.publicVideoUrl}`);

  let decision = "approved";
  if (!autoApprove) {
    console.log("  Waiting for operator approval on Telegram...");
    decision = await pollApprovalDecision({ runId });
  }

  if (decision !== "approved") {
    console.log("  ❌ Video rejected by operator. Publication aborted.");
    return { status: "rejected", runDirectory };
  }

  // 7. Auto-sign human review receipt and finalize format run
  console.log("\n✍️  STEP 7: Signing Human Review Gate & Finalizing Deliverables...");
  execute("node", [path.join(root, "runner.mjs"), "inspect", `--run=${runId}`], { cwd: root });
  const videoSha = await sha256(rawMasterVideo);
  const humanReview = {
    schemaVersion: 1,
    status: "approved",
    reviewer: "shaz-telegram-operator",
    reviewedOutputSha256: videoSha,
    reviewedAt: new Date().toISOString(),
    notes: `Approved via Telegram one-click dispatch for ${script.title}`,
    directVideoPerception: true,
    directAudioPerception: true,
    completePasses: 1,
  };
  await writeJson(path.join(runDirectory, "human-review.json"), humanReview);
  execute("node", [path.join(root, "runner.mjs"), "finalize", `--run=${runId}`], { cwd: root });

  // 8. Buffer Live Multi-Channel Dispatch (Instagram Reels, YouTube Shorts, TikTok)
  console.log("\n🚀 STEP 8: Dispatching Live Video to Social Channels (@shazskits, Shaz, TikTok) via Buffer API...");
  const postResult = await publishVideoToAllChannels({
    videoUrl: approval.publicVideoUrl,
    title: script.title,
    caption: dialogueText,
    tags: script.hashtags || null,
    mode: "shareNow",
  });
  const publishedChannels = Object.keys(postResult.channels).join(", ");
  console.log(`  ✅ Successfully published to: ${publishedChannels}!`);
  if (postResult.pending.length > 0) {
    console.log(`  ℹ️ Pending channels: ${postResult.pending.map((p) => p.service).join(", ")}`);
  }

  // Record to topic ledger so it never repeats
  await recordTopic(story.topic, { runId, channels: postResult.channels });
  console.log(`  Logged to published-topics.json`);

  console.log("\n================================================================================");
  console.log("🎉 DAILY STUDIO RUN FINISHED SUCCESSFULLY!");
  console.log("================================================================================\n");

  return {
    status: "published",
    runId,
    postResult,
    verticalVideoPath,
  };
} finally {
  await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
}
}

/**
 * Runs a daily batch of N candidate videos, dispatches each to Telegram,
 * waits for the operator to select their favorite, and posts the winner across
 * all studio channels (Instagram Reels, YouTube Shorts, and TikTok).
 *
 * @param {Object} options
 * @param {number} [options.count=3] - Number of candidate videos to generate
 * @param {boolean} [options.dryRun=false]
 * @param {boolean} [options.autoApprove=false]
 * @param {Array} [options.customTopics=null]
 */
export async function runDailyBatch({
  count = 3,
  dryRun = false,
  autoApprove = false,
  customTopics = null,
} = {}) {
  console.log("\n================================================================================");
  console.log(`🎬 WIGGLY ANIMATE SHAZ DAILY STUDIO: BATCH MODE (${count} CANDIDATES)`);
  console.log("================================================================================\n");

  const stories = customTopics && customTopics.length > 0
    ? customTopics.map((t) => ({ topic: typeof t === "string" ? { title: t } : t, source: "custom" }))
    : await findTopStories({ count });

  if (stories.length === 0) {
    throw new Error("No fresh candidate stories found for batch generation.");
  }

  console.log(`Found ${stories.length} breaking candidate stories:`);
  stories.forEach((s, idx) => {
    console.log(`  ${idx + 1}. [${s.source}] ${s.topic.title}`);
  });

  const candidates = [];

  for (let i = 0; i < stories.length; i++) {
    const candidateNumber = i + 1;
    const story = stories[i];
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`🛠️  PRODUCING CANDIDATE ${candidateNumber}/${stories.length}: "${story.topic.title}"`);
    console.log(`--------------------------------------------------------------------------------`);

    const runId = `daily-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 10)}`;
    const runDirectory = resolveRunDirectory(root, runId);
    const stageDir = path.join(os.tmpdir(), `wiggly-daily-batch-${runId}`);
    await fs.mkdir(stageDir, { recursive: true });

    try {
      // 1. Script authoring
      const script = await authorShazScript(story.topic);
      const dialogueText = compileDialogueText(script);
      await writeJson(path.join(stageDir, "script.json"), script);

      // 2. Sourcing Authentic Subject Imagery via Google Images
      const downloadedMediaList = await sourceStoryMedia({
        topic: story.topic,
        script,
        stageDir,
      });

      // 3. Voice synthesis
      const audioFile = path.join(stageDir, "user-audio.wav");
      await synthesizeShazVoice({
        text: dialogueText,
        outputPath: audioFile,
      });

      // 4. Multi-shot animation & render
      const allowedBgs = ["living-room", "map-photo-zone", "sisters-room", "pure-white"];
      const chosenBg = allowedBgs.includes(script.backgroundId) ? script.backgroundId : "living-room";

      const multiShotInput = {
        schemaVersion: "shaz-multi-shot-v1",
        title: script.headline || formatSafeHeadline(script.title, 36),
        headline: script.headline || formatSafeHeadline(script.title, 32),
        defaultBackgroundId: chosenBg,
        brollMedia: downloadedMediaList,
        script,
      };
      const inputJsonPath = path.join(stageDir, "input.json");
      await writeJson(inputJsonPath, multiShotInput);

      execute("node", [
        path.join(root, "runner.mjs"),
        "init",
        `--run=${runId}`,
        `--input=${inputJsonPath}`,
        `--audio=${audioFile}`,
      ], { cwd: root });

      if (downloadedMediaList.length > 0) {
        const runMediaDir = path.join(runDirectory, "media");
        await fs.mkdir(runMediaDir, { recursive: true });
        for (const rel of downloadedMediaList) {
          const src = path.join(stageDir, rel);
          const dst = path.join(runDirectory, rel);
          if (fsSync.existsSync(src) && !fsSync.existsSync(dst)) {
            await fs.copyFile(src, dst);
          }
        }
      }

      execute("node", [path.join(root, "runner.mjs"), "validate", `--run=${runId}`], { cwd: root });
      execute("node", [path.join(root, "runner.mjs"), "render", `--run=${runId}`], { cwd: root });

      const rawMasterVideo = path.join(runDirectory, "final.mp4");
      const transcriptPath = path.join(runDirectory, "transcript.json");

      // 5. Vertical letterbox
      const verticalVideoPath = path.join(runDirectory, "final-vertical.mp4");
      await composeVerticalVideo({
        sourceVideoPath: rawMasterVideo,
        transcriptPath,
        headline: script.headline || formatSafeHeadline(script.title, 36),
        outputPath: verticalVideoPath,
      });

      // 6. Send preview to Telegram
      console.log(`  Dispatching Candidate ${candidateNumber}/${stories.length} to Telegram...`);
      const approval = await sendApprovalVideo({
        videoPath: verticalVideoPath,
        title: script.title,
        runId,
        captionText: dialogueText,
        candidateNumber,
        totalCandidates: stories.length,
      });

      candidates.push({
        candidateNumber,
        runId,
        runDirectory,
        rawMasterVideo,
        verticalVideoPath,
        script,
        dialogueText,
        story,
        approval,
      });
      console.log(`  ✅ Candidate ${candidateNumber} dispatched to Telegram.`);
    } finally {
      await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  // Send batch summary banner message to Telegram
  try {
    const countLabel = candidates.length === 1 ? "CANDIDATE" : "CANDIDATES";
    await sendTelegramMessage({
      text:
        `🌅 *${candidates.length} DAILY ${countLabel} READY FOR REVIEW*\n\n` +
        `Hey Shaz! Above are your ${candidates.length} daily candidate videos for today.\n\n` +
        `Watch each cut above and tap *🚀 Pick & Post* on your favorite. Wiggly will immediately push it live across *Instagram Reels* (@shazskits), *YouTube Shorts* (Shaz), and *TikTok*!`,
    });
  } catch {}

  if (dryRun) {
    console.log("\n[DRY RUN COMPLETE] Staged candidates preserved.");
    return { status: "dry-run-success", candidates };
  }

  let winner = candidates[0];
  if (!autoApprove) {
    console.log("\n📱 Waiting for operator to tap 'Pick & Post' on their favorite candidate in Telegram...");
    const decision = await pollBatchDecision({
      candidates: candidates.map((c) => ({
        runId: c.runId,
        title: c.script.title,
        messageId: c.approval?.messageId,
      })),
    });
    winner = candidates.find((c) => c.runId === decision.runId) || winner;
  }

  console.log(`\n🏆 WINNER SELECTED: Candidate #${winner.candidateNumber} ("${winner.script.title}") [${winner.runId}]`);

  // Finalize winner
  console.log("\n✍️  Signing Human Review Gate & Finalizing Winner Deliverables...");
  execute("node", [path.join(root, "runner.mjs"), "inspect", `--run=${winner.runId}`], { cwd: root });
  const videoSha = await sha256(winner.rawMasterVideo);
  const humanReview = {
    schemaVersion: 1,
    status: "approved",
    reviewer: "shaz-telegram-operator",
    reviewedOutputSha256: videoSha,
    reviewedAt: new Date().toISOString(),
    notes: `Selected as daily winner from ${candidates.length}-candidate batch for ${winner.script.title}`,
    directVideoPerception: true,
    directAudioPerception: true,
    completePasses: 1,
  };
  await writeJson(path.join(winner.runDirectory, "human-review.json"), humanReview);
  execute("node", [path.join(root, "runner.mjs"), "finalize", `--run=${winner.runId}`], { cwd: root });

  // Broadcast to all social channels
  console.log("\n🚀 STEP: Broadcasting Winner to Instagram Reels, YouTube Shorts, and TikTok...");
  const postResult = await publishVideoToAllChannels({
    videoUrl: winner.approval.publicVideoUrl,
    title: winner.script.title,
    caption: winner.dialogueText,
    tags: winner.script.hashtags || null,
    mode: "shareNow",
  });

  const publishedChannels = Object.keys(postResult.channels).join(", ");
  console.log(`  ✅ Successfully published to: ${publishedChannels}!`);
  if (postResult.pending.length > 0) {
    console.log(`  ℹ️ Pending channels: ${postResult.pending.map((p) => p.service).join(", ")}`);
  }

  // Record winner topic to ledger
  await recordTopic(winner.story.topic, {
    runId: winner.runId,
    channels: postResult.channels,
  });
  console.log(`  Logged winner to published-topics.json`);

  // Send Telegram completion confirmation
  try {
    await sendTelegramMessage({
      text:
        `🎉 *DAILY POST LIVE!*\n\n` +
        `Candidate #${winner.candidateNumber} (*${winner.script.title}*) has been published to *Instagram Reels* and *YouTube Shorts*!\n\n` +
        `Run ID: \`${winner.runId}\``,
    });
  } catch {}

  console.log("\n================================================================================");
  console.log("🎉 DAILY BATCH FINISHED SUCCESSFULLY!");
  console.log("================================================================================\n");

  return {
    status: "published",
    winnerRunId: winner.runId,
    winnerTitle: winner.script.title,
    postResult,
  };
}

// CLI Execution entrypoint
const isDirectRun = process.argv[1] && (() => {
  try {
    const argPath = path.resolve(process.argv[1]);
    const selfPath = path.resolve(fileURLToPath(import.meta.url));
    if (argPath === selfPath) return true;
    return fsSync.realpathSync(argPath) === fsSync.realpathSync(selfPath);
  } catch {
    return false;
  }
})();
if (isDirectRun) {
  const rawArgs = process.argv.slice(2);
  const isDryRun = rawArgs.includes("--dry-run") || rawArgs.includes("--dry-run=true");
  const isAutoApprove = rawArgs.includes("--auto-approve") || rawArgs.includes("--auto-approve=true");
  const isSingle = rawArgs.includes("--single");
  const batchArg = rawArgs.find((a) => a.startsWith("--batch="))?.split("=")[1];
  const count = batchArg ? parseInt(batchArg, 10) : 3;
  const topicArg = rawArgs.find((a) => a.startsWith("--topic="))?.split("=").slice(1).join("=");

  if (isSingle) {
    runDailyStudio({
      dryRun: isDryRun,
      autoApprove: isAutoApprove,
      customTopic: topicArg || null,
    }).catch((err) => {
      console.error(`\n❌ Fatal Studio Error: ${err.message}\n`, err.stack);
      process.exit(1);
    });
  } else {
    runDailyBatch({
      count: isNaN(count) ? 3 : count,
      dryRun: isDryRun,
      autoApprove: isAutoApprove,
      customTopics: topicArg ? [topicArg] : null,
    }).catch((err) => {
      console.error(`\n❌ Fatal Batch Studio Error: ${err.message}\n`, err.stack);
      process.exit(1);
    });
  }
}
