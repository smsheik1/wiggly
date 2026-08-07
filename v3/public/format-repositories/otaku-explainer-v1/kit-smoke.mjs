import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const packageRoot = path.resolve("public", "format-repositories", "otaku-explainer-v1");
const requiredFiles = [
  "SKILL.md",
  "requirements.json",
  "renderer/OtakuFormatRenderer.tsx",
  "assets.json",
  "audio.json",
  "layouts.json",
  "quality.json",
  "pipeline.json",
  "goldens.json",
  "goldens/naruto-apis-contact-sheet.jpg",
  "scene-contract.json",
  "worlds/naruto.json",
  "prompts/script-system.md",
  "assets/reference/reference.mp4",
];
const runtimeFiles = [
  "scripts/otaku-format.ts",
  "scripts/otaku-media.ts",
  "scripts/render-otaku-proofs.ts",
  "scripts/smoke-otaku-format.ts",
  "features/experiments/otaku-format/agentRunner.ts",
  "features/experiments/otaku-format/OtakuProofVideo.tsx",
  "features/experiments/otaku-format/Root.tsx",
  "features/experiments/otaku-format/render-entry.tsx",
];

const missing = [
  ...requiredFiles.map((file) => path.join(packageRoot, file)),
  ...runtimeFiles.map((file) => path.resolve(file)),
].filter((file) => !existsSync(file));

if (missing.length) {
  console.error(`Format Kit is incomplete:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  process.exitCode = 1;
} else {
  const skill = readFileSync(path.join(packageRoot, "SKILL.md"), "utf8");
  if (!/Do not rebuild|do not rebuild/i.test(skill)) {
    console.error("SKILL.md must tell agents to use the packaged renderer instead of rebuilding it.");
    process.exitCode = 1;
  } else {
    console.log("Format Kit files are complete. Run `npm install`, then `npm run smoke`.");
  }
}
