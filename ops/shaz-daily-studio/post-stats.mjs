import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { executeBufferGraphQL, getBufferChannels } from "./buffer-publisher.mjs";
import { getDefaultLedgerPath, getDefaultStudioHome, loadLedger } from "./content-ledger.mjs";
import { redactSecrets } from "./secrets.mjs";

/**
 * Audience data loop: pulls how every published Shaz video is doing on each
 * channel (views, watch time, likes, ...) from Buffer and keeps it in
 * `~/.wiggly/shaz-daily-studio/post-stats.json`, next to whether Shaz picked
 * the video or it was auto-posted at the 8pm deadline. This is the record the
 * judge will learn from.
 */

const STUDIO_DIR = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_RUNS_DIR = path.resolve(
  STUDIO_DIR,
  "../../v3/public/format-repositories/shaz-puppet-runtime-v1/agent-runs",
);

export const POST_STATS_SCHEMA_VERSION = 1;
export const STATS_CHANNELS = Object.freeze(["tiktok", "instagram", "youtube"]);
export const METRIC_KEYS = Object.freeze([
  "views",
  "reach",
  "impressions",
  "likes",
  "reactions",
  "comments",
  "shares",
  "saves",
  "follows",
  "averageTimeWatched",
  "totalTimeWatched",
  "engagementRate",
]);

// A daily history point is kept at most every 20 hours, and only for 60 points.
export const SNAPSHOT_MIN_GAP_HOURS = 20;
export const SNAPSHOT_HISTORY_LIMIT = 60;
// Old ledger entries saved one post id. Its twins on the other channels went
// out within a few hours with nearly the same title.
export const TITLE_MATCH_WINDOW_HOURS = 6;
export const TITLE_MATCH_MIN_SIMILARITY = 0.5;

export function getDefaultPostStatsPath(env = process.env) {
  return path.join(getDefaultStudioHome(env), "post-stats.json");
}

