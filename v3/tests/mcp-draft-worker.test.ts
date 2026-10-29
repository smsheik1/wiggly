import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { SEEDANCE_MODEL, seedanceBeatInput, stillPrompts, stepDraftJob } from "../features/mcp/draft-worker";
import { MemoryFilmLedger, type Storyboard } from "../features/mcp/film-ledger";

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
  const quote = ledger.submitDraft("user_1", { storyboard });
  if (!quote.ok) throw new Error("quote failed");
  const started = ledger.submitDraft("user_1", { storyboard, confirm: true, quoteId: String(quote.data.quote_id) });
  if (!started.ok) throw new Error("start failed");
  return { ledger, jobId: String(started.data.job_id) };
}

test("the contact sheet prompt names the characters", () => {
  const prompts = stillPrompts(storyboard);
  assert.equal(prompts[0], "Leo");
  assert.match(prompts.at(-1) ?? "", /Contact sheet of Leo/);
  assert.equal(prompts.includes("Sunday contact sheet"), false);
});

test("a beat request is Seedance 2.5 at 480p with photos and no reference video", () => {
  const input = seedanceBeatInput({ action: "Leo looks up.", camera: "Wide.", duration_sec: 10 }, ["https://wiggly.agentenamel.com/photo.jpg"]);
  assert.equal(input.resolution, "480p");
  assert.equal(input.aspect_ratio, "16:9");
  assert.deepEqual(input.reference_images, ["https://wiggly.agentenamel.com/photo.jpg"]);
  assert.equal("reference_videos" in input, false);
  assert.equal(SEEDANCE_MODEL, "bytedance/seedance-2.5");
});

test("a provider failure returns the credits and a success moves the job to assembly", async () => {
  const failed = startedJob();
  failed.ledger.setStage("user_1", failed.jobId, "beats");
  const before = failed.ledger.exportState("user_1").purchasedCredits;
  const stage = await stepDraftJob({
    ledger: failed.ledger,
    accountId: "user_1",
    jobId: failed.jobId,
    imageUrls: ["https://example.com/leo.jpg"],
    token: "test-token",
    fetchImpl: async () => new Response(JSON.stringify({ detail: "out of credit" }), { status: 402 }),
  });
  assert.equal(stage, "failed");
  const refunded = failed.ledger.exportState("user_1");
  assert.equal(refunded.jobs[0]?.creditsRefunded, true);
  assert.ok(refunded.purchasedCredits > before);

  const ok = startedJob();
  ok.ledger.setStage("user_1", ok.jobId, "beats");
  const bodies: unknown[] = [];
  await stepDraftJob({
    ledger: ok.ledger,
    accountId: "user_1",
    jobId: ok.jobId,
    imageUrls: ["https://example.com/leo.jpg"],
    token: "test-token",
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ id: "pred", status: "succeeded", output: "https://example.com/clip.mp4" }), { status: 201 });
    },
  });
  assert.equal(bodies.length, 7);
  assert.equal(JSON.stringify(bodies).includes("reference_videos"), false);
  assert.equal(JSON.stringify(bodies).includes("\"resolution\":\"480p\""), true);
  assert.equal(ok.ledger.exportState("user_1").jobs[0]?.stage, "assembly");
  assert.equal(ok.ledger.exportState("user_1").jobs[0]?.beatUrls?.length, 7);
});

test("lineup stills are the photos Seedance receives", async () => {
  const job = startedJob();
  job.ledger.setStage("user_1", job.jobId, "lineup");
  const bodies: Array<{ input: { reference_images?: string[] } }> = [];
  let calls = 0;
  await stepDraftJob({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    imageUrls: ["https://example.com/original.jpg"],
    token: "test-token",
    fetchImpl: async (_url, init) => {
      calls += 1;
      const body = JSON.parse(String(init?.body)) as { input: { reference_images?: string[] } };
      bodies.push(body);
      return new Response(JSON.stringify({ output: `https://example.com/still-${calls}.jpg` }), { status: 201 });
    },
  });
  assert.equal(job.ledger.exportState("user_1").jobs[0]?.stage, "beats");
  assert.equal(job.ledger.exportState("user_1").jobs[0]?.stillUrls?.length, 2);
  job.ledger.setStage("user_1", job.jobId, "beats");
  await stepDraftJob({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    imageUrls: ["https://example.com/original.jpg"],
    token: "test-token",
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ output: "https://example.com/beat.mp4" }), { status: 201 });
    },
  });
  const beat = bodies.at(-1);
  assert.deepEqual(beat?.input.reference_images, [
    "https://example.com/still-1.jpg",
    "https://example.com/still-2.jpg",
  ]);
});

test("a processing prediction is polled until the output URL exists", async () => {
  const job = startedJob();
  job.ledger.setStage("user_1", job.jobId, "beats");
  let calls = 0;
  const stage = await stepDraftJob({
    ledger: job.ledger,
    accountId: "user_1",
    jobId: job.jobId,
    imageUrls: ["https://example.com/leo.jpg"],
    token: "test-token",
    wait: async () => {},
    fetchImpl: async () => {
      calls += 1;
      if (calls % 2 === 1) {
        return new Response(JSON.stringify({
          id: "pred",
          status: "processing",
          urls: { get: "https://api.replicate.com/v1/predictions/pred" },
        }), { status: 201 });
      }
      return new Response(JSON.stringify({
        id: "pred",
        status: "succeeded",
        output: ["https://example.com/clip.mp4"],
      }), { status: 200 });
    },
  });
  assert.equal(stage, "assembly");
  assert.equal(calls, 14);
});

test("assembly stitches the beat files and marks the draft ready", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "wiggly-clip-"));
  const clip = path.join(dir, "clip.mp4");
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=0.2", "-pix_fmt", "yuv420p", clip], { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
  });
  const bytes = await readFile(clip);
  const ready = startedJob();
  const photoRoot = await mkdtemp(path.join(tmpdir(), "wiggly-ready-"));
  ready.ledger.setStage("user_1", ready.jobId, "assembly");
  for (let index = 0; index < 7; index += 1) ready.ledger.addBeatUrl("user_1", ready.jobId, `https://example.com/${index}.mp4`);
  const stage = await stepDraftJob({
    ledger: ready.ledger,
    accountId: "user_1",
    jobId: ready.jobId,
    imageUrls: ["https://example.com/leo.jpg"],
    token: "test-token",
    photoRoot,
    photoSecret: "test-secret",
    publicOrigin: "https://wiggly.agentenamel.com",
    fetchImpl: async () => new Response(new Uint8Array(bytes)),
  });
  assert.equal(stage, "ready");
  const videoUrl = ready.ledger.exportState("user_1").jobs[0]?.videoUrl ?? "";
  assert.match(videoUrl, /^https:\/\/wiggly\.agentenamel\.com\/api\/mcp\/photos\/user_1\/draft-/);
  assert.match(videoUrl, /sig=/);
  const filename = decodeURIComponent(new URL(videoUrl).pathname.split("/").pop() ?? "");
  assert.ok((await stat(path.join(photoRoot, "user_1", filename))).size > 0);
});
