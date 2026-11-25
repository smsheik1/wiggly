import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  formatScoreboard,
  matchPublishedPosts,
  mergeChannelReading,
  metricsToObject,
  pickedByFromDelivery,
  refreshPostStats,
  titleSimilarity,
} from "../post-stats.mjs";

test("titleSimilarity ignores hashtags and punctuation, and tells different stories apart", () => {
  assert.equal(
    titleSimilarity("PS5 PRO GTA PANIC #Shorts\n\nGamers are...", "PS5 PRO GTA PANIC\n\nGamers are..."),
    1,
  );
  assert.ok(
    titleSimilarity(
      "Players Need a PlayStation 5 System Update Ahead of GTA 6 #shaz #gta6",
      "Players Need a PlayStation 5 System Update Ahead of Grand Theft Auto VI",
    ) >= 0.5,
  );
  assert.ok(titleSimilarity("PS5 PRO GTA PANIC", "GTA 6 Anticipation Drives Console Comparisons") < 0.5);
});

test("metricsToObject keeps known numeric metrics only", () => {
  assert.deepEqual(
    metricsToObject([
      { type: "views", value: 10 },
      { type: "averageTimeWatched", value: 9.5 },
      { type: "mystery", value: 3 },
      { type: "likes", value: null },
    ]),
    { views: 10, averageTimeWatched: 9.5 },
  );
});

test("pickedByFromDelivery separates Shaz's picks from auto-posts", () => {
  assert.equal(pickedByFromDelivery({ mode: "telegram-pick" }), "shaz");
  assert.equal(pickedByFromDelivery({ mode: "deadline-auto-pick" }), "auto-8pm");
  assert.equal(pickedByFromDelivery({ mode: "auto-approve" }), "auto-approve");
  assert.equal(pickedByFromDelivery(null), "unknown");
});

const post = (id, text, sentAt, extra = {}) => ({ id, text, sentAt, status: "sent", metrics: [], ...extra });

test("matchPublishedPosts uses saved ids first, then title twins inside the time window, never reusing a post", () => {
  const entries = [
    {
      title: "Story A",
      published: { runId: "run-a", at: "2026-11-18T22:19:00Z", postId: "ig-a" },
    },
    {
      title: "Story B",
      published: { runId: "run-b", at: "2026-11-18T22:21:00Z", postId: "ig-b" },
    },
  ];
  const postsByChannel = {
    instagram: [
      post("ig-a", "Microsoft Says Project Helix Is a Console\n\nbody", "2026-11-18T22:19:39Z"),
      post("ig-b", "Players Need a PlayStation 5 System Update\n\nbody", "2026-11-18T22:21:59Z"),
    ],
    youtube: [
      post("yt-a", "Microsoft Says Project Helix Is a Console #Shorts\n\nbody", "2026-11-18T22:18:49Z"),
      // Same title, but a week later: outside the window, must not match.
      post("yt-late", "Players Need a PlayStation 5 System Update #Shorts", "2026-11-25T22:19:00Z"),
    ],
    tiktok: [
      post("tt-b", "Players Need a PlayStation 5 System Update #shaz #gaming", "2026-11-18T22:34:18Z"),
    ],
  };

  const [a, b] = matchPublishedPosts(entries, postsByChannel);
  assert.equal(a.channels.instagram.post.id, "ig-a");
  assert.equal(a.channels.instagram.matchedBy, "saved-id");
  assert.equal(a.channels.youtube.post.id, "yt-a");
  assert.equal(a.channels.youtube.matchedBy, "title-match");
  assert.equal(a.channels.tiktok, undefined);

  assert.equal(b.channels.instagram.post.id, "ig-b");
  assert.equal(b.channels.tiktok.post.id, "tt-b");
  assert.equal(b.channels.youtube, undefined, "a post a week later is not this video");
});

