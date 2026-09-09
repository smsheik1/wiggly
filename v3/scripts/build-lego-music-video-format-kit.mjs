import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const v3 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relative = "public/format-repositories/lego-music-video-v1";
const repo = path.join(v3, relative);
const manifest = JSON.parse(await readFile(path.join(repo, "format.json"), "utf8"));
const name = "wiggly-lego-music-video-format-kit";
const zip = new JSZip();
const inventory = [];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
function add(file, bytes) {
  const data = Buffer.from(bytes);
  zip.file(`${name}/${file}`, data, { date: new Date("2026-01-01T00:00:00Z"), createFolders: false });
  inventory.push({ path: file, bytes: data.length, sha256: sha256(data) });
}
async function copy(source, target = `v3/${source}`) {
  const absolute = path.join(v3, source);
  for (const entry of (await readdir(absolute, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) throw new Error(`Do not package symlinks: ${source}/${entry.name}`);
    if (entry.isDirectory()) await copy(`${source}/${entry.name}`, `${target}/${entry.name}`);
    else add(`${target}/${entry.name}`, await readFile(path.join(absolute, entry.name)));
  }
}
for (const folder of ["features/audio", "features/formats", "features/llm", "features/render", "features/research", "features/scene", "remotion-entry", "public/fonts"]) await copy(folder);
for (const file of ["scripts/lego-music-video-format.ts", "tests/lego-music-video-contract.test.ts", "tests/lego-music-video-runtime.test.ts"]) add(`v3/${file}`, await readFile(path.join(v3, file)));
for (const file of ["README.md", "SKILL.md", "format.json", "requirements.json", "inputs.json", "scene-contract.json", "pipeline.json", "assets.json", "quality.json", "goldens.json"]) add(`v3/${relative}/${file}`, await readFile(path.join(repo, file)));
await copy(`${relative}/goldens`);
await copy(`${relative}/inputs`);
await copy(`${relative}/runtime`);
await copy(`${relative}/tests`);
add("v3/package.json", await readFile(path.join(repo, "kit.package.json")));
add("v3/tsconfig.json", await readFile(path.join(repo, "kit.tsconfig.json")));
add(".gitignore", "node_modules/\nsecrets.env\nv3/public/format-repositories/lego-music-video-v1/agent-runs/\n");
const adapter = `# Lego Music Video\n\nRead KIT-MANIFEST.json, then v3/${relative}/SKILL.md. That file is the single operating workflow. Use the packaged runtime and preserve its approval and review gates.\n`;
for (const file of ["AGENTS.md", "CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"]) add(file, adapter);
add(".cursor/rules/lego-music-video.mdc", `---\nalwaysApply: true\n---\n${adapter}`);
add("README.md", `# Lego Music Video\n\nStart with AGENTS.md. Version and file checksums are in KIT-MANIFEST.json. Commands run from v3. The full workflow is in v3/${relative}/SKILL.md.\n`);
const kitManifest = { id: manifest.id, version: manifest.version, officialRuntime: "v3/scripts/lego-music-video-format.ts", workflow: `v3/${relative}/SKILL.md`, inventory: inventory.sort((a, b) => a.path.localeCompare(b.path)) };
zip.file(`${name}/KIT-MANIFEST.json`, JSON.stringify(kitManifest, null, 2) + "\n", { date: new Date("2026-01-01T00:00:00Z"), createFolders: false });
const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
if (bytes.length >= 100_000_000) throw new Error("Archive exceeds the 100 MB publication limit.");
await mkdir(path.join(repo, "downloads"), { recursive: true });
await writeFile(path.join(repo, "downloads", `${name}.zip`), bytes);
await writeFile(path.join(repo, "downloads", "archive.json"), JSON.stringify({ version: manifest.version, bytes: bytes.length, sha256: sha256(bytes), files: inventory.length + 1 }, null, 2) + "\n");
console.log(JSON.stringify({ version: manifest.version, bytes: bytes.length, sha256: sha256(bytes), files: inventory.length + 1 }));
