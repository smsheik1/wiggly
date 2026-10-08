import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AIMessage } from "@langchain/core/messages";
import { createProbe, prepareWorkspace } from "./harness.js";
import { ScriptedModel, call } from "./offline-model.js";
import { redact } from "./tracing.js";
const done = () => new AIMessage("Done");
// One-pixel PNG is a structural fixture only; no perceptual judgment is claimed.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYOQAAAAASUVORK5CYII=", "base64");
async function workspace(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "wiggly-phase1-"));
  try { await prepareWorkspace(root, png); await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("native skills and image tool blocks reach the next model turn; submit ends execution", async () => workspace(async root => {
  const model = new ScriptedModel([
    messages => {
      assert.match(JSON.stringify(messages[0].content), /inspection-probe/);
      return call("read_file", { file_path: "/skills/inspection-probe/SKILL.md" });
    },
    messages => {
      assert.match(JSON.stringify(messages.at(-1)?.content), /QUADRANT-EVIDENCE-731/);
      return call("read_file", { file_path: "/references/probe.png" });
    },
    messages => {
      const blocks = messages.at(-1)?.content;
      assert.ok(Array.isArray(blocks));
      assert.ok(blocks.some((block: any) => block.type === "image" || block.type === "image_url"));
      return call("submit_probe", { quadrants: ["mock", "mock", "mock", "mock"], skill_marker: "QUADRANT-EVIDENCE-731" });
    },
  ]);
  const { agent, submissions } = createProbe(model, root, "openai:isolated-scripted-model");
  await agent.invoke({ messages: [{ role: "user", content: "Complete the inspection probe." }] }, { recursionLimit: 16 });
  assert.equal(model.calls.length, 3);
  assert.equal(submissions.length, 1);
  assert.ok(!model.toolNames.includes("execute"));
  assert.ok(!model.toolNames.includes("task"));
}));

test("native permissions deny protected writes, edits, and deletes while permitting drafts", async () => workspace(async root => {
  const model = new ScriptedModel([
    () => call("write_file", { file_path: "/versions/new.txt", content: "bad" }),
    () => call("edit_file", { file_path: "/versions/locked.txt", old_string: "LOCKED", new_string: "bad" }),
    () => call("delete", { file_path: "/versions/locked.txt" }),
    () => call("write_file", { file_path: "/drafts/notes.txt", content: "permitted" }),
    done,
  ]);
  const { agent } = createProbe(model, root, "openai:isolated-scripted-model");
  const result = await agent.invoke({ messages: [{ role: "user", content: "Isolated permission test." }] }, { recursionLimit: 20 });
  assert.equal(await readFile(join(root, "versions/locked.txt"), "utf8"), "LOCKED");
  await assert.rejects(readFile(join(root, "versions/new.txt")));
  assert.equal(await readFile(join(root, "drafts/notes.txt"), "utf8"), "permitted");
  const denied = result.messages.filter((message: any) => message.type === "tool" && /denied|permission/i.test(JSON.stringify(message.content)));
  assert.equal(denied.length, 3);
}));

test("native mount roots reject traversal and symlink aliases into protected versions", async () => workspace(async root => {
  await writeFile(join(root, "secrets.env"), "DUMMY_SECRET_NEVER_TO_MODEL");
  await symlink(join(root, "versions"), join(root, "drafts/alias"));
  const model = new ScriptedModel([
    () => call("write_file", { file_path: "/drafts/alias/locked.txt", content: "bad" }),
    () => call("write_file", { file_path: "/drafts/../versions/locked.txt", content: "bad" }),
    () => call("read_file", { file_path: "/secrets.env" }),
    messages => {
      assert.match(JSON.stringify(messages.at(-1)?.content), /denied|permission/i);
      assert.ok(!JSON.stringify(messages).includes("DUMMY_SECRET_NEVER_TO_MODEL"));
      return done();
    },
  ]);
  const { agent } = createProbe(model, root, "openai:isolated-scripted-model");
  await agent.invoke({ messages: [{ role: "user", content: "Isolated path test." }] }, { recursionLimit: 20 });
  assert.equal(await readFile(join(root, "versions/locked.txt"), "utf8"), "LOCKED");
}));

test("trace hygiene removes image bytes and credential values without losing text", () => {
  const value = redact({ observations: "Fixture inspected", image: "data:image/png;base64,YWJj", apiKey: "never-upload", nested: [{ authorization: "Bearer secret" }] });
  assert.equal(value.observations, "Fixture inspected");
  assert.equal(value.image.bytes, 3);
  assert.equal(value.apiKey, "[REDACTED]");
  assert.equal(value.nested[0].authorization, "[REDACTED]");
  assert.ok(!JSON.stringify(value).includes("YWJj"));
  const native = redact({ type: "image", mimeType: "image/png", data: png.toString("base64") });
  assert.equal(native.data.bytes, png.length);
  assert.ok(!JSON.stringify(native).includes(png.toString("base64")));
});

// Explicit local mock endpoint: exercises the real ChatOpenAI serializer, not inference.
test("NIM adapter preserves reasoning across tool turns and delivers actual tool image bytes", async () => workspace(async root => {
  const { NimModel } = await import("./nim-model.js");
  const { nimTransport } = await import("./nim-transport.js");
  let requests = 0;
  const send: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.reasoning_effort, "high");
    assert.equal(body.tool_choice, "required");
    const assistants = body.messages.filter((m: any) => m.role === "assistant");
    assistants.forEach((message: any, index: number) => assert.equal(message.reasoning_content, index === 1 ? undefined : `inspection-${index + 1}`));
    for (const message of body.messages.filter((m: any) => m.role === "tool")) assert.equal(typeof message.content, "string");
    const steps = [
      ["read_file", { file_path: "/skills/inspection-probe/SKILL.md" }],
      ["read_file", { file_path: "/references/probe.png" }],
      ["write_file", { file_path: "/drafts/observations.txt", content: "mock observations" }],
      ["submit_probe", { quadrants: ["mock", "mock", "mock", "mock"], skill_marker: "QUADRANT-EVIDENCE-731" }],
    ];
    if (requests >= 2) {
      const media = body.messages.filter((m: any) => m.role === "user").flatMap((m: any) => Array.isArray(m.content) ? m.content : []);
      assert.ok(media.some((b: any) => b.type === "image_url" && b.image_url.url.endsWith(png.toString("base64"))));
    }
    assert.ok(requests < steps.length, "Model called after submission");
    const [name, args] = steps[requests++], id = requests <= 2 ? "read_file:0" : String(requests);
    return new Response(JSON.stringify({ id: `mock-${requests}`, object: "chat.completion", created: 0, model: "moonshotai/kimi-k3", choices: [{ index: 0, finish_reason: "tool_calls", message: { role: "assistant", content: "", ...(requests === 2 ? {} : { reasoning_content: `inspection-${requests}` }), tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20, completion_tokens_details: { reasoning_tokens: requests === 2 ? 0 : 1 } } }), { headers: { "content-type": "application/json" } });
  };
  const model = new NimModel({ model: "moonshotai/kimi-k3", apiKey: "isolated-dummy", maxRetries: 0, disableStreaming: true, useResponsesApi: false, modelKwargs: { reasoning_effort: "high", tool_choice: "required" }, configuration: { baseURL: "https://integrate.api.nvidia.com/v1", fetch: nimTransport(send) } });
  const { agent, submissions } = createProbe(model, root, "openai:moonshotai/kimi-k3");
  try { await agent.invoke({ messages: [{ role: "user", content: "Isolated adapter fixture." }] }, { recursionLimit: 20 }); } catch (error: any) { while (error.cause) error = error.cause; throw error; }
  assert.equal(requests, 4);
  assert.equal(submissions.length, 1);
}));


test("NIM does not accept missing reasoning when nonzero reasoning usage is reported", async () => {
  const { nimTransport } = await import("./nim-transport.js");
  const send: typeof fetch = async () => new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "one", type: "function", function: { name: "inspect", arguments: "{}" } }] } }], usage: { completion_tokens_details: { reasoning_tokens: 1 } } }));
  await assert.rejects(nimTransport(send)("https://integrate.api.nvidia.com/v1/chat/completions", { body: JSON.stringify({ messages: [], tools: [{ type: "function", function: { name: "inspect" } }] }) }), /omitted reasoning/);
});


test("author bridge explicitly runs the bound operating worker and propagates its failure", async () => {
  const { askActiveAgent } = await import("../../lib/agent-bridge.js");
  let calls = 0;
  const outcome = await askActiveAgent("isolated assignment", { operatingAgent: async prompt => { calls++; assert.equal(prompt, "isolated assignment"); return { authored: true }; } });
  assert.deepEqual(outcome, { authored: true }); assert.equal(calls, 1);
  await assert.rejects(askActiveAgent("isolated failure", { operatingAgent: async () => { throw new Error("BOUND_WORKER_STOP"); } }), /BOUND_WORKER_STOP/);
});


test("background dimensions accept provider-normalized 16:9 sizes and reject unusable framing", async () => {
  const { assertBackgroundDimensions } = await import("./phase2.js");
  assertBackgroundDimensions({ width: 1536, height: 864 });
  assertBackgroundDimensions({ width: 2048, height: 1152 });
  assert.throws(() => assertBackgroundDimensions({ width: 1024, height: 1024 }));
  assert.throws(() => assertBackgroundDimensions({ width: 160, height: 90 }));
});
