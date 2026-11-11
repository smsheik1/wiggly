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
const DEFAULT_NEWSMCP_QUERY = "playstation OR xbox OR nintendo OR gta OR steam";

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
    publishedAt: c.publishedAt,
    newsrooms: c.newsrooms,
  }));

  const recentBlock = recentPublishedTitles.length > 0
    ? recentPublishedTitles.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "(none)";

  return (
    `You are the executive producer for Shaz's daily gaming & tech short-form video channel.\n\n` +
    `TASK: Select and rank up to ${maxPicks} DISTINCT real-world news events from the NewsMCP candidate pool below.\n` +
    `RULES:\n` +
    `1. Never pick two headlines describing the same real-world event (e.g., two different outlets reporting the exact same announcement or release date).\n` +
    `2. Do NOT pick any candidate covering the same real-world story as one of the recently published titles below.\n` +
    `3. Order picks from strongest/freshest/most punchy gaming or hardware commentary topic first so downstream retries have ranked backups.\n` +
    `4. Use ONLY exact eventId values present in CANDIDATES. Never repeat an eventId. If every candidate is a near-duplicate of RECENTLY PUBLISHED TITLES, return { "picks": [] }.\n\n` +
    `RECENTLY PUBLISHED TITLES (avoid repeating these events):\n${recentBlock}\n\n` +
    `CANDIDATES:\n${JSON.stringify(candidateBlock, null, 2)}\n\n` +
    (previousError ? `PREVIOUS ATTEMPT FAILED VALIDATION — FIX THIS EXACT ERROR:\n${previousError}\n\n` : "") +
    `Respond ONLY with valid JSON matching:\n` +
    `{\n  "picks": [\n    { "eventId": "<exact candidate eventId>", "reason": "<one concise sentence>" }\n  ]\n}`
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
      seen.add(id);
      const topic = byEventId.get(id);
      selected.push({
        topic,
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

    return selected.slice(0, cappedMax);
  }

  return [];
}
