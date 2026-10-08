import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createProbe, prepareWorkspace } from "./harness.js";
import { ScriptedModel, call } from "./offline-model.js";
import { tracing } from "./tracing.js";

const root = join(import.meta.dirname, "output/trace-fixture");
await mkdir(root, { recursive: true });
await prepareWorkspace(root, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYOQAAAAASUVORK5CYII=", "base64"));
const model = new ScriptedModel([
  () => call("read_file", { file_path: "/skills/inspection-probe/SKILL.md" }),
  () => call("read_file", { file_path: "/references/probe.png" }),
  () => call("submit_probe", { quadrants: ["mock", "mock", "mock", "mock"], skill_marker: "QUADRANT-EVIDENCE-731" }),
]);
const { client, failures, tracer } = await tracing();
const { agent } = createProbe(model, root, "openai:isolated-scripted-model");
const id = randomUUID();
await agent.invoke({ messages: [{ role: "user", content: "Isolated scripted harness trace test; no real model inference or production approval." }] }, {
  runId: id, callbacks: [tracer], recursionLimit: 16,
  metadata: { phase: 1, isolated_mock: true, provider_spend_usd: 0 },
});
await client.awaitPendingTraceBatches();
assert.deepEqual(failures, []);
const run = await client.readRun(id, { loadChildRuns: true });
const allRuns = (r: any): any[] => [r, ...(r.child_runs ?? []).flatMap(allRuns)];
const children = allRuns(run);
assert.ok(children.some(r => r.run_type === "tool"));
assert.ok(children.some(r => r.run_type === "llm"));
assert.ok(!JSON.stringify(run).includes("base64,") && !JSON.stringify(run).includes("iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"), "Media bytes leaked into trace");
const url = await client.getRunUrl({ run });
const result = { run_id: id, url, child_run_count: children.length - 1, has_tools: true, has_model_nodes: true, media_payloads_removed: true, real_model_inference: false, verified_provider_charge_usd: 0 };
await writeFile(join(import.meta.dirname, "output/trace-check.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
