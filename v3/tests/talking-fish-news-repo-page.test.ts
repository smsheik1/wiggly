import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

const source = readFileSync("app/format-lab/talking-fish-news/page.tsx", "utf8");

assert.match(source, /download-talking-fish-news-kit/);
assert.match(source, /talking-fish-news-proof/);
assert.match(source, /talking-fish-news-pipeline/);
assert.match(source, /What should tonight&apos;s fish report cover/);
assert.match(source, /four sourced evidence beats/);
assert.doesNotMatch(source, /TalkingFishNewsProofClient|generate.*(?:Image|Video)/i);
assert.match(
  source,
  /https:\/\/github\.com\/smsheik1\/wiggly-talking-fish-news\/releases\/download\/.*\.zip|\/format-repositories\/talking-fish-news-v1\/downloads\/.*\.zip/,
);

const profile = getDiscoveryFormatProfile("talking-fish-news");
assert.ok(profile?.handoff);
assert.equal(profile.version, "1.0.0");
assert.equal(profile.technicalHref, "/format-lab/talking-fish-news");
const handoff = buildDiscoveryHandoffPrompt(profile, "https://wiggly.agentenamel.com");
assert.match(handoff, /latest published Wiggly Format/);
assert.match(handoff, /Never use a paid provider without my explicit approval/);
assert.doesNotMatch(handoff, /Exact public version:|Required inputs:|Working rules:/);
assert.ok(handoff.length < 1_000);

console.log("Talking Fish News repo page tests passed.");