test("matchPublishedPosts prefers per-channel saved ids from new runs", () => {
  const [v] = matchPublishedPosts(
    [{
      title: "x",
      published: {
        runId: "r",
        at: "2026-11-25T21:44:00Z",
        postId: "ig",
        channels: { instagram: { postId: "ig" }, youtube: { postId: "yt" }, tiktok: { postId: "tt" } },
      },
    }],
    {
      instagram: [post("ig", "Totally different text", "2026-11-25T21:45:00Z")],
      youtube: [post("yt", "Other words", "2026-11-25T21:44:00Z")],
      tiktok: [post("tt", "More words", "2026-11-25T21:45:00Z")],
    },
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(v.channels).map(([s, c]) => [s, c.post.id + ":" + c.matchedBy])),
    { instagram: "ig:saved-id", youtube: "yt:saved-id", tiktok: "tt:saved-id" },
  );
});

test("mergeChannelReading always updates latest but adds history at most every 20 hours", () => {
  const r = (at, views) => ({ at, postId: "p", link: null, sentAt: "2026-11-01T00:00:00Z", matchedBy: "saved-id", metrics: { views } });
  let rec = mergeChannelReading(undefined, r("2026-11-02T08:00:00Z", 10));
  rec = mergeChannelReading(rec, r("2026-11-02T12:00:00Z", 20));
  assert.equal(rec.history.length, 1);
  assert.equal(rec.latest.metrics.views, 20);
  rec = mergeChannelReading(rec, r("2026-11-03T08:00:00Z", 30));
  assert.equal(rec.history.length, 2);
  assert.deepEqual(rec.history.map((h) => h.metrics.views), [10, 30]);
});

function fakeBuffer({ failOn } = {}) {
  const channels = [
    { id: "ch-tt", service: "tiktok" },
    { id: "ch-ig", service: "instagram" },
    { id: "ch-yt", service: "youtube" },
  ];
  const pages = {
    "ch-tt": [[post("tt1", "Man Arrested Over Retro Games #shaz", "2026-11-25T21:45:00Z", {
      externalLink: "https://tiktok.example/1",
      metrics: [{ type: "views", value: 500 }, { type: "averageTimeWatched", value: 10.5 }],
    })]],
    // Instagram comes back in two pages to prove pagination is followed.
    "ch-ig": [
      [post("ig-old", "Unrelated September post", "2026-09-01T00:00:00Z")],
      [post("ig1", "Man Arrested Over Retro Games\n\nbody", "2026-11-25T21:45:04Z", { metrics: [{ type: "views", value: 140 }] })],
    ],
    "ch-yt": [[post("yt1", "Man Arrested Over Retro Games #Shorts", "2026-11-25T21:44:18Z", { metrics: [{ type: "views", value: 1300 }] })]],
  };
  const calls = [];
  return {
    calls,
    deps: {
      getBufferChannels: async () => ({ organization: { id: "org" }, channels }),
      executeBufferGraphQL: async ({ variables }) => {
        const ch = variables.input.filter.channelIds[0];
        calls.push({ ch, after: variables.after });
        if (failOn === ch) throw new Error("Buffer GraphQL error: Not authorized");
        const idx = variables.after ? Number(variables.after) : 0;
        const list = pages[ch];
        return {
          posts: {
            edges: list[idx].map((node) => ({ node })),
            pageInfo: { hasNextPage: idx + 1 < list.length, endCursor: String(idx + 1) },
          },
        };
      },
      loadLedger: async () => ({
        entries: [
          { title: "story", link: "https://news.example/a", published: { runId: "run-1", at: "2026-11-25T21:44:29Z", postId: "ig1" } },
          { title: "never published", published: null },
        ],
      }),
      readDelivery: async () => ({ mode: "deadline-auto-pick" }),
    },
  };
}

test("refreshPostStats saves every channel's numbers for a published video, following pages", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "post-stats-"));
  const statsPath = path.join(dir, "post-stats.json");
  const { deps, calls } = fakeBuffer();

  const { stats, unmatched } = await refreshPostStats({
    statsPath,
    now: new Date("2026-11-26T21:45:00Z"),
    deps,
  });

  assert.deepEqual(unmatched, []);
  assert.ok(calls.some((c) => c.ch === "ch-ig" && c.after === "1"), "second Instagram page was requested");
  const saved = JSON.parse(await fs.readFile(statsPath, "utf8"));
  assert.deepEqual(saved, stats);
  assert.equal(saved.videos.length, 1);
  const v = saved.videos[0];
  assert.equal(v.runId, "run-1");
  assert.equal(v.pickedBy, "auto-8pm");
  assert.equal(v.title, "Man Arrested Over Retro Games");
  assert.equal(v.channels.tiktok.latest.metrics.views, 500);
  assert.equal(v.channels.tiktok.latest.metrics.averageTimeWatched, 10.5);
  assert.equal(v.channels.tiktok.link, "https://tiktok.example/1");
  assert.equal(v.channels.tiktok.latest.ageHours, 24);
  assert.equal(v.channels.instagram.latest.metrics.views, 140);
  assert.equal(v.channels.instagram.matchedBy, "saved-id");
  assert.equal(v.channels.youtube.latest.metrics.views, 1300);
  assert.match(formatScoreboard(saved), /auto-8pm\s+500/);
});

