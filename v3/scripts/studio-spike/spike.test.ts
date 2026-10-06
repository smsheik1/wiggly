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
  const { agent, submissions } = createProbe(model, root, "openai:gpt-5.6-sol");
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
  const { agent } = createProbe(model, root, "openai:gpt-5.6-sol");
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
  const { agent } = createProbe(model, root, "openai:gpt-5.6-sol");
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
});
