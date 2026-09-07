import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = mkdtempSync(path.join(root, ".smoke-"));
const run = args => execFileSync(process.execPath, args, { cwd: root, stdio: "inherit", timeout: 120000 });
run(["runtime/render.mjs", "inputs/same-universe.json", path.join(output, "same-universe.mp4")]);
run(["runtime/render.mjs", "inputs/crossover.json", path.join(output, "crossover.mp4")]);
run(["tests/verify-proofs.mjs", path.join(output, "same-universe.mp4"), path.join(output, "crossover.mp4")]);
console.log("Smoke evidence retained at:", output);
