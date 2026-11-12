import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const STUDIO_DIR = path.dirname(fileURLToPath(import.meta.url));

export const LEGACY_LEDGER_PATH = path.resolve(
  STUDIO_DIR,
  "../../v3/public/format-repositories/shaz-puppet-runtime-v1/agent-runs/published-topics.json",
);

/**
 * Resolves the persistent external studio home directory, overridable via `WIGGLY_STUDIO_HOME`.
 */
export function getDefaultStudioHome(env = process.env) {
  const override = env?.WIGGLY_STUDIO_HOME?.trim();
  if (override) return path.resolve(override);
  return path.join(os.homedir(), ".wiggly", "shaz-daily-studio");
}

/**
 * Resolves the active v2 ledger path (`~/.wiggly/shaz-daily-studio/published-topics.json`).
 */
export function getDefaultLedgerPath(env = process.env) {
  return path.join(getDefaultStudioHome(env), "published-topics.json");
}

export const DEFAULT_LEDGER_PATH = getDefaultLedgerPath();

/**
 * Formats a timestamp as `YYYY-MM-DD` in `America/Chicago`.
 */
export function formatChicagoDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Collapses whitespace and lowercases a topic title for exact normalized comparison.
 */
export function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes an article URL string for exact link equality without altering query tokens.
 */
export function canonicalLink(link) {
  const raw = String(link || "").trim();
  if (!raw) return "";
  return raw;
}

function getTopicEventId(topic) {
  const id = String(topic?.eventId || topic?.event_id || "").trim();
  return id || null;
}

function upgradeEntryV1ToV2(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid ledger entry: expected an object.");
  }

  let published = null;
  if (raw.published && typeof raw.published === "object" && !Array.isArray(raw.published)) {
    published = {
      runId: raw.published.runId ?? null,
      at: raw.published.at ?? null,
      ...(raw.published.postId !== undefined ? { postId: raw.published.postId } : {}),
      ...(raw.published.channel !== undefined ? { channel: raw.published.channel } : {}),
      ...(raw.published.channels ? { channels: raw.published.channels } : {}),
    };
  } else if (raw.publishedAt || raw.runId || raw.channel || raw.channels || raw.postId != null) {
    published = {
      runId: raw.runId ?? null,
      at: raw.publishedAt ?? null,
      ...(raw.postId !== undefined ? { postId: raw.postId } : {}),
      ...(raw.channel !== undefined ? { channel: raw.channel } : {}),
      ...(raw.channels ? { channels: raw.channels } : {}),
    };
  }

  const shown = Array.isArray(raw.shown)
    ? Array.from(new Set(raw.shown.map((d) => String(d || "").trim()).filter(Boolean)))
    : [];

  return {
    eventId: getTopicEventId(raw),
    link: canonicalLink(raw.link) || null,
    title: String(raw.title || "").trim(),
    shown,
    published,
  };
}

function parseLedgerPayload(rawText, sourcePath) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `Corrupted topic ledger at ${sourcePath}: invalid JSON (${err.message}). Fix or restore from backup before running.`,
      { cause: err },
    );
  }

  if (Array.isArray(parsed)) {
    return {
      schemaVersion: 2,
      entries: parsed.map(upgradeEntryV1ToV2),
    };
  }

  if (
    parsed
    && typeof parsed === "object"
    && !Array.isArray(parsed)
    && Array.isArray(parsed.entries)
    && (parsed.schemaVersion === undefined || parsed.schemaVersion === 1 || parsed.schemaVersion === 2)
  ) {
    return {
      schemaVersion: 2,
      ...(parsed.migratedAt ? { migratedAt: parsed.migratedAt } : {}),
      entries: parsed.entries.map(upgradeEntryV1ToV2),
    };
  }

  throw new Error(
    `Malformed topic ledger schema at ${sourcePath}: expected v2 object { schemaVersion: 2, entries: [] } or legacy array.`,
  );
}

/**
 * Atomically writes a v2 ledger JSON file via same-directory temp file + rename.
 */
export async function writeLedgerAtomic(targetPath, ledger) {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = path.join(dir, `.published-topics.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`);
  const payload = {
    schemaVersion: 2,
    ...(ledger.migratedAt ? { migratedAt: ledger.migratedAt } : {}),
    entries: Array.isArray(ledger.entries) ? ledger.entries.map(upgradeEntryV1ToV2) : [],
  };
  await fs.writeFile(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, targetPath);
  return payload;
}

