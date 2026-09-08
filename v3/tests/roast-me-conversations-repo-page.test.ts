import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JSZip from "jszip";
import { discoveryShelfDefinitions, getDiscoveryEntriesByFormat } from "../features/discovery/catalog";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { getFormatRepoPagePresentation } from "../features/discovery/formatRepoPage.server";
import { FormatRepoPackageConnections, FormatRepoPackageAssets, FormatRepoPackageEvidence } from "../features/discovery/FormatRepoPackageSections";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

const profile = getDiscoveryFormatProfile("roast-me-conversations")!;
assert.equal(profile.version, "0.2.0");
assert.equal(profile.name, "Roast Me Conversations");

const entries = getDiscoveryEntriesByFormat(profile.slug);
assert.equal(entries.length, 4);
for (const entry of entries) {
  assert.equal(entry.format.version, "0.2.0", "The preview must identify the generator runtime version.");
  assert.equal(entry.media.kind, "video");
  assert.equal(entry.media.aspectRatio, "9:16");
  assert.ok(existsSync(`public${entry.media.poster}`), `Poster exists: ${entry.media.poster}`);
  assert.ok(existsSync(`public${entry.media.src}`), `Video exists: ${entry.media.src}`);

  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", `public${entry.media.src}`], { encoding: "utf8" }));
  const video = probe.streams.find((stream: { codec_type: string }) => stream.codec_type === "video");
  assert.equal(video.width, 1080, `Width 1080 for ${entry.id}`);
  assert.equal(video.height, 1920, `Height 1920 for ${entry.id}`);
  assert.equal(video.sample_aspect_ratio, "1:1");
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
assert.deepEqual(discoveryShelfDefinitions.find(s => s.id === profile.slug)!.formats, [profile.slug]);

const presentation = await getFormatRepoPagePresentation(profile.slug);
assert.equal(presentation.kind, "shared");
if (presentation.kind !== "shared") throw new Error("Use the standard shared page.");

const data = presentation.package!;
assert.deepEqual(data.services, [], "No external provider accounts required for baseline execution.");
assert.equal(data.workflow.length, 5);
assert.equal(data.proof.examples.length, 2);

const html = [FormatRepoPackageConnections, FormatRepoPackageAssets, FormatRepoPackageEvidence]
  .map(component => renderToStaticMarkup(createElement(component, { format: profile, data }))).join("");

for (const text of [
  "Canonical roast proof input",
  "Startup pitch deck roast proof input",
  "Family &amp; Friends Roast Me",
  "AI Startup Pitch Deck Roast",
  "Readable Repo files."
]) {
  assert.ok(html.includes(text), text);
}

const assetsHtml = renderToStaticMarkup(createElement(FormatRepoPackageAssets, { format: profile, data }));
assert.ok(!assetsHtml.includes("<details"), "All 8 character poses must render directly without collapsing into details");
for (const pose of [
  "Male character presenter neutral pose",
  "Male character presenter laugh pose",
  "Male character presenter talk pose",
  "Male character presenter shock pose",
  "Female character presenter neutral pose",
  "Female character presenter laugh pose",
  "Female character presenter talk pose",
  "Female character presenter shock pose"
]) {
  assert.ok(assetsHtml.includes(pose), `Pose rendered directly: ${pose}`);
}

const prompt = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.ok(prompt.includes("/downloads/roast-me-conversations-0.2.0.zip"));

const root = `public/${profile.packagePath}`;
const zip = await JSZip.loadAsync(readFileSync(`public${profile.repositoryHref}`));

for (const name of ["format.json", "KIT-MANIFEST.json", "FORMAT-REPO.json", "package.json", "package-lock.json", "RELEASE-CONTENTS.json"]) {
  assert.equal(JSON.parse(await zip.file(name)!.async("string")).version, profile.version, name);
}

const inventory = JSON.parse(await zip.file("RELEASE-CONTENTS.json")!.async("string"));
assert.equal(inventory.files.length, 91);
assert.deepEqual(Object.keys(zip.files).sort(), [...inventory.files.map((entry: { file: string }) => entry.file), "RELEASE-CONTENTS.json"].sort());

for (const item of inventory.files) {
  const bytes = await zip.file(item.file)!.async("nodebuffer");
  assert.equal(sha256(bytes), item.sha256, item.file);
  assert.equal(bytes.byteLength, item.sizeBytes, item.file);
  assert.deepEqual(bytes, readFileSync(`${root}/${item.file}`), `Public source / ZIP parity: ${item.file}`);
}

assert.equal(sha256(await zip.file("runtime/render.mjs")!.async("nodebuffer")), "7a21114cf914b363f21dac7c1777dd7f5ca3c0e62fc18ab6bca9fe7f91fae54b");
assert.equal(JSON.parse(await zip.file("FORMAT-REPO.json")!.async("string")).review.reviewer, "User");

const publication = JSON.parse(await zip.file("PUBLICATION.json")!.async("string"));
assert.equal(publication.publicationAuthorized, true);
assert.equal(publication.paidGenerationsForPublication, 0);

console.log("Roast Me Conversations: format presentation, public parity, handoff, and 91-file ZIP verified.");
