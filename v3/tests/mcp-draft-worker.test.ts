import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { approveDraft, questionnaireFromStoryboard, runDraftTick, SERVER_STUDIOS_ROOT, stepDraftJob, studioForFormat } from "../features/mcp/draft-worker";
import { MemoryFilmLedger, type Storyboard } from "../features/mcp/film-ledger";
import { JobStore, studioStateFile } from "../features/mcp/job-store";

const storyboard: Storyboard = {
  title: "Sunday",
  subject: "Leo",
  beats: Array.from({ length: 7 }, () => ({
    duration_sec: 10,
    action: "Leo looks up.",
    camera: "Wide.",
  })),
  characters: [{ name: "Leo" }],
  hero_props: [],
};

function startedJob() {
  const ledger = new MemoryFilmLedger();
  ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  ledger.attachPhotos("user_1", ["Leo"]);
  const started = ledger.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("start failed");
  return { ledger, jobId: String(started.data.job_id) };
}

test("the worker starts the format the job asks for from a studio directory on the server", () => {
  const pixar = studioForFormat("my-pixar-story", SERVER_STUDIOS_ROOT);
  assert.equal(pixar.directory, "/home/ubuntu/wiggly-format-studios/my-pixar-story-v2");
  assert.equal(pixar.directory.includes("/Users/"), false);
  assert.throws(() => studioForFormat("talking-fish", SERVER_STUDIOS_ROOT), /No crew is installed for format "talking-fish"/);
});

test("a queued draft without a format starts the Pixar studio", async () => {
  const job = startedJob();
  let formatId = "";
  await stepDraftJob({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    imageUrls: ["https://example.com/leo.jpg"],
    runsRoot: path.join(tmpdir(), `wiggly-format-${job.jobId}`),
    startGraph: async (start) => {
      formatId = start.formatId;
      const stateFile = path.join(start.runsRoot, start.jobId, "outputs", "state.json");
      await mkdir(path.dirname(stateFile), { recursive: true });
      await writeFile(stateFile, JSON.stringify({ status: "running", pendingApproval: [] }));
      return { runId: start.jobId, stateFile, state: { status: "running" } };
    },
  });
  assert.equal(formatId, "my-pixar-story");
});

test("an unknown format stops before a studio starts", async () => {
  const ledger = new MemoryFilmLedger();
  ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  ledger.attachPhotos("user_1", ["Leo"]);
  const started = ledger.submitDraft("user_1", { storyboard: { ...storyboard, format: "talking-fish" } });
  if (!started.ok) throw new Error("start failed");
  let calls = 0;
  await assert.rejects(() => stepDraftJob({
    ledger,
    accountId: "user_1",
    jobId: String(started.data.job_id),
    imageUrls: ["https://example.com/leo.jpg"],
    startGraph: async () => {
      calls += 1;
      return { runId: "unused", stateFile: "/tmp/unused", state: {} };
    },
  }), /talking-fish/);
  assert.equal(calls, 0);
});

test("a worker tick starts the queued v2 run and does not call a provider", async () => {
  const job = startedJob();
  const account = job.ledger.exportState("user_1");
  let calls = 0;
  const lines = await runDraftTick({
    jobs: [{ accountId: "user_1", jobId: job.jobId, imageUrls: ["https://example.com/leo.jpg"] }],
    loadAccount: () => account,
    saveAccount: (_accountId, next) => job.ledger.importState("user_1", next),
    runsRoot: path.join(tmpdir(), `wiggly-tick-${job.jobId}`),
    startGraph: async (start) => {
      calls += 1;
      const stateFile = path.join(start.runsRoot, start.jobId, "outputs", "state.json");
      await mkdir(path.dirname(stateFile), { recursive: true });
      const state = { status: "awaiting-approval", pendingApproval: ["@Image 1"] };
      await writeFile(stateFile, JSON.stringify(state));
      return { runId: start.jobId, stateFile, state };
    },
  });
  assert.equal(calls, 1);
  assert.match(lines[0] ?? "", /awaiting-approval/);
  assert.equal(job.ledger.exportState("user_1").jobs[0]?.runId, job.jobId);
});

