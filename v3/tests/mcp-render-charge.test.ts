import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { MemoryFilmLedger } from "../features/mcp/film-ledger";
import { AwaitingCredits, chargeThenRender, chargesPath, paidItemsPath } from "../features/mcp/render-charge";
import { runDraftTick, startV2Run } from "../features/mcp/draft-worker";
import type { Account, Storyboard } from "../features/mcp/film-ledger";

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

test("a film opens without a crew fee and charges nothing", async () => {
  const job = ledger();
  await withStudio("export {}\n", async (runsRoot) => {
    const started = await startV2Run({
      jobId: job.jobId,
      storyboard,
      imageUrls: [],
      photos,
      runsRoot,
      ledger: job.book,
      accountId: "user_1",
    });
    assert.equal(started.state.status, "writing");
    assert.equal(job.book.exportState("user_1").monthlyCredits, 1900);
    assert.equal(job.book.exportState("user_1").jobs[0]?.creditsCharged, 0);
    await assert.rejects(() => readFile(chargesPath(path.join(runsRoot, job.jobId)), "utf8"));
  });
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
  const dest = path.join(runDir, "leo.png");
  const saved = await chargeThenRender({
    ledger: job.book,
    accountId: "user_1",
    jobId: job.jobId,
    runDir,
    itemId: "@Leo",
    credits: 8,
    render: async () => {
      await mkdir(runDir, { recursive: true });
      await writeFile(dest, "png");
      return { dest };
    },
  });
  assert.equal(saved.dest, dest);
  assert.equal(job.book.exportState("user_1").monthlyCredits, 1892);
  const paid = JSON.parse(await readFile(paidItemsPath(runDir), "utf8")) as Record<string, string>;
  assert.equal(paid["@Leo"], dest);
  let second = 0;
  await chargeThenRender({
    ledger: job.book,
    accountId: "user_1",
    jobId: job.jobId,
    runDir,
    itemId: "@Leo",
    credits: 8,
    render: async () => {
      second += 1;
      return { dest };
    },
  });
  assert.equal(second, 0);
  assert.equal(job.book.exportState("user_1").monthlyCredits, 1892);
});

test("a lost paid file is charged again and a failed retry keeps the first charge", async () => {
  const job = ledger();
  const runDir = path.join(tmpdir(), `wiggly-lost-${job.jobId}`);
  const dest = path.join(runDir, "leo.png");
  await chargeThenRender({
    ledger: job.book,
    accountId: "user_1",
    jobId: job.jobId,
    runDir,
    itemId: "@Leo",
    credits: 8,
    render: async () => {
      await mkdir(runDir, { recursive: true });
      await writeFile(dest, "png");
      return { dest };
    },
  });
  await rm(dest);
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
  assert.equal(account.monthlyCredits + account.purchasedCredits, 1892);
  assert.equal(account.jobs[0]?.creditsCharged, 8);
  const charges = JSON.parse(await readFile(chargesPath(runDir), "utf8")) as Record<string, number>;
  assert.equal(charges["@Leo"], undefined);
  const paid = JSON.parse(await readFile(paidItemsPath(runDir), "utf8")) as Record<string, string>;
  assert.equal(paid["@Leo"], undefined);
});

test("a render path with no file is refunded and stays unpaid", async () => {
  const job = ledger();
  const runDir = path.join(tmpdir(), `wiggly-missing-file-${job.jobId}`);
  const dest = path.join(runDir, "missing.png");
  await assert.rejects(() => chargeThenRender({
    ledger: job.book,
    accountId: "user_1",
    jobId: job.jobId,
    runDir,
    itemId: "@Leo",
    credits: 8,
    render: async () => ({ dest }),
  }), /did not write/);
  const account = job.book.exportState("user_1");
  assert.equal(account.monthlyCredits + account.purchasedCredits, 1900);
  assert.equal(account.jobs[0]?.creditsCharged, 0);
  const charges = JSON.parse(await readFile(chargesPath(runDir), "utf8")) as Record<string, number>;
  assert.equal(charges["@Leo"], undefined);
  await assert.rejects(() => readFile(paidItemsPath(runDir), "utf8"));
});

const photos = [{ label: "Leo", path: "/tmp/leo.jpg" }];

async function withStudio(source: string, run: (runsRoot: string) => Promise<void>) {
  const root = path.join(tmpdir(), `wiggly-studio-${crypto.randomUUID()}`);
  const runsRoot = path.join(tmpdir(), `wiggly-runs-${crypto.randomUUID()}`);
  await mkdir(path.join(root, "my-pixar-story-v2", "scripts"), { recursive: true });
  await writeFile(path.join(root, "my-pixar-story-v2", "scripts", "run-customer.mjs"), source);
  const previous = process.env.WIGGLY_FORMAT_STUDIOS;
  process.env.WIGGLY_FORMAT_STUDIOS = root;
  try {
    await run(runsRoot);
  } finally {
    if (previous === undefined) delete process.env.WIGGLY_FORMAT_STUDIOS;
    else process.env.WIGGLY_FORMAT_STUDIOS = previous;
  }
}

