import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import JSZip from "jszip";
import { getDiscoveryEntriesByFormat, discoveryShelfDefinitions } from "../features/discovery/catalog";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { getFormatRepoPagePresentation } from "../features/discovery/formatRepoPage.server";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

const profile = getDiscoveryFormatProfile("tutorial-video");
assert.ok(profile);
assert.equal(profile.name, "Tutorial Video");
assert.equal(profile.version, "0.2.0");
assert.equal(profile.repositoryHref, "/format-repositories/tutorial-video-v1/downloads/wiggly-tutorial-video-format-kit-0.2.0.zip");
assert.equal(getDiscoveryEntriesByFormat("tutorial-video").length, 1, "One tutorial Repo, not one card per source master.");
assert.deepEqual(discoveryShelfDefinitions.find((shelf) => shelf.id === "tutorial-video")?.formats, ["tutorial-video"]);

const presentation = await getFormatRepoPagePresentation("tutorial-video");
assert.equal(presentation.kind, "shared");
if (presentation.kind !== "shared") throw new Error("Tutorial Video uses the shared Repo presentation.");
assert.deepEqual(
  presentation.package.services.map((s) => s.name),
  ["Social Publisher (Buffer MCP or API)"],
);
assert.ok(presentation.package.optionalTools.includes("yt-dlp"));
assert.ok(presentation.package.optionalTools.includes("whisper.cpp"));
assert.ok(presentation.package.workflow.length >= 4);
assert.ok(presentation.package.quality.length > 0);
assert.ok(presentation.package.files.some((candidate) => candidate.name === "format.json" && /natural duration/i.test(candidate.content)));
assert.ok(presentation.package.proof.contactSheet?.endsWith("contact-sheet.jpg"));
assert.ok(presentation.package.assets.some((asset) => asset.href.endsWith("final.mp4")));
for (const file of ["README.md", "SKILL.md", "requirements.json", "quality.json"])
  assert.ok(presentation.package.files.some((candidate) => candidate.name === file));
const prompt = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.ok(prompt.includes(profile.repositoryHref));
assert.match(prompt, /Never use a paid provider without my explicit approval/);
assert.ok(existsSync(`public${profile.repositoryHref}`));
assert.ok(readFileSync("public/format-repositories/tutorial-video-v1/PROOF-REPORT.md", "utf8").includes("Recovered learnings"));
const archiveBytes = readFileSync(`public${profile.repositoryHref}`);
const zip = await JSZip.loadAsync(archiveBytes);
const inventory = JSON.parse(await zip.file("RELEASE-CONTENTS.json")!.async("string"));
assert.equal(inventory.version, profile.version);
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
for (const item of inventory.files) {
  const archived = await zip.file(item.file)!.async("nodebuffer");
  assert.equal(digest(archived), item.sha256, item.file);
  assert.deepEqual(archived, readFileSync(`public/format-repositories/tutorial-video-v1/${item.file}`), item.file);
}
console.log("Tutorial Video discovery entry, shelf, shared Repo page, handoff, and package evidence passed.");
