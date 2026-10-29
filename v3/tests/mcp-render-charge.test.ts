import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MemoryFilmLedger } from "../features/mcp/film-ledger";
import { AwaitingCredits, chargeThenRender, chargesPath, paidItemsPath } from "../features/mcp/render-charge";
import { crewFeeMissingError } from "../features/mcp/crew-fee";
import { startV2Run } from "../features/mcp/draft-worker";
import type { Storyboard } from "../features/mcp/film-ledger";

const storyboard: Storyboard = {
  format: "my-pixar-story",
  title: "Sunday",
  subject: "Leo",
  beats: Array.from({ length: 7 }, () => ({ duration_sec: 10, action: "Leo looks up.", camera: "Wide." })),
  characters: [{ name: "Leo", skinTone: "olive", description: "An adult man with short dark hair and a trimmed beard." }],
  hero_props: [],
};

function ledger() {
  const book = new MemoryFilmLedger();
  book.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  book.attachPhotos("user_1", ["Leo"]);
  const started = book.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("start failed");
  return { book, jobId: String(started.data.job_id) };
}

test("a missing crew fee starts nothing and charges nothing", async () => {
  const job = ledger();
  await assert.rejects(() => startV2Run({
    jobId: job.jobId,
    storyboard,
    imageUrls: [],
    runsRoot: tmpdir(),
    ledger: job.book,
    accountId: "user_1",
  }), new RegExp(crewFeeMissingError().split("\n")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(job.book.exportState("user_1").monthlyCredits, 1900);
  assert.equal(job.book.exportState("user_1").jobs[0]?.creditsCharged, 0);
});

test("a short balance never starts the render", async () => {
  const job = ledger();
  job.book.setAccount("user_1", { subscribed: true, monthlyCredits: 0, purchasedCredits: 0 });
  let called = false;
  await assert.rejects(() => chargeThenRender({
    ledger: job.book,
    accountId: "user_1",
    jobId: job.jobId,
    runDir: path.join(tmpdir(), `wiggly-short-${job.jobId}`),
    itemId: "@Leo",
    credits: 8,
    render: async () => {
      called = true;
      return { dest: "/tmp/leo.png" };
    },
  }), AwaitingCredits);
  assert.equal(called, false);
  assert.equal(job.book.exportState("user_1").jobs[0]?.creditsCharged, 0);
});

test("a failed still refunds its charge and deletes the key", async () => {
  const job = ledger();
  const runDir = path.join(tmpdir(), `wiggly-refund-${job.jobId}`);
  await assert.rejects(() => chargeThenRender({
    ledger: job.book,
    accountId: "user_1",
    jobId: job.jobId,
    runDir,
    itemId: "@Leo",
    credits: 8,
    render: async () => {
      throw new Error("Nano Banana failed");
    },
  }), /Nano Banana failed/);
  const account = job.book.exportState("user_1");
  assert.equal(account.monthlyCredits + account.purchasedCredits, 1900);
  assert.equal(account.jobs[0]?.creditsCharged, 0);
  const charges = JSON.parse(await readFile(chargesPath(runDir), "utf8")) as Record<string, number>;
  assert.equal(charges["@Leo"], undefined);
  await assert.rejects(() => readFile(paidItemsPath(runDir), "utf8"));
});

test("a successful still is charged once and marked paid only after the file exists", async () => {
  const job = ledger();
  const runDir = path.join(tmpdir(), `wiggly-paid-${job.jobId}`);
  const saved = await chargeThenRender({
    ledger: job.book,
    accountId: "user_1",
    jobId: job.jobId,
    runDir,
    itemId: "@Leo",
    credits: 8,
    render: async () => ({ dest: "/tmp/leo.png" }),
  });
  assert.equal(saved.dest, "/tmp/leo.png");
  assert.equal(job.book.exportState("user_1").monthlyCredits, 1892);
  const paid = JSON.parse(await readFile(paidItemsPath(runDir), "utf8")) as Record<string, string>;
  assert.equal(paid["@Leo"], "/tmp/leo.png");
  await chargeThenRender({
    ledger: job.book,
    accountId: "user_1",
    jobId: job.jobId,
    runDir,
    itemId: "@Leo",
    credits: 8,
    render: async () => ({ dest: "/tmp/leo.png" }),
  });
  assert.equal(job.book.exportState("user_1").monthlyCredits, 1892);
});
