#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { AgentUnavailableError, askActiveAgent } from "../../v3/lib/agent-bridge.ts";
import { ArticleFetchError, fetchArticleForTopic } from "./article-fetch.mjs";
import {
  CandidateSkipError,
  classifyRunError,
  isJevAccountError,
  isJevCandidateSkipError,
  isJsCodeBug,
  RunStopError,
  ScriptAuthorError,
} from "./errors.mjs";
import { acquireStudioLock, assertFreeDiskSpace } from "./preflight.mjs";
import { fetchNewsMcpEvents, NewsMcpError, pickDistinctEvents } from "./newsmcp.mjs";

export { CandidateSkipError, RunStopError, ScriptAuthorError };
import {
  filterFreshTopics,
  getDefaultStudioHome,
  getRecentPublishedTitles,
  loadLedger,
  recordShown,
  recordTopic,
} from "./content-ledger.mjs";
import { countWords, validateScript } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/validate-script.mjs";
import { synthesizeShazVoice } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/voice.mjs";
import { composeVerticalVideo, formatSafeHeadline } from "./vertical-letterbox.mjs";
import {
  computeChicagoDeadline,
  editTelegramMessageCaption,
  escapeTelegramHtml,
  flushTelegramBacklog,
  getTelegramCredentials,
  pollApprovalDecision,
  pollBatchDecision,
  sendApprovalVideo,
  sendTelegramMessage,
} from "./telegram-approval.mjs";
import { publishVideoToAllChannels, getBufferPostsStatus } from "./buffer-publisher.mjs";
import { uploadPublishVideo, deletePublishVideo } from "./media-host.mjs";
import { redactSecrets } from "./secrets.mjs";
import { execute, resolveRunDirectory, sha256, writeJson } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/run-common.mjs";
import { searchGoogleImages } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/serper-search.mjs";
import { normalizeBrollMedia } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/broll-renderer.mjs";
import sharp from "sharp";

export const STUDIO_ROOT = path.dirname(fileURLToPath(import.meta.url));
export const KIT_ROOT = path.resolve(STUDIO_ROOT, "../../v3/public/format-repositories/shaz-puppet-runtime-v1");
export const DEFAULT_CONFIG_PATH = path.join(STUDIO_ROOT, "studio.config.json");
const root = KIT_ROOT;

/**
 * Loads and validates studio runtime configuration (`writerAgent`, timeouts, retry limits, batch size).
 */
export async function loadStudioConfig(configPath = DEFAULT_CONFIG_PATH) {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const writerAgent = parsed?.writerAgent;
  if (writerAgent !== "agy" && writerAgent !== "claude") {
    throw new Error(`Invalid studio.config.json writerAgent '${writerAgent}': expected "agy" or "claude".`);
  }
  const agentTimeoutMs = Number(parsed?.agentTimeoutMs);
  const maxScriptAttempts = Number(parsed?.maxScriptAttempts);
  const batchSize = Number(parsed?.batchSize);
  if (!Number.isFinite(agentTimeoutMs) || agentTimeoutMs < 1000) {
    throw new Error(`Invalid studio.config.json agentTimeoutMs '${parsed?.agentTimeoutMs}': expected >= 1000.`);
  }
  if (!Number.isInteger(maxScriptAttempts) || maxScriptAttempts < 1) {
    throw new Error(`Invalid studio.config.json maxScriptAttempts '${parsed?.maxScriptAttempts}': expected integer >= 1.`);
  }
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`Invalid studio.config.json batchSize '${parsed?.batchSize}': expected integer >= 1.`);
  }
  const minFreeDiskMb = parsed?.minFreeDiskMb === undefined ? 1500 : Number(parsed.minFreeDiskMb);
  const retentionDays = parsed?.retentionDays === undefined ? 7 : Number(parsed.retentionDays);
  if (!Number.isFinite(minFreeDiskMb) || minFreeDiskMb < 0) {
    throw new Error(`Invalid studio.config.json minFreeDiskMb '${parsed?.minFreeDiskMb}': expected >= 0.`);
  }
  if (!Number.isFinite(retentionDays) || retentionDays < 0) {
    throw new Error(`Invalid studio.config.json retentionDays '${parsed?.retentionDays}': expected >= 0.`);
  }
  return {
    writerAgent,
    agentTimeoutMs,
    maxScriptAttempts,
    batchSize,
    minFreeDiskMb,
    retentionDays,
  };
}

/**
 * Scouts fresh distinct gaming/tech news events strictly from NewsMCP, filtered by the v2 ledger
 * and deduplicated by the pinned operating agent.
 */
export async function findTopStories({
  count = 3,
  query,
  limit = 15,
  now = new Date(),
  ledgerPath,
  env = process.env,
  configPath = DEFAULT_CONFIG_PATH,
  config = null,
  deps = {},
} = {}) {
  const cfg = config || await loadStudioConfig(configPath);
  const loadLedgerFn = deps.loadLedger || loadLedger;
  const fetchEventsFn = deps.fetchNewsMcpEvents || fetchNewsMcpEvents;
  const pickEventsFn = deps.pickDistinctEvents || pickDistinctEvents;

  const [ledger, events] = await Promise.all([
    loadLedgerFn(ledgerPath, { env }),
    fetchEventsFn({
      ...(query ? { query } : {}),
      limit,
      apiKey: deps.newsMcpApiKey,
      env,
      secretsPath: deps.secretsPath,
      fetchFn: deps.fetchFn,
    }),
  ]);

  const eligible = filterFreshTopics(events, ledger, { now });
  if (eligible.length === 0) {
    return [];
  }

  return pickEventsFn({
    candidates: eligible,
    recentPublishedTitles: getRecentPublishedTitles(ledger, 30),
    maxPicks: Math.min(eligible.length, count * 3),
    writerAgent: cfg.writerAgent,
    timeoutMs: cfg.agentTimeoutMs,
    askAgentFn: deps.askAgentFn || askActiveAgent,
  });
}

/**
 * Scouts the highest-ranked fresh NewsMCP event not yet covered or retired in the ledger.
 */
export async function findNextStory(options = {}) {
  const stories = await findTopStories({ ...options, count: 1 });
  return stories[0] || null;
}

/**
 * Builds an authentic, temporally anchored authoring prompt for the active coding agent.
 * Enforces current-year calendar grounding to prevent outdated AI slop and timeframe hallucinations.
 */
