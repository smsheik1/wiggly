import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import { MCP_RESOURCE_URL, authkitDomain } from "../features/mcp/hosted-auth";
import { MemoryFilmLedger } from "../features/mcp/film-ledger";
import { createMcpRoute } from "../features/mcp/hosted-server";
import { workosTokenVerifier } from "../features/mcp/workos-verifier";
import type { Storyboard } from "../features/mcp/film-ledger";

const storyboard: Storyboard = {
  format: "my-pixar-story",
  title: "Sunday",
  subject: "Leo",
  beats: Array.from({ length: 7 }, () => ({
    duration_sec: 10,
    action: "Leo looks up.",
    camera: "Wide.",
    narration_line: "Hello",
  })),
  characters: [
    {
      name: "Leo",
      skinTone: "olive",
      description: [
        "Eyes: oversized round brown eyes, a small iris in a wide band of white sclera, bright catchlights.",
        "Face: soft round cheeks and a small nose.",
        "Hair: messy dark hair.",
        "Skin: warm matte skin.",
        "Silhouette: 4.5 heads tall, short and round.",
        "Wardrobe: striped shirt, shorts, sneakers.",
      ].join("\n"),
    },
    {
      name: "Mom",
      skinTone: "warm",
      description: [
        "Eyes: round brown eyes, a small iris in a wide band of white sclera.",
        "Face: soft closed-lip smile.",
        "Hair: short bob.",
        "Skin: warm matte skin.",
        "Silhouette: 7 heads tall, average build.",
        "Wardrobe: green coat.",
      ].join("\n"),
    },
  ],
  hero_props: [{ name: "Bike" }],
};

async function signedRoute(resumeGraph?: (resume: { runId: string; decision: Record<string, unknown> }) => Promise<{ state: { status?: string } }>, extras?: {
  ledger?: MemoryFilmLedger;
  loadAccount?: (accountId: string) => Promise<import("../features/mcp/film-ledger").Account>;
  saveAccount?: (accountId: string, account: import("../features/mcp/film-ledger").Account) => Promise<void>;
  listUploads?: (accountId: string) => Promise<Array<{ label: string; url: string }>>;
  renderStill?: NonNullable<Parameters<typeof createMcpRoute>[0]>["renderStill"];
  renderClip?: NonNullable<Parameters<typeof createMcpRoute>[0]>["renderClip"];
  runsRoot?: string;
  photoRoot?: string;
}) {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk.kid = "test";
  jwk.alg = "RS256";
  const token = await new SignJWT({ client_id: "client_test" })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject("user_1")
    .setIssuer(authkitDomain())
    .setAudience(MCP_RESOURCE_URL)
    .setExpirationTime("2m")
    .sign(privateKey);
  const route = createMcpRoute({
    verifier: workosTokenVerifier(createLocalJWKSet({ keys: [jwk] })),
    ledger: extras?.ledger ?? new MemoryFilmLedger(),
    resumeGraph,
    loadAccount: extras?.loadAccount,
    saveAccount: extras?.saveAccount,
    listUploads: extras?.listUploads,
    renderClip: extras?.renderClip,
    renderStill: extras?.renderStill,
    runsRoot: extras?.runsRoot,
    photoRoot: extras?.photoRoot,
  });
  return { token, route };
}

