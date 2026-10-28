import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const layout = readFileSync(path.join(root, "app/layout.tsx"), "utf8");
const manifest = readFileSync(path.join(root, "app/manifest.ts"), "utf8");

assert.doesNotMatch(
  layout,
  /icons:\s*\{\s*icon:\s*"\/wiggly-logo\.svg"/,
  "The retired waveform must not return as Wiggly's browser icon.",
);

const mcpSetupPage = readFileSync(path.join(root, "features/discovery/McpSetupPage.tsx"), "utf8");
assert.doesNotMatch(mcpSetupPage, /wiggly-logo\.svg/, "The retired waveform must not appear on the MCP setup page.");
assert.match(mcpSetupPage, /wiggly-app-icon-v1-512\.png/);

for (const icon of [
  ["wiggly-app-icon-v1-32.png", 32],
  ["wiggly-app-icon-v1-180.png", 180],
  ["wiggly-app-icon-v1-192.png", 192],
  ["wiggly-app-icon-v1-512.png", 512],
] as const) {
  const [filename, expectedSize] = icon;
  const iconPath = path.join(root, "public", filename);
  assert.equal(existsSync(iconPath), true, `${filename} must be packaged for production.`);

  const png = readFileSync(iconPath);
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${filename} must be a PNG.`);
  assert.equal(png.readUInt32BE(16), expectedSize, `${filename} width must match its metadata.`);
  assert.equal(png.readUInt32BE(20), expectedSize, `${filename} height must match its metadata.`);
  assert.match(
    `${layout}\n${manifest}`,
    new RegExp(filename.replaceAll(".", "\\.")),
    `${filename} must be referenced by Wiggly's browser or install metadata.`,
  );
}

assert.match(manifest, /name:\s*"Wiggly"/);
assert.match(manifest, /display:\s*"standalone"/);

console.log("Wiggly branding guardrails passed.");
