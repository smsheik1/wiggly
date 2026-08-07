import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertRenderAllowed,
  buildProvenance,
  canFinalize,
  evaluateRequirements,
  materializeScenePlan,
  maxRenderAttempts,
  validateScenePlan,
  type OtakuLayoutManifest,
  type OtakuQualityReport,
  type OtakuRequirementManifest,
  type OtakuScenePlan,
  type OtakuWorldPack,
} from "../features/experiments/otaku-format/agentRunner";

const packageRoot = path.resolve("public", "format-repositories", "otaku-explainer-v1");
const readJson = <T,>(relativePath: string) => JSON.parse(readFileSync(path.join(packageRoot, relativePath), "utf8")) as T;

const requirements = readJson<OtakuRequirementManifest>("requirements.json");
const installedTools = { node: true, ffmpeg: true, ffprobe: true, remotion: true, uvx: true };
const freePlanningCheck = evaluateRequirements({ command: "validate", environment: {}, manifest: requirements, tools: installedTools });
assert.deepEqual(freePlanningCheck.missingEnvironment, []);
assert.equal(freePlanningCheck.ok, true);
const missingVoiceKey = evaluateRequirements({ command: "render", environment: {}, manifest: requirements, tools: installedTools });
assert.deepEqual(missingVoiceKey.missingEnvironment, ["FISH_STUDIO_APIKEY"]);
assert.equal(missingVoiceKey.ok, false);

const missingAssetKey = evaluateRequirements({ command: "render", environment: { FISH_STUDIO_APIKEY: "present" }, manifest: requirements, needsNewAssets: true, tools: installedTools });
assert.deepEqual(missingAssetKey.missingEnvironment, ["SERPER_API_KEY"]);
assert.equal(missingAssetKey.ok, false);

const missingAssetTool = evaluateRequirements({
  command: "render",
  environment: { FISH_STUDIO_APIKEY: "present", SERPER_API_KEY: "present" },
  manifest: requirements,
  needsNewAssets: true,
  tools: { ...installedTools, uvx: false },
});
assert.deepEqual(missingAssetTool.missingTools, ["uvx"]);

const missingTool = evaluateRequirements({ command: "render", environment: { FISH_STUDIO_APIKEY: "present" }, manifest: requirements, tools: { ...installedTools, ffmpeg: false } });
assert.deepEqual(missingTool.missingTools, ["ffmpeg"]);

const plan = readJson<OtakuScenePlan>("fixtures/naruto-how-apis-work.json");
const world = readJson<OtakuWorldPack>("worlds/naruto.json");
const layouts = readJson<OtakuLayoutManifest>("layouts.json");
assert.deepEqual(validateScenePlan(plan, world, layouts), []);

const materialized = materializeScenePlan(plan, world, layouts);
assert.equal(materialized.length, 15);
assert.equal(materialized[0].speaker, "naruto");
assert.deepEqual(materialized[0].characters.map((character) => character.asset), ["naruto", "kakashi"]);
assert.deepEqual(
  materialized[0].characters.map(({ asset: _asset, ...placement }) => placement),
  layouts.layouts["two-balanced"],
);
assert.equal(materialized[7].characters.length, 3);
assert.equal(materialized[7].speaker, "orochimaru");
assert.deepEqual(materialized[7].callout, { label: "AUTH", theme: "gold" });

const dannyPlan = readJson<OtakuScenePlan>("scenes/danny-apis.json");
const dannyWorld = readJson<OtakuWorldPack>("worlds/danny-phantom.json");
assert.deepEqual(validateScenePlan(dannyPlan, dannyWorld, layouts), []);
assert.equal(dannyWorld.music?.localPath, "assets/audio/danny-phantom-background.mp3");
assert.equal(dannyWorld.music?.volume, 0.16);
const dannyRun = readJson<{ musicPath: string }>("outputs/danny-apis.run.json");
const narutoRun = readJson<{ musicPath: string }>("outputs/naruto-apis.run.json");
assert.match(dannyRun.musicPath, /danny-phantom-background\.mp3$/);
assert.match(narutoRun.musicPath, /background-music\.mp3$/);
const dannyScenes = materializeScenePlan(dannyPlan, dannyWorld, layouts);
assert.deepEqual(
  [dannyScenes[0].speaker, dannyScenes[1].speaker, dannyScenes[9].speaker],
  ["danny-phantom", "tucker-foley", "vlad-plasmius"],
);
assert.deepEqual(new Set(dannyScenes.map((scene) => scene.background)), new Set(dannyWorld.backgrounds));
assert.equal(buildProvenance(dannyPlan, "1.1.0-experiment").worldPack, "worlds/danny-phantom.json");