function mcpRequest(token: string, method: string, params: Record<string, unknown>, name?: string) {
  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": method,
  });
  if (name) headers.set("mcp-name", name);
  return new Request(MCP_RESOURCE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "wiggly-test", version: "1.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

test("a signed WorkOS token is accepted and a token for another resource is rejected", async () => {
  const { token, route } = await signedRoute();
  const missing = await route.POST(new Request(MCP_RESOURCE_URL, { method: "POST" }));
  assert.equal(missing.status, 401);

  const other = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject("user_1")
    .setIssuer(authkitDomain())
    .setAudience("https://example.com")
    .setExpirationTime("2m")
    .sign((await generateKeyPair("RS256")).privateKey);
  const rejected = await route.POST(new Request(MCP_RESOURCE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${other}` },
  }));
  assert.equal(rejected.status, 401);

  const listed = await route.POST(mcpRequest(token, "tools/list", {}));
  const body = await listed.json();
  assert.equal(listed.status, 200, JSON.stringify(body));
  const names = body.result.tools.map((tool: { name: string }) => tool.name);
  assert.deepEqual(names, [
    "wiggly_open_upload",
    "wiggly_list_uploads",
    "wiggly_submit_draft",
    "wiggly_story_director",
    "wiggly_character_architect",
    "wiggly_location_scout",
    "wiggly_storyboard_artist",
    "wiggly_seedance_compiler",
    "wiggly_get_draft",
    "wiggly_cancel_draft",
    "wiggly_approve_draft",
    "wiggly_reroll_panel",
    "wiggly_render_clip",
    "wiggly_reroll_clip",
  ]);
});

test("list uploads returns the label and a signed url", async () => {
  const { token, route } = await signedRoute(undefined, {
    listUploads: async () => [{ label: "Leo", url: "https://wiggly.agentenamel.com/api/mcp/photos/user_1/Leo.jpg?exp=1&sig=abc" }],
  });
  const listed = await route.POST(mcpRequest(token, "tools/call", { name: "wiggly_list_uploads", arguments: {} }, "wiggly_list_uploads"));
  const body = await listed.json();
  assert.equal(listed.status, 200, JSON.stringify(body));
  assert.equal(body.result.structuredContent.photos[0].label, "Leo");
  assert.match(body.result.structuredContent.photos[0].url, /Leo\.jpg/);
});

test("submit starts a draft without a quote, and hides another account's job", async () => {
  const ledger = new MemoryFilmLedger();
  ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  ledger.attachPhotos("user_1", ["Mom", "Leo"]);
  const started = ledger.submitDraft("user_1", { storyboard });
  assert.equal(started.ok, true);
  if (!started.ok) return;
  assert.equal(started.data.stage, "queued");
  assert.equal(ledger.exportState("user_1").monthlyCredits, 1900);
  const again = ledger.submitDraft("user_1", { storyboard });
  assert.equal(again.ok && again.data.job_id, started.data.job_id);
  const spent = ledger.spendCredits("user_1", String(started.data.job_id), 8);
  assert.equal(spent.ok, true);
  assert.equal(ledger.exportState("user_1").monthlyCredits, 1892);
  const other = ledger.getDraft("user_2", String(started.data.job_id));
  assert.equal(other.ok, false);
  ledger.failJob("user_1", String(started.data.job_id), "Seedance failed");
  const failed = ledger.getDraft("user_1", String(started.data.job_id));
  assert.equal(failed.ok && failed.data.creditsRefunded, true);
  assert.equal(failed.ok && failed.data.stage, "failed");
});

test("a short balance reuses one checkout link and payment grants credits", () => {
  const ledger = new MemoryFilmLedger();
  ledger.attachPhotos("user_1", ["Mom", "Leo"]);
  const first = ledger.submitDraft("user_1", { storyboard });
  const second = ledger.submitDraft("user_1", { storyboard });
  assert.equal(first.ok, false);
  assert.equal(second.ok, false);
  if (first.ok || second.ok) return;
  assert.match(first.message, /billing\/credits\?plan=monthly&checkout=/);
  assert.equal(second.message, first.message);
  ledger.applyPayment("user_1", "subscription", "cus_test");
  assert.equal(ledger.exportState("user_1").monthlyCredits, 1900);
  ledger.applyPayment("user_1", "pack");
  assert.equal(ledger.exportState("user_1").purchasedCredits, 1900);
  assert.equal(ledger.exportState("user_1").monthlyCredits, 1900);
});

test("no photos returns an upload link and does not offer checkout", () => {
  const ledger = new MemoryFilmLedger();
  const result = ledger.submitDraft("user_1", { storyboard });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /upload\//);
  assert.equal(result.message.includes("billing"), false);
});

test("get draft reads the v2 state file and approve resumes that run", async () => {
  let decision: Record<string, unknown> | undefined;
  const { token, route } = await signedRoute(async (resume) => {
    decision = resume.decision;
    return { state: { status: "awaiting-approval", pendingApproval: ["animatic"] } };
  });
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);
  const submitted = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard },
  }, "wiggly_submit_draft"));
  const started = await submitted.json();
  assert.equal(submitted.status, 200, JSON.stringify(started));
  const jobId = started.result.structuredContent.job_id as string;
  const stateFile = path.join(tmpdir(), `wiggly-hosted-${jobId}`, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ status: "awaiting-approval", pendingApproval: ["@Image 1"] }));
  route.ledger.setRun("user_1", jobId, { runId: jobId, stateFile });
  const polled = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_get_draft",
    arguments: { job_id: jobId },
  }, "wiggly_get_draft"));
  const pollBody = await polled.json();
  assert.equal(pollBody.result.structuredContent.studio_status, "awaiting-approval");
  assert.deepEqual(pollBody.result.structuredContent.pending_approval, ["@Image 1"]);
  const approved = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: { job_id: jobId, decision: { approvedAssets: { "@Image 1": "asset:master-render:leo" } } },
  }, "wiggly_approve_draft"));
  const approveBody = await approved.json();
  assert.equal(approved.status, 200, JSON.stringify(approveBody));
  assert.deepEqual(decision?.approvedAssets, { "@Image 1": "asset:master-render:leo" });
  assert.equal(route.ledger.exportState("user_1").monthlyCredits, 1900);
});

test("approve on a Convex ledger loads the account, resumes, and saves it back", async () => {
  const source = new MemoryFilmLedger();
  source.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  source.attachPhotos("user_1", ["Leo", "Mom"]);
  const started = source.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("start failed");
  const jobId = String(started.data.job_id);
  const stateFile = path.join(tmpdir(), `wiggly-convex-${jobId}`, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ status: "awaiting-production", pendingApproval: ["production"] }));
  source.setRun("user_1", jobId, { runId: jobId, stateFile });
  let savedCredits = 0;
  const { token, route } = await signedRoute(async () => ({ state: { status: "running", pendingApproval: [] } }), {
    ledger: {
      openUpload() { throw new Error("unused"); },
      submitDraft() { throw new Error("unused"); },
      getDraft: () => source.getDraft("user_1"),
    } as unknown as MemoryFilmLedger,
    loadAccount: async () => source.exportState("user_1"),
    saveAccount: async (_accountId, account) => { savedCredits = account.monthlyCredits; },
  });
  const approved = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: { job_id: jobId, decision: { decision: "approve" } },
  }, "wiggly_approve_draft"));
  const body = await approved.json();
  assert.equal(approved.status, 200, JSON.stringify(body));
  assert.equal(savedCredits, 1900);
});

test("wiggly_render_clip renders a single segment and charges duration * 21 credits", async () => {
  let clipRenderedWithDuration = 0;
  const { token, route } = await signedRoute(undefined, {
    renderClip: async (req: { itemId?: string; duration?: number }) => {
      clipRenderedWithDuration = req.duration ?? 0;
      const dest = path.join(tmpdir(), `test-clip-${req.itemId}.mp4`);
      await writeFile(dest, "fake-mp4-data");
      return { videoPath: dest, dest };
    },
  });
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);
  const started = route.ledger.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("start failed");
  const jobId = String(started.data.job_id);
  const runDir = path.join(tmpdir(), `wiggly-single-clip-${jobId}`);
  const stateFile = path.join(runDir, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({
    status: "awaiting-production",
    pendingApproval: ["production"],
    seedanceCompiler: {
      output: {
        segments: [
          { segmentId: 1, generationPayload: { durationSec: 10 } },
          { segmentId: 2, generationPayload: { durationSec: 10 } },
        ],
      },
    },
  }));
  route.ledger.setRun("user_1", jobId, { runId: jobId, stateFile });

  const called = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_render_clip",
    arguments: { job_id: jobId, clip_id: 1 },
  }, "wiggly_render_clip"));
  const body = await called.json();
  assert.equal(called.status, 200, JSON.stringify(body));
  const res = JSON.parse(body.result.content[0].text);
  assert.equal(res.clipId, "1");
  assert.equal(res.creditsSpent, 210); // 10s * 21 credits = 210
  assert.equal(clipRenderedWithDuration, 10);
  assert.ok(res.videoUrl);

  const updatedState = JSON.parse(await readFile(stateFile, "utf8"));
  assert.equal(updatedState.status, "awaiting-production");
  assert.ok(updatedState.assetFiles["clip-1"]);
  assert.equal(route.ledger.exportState("user_1").monthlyCredits, 1900 - 210);

  // Calling wiggly_render_clip again performs a fresh re-render and charges credits
  const reCalled = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_render_clip",
    arguments: { job_id: jobId, clip_id: 1 },
  }, "wiggly_render_clip"));
  const reBody = await reCalled.json();
  assert.equal(reCalled.status, 200);
  const reRes = JSON.parse(reBody.result.content[0].text);
  assert.equal(reRes.status, "ready");
  assert.equal(reRes.clipId, "1");
  assert.equal(reRes.creditsSpent, 210);
  assert.equal(route.ledger.exportState("user_1").monthlyCredits, 1900 - 420);
  assert.ok(reRes.videoUrl);

  // wiggly_reroll_clip forces re-render with updated prompt
  const rerolled = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_reroll_clip",
    arguments: { job_id: jobId, clip_id: 1, prompt: "Updated high-energy camera prompt" },
  }, "wiggly_reroll_clip"));
  const rerollBody = await rerolled.json();
  assert.equal(rerolled.status, 200);
  const rerollRes = JSON.parse(rerollBody.result.content[0].text);
  assert.equal(rerollRes.status, "ready");
  assert.equal(rerollRes.clipId, "1");
  assert.equal(route.ledger.exportState("user_1").monthlyCredits, 1900 - 630);

  const stateAfterReroll = JSON.parse(await readFile(stateFile, "utf8"));
  assert.equal(stateAfterReroll.seedanceCompiler.output.segments[0].compiledPrompt, "Updated high-energy camera prompt");

  // wiggly_get_draft returns production_preview and guidance
  const polled = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_get_draft",
    arguments: { job_id: jobId },
  }, "wiggly_get_draft"));
  const pollBody = await polled.json();
  const content = pollBody.result.structuredContent;
  assert.equal(content.studio_status, "awaiting-production");
  assert.ok(content.production_preview);
  assert.equal(content.production_preview.total_clips, 2);
  assert.equal(content.production_preview.rendered_clips_count, 1);
  assert.equal(content.production_preview.unrendered_clips_count, 1);
  assert.ok(content.guidance);
});

test("wiggly_render_clip returns status rendering immediately in async mode", async () => {
  const { token, route } = await signedRoute();
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);
  const started = route.ledger.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("start failed");
  const jobId = String(started.data.job_id);
  const runDir = path.join(tmpdir(), `wiggly-async-clip-${jobId}`);
  const stateFile = path.join(runDir, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({
    status: "awaiting-production",
    pendingApproval: ["production"],
    seedanceCompiler: {
      output: {
        segments: [
          { segmentId: 1, generationPayload: { durationSec: 10 } },
        ],
      },
    },
  }));
  route.ledger.setRun("user_1", jobId, { runId: jobId, stateFile });

  const start = Date.now();
  const called = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_render_clip",
    arguments: { job_id: jobId, clip_id: 1 },
  }, "wiggly_render_clip"));
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 1000, `Expected fast async response under 1000ms, took ${elapsed}ms`);

  const body = await called.json();
  assert.equal(called.status, 200, JSON.stringify(body));
  const res = JSON.parse(body.result.content[0].text);
  assert.equal(res.status, "rendering");
  assert.equal(res.clipId, "1");
  assert.equal(res.retryAfterSec, 15);

  const stateOnDisk = JSON.parse(await readFile(stateFile, "utf8"));
  assert.ok(stateOnDisk.renderingClip);
  assert.equal(stateOnDisk.renderingClip.clipId, "1");
});

test("S1: duplicate submit stops lying and cancel draft frees the slot", async () => {
  const { token, route } = await signedRoute();
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);

  // 1. First submit
  const first = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard },
  }, "wiggly_submit_draft"));
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  const firstData = firstBody.result.structuredContent;
  assert.ok(firstData.job_id);
  assert.ok(firstData.estimatedCredits);
  assert.equal(firstData.estimatedCredits.total, 1718); // 104 + 144 + 70s*21
  const jobId = firstData.job_id;

  // 2. Duplicate submit with same storyboard returns alreadyActive: true
  const dup = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard },
  }, "wiggly_submit_draft"));
  const dupBody = await dup.json();
  assert.equal(dup.status, 200, JSON.stringify(dupBody));
  const dupData = dupBody.result.structuredContent;
  assert.equal(dupData.alreadyActive, true);
  assert.equal(dupData.job_id, jobId);

  // 3. Duplicate submit with different storyboard is refused with helpful message
  const differentStoryboard = {
    ...storyboard,
    title: "A Completely Different Film Title",
  };
  const diff = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard: differentStoryboard },
  }, "wiggly_submit_draft"));
  const diffBody = await diff.json();
  assert.equal(diffBody.result.isError, true);
  assert.match(diffBody.result.content[0].text, /with a different storyboard/);
  assert.match(diffBody.result.content[0].text, /wiggly_cancel_draft/);

  // 4. Cancel while running is refused
  route.ledger.setStage("user_1", jobId, "running");
  const cancelRunning = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_cancel_draft",
    arguments: { job_id: jobId },
  }, "wiggly_cancel_draft"));
  const crBody = await cancelRunning.json();
  assert.equal(crBody.result.isError, true);
  assert.match(crBody.result.content[0].text, /Wait for the current step to finish/);

  // 5. Cancel while awaiting-approval succeeds and frees the job slot
  route.ledger.setStage("user_1", jobId, "awaiting-approval");
  const cancelAwaiting = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_cancel_draft",
    arguments: { job_id: jobId },
  }, "wiggly_cancel_draft"));
  const caBody = await cancelAwaiting.json();
  assert.ok(!caBody.result.isError, JSON.stringify(caBody));
  assert.equal(caBody.result.structuredContent.stage, "cancelled");

  // 6. Account slot is now freed, new storyboard can be submitted!
  const resubmit = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard: differentStoryboard },
  }, "wiggly_submit_draft"));
  const resubmitBody = await resubmit.json();
  assert.equal(resubmit.status, 200);
  assert.ok(!resubmitBody.result.isError);
  assert.notEqual(resubmitBody.result.structuredContent.job_id, jobId);
});

test("S2 & S3: Gate 3 cost estimate, acknowledged_credits enforcement, and reject never sets failed", async () => {
  const { token, route } = await signedRoute();
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 1900 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);

  const started = route.ledger.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("Draft submit failed");
  const jobId = String(started.data.job_id);
  const runDir = path.join(tmpdir(), `wiggly-gate3-test-${jobId}`);
  const stateFile = path.join(runDir, "outputs", "state.json");
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({
    status: "awaiting-production",
    renderStage: "clips",
    pendingApproval: ["production"],
    seedanceCompiler: {
      output: {
        segments: [
          { segmentId: 1, generationPayload: { durationSec: 24 } },
          { segmentId: 2, generationPayload: { durationSec: 24 } },
          { segmentId: 3, generationPayload: { durationSec: 24 } },
        ],
      },
    },
  }));
  route.ledger.setRun("user_1", jobId, { runId: jobId, stateFile });
  route.ledger.setStage("user_1", jobId, "awaiting-approval");

  // 1. wiggly_get_draft returns gate: 'production' and nextStepCost: 1512
  const polled = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_get_draft",
    arguments: { job_id: jobId },
  }, "wiggly_get_draft"));
  const pollBody = await polled.json();
  const draftContent = pollBody.result.structuredContent;
  assert.equal(draftContent.gate, "production");
  assert.equal(draftContent.nextStepCost, 1512); // 72s * 21

  // 2. Rejecting Gate 3 records notes, stays in awaiting-production, and NEVER sets failed
  const rejectGate3 = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: {
      job_id: jobId,
      decision: { decision: "reject", notes: "Make lighting warmer and pacing slower" },
    },
  }, "wiggly_approve_draft"));
  const rejBody = await rejectGate3.json();
  assert.ok(!rejBody.result.isError, JSON.stringify(rejBody));
  const rejData = rejBody.result.structuredContent;
  assert.equal(rejData.status, "awaiting-production");
  const stateAfterReject = JSON.parse(await readFile(stateFile, "utf8"));
  assert.equal(stateAfterReject.status, "awaiting-production");
  assert.equal(stateAfterReject.productionNotes, "Make lighting warmer and pacing slower");

  // 3. Approving without acknowledged_credits is refused
  const approveNoAck = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: {
      job_id: jobId,
      decision: { decision: "approve" },
    },
  }, "wiggly_approve_draft"));
  const noAckBody = await approveNoAck.json();
  assert.equal(noAckBody.result.isError, true);
  assert.match(noAckBody.result.content[0].text, /requires acknowledged_credits: 1512/);

  // 4. Approving with insufficient balance is refused with top-up link
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 100, purchasedCredits: 0 });
  const approveLowBalance = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: {
      job_id: jobId,
      decision: { decision: "approve", acknowledged_credits: 1512 },
    },
  }, "wiggly_approve_draft"));
  const lowBalBody = await approveLowBalance.json();
  assert.equal(lowBalBody.result.isError, true);
  assert.match(lowBalBody.result.content[0].text, /Insufficient credits for production render/);
  assert.match(lowBalBody.result.content[0].text, /Top up here:/);
});

test("S4: typed approve schema with gate, gate mismatch rejection, and animatic reject routing", async () => {
  const runsRoot = await mkdtemp(path.join(tmpdir(), "wiggly-s4-"));
  const { token, route } = await signedRoute(async () => ({ state: { status: "running" } }), { runsRoot });
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 2000, purchasedCredits: 0 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);

  const started = route.ledger.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("Draft should submit");
  const jobId = String(started.data.job_id);

  // Setup state awaiting sheets
  const runDir = path.join(runsRoot, "my-pixar-story", "runs", "run-1");
  await mkdir(path.join(runDir, "outputs"), { recursive: true });
  const stateFile = path.join(runDir, "outputs", "state.json");
  await writeFile(stateFile, JSON.stringify({
    runId: "run-1",
    status: "awaiting-approval",
    pendingApproval: ["sheets"],
    characterArchitect: {
      output: {
        characters: [{ elementTag: "@Leo", characterId: "leo" }],
      },
    },
    locationScout: {
      output: {
        locations: [{ elementTag: "@LivingRoom", locationId: "living-room" }],
      },
    },
  }));
  route.ledger.setRun("user_1", jobId, { runId: "run-1", stateFile });
  route.ledger.setStage("user_1", jobId, "awaiting-approval");

  // Gate mismatch: trying to approve "production" while at "sheets"
  const mismatchRes = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: {
      job_id: jobId,
      gate: "production",
      decision: "approve",
    },
  }, "wiggly_approve_draft"));
  const mismatchBody = await mismatchRes.json();
  assert.equal(mismatchBody.result.isError, true);
  assert.match(mismatchBody.result.content[0].text, /Mismatched gate: current gate is "sheets", received "production"/);

  // Matching gate approval with typed schema without specifying asset_ids (auto-approves sheets)
  const sheetsApprove = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: {
      job_id: jobId,
      gate: "sheets",
      decision: "approve",
    },
  }, "wiggly_approve_draft"));
  const sheetsApproveBody = await sheetsApprove.json();
  assert.ok(!sheetsApproveBody.result.isError, JSON.stringify(sheetsApproveBody));

  // Now advance to animatic gate
  await writeFile(stateFile, JSON.stringify({
    runId: "run-1",
    status: "awaiting-approval",
    pendingApproval: ["animatic"],
  }));

  // Gate mismatch: trying to approve "sheets" while at "animatic"
  const mismatchAnimatic = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: {
      job_id: jobId,
      gate: "sheets",
      decision: "approve",
    },
  }, "wiggly_approve_draft"));
  const mismatchAnimBody = await mismatchAnimatic.json();
  assert.equal(mismatchAnimBody.result.isError, true);
  assert.match(mismatchAnimBody.result.content[0].text, /Mismatched gate: current gate is "animatic", received "sheets"/);

  // Reject animatic without shot_ids -> routes to storyboard-artist
  const rejectAnimatic = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_approve_draft",
    arguments: {
      job_id: jobId,
      gate: "animatic",
      decision: "reject",
      notes: "Pacing is too fast in scene 2",
    },
  }, "wiggly_approve_draft"));
  const rejectBody = await rejectAnimatic.json();
  assert.ok(!rejectBody.result.isError);
  const rejectParsed = JSON.parse(rejectBody.result.content[0].text);
  assert.equal(rejectParsed.target, "storyboard-artist");
});

test("S5: bounded storyboard enforces exactly 7 beats and max 75 seconds", async () => {
  const { token, route } = await signedRoute();
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 2000, purchasedCredits: 0 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);

  // 1. 8 beats is rejected by schema
  const eightBeats = {
    ...storyboard,
    beats: [
      ...storyboard.beats,
      { duration_sec: 10, action: "Extra beat", camera: "Wide" },
    ],
  };
  const res8 = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard: eightBeats },
  }, "wiggly_submit_draft"));
  const body8 = await res8.json();
  assert.equal(body8.result.isError, true);

  // 2. 6 beats is rejected by schema
  const sixBeats = {
    ...storyboard,
    beats: storyboard.beats.slice(0, 6),
  };
  const res6 = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard: sixBeats },
  }, "wiggly_submit_draft"));
  const body6 = await res6.json();
  assert.equal(body6.result.isError, true);

  // 3. 7 beats totaling > 75 seconds (e.g. 7 * 12 = 84s)
  const longStory = {
    ...storyboard,
    beats: storyboard.beats.map((b) => ({ ...b, duration_sec: 12 })),
  };
  const resLong = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard: longStory },
  }, "wiggly_submit_draft"));
  const bodyLong = await resLong.json();
  assert.equal(bodyLong.result.isError, true);
  assert.match(bodyLong.result.content[0].text, /storyboard\.beats total 84s exceeds the 75s maximum/);
});

test("S6: wiggly_list_uploads returns JPEG thumbnails alongside labels and filenames", async () => {
  const photoRoot = await mkdtemp(path.join(tmpdir(), "wiggly-photos-"));
  const userUploads = path.join(photoRoot, "user_1");
  await mkdir(userUploads, { recursive: true });

  // Create a sample 100x100 JPEG image using jpeg-js
  const jpeg = (await import("jpeg-js")).default;
  const rawData = Buffer.alloc(100 * 100 * 4, 128);
  const sampleJpeg = jpeg.encode({ width: 100, height: 100, data: rawData }, 80).data;
  await writeFile(path.join(userUploads, "leo.jpg"), sampleJpeg);

  const { token, route } = await signedRoute(undefined, { photoRoot });
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 2000, purchasedCredits: 0 });

  // 1. Zero photos returns upload page hint
  const resEmpty = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_list_uploads",
    arguments: {},
  }, "wiggly_list_uploads"));
  const bodyEmpty = await resEmpty.json();
  assert.ok(!bodyEmpty.result.isError);
  assert.match(bodyEmpty.result.content[0].text, /No photos yet\. Open/);

  // 2. Uploaded photos return labels, filenames, and image thumbnail blocks
  route.ledger.attachPhotoFiles("user_1", [{ label: "Leo", filename: "leo.jpg" }]);
  const resPhotos = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_list_uploads",
    arguments: {},
  }, "wiggly_list_uploads"));
  const bodyPhotos = await resPhotos.json();
  assert.ok(!bodyPhotos.result.isError);
  const textContent = bodyPhotos.result.content.find((c: any) => c.type === "text");
  assert.ok(textContent);
  assert.match(textContent.text, /"label":"Leo"/);
  assert.match(textContent.text, /"filename":"leo.jpg"/);

  const imageContent = bodyPhotos.result.content.find((c: any) => c.type === "image");
  assert.ok(imageContent);
  assert.equal(imageContent.mimeType, "image/jpeg");
  assert.ok(imageContent.data.length > 0);
});

test("S7: idle gates expire after 7 days, freeing slot and returning abandoned status", async () => {
  const { token, route } = await signedRoute();
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 2000, purchasedCredits: 0 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);

  const started = route.ledger.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("Submit failed");
  const jobId = String(started.data.job_id);

  // Put in awaiting-approval
  route.ledger.setStage("user_1", jobId, "awaiting-approval");

  // 1. If idle for 6 days (6 * 24h), still blocks new submit
  const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;
  const acc = route.ledger.exportState("user_1");
  acc.jobs[0].updatedAt = sixDaysAgo;
  route.ledger.importState("user_1", acc);

  const diffStory = { ...storyboard, title: "Different Title" };
  const blockedSubmit = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard: diffStory },
  }, "wiggly_submit_draft"));
  const blockedBody = await blockedSubmit.json();
  assert.equal(blockedBody.result.isError, true);
  assert.match(blockedBody.result.content[0].text, /is at awaiting-approval with a different storyboard/);

  // 2. If idle for 7 days + 1 hour, expires to abandoned and frees slot
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000 + 3600 * 1000);
  acc.jobs[0].updatedAt = sevenDaysAgo;
  route.ledger.importState("user_1", acc);

  // Inspect via get_draft
  const getDraftRes = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_get_draft",
    arguments: { job_id: jobId },
  }, "wiggly_get_draft"));
  const getDraftBody = await getDraftRes.json();
  assert.ok(!getDraftBody.result.isError);
  assert.match(getDraftBody.result.content[0].text, /"stage":"abandoned"/);
  assert.match(getDraftBody.result.content[0].text, /Job was abandoned after 7 days of inactivity/);

  // New submit now succeeds because slot is freed!
  const newSubmit = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: { storyboard: diffStory },
  }, "wiggly_submit_draft"));
  const newSubmitBody = await newSubmit.json();
  assert.ok(!newSubmitBody.result.isError);
  const newJob = JSON.parse(newSubmitBody.result.content[0].text);
  assert.notEqual(newJob.job_id, jobId);
});

test("S8: dead surface removed and legacy stages mapped to running", async () => {
  const { token, route } = await signedRoute();
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 2000, purchasedCredits: 0 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);

  // 1. Old client sending confirm and quote_id passes through without schema error
  const legacySubmit = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_submit_draft",
    arguments: {
      storyboard,
      confirm: true,
      quote_id: "quote-legacy-123",
    },
  }, "wiggly_submit_draft"));
  const legBody = await legacySubmit.json();
  assert.ok(!legBody.result.isError);

  // 2. Legacy stage values like lineup/beats/assembly are exposed as "running"
  const jobId = JSON.parse(legBody.result.content[0].text).job_id;
  route.ledger.setStage("user_1", jobId, "lineup");

  const getLineup = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_get_draft",
    arguments: { job_id: jobId },
  }, "wiggly_get_draft"));
  const lineupBody = await getLineup.json();
  assert.ok(!lineupBody.result.isError);
  assert.match(lineupBody.result.content[0].text, /"stage":"running"/);

  route.ledger.setStage("user_1", jobId, "beats");
  const getBeats = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_get_draft",
    arguments: { job_id: jobId },
  }, "wiggly_get_draft"));
  const beatsBody = await getBeats.json();
  assert.match(beatsBody.result.content[0].text, /"stage":"running"/);
});

test("S9: finished ready film remains retrievable indefinitely with fresh signed URLs", async () => {
  const runsRoot = await mkdtemp(path.join(tmpdir(), "wiggly-s9-"));
  const { token, route } = await signedRoute(undefined, { runsRoot });
  route.ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 2000, purchasedCredits: 0 });
  route.ledger.attachPhotos("user_1", ["Leo", "Mom"]);

  const started = route.ledger.submitDraft("user_1", { storyboard });
  if (!started.ok) throw new Error("Submit failed");
  const jobId = String(started.data.job_id);

  const runDir = path.join(runsRoot, "my-pixar-story", "runs", "run-1");
  await mkdir(path.join(runDir, "outputs"), { recursive: true });
  const masterMp4 = path.join(runDir, "outputs", "master.mp4");
  await writeFile(masterMp4, "fake mp4 content");
  const stateFile = path.join(runDir, "outputs", "state.json");
  await writeFile(stateFile, JSON.stringify({
    runId: "run-1",
    status: "ready",
    assetFiles: { "master-video": masterMp4 },
    masterVideo: masterMp4,
  }));
  route.ledger.setRun("user_1", jobId, { runId: "run-1", stateFile });
  route.ledger.setStage("user_1", jobId, "ready");

  // Call wiggly_get_draft
  const res1 = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_get_draft",
    arguments: { job_id: jobId },
  }, "wiggly_get_draft"));
  const body1 = await res1.json();
  assert.ok(!body1.result.isError);
  const data1 = JSON.parse(body1.result.content[0].text);
  assert.equal(data1.stage, "ready");
  assert.ok(data1.videoUrl);
  assert.match(data1.videoUrl, /\/renders\/.*[?&]sig=/);

  // Calling again later generates another valid signed URL
  const res2 = await route.POST(mcpRequest(token, "tools/call", {
    name: "wiggly_get_draft",
    arguments: { job_id: jobId },
  }, "wiggly_get_draft"));
  const body2 = await res2.json();
  assert.ok(!body2.result.isError);
  const data2 = JSON.parse(body2.result.content[0].text);
  assert.equal(data2.stage, "ready");
  assert.ok(data2.videoUrl);
});