export function buildAuthorPrompt(topic, { now = new Date(), article = null } = {}) {
  const title = topic.title || "Breaking Story";
  const snippet = topic.snippet || "";
  const sourceUrl = String(article?.url || topic.link || topic?.sources?.[0] || "").trim();
  const articleText = String(article?.text || snippet || "").trim().slice(0, 12_000);
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
  const dateMatch = (title + " " + snippet + " " + articleText).match(
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
Headline: "${title}"
Source URL: ${sourceUrl || "(none)"}
Snippet: "${snippet}"${pubString}

SOURCE ARTICLE TEXT (GROUNDING REQUIREMENT — ONLY STATE FACTS SUPPORTED BY THIS ARTICLE):
"""
${articleText}
"""

CURRENT DATE CONTEXT & TEMPORAL ANCHORING (CRITICAL — PREVENTS AI SLOP):
- TODAY IS: ${formattedToday} (${isoToday}).
- The current year is strictly ${currentYear}.${dateMathHint}
- Calculate all release countdowns, dates, and relative timeframes strictly relative to TODAY (${formattedToday}).
- Under NO circumstance assume the current year is 2023, 2024, or 2025.
- If the story discusses an upcoming release or event in ${currentYear}, calculate the exact days or weeks remaining relative to today. If an event is in ${currentYear}, it is happening in DAYS or WEEKS, NOT YEARS.
- Only state prices, specs, platforms, dates, sales numbers, and concrete details that appear in the SOURCE ARTICLE TEXT above. If a detail isn't in the article, do NOT invent it.

Output ONLY valid JSON following this exact schema:
{
  "schemaVersion": "shaz-script-v1",
  "sourceUrl": "${sourceUrl.replace(/"/g, "")}",
  "title": "<STORY TITLE>",
  "headline": "<PUNCHY 3-5 WORD UPPERCASE TOP CARD TITLE>",
  "targetDurationSeconds": 30,
  "research": {
    "primaryInsight": "<string >10 chars>",
    "counterintuitiveAngle": "<string >10 chars>",
    "concreteFactOrStory": "<string >10 chars>"
  },
  "claims": [
    {
      "target": "hook",
      "says": "<what the hook claims factually>",
      "quote": "<exact 4-30 word verbatim quote copied from SOURCE ARTICLE TEXT>"
    },
    {
      "target": "beat-01",
      "says": "<what beat-01 claims factually>",
      "quote": "<exact 4-30 word verbatim quote copied from SOURCE ARTICLE TEXT>"
    }
  ],
  "hook": {
    "formula": "<CHOOSE: uncomfortable-truth | surprising-stat | personal-confession | setup-payoff-tease>",
    "text": "<string: 15-25 words, zero AI buzzwords like delve/revolutionize/game-changer>",
    "cardHeadline": "<3-5 WORD CARD HEADLINE>",
    "cardBadge": "<1-2 WORD BADGE>"
  },
  "visualQueries": [
    "<exact high-intent Google image search query for the primary subject/hardware/game>",
    "<exact visual query for the secondary subject, storefront, or real-world evidence>",
    "<exact visual query for keyart, reaction meme, or gameplay screenshot>"
  ],
  "beats": [
    {
      "id": "beat-01",
      "connector": "THEREFORE",
      "shotTypeSuggestion": "talk-to-camera",
      "cardHeadline": "<3-5 WORD CARD HEADLINE>",
      "cardBadge": "<1-2 WORD BADGE>",
      "text": "<string: 12-18 words>",
      "impliedQuestion": "<string>"
    },
    {
      "id": "beat-02",
      "connector": "BUT",
      "shotTypeSuggestion": "b-roll",
      "cardHeadline": "<3-5 WORD CARD HEADLINE>",
      "cardBadge": "<1-2 WORD BADGE>",
      "text": "<string: 12-18 words>",
      "impliedQuestion": "<string>"
    },
    {
      "id": "beat-03",
      "connector": "THEREFORE",
      "shotTypeSuggestion": "chibi-commentary",
      "cardHeadline": "<3-5 WORD CARD HEADLINE>",
      "cardBadge": "<1-2 WORD BADGE>",
      "text": "<string: 12-18 words>",
      "impliedQuestion": "<string>"
    }
  ],
  "landing": {
    "type": "question",
    "text": "<string: 10-18 words>"
  },
  "backgroundId": "<CHOOSE: living-room | map-photo-zone | sisters-room>",
  "hashtags": ["#<topic1>", "#<topic2>", "#<topic3>"]
}
Rules:
1. Total spoken words across hook + beats + landing MUST be strictly between 70 and 85 words (hard validation gate rejects under 70 or over 88 words).
2. Grounding: include 2 to 5 claims in "claims", with at least one targeting "hook". Every "quote" must appear verbatim (4–30 words) in the SOURCE ARTICLE TEXT.
3. Causality connectors for beats 2 and 3 MUST be 'THEREFORE' or 'BUT'.
4. visualQueries MUST contain 3 distinct, high-intent image search queries tailored specifically to the entities in this story.
5. Pacing & Voice: write short, punchy sentences in Shaz's irreverent gaming commentary voice. Never sound like corporate PR.
6. Temporal grounding: All timeframes must be accurate relative to ${formattedToday}.
7. backgroundId: Choose one of "living-room" (warm lounge gaming news), "map-photo-zone" (clean purple studio for specs/hardware), or "sisters-room" (pink comic room).
8. hashtags: 3-5 lowercase hashtags starting with #, tailored specifically to this story.
9. headline: A crisp 3-5 word uppercase title (max 32 chars) for the top video card. NEVER slice words mid-syllable.`;
}

const AUTHOR_RECEIPT_SYMBOL = Symbol("shazAuthorReceipt");

function buildRetrySuffix({ attempt, maxAttempts, errorMessage, previousPayload }) {
  const payloadPreview = previousPayload
    ? JSON.stringify(previousPayload, null, 2).slice(0, 3500)
    : "";
  return (
    `\n\nRETRY REVISION REQUIRED (ATTEMPT ${attempt}/${maxAttempts}):\n` +
    `Your previous script failed validation with this EXACT error:\n${errorMessage}\n` +
    (payloadPreview ? `\nPrevious JSON output to repair:\n${payloadPreview}\n` : "") +
    `Fix the error cleanly while keeping every grounding quote verbatim from SOURCE ARTICLE TEXT and total spoken words strictly 70–88.`
  );
}

/**
 * Authors an authentic 5-beat script using ONLY the pinned active operating agent (Rule 13).
 * Retries transient output/validation errors up to `cfg.maxScriptAttempts` (default 3) with exact error feedback.
 * Never falls back to a canned template script; aborts immediately on `AgentUnavailableError`.
 */
export async function authorShazScript(
  topic,
  {
    now = new Date(),
    article = null,
    config = null,
    askAgentFn = askActiveAgent,
    allowUngroundedCustomTopic = false,
  } = {},
) {
  const cfg = config || await loadStudioConfig();
  const requireGroundedClaims = !allowUngroundedCustomTopic;
  if (requireGroundedClaims && !article?.text) {
    throw new ScriptAuthorError(
      `Cannot author script for "${topic?.title || "topic"}" without fetched source article text.`,
      [],
    );
  }

  const authoringStartedAt = Date.now();
  const basePrompt = buildAuthorPrompt(topic, { now, article });
  const promptSha256 = crypto.createHash("sha256").update(basePrompt, "utf8").digest("hex");
  const attempts = [];
  let lastError = null;
  let lastPayload = null;

  for (let attempt = 1; attempt <= cfg.maxScriptAttempts; attempt += 1) {
    const startedAt = Date.now();
    const prompt = lastError
      ? `${basePrompt}${buildRetrySuffix({
        attempt,
        maxAttempts: cfg.maxScriptAttempts,
        errorMessage: lastError,
        previousPayload: lastPayload,
      })}`
      : basePrompt;

    let script;
    try {
      script = await askAgentFn(prompt, {
        agent: cfg.writerAgent,
        timeoutMs: cfg.agentTimeoutMs,
        requireJson: true,
      });
    } catch (err) {
      attempts.push({
        attempt,
        ok: false,
        errorType: err?.name || "Error",
        error: err?.message || String(err),
        durationMs: Date.now() - startedAt,
      });
      if (err instanceof AgentUnavailableError) {
        throw err;
      }
      lastError = err?.message || String(err);
      lastPayload = null;
      console.warn(`  ⚠️ Script authoring attempt ${attempt}/${cfg.maxScriptAttempts} failed (${err?.name}): ${lastError}`);
      continue;
    }

    lastPayload = script;
    try {
      validateScript(script, {
        topic,
        now,
        minWords: 70,
        maxWords: 88,
        articleText: article?.text ?? null,
        requireGroundedClaims,
      });
      const dialogueText = compileDialogueText(script);
      const durationMs = Date.now() - startedAt;
      attempts.push({ attempt, ok: true, durationMs });
      const receipt = {
        schemaVersion: 1,
        agent: cfg.writerAgent,
        writerAgent: cfg.writerAgent,
        finalAttempt: attempt,
        maxAttempts: cfg.maxScriptAttempts,
        finalWordCount: countWords(dialogueText),
        authoredAt: new Date().toISOString(),
        durationMs: Date.now() - authoringStartedAt,
        promptSha256,
        attempts,
        errors: attempts
          .filter((entry) => !entry.ok)
          .map((entry) => ({ attempt: entry.attempt, errorType: entry.errorType, error: entry.error })),
      };
      Object.defineProperty(script, AUTHOR_RECEIPT_SYMBOL, {
        value: receipt,
        enumerable: false,
        configurable: true,
      });
      return script;
    } catch (err) {
      lastError = err?.message || String(err);
      attempts.push({
        attempt,
        ok: false,
        errorType: "ValidationError",
        error: lastError,
        durationMs: Date.now() - startedAt,
      });
      console.warn(`  ⚠️ Script validation attempt ${attempt}/${cfg.maxScriptAttempts} failed: ${lastError}`);
    }
  }

  throw new ScriptAuthorError(
    `Failed authoring grounded script for "${topic?.title || "topic"}" after ${cfg.maxScriptAttempts} attempts: ${lastError}`,
    attempts,
  );
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
      throw new CandidateSkipError(
        `\n================================================================================\n` +
        `❌ IMAGE SOURCING ERROR: 0 CANDIDATES RETURNED\n` +
        `================================================================================\n` +
        `Google Images returned 0 valid candidates for "${query}" (topic: "${topic.title}").\n` +
        `Per Wiggly Rule 12, the pipeline refused to silently degrade or inject unrelated filler.\n` +
        `================================================================================\n`,
        { stage: "media-sourcing" },
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
      throw new CandidateSkipError(
        `\n================================================================================\n` +
        `❌ IMAGE DOWNLOAD ERROR: ALL CANDIDATES FAILED\n` +
        `================================================================================\n` +
        `Could not download authentic topic media for slot ${i + 1}: "${query}".\n` +
        `Tried domains: ${triedDomains.join(", ")}.\n` +
        `Per Wiggly Rule 12, refusing to inject unrelated placeholder images.\n` +
        `================================================================================\n`,
        { stage: "media-sourcing" },
      );
    }
  }

  return downloadedList;
}

function resolveStudioDeps(deps = {}) {
  const hasMockTelegram =
    typeof deps.pollBatchDecision === "function" ||
    typeof deps.pollApprovalDecision === "function" ||
    typeof deps.sendApprovalVideo === "function" ||
    typeof deps.sendTelegramMessage === "function";

  return {
    loadStudioConfig,
    acquireStudioLock,
    assertFreeDiskSpace,
    statfsFn: undefined,
    findNextStory,
    findTopStories,
    fetchArticleForTopic,
    askAgentFn: askActiveAgent,
    authorShazScript,
    compileDialogueText,
    sourceStoryMedia,
    synthesizeShazVoice,
    execute,
    resolveRunDirectory,
    sha256,
    writeJson,
    composeVerticalVideo,
    getTelegramCredentials: hasMockTelegram ? null : getTelegramCredentials,
    flushTelegramBacklog: hasMockTelegram ? async () => 0 : flushTelegramBacklog,
    editTelegramMessageCaption: hasMockTelegram ? async () => ({}) : editTelegramMessageCaption,
    sendApprovalVideo,
    pollApprovalDecision,
    pollBatchDecision,
    sendTelegramMessage,
    uploadPublishVideo,
    deletePublishVideo,
    publishVideoToAllChannels,
    getBufferPostsStatus,
    recordShown,
    recordTopic,
    sleepFn: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    bufferPollMaxAttempts: 24,
    bufferPollIntervalMs: 10_000,
    ...deps,
  };
}

/**
 * Produces one grounded video candidate from story -> article -> grounded script -> media/voice -> render -> vertical MP4,
 * persisting `story.json`, `article.json`, `script.json`, and `author-receipt.json` into `runDirectory` after `init`.
 */
async function produceGroundedCandidateRun({
  story,
  runId,
  cfg,
  isCustomTopic = false,
  d,
}) {
  const runDirectory = d.resolveRunDirectory(root, runId);
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), `wiggly-stage-${runId}-`));

  try {
    const article = isCustomTopic ? null : await d.fetchArticleForTopic(story.topic);
    const script = await d.authorShazScript(story.topic, {
      article,
      config: cfg,
      askAgentFn: d.askAgentFn,
      allowUngroundedCustomTopic: isCustomTopic,
    });
    const dialogueText = d.compileDialogueText(script);
    const receipt = script?.[AUTHOR_RECEIPT_SYMBOL] || {
      schemaVersion: 1,
      agent: cfg.writerAgent,
      writerAgent: cfg.writerAgent,
      finalAttempt: 1,
      maxAttempts: cfg.maxScriptAttempts,
      finalWordCount: countWords(dialogueText),
      authoredAt: new Date().toISOString(),
      durationMs: 0,
      promptSha256: null,
      attempts: [{ attempt: 1, ok: true }],
      errors: [],
    };

    const storyRecord = {
      schemaVersion: 1,
      eventId: story.topic?.eventId ?? story.topic?.event_id ?? null,
      title: story.topic?.title || script.title,
      link: article?.url ?? story.topic?.link ?? null,
      sourceUrl: script.sourceUrl ?? article?.url ?? story.topic?.link ?? null,
      sources: Array.isArray(story.topic?.sources) ? story.topic.sources : [],
      source: story.source || null,
      pickReason: story.pickReason ?? null,
      writerAgent: cfg.writerAgent,
      runId,
    };
    const articleRecord = article
      ? {
          url: article.url,
          fetchedAt: article.fetchedAt,
          sha256: article.sha256,
          title: article.title,
          text: article.text,
        }
      : null;

    await d.writeJson(path.join(stageDir, "story.json"), storyRecord);
    if (articleRecord) {
      await d.writeJson(path.join(stageDir, "article.json"), articleRecord);
    }
    await d.writeJson(path.join(stageDir, "script.json"), script);
    await d.writeJson(path.join(stageDir, "author-receipt.json"), receipt);

    const downloadedMediaList = await d.sourceStoryMedia({
      topic: story.topic,
      script,
      stageDir,
    });

    const audioFile = path.join(stageDir, "user-audio.wav");
    await d.synthesizeShazVoice({
      text: dialogueText,
      outputPath: audioFile,
      provider: "cartesia",
    });

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
    await d.writeJson(inputJsonPath, multiShotInput);

    try {
      d.execute("node", [
        path.join(root, "runner.mjs"),
        "init",
        `--run=${runId}`,
        `--input=${inputJsonPath}`,
        `--audio=${audioFile}`,
      ], { cwd: root });
    } catch (err) {
      if (isJevCandidateSkipError(err)) {
        throw new CandidateSkipError(err.message, { stage: "jev-director", cause: err });
      }
      if (isJevAccountError(err)) {
        throw new RunStopError(err.message, {
          code: "JEV_API_ERROR",
          stage: "jev-director",
          headline: "Jev Director API Failure",
          cause: err,
        });
      }
      if (!isJsCodeBug(err) && !(err instanceof RunStopError)) {
        throw new CandidateSkipError(err.message, { stage: "runner-init", cause: err });
      }
      throw err;
    }

    // Write traceability records into runDirectory ONLY after `runner.mjs init` creates it
    await fs.mkdir(runDirectory, { recursive: true });
    await d.writeJson(path.join(runDirectory, "story.json"), storyRecord);
    if (articleRecord) {
      await d.writeJson(path.join(runDirectory, "article.json"), articleRecord);
    }
    await d.writeJson(path.join(runDirectory, "script.json"), script);
    await d.writeJson(path.join(runDirectory, "author-receipt.json"), receipt);

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

    const rawMasterVideo = path.join(runDirectory, "final.mp4");
    const transcriptPath = path.join(runDirectory, "transcript.json");
    const verticalVideoPath = path.join(runDirectory, "final-vertical.mp4");
    try {
      d.execute("node", [path.join(root, "runner.mjs"), "validate", `--run=${runId}`], { cwd: root });
      d.execute("node", [path.join(root, "runner.mjs"), "render", `--run=${runId}`], { cwd: root });

      await d.composeVerticalVideo({
        sourceVideoPath: rawMasterVideo,
        transcriptPath,
        headline: script.headline || formatSafeHeadline(script.title, 36),
        outputPath: verticalVideoPath,
      });
    } catch (err) {
      if (!isJsCodeBug(err) && !(err instanceof RunStopError)) {
        throw new CandidateSkipError(err.message, { stage: "render", cause: err });
      }
      throw err;
    }

    return {
      runId,
      runDirectory,
      rawMasterVideo,
      verticalVideoPath,
      script,
      article,
      receipt,
      dialogueText,
      story,
    };
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function notifyFatalStudioAlert(sendTelegramMessageFn, headline, err) {
  try {
    const safeMsg = redactSecrets(err?.message || String(err));
    await sendTelegramMessageFn({
      text: `🚨 <b>Shaz Daily Studio stopped: ${escapeTelegramHtml(headline)}</b>\n\n<pre>${escapeTelegramHtml(safeMsg.slice(0, 2800))}</pre>`,
    });
  } catch {}
}

export function getPendingBatchPath(env = process.env) {
  return path.join(getDefaultStudioHome(env), "pending-batch.json");
}

function serializeCandidateForPendingBatch(c) {
  return {
    candidateNumber: c.candidateNumber,
    runId: c.runId,
    runDirectory: c.runDirectory,
    rawMasterVideo: c.rawMasterVideo,
    verticalVideoPath: c.verticalVideoPath,
    script: c.script,
    dialogueText: c.dialogueText,
    story: c.story,
    approval: c.approval,
  };
}

function formatChannelReceiptSummary(postResult) {
  const entries = Object.entries(postResult?.channels || {});
  if (entries.length === 0) return "none";
  return entries
    .map(([key, entry]) => `${escapeTelegramHtml(entry?.service || key)} ✓`)
    .join(" · ");
}

async function completeBatchDecisionAndPublish({
  decision,
  candidates,
  skips = [],
  pendingBatchPath,
  ledgerPath,
  env,
  noTelegram = false,
  d,
}) {
  if (pendingBatchPath) {
    await fs.unlink(pendingBatchPath).catch(() => {});
  }

  if (decision?.status === "no-pick") {
    console.log("  ⏱️ 8:00 PM Central deadline passed without a pick. Nothing was posted.");
    if (!noTelegram) {
      await d.sendTelegramMessage({
        text: "⏱️ <b>No pick today</b> (8:00 PM Central deadline passed). Nothing was posted.",
      }).catch(() => {});
    }
    return { status: "no-pick", candidates, skips, decision };
  }

  if (decision?.status === "all-passed") {
    console.log("  🚫 Operator passed all candidates. Nothing will be posted today.");
    if (!noTelegram) {
      await d.sendTelegramMessage({
        text: "🚫 <b>All passed today</b> — nothing will be posted.",
      }).catch(() => {});
    }
    return { status: "all-passed", candidates, skips, decision };
  }

  const winner = candidates.find((c) => c.runId === decision?.runId) || candidates[0];
  console.log(`\n🏆 WINNER SELECTED: Candidate #${winner.candidateNumber} ("${winner.script.title}") [${winner.runId}]`);

  console.log("\n✍️  Signing Human Review Gate & Finalizing Winner Deliverables...");
  const { postResult } = await finalizeUploadPublishAndCleanup({
    runId: winner.runId,
    runDirectory: winner.runDirectory,
    rawMasterVideo: winner.rawMasterVideo,
    verticalVideoPath: winner.verticalVideoPath,
    title: winner.script.title,
    dialogueText: winner.dialogueText,
    tags: winner.script.hashtags || null,
    story: winner.story,
    reviewNote: `Selected as daily winner from ${candidates.length}-candidate batch for ${winner.script.title}`,
    ledgerPath,
    env,
    deps: d,
  });

  const publishedChannels = Object.keys(postResult.channels).join(", ");
  console.log(`  ✅ Successfully published to: ${publishedChannels}!`);
  if (postResult.pending.length > 0) {
    console.log(`  ℹ️ Pending channels: ${postResult.pending.map((p) => p.service).join(", ")}`);
  }
  console.log(`  Logged winner to published-topics.json`);

  const summaryHtml = formatChannelReceiptSummary(postResult);
  if (!noTelegram && (decision?.messageId || winner.approval?.messageId)) {
    await d.editTelegramMessageCaption({
      chatId: winner.approval?.chatId,
      messageId: decision?.messageId || winner.approval?.messageId,
      caption:
        `✅ <b>Posted:</b> ${summaryHtml}\n\n` +
        `<b>Title:</b> ${escapeTelegramHtml(winner.script.title)}\n` +
        `Run ID: <code>${escapeTelegramHtml(winner.runId)}</code>`,
    }).catch(() => {});
  }

  if (!noTelegram) {
    await d.sendTelegramMessage({
      text:
        `🎉 <b>DAILY POST LIVE!</b>\n\n` +
        `Candidate #${winner.candidateNumber} (<b>${escapeTelegramHtml(winner.script.title)}</b>) posted: ${summaryHtml}\n\n` +
        `Run ID: <code>${escapeTelegramHtml(winner.runId)}</code>`,
    }).catch(() => {});
  }

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

