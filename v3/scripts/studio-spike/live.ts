import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createProbe, prepareWorkspace, hash } from "./harness.js";
import { namedSecret, tracing, secretsPath } from "./tracing.js";

// Inspection only: no creative generation or headless authoring bypasses the host bridge.
async function main() {
  assert.ok(process.argv.includes("--gemini-authorized"), "Select the configured Gemini model for this isolated trial before running. No model substitution is automatic.");
  const config = JSON.parse(await readFile("/Users/shaz/Projects/wiggly/v3/public/format-repositories/my-pixar-story-v1/studio.json", "utf8"));
  const modelName = config.generation.mediaReview.model;
  assert.equal(modelName, "gemini-3.8-flash", "Reverify model support/pricing before changing the spike model.");
  const apiKey = await namedSecret("GEMINI_API_KEY");
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
  const model = new ChatGoogleGenerativeAI({ model: modelName, apiKey, maxRetries: 0, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: "LOW" } });
  const { agent, submissions } = createProbe(model, root, `google:${modelName}`);
  const events: any[] = [], usage: any[] = [];
  let calls = 0, imageTurn = false;
  const callbacks = {
    name: "phase1-inspection-evidence", raiseError: true,
    handleChatModelStart(_model: any, messages: any[][]) {
      assert.ok(++calls <= 8, "SPIKE_TURN_LIMIT");
      assert.ok(Buffer.byteLength(JSON.stringify(messages)) <= 65536, "SPIKE_INPUT_BOUND");
      imageTurn = JSON.stringify(messages).includes("data:image/");
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
      signal: AbortSignal.timeout(180000), metadata: { phase: 1, isolated_capability_fixture: true, production: false, model_choice: "explicit-gemini-spike-only" },
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
    const reported = usage.reduce((total, u) => total + (u.input_tokens ?? 0) * .75 / 1e6 + (u.output_tokens ?? 0) * 3.75 / 1e6, 0);
    const report = { ...intent, status: "COMPLETE", calls, elapsed_ms: Date.now() - start, submission, usage, estimated_cost_from_reported_tokens_usd: reported, verified_charge_usd: null, events, url, observations: await readFile(join(root, "drafts/observations.txt"), "utf8") };
    await writeFile(join(root, "report.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ id, status: report.status, calls, elapsed_ms: report.elapsed_ms, estimated_cost_from_reported_tokens_usd: reported, verified_charge_usd: null, url }));
  } catch (error: any) {
    await writeFile(join(root, "blocked.json"), JSON.stringify({ ...intent, status: "BLOCKED", calls, unknown_outcome_reservation_retained: true, error: String(error.message).replaceAll(apiKey, "[REDACTED]"), events, usage }, null, 2) + "\n");
    throw error;
  }
}
main().catch(() => {
  console.error(`STOP: Phase 1 live trial did not complete. No retry or substitute model was submitted. Inspect output/live-trials/*/blocked.json. For Gemini access, open https://aistudio.google.com → API Keys / Usage and billing; verify GEMINI_API_KEY in ${secretsPath}. For LangSmith access, open https://smith.langchain.com → Settings → API Keys; verify LANGSMITH_API_KEY in the same file. Reconcile the recorded operation before running another trial.`);
  process.exitCode = 1;
});
