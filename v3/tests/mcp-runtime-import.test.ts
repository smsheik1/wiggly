import assert from "node:assert/strict";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { runtimeImport } from "../features/mcp/runtime-import";

test("runtimeImport dynamically loads modules via Node runtime ESM without bundler interference", async () => {
  // Test importing built-in node module
  const fs = await runtimeImport<typeof import("node:fs")>("node:fs");
  assert.equal(typeof fs.readFileSync, "function");

  // Test importing node:path
  const pathMod = await runtimeImport<typeof import("node:path")>("node:path");
  assert.equal(typeof pathMod.join, "function");

  // Test importing a file URL specifier
  const packageJsonUrl = pathToFileURL(pathMod.resolve(process.cwd(), "package.json")).href;
  assert.ok(packageJsonUrl.startsWith("file://"));
});
