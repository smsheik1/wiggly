import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  filterFreshTopics,
  formatChicagoDate,
  getDefaultLedgerPath,
  getRecentPublishedTitles,
  isEntryEligible,
  isTopicCovered,
  LEGACY_LEDGER_PATH,
  loadLedger,
  recordShown,
  recordTopic,
} from "../content-ledger.mjs";

test("ledger migrates v1 array to v2 at WIGGLY_STUDIO_HOME once and keeps legacy backup intact", async () => {
  const studioHome = await fs.mkdtemp(path.join(os.tmpdir(), "studio-home-mig-"));
  const legacyDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-legacy-"));
  try {
    const legacyCopy = path.join(legacyDir, "published-topics.json");
    const v1Fixture = JSON.stringify(
      [
        { title: "Grand Theft Auto 6", publishedAt: "2026-11-01T10:00:00Z", runId: "r1" },
        { title: "Valve Steam Frame", publishedAt: "2026-11-02T10:00:00Z", runId: "r2", link: "" },
        { title: "Switch 2 Sales Milestone", link: "https://example.com/switch2", publishedAt: "2026-11-03T10:00:00Z", runId: "r3", postId: null, channel: "instagram" },
      ],
      null,
      2,
    );
    await fs.writeFile(legacyCopy, v1Fixture, "utf8");

    const env = { ...process.env, WIGGLY_STUDIO_HOME: studioHome };
    const expectedPath = getDefaultLedgerPath(env);
    const ledger = await loadLedger(undefined, { env, legacyPath: legacyCopy, quiet: true });

    assert.equal(ledger.schemaVersion, 2);
    assert.equal(ledger.entries.length, 3);
    assert.ok(ledger.entries.every((e) => e.published !== null));
    assert.equal(await fs.readFile(legacyCopy, "utf8"), v1Fixture);

    const written = JSON.parse(await fs.readFile(expectedPath, "utf8"));
    assert.equal(written.schemaVersion, 2);
    assert.equal(written.entries.length, ledger.entries.length);
  } finally {
    await fs.rm(studioHome, { recursive: true, force: true });
    await fs.rm(legacyDir, { recursive: true, force: true });
  }
});

test("corrupted or unreadable ledger throws loudly instead of silently resetting", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-ledger-corrupt-"));
  const ledgerPath = path.join(tmpDir, "published-topics.json");
  try {
    await fs.writeFile(ledgerPath, "{ not valid json", "utf8");
    await assert.rejects(() => loadLedger(ledgerPath), /Corrupted topic ledger/);

    await fs.writeFile(ledgerPath, JSON.stringify({ unexpected: true }), "utf8");
    await assert.rejects(() => loadLedger(ledgerPath), /Malformed topic ledger schema/);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("matching checks eventId -> canonical link -> exact normalized title without substring collisions", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-ledger-match-"));
  const ledgerPath = path.join(tmpDir, "published-topics.json");
  try {
    await recordTopic(
      { eventId: "evt_ps6_rumor", link: "https://news.example.com/ps6-price", title: "PS6 Pricing Rumors Emerge" },
      {
        ledgerPath,
        runId: "run-1",
        channels: {
          instagram: { success: true, service: "instagram", postId: "ig_1" },
          youtube: { success: true, service: "youtube", postId: "yt_1" },
        },
      },
    );
    await recordTopic(
      { title: "Grand Theft Auto 6" },
      { ledgerPath, runId: "run-legacy-no-link" },
    );

    const ledger = await loadLedger(ledgerPath);
    assert.equal(ledger.entries[0].published.channels.youtube.postId, "yt_1");
    assert.equal(ledger.entries[0].published.postId, "ig_1");

    // Same event matched by eventId or canonical link or exact normalized title
    assert.equal(isTopicCovered({ eventId: "evt_ps6_rumor", title: "Completely different headline" }, ledger), true);
    assert.equal(isTopicCovered({ link: "https://news.example.com/ps6-price", title: "Another outlet headline" }, ledger), true);
    assert.equal(isTopicCovered({ title: "  ps6   pricing rumors emerge " }, ledger), true);
    assert.equal(isTopicCovered({ title: "  grand theft auto 6  " }, ledger), true);

    // Substring collision ("PS6") must NOT block unrelated PS6 news
    assert.equal(
      isTopicCovered({ eventId: "evt_ps6_dev", link: "https://news.example.com/ps6-devkit", title: "PS6 DevKit Leaks Online" }, ledger),
      false,
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("unpicked candidates stay eligible once and retire permanently after 2 live shown dates even across skipped days", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "studio-ledger-shown-"));
  const ledgerPath = path.join(tmpDir, "published-topics.json");
  const candidate = {
    eventId: "evt_switch2",
    link: "https://news.example.com/switch-2-dock",
    title: "Switch 2 Dock Specs Revealed",
  };

  try {
    // Day 1 shown -> still eligible once more (even if studio misses Day 2)
    await recordShown(candidate, { ledgerPath, date: "2026-11-11" });
    let ledger = await loadLedger(ledgerPath);
    assert.equal(ledger.entries[0].shown.length, 1);
    assert.equal(isEntryEligible(ledger.entries[0]), true);
    assert.equal(filterFreshTopics([candidate], ledger).length, 1);

    // Duplicate same-day record is idempotent
    await recordShown(candidate, { ledgerPath, date: "2026-11-11" });
    ledger = await loadLedger(ledgerPath);
    assert.deepEqual(ledger.entries[0].shown, ["2026-11-11"]);

    // Day 3 (skipped Day 2) shown -> second live appearance retires it
    await recordShown(candidate, { ledgerPath, date: "2026-11-13" });
    ledger = await loadLedger(ledgerPath);
    assert.deepEqual(ledger.entries[0].shown, ["2026-11-11", "2026-11-13"]);
    assert.equal(isEntryEligible(ledger.entries[0]), false);
    assert.equal(filterFreshTopics([candidate], ledger).length, 0);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("getRecentPublishedTitles orders newest first and formatChicagoDate uses America/Chicago calendar date", async () => {
  // 2026-11-12T03:00:00Z is 2026-11-11T21:00:00 CST in Chicago
  assert.equal(formatChicagoDate(new Date("2026-11-12T03:00:00Z")), "2026-11-11");

  const titles = getRecentPublishedTitles(
    {
      schemaVersion: 2,
      entries: [
        { title: "Old Story", shown: [], published: { runId: "1", at: "2026-10-01T10:00:00Z" } },
        { title: "Unpublished Shown", shown: ["2026-11-10"], published: null },
        { title: "Newest Story", shown: ["2026-11-11"], published: { runId: "2", at: "2026-11-11T10:00:00Z" } },
      ],
    },
    30,
  );
  assert.deepEqual(titles, ["Newest Story", "Old Story"]);
});
