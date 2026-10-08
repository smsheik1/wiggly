import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDeepAgent, FilesystemBackend, CompositeBackend, registerHarnessProfile } from "deepagents";
import { tool } from "langchain";
import { z } from "zod";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

// Isolated capability fixture, never a generated or approved production asset.
export async function prepareWorkspace(root: string, png: Uint8Array) {
  for (const dir of ["drafts", "references", "versions", "skills/inspection-probe"])
    await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, "references/probe.png"), png);
  await writeFile(join(root, "versions/locked.txt"), "LOCKED");
  await writeFile(join(root, "skills/inspection-probe/SKILL.md"), `---
name: inspection-probe
description: Inspect the Phase 1 test image and submit observed quadrant colors.
---
# Inspection probe
Read the actual /references/probe.png using read_file. Report its four quadrant
colors in top-left, top-right, bottom-left, bottom-right order. Do not infer colors
from filenames. Include the skill marker QUADRANT-EVIDENCE-731 in your submission.
Write your observations to /drafts/observations.txt before calling submit_probe.
This is a capability fixture, not animation production or approval.
`);
}

export function createProbe(model: BaseChatModel, root: string, profileKey: string) {
  const submissions: unknown[] = [];
  const submit = tool(async ({ quadrants, skill_marker }) => {
    const bytes = await readFile(join(root, "references/probe.png"));
    const result = { kind: "phase1-probe-only", quadrants, skill_marker, artifact_sha256: hash(bytes) };
    submissions.push(result);
    return result;
  }, {
    name: "submit_probe", description: "Finish this capability probe; not production publication or approval.",
    schema: z.object({ quadrants: z.array(z.string()).length(4), skill_marker: z.string() }),
    returnDirect: true,
  });
  const agent = workspaceAgent(model, root, profileKey, "wiggly-phase1-probe", [submit], "Complete only the Phase 1 inspection probe. Load the relevant skill, inspect the actual image, write observations in drafts, then submit_probe. Never approve or generate media. No delegation.");
  return { agent, submissions };
}

export function workspaceAgent(model: BaseChatModel, root: string, profileKey: string, name: string, tools: any[], systemPrompt: string, middleware: any[] = []) {
  registerHarnessProfile(profileKey, {
    excludedTools: ["task", "execute"],
    generalPurposeSubagent: { enabled: false },
  });
  const mount = (dir: string) => new FilesystemBackend({ rootDir: join(root, dir), virtualMode: true });
  // Native mount roots reject symlinks escaping drafts, including aliases into versions.
  const backend = new CompositeBackend(new FilesystemBackend({ rootDir: root, virtualMode: true }), {
    "/drafts/": mount("drafts"), "/references/": mount("references"),
    "/versions/": mount("versions"), "/skills/": mount("skills"),
  });
  return createDeepAgent({
    model, backend, name, skills: ["/skills/"], tools, middleware,
    permissions: [
      { operations: ["read"], paths: ["/drafts/**", "/references/**", "/versions/**", "/skills/**"], mode: "allow" },
      { operations: ["read"], paths: ["/**"], mode: "deny" },
      { operations: ["write"], paths: ["/drafts/**"], mode: "allow" },
      { operations: ["write"], paths: ["/**"], mode: "deny" },
    ],
    systemPrompt,
  });
}