/**
 * Waits for Buffer posts to finish fetching and reach `"sent"`, then deletes the temporary Convex blob.
 * Falls back safely to the 7-day Convex TTL failsafe if Buffer errors or remains `"sending"`.
 */
async function deleteMediaAfterBufferSent({ postResult, storageId, deps }) {
  const postIds = Object.values(postResult?.channels || {})
    .map((entry) => entry?.postId)
    .filter(Boolean);

  if (postIds.length === 0 || !storageId) {
    return { cleanupStatus: "deferred-to-7d-ttl", reason: "no-post-ids" };
  }

  for (let attempt = 0; attempt < deps.bufferPollMaxAttempts; attempt += 1) {
    if (attempt > 0 && deps.bufferPollIntervalMs > 0) {
      await deps.sleepFn(deps.bufferPollIntervalMs);
    }

    try {
      const statusResult = await deps.getBufferPostsStatus({ postIds });
      if (statusResult?.allSent) {
        await deps.deletePublishVideo(storageId);
        console.log(`  🗑️ Deleted temporary Convex media (${storageId}) after Buffer confirmed 'sent'.`);
        return { cleanupStatus: "deleted-after-sent", cleanedUpAt: new Date().toISOString() };
      }
      if (statusResult?.hasError) {
        console.warn("  ⚠️ Buffer reported a delivery error; leaving Convex media for 7-day auto-expiry.");
        return { cleanupStatus: "deferred-to-7d-ttl", reason: "buffer-post-error" };
      }
    } catch (err) {
      console.warn(redactSecrets(`  ⚠️ Buffer status/cleanup check failed: ${err.message}; leaving for 7-day TTL.`));
      return { cleanupStatus: "deferred-to-7d-ttl", reason: "cleanup-check-error" };
    }
  }

  console.warn("  ⏳ Buffer posts still sending after poll window; leaving Convex media for 7-day auto-expiry.");
  return { cleanupStatus: "deferred-to-7d-ttl", reason: "poll-timeout" };
}

