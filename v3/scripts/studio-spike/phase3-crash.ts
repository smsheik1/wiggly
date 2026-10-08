// Explicit isolated local mock provider. No keys, HTTP, or production paths.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { StudioProduction, type KillPoint } from "../../lib/studio-production.js";
import { hash } from "./harness.js";
const [root, point, worker = "worker"] = process.argv.slice(2);
if (point === "claim") {
  const store = new StudioProduction(root);
  try { console.log(JSON.stringify({ lease: store.claim("ticket", worker, 30000) })); }
  catch (error: any) { console.log(JSON.stringify({ error: error.message })); }
  finally { store.close(); }
} else {
  const store = new StudioProduction(root, Date.now, reached => {
    if (reached === point as KillPoint) { writeFileSync(join(root, "kill-point.json"), JSON.stringify({ reached })); process.kill(process.pid, "SIGKILL"); }
  });
  store.createProject("project", 1000000);
  store.operator("project", "resume", 0, { id: "test-resume", actor: "test-operator", reason: "Isolated mock test" });
  store.setInput("project", "script", "script-v1");
  store.createTicket("ticket", "project", "author", { script: "script-v1" }, 1000000);
  const ctx = store.claim("ticket", worker, 60000);
  writeFileSync(join(root, "lease.json"), JSON.stringify(ctx));
  if (point.startsWith("after_pub")) {
    writeFileSync(join(store.draftDirectory(ctx), "plate.txt"), "ORIGINAL_DRAFT_BYTES");
    const evidence = store.mediaSupplied(ctx, Buffer.from("ORIGINAL_DRAFT_BYTES"), { runId: "mock-run", model: "explicit-local-mock", modality: "text", coverage: "complete fixture" });
    store.inspectionCompleted(ctx, evidence, "Explicit mock fixture inspection of original draft bytes.");
    writeFileSync(join(root, "evidence.json"), JSON.stringify([evidence]));
    store.publish(ctx, { draft_path: "plate.txt", evidence_references: [evidence] });
  } else {
    await store.executeOperation(ctx, { operationId: "operation", provider: "explicit-mock", requestHash: hash(Buffer.from("mock request")), estimateMicros: 300000 }, async operationId => {
      writeFileSync(join(root, "mock-provider.json"), JSON.stringify({ operationId, requestId: "known-request", submissions: 1, artifact: "mock-artifact-reference" }));
      return { requestId: "known-request" };
    }, () => "Explicit local mock error");
  }
  throw new Error("Named kill point was not reached");
}
