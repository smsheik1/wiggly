import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const page = readFileSync("app/format-lab/video-meme/page.tsx", "utf8");
const proof = readFileSync("features/discovery/formatProof.server.ts", "utf8");

assert.match(page, /download-video-meme-kit/);
assert.match(page, /video-meme-goldens/);
assert.match(page, /video-meme-pipeline/);
assert.match(page, /No provider key/);
assert.match(page, /golden-video-/);
assert.match(proof, /technicalHref: "\/format-lab\/video-meme"/);
assert.match(proof, /manifestPath: "format-repositories\/video-meme-v1\/format.json"/);
assert.match(proof, /What website or brand should this meme be for\?/);
assert.match(
  page,
  /https:\/\/github\.com\/smsheik1\/wiggly-video-meme\/releases\/download\/.*\.zip|\/format-repositories\/video-meme-v1\/downloads\/.*\.zip/,
);

console.log("Video Meme repo page tests passed.");
