import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadLedger,
  isTopicCovered,
  filterFreshTopics,
  recordTopic,
} from "../content-ledger.mjs";

test("content-ledger detects covered topic by exact URL or fuzzy title", () => {
  const ledger = [
    { title: "Sony PS5 Pro Price Leak", link: "https://reddit.com/r/gaming/1" },
    { title: "GTA 6 Trailer Two Rumors", link: "https://reddit.com/r/gta/2" },
  ];

  assert.equal(isTopicCovered({ link: "https://reddit.com/r/gaming/1" }, ledger), true);
  assert.equal(isTopicCovered({ title: "sony ps5 pro price leak" }, ledger), true);
  assert.equal(isTopicCovered({ title: "Brand New Unrelated Topic", link: "https://reddit.com/r/new/3" }, ledger), false);
});

test("filterFreshTopics removes existing ledger entries", () => {
  const ledger = [
    { title: "Existing Topic A", link: "https://reddit.com/1" },
  ];
  const candidates = [
    { title: "Existing Topic A", link: "https://reddit.com/1" },
    { title: "Brand New Topic B", link: "https://reddit.com/2" },
  ];

  const fresh = filterFreshTopics(candidates, ledger);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].title, "Brand New Topic B");
});

test("recordTopic appends new entry to ledger file", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ledger-test-"));
  const ledgerFile = path.join(tempDir, "published.json");

  try {
    await recordTopic(
      { title: "Test Breaking News", link: "https://reddit.com/test", author: "insider" },
      { runId: "test-run-1", postId: "post-100" },
      ledgerFile
    );

    const loaded = await loadLedger(ledgerFile);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].title, "Test Breaking News");
    assert.equal(loaded[0].runId, "test-run-1");
    assert.equal(loaded[0].postId, "post-100");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});
