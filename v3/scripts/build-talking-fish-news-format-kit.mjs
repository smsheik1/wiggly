import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const v3Root = path.resolve(path.dirname(filename), "..");
const formatRelative = path.join("public", "format-repositories", "talking-fish-news-v1");
const formatRoot = path.join(v3Root, formatRelative);
const stagingParent = path.join(v3Root, "tmp", "talking-fish-news-format-kit");
const kitName = "wiggly-talking-fish-news-format-kit";
const stagingRoot = path.join(stagingParent, kitName);
const stagingV3 = path.join(stagingRoot, "v3");
const outputDirectory = path.join(formatRoot, "downloads");
const outputPath = path.join(outputDirectory, `${kitName}.zip`);

const copyFromV3 = async (relativePath, targetPath = relativePath) => {
  await cp(path.join(v3Root, relativePath), path.join(stagingV3, targetPath), { recursive: true });
};

await rm(stagingParent, { force: true, recursive: true });
await mkdir(path.join(stagingV3, formatRelative), { recursive: true });
await mkdir(outputDirectory, { recursive: true });

for (const relativePath of [
  "features/audio/audioAnalysis.ts",
  "features/audio/deepgramTranscription.ts",
  "features/audio/fishStudio.ts",
  "features/audio/sceneAudio.ts",
  "features/formats/brainrot/prompt.ts",
  "features/formats/talking-fish-news",
  "features/formats/three-d-breakdown/storySubject.ts",
  "features/formats/types.ts",
  "features/render",
  "features/research/types.ts",
  "features/scene",
  "remotion-entry/index.ts",
  "remotion-entry/RemotionAdScene.tsx",
  "scripts/talking-fish-news-format.ts",
  "tests/talking-fish-news-repo.test.ts",
]) await copyFromV3(relativePath);

await writeFile(
  path.join(stagingV3, "features", "formats", "registry.ts"),
  [
    'import type { RenderableAdFormatId } from "../scene/types";',
    'import type { AdFormatModule } from "./types";',
    'import { talkingFishNewsFormatModule } from "./talking-fish-news";',
    '',
    'export const getFormatModule = (format: RenderableAdFormatId): AdFormatModule => {',
    '  if (format !== "talking-fish-news") throw new Error(`Unknown ad format: ${format}`);',
    '  return talkingFishNewsFormatModule as AdFormatModule;',
    '};',
    '',
  ].join("\n"),
);
await writeFile(
  path.join(stagingV3, "remotion-entry", "fixture.ts"),
  'export { talkingFishNewsProofScene as defaultRenderScene } from "../features/formats/talking-fish-news/fixture";\n',
);
await writeFile(
  path.join(stagingV3, "remotion-entry", "Root.tsx"),
  [
    'import { Composition } from "remotion";',
    'import type { RenderableAdScene } from "../features/scene/types";',
    'import { defaultRenderScene } from "./fixture";',
    'import { RemotionAdScene } from "./RemotionAdScene";',
    '',
    'export const adSceneCompositionId = "AdSceneMp4";',
    'export const adSceneFps = 60;',
    '',
    'export function RemotionRoot() {',
    '  return (',
    '    <Composition',
    '      id={adSceneCompositionId}',
    '      component={RemotionAdScene}',
    '      width={1080}',
    '      height={1920}',
    '      fps={adSceneFps}',
    '      durationInFrames={adSceneFps * 18}',
    '      calculateMetadata={({ props }: { props: { scene: RenderableAdScene } }) => ({',
    '        durationInFrames: Math.ceil((props.scene.layout.durationMs / 1000) * adSceneFps),',
    '        width: 1080,',
    '        height: 1920,',
    '      })}',
    '      defaultProps={{ scene: defaultRenderScene }}',
    '    />',
    '  );',
    '}',
    '',
  ].join("\n"),
);

await copyFromV3("public/fonts");
await copyFromV3("public/talking-fish-news-assets");

for (const name of [
  ".env.example",
  "README.md",
  "SKILL.md",
  "assets.json",
  "format.json",
  "goldens.json",
  "inputs.json",
  "kit.package.json",
  "kit-smoke.mjs",
  "pipeline.json",
  "quality.json",
  "requirements.json",
  "scene-contract.json",
]) await copyFromV3(path.join(formatRelative, name));

for (const directory of ["fixtures", "goldens", "prompts", "inputs", "runtime", "tests"]) {
  await copyFromV3(path.join(formatRelative, directory));
}

await copyFromV3(path.join(formatRelative, "kit-smoke.mjs"), "kit-smoke.mjs");
await copyFromV3(path.join(formatRelative, "SKILL.md"), "SKILL.md");
await writeFile(path.join(stagingV3, "package.json"), await readFile(path.join(formatRoot, "kit.package.json")));
await writeFile(
  path.join(stagingRoot, "README.md"),
  [
    "# Wiggly Talking Fish News Format Kit",
    "",
    "Open `v3/SKILL.md` if you are an agent.",
    "Open `v3/public/format-repositories/talking-fish-news-v1/README.md` for the human quick start.",
    "Run commands from the `v3` directory.",
    "",
  ].join("\n"),
);

const fixedDate = new Date("2026-01-01T00:00:00.000Z");
const normalizeTimes = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await normalizeTimes(entryPath);
    await utimes(entryPath, fixedDate, fixedDate);
  }
};
await normalizeTimes(stagingRoot);
await utimes(stagingRoot, fixedDate, fixedDate);

await rm(outputPath, { force: true });
const zip = spawnSync("zip", ["-X", "-q", "-r", outputPath, kitName], {
  cwd: stagingParent,
  encoding: "utf8",
});
if (zip.status !== 0) throw new Error(`zip failed: ${zip.stderr}`);
const size = (await stat(outputPath)).size;
console.log(`Built ${path.relative(v3Root, outputPath)} (${Math.round(size / 1_024)} KB).`);