test("a missing photo or a missing studio charges nothing", async () => {
  const missingPhoto = ledger();
  await assert.rejects(() => startV2Run({
    jobId: missingPhoto.jobId,
    storyboard,
    imageUrls: [],
    photos: [],
    runsRoot: tmpdir(),
    ledger: missingPhoto.book,
    accountId: "user_1",
    feeCredits: 40,
  }), /No photo file/);
  assert.equal(missingPhoto.book.exportState("user_1").monthlyCredits, 1900);
  assert.equal(missingPhoto.book.exportState("user_1").jobs[0]?.creditsCharged, 0);

  const missingStudio = ledger();
  const previous = process.env.WIGGLY_FORMAT_STUDIOS;
  process.env.WIGGLY_FORMAT_STUDIOS = path.join(tmpdir(), `wiggly-empty-${missingStudio.jobId}`);
  try {
    await assert.rejects(() => startV2Run({
      jobId: missingStudio.jobId,
      storyboard,
      imageUrls: [],
      photos,
      runsRoot: tmpdir(),
      ledger: missingStudio.book,
      accountId: "user_1",
      feeCredits: 40,
    }), /run-customer\.mjs/);
  } finally {
    if (previous === undefined) delete process.env.WIGGLY_FORMAT_STUDIOS;
    else process.env.WIGGLY_FORMAT_STUDIOS = previous;
  }
  assert.equal(missingStudio.book.exportState("user_1").monthlyCredits, 1900);
  assert.equal(missingStudio.book.exportState("user_1").jobs[0]?.creditsCharged, 0);
});

test("opening a film does not call the text crew or charge a fee", async () => {
  const source = "export async function runCustomer() { throw new Error('the text crew must not run'); }\n";
  const job = ledger();
  await withStudio(source, async (runsRoot) => {
    const started = await startV2Run({
      jobId: job.jobId,
      storyboard,
      imageUrls: [],
      photos,
      runsRoot,
      ledger: job.book,
      accountId: "user_1",
      feeCredits: 40,
    });
    assert.equal(started.state.status, "writing");
    const again = await startV2Run({
      jobId: job.jobId,
      storyboard,
      imageUrls: [],
      photos,
      runsRoot,
      ledger: job.book,
      accountId: "user_1",
      feeCredits: 40,
    });
    assert.equal(again.state.status, "writing");
  });
  const account = job.book.exportState("user_1");
  assert.equal(account.monthlyCredits + account.purchasedCredits, 1900);
  assert.equal(account.jobs[0]?.creditsCharged, 0);
});

test("a tick opens the writing state and does not start the text crew", async () => {
  const job = ledger();
  await withStudio("export async function runCustomer() { throw new Error('the text crew must not run'); }\n", async (runsRoot) => {
    let stored = job.book.exportState("user_1");
    const lines = await runDraftTick({
      jobs: [{ accountId: "user_1", jobId: job.jobId, imageUrls: [], photos }],
      loadAccount: () => stored,
      saveAccount: (_accountId, next: Account) => { stored = next; },
      runsRoot,
      feeCredits: 40,
    });
    assert.match(lines[0] ?? "", /running/);
    assert.equal(stored.jobs[0]?.creditsCharged, 0);
    assert.equal(stored.jobs[0]?.stage, "running");
    const state = JSON.parse(await readFile(stored.jobs[0]?.stateFile ?? "", "utf8")) as { status?: string };
    assert.equal(state.status, "writing");
  });
});

test("an existing writing state is kept and a broken state charges nothing", async () => {
  const job = ledger();
  await withStudio("export {}\n", async (runsRoot) => {
    const runDir = path.join(runsRoot, job.jobId);
    await mkdir(path.join(runDir, "outputs"), { recursive: true });
    await writeFile(path.join(runDir, "outputs", "state.json"), JSON.stringify({ status: "writing", passed: { "story-director": true } }));
    const existing = await startV2Run({
      jobId: job.jobId,
      storyboard,
      imageUrls: [],
      photos,
      runsRoot,
      ledger: job.book,
      accountId: "user_1",
    });
    assert.equal(existing.state.status, "writing");
    assert.equal(JSON.parse(await readFile(path.join(runDir, "outputs", "state.json"), "utf8")).passed["story-director"], true);
    assert.equal(job.book.exportState("user_1").jobs[0]?.creditsCharged, 0);

    const broken = ledger();
    const brokenDir = path.join(runsRoot, broken.jobId);
    await mkdir(path.join(brokenDir, "outputs"), { recursive: true });
    await writeFile(path.join(brokenDir, "outputs", "state.json"), "{");
    broken.book.setRun("user_1", broken.jobId, { runId: broken.jobId, stateFile: path.join(brokenDir, "outputs", "state.json") });
    await assert.rejects(() => startV2Run({
      jobId: broken.jobId,
      storyboard,
      imageUrls: [],
      photos,
      runsRoot,
      ledger: broken.book,
      accountId: "user_1",
    }), /could not be read/);
    assert.equal(broken.book.exportState("user_1").jobs[0]?.creditsCharged, 0);
  });
});