test("refreshPostStats stops loudly on a Buffer failure and leaves the saved stats untouched", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "post-stats-"));
  const statsPath = path.join(dir, "post-stats.json");
  await fs.writeFile(statsPath, JSON.stringify({ schemaVersion: 1, videos: [{ runId: "keep-me" }] }));
  const { deps } = fakeBuffer({ failOn: "ch-yt" });

  await assert.rejects(refreshPostStats({ statsPath, deps }), /Not authorized/);
  const after = JSON.parse(await fs.readFile(statsPath, "utf8"));
  assert.deepEqual(after.videos, [{ runId: "keep-me" }]);
});

test("refreshPostStats refuses to run when a channel is disconnected from Buffer", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "post-stats-"));
  const { deps } = fakeBuffer();
  deps.getBufferChannels = async () => ({ organization: { id: "org" }, channels: [{ id: "ch-ig", service: "instagram" }] });
  await assert.rejects(
    refreshPostStats({ statsPath: path.join(dir, "s.json"), deps }),
    /no tiktok channel connected/,
  );
});

test("refreshAudienceStats shouts on failure but lets the daily batch carry on", async () => {
  const { refreshAudienceStats } = await import("../studio-daily.mjs");
  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    const res = await refreshAudienceStats({
      refreshPostStats: async () => {
        throw new Error("Buffer GraphQL error: Not authorized to access this resource");
      },
    });
    assert.equal(res.status, "failed");
  } finally {
    console.error = origError;
  }
  const shout = errors.join("\n");
  assert.match(shout, /AUDIENCE STATS FAILED/);
  assert.match(shout, /Not authorized/);
  assert.match(shout, /publish\.buffer\.com/);
  assert.match(shout, /post-stats\.mjs/);
});

test("refreshAudienceStats reports ok with the video count", async () => {
  const { refreshAudienceStats } = await import("../studio-daily.mjs");
  const origLog = console.log;
  console.log = () => {};
  try {
    const res = await refreshAudienceStats({
      refreshPostStats: async () => ({ stats: { videos: [{ runId: "a", publishedAt: "2026-11-25T00:00:00Z", pickedBy: "shaz", channels: {}, title: "t" }] }, unmatched: [] }),
    });
    assert.deepEqual(res, { status: "ok", videos: 1 });
  } finally {
    console.log = origLog;
  }
});

test("runDailyBatch refreshes audience stats before making videos (and not on dry runs)", async () => {
  const { runDailyBatch } = await import("../studio-daily.mjs");
  const run = async (dryRun) => {
    const order = [];
    const origLog = console.log;
    console.log = () => {};
    try {
      await runDailyBatch({
        count: 1,
        dryRun,
        autoApprove: true,
        noTelegram: true,
        deps: {
          loadStudioConfig: async () => ({ batchSize: 1, minFreeDiskMb: 0, noPickAction: "skip" }),
          acquireStudioLock: async () => ({ release: async () => {} }),
          assertFreeDiskSpace: async () => {},
          sendTelegramMessage: async () => ({}),
          refreshPostStats: async () => {
            order.push("stats");
            return { stats: { videos: [] }, unmatched: [] };
          },
          findTopStories: async () => {
            order.push("stories");
            return [];
          },
        },
      }).catch(() => {});
    } finally {
      console.log = origLog;
    }
    return order;
  };
  assert.deepEqual(await run(false), ["stats", "stories"]);
  assert.deepEqual(await run(true), ["stories"]);
});
