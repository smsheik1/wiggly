import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
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
  assert.deepEqual(names, ["wiggly_open_upload", "wiggly_submit_draft", "wiggly_get_draft", "wiggly_approve_draft"]);
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
  assert.equal(route.ledger.exportState("user_1").monthlyCredits, 1892);
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
  assert.equal(savedCredits, 1900 - 21 * 10);
});
