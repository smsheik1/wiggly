import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  discoveryCreators,
  getDiscoveryCreatorByHandle,
  getDiscoveryCreatorByName,
  getDiscoveryEntriesByCreator,
} from "../features/discovery/creators";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { getFormatRepoFamily } from "../features/discovery/formatRepoPage.server";
import {
  buildAntigravityAppUrl,
  buildCodexHandoffUrl,
  buildDiscoveryCliCommand,
  buildDiscoveryHandoffPrompt,
} from "../features/discovery/handoff";

assert.deepEqual(
  discoveryCreators.map((creator) => creator.handle),
  ["wiggly-studio", "shaz"],
  "Phase 3 should launch with a small curated creator catalog.",
);
assert.equal(
  getDiscoveryCreatorByHandle("wiggly-studio")?.name,
  "Wiggly Studio",
);
assert.equal(getDiscoveryCreatorByName("Shaz")?.handle, "shaz");
assert.ok(getDiscoveryEntriesByCreator("Wiggly Studio").length >= 4);
assert.ok(getDiscoveryEntriesByCreator("Shaz").length >= 3);
assert.equal(getDiscoveryCreatorByHandle("unknown"), null);

const skaiRepoFamily = getFormatRepoFamily("cinematic-portrait-pack");
assert.equal(skaiRepoFamily?.name, "Image Filters");
assert.equal(skaiRepoFamily?.formatCount, 31);
assert.equal(
  getFormatRepoFamily("cool-tone-filter")?.name,
  "Image Filters",
);
assert.equal(getFormatRepoFamily("animal-conversations"), null);

const origin = "https://wiggly.agentenamel.com";
const threeD = getDiscoveryFormatProfile("three-d-breakdown");
assert.ok(
  threeD?.handoff,
  "3D Breakdown should offer a runnable Codex handoff.",
);
assert.equal(threeD.version, "1.6.0");
assert.equal(
  threeD.handoff.firstQuestion,
  "What brand or website is this for?",
);
assert.equal(threeD.handoff.estimates.length, 4);

const threeDPrompt = buildDiscoveryHandoffPrompt(threeD, origin);
assert.ok(threeDPrompt.startsWith("CODING AGENT REQUIRED:"));
assert.match(
  threeDPrompt,
  /cannot access this computer's terminal, filesystem, and media files/,
);
assert.match(threeDPrompt, /do not analyze or simulate/);
assert.match(
  threeDPrompt,
  /Reply only: "Open this in Codex, Claude Code, Antigravity, Cursor, or Copilot CLI\."/,
);
assert.match(threeDPrompt, /latest published Wiggly Format/);
assert.match(
  threeDPrompt,
  /https:\/\/wiggly\.agentenamel\.com\/formats\/three-d-breakdown/,
);
assert.match(threeDPrompt, /SKILL\.md/);
assert.match(
  threeDPrompt,
  /Never use a paid provider without my explicit approval/,
);
assert.match(threeDPrompt, /validation and quality checks pass/);
assert.doesNotMatch(
  threeDPrompt,
  /Exact public version:|Required inputs:|Format instructions:|Working rules:/,
);
assert.doesNotMatch(
  threeDPrompt,
  /final-straw-pocket-problem|What brand or website is this for/,
);
assert.ok(
  threeDPrompt.length < 1_000,
  "The handoff should remain a concise launcher.",
);
assert.equal(
  buildCodexHandoffUrl("Make this & verify it"),
  "codex://new?prompt=Make%20this%20%26%20verify%20it",
);
assert.equal(buildAntigravityAppUrl(), "antigravity://");
assert.equal(
  buildDiscoveryCliCommand("antigravity-cli", "Ship it"),
  "agy -p 'Ship it'",
);
assert.equal(
  buildDiscoveryCliCommand("claude-code", "It's ready"),
  `claude 'It'"'"'s ready'`,
);
assert.equal(
  buildDiscoveryCliCommand("cursor", "Ship it"),
  "cursor-agent 'Ship it'",
);
assert.equal(
  buildDiscoveryCliCommand("github-copilot", "Ship it"),
  "copilot -p 'Ship it'",
);

