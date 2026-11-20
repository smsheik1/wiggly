import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  AgentOutputError,
  AgentUnavailableError,
  askActiveAgent,
} from "../../v3/lib/agent-bridge.ts";
import { findSecretsEnvPath, getSecretKey, redactSecrets } from "./secrets.mjs";

const STUDIO_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(STUDIO_DIR, "../..");
const DEFAULT_NEWSMCP_QUERY = "playstation OR xbox OR nintendo OR steam OR video game";

/**
 * Story areas (Shaz decision 2026-11-20): games plus 4 new areas, max 2 stories per area,
 * max 1 story per game/franchise/company, and only stories with real conflict.
 * No single franchise name (e.g. "gta") is hard-coded into a search.
 */
export const STORY_AREAS = Object.freeze([
  { id: "games", label: "Games industry", query: DEFAULT_NEWSMCP_QUERY },
  { id: "indie-weird", label: "Indie & weird game news", query: "indie game OR game mod OR speedrun OR viral game OR game developer" },
  { id: "tech", label: "Tech & gadgets", query: "apple OR samsung OR google OR gadget OR smartphone OR AI" },
  { id: "creators", label: "Internet & creator culture", query: "youtuber OR streamer OR tiktok OR twitch OR influencer" },
  { id: "animation", label: "Animation & movies", query: "pixar OR disney OR anime OR animated movie OR box office" },
]);
export const MAX_PER_AREA = 2;
export const MAX_PER_FRANCHISE = 1;

/**
 * Fetches one pool across all story areas. Each event is tagged with the first area that found it.
 * A failing area is reported loudly (Rule 12); the run only stops if EVERY area fails.
 */
export async function fetchStoryPool({ areas = STORY_AREAS, perAreaLimit = 8, fetchEventsFn, ...opts } = {}) {
  const fetchFn = fetchEventsFn || fetchNewsMcpEvents;
  const results = await Promise.allSettled(
    areas.map((area) => fetchFn({ ...opts, query: area.query, limit: perAreaLimit })),
  );
  const pool = new Map();
  const failures = [];
  results.forEach((r, i) => {
    const area = areas[i];
    if (r.status === "rejected") {
      failures.push(`${area.id}: ${r.reason?.message || r.reason}`);
      return;
    }
    for (const evt of r.value || []) {
      if (!pool.has(evt.eventId)) pool.set(evt.eventId, { ...evt, area: area.id });
    }
  });
  if (failures.length === areas.length) {
    throw new NewsMcpError(`Every NewsMCP area search failed:\n${failures.join("\n")}`);
  }
  if (failures.length) console.warn(`  ⚠️ NewsMCP: ${failures.length} area search(es) failed: ${failures.join(" | ")}`);
  return { events: [...pool.values()], calls: areas.length, failures };
}

function normalizeFranchise(value) {
  const v = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return v === "" || v === "none" || v === "n a" ? null : v;
}

/** Keeps the picker's order but enforces the area and franchise caps. Returns { kept, dropped }. */
export function enforceStoryMix(picks, { maxPerArea = MAX_PER_AREA, maxPerFranchise = MAX_PER_FRANCHISE } = {}) {
  const perArea = new Map();
  const perFranchise = new Map();
  const kept = [];
  const dropped = [];
  for (const pick of picks) {
    const area = pick.area || pick.topic?.area || "games";
    const franchise = normalizeFranchise(pick.franchise);
    if ((perArea.get(area) || 0) >= maxPerArea) {
      dropped.push({ pick, reason: `already ${maxPerArea} stories from "${area}"` });
      continue;
    }
    if (franchise && (perFranchise.get(franchise) || 0) >= maxPerFranchise) {
      dropped.push({ pick, reason: `already a story about "${franchise}"` });
      continue;
    }
    perArea.set(area, (perArea.get(area) || 0) + 1);
    if (franchise) perFranchise.set(franchise, (perFranchise.get(franchise) || 0) + 1);
    kept.push(pick);
  }
  return { kept, dropped };
}

export class NewsMcpError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "NewsMcpError";
  }
}

function buildMissingKeyMessage() {
  const secretsLocation = findSecretsEnvPath() || path.join(REPO_ROOT, "secrets.env");
  return (
    `NEWSMCP_API_KEY is missing from environment and ${secretsLocation} (Wiggly Rule 12).\n` +
    `Fix steps:\n` +
    `1. Open https://newsmcp.com in your browser and sign in to your NewsMCP dashboard.\n` +
    `2. Copy your API key from Account / API Keys.\n` +
    `3. Open ${secretsLocation}\n` +
    `4. Add or update the line: NEWSMCP_API_KEY=<paste your key here>`
  );
}

