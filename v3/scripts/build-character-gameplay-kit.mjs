import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { archiveFiles } from "../public/format-repositories/repo-builder-v1/runtime/package.mjs";

const root = fileURLToPath(new URL("../public/format-repositories/character-gameplay-conversations-v1/", import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, "FORMAT-REPO.json"), "utf8"));
for (const name of ["format.json", "KIT-MANIFEST.json", "package.json", "package-lock.json"]) {
  assert.equal(JSON.parse(await readFile(path.join(root, name), "utf8")).version, manifest.version, name);
}
await mkdir(path.join(root, "downloads"), { recursive: true });
const output = path.join(root, "downloads", `${manifest.slug}-${manifest.version}.zip`);
console.log(JSON.stringify(await archiveFiles({ root, output, files: manifest.releaseFiles, metadata: { kind: "wiggly-format", slug: manifest.slug, version: manifest.version, review: manifest.review } }), null, 2));
