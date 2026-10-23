import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";
import { getFormatRepoPagePresentation } from "../features/discovery/formatRepoPage.server";

// 1. Profile & Discovery verification
const profile = getDiscoveryFormatProfile("my-pixar-story");
assert.ok(profile, "my-pixar-story format profile must exist");
assert.equal(profile.name, "My Pixar Story");
assert.equal(profile.version, "2.0.0");
assert.equal(profile.proofEntries.length, 1);
assert.equal(profile.proofEntries[0].id, "my-pixar-story-shaz-for-mia");
assert.equal(profile.proofEntries[0].media.kind, "video");
assert.equal(profile.proofEntries[0].media.src, "/format-repositories/my-pixar-story-v1/examples/shaz-for-mia-web.mp4");

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
    adviblySectionsSource.includes(`"${agent}"`) || adviblySectionsSource.includes(`'${agent}'`),
    `Advibly section must include agent: ${agent}`,
  );
}

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
  "SeedVR2 (Modal H100)",
  "Lossless FFmpeg",
];

for (const model of requiredModels) {
  assert.ok(
    adviblySectionsSource.includes(model),
    `Advibly section must mention model: ${model}`,
  );
}

// Check install commands and downloads
assert.match(adviblySectionsSource, /npx skills add wiggly\/skills -s my-pixar-story/);
assert.match(adviblySectionsSource, /wiggly-my-pixar-story-format-kit\.zip/);
assert.match(adviblySectionsSource, /my-pixar-story\.skill/);

// 4. Page Integration verification
const pageSource = readFileSync("app/formats/[slug]/page.tsx", "utf8");
assert.match(pageSource, /PixarStoryAdviblySections/);
assert.match(pageSource, /slug === "my-pixar-story"/);

// 5. Server presentation generation verification
const presentation = await getFormatRepoPagePresentation("my-pixar-story");
assert.ok(presentation, "Presentation must generate cleanly");
assert.equal(presentation.kind, "shared");
assert.ok(presentation.package, "Package data must exist");
assert.ok(presentation.package.services.length > 0, "Package services must exist");
assert.ok(presentation.package.workflow.length > 0, "Package workflow must exist");
assert.ok(presentation.package.quality.length > 0, "Package quality groups must exist");

console.log("My Pixar Story repo page tests passed successfully!");
