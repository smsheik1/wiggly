import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";
import { getFormatRepoPagePresentation } from "../features/discovery/formatRepoPage.server";
import { discoveryShelfDefinitions, getPublishedDiscoveryEntries, groupDiscoveryEntriesByShelf } from "../features/discovery/catalog";

// 1. Profile & Discovery verification
const profile = getDiscoveryFormatProfile("my-pixar-story");
assert.ok(profile, "my-pixar-story format profile must exist");
assert.equal(profile.name, "My Pixar Story");
assert.equal(profile.version, "2.0.0");
assert.equal(profile.proofEntries.length, 1);
assert.equal(profile.proofEntries[0].id, "my-pixar-story-shaz-for-mia");
assert.equal(profile.proofEntries[0].media.kind, "video");
assert.equal(profile.proofEntries[0].media.src, "/format-repositories/my-pixar-story-v1/examples/shaz-for-mia-web.mp4");

const pixarShelf = discoveryShelfDefinitions.find((s) => s.id === "my-pixar-story");
assert.ok(pixarShelf, "my-pixar-story shelf must exist in discoveryShelfDefinitions");
assert.equal(pixarShelf.layout, "landscape");
assert.deepEqual(pixarShelf.formats, ["my-pixar-story"]);

const publishedEntries = getPublishedDiscoveryEntries();
const publishedPixarEntry = publishedEntries.find((e) => e.id === "my-pixar-story-shaz-for-mia");
assert.ok(publishedPixarEntry, "my-pixar-story-shaz-for-mia must be published and visible on the Discover page");

const discoveryShelves = groupDiscoveryEntriesByShelf(publishedEntries);
assert.equal(discoveryShelves[0]?.id, "my-pixar-story", "My Pixar Story must be the first shelf at the top of the Discover page");

// 2. Physical Asset Parity verification
const publicAssets = [
  "public/format-repositories/my-pixar-story-v1/examples/shaz-for-mia-web.mp4",
  "public/format-repositories/my-pixar-story-v1/examples/shaz-for-mia-poster.jpg",
  "public/format-repositories/my-pixar-story-v1/examples/character-lineup.png",
  "public/format-repositories/my-pixar-story-v1/examples/story-grid.png",
  "public/format-repositories/my-pixar-story-v1/downloads/wiggly-my-pixar-story-format-kit.zip",
  "public/format-repositories/my-pixar-story-v1/downloads/wiggly-my-pixar-story-format-kit.zip.sha256",
  "public/format-repositories/my-pixar-story-v1/downloads/my-pixar-story.skill",
  "public/format-repositories/my-pixar-story-v1/README.md",
  "public/format-repositories/my-pixar-story-v1/SKILL.md",
  "public/format-repositories/my-pixar-story-v1/format.json",
  "public/format-repositories/my-pixar-story-v1/requirements.json",
  "public/format-repositories/my-pixar-story-v1/quality.json",
  "public/format-repositories/my-pixar-story-v1/pipeline.json",
  "public/format-repositories/my-pixar-story-v1/assets.json",
];

for (const asset of publicAssets) {
  assert.ok(existsSync(asset), `Asset must exist on disk: ${asset}`);
}

// 3. Advibly Section Component verification
const adviblySectionsSource = readFileSync("features/discovery/PixarStoryAdviblySections.tsx", "utf8");

// Compatible agents must match Advibly + Grokbot & Meta Muse
const agentSource = readFileSync("features/discovery/mcpSetupAgents.ts", "utf8");
const requiredAgents = [
  "Claude Code",
  "Claude",
  "Cursor",
  "Codex",
  "VS Code",
  "Windsurf",
  "ChatGPT",
  "Antigravity",
  "Grokbot",
  "Meta Muse",
];

for (const agent of requiredAgents) {
  assert.ok(
    agentSource.includes(`"${agent}"`) || agentSource.includes(`'${agent}'`),
    `MCP setup agents must include agent: ${agent}`,
  );
}

assert.match(adviblySectionsSource, /href=\{`\/mcp-setup\/\$\{slug\}`\}/);

// Pipeline stages verification
const requiredStages = [
  "Story Director (Beats & Thesis)",
  "4K Character Lineup Sheets",
  "Spatial 3D Environment Plates",
  "16:9 Storyboard Direct Panels",
  "Seedance 2.5 Emergent Multimodal Audio",
  "Lossless FFmpeg Concat & Dailies",
];