test("a queued draft starts the v2 graph with the questionnaire and photos", async () => {
  const job = startedJob();
  const seen: Array<{ answers: unknown; photos: string[] }> = [];
  const root = path.join(tmpdir(), `wiggly-draft-${job.jobId}`);
  const stateFile = path.join(root, job.jobId, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  const stage = await stepDraftJob({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    imageUrls: ["https://example.com/leo.jpg"],
    runsRoot: root,
    startGraph: async (start) => {
      const questionnaire = questionnaireFromStoryboard(start.storyboard);
      seen.push({ answers: questionnaire.answers, photos: start.imageUrls });
      assert.equal(JSON.stringify(start).includes("Eyes:"), false);
      const state = { status: "awaiting-approval", pendingApproval: ["@Image 1"] };
      await writeFile(stateFile, JSON.stringify(state));
      return { runId: start.jobId, stateFile, state };
    },
  });
  assert.equal(stage, "awaiting-approval");
  assert.deepEqual(seen[0]?.photos, ["https://example.com/leo.jpg"]);
  assert.deepEqual((seen[0]?.answers as { people: string[] }).people, ["Leo"]);
  const saved = job.ledger.exportState("user_1").jobs[0];
  assert.equal(saved?.stateFile, stateFile);
});

test("wiggly_get_film reads the v2 state file", async () => {
  const root = path.join(tmpdir(), "wiggly-get-film");
  const jobId = "film_state_1";
  const file = studioStateFile(root, jobId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ status: "awaiting-approval", pendingApproval: ["@Image 1"] }));
  const film = await new JobStore(root).getFilm(jobId);
  assert.equal(film.studioStatus, "awaiting-approval");
  assert.deepEqual(film.pendingApproval, ["@Image 1"]);
  assert.equal(film.status, "awaiting_approval");
});

test("an approval spends the still credits, writes the decision, and resumes", async () => {
  const job = startedJob();
  const root = path.join(tmpdir(), `wiggly-approve-${job.jobId}`);
  const stateFile = path.join(root, job.jobId, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ status: "awaiting-approval", pendingApproval: ["@Image 1"] }));
  job.ledger.setRun("user_1", job.jobId, { runId: job.jobId, stateFile });
  job.ledger.setStage("user_1", job.jobId, "awaiting-approval");
  let decision: Record<string, unknown> | undefined;
  const approved = await approveDraft({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    decision: { approvedAssets: { "@Image 1": "asset:master-render:leo" } },
    resumeGraph: async (resume) => {
      decision = resume.decision;
      return { state: { status: "awaiting-approval", pendingApproval: ["animatic"] } };
    },
  });
  assert.equal(approved.ok, true);
  assert.deepEqual(decision?.approvedAssets, { "@Image 1": "asset:master-render:leo" });
  assert.equal(job.ledger.exportState("user_1").monthlyCredits, 1892);
});

test("a production approval stops and returns the top-up link when the balance is zero", async () => {
  const job = startedJob();
  job.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 0, purchasedCredits: 0 });
  const root = path.join(tmpdir(), `wiggly-topup-${job.jobId}`);
  const stateFile = path.join(root, job.jobId, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ status: "awaiting-production", pendingApproval: ["production"] }));
  job.ledger.setRun("user_1", job.jobId, { runId: job.jobId, stateFile });
  let resumed = false;
  const approved = await approveDraft({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    decision: { decision: "approve" },
    seconds: 10,
    resumeGraph: async () => {
      resumed = true;
      return { state: { status: "done" } };
    },
  });
  assert.equal(approved.ok, false);
  if (approved.ok) return;
  assert.match(approved.message, /billing\/credits/);
  assert.equal(resumed, false);
});

test("a failed v2 run returns the credits already spent", async () => {
  const job = startedJob();
  const root = path.join(tmpdir(), `wiggly-fail-${job.jobId}`);
  const stateFile = path.join(root, job.jobId, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ status: "running", pendingApproval: [] }));
  job.ledger.setRun("user_1", job.jobId, { runId: job.jobId, stateFile });
  assert.equal(job.ledger.spendCredits("user_1", job.jobId, 8).ok, true);
  await writeFile(stateFile, JSON.stringify({ status: "failed", pendingApproval: [] }));
  const stage = await stepDraftJob({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    imageUrls: ["https://example.com/leo.jpg"],
    runsRoot: root,
  });
  assert.equal(stage, "failed");
  const account = job.ledger.exportState("user_1");
  assert.equal(account.jobs[0]?.creditsRefunded, true);
  assert.equal(account.purchasedCredits, 8);
});

test("the state file is what a later poll reads", async () => {
  const job = startedJob();
  const root = path.join(tmpdir(), `wiggly-poll-${job.jobId}`);
  const stateFile = path.join(root, job.jobId, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await stepDraftJob({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    imageUrls: [],
    runsRoot: root,
    startGraph: async (start) => {
      await writeFile(stateFile, JSON.stringify({ status: "running", pendingApproval: [] }));
      return { runId: start.jobId, stateFile, state: { status: "running", pendingApproval: [] } };
    },
  });
  await writeFile(stateFile, JSON.stringify({ status: "done", pendingApproval: [] }));
  const stage = await stepDraftJob({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    imageUrls: [],
    runsRoot: root,
  });
  assert.equal(stage, "ready");
  const raw = JSON.parse(await readFile(stateFile, "utf8"));
  assert.equal(raw.status, "done");
});
