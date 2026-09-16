import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { imageSize } from "image-size";
import JSZip from "jszip";
import {
  getPublishedDiscoveryEntries,
  groupDiscoveryEntriesByShelf,
} from "../features/discovery/catalog";
import { getBikiniBottomDanceOffTrustData } from "../features/discovery/bikiniBottomDanceOffTrust.server";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { buildDiscoveryHandoffPrompt } from "../features/discovery/handoff";

const repositoryRoot = "public/format-repositories/bikini-bottom-dance-off-v1";
const evidenceRoot = `${repositoryRoot}/examples/wiggle-proof/evidence`;
const latestExampleRoot = `${repositoryRoot}/examples/ghetto-love-story/evidence`;
const download = `${repositoryRoot}/downloads/wiggly-bikini-bottom-dance-off-format-kit.zip`;
const finalVideo = `${evidenceRoot}/final.mp4`;
const profile = getDiscoveryFormatProfile("bikini-bottom-dance-off");
const formatPageSource = readFileSync("app/formats/[slug]/page.tsx", "utf8");
const repoPageRegistrySource = readFileSync(
  "features/discovery/formatRepoPage.server.ts",
  "utf8",
);
const entries = getPublishedDiscoveryEntries().filter(
  (entry) => entry.format.slug === "bikini-bottom-dance-off",
);

assert.deepEqual(
  entries.map((entry) => entry.id),
  [
    "bikini-bottom-dance-off-ghetto-love-story",
    "bikini-bottom-dance-off-wiggle",
  ],
);
assert.equal(
  entries[0]?.media.src,
  `/${latestExampleRoot.replace(/^public\//, "")}/final.mp4`,
);
assert.equal(
  entries[0]?.media.poster,
  `/${latestExampleRoot.replace(/^public\//, "")}/poster.png`,
);
assert.equal(entries[0]?.media.aspectRatio, "9:16");
assert.equal(statSync(`${latestExampleRoot}/final.mp4`).size > 5_000_000, true);
assert.equal(existsSync(`${latestExampleRoot}/poster.png`), true);
assert.equal(entries[1]?.media.src, `/${finalVideo.replace(/^public\//, "")}`);
assert.equal(statSync(finalVideo).size > 5_000_000, true);
assert.equal(existsSync(`${evidenceRoot}/poster.png`), true);
assert.equal(existsSync(`${evidenceRoot}/contact-sheet.png`), true);
assert.equal(existsSync(`${evidenceRoot}/delivery.json`), true);
assert.equal(existsSync(`${evidenceRoot}/review-packet.json`), true);
assert.equal(existsSync(`${evidenceRoot}/render-report.json`), true);
assert.equal(existsSync(`${evidenceRoot}/blind-review.submission.json`), true);
assert.equal(existsSync(`${evidenceRoot}/blind-review.json`), true);

const evalReport = JSON.parse(
  readFileSync(`${evidenceRoot}/eval-report.json`, "utf8"),
) as {
  rubricVersion: string;
  overall: Record<string, string | number>;
  technicalCriteria: Array<{ status: string; explanation: string }>;
  blindCriteria: Array<{
    status: string;
    explanation: string;
    rating: number;
    score: number;
  }>;
};
assert.deepEqual(evalReport.overall, {
  status: "pass",
  score: 85,
  provisionalScore: 85,
  grade: "B",
  passingScore: 85,
  scoreMeaning:
    "blind creative quality only; technical validity is reported separately as pass or fail",
  technicalStatus: "pass",
  technicalPassed: 16,
  technicalTotal: 16,
});
assert.equal(evalReport.rubricVersion, "1.0.0");
assert.equal(evalReport.technicalCriteria.length, 16);
assert.ok(
  evalReport.technicalCriteria.every(
    (criterion) => criterion.status === "pass" && criterion.explanation,
  ),
);
assert.equal(evalReport.blindCriteria.length, 7);
assert.ok(
  evalReport.blindCriteria.every(
    (criterion) => criterion.status === "scored" && criterion.rating === 3,
  ),
);
const delivery = JSON.parse(
  readFileSync(`${evidenceRoot}/delivery.json`, "utf8"),
) as {
  status: string;
  finalVideo: { path: string; sha256: string };
  eval: { grade: string; score: number; status: string };
};
assert.equal(delivery.status, "ready");
assert.equal(delivery.eval.grade, "B");
assert.equal(delivery.eval.score, 85);
assert.equal(delivery.eval.status, "pass");
assert.equal(delivery.finalVideo.path, "final.mp4");
assert.match(delivery.finalVideo.sha256, /^[0-9a-f]{64}$/);