const assetManifest = readJson<{ characters: Array<{ id: string }>; backgrounds: Array<{ id: string }> }>("assets.json");
const characterIds = new Set(assetManifest.characters.map((asset) => asset.id));
const backgroundIds = new Set(assetManifest.backgrounds.map((asset) => asset.id));
for (const role of Object.values(dannyWorld.roles)) assert.equal(characterIds.has(role.character), true);
for (const background of dannyWorld.backgrounds) assert.equal(backgroundIds.has(background), true);

const spongebobPlan = readJson<OtakuScenePlan>("scenes/spongebob-evs.json");
const spongebobWorld = readJson<OtakuWorldPack>("worlds/spongebob.json");
assert.deepEqual(validateScenePlan(spongebobPlan, spongebobWorld, layouts), []);
assert.equal(spongebobWorld.music?.localPath, "assets/audio/spongebob-background.mp3");
const spongebobRun = readJson<{ musicPath: string }>("outputs/spongebob-evs.run.json");
assert.match(spongebobRun.musicPath, /spongebob-background\.mp3$/);
const spongebobScenes = materializeScenePlan(spongebobPlan, spongebobWorld, layouts);
assert.deepEqual(
  [spongebobScenes[0].speaker, spongebobScenes[1].speaker, spongebobScenes[7].speaker],
  ["spongebob", "sandy-cheeks", "plankton"],
);
for (const role of Object.values(spongebobWorld.roles)) assert.equal(characterIds.has(role.character), true);
for (const background of spongebobWorld.backgrounds) assert.equal(backgroundIds.has(background), true);

const invalid = structuredClone(plan);
invalid.scenes[0].visibleRoles = ["guide", "guide"];
invalid.scenes[0].layout = "invented-layout";
invalid.scenes[0].background = "duel-arena";
invalid.scenes[0].dialogue = "x".repeat(101);
const errors = validateScenePlan(invalid, world, layouts);
assert.ok(errors.some((error) => error.includes("repeats a visible role")));
assert.ok(errors.some((error) => error.includes("must show its speaker")));
assert.ok(errors.some((error) => error.includes("unknown layout")));
assert.ok(errors.some((error) => error.includes("outside the Naruto pack")));
assert.ok(errors.some((error) => error.includes("exceeds 100 characters")));

const provenance = buildProvenance(plan, "1.1.0-experiment");
assert.equal(provenance.createdBy, "agent");
assert.equal(provenance.worldPack, "worlds/naruto.json");
assert.match(provenance.sourcePlanSha256, /^[a-f0-9]{64}$/);
assert.doesNotMatch(JSON.stringify(provenance), /apikey|secret|bearer/i);

assert.throws(() => assertRenderAllowed(0, false), /approval is required/);
assert.doesNotThrow(() => assertRenderAllowed(0, true));
assert.doesNotThrow(() => assertRenderAllowed(2, true));
assert.throws(() => assertRenderAllowed(maxRenderAttempts, true), /3 allowed render attempts/);

const passingReport: OtakuQualityReport = {
  attempt: 1,
  automaticChecks: { videoExists: true, dimensionsAre720x1280: true },
  creativeReview: {
    lessonAccurate: true,
    dialogueNatural: true,
    charactersGrounded: true,
    textFits: true,
    audioClear: true,
    analogyMakesSense: true,
  },
  problems: [],
  status: "pass",
};
assert.equal(canFinalize(passingReport), true);
assert.equal(canFinalize({ ...passingReport, problems: ["Text clips in scene 4."] }), false);
assert.equal(canFinalize({ ...passingReport, creativeReview: { ...passingReport.creativeReview, audioClear: false } }), false);
assert.equal(canFinalize({
  ...passingReport,
  automaticChecks: { ...passingReport.automaticChecks, voiceClipEndingsAreNotAbrupt: false },
}), false);

const runnerSource = readFileSync("scripts/otaku-format.ts", "utf8");
assert.match(runnerSource, /status: "draft" \| "rendering" \| "rendered" \| "inspected" \| "finalized"/);
assert.match(runnerSource, /state\.status = "rendered"/);

console.log("Otaku agent runner tests passed.");
