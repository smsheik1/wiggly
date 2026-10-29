import assert from "node:assert/strict";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { releasePreflight } from "../features/mcp/draft-worker";

async function layout(name: string) {
  const root = path.join(tmpdir(), `wiggly-release-${name}-${Date.now()}`);
  const studio = path.join(root, "studio");
  const app = path.join(root, "app");
  await mkdir(path.join(studio, "scripts"), { recursive: true });
  await mkdir(path.join(studio, "node_modules", "langgraph"), { recursive: true });
  await mkdir(path.join(app, "node_modules", "next"), { recursive: true });
  await writeFile(path.join(studio, "scripts", "run-customer.mjs"), "export {}\n");
  return { studio, app };
}

const keys = { openRouterKey: "present", replicateKey: "present" };

test("the worker starts only when the bundled studio and real installs are present", async () => {
  const dirs = await layout("ok");
  await releasePreflight({ studioDir: dirs.studio, studioEntry: "scripts/run-customer.mjs", appDir: dirs.app, ...keys });
});

test("a missing studio entry stops the worker before a job", async () => {
  const dirs = await layout("entry");
  await assert.rejects(() => releasePreflight({
    studioDir: dirs.studio,
    studioEntry: "scripts/missing.mjs",
    appDir: dirs.app,
    ...keys,
  }), /run-customer\.mjs/);
});

test("a Mac node_modules symlink stops the worker before a job", async () => {
  const dirs = await layout("link");
  const linked = path.join(dirs.studio, "linked-modules");
  await mkdir(linked, { recursive: true });
  await symlink(linked, path.join(dirs.app, "node_modules-real"));
  const { rm } = await import("node:fs/promises");
  await rm(path.join(dirs.app, "node_modules"), { recursive: true });
  await symlink(linked, path.join(dirs.app, "node_modules"));
  await assert.rejects(() => releasePreflight({
    studioDir: dirs.studio,
    studioEntry: "scripts/run-customer.mjs",
    appDir: dirs.app,
    ...keys,
  }), /not a real directory/);
});

test("a missing provider key stops the worker before a job", async () => {
  const dirs = await layout("key");
  await assert.rejects(() => releasePreflight({
    studioDir: dirs.studio,
    studioEntry: "scripts/run-customer.mjs",
    appDir: dirs.app,
    openRouterKey: "",
    replicateKey: "present",
  }), /openrouter\.ai\/settings\/keys/);
});