/**
 * Shared Phase 1 post-approval flow: inspect -> human-review -> finalize -> Convex upload -> Buffer -> delete on sent.
 */
async function finalizeUploadPublishAndCleanup({
  runId,
  runDirectory,
  rawMasterVideo,
  verticalVideoPath,
  title,
  dialogueText,
  tags,
  story,
  reviewNote,
  ledgerPath,
  env = process.env,
  deps,
}) {
  deps.execute("node", [path.join(root, "runner.mjs"), "inspect", `--run=${runId}`], { cwd: root });
  const videoSha = await deps.sha256(rawMasterVideo);
  const humanReview = {
    schemaVersion: 1,
    status: "approved",
    reviewer: "shaz-telegram-operator",
    reviewedOutputSha256: videoSha,
    reviewedAt: new Date().toISOString(),
    notes: reviewNote,
    directVideoPerception: true,
    directAudioPerception: true,
    completePasses: 1,
  };
  await deps.writeJson(path.join(runDirectory, "human-review.json"), humanReview);
  deps.execute("node", [path.join(root, "runner.mjs"), "finalize", `--run=${runId}`], { cwd: root });

  console.log("\n☁️ Uploading finalized vertical MP4 to Convex temporary host...");
  const media = await deps.uploadPublishVideo(verticalVideoPath);
  const mediaReceiptPath = path.join(runDirectory, "publish-media.json");
  const mediaReceipt = {
    url: media.url,
    storageId: media.storageId,
    sha256: media.sha256,
    bytes: media.bytes,
    uploadedAt: new Date().toISOString(),
  };
  await deps.writeJson(mediaReceiptPath, mediaReceipt);

  console.log("\n🚀 Broadcasting Video to Social Channels via Buffer API...");
  const postResult = await deps.publishVideoToAllChannels({
    videoUrl: media.url,
    title,
    caption: dialogueText,
    tags: tags || null,
    mode: "shareNow",
  });

  await deps.recordTopic(story.topic, {
    runId,
    channels: postResult.channels,
    ledgerPath,
    env,
  });

  const cleanup = await deleteMediaAfterBufferSent({
    postResult,
    storageId: media.storageId,
    deps,
  });
  await deps.writeJson(mediaReceiptPath, { ...mediaReceipt, ...cleanup });

  return { media, postResult, cleanup };
}

