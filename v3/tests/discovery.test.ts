import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  discoveryCatalog,
  filterDiscoveryEntries,
  getPublishedDiscoveryEntries,
  getPublishedDiscoveryProofEntries,
  groupDiscoveryEntriesByShelf,
} from "../features/discovery/catalog";
import { databaseFormatDiscoveryEntries } from "../features/discovery/databaseFormatArchive";
import type { DiscoveryEntry } from "../features/discovery/types";
import { videoMemeDiscoveryEntries } from "../features/discovery/videoMemeArchive";

const published = getPublishedDiscoveryEntries();
const proofEntries = getPublishedDiscoveryProofEntries();
const discoveryStyles = readFileSync("app/discover/discovery.module.css", "utf8");
const discoveryClient = readFileSync("app/discover/DiscoveryClient.tsx", "utf8");

assert.doesNotMatch(
  discoveryClient,
  /Open Wiggly/,
  "Discover should not repeat a generic Open Wiggly CTA in its header.",
);
assert.match(
  discoveryClient,
  /<div className=\{styles\.cardCopy\}>\s*<h3>\{entry\.format\.name\}<\/h3>\s*<div className=\{styles\.cardActions\}>/,
  "Discover cards should lead with the recognizable Format name.",
);
assert.doesNotMatch(
  discoveryClient,
  /<p className=\{styles\.(?:brand|metadata|curatorNote)\}>/,
  "Discover cards should not repeat category, ownership/version, or curator-copy metadata below the creative.",
);
assert.match(
  discoveryStyles,
  /\.formatTag,\s*\.runtime\s*\{[\s\S]*?opacity:\s*0;/,
  "Card format and runtime labels should stay hidden until the card is engaged.",
);
assert.match(
  discoveryStyles,
  /\.card:hover \.formatTag,[\s\S]*\.card:focus-within \.runtime\s*\{[^}]*opacity:\s*1;/,
  "Card format and runtime labels should reveal on hover or keyboard focus.",
);
assert.doesNotMatch(
  discoveryClient,
  /onMouseEnter|onMouseLeave|previewMedia|stopMediaPreview/,
  "Hover must never change Discover playback or sound.",
);
assert.doesNotMatch(
  discoveryClient,
  /wiggly-discovery-sound|soundStorageKey/,
  "Discover should not restore a stale sound preference on page load.",
);
assert.doesNotMatch(
  discoveryClient,
  /\bautoPlay\b/,
  "Discover must wait for measured visibility instead of autoplaying every video in markup.",
);
assert.match(
  discoveryClient,
  /maxAmbientVideoPreviews = 2;[\s\S]*?ambientPreviewVisibilityThreshold = 0\.6;/,
  "Discover should cap ambient decoding at two substantially visible videos.",
);
assert.match(
  discoveryClient,
  /prefers-reduced-motion: reduce/,
  "Ambient video previews should respect reduced-motion preferences.",
);
assert.match(
  discoveryClient,
  /dataset\.discoveryPreview = "ambient";\s*video\.muted = true;\s*void video\.play\(\)/,
  "Visible video previews should be identified and remain muted.",
);
assert.match(
  discoveryClient,
  /stopAmbientPreview[\s\S]*?video\.pause\(\);[\s\S]*?delete video\.dataset\.discoveryPreview;/,
  "Ambient previews should stop when their cards leave the visible set.",
);
assert.match(
  discoveryClient,
  /media\.dataset\.discoveryPreview === "ambient"[\s\S]*?&& media\.muted[\s\S]*?return;/,
  "Muted ambient playback must not masquerade as explicit user playback.",
);
assert.match(
  discoveryClient,
  /const playWithSound[\s\S]*?media\.muted = false;[\s\S]*?media\.play\(\)/,
  "The Play control should start the selected media with sound in the click handler.",
);
assert.match(
  discoveryClient,
  /const syncPlayback[\s\S]*?playbackSynced/,
  "Native media events should reconcile the visible playback controls.",
);
assert.match(
  discoveryClient,
  /\{playing \? \([\s\S]*?Mute \$\{entry\.title\}[\s\S]*?Unmute \$\{entry\.title\}[\s\S]*?\) : null\}/,
  "Mute controls should only appear while the selected media is playing.",
);
assert.match(
  discoveryClient,
  /IntersectionObserver[\s\S]*?intersectionRatio >= 0\.2[\s\S]*?media\.pause\(\)/,
  "Active media should stop once its card leaves the viewport.",
);
assert.match(
  discoveryClient,
  /document\.hidden[\s\S]*?video\.pause\(\)[\s\S]*?audio\.pause\(\)/,
  "Hiding the page should stop every video and audio track.",
);
assert.match(
  discoveryClient,
  /onPlay=\{[\s\S]*?syncPlayback[\s\S]*?onPause=\{[\s\S]*?syncPlayback[\s\S]*?onError=\{[\s\S]*?stopErroredPlayback/,
  "Native play, pause, and error events should keep the controls truthful.",
);
assert.match(
  discoveryClient,
  /if \(!activePlayback\?\.id \|\| !activeEntryVisible\) return;[\s\S]*?const media = videoRefs\.current\.get\(activePlayback\.id\) \|\| audioRefs\.current\.get\(activePlayback\.id\);[\s\S]*?return \(\) => \{[\s\S]*?media\?\.pause\(\);[\s\S]*?media\.muted = true;/,
  "The active media node should be captured and stopped if its card unmounts.",
);
assert.doesNotMatch(
  discoveryClient,
  /ref=\{\([^)]*\) => \{[\s\S]{0,300}?\?\.pause\(\)/,
  "Inline ref callbacks must not pause media during ordinary React renders.",
);
assert.match(
  discoveryClient,
  /<Link[\s\S]*?href=\{formatHref\}[\s\S]*?className=\{styles\.mediaLink\}[\s\S]*?aria-label=\{`Open \$\{entry\.format\.name\} format`\}/,
  "Clicking visible Discovery media should open the same format page as the card action.",
);
assert.match(
  discoveryClient,
  /entry\.media\.kind === "image" \|\| entry\.format\.slug === "brainrot"[\s\S]*?\? styles\.mediaWellImage/,
  "Static creatives and the 4:5 Brainrot format should use the 4:5 media well.",
);
assert.match(
  discoveryStyles,
  /\.mediaWellImage\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*5;[^}]*background:\s*white;/,
  "Static creative cards should use a 4:5 white canvas.",
);
assert.match(
  discoveryStyles,
  /\.mediaLink > img:not\(\[data-discovery-reference\]\)\s*\{[^}]*object-fit:\s*contain;/,
  "Discovery must preserve the complete text and composition of static creatives.",
);
assert.match(
  discoveryClient,
  /entry\.media\.aspectRatio === "16:9"[\s\S]*?styles\.mediaWellLandscape/,
  "Landscape proof should select the aspect-aware media well.",
);
assert.match(
  discoveryStyles,
  /\.mediaWellLandscape\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9;/,
  "Landscape proof should preserve its complete 16:9 frame.",
);
assert.match(
  discoveryStyles,
  /\.mediaWell\.mediaWellLandscape video\s*\{[^}]*object-fit:\s*contain;/,
  "Landscape video must not crop the sides of the approved final.",
);

assert.ok(published.length >= 6, "Discovery should launch with enough real finished work to browse.");
assert.deepEqual(
  published.map((entry) => entry.order),
  [...published].map((entry) => entry.order).sort((left, right) => left - right),
  "Published entries should keep manual editorial order.",
);
assert.ok(
  proofEntries.every((entry) => entry.format.version && entry.format.owner),
  "Every Discovery entry should keep its exact Format version and owner.",
);
assert.ok(
  proofEntries.every((entry) => (
    entry.media.src.startsWith("/")
      ? existsSync(`public${entry.media.src}`)
      : entry.media.src.startsWith("https://")
  )),
  "Discovery entries should reference an existing public asset or a secure stored-media URL.",
);
assert.ok(
  proofEntries.every((entry) => !entry.media.referenceSrc || existsSync(`public${entry.media.referenceSrc}`)),
  "Every before-and-after proof should reference an existing original image.",
);
assert.ok(
  proofEntries
    .filter((entry) => ["cool-tone-filter", "halo-effect"].includes(entry.format.slug))
    .every((entry) => entry.media.src.endsWith("-display.jpg")),
  "Proofs with creator-baked insets must use cleaned display images before Wiggly adds its top-right reference.",
);
assert.ok(
  proofEntries
    .filter((entry) => entry.media.kind === "video")
    .every((entry) => entry.media.poster && existsSync(`public${entry.media.poster}`)),
  "Every video should have a local poster for slow connections.",
);
const jingleProofs = proofEntries.filter((entry) => entry.format.slug === "jingle");
const jingles = published.filter((entry) => entry.format.slug === "jingle");
assert.equal(jingleProofs.length, 39, "Every distinct completed jingle should remain available as Format proof.");
assert.equal(jingles.length, 11, "Discover should feature one finished jingle per brand.");
assert.equal(
  new Set(jingleProofs.map((entry) => entry.media.src)).size,
  jingleProofs.length,
  "The jingle archive should not repeat the same stored song.",
);
assert.ok(
  jingleProofs.every((entry) => entry.media.kind === "audio"),
  "Jingles should use native audio playback instead of fake video wrappers.",
);
assert.ok(
  jingleProofs
    .filter((entry) => entry.media.src.startsWith("/homepage/jingles/"))
    .every((entry) => entry.order < 20),
  "The three proven jingles should be spread through the opening feed.",
);
assert.equal(
  new Set(jingles.map((entry) => entry.brand)).size,
  jingles.length,
  "Songs People Remember should never repeat the same brand within its shelf.",
);
assert.deepEqual(
  jingles.filter((entry) => ["Apple", "David's Cookies", "OGTool"].includes(entry.brand)).map((entry) => entry.media.src),
  [
    "/homepage/jingles/apple-all-in-one-place.mp3",
    "/homepage/jingles/davids-no-time-to-bake.mp3",
    "/homepage/jingles/ogtool-break-the-rules.mp3",
  ],
  "The curated local Apple, David's Cookies, and OGTool jingles should represent their brands.",
);
const videoMemes = published.filter((entry) => entry.format.slug === "video-meme");
assert.equal(videoMemes.length, 3, "Discover should show each canonical Video Meme clip once.");
assert.equal(
  new Set(videoMemes.map((entry) => entry.media.src)).size,
  videoMemes.length,
  "The Video Meme archive should not repeat the same final render.",
);
const canonicalVideoMemeIds = [
  "video-meme-bear-secret",
  "video-meme-pingu-reversal",
  "video-meme-darwin-pain-stack",
];
assert.deepEqual(
  videoMemes.map((entry) => entry.id),
  canonicalVideoMemeIds,
  "Bear, Pingu Noot Noot, and Darwin should be three separate Discovery cards.",
);
const importedVideoMemes = videoMemeDiscoveryEntries.filter((entry) => !canonicalVideoMemeIds.includes(entry.id));
assert.equal(importedVideoMemes.length, 32, "Every completed Video Meme database import should remain available as proof.");
assert.ok(
  importedVideoMemes.every((entry) => (
    entry.showInDiscovery === false &&
    entry.media.kind === "video" &&
    entry.media.src.startsWith("https://wry-viper-639.convex.cloud/api/storage/") &&
    entry.media.poster?.startsWith("/discovery/video-memes/")
  )),
  "Imported Video Memes should stay off Discover while retaining completed renders and local loading posters.",
);
const memes = published.filter((entry) => entry.format.slug === "meme");
assert.deepEqual(
  memes.map((entry) => entry.id),
  ["davids-cookies-this-is-fine"],
  "Discovery should show one strong Meme example instead of repeating weaker archive proofs.",
);
assert.ok(
  databaseFormatDiscoveryEntries
    .filter((entry) => entry.format.slug === "meme")
    .every((entry) => entry.showInDiscovery === false),
  "Archived Meme proofs should stay available on the format page without cluttering Discover.",
);
assert.ok(
  databaseFormatDiscoveryEntries
    .filter((entry) => ["reviews", "were-sorry"].includes(entry.format.slug))
    .every((entry) => entry.showInDiscovery === false),
  "Customer Proof examples should stay available on format pages without cluttering Discover.",
);
assert.equal(
  published.some((entry) => ["reviews", "were-sorry"].includes(entry.format.slug)),
  false,
  "Reviews and We're Sorry should not appear on Discover.",
);
const generatedFormatSlugs = [
  "visualizer",
  "meme",
  "three-d-breakdown",
  "video-meme",
  "text-message",
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
  "shaz-puppet-runtime",
  "jingle",
  "newsletter-writer",
];
assert.ok(
  generatedFormatSlugs.every((slug) => published.some((entry) => entry.format.slug === slug)),
  "Discovery should include real proof from every currently public generated Wiggly format.",
);
assert.equal(
  published.some((entry) => entry.format.slug === "motion-story"),
  false,
  "Motion Story should stay out of Discovery until the format is ready.",
);
assert.equal(
  databaseFormatDiscoveryEntries.length,
  20,
  "The curated database import should keep only the reviewed cross-format proof set.",
);
assert.ok(
  databaseFormatDiscoveryEntries.every((entry) => entry.media.src.startsWith("/discovery/db-formats/")),
  "Curated database proof should use inspected local archive assets.",
);
assert.equal(
  published.some((entry) => entry.brand === "Something went wrong"),
  false,
  "Failed source metadata should never become public proof.",
);
for (const id of ["lego-origin-story", "danny-phantom-apis", "naruto-apis", "spongebob-evs"]) {
  assert.ok(proofEntries.some((entry) => entry.id === id), `${id} should be included in the finished-output archive.`);
}
assert.deepEqual(
  published.filter((entry) => entry.format.slug === "three-d-breakdown").map((entry) => entry.id),
  [
    "scrub-daddy-two-personalities",
    "final-straw-pocket-problem",
    "gruns-daily-stack",
    "theragun-heat-and-motion",
    "kiala-supplement-journey",
    "lego-origin-story",
  ],
  "Scrub Daddy should lead the six separate 3D Breakdown Discovery cards.",
);

const draftEntry: DiscoveryEntry = {
  ...discoveryCatalog[0],
  id: "draft-entry",
  status: "draft",
  order: 0,
};
assert.equal(
  getPublishedDiscoveryEntries([draftEntry, ...discoveryCatalog]).some((entry) => entry.id === draftEntry.id),
  false,
  "Draft entries should never appear in the public feed.",
);

assert.deepEqual(
  filterDiscoveryEntries(published, "therabody", "all").map((entry) => entry.id),
  ["theragun-heat-and-motion"],
  "Search should match brand names.",
);
assert.ok(
  filterDiscoveryEntries(published, "wiggly studio", "all").length >= 4,
  "Search should match Format owners.",
);
assert.ok(
  filterDiscoveryEntries(published, "", "teach").every((entry) => entry.goal === "teach"),
  "Goal filters should return only matching entries.",
);

const shelves = groupDiscoveryEntriesByShelf(published);
const shelvedEntries = shelves.flatMap((shelf) => shelf.entries);
const approvedRepoOrder = [
  ["two-d-character-animation", "Animate Shaz"],
  ["product-stories", "3D Breakdown"],
  ["lego-music-videos", "Lego Music Video"],
  ["character-conversations", "Animal Conversations"],
  ["character-dance-offs", "Bikini Bottom Dance Off"],
  ["product-photoshoots", "Product Photoshoot"],
  ["character-explainers", "Cartoon Explainer"],
  ["character-news", "Squilliam News"],
  ["talking-fish-news", "Talking Fish News"],
  ["mugsy-explains", "Mugsy Explains"],
  ["brand-jingles", "Brand Jingle"],
  ["brainrot", "Minecraft Brainrot"],
  ["character-gameplay-conversations", "Batman Arkham Conversations"],
  ["roast-me-conversations", "Roast Me Conversations"],
  ["video-memes", "Video Meme"],
  ["skai-generated", "Image Filters"],
  ["audio-visualizer", "Audio Visualizer"],
  ["hybrid-news", "Hybrid News"],
  ["static-hooks", "Meme"],
  ["conversations", "iMessage Ad"],
  ["written-content", "Newsletter Writer"],
  ["repo-builder", "Wiggly Repo Builder"],
  ["tutorial-video", "Tutorial Video"],
];
const tutorialEntry = discoveryCatalog.find((entry) => entry.format.slug === "tutorial-video");
assert.equal(tutorialEntry?.media.durationLabel, "2 min 29 sec", "Tutorial proof should advertise the recovered master's natural duration.");
assert.deepEqual(
  shelves.map((shelf) => [shelf.id, shelf.title]),
  approvedRepoOrder,
  "Discover must follow the approved Repo order, with one combined Image Filters category.",
);
for (const shelf of shelves) {
  const formats = new Set(shelf.entries.map((entry) => entry.format.slug));
  assert.equal(formats.size, shelf.id === "skai-generated" ? 31 : 1,
    "Only Image Filters may group multiple Repos; repeated examples stay under their own Repo.");
}
for (const goal of ["all", "sell", "explain", "story", "teach", "entertain"] as const) {
  const filteredShelves = groupDiscoveryEntriesByShelf(filterDiscoveryEntries(published, "", goal));
  const visibleIds = new Set(filteredShelves.map((shelf) => shelf.id));
  assert.deepEqual(
    filteredShelves.map((shelf) => [shelf.id, shelf.title]),
    approvedRepoOrder.filter(([id]) => visibleIds.has(id)),
    "Filtering must preserve the approved relative Repo order.",
  );
}
assert.equal(
  shelvedEntries.length,
  published.length,
  "Every published ad should appear on exactly one Discovery shelf.",
);
assert.equal(
  new Set(shelvedEntries.map((entry) => entry.id)).size,
  published.length,
  "Discovery shelves must not repeat finished ads.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "talking-fish-news")?.entries.map((entry) => entry.id),
  ["talking-fish-news-mars-tiles"],
  "Talking Fish News should appear once on its own shelf.",
);
assert.equal(
  shelves
    .flatMap((shelf) => shelf.entries)
    .filter((entry) => entry.format.slug === "fortnite-filter").length,
  1,
  "Fortnite Filter should use one Discovery card while all eight proofs stay inside the Format.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "brand-jingles")?.entries.map((entry) => entry.id),
  jingles.map((entry) => entry.id),
  "One curated jingle per brand should stay together in one horizontal shelf.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "conversations")?.entries
    .filter((entry) => entry.format.slug === "text-message")
    .map((entry) => entry.id),
  ["scene-j57cr2xv8py1b30waepejjm5wh8axj7d"],
  "iMessage Ad should show one proof on its own shelf.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "character-explainers")?.entries.map((entry) => entry.id),
  ["naruto-compilers", "yugioh-compilers", "danny-phantom-apis", "spongebob-evs"],
  "Character explainers should show one distinct Naruto, Yu-Gi-Oh!, Danny Phantom, and SpongeBob example.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "character-news"),
  {
    id: "character-news",
    title: "Squilliam News",
    description: "Real stories and promotions delivered as full-frame character broadcasts.",
    layout: "landscape",
    entries: [published.find((entry) => entry.id === "squilliam-news-artistic-emergency")],
  },
  "Squilliam News should live in its own landscape newsroom shelf.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "character-dance-offs")?.entries.map((entry) => entry.id),
  ["bikini-bottom-dance-off-ghetto-love-story", "bikini-bottom-dance-off-wiggle"],
  "Bikini Bottom Dance Off should live outside the explainer shelf.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "character-conversations")?.entries.map((entry) => entry.id),
  [
    "animal-conversations-listen-dont-judge",
    "animal-conversations-i-made-a-mistake",
  ],
  "Animal Conversations should keep both finished videos on its dedicated shelf.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "two-d-character-animation"),
  {
    id: "two-d-character-animation",
    title: "Animate Shaz",
    description: "A reusable 2D character who can speak, react, and stay on-model from scene to scene.",
    layout: "landscape",
    entries: [
      published.find((entry) => entry.id === "shaz-puppet-runtime-transcript-guided-story"),
    ],
  },
  "Animate Shaz should be visible once on its dedicated landscape shelf.",
);
assert.ok(
  shelves
    .find((shelf) => shelf.id === "product-stories")
    ?.entries.every((entry) => entry.format.slug === "three-d-breakdown"),
  "Product stories should contain only the ready 3D Breakdown format.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "mugsy-explains")?.entries.map((entry) => entry.id),
  ["wiggly-prompt-vs-format"],
  "Mugsy Explains should have one focused proof shelf.",
);
assert.equal(
  shelves
    .find((shelf) => shelf.id === "product-photoshoots")
    ?.entries.filter((entry) => entry.format.slug === "product-photoshoot").length,
  6,
  "Product Photoshoot should show one complete six-image campaign set.",
);
assert.ok(
  shelves
    .find((shelf) => shelf.id === "video-memes")
    ?.entries.every((entry) => entry.format.slug === "video-meme"),
  "Video Memes should have their own shelf.",
);
assert.ok(
  shelves
    .find((shelf) => shelf.id === "brainrot")
    ?.entries.every((entry) => entry.format.slug === "brainrot"),
  "Brainrot should not be merged into the Video Meme shelf.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "written-content")?.entries.map((entry) => entry.id),
  ["newsletter-writer-holden-history"],
  "Newsletter Writer should use one clear agent card in its own shelf.",
);
const newsletterWriterEntry = shelves
  .find((shelf) => shelf.id === "written-content")
  ?.entries[0];
assert.equal(newsletterWriterEntry?.brand, "Newsletter Writer");
assert.equal(
  newsletterWriterEntry?.media.src,
  "/discovery/newsletter-writer/newsletter-writer-agent.jpg",
);
assert.doesNotMatch(
  `${newsletterWriterEntry?.brand} ${newsletterWriterEntry?.title} ${newsletterWriterEntry?.curatorNote}`,
  /Holden/i,
  "The Newsletter Writer discovery card should describe the reusable agent, not one proof brand.",
);
assert.deepEqual(
  shelves.find((shelf) => shelf.id === "skai-generated")?.entries.map((entry) => entry.format.slug),
  [
    "cinematic-portrait-pack",
    "dreamcore-angel",
    "dark-aesthetic-filter",
    "2000s-effect",
    "passport-click",
    "fake-it-till-you-make-it",
    "selfie-nine-images",
    "dark-studio-portrait",
    "blue-phosphor",
    "dusk-effect",
    "light-silhouette",
    "sparkling-effect",
    "cool-tone-filter",
    "fortnite-filter",
    "chrome-void",
    "halo-effect",
    "mood-notes",
    "doodle-art",
    "rim-portrait-filter",
    "paper-outfit",
    "moody-pink-effect",
    "gta-vi",
    "ccd-jpeg-filter",
    "cyanotype",
    "soft-glow-filter",
    "cinematic-photographer",
    "red-dead-redemption",
    "lord-of-the-rings",
    "rag-doll",
    "80s-toon",
    "old-money-shot",
  ],
  "Every packaged SKAI image format should appear exactly once in descending source-comment order.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "selfie-nine-images").length,
  9,
  "All nine selfie scenes should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "rag-doll").length,
  7,
  "All seven Rag Doll examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "mood-notes").length,
  7,
  "All seven Mood Notes examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "red-dead-redemption").length,
  6,
  "All six Red Dead Redemption examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "old-money-shot").length,
  6,
  "All six Old Money Shot examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "chrome-void").length,
  6,
  "All six Chrome Void examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "ccd-jpeg-filter").length,
  5,
  "All five CCD JPEG Filter examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "passport-click").length,
  6,
  "All six Passport Click examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "fake-it-till-you-make-it").length,
  8,
  "All eight Fake It Till You Make It examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "dark-studio-portrait").length,
  6,
  "All six Dark Studio Portrait examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "blue-phosphor").length,
  7,
  "All seven Blue Phosphor examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "dusk-effect").length,
  3,
  "All three Dusk Effect examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "sparkling-effect").length,
  4,
  "All four Sparkling Effect examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "cool-tone-filter").length,
  6,
  "All six Cool Tone Filter examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "halo-effect").length,
  6,
  "All six Halo Effect examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "doodle-art").length,
  5,
  "All five Doodle Art examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "light-silhouette").length,
  7,
  "All seven Light Silhouette examples should remain available inside the Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "rim-portrait-filter").length,
  7,
  "The Wiggly proof and six SKAI Rim Portrait examples should remain inside one Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "lord-of-the-rings").length,
  7,
  "The native hero, Wiggly proof, and five SKAI examples should remain inside one Lord of the Rings Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "soft-glow-filter").length,
  7,
  "The native hero and six SKAI examples should remain inside one Soft Glow Filter Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "paper-outfit").length,
  7,
  "The native hero and six SKAI examples should remain inside one Paper Outfit Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "moody-pink-effect").length,
  6,
  "The native hero and five SKAI examples should remain inside one Moody Pink Effect Format page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "cinematic-portrait-pack").length,
  9,
  "The native hero and eight SKAI prompt cards should remain inside one Cinematic Portrait Pack page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "dreamcore-angel").length,
  7,
  "The native hero and six SKAI source proofs should remain inside one Dreamcore Angel page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "dark-aesthetic-filter").length,
  11,
  "The native hero and ten SKAI source proofs should remain inside one Dark Aesthetic Filter page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "2000s-effect").length,
  9,
  "The native hero and eight SKAI source proofs should remain inside one 2000s Effect page.",
);
assert.equal(
  proofEntries.filter((entry) => entry.format.slug === "80s-toon").length,
  8,
  "The native hero and seven SKAI source proofs should remain inside one 80s Toon page.",
);

console.log("discovery tests passed");