/** Words of a post's first line, without hashtags, for title matching. */
export function titleWords(text) {
  const firstLine = String(text || "").split(/\r?\n/).find((line) => line.trim()) || "";
  return new Set(
    firstLine
      .toLowerCase()
      .replace(/#[\p{L}\p{N}_]+/gu, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
}

/** Share of words two titles have in common (0..1). */
export function titleSimilarity(a, b) {
  const wa = titleWords(a);
  const wb = titleWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / (wa.size + wb.size - shared);
}

/** Turns Buffer's `[{type, value}]` list into `{views: 12, ...}` with only known metrics. */
export function metricsToObject(metrics) {
  const out = {};
  for (const m of metrics || []) {
    if (METRIC_KEYS.includes(m?.type) && typeof m.value === "number" && Number.isFinite(m.value)) {
      out[m.type] = m.value;
    }
  }
  return out;
}

const CHANNEL_POSTS_QUERY = `query ChannelPostStats($input: PostsInput!, $first: Int, $after: String) {
  posts(input: $input, first: $first, after: $after) {
    edges {
      node {
        id
        status
        text
        sentAt
        externalLink
        metricsUpdatedAt
        metrics { type value }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

/**
 * Lists every sent post on one Buffer channel created since `sinceIso`, with metrics.
 */
export async function fetchChannelPosts({
  organizationId,
  channelId,
  sinceIso,
  graphql = executeBufferGraphQL,
  pageSize = 50,
  maxPages = 20,
}) {
  const posts = [];
  let after = null;
  for (let page = 0; page < maxPages; page += 1) {
    const data = await graphql({
      query: CHANNEL_POSTS_QUERY,
      variables: {
        input: {
          organizationId,
          filter: {
            channelIds: [channelId],
            ...(sinceIso ? { createdAt: { start: sinceIso } } : {}),
          },
        },
        first: pageSize,
        after,
      },
    });
    const conn = data?.posts;
    for (const edge of conn?.edges || []) {
      const node = edge?.node;
      if (node?.id && node.status === "sent") posts.push(node);
    }
    if (!conn?.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) return posts;
    after = conn.pageInfo.endCursor;
  }
  throw new Error(
    `Buffer returned more than ${maxPages * pageSize} posts for channel ${channelId}; ` +
      "raise maxPages in post-stats.mjs instead of silently cutting the stats short.",
  );
}

/**
 * Matches each published ledger entry to its post on every channel.
 *
 * `postsByChannel` is `{ tiktok: [post], instagram: [post], youtube: [post] }`.
 * Saved post ids win. Otherwise the twin is the post on that channel, sent
 * within TITLE_MATCH_WINDOW_HOURS, whose title is most alike. A post is never
 * given to two videos.
 */
export function matchPublishedPosts(publishedEntries, postsByChannel) {
  const byId = new Map();
  for (const [service, posts] of Object.entries(postsByChannel)) {
    for (const post of posts) byId.set(post.id, { ...post, service });
  }

  const claimed = new Set();
  const videos = publishedEntries.map((entry) => ({ entry, channels: {} }));

  // Pass 1: post ids the studio saved.
  for (const video of videos) {
    const pub = video.entry.published;
    const ids = new Set();
    for (const ch of Object.values(pub.channels || {})) if (ch?.postId) ids.add(ch.postId);
    if (pub.postId) ids.add(pub.postId);
    for (const id of ids) {
      const post = byId.get(id);
      if (!post || claimed.has(id) || video.channels[post.service]) continue;
      claimed.add(id);
      video.channels[post.service] = { post, matchedBy: "saved-id" };
    }
  }

  // Pass 2: title twins for channels still missing.
  for (const video of videos) {
    const anchors = Object.values(video.channels).map((c) => c.post.text);
    if (video.entry.title) anchors.push(video.entry.title);
    const publishedMs = Date.parse(video.entry.published.at);
    if (!Number.isFinite(publishedMs) || anchors.length === 0) continue;

    for (const service of Object.keys(postsByChannel)) {
      if (video.channels[service]) continue;
      let best = null;
      for (const post of postsByChannel[service]) {
        if (claimed.has(post.id)) continue;
        const sentMs = Date.parse(post.sentAt);
        if (!Number.isFinite(sentMs)) continue;
        if (Math.abs(sentMs - publishedMs) > TITLE_MATCH_WINDOW_HOURS * 3_600_000) continue;
        const score = Math.max(...anchors.map((a) => titleSimilarity(a, post.text)));
        if (score >= TITLE_MATCH_MIN_SIMILARITY && (!best || score > best.score)) {
          best = { post, score };
        }
      }
      if (best) {
        claimed.add(best.post.id);
        video.channels[service] = { post: { ...best.post, service }, matchedBy: "title-match" };
      }
    }
  }
  return videos;
}

/** Who chose the video: Shaz in Telegram, the 8pm auto-post, or unknown (older runs). */
export function pickedByFromDelivery(delivery) {
  switch (delivery?.mode) {
    case "telegram-pick":
      return "shaz";
    case "deadline-auto-pick":
      return "auto-8pm";
    case "auto-approve":
      return "auto-approve";
    default:
      return "unknown";
  }
}

function hoursBetween(fromIso, toIso) {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round(((b - a) / 3_600_000) * 10) / 10;
}

/**
 * Folds one fresh reading into a channel record: `latest` always moves,
 * `history` gains a point at most every SNAPSHOT_MIN_GAP_HOURS.
 */
export function mergeChannelReading(existing, reading) {
  const history = Array.isArray(existing?.history) ? [...existing.history] : [];
  const last = history[history.length - 1];
  const gap = last ? hoursBetween(last.at, reading.at) : null;
  if (!last || gap === null || gap >= SNAPSHOT_MIN_GAP_HOURS) {
    history.push(reading);
  }
  return {
    postId: reading.postId,
    link: reading.link,
    sentAt: reading.sentAt,
    matchedBy: reading.matchedBy,
    latest: reading,
    history: history.slice(-SNAPSHOT_HISTORY_LIMIT),
  };
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function writeJsonAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, file);
}

/**
 * Pulls fresh numbers from Buffer for every published video and saves them.
 * Any Buffer failure throws (no partial or made-up stats are written).
 */
export async function refreshPostStats({
  env = process.env,
  ledgerPath = getDefaultLedgerPath(env),
  statsPath = getDefaultPostStatsPath(env),
  runsDir = DEFAULT_RUNS_DIR,
  now = new Date(),
  deps = {},
} = {}) {
  const graphql = deps.executeBufferGraphQL || executeBufferGraphQL;
  const listChannels = deps.getBufferChannels || getBufferChannels;
  const readLedger = deps.loadLedger || ((p) => loadLedger(p));
  const readDelivery = deps.readDelivery
    || ((runId) => readJsonIfExists(path.join(runsDir, runId, "studio-delivery.json")));

  const ledger = await readLedger(ledgerPath);
  const published = (ledger?.entries || []).filter((e) => e?.published?.runId && e.published.at);
  const nowIso = now.toISOString();

  const previous = (await readJsonIfExists(statsPath)) || { videos: [] };
  const previousByRun = new Map((previous.videos || []).map((v) => [v.runId, v]));

  if (published.length === 0) {
    const empty = { schemaVersion: POST_STATS_SCHEMA_VERSION, updatedAt: nowIso, videos: previous.videos || [] };
    await writeJsonAtomic(statsPath, empty);
    return { stats: empty, unmatched: [] };
  }

  const earliestMs = Math.min(...published.map((e) => Date.parse(e.published.at)));
  const sinceIso = new Date(earliestMs - 24 * 3_600_000).toISOString();

  const { organization, channels } = await listChannels({});
  const postsByChannel = {};
  for (const service of STATS_CHANNELS) {
    const channel = channels.find((c) => c.service === service);
    if (!channel) {
      throw new Error(
        `Buffer has no ${service} channel connected, so its stats can't be read. ` +
          "Reconnect it at https://publish.buffer.com → Channels.",
      );
    }
    postsByChannel[service] = await fetchChannelPosts({
      organizationId: organization.id,
      channelId: channel.id,
      sinceIso,
      graphql,
    });
  }

  const matched = matchPublishedPosts(published, postsByChannel);
  const videos = [];
  const unmatched = [];
  for (const { entry, channels: found } of matched) {
    const runId = entry.published.runId;
    const before = previousByRun.get(runId);
    const delivery = await readDelivery(runId).catch(() => null);
    const pickedBy = delivery ? pickedByFromDelivery(delivery) : before?.pickedBy || "unknown";

    const channelRecords = { ...(before?.channels || {}) };
    for (const service of STATS_CHANNELS) {
      const hit = found[service];
      if (!hit) {
        if (!channelRecords[service]) unmatched.push({ runId, service });
        continue;
      }
      const reading = {
        at: nowIso,
        ageHours: hoursBetween(hit.post.sentAt, nowIso),
        postId: hit.post.id,
        link: hit.post.externalLink || null,
        sentAt: hit.post.sentAt,
        matchedBy: hit.matchedBy,
        buffersMetricsAt: hit.post.metricsUpdatedAt || null,
        metrics: metricsToObject(hit.post.metrics),
      };
      channelRecords[service] = mergeChannelReading(channelRecords[service], reading);
    }

    videos.push({
      runId,
      title: Object.values(found)[0]?.post.text?.split(/\r?\n/)[0]?.replace(/\s*#\S+/g, "").trim()
        || before?.title
        || entry.title,
      storyTitle: entry.title || null,
      storyLink: entry.link || null,
      publishedAt: entry.published.at,
      pickedBy,
      channels: channelRecords,
    });
  }

  videos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const stats = { schemaVersion: POST_STATS_SCHEMA_VERSION, updatedAt: nowIso, videos };
  await writeJsonAtomic(statsPath, stats);
  return { stats, unmatched };
}