/**
 * Fetches curated breaking news events strictly from NewsMCP, failing loudly on missing keys or API errors.
 */
export async function fetchNewsMcpEvents({
  query = DEFAULT_NEWSMCP_QUERY,
  limit = 15,
  apiKey = null,
  env = process.env,
  secretsPath,
  fetchFn = fetch,
  timeoutMs = 15_000,
} = {}) {
  const key = (apiKey && String(apiKey).trim()) || getSecretKey("NEWSMCP_API_KEY", { env, secretsPath });
  if (!key) {
    throw new NewsMcpError(buildMissingKeyMessage());
  }

  const url = `https://api.newsmcp.com/v0/news?q=${encodeURIComponent(query)}&limit=${limit}`;
  let response;
  try {
    response = await fetchFn(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new NewsMcpError(
      redactSecrets(
        `NewsMCP request failed before receiving a response (${err.message}). Check network connectivity and https://newsmcp.com status.`,
        [key],
      ),
      { cause: err },
    );
  }

  if (!response.ok) {
    const bodyText = redactSecrets((await response.text().catch(() => "")).slice(0, 300), [key]);
    const secretsLocation = findSecretsEnvPath() || path.join(REPO_ROOT, "secrets.env");
    throw new NewsMcpError(
      `NewsMCP returned HTTP ${response.status} ${response.statusText || ""} for ${url}.${bodyText ? ` Body: ${bodyText}` : ""}\n` +
      `Fix steps:\n` +
      `1. Open https://newsmcp.com and check API key status / monthly quota.\n` +
      `2. Refresh NEWSMCP_API_KEY in ${secretsLocation} if expired or revoked.`,
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new NewsMcpError(`NewsMCP returned invalid JSON from ${url}: ${err.message}`, { cause: err });
  }

  if (!data || !Array.isArray(data.events)) {
    throw new NewsMcpError(`NewsMCP returned malformed payload (missing 'events' array) from ${url}.`);
  }

  return data.events.map((evt, index) => {
    const eventId = String(evt?.event_id || evt?.eventId || "").trim();
    const title = String(evt?.headline || "").trim();
    if (!eventId || !title) {
      throw new NewsMcpError(
        `NewsMCP event at index ${index} is missing required 'event_id' or 'headline'.`,
      );
    }
    const sources = Array.isArray(evt?.sources)
      ? evt.sources.map((src) => String(src || "").trim()).filter(Boolean)
      : [];
    return {
      eventId,
      title,
      snippet: String(evt?.abstract || "").trim(),
      link: sources[0] || "",
      sources,
      source: "newsmcp",
      newsrooms: evt?.newsrooms || evt?.source_count || 1,
      publishedAt: evt?.last_seen || evt?.first_seen || null,
    };
  });
}

function buildPickPrompt({ candidates, recentPublishedTitles, maxPicks, previousError = null }) {
  const candidateBlock = candidates.map((c, idx) => ({
    rankHint: idx + 1,
    eventId: c.eventId,
    headline: c.title,
    abstract: c.snippet,
    area: c.area || null,
    publishedAt: c.publishedAt,
    newsrooms: c.newsrooms,
  }));

  const recentBlock = recentPublishedTitles.length > 0
    ? recentPublishedTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(none)";

  const areaBlock = STORY_AREAS.map((a) => `- ${a.id}: ${a.label}`).join("\n");
  return (
    `You are the executive producer for Shaz, a cartoon gamer who roasts the games, tech and internet industry on YouTube Shorts, Reels and TikTok. His videos only work when the story has a fight in it.\n\n` +
    `TASK: Select and rank up to ${maxPicks} DISTINCT news stories from the candidate pool below.\n` +
    `RULES:\n` +
    `1. CONFLICT IS REQUIRED. Pick only stories with a clear "someone vs someone": a company vs its fans, a boss vs workers, a price hike, a ban, a backlash, a feud, a lawsuit, a flop, a ridiculous decision. In "conflict", name both sides in one sentence. A milestone, a review, a benchmark, a spec comparison, a release date or a "how to" has NO conflict: skip it.\n` +
    `2. A CASUAL VIEWER MUST GET IT IN ONE SENTENCE. Skip stories that need tech terms or niche lore to explain.\n` +
    `3. ONE STORY PER GAME, FRANCHISE OR COMPANY TOPIC. Three different GTA stories are three picks of the same thing: keep only the best one. In "franchise", name the game/franchise/company it's about (or "none").\n` +
    `4. MIX THE AREAS. At most ${MAX_PER_AREA} picks from the same area. Areas:\n${areaBlock}\n` +
    `5. Never pick two headlines about the same real-world event, or a story already covered in RECENTLY PUBLISHED TITLES.\n` +
    `6. Rank the funniest, most relatable fight first. Use ONLY exact eventId values from CANDIDATES. If nothing has real conflict, return { "picks": [] }.\n\n` +
    `RECENTLY PUBLISHED TITLES (avoid repeating these stories):\n${recentBlock}\n\n` +
    `CANDIDATES:\n${JSON.stringify(candidateBlock, null, 2)}\n\n` +
    (previousError ? `PREVIOUS ATTEMPT FAILED VALIDATION — FIX THIS EXACT ERROR:\n${previousError}\n\n` : "") +
    `Respond ONLY with valid JSON matching:\n` +
    `{\n  "picks": [\n    { "eventId": "<exact candidate eventId>", "area": "<area id>", "franchise": "<game/franchise/company or none>", "conflict": "<who vs who, one sentence>", "reason": "<why it's funny for Shaz, one sentence>" }\n  ]\n}`
  );
}

/**
 * Invokes the pinned operating agent to rank distinct non-duplicate events from filtered NewsMCP candidates.
 */
export async function pickDistinctEvents({
  candidates,
  recentPublishedTitles = [],
  maxPicks = 9,
  writerAgent = "agy",
  timeoutMs = 600_000,
  askAgentFn = askActiveAgent,
  maxAttempts = 2,
} = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  const byEventId = new Map(candidates.map((c) => [c.eventId, c]));
  const cappedMax = Math.min(candidates.length, Math.max(1, maxPicks));
  let previousError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const prompt = buildPickPrompt({
      candidates,
      recentPublishedTitles,
      maxPicks: cappedMax,
      previousError,
    });

    let response;
    try {
      response = await askAgentFn(prompt, {
        agent: writerAgent,
        timeoutMs,
        requireJson: true,
      });
    } catch (err) {
      if (err instanceof AgentUnavailableError) {
        throw err;
      }
      if (err instanceof AgentOutputError && attempt < maxAttempts) {
        previousError = err.message;
        continue;
      }
      throw err;
    }

    const picks = response?.picks;
    if (!Array.isArray(picks)) {
      const msg = "Expected 'picks' array in JSON response.";
      if (attempt < maxAttempts) {
        previousError = msg;
        continue;
      }
      throw new AgentOutputError(`Event selection validation failed: ${msg}`, JSON.stringify(response));
    }

    if (picks.length === 0) {
      return [];
    }

    const seen = new Set();
    let validationError = null;
    const selected = [];
    for (const item of picks) {
      const id = String(item?.eventId || "").trim();
      if (!id || !byEventId.has(id)) {
        validationError = `Unknown eventId '${id}' — every pick must use an exact candidate eventId.`;
        break;
      }
      if (seen.has(id)) {
        validationError = `Duplicate eventId '${id}' — every pick must be unique.`;
        break;
      }
      const conflict = String(item?.conflict || "").trim();
      if (conflict.length < 10) {
        validationError = `Pick '${id}' has no "conflict" (who vs who). Skip stories without a real fight.`;
        break;
      }
      seen.add(id);
      const topic = byEventId.get(id);
      const area = STORY_AREAS.some((a) => a.id === item?.area) ? item.area : topic.area || "games";
      selected.push({
        topic: { ...topic, area },
        area,
        franchise: String(item?.franchise || "none").trim(),
        conflict,
        source: `newsmcp (${topic.newsrooms} newsrooms)`,
        pickReason: String(item?.reason || "").trim(),
      });
    }

    if (validationError) {
      if (attempt < maxAttempts) {
        previousError = validationError;
        continue;
      }
      throw new AgentOutputError(`Event selection validation failed: ${validationError}`, JSON.stringify(response));
    }

    const { kept, dropped } = enforceStoryMix(selected);
    for (const d of dropped) {
      console.log(`  ↪︎ Story mix: dropped "${d.pick.topic.title}" (${d.reason}).`);
    }
    return kept.slice(0, cappedMax);
  }

  return [];
}