const cartoon = getDiscoveryFormatProfile("otaku-explainer");
assert.ok(
  cartoon?.handoff,
  "Cartoon Explainer should offer its packaged agent run.",
);
assert.equal(
  cartoon.handoff.firstQuestion,
  "What topic should the video explain?",
);
assert.match(
  buildDiscoveryHandoffPrompt(cartoon, origin),
  /latest published Wiggly Format/,
);

const meme = getDiscoveryFormatProfile("meme");
assert.ok(meme?.handoff, "Meme should offer its packaged agent run.");
assert.equal(meme.handoff.firstQuestion, "What website should I use?");
assert.equal(meme.handoff.estimates.length, 3);
const memePrompt = buildDiscoveryHandoffPrompt(meme, origin);
assert.doesNotMatch(
  memePrompt,
  /Inspect all twelve local PNGs before delivery/,
);
assert.doesNotMatch(memePrompt, /What website should I use/);
assert.ok(memePrompt.length < 1_000);

for (const slug of ["hybrid-news"]) {
  const profile = getDiscoveryFormatProfile(slug);
  assert.ok(profile);
  assert.equal(
    profile.handoff,
    undefined,
    `${slug} should not show a broken agent option.`,
  );
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
const discoveryClientSource = readFileSync(
  "app/discover/DiscoveryClient.tsx",
  "utf8",
);
const handoffSource = readFileSync(
  "features/discovery/DiscoveryFormatHandoff.tsx",
  "utf8",
);
const formatPageSource = readFileSync("app/formats/[slug]/page.tsx", "utf8");
const runSummarySource = readFileSync(
  "features/discovery/FormatRepoRunSummary.tsx",
  "utf8",
);

assert.ok(
  savedPageSource.includes("<DiscoveryClient") &&
    savedPageSource.includes("savedOnly"),
);
assert.ok(
  discoveryClientSource.includes(
    "readSavedDiscoveryIds(window.localStorage)",
  ) &&
    discoveryClientSource.includes('href={savedOnly ? "/discover" : "/saved"}'),
  "Saved ads should reuse the existing anonymous browser storage.",
);
assert.equal(handoffSource.includes("<Sheet"), false);
assert.equal(handoffSource.includes("<DropdownMenu"), false);
assert.ok(
  handoffSource.includes("Copy Agent Prompt") &&
    handoffSource.includes("Copied prompt!"),
);
assert.ok(handoffSource.includes("format_handoff_started"));
assert.equal(handoffSource.includes('feedback ?? "Send to Agent"'), false);
assert.equal(handoffSource.includes("Copy prompt for any agent"), false);
assert.equal(handoffSource.includes("Gemini CLI"), false);
assert.equal(
  /fetch\(|Replicate|Seedance|Fish Audio/.test(handoffSource),
  false,
);
assert.match(formatPageSource, /<FormatRepoRunSummary/);
assert.ok(
  runSummarySource.includes("You provide") &&
    runSummarySource.includes("Typical run"),
);
assert.match(runSummarySource, /Know the run before you start\./);
assert.match(runSummarySource, /handoff\.estimates\.map/);
assert.match(formatPageSource, /href="#examples"/);
assert.match(
  formatPageSource,
  /One family\. \{repoFamily\.formatCount\} recipes\./,
);
assert.match(formatPageSource, /data-testid="shared-repo-family"/);
assert.match(formatPageSource, /format\.proofEntries\.length > 4/);
assert.match(
  formatPageSource,
  /repoPage\.kind !== "shared" \? \([\s\S]*<FormatRepoIncludedAssets[\s\S]*\) : \([\s\S]*<FormatRepoPackageAssets/,
  "Every Format route must populate included assets from its specialized presentation or actual package.",
);
assert.doesNotMatch(
  formatPageSource,
  /repoTrust\s*\?\s*"min-h-\[66px\]/,
  "The hero shell should not change between old and new Repo pages.",
);

console.log("discovery handoff tests passed");
