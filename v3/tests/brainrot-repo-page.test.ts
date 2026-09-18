import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

const source = readFileSync("app/format-lab/brainrot/page.tsx", "utf8");
assert.match(source, /Wiggly \/ Format Lab/);
assert.match(source, /format-repositories\/brainrot-v1/);
assert.match(source, /Download runnable kit/);
assert.match(source, /Three scripts, two voices/);
assert.match(
  source,
  /https:\/\/github\.com\/smsheik1\/wiggly-brainrot\/releases\/download\/.*\.zip|\/format-repositories\/brainrot-v1\/downloads\/.*\.zip/,
);

const profile = getDiscoveryFormatProfile("brainrot");
assert.ok(profile?.handoff);
assert.equal(profile?.technicalHref, "/format-lab/brainrot");
assert.equal(profile?.handoff?.firstQuestion, "What website should I use for this Brainrot ad?");
assert.match(profile?.handoff?.totalEstimate || "", /\$0/);
const prompt = buildDiscoveryHandoffPrompt(profile!, "https://wiggly.agentenamel.com");
assert.match(prompt, /latest published Wiggly Format/);
assert.match(prompt, /Never use a paid provider without my explicit approval/);
assert.doesNotMatch(prompt, /Exact public version:|Required inputs:|Working rules:/);
assert.ok(prompt.length < 1_000);

console.log("Brainrot repo page tests passed.");