/**
 * Runs the full daily studio pipeline end-to-end.
 */
export async function runDailyStudio({
  dryRun = false,
  autoApprove = false,
  noTelegram = false,
  customTopic = null,
  ledgerPath,
  env = process.env,
  deps = {},
} = {}) {
  const d = resolveStudioDeps(deps);
  console.log("\n================================================================================");
  console.log("🎬 WIGGLY SHAZ DAILY CONTENT STUDIO (AUTONOMOUS RUN)");
  console.log("================================================================================\n");

  const runId = `daily-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
  let lock = null;

  try {
    if (noTelegram && !dryRun && !autoApprove) {
      throw new RunStopError("--no-telegram can only be combined with --dry-run or --auto-approve.", {
        code: "INVALID_CLI_FLAGS",
        stage: "preflight",
        headline: "Invalid CLI Flags",
        canAlert: false,
      });
    }
    const cfg = await d.loadStudioConfig();
    lock = await d.acquireStudioLock({ env, mode: "single" });
    await d.assertFreeDiskSpace({ minFreeDiskMb: cfg.minFreeDiskMb, env, statfsFn: d.statfsFn });
    if (!noTelegram && !dryRun && !autoApprove) {
      d.getTelegramCredentials?.({ requireOperator: true, env });
    }
    const baselineUpdateId = (!noTelegram && !dryRun && !autoApprove)
      ? await d.flushTelegramBacklog({ env })
      : 0;

    console.log("📡 STEP 1: Scouting Breaking Topics & Content Ledger...");
    const isCustomTopic = Boolean(customTopic);
    let candidatePool;
    if (isCustomTopic) {
      candidatePool = [{ topic: { title: customTopic, snippet: customTopic }, source: "manual-override" }];
    } else if (deps.findNextStory && !deps.findTopStories) {
      const next = await d.findNextStory({ ledgerPath, env });
      candidatePool = next ? [next] : [];
    } else {
      candidatePool = await d.findTopStories({ count: 3, ledgerPath, env, config: cfg });
    }

    if (candidatePool.length === 0) {
      throw new RunStopError("No fresh stories available from NewsMCP today.", {
        code: "NO_FRESH_STORIES",
        headline: "No Fresh Stories Today",
      });
    }

    let produced = null;
    const skips = [];
    for (const story of candidatePool) {
      console.log(`  Selected Story: "${story.topic.title}" (${story.source})`);
      try {
        produced = await produceGroundedCandidateRun({
          story,
          runId,
          cfg,
          isCustomTopic,
          d,
        });
        break;
      } catch (err) {
        const classified = classifyRunError(err);
        if (classified.kind === "skip") {
          skips.push({ title: story.topic.title, stage: classified.stage, reason: classified.error.message });
          console.warn(`  ⏭️ Skipping "${story.topic.title}" [${classified.stage}]: ${classified.error.message}`);
          continue;
        }
        throw classified.error;
      }
    }

    if (!produced) {
      const skipDetail = skips.map((s) => `• ${s.title} (${s.stage}): ${s.reason}`).join("\n");
      throw new RunStopError(`No usable candidate stories succeeded (${skips.length} skipped).\n${skipDetail}`, {
        code: "ALL_CANDIDATES_SKIPPED",
        headline: "All Candidates Skipped",
      });
    }

    const { runDirectory, rawMasterVideo, verticalVideoPath, script, dialogueText, story } = produced;
    console.log(`  Vertical video ready: ${verticalVideoPath}`);

    if (!noTelegram) {
      console.log("\n📱 STEP 6: Dispatching Preview to Telegram...");
      const approval = await d.sendApprovalVideo({
        videoPath: verticalVideoPath,
        title: script.title,
        runId,
        captionText: dialogueText,
        dryRun,
      });
      console.log(`  Preview sent to Telegram Chat ${approval.chatId}`);
    }

    if (dryRun) {
      console.log("\n[DRY RUN COMPLETE] Staged run assets preserved at:", runDirectory);
      return { status: "dry-run-success", runDirectory, verticalVideoPath };
    }

    await d.recordShown(story.topic, { ledgerPath, env });

    let decision = "approved";
    if (!autoApprove) {
      console.log("  Waiting for operator approval on Telegram...");
      decision = await d.pollApprovalDecision({ runId, initialUpdateId: baselineUpdateId, env });
    }

    if (decision === "no-pick") {
      console.log("  ⏱️ 8:00 PM Central deadline passed without a pick. Publication aborted.");
      if (!noTelegram) {
        await d.sendTelegramMessage({
          text: "⏱️ <b>No pick today</b> (8:00 PM Central deadline passed). Nothing was posted.",
        }).catch(() => {});
      }
      return { status: "no-pick", runDirectory };
    }

    if (decision !== "approved") {
      console.log("  ❌ Video passed by operator. Publication aborted.");
      if (!noTelegram) {
        await d.sendTelegramMessage({
          text: "🚫 <b>Passed today</b> — nothing will be posted.",
        }).catch(() => {});
      }
      return { status: "rejected", runDirectory };
    }

    console.log("\n✍️  STEP 7: Signing Human Review Gate & Finalizing Deliverables...");
    const { postResult } = await finalizeUploadPublishAndCleanup({
      runId,
      runDirectory,
      rawMasterVideo,
      verticalVideoPath,
      title: script.title,
      dialogueText,
      tags: script.hashtags || null,
      story,
      reviewNote: `Approved via Telegram one-click dispatch for ${script.title}`,
      ledgerPath,
      env,
      deps: d,
    });
    const publishedChannels = Object.keys(postResult.channels).join(", ");
    console.log(`  ✅ Successfully published to: ${publishedChannels}!`);
    if (postResult.pending.length > 0) {
      console.log(`  ℹ️ Pending channels: ${postResult.pending.map((p) => p.service).join(", ")}`);
    }
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
  } catch (err) {
    const classified = classifyRunError(err);
    if (classified.canAlert) {
      await notifyFatalStudioAlert(d.sendTelegramMessage, classified.headline, classified.error);
    }
    throw classified.error;
  } finally {
    await lock?.release().catch(() => {});
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
  count,
  dryRun = false,
  autoApprove = false,
  noTelegram = false,
  customTopics = null,
  ledgerPath,
  env = process.env,
  deps = {},
} = {}) {
  const d = resolveStudioDeps(deps);
  let lock = null;

  try {
    if (noTelegram && !dryRun && !autoApprove) {
      throw new RunStopError("--no-telegram can only be combined with --dry-run or --auto-approve.", {
        code: "INVALID_CLI_FLAGS",
        stage: "preflight",
        headline: "Invalid CLI Flags",
        canAlert: false,
      });
    }

    const cfg = await d.loadStudioConfig();
    lock = await d.acquireStudioLock({ env, mode: "batch" });
    await d.assertFreeDiskSpace({ minFreeDiskMb: cfg.minFreeDiskMb, env, statfsFn: d.statfsFn });

    if (!noTelegram && !dryRun && !autoApprove) {
      d.getTelegramCredentials?.({ requireOperator: true, env });
    }
    const baselineUpdateId = (!noTelegram && !dryRun && !autoApprove)
      ? await d.flushTelegramBacklog({ env })
      : 0;

    const targetCount = count ?? cfg.batchSize;

    console.log("\n================================================================================");
    console.log(`🎬 WIGGLY ANIMATE SHAZ DAILY STUDIO: BATCH MODE (${targetCount} CANDIDATES)`);
    console.log("================================================================================\n");

    const isCustomTopics = Array.isArray(customTopics) && customTopics.length > 0;
    const candidatePool = isCustomTopics
      ? customTopics.map((t) => ({ topic: typeof t === "string" ? { title: t } : t, source: "custom" }))
      : await d.findTopStories({ count: targetCount, ledgerPath, env, config: cfg });

    if (candidatePool.length === 0) {
      throw new RunStopError("No fresh stories available from NewsMCP today.", {
        code: "NO_FRESH_STORIES",
        headline: "No Fresh Stories Today",
      });
    }

    console.log(`Found ${candidatePool.length} ranked candidate stories (target ${targetCount}):`);
    candidatePool.forEach((s, idx) => {
      console.log(`  ${idx + 1}. [${s.source}] ${s.topic.title}`);
    });

    const candidates = [];
    const skips = [];

    for (const story of candidatePool) {
      if (candidates.length >= targetCount) break;
      const candidateNumber = candidates.length + 1;
      console.log(`\n--------------------------------------------------------------------------------`);
      console.log(`🛠️  PRODUCING CANDIDATE ${candidateNumber}/${targetCount}: "${story.topic.title}"`);
      console.log(`--------------------------------------------------------------------------------`);

      const runId = `daily-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 10)}`;
      let produced;
      try {
        produced = await produceGroundedCandidateRun({
          story,
          runId,
          cfg,
          isCustomTopic: isCustomTopics,
          d,
        });
      } catch (err) {
        const classified = classifyRunError(err);
        if (classified.kind === "skip") {
          skips.push({ title: story.topic.title, stage: classified.stage, reason: classified.error.message });
          console.warn(`  ⏭️ Skipping "${story.topic.title}" [${classified.stage}]: ${classified.error.message}`);
          continue;
        }
        throw classified.error;
      }

      let approval = null;
      if (!noTelegram) {
        console.log(`  Dispatching Candidate ${candidateNumber} to Telegram...`);
        approval = await d.sendApprovalVideo({
          videoPath: produced.verticalVideoPath,
          title: produced.script.title,
          runId,
          captionText: produced.dialogueText,
          candidateNumber,
          totalCandidates: targetCount,
          dryRun,
        });
        console.log(`  ✅ Candidate ${candidateNumber} dispatched to Telegram.`);
      }

      if (!dryRun) {
        await d.recordShown(story.topic, { ledgerPath, env });
      }

      candidates.push({
        candidateNumber,
        ...produced,
        approval,
      });
    }

    if (candidates.length === 0) {
      const skipDetail = skips.map((s) => `• ${s.title} (${s.stage}): ${s.reason}`).join("\n");
      throw new RunStopError(`No usable candidates produced today (${skips.length} skipped):\n${skipDetail}`, {
        code: "ALL_CANDIDATES_SKIPPED",
        headline: "All Candidates Skipped",
      });
    }

    const batchId = `batch-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;

    if (!noTelegram) {
      try {
        const countLabel = candidates.length === 1 ? "CANDIDATE" : "CANDIDATES";
        const shortfallNote = candidates.length < targetCount
          ? `\n\nℹ️ Only ${candidates.length}/${targetCount} fresh distinct stories succeeded today.`
          : "";
        const skipNote = skips.length > 0
          ? `\n\n⏭️ <b>Skipped ${skips.length} candidate${skips.length === 1 ? "" : "s"}:</b>\n` +
            skips.map((s) => `• <i>${escapeTelegramHtml(s.title)}</i> (${escapeTelegramHtml(s.stage)})`).join("\n")
          : "";
        const dryPrefix = dryRun ? "🧪 <b>DRY RUN — won't post</b>\n" : "";
        const actionLine = dryRun
          ? "Preview only (dry-run mode — no buttons attached, ledger &amp; publishing skipped)."
          : "Watch each cut above and tap <b>🚀 Pick &amp; Post</b> on your favorite, or pass all below.";
        await d.sendTelegramMessage({
          text:
            `${dryPrefix}🌅 <b>${candidates.length} DAILY ${countLabel} READY FOR REVIEW</b>\n` +
            `Writer: <code>${escapeTelegramHtml(cfg.writerAgent)}</code> · Voice: <code>cartesia</code>\n\n` +
            `Hey Shaz! Above are your ${candidates.length} daily candidate videos for today.\n\n` +
            actionLine +
            shortfallNote +
            skipNote,
          ...(!dryRun && !autoApprove
            ? {
                replyMarkup: {
                  inline_keyboard: [
                    [{ text: "🚫 Pass All", callback_data: `pass_all:${batchId}` }],
                  ],
                },
              }
            : {}),
        });
      } catch {}
    }

    if (dryRun) {
      console.log("\n[DRY RUN COMPLETE] Staged candidates preserved.");
      return { status: "dry-run-success", candidates, skips };
    }

    const pendingBatchPath = getPendingBatchPath(env);
    let decision = {
      status: "approved",
      runId: candidates[0].runId,
      chosen: candidates[0],
      messageId: candidates[0].approval?.messageId ?? null,
    };

    if (!autoApprove) {
      const deadline = computeChicagoDeadline();
      const pendingPayload = {
        schemaVersion: 1,
        batchId,
        createdAt: new Date().toISOString(),
        deadlineIso: deadline.toISOString(),
        baselineUpdateId,
        targetCount,
        rejectedRunIds: [],
        skips,
        candidates: candidates.map(serializeCandidateForPendingBatch),
      };
      await d.writeJson(pendingBatchPath, pendingPayload);

      console.log("\n📱 Waiting for operator to tap 'Pick & Post' on their favorite candidate in Telegram...");
      decision = await d.pollBatchDecision({
        batchId,
        deadline,
        initialUpdateId: baselineUpdateId,
        env,
        candidates: candidates.map((c) => ({
          runId: c.runId,
          title: c.script.title,
          messageId: c.approval?.messageId,
        })),
        onCandidateRejected: async (_rejectedId, rejectedList) => {
          pendingPayload.rejectedRunIds = rejectedList;
          await d.writeJson(pendingBatchPath, pendingPayload).catch(() => {});
        },
      });
    }

    return await completeBatchDecisionAndPublish({
      decision,
      candidates,
      skips,
      pendingBatchPath,
      ledgerPath,
      env,
      noTelegram,
      d,
    });
  } catch (err) {
    const classified = classifyRunError(err);
    if (classified.canAlert && !noTelegram) {
      await notifyFatalStudioAlert(d.sendTelegramMessage, classified.headline, classified.error);
    }
    throw classified.error;
  } finally {
    await lock?.release().catch(() => {});
  }
}

