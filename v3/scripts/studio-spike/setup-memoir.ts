import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { hash } from "./harness.js";
import { MEMOIR_PACKAGE_SHA256 } from "./memoir-format.js";
const kit = resolve("../../public/format-repositories/my-pixar-story-v1"), archive = resolve("format-packages/memoir-v2.0.0.tgz");
if (hash(readFileSync(archive)) !== MEMOIR_PACKAGE_SHA256) throw new Error("OFFICIAL_MEMOIR_ARCHIVE_CHANGED");
mkdirSync(join(kit, "build"), { recursive: true });
// Exact selected official renderer; no paths from an untrusted archive listing.
execFileSync("tar", ["-xzf", archive, "-C", kit, "build/remotion"], { stdio: "inherit" });
execFileSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: kit, stdio: "inherit" });
execFileSync("npm", ["rebuild", "esbuild"], { cwd: kit, stdio: "inherit" });
execFileSync("node", ["--test", "tests/remotion.test.mjs"], { cwd: kit, stdio: "inherit" });
console.log("Official Memoir renderer installed and packaged free smoke passed. No production state opened.");
