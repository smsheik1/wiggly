import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { hash } from "./harness.js";
const root = resolve(process.argv[2]), proof = JSON.parse(readFileSync(join(root, "proof.json"), "utf8"));
const frames: any[] = [];
for (const result of proof.results) {
  const prepared = JSON.parse(readFileSync(join(root, result.scenario.id, "prepared.json"), "utf8"));
  const shared = join(root, result.scenario.id, "approved-portable-share/composition");
  assert.deepEqual(JSON.parse(readFileSync(join(shared, "scene.json"), "utf8")), prepared.scene);
  assert.equal(hash(readFileSync(join(shared, "film.mp4"))), result.full_film.sha256);
  for (const [index, clip] of prepared.scene.layout.clips.entries()) {
    const time = clip.startFrame / 30 + clip.durationFrames / 60;
    const rgb = execFileSync("ffmpeg", ["-v", "error", "-ss", String(time), "-i", result.full_film.path, "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    const color = result.scenario.colors[index % 2], [r, g, b] = rgb;
    assert.ok(color === "red" ? r > 200 && g < 20 && b < 20 : color === "blue" ? b > 200 && r < 20 && g < 20 : color === "green" ? g > 90 && r < 20 && b < 20 : r > 200 && g > 200 && b < 20, `${result.scenario.id} clip ${index} expected ${color}: ${Array.from(rgb)}`);
    frames.push({ scenario: result.scenario.id, clip: clip.id, time, expected_color: color, measured_rgb: Array.from(rgb) });
  }
}
writeFileSync(join(root, "render-parity.json"), JSON.stringify({ status: "PASS", scope: "actual full-export clip ordering plus identical preview/portable-share scene and export bytes", frames }, null, 2));
console.log(`PASS: ${frames.length} exported clip frames, portable share scenes and exact final export bytes.`);
