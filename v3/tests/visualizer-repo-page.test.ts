import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";

const source = readFileSync("app/format-lab/visualizer/page.tsx", "utf8");
assert.match(source, /download-visualizer-kit/);
assert.match(source, /visualizer-goldens/);
assert.match(source, /visualizer-pipeline/);
assert.match(source, /two voices/);
assert.match(source, /format-repositories\/visualizer-v1/);
assert.match(
  source,
  /https:\/\/github\.com\/smsheik1\/wiggly-visualizer\/releases\/download\/.*\.zip|\/format-repositories\/visualizer-v1\/downloads\/.*\.zip/,
);

const profile = getDiscoveryFormatProfile("visualizer");
assert.equal(profile?.technicalHref, "/format-lab/visualizer");
assert.equal(profile?.version, "1.0.0");
assert.equal(profile?.handoff?.firstQuestion, "What website is this conversation ad for?");
assert.match(profile?.handoff?.totalEstimate || "", /\$0\.01-\$0\.02/);

console.log("visualizer repository page tests passed");
