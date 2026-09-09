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
assert.equal(profile.version, "0.4.0");
assert.equal(profile.repositoryHref, "/format-repositories/tutorial-video-v1/downloads/wiggly-tutorial-video-format-kit-0.4.0.zip");
const entries = getDiscoveryEntriesByFormat("tutorial-video");
assert.equal(entries.length, 1, "One tutorial Repo, not one card per proof input.");
assert.equal(entries[0].format.version, "0.4.0");
assert.ok(entries[0].media.src.endsWith("examples/animal-conversations-first-run/final.mp4"));
assert.ok(existsSync(`public${entries[0].media.src}`));
assert.ok(existsSync(`public${entries[0].media.poster}`));
assert.deepEqual(discoveryShelfDefinitions.find((shelf) => shelf.id === "tutorial-video")?.formats, ["tutorial-video"]);

const presentation = await getFormatRepoPagePresentation("tutorial-video");
assert.equal(presentation.kind, "shared");
if (presentation.kind !== "shared") throw new Error("Tutorial Video uses the shared Repo presentation.");
if (!presentation.package) throw new Error("Tutorial Video missing package data.");
assert.deepEqual(presentation.package.services.map((service) => service.name), ["Fish Audio", "Social Publisher (Buffer MCP or API)"]);
assert.ok(presentation.package.optionalTools.includes("yt-dlp"));
assert.ok(presentation.package.optionalTools.includes("whisper.cpp"));
assert.ok(presentation.package.workflow.length >= 5);
assert.ok(presentation.package.quality.length > 0);
assert.ok(presentation.package.files.some((candidate) => candidate.name === "format.json" && /real 16:9 tutorial compositor/i.test(candidate.content)));
assert.ok(presentation.package.proof.contactSheet?.endsWith("contact-sheet.jpg"));
assert.ok(presentation.package.assets.some((asset) => asset.href.endsWith("final.mp4")));
assert.ok(presentation.package.assets.some((asset) => asset.href.endsWith("grid-acid-lime-v1.png")));
for (const file of ["README.md", "SKILL.md", "requirements.json", "quality.json"])
  assert.ok(presentation.package.files.some((candidate) => candidate.name === file));
const prompt = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.ok(prompt.includes(profile.repositoryHref));
assert.match(prompt, /Never use a paid provider without my explicit approval/);
assert.ok(existsSync(`public${profile.repositoryHref}`));
assert.ok(readFileSync("public/format-repositories/tutorial-video-v1/PROOF-REPORT.md", "utf8").includes("Failure addressed"));
const archiveBytes = readFileSync(`public${profile.repositoryHref}`);
const zip = await JSZip.loadAsync(archiveBytes);
const inventory = JSON.parse(await zip.file("RELEASE-CONTENTS.json")!.async("string"));
assert.equal(inventory.version, profile.version);
for (const required of ["runtime/tutorial-video.jsx", "runtime/contract.mjs", "runtime/narrate.mjs", "references/preparation.md", "fixtures/narration-plan.json", "tests/narrate.test.mjs", "runtime/publish.mjs", "media/fixed/grid-acid-lime-v1.png", "fixtures/template/input.json", "tests/distribution.test.mjs"]) {
  assert.ok(zip.file(required), `Archive must include ${required}`);
}
assert.equal(zip.file("assets/source/animal-conversations-tutorial-v11.mp4"), null, "The obsolete source-master wrapper must not ship.");
const archivedInputContract = JSON.parse(await zip.file("input-contract.json")!.async("string"));
assert.ok(archivedInputContract.forbidden.includes("sourceVideo"));
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
for (const item of inventory.files) {
  const file = zip.file(item.file);
  assert.ok(file, `Archive must include ${item.file}`);
  if (item.sizeBytes < 1024 * 1024) {
    const archived = await file!.async("nodebuffer");
    assert.equal(digest(archived), item.sha256, item.file);
    const disk = readFileSync(`public/format-repositories/tutorial-video-v1/${item.file}`);
    assert.ok(archived.equals(disk), `Bit parity mismatch: ${item.file}`);
  }
}
console.log("Tutorial Video discovery entry, shelf, shared Repo page, handoff, and package evidence passed.");
