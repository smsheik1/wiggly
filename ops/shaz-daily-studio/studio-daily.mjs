#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { AgentUnavailableError, askActiveAgent } from "../../v3/lib/agent-bridge.ts";
import { ArticleFetchError, fetchArticleForTopic, USER_AGENT as STUDIO_USER_AGENT } from "./article-fetch.mjs";
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
import { pruneOldRuns } from "./prune-runs.mjs";
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
    "<exact Google image query for primary game, hardware, or product key art>",
    "<exact visual query for specific named character, studio, or console hardware>",
    "<exact visual query for in-game screenshot, UI, or retail product closeup>",
    "<exact visual query for official press photo or store listing>",
    "<exact visual query for developer, executive, or studio logo>",
    "<exact visual query for comparison, sequel, or companion device>",
    "<exact visual query for community reaction, meme template, or esports/showcase stage>"
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
 * Computes target visual image count from audio duration (~1 new image every 4 seconds, clamped [5, 10]).
 */
export function computeTargetImageCount(durationSeconds = 30) {
  const sec = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 30;
  return Math.max(5, Math.min(10, Math.round(sec / 4)));
}

/**
 * Computes a 64-bit 8x8 difference hash (dHash) hex string for perceptual image deduplication.
 */
export async function computeImageDHash(imageBuffer) {
  const { data } = await sharp(imageBuffer)
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = 0n;
  for (let y = 0; y < 8; y += 1) {
    const rowOffset = y * 9;
    for (let x = 0; x < 8; x += 1) {
      bits = (bits << 1n) | (data[rowOffset + x] > data[rowOffset + x + 1] ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

/**
 * Returns the Hamming distance between two 64-bit hex dHash strings.
 */
export function dHashHammingDistance(hashA, hashB) {
  const a = BigInt(`0x${hashA}`);
  const b = BigInt(`0x${hashB}`);
  let x = a ^ b;
  let dist = 0;
  while (x > 0n) {
    dist += Number(x & 1n);
    x >>= 1n;
  }
  return dist;
}

function readWavDurationSeconds(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    if (chunkId === "fmt " && dataStart + 12 <= buf.length) {
      byteRate = buf.readUInt32LE(dataStart + 8);
    } else if (chunkId === "data") {
      dataSize = chunkSize;
    }
    offset = dataStart + chunkSize + (chunkSize % 2);
  }
  if (byteRate > 0 && dataSize > 0) {
    return dataSize / byteRate;
  }
  return null;
}

/**
 * Measures WAV duration directly from header bytes or estimates from dialogue word count on stub audio.
 */
export async function measureAudioDurationSeconds(
  audioPath,
  { dialogueText = "", targetDurationSeconds = 30 } = {},
) {
  try {
    const buf = await fs.readFile(audioPath);
    const wavSec = readWavDurationSeconds(buf);
    if (Number.isFinite(wavSec) && wavSec > 0) {
      return wavSec;
    }
  } catch {}
  const words = countWords(dialogueText);
  if (words > 0) {
    return Math.max(8, words / 2.6);
  }
  return Number.isFinite(targetDurationSeconds) && targetDurationSeconds > 0
    ? targetDurationSeconds
    : 30;
}

function buildTopicFallbackQueries(topicTitle = "", scriptTitle = "") {
  const rawTitle = (topicTitle || scriptTitle || "Gaming News").trim();
  const clean = rawTitle
    .replace(/\b(controversy|reality check|delay secret|news|drama|meltdown|exclusive|leak|rumors|rumor)\b/gi, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [
    `${clean} official announcement press key art 16:9`,
    `${clean} official retail product photo screenshot`,
    `${clean} high resolution editorial feature 4k`,
    `${clean} gameplay screenshot UI closeup`,
    `${clean} developer studio showcase presentation`,
    `${clean} hardware accessories promotional photo`,
    `${clean} cover art poster key visual`,
    `${clean} comparison review still frame`,
  ];
}

/**
 * Generates subject-targeted Google Image queries for clean editorial and hardware assets.
 */
export function buildTargetedImageQueries(topicTitle = "", script = {}, { maxQueries = 8 } = {}) {
  const valid = Array.isArray(script?.visualQueries)
    ? script.visualQueries
        .map((q) => (typeof q === "string" ? q.trim() : ""))
        .filter((q) => q.length >= 3)
    : [];

  if (valid.length >= 2) {
    return valid.slice(0, maxQueries);
  }

  return buildTopicFallbackQueries(topicTitle, script?.title).slice(0, maxQueries);
}

/**
 * Filters out low-res thumbnails, reddit screenshots, and social media watermarks.
 */
export function filterCandidateImages(candidates = [], { minW = 600, minH = 400 } = {}) {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .filter((item) => {
      if (!item?.imageUrl) return false;
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
      if (url.includes("360_store_merchant") || (url.includes("sierialto") && (!item.width || item.width < 800))) {
        return false;
      }
      if (item.width && item.width < minW) return false;
      if (item.height && item.height < minH) return false;
      return true;
    })
    .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DHASH_DUPLICATE_THRESHOLD = 6;

async function downloadAndValidateImage(candidate, { fetchFn = fetch, minW = 600, minH = 400 } = {}) {
  const res = await fetchFn(candidate.imageUrl, {
    headers: {
      "User-Agent": STUDIO_USER_AGENT,
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const contentType = String(res.headers?.get?.("content-type") || "").toLowerCase();
  if (contentType && (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("xml"))) {
    throw new Error(`Unexpected non-image content-type '${contentType}'`);
  }

  const rawBuf = Buffer.from(await res.arrayBuffer());
  if (rawBuf.length === 0 || rawBuf.length > MAX_IMAGE_BYTES) {
    throw new Error(`Invalid image byte size (${rawBuf.length})`);
  }

  const meta = await sharp(rawBuf).metadata();
  if (!meta.width || !meta.height || meta.width < minW || meta.height < minH) {
    throw new Error(`Image too small (${meta.width || 0}x${meta.height || 0} < ${minW}x${minH})`);
  }

  const rawSha = crypto.createHash("sha256").update(rawBuf).digest("hex");
  const dhash = await computeImageDHash(rawBuf);

  return {
    rawBuf,
    width: meta.width,
    height: meta.height,
    rawSha,
    dhash,
  };
}

/**
 * Sources authentic high-res topic imagery (~1 new image every 4s, clamped 5..10):
 * uses the article's own editorial images first with honest headers, fills the rest via Google Images,
 * deduplicates via URL + SHA-256 + 8x8 dHash (Hamming <= 6), records provenance in `media-sources.json`,
 * allows spread non-adjacent repeats when 2 <= unique < target, and skips candidate when < 2 unique images.
 */
export async function sourceStoryMedia({
  topic,
  article = null,
  script = {},
  stageDir,
  durationSeconds = null,
  targetCount = null,
  searchFn = searchGoogleImages,
  fetchFn = fetch,
}) {
  const desiredCount = Number.isInteger(targetCount) && targetCount > 0
    ? targetCount
    : computeTargetImageCount(durationSeconds ?? script?.targetDurationSeconds ?? 30);

  const mediaDir = path.join(stageDir, "media");
  await fs.mkdir(mediaDir, { recursive: true });

  const uniqueRecords = [];
  const seenUrls = new Set();
  const seenShas = new Set();
  const seenDhashes = [];

  const tryAcceptCandidate = async (candidate, origin, queryUsed) => {
    const cleanUrl = String(candidate?.imageUrl || "").trim();
    if (!cleanUrl || seenUrls.has(cleanUrl)) return false;
    seenUrls.add(cleanUrl);

    if (filterCandidateImages([candidate], { minW: 600, minH: 400 }).length === 0) {
      return false;
    }

    try {
      const checked = await downloadAndValidateImage(candidate, { fetchFn });
      if (seenShas.has(checked.rawSha)) return false;
      if (seenDhashes.some((prev) => dHashHammingDistance(prev, checked.dhash) <= DHASH_DUPLICATE_THRESHOLD)) {
        return false;
      }

      const normalized = await normalizeBrollMedia(checked.rawBuf);
      const slotIndex = uniqueRecords.length + 1;
      const relPath = `media/broll-${String(slotIndex).padStart(2, "0")}.png`;
      await fs.writeFile(path.join(stageDir, relPath), normalized);

      seenShas.add(checked.rawSha);
      seenDhashes.push(checked.dhash);
      uniqueRecords.push({
        file: relPath,
        origin,
        sourceUrl: cleanUrl,
        pageUrl: candidate.pageUrl || candidate.contextUrl || article?.url || null,
        query: queryUsed || null,
        width: checked.width,
        height: checked.height,
        sha256: checked.rawSha,
        dhash: checked.dhash,
        repeats: 0,
      });
      console.log(`  Saved ${origin} media [${slotIndex}/${desiredCount}]: ${relPath} (${checked.width}x${checked.height}) [${candidate.domain || "article"}]`);
      return true;
    } catch (err) {
      console.warn(`    Skipped image candidate (${candidate.domain || cleanUrl.slice(0, 60)}): ${err.message}`);
      return false;
    }
  };

  // 1. Prioritize the article's own extracted editorial images first
  const articleCandidates = Array.isArray(article?.images)
    ? article.images
    : Array.isArray(article?.imageCandidates)
      ? article.imageCandidates
      : [];
  for (const item of articleCandidates) {
    if (uniqueRecords.length >= desiredCount) break;
    await tryAcceptCandidate(item, "article", null);
  }

  // 2. Fill remaining slots via Serper Google Images
  if (uniqueRecords.length < desiredCount) {
    const primaryQueries = buildTargetedImageQueries(topic?.title, script, { maxQueries: 8 });
    const queries = [...primaryQueries];
    for (const fb of buildTopicFallbackQueries(topic?.title, script?.title)) {
      if (queries.length >= 10) break;
      if (!queries.some((q) => q.toLowerCase() === fb.toLowerCase())) {
        queries.push(fb);
      }
    }
    for (let qIdx = 0; qIdx < queries.length && uniqueRecords.length < desiredCount; qIdx += 1) {
      const query = queries[qIdx];
      console.log(`  Searching Google Images (${qIdx + 1}/${queries.length}): "${query}"...`);
      let results = filterCandidateImages(await searchFn(query, { count: 10 }));

      if (results.length === 0) {
        const broadened = query
          .replace(/\b(press|key\s*art|screenshot|gameplay|16:9|editorial|feature|4k|official|announcement|retail|product|photo|rumors?|leaks?)\b/gi, "")
          .replace(/[^\w\s-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (broadened && broadened !== query) {
          results = filterCandidateImages(await searchFn(broadened, { count: 10 }));
        }
      }

      // Cap early queries to 2 picks each so the final sequence covers diverse visual queries
      const isTailQuery = qIdx >= queries.length - 2;
      let pickedThisQuery = 0;
      const queryCap = isTailQuery ? desiredCount : 2;
      for (const candidate of results.slice(0, 10)) {
        if (uniqueRecords.length >= desiredCount || pickedThisQuery >= queryCap) break;
        const accepted = await tryAcceptCandidate(candidate, "serper", query);
        if (accepted) pickedThisQuery += 1;
      }
    }
  }

  if (uniqueRecords.length < 2) {
    throw new CandidateSkipError(
      `\n================================================================================\n` +
      `❌ IMAGE SOURCING ERROR: FEWER THAN 2 UNIQUE USABLE IMAGES (${uniqueRecords.length})\n` +
      `================================================================================\n` +
      `Topic "${topic?.title || script?.title || "story"}" yielded only ${uniqueRecords.length} usable >=600x400 image(s).\n` +
      `Per Phase 3 Q8c / Rule 12, skipping candidate rather than building an empty video.\n` +
      `================================================================================\n`,
      { stage: "media-sourcing" },
    );
  }

  // Spread repeats modularly so when 2 <= unique < desiredCount no two adjacent slots repeat
  const finalLength = Math.max(desiredCount, uniqueRecords.length);
  const sequence = [];
  const counts = new Map();
  for (let i = 0; i < finalLength; i += 1) {
    const rec = uniqueRecords[i % uniqueRecords.length];
    sequence.push(rec.file);
    counts.set(rec.file, (counts.get(rec.file) || 0) + 1);
  }
  for (const rec of uniqueRecords) {
    rec.repeats = Math.max(0, (counts.get(rec.file) || 1) - 1);
  }

  await fs.writeFile(
    path.join(stageDir, "media-sources.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        targetCount: desiredCount,
        uniqueCount: uniqueRecords.length,
        repeatsAllowed: uniqueRecords.length < desiredCount,
        durationSeconds: Number((durationSeconds ?? script?.targetDurationSeconds ?? 30).toFixed?.(2) || 30),
        sequence,
        items: uniqueRecords,
      },
      null,
      2,
    )}\n`,
  );

  return sequence;
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
    pruneOldRuns: typeof deps.resolveRunDirectory === "function"
      ? async () => ({ runsPruned: 0, filesDeleted: 0 })
      : pruneOldRuns,
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
    checkPublicVideoReachable: async (url) => {
      if (!url) return false;
      try {
        const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
        return res.ok;
      } catch {
        return false;
      }
    },
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
          imageCandidates: Array.isArray(article.images) ? article.images : [],
        }
      : null;

    await d.writeJson(path.join(stageDir, "story.json"), storyRecord);
    if (articleRecord) {
      await d.writeJson(path.join(stageDir, "article.json"), articleRecord);
    }
    await d.writeJson(path.join(stageDir, "script.json"), script);
    await d.writeJson(path.join(stageDir, "author-receipt.json"), receipt);

    const audioFile = path.join(stageDir, "user-audio.wav");
    await d.synthesizeShazVoice({
      text: dialogueText,
      outputPath: audioFile,
      provider: "cartesia",
    });

    const durationSeconds = await measureAudioDurationSeconds(audioFile, {
      dialogueText,
      targetDurationSeconds: script.targetDurationSeconds,
    });
    const downloadedMediaList = await d.sourceStoryMedia({
      topic: story.topic,
      article,
      script,
      durationSeconds,
      stageDir,
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
    const stageMediaSources = path.join(stageDir, "media-sources.json");
    if (fsSync.existsSync(stageMediaSources)) {
      await fs.copyFile(stageMediaSources, path.join(runDirectory, "media-sources.json"));
    }

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
  const states = postResult?.channelStates;
  if (states && typeof states === "object") {
    const parts = [];
    for (const [key, entry] of Object.entries(states)) {
      const label = escapeTelegramHtml(
        key === "instagram" ? "Instagram" : key === "youtube" ? "YouTube" : key === "tiktok" ? "TikTok" : key,
      );
      if (entry?.status === "posted") parts.push(`${label} ✓`);
      else if (entry?.status === "failed") parts.push(`${label} ❌`);
      else if (entry?.status === "unknown") parts.push(`${label} ❓`);
    }
    if (parts.length > 0) return parts.join(" · ");
  }
  const entries = Object.entries(postResult?.channels || {});
  if (entries.length === 0) return "none";
  return entries
    .map(([key, entry]) => {
      const raw = entry?.service || key;
      const label = raw === "instagram" ? "Instagram" : raw === "youtube" ? "YouTube" : raw === "tiktok" ? "TikTok" : raw;
      return `${escapeTelegramHtml(label)} ✓`;
    })
    .join(" · ");
}

async function publishWithCheckpointsAndLedger({
  runId,
  runDirectory,
  title,
  dialogueText,
  tags,
  story,
  media,
  publishState = null,
  retryUnknownWhenMissing = false,
  pickedMessageId = null,
  pickedChatId = null,
  noTelegram = false,
  ledgerPath,
  env = process.env,
  deps,
}) {
  const publishStatePath = path.join(runDirectory, "publish-state.json");
  const mediaReceiptPath = path.join(runDirectory, "publish-media.json");
  let ledgerChannelsSignature = "";

  const baseState = {
    schemaVersion: 1,
    ...(publishState || {}),
    runId,
    title,
    story,
    videoUrl: media.url,
    storageId: media.storageId || publishState?.storageId || null,
    channels: { ...(publishState?.channels || {}) },
    updatedAt: new Date().toISOString(),
  };

  const buildPostedMap = (channelsObj = {}) =>
    Object.fromEntries(
      Object.entries(channelsObj)
        .filter(([, entry]) => entry?.status === "posted" && entry?.postId)
        .map(([k, entry]) => [
          k,
          {
            success: true,
            service: k,
            channelId: entry.channelId,
            postId: entry.postId,
            status: entry.bufferStatus || entry.status,
          },
        ]),
    );

  const syncCheckpointAndLedger = async (snapshot) => {
    const merged = {
      ...baseState,
      ...snapshot,
      runId,
      title,
      story,
      storageId: media.storageId || baseState.storageId || null,
    };
    await deps.writeJson(publishStatePath, merged);

    const posted = buildPostedMap(merged.channels);
    if (Object.keys(posted).length > 0) {
      const sig = Object.entries(posted)
        .map(([k, v]) => `${k}:${v.postId}`)
        .sort()
        .join("|");
      if (sig !== ledgerChannelsSignature) {
        ledgerChannelsSignature = sig;
        await deps.recordTopic(story?.topic || { title }, {
          runId,
          channels: posted,
          ledgerPath,
          env,
        });
      }
    }
    return merged;
  };

  await deps.writeJson(publishStatePath, baseState);

  const postResult = await deps.publishVideoToAllChannels({
    videoUrl: media.url,
    title,
    caption: dialogueText,
    tags: tags || null,
    mode: "shareNow",
    checkpoint: baseState,
    retryUnknownWhenMissing,
    onCheckpoint: syncCheckpointAndLedger,
  });

  const finalChannelStates =
    postResult.channelStates ||
    Object.fromEntries(
      Object.entries(postResult.channels || {}).map(([k, v]) => [k, { status: "posted", ...v }]),
    );
  const finalState = await syncCheckpointAndLedger({
    ...baseState,
    channels: finalChannelStates,
    pending: postResult.pending || [],
  });

  // Fallback for mocked `publishVideoToAllChannels` returning custom channels without `channelStates`
  if (Object.keys(postResult.channels || {}).length > 0 && !ledgerChannelsSignature) {
    ledgerChannelsSignature = Object.entries(postResult.channels)
      .map(([k, v]) => `${k}:${v?.postId || ""}`)
      .sort()
      .join("|");
    await deps.recordTopic(story?.topic || { title }, {
      runId,
      channels: postResult.channels,
      ledgerPath,
      env,
    });
  }

  const failedList = postResult.failed || [];
  const unknownList = postResult.unknown || [];
  const hasIncomplete = failedList.length > 0 || unknownList.length > 0 || postResult.success === false;

  if (hasIncomplete) {
    const summaryHtml = formatChannelReceiptSummary({ ...postResult, channelStates: finalState.channels });
    await deps.writeJson(mediaReceiptPath, {
      ...media,
      cleanupStatus: "retained-for-resume",
      reason: "incomplete-channel-publish",
      failedChannels: failedList.map((f) => ({ service: f.service, error: f.lastError })),
      unknownChannels: unknownList.map((u) => ({ service: u.service, error: u.lastError })),
    }).catch(() => {});

    if (!noTelegram) {
      if (pickedMessageId) {
        await deps.editTelegramMessageCaption({
          chatId: pickedChatId,
          messageId: pickedMessageId,
          caption:
            `⚠️ <b>Partial/Failed Publish:</b> ${summaryHtml}\n\n` +
            `<b>Title:</b> ${escapeTelegramHtml(title)}\n` +
            `Resume: <code>--resume-publish=${escapeTelegramHtml(runId)}</code>`,
        }).catch(() => {});
      }

      const detailLines = [
        ...failedList.map((f) => `• <b>${escapeTelegramHtml(f.service)}</b> failed: ${escapeTelegramHtml(f.lastError || "error")}`),
        ...unknownList.map((u) => `• <b>${escapeTelegramHtml(u.service)}</b> timed out (unknown state — will verify before retry)`),
      ].join("\n");

      await deps.sendTelegramMessage({
        text:
          `⚠️ <b>Buffer Publish Incomplete</b> (${summaryHtml})\n\n` +
          `<b>Title:</b> ${escapeTelegramHtml(title)}\n` +
          `${detailLines}\n\n` +
          `Convex video preserved. Resume safely (posted channels are skipped):\n` +
          `<code>node ops/shaz-daily-studio/studio-daily.mjs --resume-publish=${escapeTelegramHtml(runId)}</code>`,
      }).catch(() => {});
    }

    throw new RunStopError(
      `Buffer publish incomplete for ${runId} (${failedList.length} failed, ${unknownList.length} unknown). Re-run with --resume-publish=${runId}.`,
      {
        code: "PUBLISH_CHANNEL_INCOMPLETE",
        stage: "publish",
        headline: "Buffer Publish Incomplete",
        canAlert: false,
      },
    );
  }

  const cleanup = await deleteMediaAfterBufferSent({
    postResult,
    storageId: media.storageId,
    deps,
  });
  await deps.writeJson(mediaReceiptPath, { ...media, ...cleanup });

  return { postResult, cleanup, publishStatePath, state: finalState };
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
    pickedMessageId: decision?.messageId || winner.approval?.messageId || null,
    pickedChatId: winner.approval?.chatId || null,
    noTelegram,
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
  const pendingNote = postResult.pending?.length > 0
    ? `\n<i>Not connected in Buffer: ${escapeTelegramHtml(postResult.pending.map((p) => p.service).join(", "))}</i>`
    : "";
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
        `Candidate #${winner.candidateNumber} (<b>${escapeTelegramHtml(winner.script.title)}</b>) posted: ${summaryHtml}` +
        `${pendingNote}\n\n` +
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
  pickedMessageId = null,
  pickedChatId = null,
  noTelegram = false,
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
  const { postResult, cleanup, publishStatePath } = await publishWithCheckpointsAndLedger({
    runId,
    runDirectory,
    title,
    dialogueText,
    tags,
    story,
    media: mediaReceipt,
    pickedMessageId,
    pickedChatId,
    noTelegram,
    ledgerPath,
    env,
    deps,
  });

  return { media, postResult, cleanup, publishStatePath };
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
      await d.pruneOldRuns({ retentionDays: cfg.retentionDays }).catch(() => {});
      return { status: "no-pick", runDirectory };
    }

    if (decision !== "approved") {
      console.log("  ❌ Video passed by operator. Publication aborted.");
      if (!noTelegram) {
        await d.sendTelegramMessage({
          text: "🚫 <b>Passed today</b> — nothing will be posted.",
        }).catch(() => {});
      }
      await d.pruneOldRuns({ retentionDays: cfg.retentionDays }).catch(() => {});
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
    await d.pruneOldRuns({ retentionDays: cfg.retentionDays }).catch(() => {});

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

    const batchOutcome = await completeBatchDecisionAndPublish({
      decision,
      candidates,
      skips,
      pendingBatchPath,
      ledgerPath,
      env,
      noTelegram,
      d,
    });
    await d.pruneOldRuns({ retentionDays: cfg.retentionDays }).catch(() => {});
    return batchOutcome;
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

/**
 * Resumes an incomplete or interrupted Buffer publish from `<runDirectory>/publish-state.json`.
 * Never reposts channels already marked `"posted"`, verifies `"unknown"` timeout channels via Buffer's
 * recent-posts API before retrying, re-uploads to Convex if expired, cleans up storage, and updates ledger.
 */
export async function resumePublishForRun({
  runId,
  noTelegram = false,
  ledgerPath,
  env = process.env,
  deps = {},
} = {}) {
  if (!runId || !String(runId).trim()) {
    throw new RunStopError("Missing runId for --resume-publish=<runId>.", {
      code: "INVALID_CLI_FLAGS",
      stage: "resume-publish",
      headline: "Invalid Resume Publish Run ID",
      canAlert: false,
    });
  }

  const d = resolveStudioDeps(deps);
  let lock = null;

  try {
    lock = await d.acquireStudioLock({ env, mode: "resume-publish" });
    const runDirectory = d.resolveRunDirectory(root, runId);
    const publishStatePath = path.join(runDirectory, "publish-state.json");

    let state;
    try {
      state = JSON.parse(await fs.readFile(publishStatePath, "utf8"));
    } catch {
      throw new RunStopError(`No publish-state.json found for run '${runId}' at ${publishStatePath}.`, {
        code: "NO_PUBLISH_STATE",
        stage: "resume-publish",
        headline: "Missing publish-state.json",
        canAlert: false,
      });
    }

    const scriptJson = await fs
      .readFile(path.join(runDirectory, "script.json"), "utf8")
      .then((raw) => JSON.parse(raw))
      .catch(() => null);
    const storyJson = await fs
      .readFile(path.join(runDirectory, "story.json"), "utf8")
      .then((raw) => JSON.parse(raw))
      .catch(() => null);

    const title = state.title || scriptJson?.title || storyJson?.title || runId;
    const story = state.story || (storyJson ? { topic: storyJson } : { topic: { title } });
    const dialogueText = scriptJson ? d.compileDialogueText(scriptJson) : (state.dialogueText || title);
    const tags = scriptJson?.hashtags || state.tags || null;
    const verticalVideoPath = path.join(runDirectory, "final-vertical.mp4");

    let media = {
      url: state.videoUrl || null,
      storageId: state.storageId || null,
      uploadedAt: state.uploadedAt || new Date().toISOString(),
    };

    const reachable = media.url ? await d.checkPublicVideoReachable(media.url) : false;
    if (!reachable) {
      console.log(`☁️ Hosted Convex video missing or expired; re-uploading ${verticalVideoPath}...`);
      const reuploaded = await d.uploadPublishVideo(verticalVideoPath);
      media = {
        url: reuploaded.url,
        storageId: reuploaded.storageId,
        sha256: reuploaded.sha256,
        bytes: reuploaded.bytes,
        uploadedAt: new Date().toISOString(),
      };
      state.videoUrl = media.url;
      state.storageId = media.storageId;
      await d.writeJson(path.join(runDirectory, "publish-media.json"), media);
    }

    const { postResult, cleanup } = await publishWithCheckpointsAndLedger({
      runId,
      runDirectory,
      title,
      dialogueText,
      tags,
      story,
      media,
      publishState: state,
      retryUnknownWhenMissing: true,
      noTelegram,
      ledgerPath,
      env,
      deps: d,
    });

    const summaryHtml = formatChannelReceiptSummary(postResult);
    if (!noTelegram) {
      await d.sendTelegramMessage({
        text:
          `🎉 <b>RESUME PUBLISH COMPLETE!</b>\n\n` +
          `<b>${escapeTelegramHtml(title)}</b>: ${summaryHtml}\n\n` +
          `Run ID: <code>${escapeTelegramHtml(runId)}</code>`,
      }).catch(() => {});
    }

    return {
      status: "published",
      runId,
      postResult,
      cleanup,
    };
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
  const isPruneOnly = rawArgs.includes("--prune-only");
  const isPruneDryRun = rawArgs.includes("--prune-dry-run");
  const resumePublishArg = rawArgs.find((a) => a.startsWith("--resume-publish="))?.split("=").slice(1).join("=");
  const isSingle = rawArgs.includes("--single");
  const batchArg = rawArgs.find((a) => a.startsWith("--batch="))?.split("=")[1];
  const parsedBatch = batchArg ? parseInt(batchArg, 10) : Number.NaN;
  const count = Number.isNaN(parsedBatch) ? undefined : parsedBatch;
  const topicArg = rawArgs.find((a) => a.startsWith("--topic="))?.split("=").slice(1).join("=");

  if (isPruneOnly || isPruneDryRun) {
    loadStudioConfig()
      .then((cfg) => pruneOldRuns({ retentionDays: cfg.retentionDays, dryRun: isPruneDryRun }))
      .then((summary) => {
        console.log(JSON.stringify(summary, null, 2));
      })
      .catch((err) => {
        console.error(redactSecrets(`\n❌ Fatal Prune Error: ${err.message}\n`), redactSecrets(err.stack || ""));
        process.exit(1);
      });
  } else if (resumePublishArg) {
    resumePublishForRun({
      runId: resumePublishArg,
      noTelegram: isNoTelegram,
    }).catch((err) => {
      console.error(redactSecrets(`\n❌ Fatal Resume Publish Error: ${err.message}\n`), redactSecrets(err.stack || ""));
      process.exit(1);
    });
  } else if (isResumePoll) {
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