function fmt(n, digits = 0) {
  if (typeof n !== "number") return "-";
  return digits ? n.toFixed(digits) : String(Math.round(n));
}

/** Plain-text table of every video: views and watch time per channel. */
export function formatScoreboard(stats) {
  const lines = [];
  lines.push("date        picked     tiktok views/avg s   insta views/avg s   youtube views   title");
  for (const v of stats.videos || []) {
    const t = v.channels.tiktok?.latest?.metrics || {};
    const i = v.channels.instagram?.latest?.metrics || {};
    const y = v.channels.youtube?.latest?.metrics || {};
    lines.push(
      [
        v.publishedAt.slice(0, 10),
        v.pickedBy.padEnd(10),
        `${fmt(t.views).padStart(6)} / ${fmt(t.averageTimeWatched, 1).padStart(5)}`.padEnd(20),
        `${fmt(i.views).padStart(6)} / ${fmt(i.averageTimeWatched, 1).padStart(5)}`.padEnd(19),
        fmt(y.views).padStart(8).padEnd(15),
        (v.title || "").slice(0, 60),
      ].join("  "),
    );
  }
  return lines.join("\n");
}

const isDirectRun = process.argv[1] && (() => {
  try {
    return fsSync.realpathSync(path.resolve(process.argv[1])) === fsSync.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  refreshPostStats()
    .then(({ stats, unmatched }) => {
      console.log(formatScoreboard(stats));
      if (unmatched.length) {
        console.log(`\n${unmatched.length} channel posts could not be matched: ${unmatched.map((u) => `${u.runId}/${u.service}`).join(", ")}`);
      }
      console.log(`\nSaved ${stats.videos.length} videos to ${getDefaultPostStatsPath()}`);
    })
    .catch((err) => {
      console.error(redactSecrets(`\n❌ POST STATS FAILED: ${err.message}\n`), redactSecrets(err.stack || ""));
      process.exit(1);
    });
}
