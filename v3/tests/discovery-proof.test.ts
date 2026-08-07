import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  discoveryCatalog,
  getDiscoveryEntryById,
  getRelatedDiscoveryEntries,
} from "../features/discovery/catalog";
import {
  discoveryFormatSlugs,
  getDiscoveryFormatProfile,
} from "../features/discovery/formatProof.server";

for (const entry of discoveryCatalog) {
  assert.equal(
    getDiscoveryEntryById(entry.id)?.id,
    entry.id,
    `Published Discovery ad ${entry.id} should resolve as its canonical /s slug.`,
  );
}

const threeD = getDiscoveryFormatProfile("three-d-breakdown");
assert.ok(threeD, "3D Breakdown should have a consumer Format proof.");
assert.equal(threeD.version, "1.5.0");
assert.equal(threeD.proofEntries.length, 6, "3D Breakdown should show all six real proof outputs separately.");
assert.equal(threeD.technicalHref, "/format-lab/three-d-breakdown");

const mugsyExplains = getDiscoveryFormatProfile("mugsy-explains");
assert.ok(mugsyExplains, "Mugsy Explains should have a consumer Format proof.");
assert.equal(mugsyExplains.version, "0.1.1-proof");
assert.equal(mugsyExplains.proofEntries.length, 1);
assert.equal(mugsyExplains.technicalHref, "/format-lab/mugsy-explains");

const cartoon = getDiscoveryFormatProfile("otaku-explainer");
assert.ok(cartoon, "Cartoon Explainer should have a consumer Format proof.");
assert.equal(cartoon.version, "1.2.1-experiment");
assert.ok(cartoon.proofEntries.length >= 3, "Cartoon Explainer should show at least three real proof outputs.");
assert.equal(cartoon.technicalHref, "/format-lab/cartoon-explainer");

const jingle = getDiscoveryFormatProfile("jingle");
assert.ok(jingle, "Brand Jingle should have a consumer Format proof.");
assert.equal(jingle.version, "1.0.0");
assert.equal(jingle.proofEntries.length, 39, "Brand Jingle proof should include every distinct completed song.");

const videoMeme = getDiscoveryFormatProfile("video-meme");
assert.ok(videoMeme, "Video Meme should have a consumer Format proof.");
assert.equal(videoMeme.version, "1.0.0");
assert.equal(videoMeme.proofEntries.length, 35, "Video Meme proof should include three canonical templates and every DB import.");

for (const slug of [
  "visualizer",
  "were-sorry",
  "text-message",
  "reviews",
  "brainrot",
  "fortnite-filter",
  "cinematic-photographer",
  "gta-vi",
  "selfie-nine-images",
  "rag-doll",
  "product-photoshoot",
  "mood-notes",
  "red-dead-redemption",
  "old-money-shot",
  "chrome-void",
  "ccd-jpeg-filter",
  "newsletter-writer",
  "passport-click",
  "fake-it-till-you-make-it",
  "dark-studio-portrait",
  "blue-phosphor",
  "dusk-effect",
  "sparkling-effect",
  "cool-tone-filter",
  "halo-effect",
  "doodle-art",
  "light-silhouette",
  "rim-portrait-filter",
  "cyanotype",
  "lord-of-the-rings",
  "soft-glow-filter",
  "paper-outfit",
  "moody-pink-effect",
  "cinematic-portrait-pack",
  "dreamcore-angel",
  "dark-aesthetic-filter",
  "2000s-effect",
  "80s-toon",
  "squilliam-news",
]) {
  const profile = getDiscoveryFormatProfile(slug);
  assert.ok(profile, `${slug} should have a consumer Format proof.`);
  assert.ok(profile.proofEntries.length >= 1, `${slug} should show real saved output.`);
}

assert.deepEqual(
  getRelatedDiscoveryEntries(threeD.proofEntries[0]).map((entry) => entry.format.slug),
  ["three-d-breakdown", "three-d-breakdown", "three-d-breakdown"],
  "Related proof should stay inside the exact Format.",
);