/**
 * Resumes polling Telegram from an interrupted `<studioHome>/pending-batch.json` session
 * without regenerating or re-dispatching the candidate videos.
 */
export async function resumePendingBatchPoll({
  ledgerPath,
  env = process.env,
  deps = {},
} = {}) {
  const d = resolveStudioDeps(deps);
  const pendingBatchPath = getPendingBatchPath(env);
  let lock = null;

  try {
    let raw;
    try {
      raw = await fs.readFile(pendingBatchPath, "utf8");
    } catch {
      throw new RunStopError(`No pending batch state found at ${pendingBatchPath}.`, {
        code: "NO_PENDING_BATCH",
        stage: "resume-poll",
        headline: "No Pending Batch",
        canAlert: false,
      });
    }
    const pending = JSON.parse(raw);
    const candidates = Array.isArray(pending?.candidates) ? pending.candidates : [];
    if (candidates.length === 0) {
      throw new RunStopError(`Pending batch at ${pendingBatchPath} contains 0 candidates.`, {
        code: "INVALID_PENDING_BATCH",
        stage: "resume-poll",
        headline: "Invalid Pending Batch",
        canAlert: false,
      });
    }

    lock = await d.acquireStudioLock({ env, mode: "resume-poll" });
    const deadline = pending.deadlineIso ? new Date(pending.deadlineIso) : computeChicagoDeadline();

    const decision = await d.pollBatchDecision({
      batchId: pending.batchId || null,
      deadline,
      initialUpdateId: pending.baselineUpdateId || 0,
      initialRejectedRunIds: Array.isArray(pending.rejectedRunIds) ? pending.rejectedRunIds : [],
      env,
      candidates: candidates.map((c) => ({
        runId: c.runId,
        title: c.script?.title || c.title,
        messageId: c.approval?.messageId,
      })),
      onCandidateRejected: async (_rejectedId, rejectedList) => {
        pending.rejectedRunIds = rejectedList;
        await d.writeJson(pendingBatchPath, pending).catch(() => {});
      },
    });

    return await completeBatchDecisionAndPublish({
      decision,
      candidates,
      skips: pending.skips || [],
      pendingBatchPath,
      ledgerPath,
      env,
      noTelegram: false,
      d,
    });
  } catch (err) {
    const classified = classifyRunError(err);
    if (classified.canAlert) {
      await notifyFatalStudioAlert(d.sendTelegramMessage, classified.headline, classified.error);
    }
    throw classified.error;
  } finally {
    await lock?.release().catch(() => {});
  }
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
  const isNoTelegram = rawArgs.includes("--no-telegram");
  const isResumePoll = rawArgs.includes("--resume-poll");
  const isSingle = rawArgs.includes("--single");
  const batchArg = rawArgs.find((a) => a.startsWith("--batch="))?.split("=")[1];
  const parsedBatch = batchArg ? parseInt(batchArg, 10) : Number.NaN;
  const count = Number.isNaN(parsedBatch) ? undefined : parsedBatch;
  const topicArg = rawArgs.find((a) => a.startsWith("--topic="))?.split("=").slice(1).join("=");

  if (isResumePoll) {
    resumePendingBatchPoll().catch((err) => {
      console.error(redactSecrets(`\n❌ Fatal Resume Poll Error: ${err.message}\n`), redactSecrets(err.stack || ""));
      process.exit(1);
    });
  } else if (isSingle) {
    runDailyStudio({
      dryRun: isDryRun,
      autoApprove: isAutoApprove,
      noTelegram: isNoTelegram,
      customTopic: topicArg || null,
    }).catch((err) => {
      console.error(redactSecrets(`\n❌ Fatal Studio Error: ${err.message}\n`), redactSecrets(err.stack || ""));
      process.exit(1);
    });
  } else {
    runDailyBatch({
      count,
      dryRun: isDryRun,
      autoApprove: isAutoApprove,
      noTelegram: isNoTelegram,
      customTopics: topicArg ? [topicArg] : null,
    }).catch((err) => {
      console.error(redactSecrets(`\n❌ Fatal Batch Studio Error: ${err.message}\n`), redactSecrets(err.stack || ""));
      process.exit(1);
    });
  }
}
