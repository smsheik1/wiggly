import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { pruneOldRuns } from "../prune-runs.mjs";

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

test("pruneOldRuns previews via dryRun, prunes heavy assets and unpicked MP4s past retentionDays, and preserves all JSON receipts and recent runs", async () => {
  const runsDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiggly-prune-runs-"));
  const now = new Date("2026-11-11T12:00:00Z");
  const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);

  const expiredUnpicked = path.join(runsDir, "daily-2026-11-01-unpicked");
  const expiredPicked = path.join(runsDir, "daily-2026-11-01-picked");
  const recentRun = path.join(runsDir, "daily-2026-11-09-recent");

  try {
    // 1. Expired unpicked run: heavy assets + both MP4s should be deleted; JSONs stay
    await fs.mkdir(path.join(expiredUnpicked, "shots"), { recursive: true });
    await fs.mkdir(path.join(expiredUnpicked, "render"), { recursive: true });
    await fs.mkdir(path.join(expiredUnpicked, "media"), { recursive: true });
    await fs.writeFile(path.join(expiredUnpicked, "shots", "frame-0001.png"), "x".repeat(500));
    await fs.writeFile(path.join(expiredUnpicked, "render", "seg.mp4"), "y".repeat(300));
    await fs.writeFile(path.join(expiredUnpicked, "media", "broll-01.png"), "z".repeat(400));
    await fs.writeFile(path.join(expiredUnpicked, "user-audio.wav"), "w".repeat(600));
    await fs.writeFile(path.join(expiredUnpicked, "final.mp4"), "m".repeat(700));
    await fs.writeFile(path.join(expiredUnpicked, "final-vertical.mp4"), "v".repeat(800));
    await fs.writeFile(path.join(expiredUnpicked, "script.json"), JSON.stringify({ title: "Kept" }));
    await fs.writeFile(path.join(expiredUnpicked, "media-sources.json"), JSON.stringify({ uniqueCount: 2 }));
    await fs.utimes(expiredUnpicked, tenDaysAgo, tenDaysAgo);

    // 2. Expired picked/published run: heavy shots/wav/raw final.mp4 deleted; final-vertical.mp4 + JSONs stay
    await fs.mkdir(path.join(expiredPicked, "shots"), { recursive: true });
    await fs.writeFile(path.join(expiredPicked, "publish-state.json"), JSON.stringify({ schemaVersion: 1 }));
    await fs.writeFile(path.join(expiredPicked, "human-review.json"), JSON.stringify({ status: "approved" }));
    await fs.writeFile(path.join(expiredPicked, "shots", "frame-0001.png"), "p".repeat(200));
    await fs.writeFile(path.join(expiredPicked, "user-audio.wav"), "q".repeat(200));
    await fs.writeFile(path.join(expiredPicked, "final.mp4"), "r".repeat(200));
    await fs.writeFile(path.join(expiredPicked, "final-vertical.mp4"), "keep-me-picked");
    await fs.utimes(expiredPicked, tenDaysAgo, tenDaysAgo);

    // 3. Recent run: everything stays
    await fs.mkdir(path.join(recentRun, "shots"), { recursive: true });
    await fs.mkdir(path.join(recentRun, "media"), { recursive: true });
    await fs.writeFile(path.join(recentRun, "shots", "frame-0001.png"), "recent-frame");
    await fs.writeFile(path.join(recentRun, "media", "broll-01.png"), "recent-media");
    await fs.writeFile(path.join(recentRun, "final-vertical.mp4"), "recent-mp4");
    await fs.writeFile(path.join(recentRun, "script.json"), JSON.stringify({ title: "Recent" }));
    await fs.utimes(recentRun, twoDaysAgo, twoDaysAgo);

    const preview = await pruneOldRuns({ runsDir, retentionDays: 7, dryRun: true, now });
    assert.equal(preview.dryRun, true);
    assert.equal(preview.runsScanned, 3);
    assert.equal(preview.runsPruned, 2);
    assert.equal(preview.filesDeleted, 9);
    assert.ok(preview.bytesFreed >= 3900);
    assert.equal(await exists(path.join(expiredUnpicked, "final-vertical.mp4")), true, "dryRun must not delete files");

    const applied = await pruneOldRuns({ runsDir, retentionDays: 7, dryRun: false, now });
    assert.equal(applied.dryRun, false);
    assert.equal(applied.runsPruned, 2);
    assert.equal(applied.filesDeleted, 9);

    // Expired unpicked checks
    assert.equal(await exists(path.join(expiredUnpicked, "shots")), false);
    assert.equal(await exists(path.join(expiredUnpicked, "render")), false);
    assert.equal(await exists(path.join(expiredUnpicked, "media")), false);
    assert.equal(await exists(path.join(expiredUnpicked, "user-audio.wav")), false);
    assert.equal(await exists(path.join(expiredUnpicked, "final.mp4")), false);
    assert.equal(await exists(path.join(expiredUnpicked, "final-vertical.mp4")), false);
    assert.equal(await exists(path.join(expiredUnpicked, "script.json")), true);
    assert.equal(await exists(path.join(expiredUnpicked, "media-sources.json")), true);

    // Expired picked checks
    assert.equal(await exists(path.join(expiredPicked, "shots")), false);
    assert.equal(await exists(path.join(expiredPicked, "user-audio.wav")), false);
    assert.equal(await exists(path.join(expiredPicked, "final.mp4")), false);
    assert.equal(await exists(path.join(expiredPicked, "final-vertical.mp4")), true);
    assert.equal(await exists(path.join(expiredPicked, "publish-state.json")), true);

    // Recent run checks
    assert.equal(await exists(path.join(recentRun, "shots", "frame-0001.png")), true);
    assert.equal(await exists(path.join(recentRun, "media", "broll-01.png")), true);
    assert.equal(await exists(path.join(recentRun, "final-vertical.mp4")), true);
    assert.equal(await exists(path.join(recentRun, "script.json")), true);
  } finally {
    await fs.rm(runsDir, { recursive: true, force: true });
  }
});
