import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import { discoveryShelfDefinitions, getDiscoveryEntriesByFormat } from "../features/discovery/catalog";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { getFormatRepoPagePresentation } from "../features/discovery/formatRepoPage.server";
import { FormatRepoPackageConnections, FormatRepoPackageAssets, FormatRepoPackageEvidence } from "../features/discovery/FormatRepoPackageSections";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

const profile = getDiscoveryFormatProfile("repo-builder")!;
assert.equal(profile.name, "Wiggly Repo Builder");
assert.equal(profile.version, "0.1.1");
const entries = getDiscoveryEntriesByFormat(profile.slug);
assert.equal(entries.length, 1, "One authoring Repo, not one format per benchmark.");
assert.equal(entries[0].role, "workflow-illustration");
assert.equal(entries[0].media.kind, "image");
assert.deepEqual(discoveryShelfDefinitions.find(s => s.id === profile.slug)!.formats, [profile.slug]);

const presentation = await getFormatRepoPagePresentation(profile.slug);
assert.equal(presentation.kind, "shared");
if (presentation.kind !== "shared") throw new Error("Use the standard shared Repo presentation.");
const data = presentation.package!;
assert.deepEqual(data.services, [], "The authoring kit does not require a media API provider.");
assert.ok(data.optionalTools.some(tool => tool.includes("yt-dlp")));
assert.ok(data.optionalTools.some(tool => tool.includes("whisper.cpp")));
assert.ok(data.assets.some(asset => asset.image && asset.href.endsWith("repo-builder-overview.svg")));
assert.ok(data.workflow.length >= 6 && data.quality.length > 0);
assert.equal(data.proof.examples.length, 3);
const html = [FormatRepoPackageConnections, FormatRepoPackageAssets, FormatRepoPackageEvidence]
  .map(component => renderToStaticMarkup(createElement(component, { format: profile, data }))).join("");
for (const text of ["Optional local tools", "yt-dlp", "whisper.cpp", "Fresh-agent real-media proof", "remain unverified", "user corrected"]) {
  assert.ok(html.includes(text), `Render the actual evidence and limitations: ${text}`);
}
const prompt = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.ok(
  prompt.includes("/downloads/wiggly-repo-builder-0.1.1.zip") ||
    prompt.includes("wiggly-repo-builder/releases/download/v0.1.1/wiggly-repo-builder-0.1.1.zip"),
);
assert.match(prompt, /Never use a paid provider without my explicit approval/);
assert.ok(prompt.length < 1_000);
const root = "public/format-repositories/repo-builder-v1";
const localZip = `${root}/downloads/wiggly-repo-builder-0.1.1.zip`;
if (existsSync(localZip)) {
  const bytes = readFileSync(localZip);
  const sha256 = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
  assert.equal(sha256(bytes), "7cf18546f887516dc2420ed443d43bddf49f316a49e13e6d40e04f46ee3dc3dc");
  const zip = await JSZip.loadAsync(bytes);
  for (const filename of ["KIT-MANIFEST.json", "format.json", "package.json", "RELEASE-CONTENTS.json"]) {
    assert.equal(JSON.parse(await zip.file(filename)!.async("string")).version, profile.version, filename);
  }
  const inventory = JSON.parse(await zip.file("RELEASE-CONTENTS.json")!.async("string"));
  assert.equal(inventory.files.length, 31);
  assert.deepEqual(Object.keys(zip.files).sort(), [...inventory.files.map((item: { file: string }) => item.file), "RELEASE-CONTENTS.json"].sort());
  for (const item of inventory.files) {
    const archived = await zip.file(item.file)!.async("nodebuffer");
    assert.equal(sha256(archived), item.sha256, item.file);
    assert.equal(archived.byteLength, item.sizeBytes, item.file);
    assert.deepEqual(archived, readFileSync(`${root}/${item.file}`), `Public source / ZIP parity: ${item.file}`);
  }
  assert.ok(!Object.keys(zip.files).some(file => /(?:node_modules|secrets\.env|private\/|\.mp4$|\.wav$|ggml-)/.test(file)));
}
console.log("Repo Builder page, honest workflow label, proof limits and pinned 0.1.1 ZIP parity passed.");