/**
 * One-time copy + v1->v2 upgrade when the external ledger file does not yet exist.
 * Leaves the legacy file untouched as a backup.
 */
export async function migrateLegacyLedgerIfNeeded({
  ledgerPath,
  legacyPath = LEGACY_LEDGER_PATH,
  env = process.env,
  quiet = false,
} = {}) {
  const targetPath = ledgerPath || getDefaultLedgerPath(env);
  try {
    await fs.access(targetPath);
    return null;
  } catch (err) {
    if (err?.code !== "ENOENT") {
      throw new Error(`Unable to inspect topic ledger path ${targetPath}: ${err.message}`, { cause: err });
    }
  }

  if (!legacyPath) return null;

  let legacyRaw;
  try {
    legacyRaw = await fs.readFile(legacyPath, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") {
      return null;
    }
    throw new Error(`Failed to read legacy ledger for migration at ${legacyPath}: ${err.message}`, { cause: err });
  }

  const upgraded = parseLedgerPayload(legacyRaw, legacyPath);
  upgraded.migratedAt = new Date().toISOString();
  await writeLedgerAtomic(targetPath, upgraded);
  if (!quiet) {
    console.log(
      `Migrated ledger v1 -> v2 (${upgraded.entries.length} entries) from ${legacyPath} to ${targetPath}; legacy file preserved as backup.`,
    );
  }
  return upgraded;
}

/**
 * Loads the v2 topic ledger, migrating legacy data once if reading the default external path.
 * Throws loudly on unreadable or corrupted files rather than silently returning an empty ledger.
 */
export async function loadLedger(
  ledgerPath,
  {
    env = process.env,
    legacyPath,
    migrate = ledgerPath == null || legacyPath !== undefined,
    quiet = false,
  } = {},
) {
  const targetPath = ledgerPath || getDefaultLedgerPath(env);

  let raw;
  try {
    raw = await fs.readFile(targetPath, "utf8");
  } catch (err) {
    if (err?.code !== "ENOENT") {
      throw new Error(`Failed to read topic ledger at ${targetPath}: ${err.message}`, { cause: err });
    }
    if (migrate) {
      const migrated = await migrateLegacyLedgerIfNeeded({
        ledgerPath: targetPath,
        legacyPath: legacyPath ?? LEGACY_LEDGER_PATH,
        env,
        quiet,
      });
      if (migrated) return migrated;
    }
    return { schemaVersion: 2, entries: [] };
  }

  return parseLedgerPayload(raw, targetPath);
}

/**
 * Finds the matching v2 entry by exact eventId, exact canonical link, or exact normalized title.
 */
export function findMatchingEntry(ledger, topic) {
  const entries = Array.isArray(ledger) ? ledger : ledger?.entries || [];
  const topicEventId = getTopicEventId(topic);
  if (topicEventId) {
    const byId = entries.find((entry) => entry.eventId && entry.eventId === topicEventId);
    if (byId) return byId;
  }

  const topicLink = canonicalLink(topic?.link);
  if (topicLink) {
    const byLink = entries.find((entry) => {
      const entryLink = canonicalLink(entry.link);
      return entryLink && entryLink === topicLink;
    });
    if (byLink) return byLink;
  }

  const topicTitle = normalizeTitle(topic?.title);
  if (topicTitle) {
    const byTitle = entries.find((entry) => {
      const entryTitle = normalizeTitle(entry.title);
      return entryTitle && entryTitle === topicTitle;
    });
    if (byTitle) return byTitle;
  }

  return null;
}

