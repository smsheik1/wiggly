import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const filename = fileURLToPath(import.meta.url);
const v3Root = path.resolve(path.dirname(filename), "..");
const formatRelative = path.join("public", "format-repositories", "otaku-explainer-v1");
const formatRoot = path.join(v3Root, formatRelative);
const stagingParent = path.join(v3Root, "tmp", "otaku-format-kit");
const kitName = "wiggly-cartoon-explainer-format-kit";
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
  "features/experiments/otaku-format/agentRunner.ts",
  "features/experiments/otaku-format/OtakuProofVideo.tsx",
  "features/experiments/otaku-format/Root.tsx",
  "features/experiments/otaku-format/render-entry.tsx",
  "scripts/otaku-format.ts",
  "scripts/otaku-media.ts",
  "scripts/render-otaku-proofs.ts",
  "scripts/smoke-otaku-format.ts",
  "tests/otaku-format-runtime.test.ts",
]) {
  await copyFromV3(relativePath);
}

for (const name of [
  "README.md",
  "SKILL.md",
  "assets.json",
  "audio.json",
  "format.json",
  "goldens.json",
  "inputs.json",
  "layouts.json",
  "pipeline.json",
  "quality.json",
  "requirements.json",
  "scene-contract.json",
]) {
  await copyFromV3(path.join(formatRelative, name));
}
await copyFromV3(path.join(formatRelative, ".env.example"), ".env.example");
await copyFromV3(path.join(formatRelative, "kit-smoke.mjs"), "kit-smoke.mjs");
for (const directory of ["fixtures", "goldens", "prompts", "renderer", "scenes", "worlds", "assets/images", "assets/reference"]) {
  await copyFromV3(path.join(formatRelative, directory));
}
const audioDirectory = path.join(formatRoot, "assets", "audio");
for (const name of await readdir(audioDirectory)) {
  if (name.endsWith(".mp3")) {
    await copyFromV3(path.join(formatRelative, "assets", "audio", name));
  }
}

await writeFile(path.join(stagingV3, "package.json"), await readFile(path.join(formatRoot, "kit.package.json")));
await writeFile(path.join(stagingRoot, "README.md"), `# Wiggly Cartoon Explainer Format Kit

Start here.

1. Open the \`v3\` folder.
2. Run \`npm install\`.
3. Run \`npm run smoke\`.
4. Give your agent this request: “Read \`public/format-repositories/otaku-explainer-v1/SKILL.md\` and use the packaged renderer. Do not rebuild it.”

The agent will ask what the characters should explain, then guide the run one step at a time. Planning and validation are local. Voice generation uses the BYOK Fish key only after the scene plan is valid.
`);

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
console.log(`Built ${path.relative(v3Root, outputPath)} (${Math.round(size / 1_024 / 1_024)} MB).`);
