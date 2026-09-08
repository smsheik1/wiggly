import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createVideoMemeSceneFromPlan,
  validateVideoMemePlan,
  type VideoMemePlan,
  type VideoMemeResearch,
} from "../features/formats/video-meme/repoRuntime";
import { buildVideoMemePrompt } from "../features/formats/video-meme/prompt";
import { toStoredVideoMemeResearch } from "../features/formats/video-meme/repoRuntime";

const packageRoot = path.resolve("public", "format-repositories", "video-meme-v1");
const readJson = <T,>(relativePath: string) => JSON.parse(
  readFileSync(path.join(packageRoot, relativePath), "utf8"),
) as T;

const fixtures = [
  "fixtures/bear-secret.json",
  "fixtures/pingu-reversal.json",
  "fixtures/darwin-pain-stack.json",
] as const;

for (const fixturePath of fixtures) {
  const fixture = readJson<{ research: VideoMemeResearch; plan: VideoMemePlan }>(fixturePath);
  assert.deepEqual(validateVideoMemePlan(fixture.research, fixture.plan), [], fixturePath);
  const scene = createVideoMemeSceneFromPlan({
    research: fixture.research,
    plan: fixture.plan,
    runId: fixture.plan.templateId,
    now: 123,
  });
  assert.equal(scene.format, "video-meme");
  assert.equal(scene.layout.templateId, fixture.plan.templateId);
  assert.equal(scene.metadata.provider, "deterministic");
  assert.equal(scene.metadata.model, "host-agent");
}

const bearFixture = readJson<{ research: VideoMemeResearch; plan: VideoMemePlan }>("fixtures/bear-secret.json");
const prompt = buildVideoMemePrompt(
  toStoredVideoMemeResearch(bearFixture.research),
  3,
  "bear-sniff",
);
assert.match(prompt, /Write exactly 3 variants/);
assert.match(prompt, /This bear sniffs/);
assert.match(prompt, /Never name the brand or product/);

const missingSource = structuredClone(bearFixture);
missingSource.research.buyerMoments[0]!.sourceUrl = null;
assert.ok(validateVideoMemePlan(missingSource.research, missingSource.plan).some((error) => error.includes("sourceUrl")));

const invalidEvidence = structuredClone(bearFixture);
invalidEvidence.plan.selectedEvidenceIndexes = [999];
assert.ok(validateVideoMemePlan(invalidEvidence.research, invalidEvidence.plan).some((error) => error.includes("Evidence index")));

const brandCaption = structuredClone(bearFixture);
brandCaption.plan.slots.caption = "This bear sniffs people who secretly order David's Cookies.";
assert.ok(validateVideoMemePlan(brandCaption.research, brandCaption.plan).some((error) => error.includes("incomplete video meme variants")));

for (const required of [
  ".env.example",
  "README.md",
  "SKILL.md",
  "format.json",
  "goldens.json",
  "inputs.json",
  "pipeline.json",
  "quality.json",
  "requirements.json",
  "prompts/research.md",
  "prompts/template-selection.md",
  "prompts/caption.md",
  "fixtures/bear-secret.json",
  "fixtures/pingu-reversal.json",
  "fixtures/darwin-pain-stack.json",
  "goldens/bear-secret.mp4",
  "goldens/pingu-reversal.mp4",
  "goldens/darwin-pain-stack.mp4",
]) {
  assert.equal(existsSync(path.join(packageRoot, required)), true, `${required} must be packaged.`);
}

for (const clip of ["bear-sniff.mp4", "pingu-noot-noot.mp4", "darwin-journey.mp4"]) {
  assert.equal(existsSync(path.resolve("public", "video-memes", clip)), true, `${clip} must be bundled.`);
}

const skill = readFileSync(path.join(packageRoot, "SKILL.md"), "utf8");
const runner = readFileSync("scripts/video-meme-format.ts", "utf8");
const requirements = readJson<{ environment: Record<string, unknown>; providers: unknown[] }>("requirements.json");
const kitPackage = readJson<{ dependencies: Record<string, string> }>("kit.package.json");

assert.match(skill, /What website or brand should this meme be for\?/);
assert.match(skill, /Ask one question at a time/);
assert.match(skill, /Do not ask about a budget/);
assert.match(skill, /Research → Pattern → Caption → Render → Deliver/);
assert.match(skill, /Which caption should I use\? Say 1, 2, 3, or pick for me\./);
assert.match(skill, /do it for me.*Turbo/i);
assert.match(skill, /No API key|required.*no API key/i);
assert.deepEqual(requirements.environment, {});
assert.deepEqual(requirements.providers, [
  {
    name: "Social Publisher (Buffer MCP or API)",
    purpose: "Simultaneous multi-platform publishing to YouTube Shorts, Instagram Reels, TikTok, and X.",
    optional: true,
    environmentVariables: ["BUFFER_API_KEY"],
    pricingSource: "https://buffer.com/pricing",
  },
]);
assert.equal(kitPackage.dependencies.tailwindcss, "4.3.3");
assert.doesNotMatch(runner, /\bfetch\s*\(|callNvidiaNim|generateImage|generateVideo|generateVoice/i);
assert.match(runner, /No provider was called/);
assert.match(runner, /already has a rendered MP4/);
assert.match(runner, /approve-final/);

console.log("Video Meme agent runner tests passed.");