assert.ok(
  discoveryFormatSlugs.includes("jingle") &&
    discoveryFormatSlugs.includes("mugsy-explains") &&
    discoveryFormatSlugs.includes("video-meme") &&
    discoveryFormatSlugs.includes("meme") &&
    discoveryFormatSlugs.includes("hybrid-news") &&
    discoveryFormatSlugs.includes("fortnite-filter") &&
    discoveryFormatSlugs.includes("cinematic-photographer") &&
    discoveryFormatSlugs.includes("gta-vi") &&
    discoveryFormatSlugs.includes("selfie-nine-images") &&
    discoveryFormatSlugs.includes("rag-doll") &&
    discoveryFormatSlugs.includes("product-photoshoot") &&
    discoveryFormatSlugs.includes("mood-notes") &&
    discoveryFormatSlugs.includes("red-dead-redemption") &&
    discoveryFormatSlugs.includes("old-money-shot") &&
    discoveryFormatSlugs.includes("chrome-void") &&
    discoveryFormatSlugs.includes("ccd-jpeg-filter") &&
    discoveryFormatSlugs.includes("newsletter-writer") &&
    discoveryFormatSlugs.includes("passport-click") &&
    discoveryFormatSlugs.includes("fake-it-till-you-make-it") &&
    discoveryFormatSlugs.includes("dark-studio-portrait") &&
    discoveryFormatSlugs.includes("blue-phosphor") &&
    discoveryFormatSlugs.includes("dusk-effect") &&
    discoveryFormatSlugs.includes("sparkling-effect") &&
    discoveryFormatSlugs.includes("cool-tone-filter") &&
    discoveryFormatSlugs.includes("halo-effect") &&
    discoveryFormatSlugs.includes("doodle-art") &&
    discoveryFormatSlugs.includes("light-silhouette") &&
    discoveryFormatSlugs.includes("rim-portrait-filter") &&
    discoveryFormatSlugs.includes("cyanotype") &&
    discoveryFormatSlugs.includes("lord-of-the-rings") &&
    discoveryFormatSlugs.includes("soft-glow-filter") &&
    discoveryFormatSlugs.includes("paper-outfit") &&
    discoveryFormatSlugs.includes("moody-pink-effect") &&
    discoveryFormatSlugs.includes("cinematic-portrait-pack") &&
    discoveryFormatSlugs.includes("dreamcore-angel") &&
    discoveryFormatSlugs.includes("dark-aesthetic-filter") &&
    discoveryFormatSlugs.includes("2000s-effect") &&
    discoveryFormatSlugs.includes("80s-toon") &&
    discoveryFormatSlugs.includes("squilliam-news") &&
    discoveryFormatSlugs.includes("talking-fish-news") &&
    discoveryFormatSlugs.length === 47 &&
    !discoveryFormatSlugs.includes("motion-story"),
);
assert.equal(getDiscoveryFormatProfile("motion-story"), null);
assert.equal(getDiscoveryFormatProfile("does-not-exist"), null);

const discoveryClientSource = readFileSync("app/discover/DiscoveryClient.tsx", "utf8");
const sharePageSource = readFileSync("app/s/[slug]/page.tsx", "utf8");
const formatPageSource = readFileSync("app/formats/[slug]/page.tsx", "utf8");

assert.ok(
  discoveryClientSource.includes("`/formats/${entry.format.slug}`"),
  "Discovery should open one Format page containing all of that Format's examples.",
);
assert.ok(
  sharePageSource.indexOf("const discoveryEntry") <
    sharePageSource.indexOf("const convexConfigured"),
  "Approved Discovery ads should resolve before the existing Convex share lookup.",
);
assert.ok(
  sharePageSource.includes("ConvexHttpClient") &&
    sharePageSource.includes("api.sharePages.getBySlug") &&
    sharePageSource.includes("<ShareSceneClient"),
  "Non-Discovery share playback must keep the existing Convex and AdScene path.",
);
assert.ok(
  sharePageSource.includes("generateMetadata") &&
    sharePageSource.includes("entry.title") &&
    sharePageSource.includes("entry.format.version"),
  "Approved Discovery share pages should identify the finished ad and exact Format in metadata.",
);
assert.ok(
  formatPageSource.includes("generateStaticParams") &&
    formatPageSource.includes("DiscoveryProofMedia") &&
    formatPageSource.includes("Technical proof") &&
    formatPageSource.includes('heroProof.media.kind === "image"') &&
    formatPageSource.includes('entry.media.kind === "image"') &&
    formatPageSource.includes("aspect-[3/4]") &&
    formatPageSource.includes("aspect-[9/16]") &&
    formatPageSource.includes('media.aspectRatio === "16:9"') &&
    formatPageSource.includes("aspect-video") &&
    formatPageSource.includes("object-contain"),
  "Format pages should be static consumer proof surfaces over existing media and technical pages.",
);
assert.equal(existsSync("app/ads"), false, "Discovery must not add a second /ads detail route.");

console.log("discovery proof tests passed");
