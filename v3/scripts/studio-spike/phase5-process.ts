// Explicit isolated process fixture; never calls an external provider.
import { StudioProduction } from "../../lib/studio-production.js";
import { writeFileSync } from "node:fs";
import { hash } from "./harness.js";
const [root, ticket, action, estimate = "100"] = process.argv.slice(2);
const began = Date.now();
if (action === "contention") writeFileSync(root + "/" + ticket + ".starting", "ATTEMPTING_SQLITE_OPEN");
const store = new StudioProduction(root);
try {
  const ctx = store.claim(ticket, ticket, 60000);
  if (!["claim", "contention"].includes(action)) store.prepareOperation(ctx, { operationId: ticket, provider: "mock", requestHash: hash(Buffer.from(ticket)), estimateMicros: Number(estimate) });
  if (action === "start") store.startOperation(ctx, ticket);
  console.log(JSON.stringify({ ticket, success: true, ctx, elapsed_ms: Date.now() - began }));
} catch (error: any) { console.log(JSON.stringify({ ticket, error: error.message })); }
finally { store.close(); }
