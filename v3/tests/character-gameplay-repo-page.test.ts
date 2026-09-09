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

const profile = getDiscoveryFormatProfile("character-gameplay-conversations")!;
assert.equal(profile.version, "0.3.0");
assert.equal(profile.name, "Batman Arkham Conversations");
const entries = getDiscoveryEntriesByFormat(profile.slug);
assert.equal(entries.length, 3);
for (const entry of entries) {
  assert.equal(entry.format.version, "0.3.0", "The preview must identify the revised generator runtime.");
  assert.equal(entry.media.kind, "video");
  assert.equal(entry.media.aspectRatio, "9:16");
  assert.ok(existsSync(`public${entry.media.poster}`), `Poster exists: ${entry.media.poster}`);
  assert.ok(existsSync(`public${entry.media.src}`), `Media exists: ${entry.media.src}`);
}
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
assert.equal(sha256(readFileSync(`public${entries[0].media.src}`)), "02abd830832603a033401177b6759687aa6d2f7c4beb6f4f26d856547c591362");
const previewProbe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-of", "json", `public${entries[0].media.src}`], { encoding: "utf8" }));
const previewVideo = previewProbe.streams.find((stream: {codec_type:string}) => stream.codec_type === "video");
assert.equal(previewVideo.width, 1080);
assert.equal(previewVideo.height, 1920);
assert.equal(previewVideo.sample_aspect_ratio, "1:1", "Do not stretch a 3:4 file with aspect-ratio metadata.");
assert.deepEqual(discoveryShelfDefinitions.find(s => s.id === profile.slug)!.formats, [profile.slug]);
const presentation = await getFormatRepoPagePresentation(profile.slug);
assert.equal(presentation.kind, "shared");
if (presentation.kind !== "shared") throw new Error("Use the standard shared page.");
const data = presentation.package!;
assert.deepEqual(data.services, [
  {
    name: "Social Publisher (Buffer MCP or API)",
    purpose: "Simultaneous headless publishing to YouTube Shorts, Instagram Reels, TikTok, and X.",
    keys: ["BUFFER_API_KEY"],
    model: "",
  },
], "Optional social publisher declared for distribution; composition requires no provider account.");
assert.equal(data.workflow.length, 7);
assert.equal(data.proof.examples.length, 2);
const html = [FormatRepoPackageConnections, FormatRepoPackageAssets, FormatRepoPackageEvidence]
  .map(component => renderToStaticMarkup(createElement(component, { format: profile, data }))).join("");
for (const text of ["Same-universe starter", "Crossover starter", "not in this release", "User accepted the preview", "Dark Fog", "CC BY 4.0", "Readable Repo files."]) assert.ok(html.includes(text), text);
const prompt = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.ok(prompt.includes("/downloads/character-gameplay-conversations-0.3.0.zip"));
assert.match(prompt, /Never use a paid provider without my explicit approval/);
const root = `public/${profile.packagePath}`;
const zip = await JSZip.loadAsync(readFileSync(`public${profile.repositoryHref}`));
for (const name of ["format.json", "KIT-MANIFEST.json", "FORMAT-REPO.json", "package.json", "package-lock.json", "RELEASE-CONTENTS.json"]) assert.equal(JSON.parse(await zip.file(name)!.async("string")).version, profile.version, name);
const inventory = JSON.parse(await zip.file("RELEASE-CONTENTS.json")!.async("string"));
assert.equal(inventory.files.length, 53);
assert.deepEqual(Object.keys(zip.files).sort(), [...inventory.files.map((entry: {file:string}) => entry.file), "RELEASE-CONTENTS.json"].sort());
for (const item of inventory.files) {
  const bytes = await zip.file(item.file)!.async("nodebuffer");
  assert.equal(sha256(bytes), item.sha256, item.file);
  assert.equal(bytes.byteLength, item.sizeBytes, item.file);
  assert.deepEqual(bytes, readFileSync(`${root}/${item.file}`), `Public source / ZIP parity: ${item.file}`);
}
assert.equal(sha256(await zip.file("runtime/render.mjs")!.async("nodebuffer")), "c6df6b1276d3b9e92df5c3d18d965f84f57d6c937dcefecf27860c8d1af3c520", "Ship the exact compositor used by the music proof.");
assert.equal(sha256(readFileSync(`${root}/downloads/character-gameplay-conversations-0.2.0.zip`)), "048eaaec91a57255d06c5c92d7225cb6f0fdc5f2485b9e93d63cfab3ec4f787c", "Preserve the prior 0.2.0 release.");
assert.equal(sha256(readFileSync(`${root}/downloads/character-gameplay-conversations-0.1.4.zip`)), "03788884fdbf18ed052a6ddfe4d71528e9f6cd7f0e0232bf0aa1168f4f3a05ab", "Preserve the prior music release.");
assert.ok(zip.file("assets/dark-fog-excerpt.mp3"));
assert.match(await zip.file("MUSIC-CREDITS.md")!.async("string"), /creativecommons.org\/licenses\/by\/4.0/);
assert.equal(JSON.parse(await zip.file("FORMAT-REPO.json")!.async("string")).review.reviewer, "User");
assert.equal(sha256(readFileSync(`${root}/downloads/character-gameplay-conversations-0.1.2.zip`)), "f4732bec6e967a0d52c41fee04a714b76344a05525ec056871c6ee5449f82a26", "Preserve the already-public prior version.");
assert.ok(!Object.keys(zip.files).some(file => /node_modules|secrets\.env|private\/|examples\/|batman-spongebob\.mp4/.test(file)), "Keep display-only and raw private media outside the ZIP.");
const publication = JSON.parse(await zip.file("PUBLICATION.json")!.async("string"));
assert.equal(publication.publicationAuthorized, true);
assert.equal(publication.detailedCreativeReview, "not-provided");
assert.match(publication.userAcceptance.quote, /cool looks good to me/);
assert.equal(publication.example.width, 1080);
assert.equal(publication.example.height, 1920);
assert.equal(publication.example.sha256, sha256(readFileSync(`${root}/${publication.example.file}`)));
console.log(`Character Gameplay Conversations: music preview, credit, user acceptance, pinned handoff and ${inventory.files.length}-file ZIP parity passed.`);
