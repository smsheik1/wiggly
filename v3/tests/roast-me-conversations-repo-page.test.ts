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
assert.equal(profile.version, "0.1.0");
assert.equal(profile.name, "Roast Me Conversations");

const entries = getDiscoveryEntriesByFormat(profile.slug);
assert.equal(entries.length, 1);
assert.equal(entries[0].format.version, "0.1.0", "The preview must identify the generator runtime version.");
assert.equal(entries[0].media.kind, "video");
assert.equal(entries[0].media.aspectRatio, "9:16");
assert.ok(existsSync(`public${entries[0].media.poster}`));
assert.ok(existsSync(`public${entries[0].media.src}`));

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const previewProbe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", `public${entries[0].media.src}`], { encoding: "utf8" }));
const previewVideo = previewProbe.streams.find((stream: { codec_type: string }) => stream.codec_type === "video");
assert.equal(previewVideo.width, 1080);
assert.equal(previewVideo.height, 1920);
assert.equal(previewVideo.sample_aspect_ratio, "1:1");

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

const prompt = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.ok(prompt.includes("/downloads/roast-me-conversations-0.1.0.zip"));

const root = `public/${profile.packagePath}`;
const zip = await JSZip.loadAsync(readFileSync(`public${profile.repositoryHref}`));

for (const name of ["format.json", "KIT-MANIFEST.json", "FORMAT-REPO.json", "package.json", "package-lock.json", "RELEASE-CONTENTS.json"]) {
  assert.equal(JSON.parse(await zip.file(name)!.async("string")).version, profile.version, name);
}

const inventory = JSON.parse(await zip.file("RELEASE-CONTENTS.json")!.async("string"));
assert.equal(inventory.files.length, 79);
assert.deepEqual(Object.keys(zip.files).sort(), [...inventory.files.map((entry: { file: string }) => entry.file), "RELEASE-CONTENTS.json"].sort());

for (const item of inventory.files) {
  const bytes = await zip.file(item.file)!.async("nodebuffer");
  assert.equal(sha256(bytes), item.sha256, item.file);
  assert.equal(bytes.byteLength, item.sizeBytes, item.file);
  assert.deepEqual(bytes, readFileSync(`${root}/${item.file}`), `Public source / ZIP parity: ${item.file}`);
}

assert.equal(sha256(await zip.file("runtime/render.mjs")!.async("nodebuffer")), "075d465e6e10efb9a9570e1aa36daa0583efa4c245b1b32542125c1a145b3958");
assert.equal(JSON.parse(await zip.file("FORMAT-REPO.json")!.async("string")).review.reviewer, "User");

const publication = JSON.parse(await zip.file("PUBLICATION.json")!.async("string"));
assert.equal(publication.publicationAuthorized, true);
assert.equal(publication.paidGenerationsForPublication, 0);

console.log("Roast Me Conversations: format presentation, public parity, handoff, and 79-file ZIP verified.");