const CHICAGO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function nextChicagoDate(dateStr) {
  const match = CHICAGO_DATE_RE.exec(String(dateStr || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Stepping 24h from noon UTC preserves the next America/Chicago calendar date across DST shifts.
  return formatChicagoDate(new Date(Date.UTC(year, month - 1, day, 12, 0, 0) + 86_400_000));
}

/**
 * Determines whether a ledger entry may be shown again under Q5:
 * unpublished, and if shown once before, eligible only on the next America/Chicago calendar day.
 */
export function isEntryEligible(entry, { now = new Date(), date } = {}) {
  if (!entry) return true;
  if (entry.published) return false;
  if (!Array.isArray(entry.shown) || entry.shown.length === 0) return true;
  if (entry.shown.length >= 2) return false;

  const runDate = typeof date === "string" && CHICAGO_DATE_RE.test(date.trim())
    ? date.trim()
    : formatChicagoDate(now);
  return nextChicagoDate(entry.shown[0]) === runDate;
}

/**
 * Returns true if the candidate topic is already published or no longer eligible under Q5.
 */
export function isTopicCovered(topic, ledger, options = {}) {
  const matched = findMatchingEntry(ledger, topic);
  return matched ? !isEntryEligible(matched, options) : false;
}

/**
 * Filters a candidate list to events that remain eligible under the v2 ledger rules.
 */
export function filterFreshTopics(topics, ledger, options = {}) {
  return topics.filter((topic) => !isTopicCovered(topic, ledger, options));
}

/**
 * Returns up to `limit` most recent published topic titles (newest first) for duplicate-event screening.
 */
export function getRecentPublishedTitles(ledger, limit = 30) {
  const entries = Array.isArray(ledger) ? ledger : ledger?.entries || [];
  return entries
    .map((entry, idx) => ({
      entry,
      idx,
      ts: entry?.published?.at ? Date.parse(entry.published.at) : Number.NaN,
    }))
    .filter(({ entry }) => Boolean(entry?.published && typeof entry.title === "string" && entry.title.trim()))
    .sort((a, b) => {
      const aValid = Number.isFinite(a.ts);
      const bValid = Number.isFinite(b.ts);
      if (aValid && bValid && b.ts !== a.ts) return b.ts - a.ts;
      if (aValid !== bValid) return bValid ? 1 : -1;
      return b.idx - a.idx;
    })
    .slice(0, limit)
    .map(({ entry }) => entry.title.trim());
}

function upsertEntry(ledger, topic) {
  const existing = findMatchingEntry(ledger, topic);
  const topicEventId = getTopicEventId(topic);
  const topicLink = canonicalLink(topic?.link) || null;
  const topicTitle = String(topic?.title || "").trim();

  if (existing) {
    if (!existing.eventId && topicEventId) existing.eventId = topicEventId;
    if (!existing.link && topicLink) existing.link = topicLink;
    if (!existing.title && topicTitle) existing.title = topicTitle;
    return existing;
  }

  const created = {
    eventId: topicEventId,
    link: topicLink,
    title: topicTitle,
    shown: [],
    published: null,
  };
  ledger.entries.push(created);
  return created;
}

/**
 * Records a live Telegram appearance date (`America/Chicago` `YYYY-MM-DD`) for an unpicked candidate.
 */
export async function recordShown(
  topic,
  {
    date,
    now = new Date(),
    ledgerPath,
    env = process.env,
    legacyPath,
    quiet = true,
  } = {},
) {
  const targetPath = ledgerPath || getDefaultLedgerPath(env);
  const ledger = await loadLedger(ledgerPath, { env, legacyPath, quiet });
  const day = date || formatChicagoDate(now);
  const entry = upsertEntry(ledger, topic);
  if (!entry.shown.includes(day)) {
    entry.shown.push(day);
  }
  return writeLedgerAtomic(targetPath, ledger);
}

/**
 * Records a winning published topic in the v2 ledger, preserving all Buffer channel results.
 */
export async function recordTopic(
  topic,
  {
    runId = null,
    postId = null,
    channel = null,
    channels = null,
    publishedAt,
    ledgerPath,
    env = process.env,
    legacyPath,
    quiet = true,
  } = {},
) {
  const targetPath = ledgerPath || getDefaultLedgerPath(env);
  const ledger = await loadLedger(ledgerPath, { env, legacyPath, quiet });
  const entry = upsertEntry(ledger, topic);

  let resolvedPostId = postId;
  if (!resolvedPostId && channels && typeof channels === "object") {
    for (const ch of Object.values(channels)) {
      if (ch && ch.postId) {
        resolvedPostId = ch.postId;
        break;
      }
    }
  }

  let resolvedChannel = channel;
  if (!resolvedChannel && channels && typeof channels === "object") {
    const names = Object.keys(channels);
    if (names.length > 0) {
      resolvedChannel = names.join(",");
    }
  }

  entry.published = {
    runId,
    at: publishedAt || new Date().toISOString(),
    postId: resolvedPostId ?? null,
    channel: resolvedChannel ?? null,
    ...(channels ? { channels } : {}),
  };

  return writeLedgerAtomic(targetPath, ledger);
}