assert.ok(profile?.handoff);
assert.equal(profile.version, "0.17.0");
assert.equal(profile.technicalHref, "/format-lab/character-dance-lab");
assert.equal(
  profile.handoff.output,
  "One 47-second vertical MP4 plus a quality report",
);
assert.equal(
  profile.repositoryHref,
  "https://github.com/smsheik1/wiggly-bikini-bottom-dance-off/releases/download/v0.17.0/wiggly-bikini-bottom-dance-off-format-kit.zip",
);
assert.equal(profile.proofEntries.length, 2);
assert.match(repoPageRegistrySource, /Finished Dance Offs\./);
assert.match(repoPageRegistrySource, /bikini-bottom-dance-off-wiggle/);
assert.match(formatPageSource, /id="examples"/);
if (existsSync(download)) {
  assert.ok(
    statSync(download).size < 100 * 1024 * 1024,
    "The published format kit must remain below GitHub's 100 MiB file limit.",
  );
  const kitRoot = "wiggly-bikini-bottom-dance-off-format-kit";
  const archive = await JSZip.loadAsync(readFileSync(download));
  const zipEntries = Object.keys(archive.files).join("\n");
  assert.doesNotMatch(zipEntries, /secrets\.env|\.env\.local|agent-runs\//);
  for (const entry of [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursor/rules/wiggly-format.mdc",
    "verify-entrypoints.mjs",
    "KIT-MANIFEST.json",
    "bikini-bottom-dance-off-v1/SKILL.md",
    "bikini-bottom-dance-off-v1/assets/voice-previews/manifest.json",
    "bikini-bottom-dance-off-v1/assets/voice-previews/spongebob.mp3",
    "bikini-bottom-dance-off-v1/assets/voice-previews/olaf.mp3",
    "bikini-bottom-dance-off-v1/examples/wiggle-proof/evidence/render-report.json",
    "mixamo-character-motion-v1/assets/character-import-audit.json",
    "mixamo-character-motion-v1/evidence/character-preview-repairs/receipt.json",
  ]) {
    assert.match(
      zipEntries,
      new RegExp(`${kitRoot}/${entry.replaceAll(".", "\\.")}`),
    );
  }
  const readArchivedText = async (relativePath: string) => {
    const file = archive.file(`${kitRoot}/${relativePath}`);
    assert.ok(file, `${relativePath} must exist in the downloadable kit.`);
    return file.async("string");
  };
  const archivedManifest = JSON.parse(
    await readArchivedText("KIT-MANIFEST.json"),
  ) as { formatVersion: string };
  assert.equal(archivedManifest.formatVersion, "0.17.0");
  const archivedAgents = await readArchivedText("AGENTS.md");
  assert.match(archivedAgents, /bikini-bottom-dance-off-v1\/SKILL\.md/);
  assert.match(archivedAgents, /exact resolved version/);
  assert.match(
    archivedAgents,
    /Codex, Antigravity app and CLI, and GitHub Copilot/,
  );
}
const prompt = buildDiscoveryHandoffPrompt(
  profile,
  "https://wiggly.agentenamel.com",
);
assert.match(
  prompt,
  /Runnable Repo: https:\/\/github\.com\/smsheik1\/wiggly-bikini-bottom-dance-off\/releases\/download/,
);
assert.match(prompt, /root agent instructions/);
assert.match(prompt, /KIT-MANIFEST\.json/);
assert.match(prompt, /latest published Wiggly Format/);
assert.ok(prompt.startsWith("CODING AGENT REQUIRED:"));
assert.match(prompt, /do not analyze or simulate/);
assert.match(
  prompt,
  /Reply only: "Open this in Codex, Claude Code, Antigravity, Cursor, or Copilot CLI\."/,
);
assert.match(prompt, /return its defined deliverables/);
assert.doesNotMatch(prompt, /Exact public version: 0\.10\.0/);
assert.doesNotMatch(
  prompt,
  /Required inputs:|Format instructions:|Working rules:/,
);
assert.ok(prompt.length < 1000);

const shelf = groupDiscoveryEntriesByShelf(getPublishedDiscoveryEntries()).find(
  (candidate) => candidate.id === "character-dance-offs",
);
assert.ok(
  shelf?.entries.some(
    (entry) => entry.format.slug === "bikini-bottom-dance-off",
  ),
);
assert.equal(
  groupDiscoveryEntriesByShelf(getPublishedDiscoveryEntries())
    .find((candidate) => candidate.id === "character-explainers")
    ?.entries.some((entry) => entry.format.slug === "bikini-bottom-dance-off"),
  false,
  "Dance Off should not be mixed into the explainer shelf.",
);

const consumerRoute = readFileSync("app/formats/[slug]/page.tsx", "utf8");
const repoPageSections = readFileSync(
  "features/discovery/FormatRepoPageSections.tsx",
  "utf8",
);
const connectionsComponent = readFileSync(
  "features/discovery/BikiniBottomDanceOffConnections.tsx",
  "utf8",
);
const runSummaryComponent = readFileSync(
  "features/discovery/FormatRepoRunSummary.tsx",
  "utf8",
);
const includedAssetsComponent = readFileSync(
  "features/discovery/BikiniBottomDanceOffIncludedAssets.tsx",
  "utf8",
);
const characterModelViewerComponent = readFileSync(
  "features/discovery/DiscoveryCharacterModelViewer.tsx",
  "utf8",
);
const characterPreviewGenerator = readFileSync(
  "scripts/generate-dance-off-character-previews.mjs",
  "utf8",
);
const voicePreviewGenerator = readFileSync(
  "scripts/generate-dance-off-voice-previews.mjs",
  "utf8",
);
const trustLoader = readFileSync(
  "features/discovery/bikiniBottomDanceOffTrust.server.ts",
  "utf8",
);
const trustComponent = `${readFileSync(
  "features/discovery/FormatRepoTrust.tsx",
  "utf8",
)}\n${trustLoader}`;
const trustStyles = readFileSync(
  "features/discovery/BikiniBottomDanceOffTrust.module.css",
  "utf8",
);
const convexProvider = readFileSync("app/ConvexClientProvider.tsx", "utf8");
assert.match(consumerRoute, /Download runnable Repo/);
assert.match(consumerRoute, /format\.repositoryHref/);
assert.match(consumerRoute, /FormatRepoTrust/);
assert.match(
  consumerRoute,
  /<FormatRepoConnections presentation=\{repoPage\} \/>/,
);
assert.match(consumerRoute, /<FormatRepoRunSummary/);
assert.match(
  consumerRoute,
  /<FormatRepoIncludedAssets presentation=\{repoPage\} \/>/,
);
assert.ok(
  consumerRoute.indexOf("<FormatRepoIncludedAssets") <
    consumerRoute.indexOf("<FormatRepoRunSummary"),
  "The detailed run summary should close the Repo page after its proof.",
);
assert.ok(
  consumerRoute.indexOf("<FormatRepoIncludedAssets") <
    consumerRoute.indexOf('id="examples"'),
  "Included assets should appear before the shared examples section.",
);
assert.ok(
  consumerRoute.indexOf('id="examples"') <
    consumerRoute.indexOf("<FormatRepoTrust"),
  "Included assets should appear before the proof and technical details.",
);
assert.match(repoPageSections, /<BikiniBottomDanceOffConnections/);
assert.match(repoPageSections, /<BikiniBottomDanceOffIncludedAssets/);
assert.doesNotMatch(consumerRoute, /variant="inline"/);
assert.match(consumerRoute, /getFormatRepoPagePresentation/);
assert.match(repoPageRegistrySource, /slug === "bikini-bottom-dance-off"/);
assert.match(consumerRoute, /repoPage\.kind !== "shared" \? \(/);
assert.match(consumerRoute, /w-\[min\(100%-32px,980px\)\]/);
assert.match(consumerRoute, /md:grid-cols-\[1\.15fr_0\.85fr\]/);
assert.match(consumerRoute, /text-\[clamp\(42px,6vw,72px\)\]/);
assert.match(consumerRoute, /max-w-\[310px\]/);
assert.match(
  consumerRoute,
  /href="#examples"/,
  "Every Repo hero should link to the shared examples section.",
);
assert.match(
  trustComponent,
  /videoRef\.current\.currentTime = annotation\.seconds/,
);
assert.match(trustComponent, /aria-pressed=\{activeAnnotation === index\}/);
assert.match(trustComponent, /02 · Finished example/);
assert.match(trustComponent, /Watch the final video\./);
assert.doesNotMatch(trustComponent, /Proof explained|See it work\.|\u2014/);
assert.doesNotMatch(
  trustLoader,
  /agent-runs\//,
  "The public Format page must read committed proof evidence, not transient agent-run output.",
);
assert.match(trustComponent, /How your finished video is graded\./);
assert.match(trustComponent, /The blind judge scores seven things/);
assert.match(trustComponent, /Archived visual\/caption-assisted pilot/);
assert.match(
  trustComponent,
  /requires direct moving-video and audio perception/,
);
assert.doesNotMatch(trustComponent, /One job\. Six transformations\./);
assert.doesNotMatch(trustComponent, /The real proof, annotated\./);
assert.doesNotMatch(trustComponent, /What the Repo refuses to ship\./);
assert.match(trustComponent, /<section id="how-it-works"/);
assert.match(trustComponent, /id="proof"/);
assert.doesNotMatch(trustComponent, /Inside this Format/);
assert.doesNotMatch(trustComponent, /How this Format works\./);
assert.doesNotMatch(trustComponent, /Follow the workflow/);
assert.doesNotMatch(trustComponent, /Format system sections/);
assert.match(trustComponent, /Open proof report/);
assert.match(trustComponent, /Open quality\.json/);
assert.match(trustComponent, /The assembly line/);
assert.match(
  trustComponent,
  /Song analysis → Dance plan → Voice lines → Render → Deliver/,
);
assert.match(
  trustComponent,
  /Finds the beat, the best excerpt, and exact timing\./,
);
assert.match(trustComponent, /Waits for your approval/);
assert.match(trustComponent, /Waits for your review/);
assert.match(trustComponent, /Free tier/);
assert.match(trustComponent, /What the coding agent runs/);
assert.match(trustComponent, /Exact Dance Off runtime commands/);
assert.match(trustComponent, /npm run list-motions/);
assert.match(
  trustComponent,
  /node runner\.mjs render --run=<id> --approve-provider/,
);
assert.match(
  trustComponent,
  /node runner\.mjs finalize --run=<id> --review=<review\.json>/,
);
assert.doesNotMatch(trustComponent, /FlowStation|Brief enters|Timed scene map/);
assert.doesNotMatch(
  trustComponent,
  /One request moves straight to a finished Reel\./,
);
assert.match(trustComponent, />Repo files<\/h3>/);
assert.match(trustComponent, /Open any file to read its actual contents\./);
assert.match(trustComponent, /className=\{styles\.fileRow\}/);
assert.match(trustComponent, /className=\{styles\.fileContent\}/);
assert.match(trustComponent, /\{file\.label\}/);
assert.match(trustComponent, /\{file\.content\}/);
assert.doesNotMatch(
  trustComponent,
  /styles\.fileCount|styles\.fileGroupTitle|group\.summary|\{file\.description\}/,
);
assert.doesNotMatch(trustComponent, /styles\.repoSummary/);
assert.doesNotMatch(trustComponent, /styles\.fileIcon/);
assert.doesNotMatch(
  trustComponent,
  /onClick=\{\(\) => revealSource\("SKILL\.md"\)\}/,
);
assert.doesNotMatch(trustComponent, /From SKILL\.md/);
assert.doesNotMatch(trustComponent, /From PROOF-REPORT\.md/);
assert.doesNotMatch(trustComponent, /From quality\.json/);
assert.doesNotMatch(trustComponent, /fake green statuses/);
assert.doesNotMatch(trustComponent, /does not maintain a second proof asset/);
assert.doesNotMatch(trustComponent, /You’ve seen the system/);
assert.match(connectionsComponent, /Services &amp; costs/);
assert.match(connectionsComponent, /1 required · 1 optional/);
assert.match(connectionsComponent, /What’s an API key\?/);
assert.match(connectionsComponent, /Character voices/);
assert.match(connectionsComponent, /Extra dances/);
assert.match(connectionsComponent, /Required/);
assert.match(connectionsComponent, /Optional/);
assert.match(connectionsComponent, /Free tier available/);
assert.match(connectionsComponent, /Check pricing/);
assert.match(connectionsComponent, /Pricing details/);
assert.doesNotMatch(connectionsComponent, /provider\.estimatedCost/);
assert.match(connectionsComponent, /Never paste it into Wiggly/);
assert.doesNotMatch(connectionsComponent, /Current estimate/);
assert.doesNotMatch(connectionsComponent, /No API key needed for/);
assert.doesNotMatch(connectionsComponent, /valid dialogue is already cached/);
assert.match(convexProvider, /pathname\.startsWith\("\/formats\/"\)/);
assert.match(
  repoPageRegistrySource,
  /Add one song and optionally choose the dances or dialogue\.[\s\S]*The\s+agent handles everything else\./,
);
assert.match(runSummaryComponent, /\{handoff\.output\}/);
assert.match(runSummaryComponent, /max-w-\[1100px\]/);
assert.match(runSummaryComponent, /lg:grid-cols-\[1fr_1\.1fr\]/);
assert.match(runSummaryComponent, /shadow-\[6px_6px_0_#080817\]/);
assert.match(includedAssetsComponent, /The cast, stages, and moves\./);
assert.doesNotMatch(includedAssetsComponent, /already inside/);
assert.doesNotMatch(includedAssetsComponent, /Production-ready Repo assets/);
assert.match(includedAssetsComponent, /DiscoveryCharacterModelViewer/);
assert.match(includedAssetsComponent, /Drag every character in 3D/);
assert.doesNotMatch(includedAssetsComponent, /verified dance frames/);
assert.doesNotMatch(includedAssetsComponent, /character\.modelSrc \?/);
assert.doesNotMatch(includedAssetsComponent, /Included in Repo/);
assert.match(includedAssetsComponent, /\{character\.sourceLabel\}/);
assert.match(includedAssetsComponent, /new Audio\(preview\.src\)/);
assert.match(includedAssetsComponent, /current\.pause\(\)/);
assert.ok(
  includedAssetsComponent.indexOf("current.pause()") <
    includedAssetsComponent.indexOf("new Audio(preview.src)"),
  "Starting another card must stop the currently playing preview first.",
);
assert.match(characterModelViewerComponent, /Play voice/);
assert.match(characterModelViewerComponent, /Play cue/);
assert.match(characterModelViewerComponent, /Voice pending/);
assert.match(characterModelViewerComponent, /character-voice-preview/);
assert.match(characterModelViewerComponent, /aria-pressed/);
assert.match(characterModelViewerComponent, /voicePreview\.line/);
assert.match(
  characterModelViewerComponent,
  /const MIN_CAMERA_ORBIT = "auto 65deg auto"/,
);
assert.match(
  characterModelViewerComponent,
  /const MAX_CAMERA_ORBIT = "auto 85deg auto"/,
);
assert.match(
  characterModelViewerComponent,
  /"min-camera-orbit": MIN_CAMERA_ORBIT/,
);
assert.match(
  characterModelViewerComponent,
  /"max-camera-orbit": MAX_CAMERA_ORBIT/,
);
assert.match(
  characterPreviewGenerator,
  /function applyDisplayRules\(character, characterPack\)/,
);
assert.match(characterPreviewGenerator, /mesh\.visible = false/);
assert.match(
  characterPreviewGenerator,
  /characterPack\.restPoseAdjustments \|\| \[\]/,
);
assert.match(characterPreviewGenerator, /onlyVisible: true/);
assert.doesNotMatch(
  characterPreviewGenerator,
  /characterPack\.id === ["'](?:sandy|mario|sonic-modern|larry)["']/,
);
assert.match(voicePreviewGenerator, /readNamedEnvironmentValue/);
assert.match(
  voicePreviewGenerator,
  /BIKINI_BOTTOM_DANCE_OFF_OLAF_VOICE_ID|operatorReferenceEnvironmentVariable/,
);
assert.doesNotMatch(voicePreviewGenerator, /\.env\.local|process\.loadEnvFile/);
assert.match(
  voicePreviewGenerator,
  /!\(await fileMatchesHash\(output, preview\.sha256\)\)/,
);
assert.doesNotMatch(includedAssetsComponent, /Dance \+ voice ready/);
assert.doesNotMatch(includedAssetsComponent, /Dance-ready · voice pending/);
assert.match(includedAssetsComponent, /1 fixed character stage/);
assert.match(includedAssetsComponent, /aria-pressed=\{isSelected\}/);
assert.doesNotMatch(includedAssetsComponent, /No Mixamo download required/);
assert.doesNotMatch(includedAssetsComponent, /createElement\("model-viewer"/);
assert.doesNotMatch(
  includedAssetsComponent,
  /ColladaLoader|WebGLRenderer|iframe/,
);
assert.equal(
  (runSummaryComponent.match(/<DiscoveryFormatHandoff/g) ?? []).length,
  1,
  "The run summary should have one clear Send to Coding Agent action.",
);
assert.doesNotMatch(runSummaryComponent, /checked episode plan/i);
assert.doesNotMatch(runSummaryComponent, /preview contact sheet/i);
assert.doesNotMatch(runSummaryComponent, /Final output/);
assert.match(runSummaryComponent, /handoff\.estimates\.map/);
assert.doesNotMatch(runSummaryComponent, /validated episode input/);
assert.doesNotMatch(runSummaryComponent, /provider cost/);
assert.doesNotMatch(runSummaryComponent, /A-F eval/);
assert.match(runSummaryComponent, /Know the run before you start\./);
assert.match(
  consumerRoute,
  /<FormatRepoRunSummary[\s\S]*description=\{repoPageCopy\?\.runDescription\}/,
  "Dance Off should use the same detailed bottom run section as every Repo page.",
);
assert.match(
  consumerRoute,
  /repoPage\.kind !== "shared" \? \([\s\S]*<FormatRepoIncludedAssets[\s\S]*\) : \([\s\S]*<FormatRepoPackageAssets/,
  "Every Repo should use a consistent included-assets slot without duplicating Dance Off's data.",
);

assert.match(trustStyles, /width: min\(100%, 980px\)/);
assert.match(
  trustStyles,
  /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/,
);
assert.doesNotMatch(trustStyles, /\.conveyor|\.machine|\.gateState/);
assert.match(trustStyles, /\.fileGroups \{\s*display: grid;\s*gap: 10px/);
assert.match(trustStyles, /\.fileRow \{[\s\S]*border: 1px solid #c9d3e0/);
assert.match(trustStyles, /\.fileContent \{[\s\S]*max-height: 24rem/);
assert.match(
  trustStyles,
  /grid-template-columns: minmax\(190px, 0\.42fr\) minmax\(0, 1fr\) 18px/,
);
assert.doesNotMatch(trustStyles, /\.fileCount|\.fileGroup summary small/);
assert.match(trustStyles, /@media \(max-width: 700px\)/);
assert.doesNotMatch(trustStyles, /box-shadow: 7px 7px 0 #080817/);

const trustData = await getBikiniBottomDanceOffTrustData();
const motionReadyCharacterCatalog = (
  JSON.parse(
    readFileSync(
      "public/format-repositories/mixamo-character-motion-v1/assets/character-packs.json",
      "utf8",
    ),
  ) as {
    packs: Array<{ id: string; label: string; status: string }>;
  }
).packs.filter((character) => character.status === "motion-ready");
assert.equal(trustData.version, "0.17.0");
assert.deepEqual(trustData.stats, {
  motions: 25,
  motionReadyCharacters: 22,
  voiceReadyCharacters: 19,
  voicePreviewReadyCharacters: 20,
});
const voicePreviewManifest = JSON.parse(
  readFileSync(`${repositoryRoot}/assets/voice-previews/manifest.json`, "utf8"),
) as {
  previews: Array<{
    characterId: string;
    line: string;
    kind: "fish-tts" | "original-nonverbal-cue";
    status: "ready" | "voice-pending";
    path?: string;
    durationSeconds?: number;
    bytes?: number;
    sha256?: string;
    reason?: string;
  }>;
};
assert.equal(voicePreviewManifest.previews.length, 22);
assert.equal(
  voicePreviewManifest.previews.filter((preview) => preview.status === "ready")
    .length,
  20,
);
assert.deepEqual(
  voicePreviewManifest.previews
    .filter((preview) => preview.status === "voice-pending")
    .map((preview) => preview.characterId),
  ["man-ray", "batman-beyond"],
);
const agentPPreview = voicePreviewManifest.previews.find(
  (preview) => preview.characterId === "agent-p",
);
assert.ok(agentPPreview);
assert.equal(agentPPreview.kind, "original-nonverbal-cue");
assert.equal(agentPPreview.status, "ready");
const olafPreview = voicePreviewManifest.previews.find(
  (preview) => preview.characterId === "olaf",
);
assert.ok(olafPreview);
assert.equal(olafPreview.line, "Hi! I'm Olaf, and I like warm hugs.");
assert.equal(
  (olafPreview as { referenceSource?: string }).referenceSource,
  "operator-private-override",
);
assert.match(
  (olafPreview as { source?: string }).source ?? "",
  /operator-private Fish Audio clone.*not packaged/i,
);
assert.deepEqual(
  trustData.includedAssets.characters.map(({ id, label }) => ({ id, label })),
  motionReadyCharacterCatalog.map(({ id, label }) => ({ id, label })),
  "Every motion-ready catalog character should automatically receive the same discovery card.",
);
assert.deepEqual(
  Object.fromEntries(
    trustData.includedAssets.characters.map(({ id, sourceLabel }) => [
      id,
      sourceLabel,
    ]),
  ),
  {
    spongebob: "SpongeBob SquarePants",
    squilliam: "SpongeBob SquarePants",
    "mr-krabs": "SpongeBob SquarePants",
    patrick: "SpongeBob SquarePants",
    "sonic-modern": "Sonic Generations",
    "flynn-rider": "Tangled",
    "kermit-pirate": "The Muppets",
    "kermit-sci-fi": "The Muppets",
    "agent-p": "Phineas and Ferb",
    squidward: "SpongeBob SquarePants",
    mario: "Super Mario 3D World",
    olaf: "Frozen",
    sandy: "SpongeBob SquarePants",
    aqua: "Kingdom Hearts: Birth by Sleep",
    ratchet: "Ratchet & Clank",
    larry: "SpongeBob SquarePants",
    "man-ray": "SpongeBob SquarePants",
    "batman-animated": "Batman: The Animated Series",
    "batman-beyond": "Batman Beyond",
    "dr-doofenshmirtz": "Phineas and Ferb",
    ferb: "Phineas and Ferb",
    phineas: "Phineas and Ferb",
  },
  "Every Dance Off card should identify the character's recognizable source.",
);
assert.equal(
  trustData.includedAssets.performerStage.src,
  "/format-repositories/mixamo-character-motion-v1/assets/backgrounds/fish-news-underwater-studio.png",
);
assert.equal(trustData.includedAssets.backgrounds.length, 4);
assert.equal(trustData.includedAssets.defaultBackgroundId, "deep-ocean");
assert.deepEqual(trustData.includedAssets.motionLabels, [
  "Silly Dancing",
  "Runningman Hip Hop Dancing",
  "Macarena Dance",
  "Ymca Dance",
]);
for (const character of trustData.includedAssets.characters) {
  assert.equal(existsSync(`public${character.posterSrc}`), true);
  assert.equal(existsSync(`public${character.modelSrc}`), true);
  const previewModel = readFileSync(`public${character.modelSrc}`);
  assert.equal(previewModel.subarray(0, 4).toString("ascii"), "glTF");
  assert.ok(previewModel.byteLength > 250_000);
  const poster = readFileSync(`public${character.posterSrc}`);
  assert.ok(poster.byteLength > 5_000);
  assert.deepEqual(imageSize(poster), {
    width: 800,
    height: 1000,
    type: "png",
  });

  const preview = voicePreviewManifest.previews.find(
    (candidate) => candidate.characterId === character.id,
  );
  assert.ok(preview);
  assert.equal(character.voicePreview.line, preview.line);
  assert.equal(character.voicePreview.status, preview.status);
  if (preview.status === "ready") {
    assert.ok(preview.path);
    assert.ok(preview.durationSeconds && preview.durationSeconds >= 0.5);
    assert.ok(preview.durationSeconds <= 8);
    assert.ok(preview.bytes && preview.bytes > 10_000);
    assert.match(preview.sha256 ?? "", /^[0-9a-f]{64}$/);
    const audioPath = `${repositoryRoot}/${preview.path}`;
    assert.equal(existsSync(audioPath), true);
    const audio = readFileSync(audioPath);
    assert.equal(audio.byteLength, preview.bytes);
    assert.equal(
      createHash("sha256").update(audio).digest("hex"),
      preview.sha256,
    );
    assert.equal(
      character.voicePreview.src,
      `/format-repositories/bikini-bottom-dance-off-v1/${preview.path}`,
    );
  } else {
    assert.equal(character.voicePreview.src, undefined);
    assert.match(character.voicePreview.reason ?? "", /No credible approved/);
  }
}
assert.deepEqual(
  trustData.includedAssets.characters
    .filter((character) => character.voiceReady)
    .map((character) => character.id)
    .sort(),
  [
    "aqua",
    "batman-animated",
    "dr-doofenshmirtz",
    "ferb",
    "flynn-rider",
    "kermit-pirate",
    "kermit-sci-fi",
    "larry",
    "mario",
    "mr-krabs",
    "olaf",
    "patrick",
    "phineas",
    "ratchet",
    "sandy",
    "sonic-modern",
    "spongebob",
    "squidward",
    "squilliam",
  ],
);
assert.equal(
  trustData.includedAssets.characters.filter((character) => character.modelSrc)
    .length,
  22,
);
assert.equal(
  existsSync(
    "public/discovery/bikini-bottom-dance-off/character-previews/provenance.json",
  ),
  true,
);
const previewProvenance = JSON.parse(
  readFileSync(
    "public/discovery/bikini-bottom-dance-off/character-previews/provenance.json",
    "utf8",
  ),
) as {
  method: string;
  previews: Array<{
    characterId: string;
    imageSha256: string;
    modelSha256: string;
    proofSource?: string;
  }>;
};
assert.match(
  previewProvenance.method,
  new RegExp(`All ${motionReadyCharacterCatalog.length} browser-ready GLBs`),
);
assert.equal(
  previewProvenance.previews.length,
  motionReadyCharacterCatalog.length,
);
for (const character of trustData.includedAssets.characters) {
  const preview = previewProvenance.previews.find(
    (candidate) => candidate.characterId === character.id,
  );
  assert.ok(preview);
  assert.equal(preview.proofSource, undefined);
  assert.equal(
    createHash("sha256")
      .update(readFileSync(`public${character.posterSrc}`))
      .digest("hex"),
    preview.imageSha256,
  );
  assert.equal(
    createHash("sha256")
      .update(readFileSync(`public${character.modelSrc}`))
      .digest("hex"),
    preview.modelSha256,
  );
}
const characterPreviewRepairRoot =
  "public/format-repositories/mixamo-character-motion-v1";
const characterPreviewRepairReceipt = JSON.parse(
  readFileSync(
    `${characterPreviewRepairRoot}/evidence/character-preview-repairs/receipt.json`,
    "utf8",
  ),
) as {
  schemaVersion: number;
  characters: Array<{
    id: string;
    acceptedPosterSha256: string;
    acceptedModelSha256: string;
    rejectedCandidatePosterSha256?: string;
    evidence:
      | { path: string; sha256: string }
      | Array<{ path: string; sha256: string }>;
  }>;
};
assert.equal(characterPreviewRepairReceipt.schemaVersion, 1);
assert.deepEqual(
  characterPreviewRepairReceipt.characters.map((character) => character.id),
  ["sandy", "mario", "sonic-modern", "larry"],
);
for (const repair of characterPreviewRepairReceipt.characters) {
  const character = trustData.includedAssets.characters.find(
    (candidate) => candidate.id === repair.id,
  );
  assert.ok(character);
  assert.equal(
    createHash("sha256")
      .update(readFileSync(`public${character.posterSrc}`))
      .digest("hex"),
    repair.acceptedPosterSha256,
  );
  assert.equal(
    createHash("sha256")
      .update(readFileSync(`public${character.modelSrc}`))
      .digest("hex"),
    repair.acceptedModelSha256,
  );
  for (const evidence of Array.isArray(repair.evidence)
    ? repair.evidence
    : [repair.evidence]) {
    const evidencePath = `${characterPreviewRepairRoot}/${evidence.path}`;
    const evidenceBytes = readFileSync(evidencePath);
    assert.ok(evidenceBytes.byteLength > 10_000);
    assert.equal(
      createHash("sha256").update(evidenceBytes).digest("hex"),
      evidence.sha256,
    );
  }
}
assert.match(
  characterPreviewRepairReceipt.characters.find(
    (character) => character.id === "mario",
  )?.rejectedCandidatePosterSha256 ?? "",
  /^[0-9a-f]{64}$/,
);
for (const background of trustData.includedAssets.backgrounds) {
  assert.equal(existsSync(`public${background.src}`), true);
}
assert.equal(
  existsSync(`public${trustData.includedAssets.performerStage.src}`),
  true,
);
assert.deepEqual(
  trustData.annotations.map((annotation) => annotation.timeLabel),
  ["00:04", "00:34", "00:43", "00:46"],
);
assert.deepEqual(
  trustData.annotations.map((annotation) => annotation.title),
  [
    "Each character gets a full solo.",
    "All four characters keep moving.",
    "All four deliver the closing line.",
    "The ending deliberately creates the replay.",
  ],
);
assert.equal(trustData.quality.summary[0]?.value, "16/16");
assert.equal(trustData.quality.summary[1]?.value, "85/100");
assert.equal(trustData.quality.criteria.length, 7);
assert.match(trustData.receipt.rows[1]?.value ?? "", /B · 85\/100 · pass/);
assert.equal(trustData.requirements.providers[0]?.name, "Fish Audio");
assert.deepEqual(trustData.requirements.environmentVariables, [
  "FISH_STUDIO_APIKEY",
]);
assert.deepEqual(trustData.requirements.optionalOperatorEnvironmentVariables, [
  {
    name: "BIKINI_BOTTOM_DANCE_OFF_OLAF_VOICE_ID",
    purpose:
      "Use Wiggly's approved private Olaf clone instead of the packaged transferable public fallback.",
    valuePackaged: false,
    requiredForPublicKit: false,
  },
]);
assert.equal(
  trustData.commands.includes(
    "npm run render -- --run=episode-01 --approve-provider",
  ),
  true,
);
assert.equal(
  trustData.commands.includes(
    "npm run finalize -- --run=episode-01 --review=/absolute/path/to/blind-review.json --second-review=/absolute/path/to/second-review.json",
  ),
  true,
);
assert.equal(
  trustData.files.some((file) => file.path === "PROOF-REPORT.md"),
  true,
);
assert.equal(trustData.files.length, 26);
assert.equal(
  trustData.files.some((file) =>
    file.path.endsWith("assets/character-import-audit.json"),
  ),
  true,
);
assert.equal(
  trustData.files.every((file) => file.label.trim().length > 0),
  true,
);
assert.equal(
  trustData.files.every((file) => file.content.trim().length > 0),
  true,
);
assert.match(
  trustData.files.find((file) => file.path === "SKILL.md")?.content ?? "",
  /# Bikini Bottom Dance Off/,
);
assert.equal(
  trustData.files.some((file) => file.path === "CALIBRATION-REPORT.md"),
  true,
);

const starterManifest = JSON.parse(
  readFileSync(
    `${repositoryRoot}/../mixamo-character-motion-v1/assets/motions/manifest.json`,
    "utf8",
  ),
) as { motions: unknown[] };
assert.equal(starterManifest.motions.length, 25);
const motionRunner = readFileSync(
  `${repositoryRoot}/../mixamo-character-motion-v1/runner.mjs`,
  "utf8",
);
assert.match(motionRunner, /user-motions/);
assert.match(motionRunner, /loadMotionCatalog/);

console.log("Bikini Bottom Dance Off Discover page tests passed.");
