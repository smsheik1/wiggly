import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NimModel } from "./nim-model.js";
import { nimTransport } from "./nim-transport.js";
import { createProbe, prepareWorkspace, hash } from "./harness.js";
import { namedSecret, tracing, secretsPath } from "./tracing.js";

// Inspection only: no creative generation or headless authoring bypasses the host bridge.
async function main() {
  const modelName = "moonshotai/kimi-k3";
  const apiKey = await namedSecret("NVIDIA_API_KEY");
  const { client, tracer, failures } = await tracing();
  const output = join(import.meta.dirname, "output");
  const trials = join(output, "live-trials");
  await mkdir(trials, { recursive: true });
  // ponytail: sequential spike only; M1 owns transactional multi-worker reservations.
  assert.ok((await readdir(trials)).length < 5, "The $5 total M0 trial allowance is reserved/exhausted; reconcile before extending.");
  const id = randomUUID(), root = join(trials, id);
  await mkdir(root);
  const intent = { id, model: modelName, status: "RESERVED", reserved_estimate_usd: 1, total_m0_allowance_usd: 5, verified_charge_usd: null };
  await writeFile(join(root, "intent.json"), JSON.stringify(intent, null, 2) + "\n", { flag: "wx" });
  const fixture = await readFile(join(import.meta.dirname, "probe.png"));
  const fixtureHash = hash(fixture);
  await prepareWorkspace(root, fixture);
  const model = new NimModel({ model: modelName, apiKey, maxRetries: 0, maxTokens: 4096, streaming: false, disableStreaming: true, useResponsesApi: false, temperature: 1, modelKwargs: { reasoning_effort: "low" }, configuration: { baseURL: "https://integrate.api.nvidia.com/v1", fetch: nimTransport() } });
  const { agent, submissions } = createProbe(model, root, `openai:${modelName}`);
  const events: any[] = [], usage: any[] = [];
  let calls = 0, imageTurn = false;
  const callbacks = {
    name: "phase1-inspection-evidence", raiseError: true,
    handleChatModelStart(_model: any, messages: any[][]) {
      assert.ok(++calls <= 8, "SPIKE_TURN_LIMIT");
      assert.ok(Buffer.byteLength(JSON.stringify(messages)) <= 65536, "SPIKE_INPUT_BOUND");
      imageTurn = messages.flat().some((m: any) => m.contentBlocks?.some((b: any) => b.type === "image" && (b.data === fixture.toString("base64") || b.url?.includes(fixture.toString("base64")))));
      if (imageTurn) events.push({ status: "MEDIA_REQUEST_INITIATED", artifact_sha256: fixtureHash });
    },
    handleLLMEnd(output: any) {
      const response = output.generations[0]?.[0]?.message;
      if (response?.usage_metadata) usage.push(response.usage_metadata);
      if (imageTurn) events.push({ status: "MODEL_RESPONSE_RECEIVED", artifact_sha256: fixtureHash, findings: response?.content, tool_calls: response?.tool_calls });
    },
  };
  const start = Date.now();
  try {
    await agent.invoke({ messages: [{ role: "user", content: "Use the inspection-probe skill to inspect the fixture and submit your observations." }] }, {
      callbacks: [tracer, callbacks], runId: id, recursionLimit: 24,
      signal: AbortSignal.timeout(180000), metadata: { phase: 1, isolated_capability_fixture: true, production: false, model_choice: "director-selected-nvidia-kimi-k3" },
    });
    await client.awaitPendingTraceBatches();
    assert.deepEqual(failures, []);
    assert.equal(submissions.length, 1);
    const submission = submissions[0] as any;
    assert.deepEqual(submission.quadrants.map((c: string) => c.toLowerCase()), ["red", "blue", "green", "yellow"]);
    assert.equal(submission.skill_marker, "QUADRANT-EVIDENCE-731");
    assert.ok(events.some(e => e.status === "MODEL_RESPONSE_RECEIVED"));
    await readFile(join(root, "drafts/observations.txt"));
    const trace = await client.readRun(id, { loadChildRuns: true });
    assert.ok(!JSON.stringify(trace).includes("base64,"));
    const url = await client.getRunUrl({ run: trace });
    const reported = null; // Trial endpoint has no verified per-token tariff; never invent spend.
    const report = { ...intent, status: "COMPLETE", calls, elapsed_ms: Date.now() - start, submission, usage, estimated_cost_from_reported_tokens_usd: reported, verified_charge_usd: null, events, url, observations: await readFile(join(root, "drafts/observations.txt"), "utf8") };
    await writeFile(join(root, "report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ id, status: report.status, calls, elapsed_ms: report.elapsed_ms, estimated_cost_from_reported_tokens_usd: reported, verified_charge_usd: null, url }));
  } catch (error: any) {
    await writeFile(join(root, "blocked.json"), JSON.stringify({ ...intent, status: "BLOCKED", calls, unknown_outcome_reservation_retained: true, error: String(error.message).replaceAll(apiKey, "[REDACTED]"), events, usage }, null, 2) + "\n");
    const causes: string[] = [];
    for (let cause = error; cause; cause = cause.cause) causes.push(String(cause.message).replaceAll(apiKey, "[REDACTED]"));
    await writeFile(join(root, "diagnostics.json"), JSON.stringify({ causes }, null, 2) + "\n");
    throw new Error(causes.join(" → "));
  }
}
main().catch((error: Error) => {
  console.error(error.message);
  console.error(`STOP: Phase 1 live trial did not complete. No retry or substitute model was submitted. Inspect output/live-trials/*/blocked.json. For NVIDIA access, open https://build.nvidia.com/moonshotai/kimi-k3 → sign in → Generate API Key; add NVIDIA_API_KEY=<your-key> in ${secretsPath}. For LangSmith access, open https://smith.langchain.com → Settings → API Keys; verify LANGSMITH_API_KEY in the same file. Reconcile the recorded operation before running another trial.`);
  process.exitCode = 1;
});
