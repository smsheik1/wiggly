import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  discoveryCreators,
  getDiscoveryCreatorByHandle,
  getDiscoveryCreatorByName,
  getDiscoveryEntriesByCreator,
} from "../features/discovery/creators";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

assert.deepEqual(
  discoveryCreators.map((creator) => creator.handle),
  ["wiggly-studio", "shaz"],
  "Phase 3 should launch with a small curated creator catalog.",
);
assert.equal(getDiscoveryCreatorByHandle("wiggly-studio")?.name, "Wiggly Studio");
assert.equal(getDiscoveryCreatorByName("Shaz")?.handle, "shaz");
assert.ok(getDiscoveryEntriesByCreator("Wiggly Studio").length >= 4);
assert.ok(getDiscoveryEntriesByCreator("Shaz").length >= 3);
assert.equal(getDiscoveryCreatorByHandle("unknown"), null);

const origin = "https://wiggly.agentenamel.com";
const threeD = getDiscoveryFormatProfile("three-d-breakdown");
assert.ok(threeD?.handoff, "3D Breakdown should offer a runnable Codex handoff.");
assert.equal(threeD.version, "1.5.0");
assert.equal(threeD.handoff.firstQuestion, "What brand or website is this for?");
assert.equal(threeD.handoff.estimates.length, 4);

const threeDPrompt = buildDiscoveryHandoffPrompt(threeD, origin);
assert.match(threeDPrompt, /Exact public version: 1\.5\.0/);
assert.match(threeDPrompt, /https:\/\/wiggly\.agentenamel\.com\/formats\/three-d-breakdown/);
assert.match(threeDPrompt, /https:\/\/wiggly\.agentenamel\.com\/s\/final-straw-pocket-problem/);
assert.match(threeDPrompt, /Ask me one short question at a time/);
assert.match(threeDPrompt, /Start every progress update with the current step name/);
assert.match(threeDPrompt, /Never make a paid media call without my approval/);
assert.ok(
  threeDPrompt.trim().endsWith('"What brand or website is this for?"'),
  "The handoff should end with one short first question.",
);

const cartoon = getDiscoveryFormatProfile("otaku-explainer");
assert.ok(cartoon?.handoff, "Cartoon Explainer should offer its packaged agent run.");
assert.equal(cartoon.handoff.firstQuestion, "What topic should the video explain?");
assert.match(buildDiscoveryHandoffPrompt(cartoon, origin), /Exact public version: 1\.2\.1-experiment/);

const meme = getDiscoveryFormatProfile("meme");
assert.ok(meme?.handoff, "Meme should offer its packaged agent run.");
assert.equal(meme.handoff.firstQuestion, "What website should I use?");
assert.equal(meme.handoff.estimates.length, 3);
const memePrompt = buildDiscoveryHandoffPrompt(meme, origin);
assert.match(memePrompt, /Inspect all twelve local PNGs before delivery/);
assert.ok(memePrompt.trim().endsWith('"What website should I use?"'));

for (const slug of ["hybrid-news"]) {
  const profile = getDiscoveryFormatProfile(slug);
  assert.ok(profile);
  assert.equal(profile.handoff, undefined, `${slug} should not show a broken agent option.`);
  assert.throws(() => buildDiscoveryHandoffPrompt(profile, origin));
}

for (const route of [
  "app/creators/[handle]/page.tsx",
  "app/saved/page.tsx",
  "features/discovery/DiscoveryFormatHandoff.tsx",
]) {
  assert.ok(existsSync(route), `${route} should ship in Phase 3.`);
}

const savedPageSource = readFileSync("app/saved/page.tsx", "utf8");
const discoveryClientSource = readFileSync("app/discover/DiscoveryClient.tsx", "utf8");
const handoffSource = readFileSync("features/discovery/DiscoveryFormatHandoff.tsx", "utf8");
const formatPageSource = readFileSync("app/formats/[slug]/page.tsx", "utf8");

assert.ok(savedPageSource.includes("<DiscoveryClient") && savedPageSource.includes("savedOnly"));
assert.ok(
  discoveryClientSource.includes("readSavedDiscoveryIds(window.localStorage)") &&
    discoveryClientSource.includes('href={savedOnly ? "/discover" : "/saved"}'),
  "Saved ads should reuse the existing anonymous browser storage.",
);
assert.ok(handoffSource.includes("<Sheet") && handoffSource.includes("Start with Codex"));
assert.ok(handoffSource.includes('window.location.href = "codex://"'));
assert.equal(/fetch\(|Replicate|Seedance|Fish Audio/.test(handoffSource), false);
assert.ok(formatPageSource.includes("You provide") && formatPageSource.includes("Typical run"));

console.log("discovery handoff tests passed");
