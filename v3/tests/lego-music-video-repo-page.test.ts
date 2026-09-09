import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { discoveryShelfDefinitions, getDiscoveryEntriesByFormat } from "../features/discovery/catalog";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { getFormatRepoPagePresentation } from "../features/discovery/formatRepoPage.server";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

const profile = getDiscoveryFormatProfile("lego-music-video")!;
assert.equal(profile.name, "Lego Music Video");
assert.equal(profile.version, "0.1.0");
assert.equal(profile.proofEntries.length, 2, "Two videos, one Repo—not two formats.");
assert.equal(getDiscoveryEntriesByFormat("jingle").some(e => e.format.slug === profile.slug), false);
assert.deepEqual(discoveryShelfDefinitions.find(s => s.id === "lego-music-videos")!.formats, ["lego-music-video"]);
assert.deepEqual(discoveryShelfDefinitions.find(s => s.id === "brand-jingles")!.formats, ["jingle"]);
const presentation = await getFormatRepoPagePresentation(profile.slug);
assert.equal(presentation.kind, "shared");
assert.deepEqual(presentation.package!.services.map(s => s.name), ["ElevenLabs", "Replicate", "Social Publisher (Buffer MCP or API)"]);
assert.ok(presentation.package!.assets.length >= 3);
assert.ok(presentation.package!.workflow.length >= 8);
assert.match(profile.handoff!.totalEstimate, /supplied media/);
const prompt = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.match(prompt, /Never use a paid provider without my explicit approval/);
assert.ok(prompt.length < 1_000);
const root = "public/format-repositories/lego-music-video-v1";
const bytes = readFileSync(`public${profile.repositoryHref}`);
const receipt = JSON.parse(readFileSync(`${root}/downloads/archive.json`, "utf8"));
assert.equal(receipt.sha256, createHash("sha256").update(bytes).digest("hex"));
const zip = await JSZip.loadAsync(bytes);
const prefix = "wiggly-lego-music-video-format-kit/";
const manifest = JSON.parse(await zip.file(`${prefix}KIT-MANIFEST.json`)!.async("string"));
assert.equal(manifest.version, profile.version);
const kitPackage = JSON.parse(await zip.file(`${prefix}v3/package.json`)!.async("string"));
assert.ok(kitPackage.dependencies.tailwindcss, "The official renderer imports Tailwind CSS; the standalone artifact must declare it.");
assert.equal(kitPackage.overrides.ws, "8.21.0", "Keep the patched WebSocket dependency in the consumer kit.");
assert.equal(kitPackage.overrides["@remotion/bundler"].esbuild, "0.28.1", "Keep the patched bundler dependency in the consumer kit.");
for (const item of manifest.inventory) {
  const asset = await zip.file(prefix + item.path)!.async("nodebuffer");
  assert.equal(createHash("sha256").update(asset).digest("hex"), item.sha256, item.path);
}
assert.ok(!Object.keys(zip.files).some(file => /(?:agent-runs|node_modules|secrets\.env|recover-lego|import-lego-music-video-proof)/.test(file)));
for (const adapter of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md", ".cursor/rules/lego-music-video.mdc"]) {
  const text = await zip.file(prefix + adapter)!.async("string");
  assert.match(text, /SKILL\.md/);
  assert.doesNotMatch(text, /npm |generate --/);
}
console.log("Lego rich page, separate Repo identity, launcher and complete ZIP inventory passed.");
