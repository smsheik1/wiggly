import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { MemoryFilmLedger } from "../features/mcp/film-ledger";
import { stripeClient, stripeSetupError } from "../features/mcp/stripe-billing";

test("Convex schema keeps the live product tables and adds the MCP job fields", () => {
  const schema = readFileSync("convex/schema.ts", "utf8");
  for (const table of ["sessions", "adScenes", "researchRuns", "mcpAccounts", "mcpCreditBalances", "mcpQuotes", "mcpJobs"]) {
    assert.ok(schema.includes(table), table);
  }
  for (const field of ["awaiting-approval", "awaiting-credits", "running", "runId", "stateFile"]) {
    assert.ok(schema.includes(field), field);
  }
});

test("an account round-trips through the ledger state the Convex mutations store", () => {
  const ledger = new MemoryFilmLedger();
  ledger.setAccount("user_1", { subscribed: true, monthlyCredits: 100 });
  ledger.attachPhotos("user_1", ["Leo"]);
  const stored = ledger.exportState("user_1");
  const restored = new MemoryFilmLedger();
  restored.importState("user_1", stored);
  assert.deepEqual(restored.exportState("user_1"), stored);
});

test("a missing Stripe key tells the operator where to paste it", () => {
  const message = stripeSetupError("STRIPE_SECRET_KEY");
  assert.match(message, /https:\/\/dashboard.stripe.com\/apikeys/);
  assert.match(message, /secrets\.env/);
  assert.match(message, /STRIPE_SECRET_KEY=/);
});

test("checkout refuses to start without a Stripe key", async () => {
  await assert.rejects(() => stripeClient(), /STRIPE_SECRET_KEY/);
});