for (const stage of requiredStages) {
  assert.ok(
    adviblySectionsSource.includes(stage),
    `Advibly section must include pipeline stage: ${stage}`,
  );
}

// Model stack verification
const requiredModels = [
  "Claude Haiku 5.5 / Meta Muse",
  "Nano Banana 2.1",
  "Seedance 2.5",
  "ByteDance Video Upscaler",
  "Lossless FFmpeg",
];

for (const model of requiredModels) {
  assert.ok(
    adviblySectionsSource.includes(model),
    `Advibly section must mention model: ${model}`,
  );
}

assert.doesNotMatch(adviblySectionsSource, /\$19/);
assert.doesNotMatch(adviblySectionsSource, /\$69/);
assert.doesNotMatch(adviblySectionsSource, /wiggly_submit_film/);
assert.doesNotMatch(adviblySectionsSource, /WIGGLY_API_KEY/);
assert.ok(!adviblySectionsSource.includes("mcpServers"), "Raw JSON mcpServers block must be removed");

assert.match(adviblySectionsSource, /npx skills add wiggly-app\/skills -s my-pixar-story/);
assert.match(adviblySectionsSource, /Make a Pixar-style story from our family memories\./);
assert.match(adviblySectionsSource, /Connect the Wiggly MCP first/);
assert.match(adviblySectionsSource, /href="\/mcp-setup"/);
assert.match(adviblySectionsSource, /quotes credits before each still/);
assert.match(adviblySectionsSource, /wiggly-my-pixar-story-format-kit\.zip/);
assert.match(adviblySectionsSource, /my-pixar-story\.skill/);
assert.match(adviblySectionsSource, /git clone https:\/\/github.com\/wiggly-app\/skills\.git/);
assert.match(adviblySectionsSource, /max-w-\[1040px\]/);
assert.match(adviblySectionsSource, /All skills/);
assert.match(adviblySectionsSource, /What the skill/);
assert.match(adviblySectionsSource, /does for you\./);
assert.match(adviblySectionsSource, /3D animated family memoir from our memories/);
assert.match(adviblySectionsSource, /Warm big-eyed feature-animation film about my dad/);
assert.match(adviblySectionsSource, /Pixar-style tribute for my mom's birthday/);
assert.match(adviblySectionsSource, /A new cast for every family\./);
assert.match(adviblySectionsSource, /Short shots/);
assert.match(adviblySectionsSource, /Read the source/);
assert.match(adviblySectionsSource, /The playbook\./);
assert.match(adviblySectionsSource, /What to watch for\./);
assert.match(adviblySectionsSource, /Keep building\./);
assert.match(adviblySectionsSource, /DiscoveryFormatHandoff/);
assert.doesNotMatch(adviblySectionsSource, /Start creating/);

// Verify hero does not contain intimidating terminal box for casual users
const heroActionMatch = adviblySectionsSource.match(/export function PixarStoryHeroAction[\s\S]*?^}/m);
assert.ok(heroActionMatch, "PixarStoryHeroAction component must exist");
assert.doesNotMatch(heroActionMatch[0], /PixarStoryInstallCommand/, "Hero must not contain terminal CLI box");

const handoffPrompt = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.match(handoffPrompt, /CODING AGENT REQUIRED/);
assert.match(handoffPrompt, /MCP Server: https:\/\/wiggly\.agentenamel\.com\/mcp/);
assert.match(handoffPrompt, /npx skills add wiggly-app\/skills -s my-pixar-story/);

// 4. Page Integration verification
const pageSource = readFileSync("app/formats/[slug]/page.tsx", "utf8");
assert.match(pageSource, /PixarStoryAdviblySections/);
assert.match(pageSource, /PixarStoryHeroAction/);
assert.match(pageSource, /slug === "my-pixar-story"/);
assert.match(pageSource, /isPixarStory \? null : \(/);
assert.match(pageSource, /DM_Sans/);
assert.match(pageSource, /Manrope/);
assert.doesNotMatch(pageSource, /Start creating/);

// 5. Server presentation generation verification
const presentation = await getFormatRepoPagePresentation("my-pixar-story");
assert.ok(presentation, "Presentation must generate cleanly");
assert.equal(presentation.kind, "shared");
assert.ok(presentation.package, "Package data must exist");
assert.ok(presentation.package.services.length > 0, "Package services must exist");
assert.ok(presentation.package.workflow.length > 0, "Package workflow must exist");
assert.ok(presentation.package.quality.length > 0, "Package quality groups must exist");

console.log("My Pixar Story repo page tests passed successfully!");
