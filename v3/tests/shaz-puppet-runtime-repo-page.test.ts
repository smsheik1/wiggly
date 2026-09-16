import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import JSZip from "jszip";
import {
  getPublishedDiscoveryEntries,
  getPublishedDiscoveryProofEntries,
} from "../features/discovery/catalog";
import { getDiscoveryFormatProfile } from "../features/discovery/formatProof.server";
import { getFormatRepoPagePresentation } from "../features/discovery/formatRepoPage.server";
import { getShazPuppetRuntimeTrustData } from "../features/discovery/shazPuppetRuntimeTrust.server";

const repository = "public/format-repositories/shaz-puppet-runtime-v1";
const download = `${repository}/downloads/wiggly-shaz-puppet-runtime-format-kit.zip`;
const talkingShowcase = `${repository}/goldens/talking-scene-lipsync-v1`;
const video = `${talkingShowcase}/final.mp4`;
const contactSheet = `${talkingShowcase}/contact-sheet.jpg`;
const poster = `${talkingShowcase}/poster.jpg`;
const cueFile = `${talkingShowcase}/cherry-lipsync.tsv`;
const audio = `${talkingShowcase}/user-audio.wav`;
const input = `${talkingShowcase}/input.json`;
const validationReceipt = `${talkingShowcase}/validation-receipt.json`;
const renderReport = `${talkingShowcase}/render-report.json`;
const qualityReport = `${talkingShowcase}/quality-report.json`;
const humanReview = `${talkingShowcase}/human-review.json`;
const transcriptGuidedShowcase = `${repository}/goldens/transcript-guided-story-v1`;
const transcriptGuidedProofHashes = {
  "source-input.json":
    "b4c538ad8f1fb13e8a7c77abf88cb239fcd4c0f4ad0c004b1549c4d13d0bba28",
  "input.json":
    "d83e08e257edd403cab94eba41dfe264427949df17dab4fc936e7750b0e55b5d",
  "transcript.json":
    "35a55600eafd90cb352c01e43e477bcddd945eca6dc21cf757049b059188af7b",
  "transcription-receipt.json":
    "da59ca9a5c9d4e54b0d07a6a6b1c0c073444b6fa55a2958f5aee1e5647682ef1",
  "cherry-lipsync.tsv":
    "1f8ba17f5f2ec57eef1468634133b1308ad99c9af00b1cc7860d99d497dd556d",
  "user-audio.wav":
    "977618823d072d933af1b76c10e7e07394a0001fe0775770c332a48b6457121b",
  "final.mp4":
    "a1df5e2f89afc2e38589629efef81858d68887cf79f87c52e379c9d03332f212",
  "poster.jpg":
    "c45114c5d6feb74ba127dacdead88223abc56d143218f1307ec8c7d278ee1cfb",
  "contact-sheet.jpg":
    "8d5b348a7e6af6c44526fac8293aa5c5794ef48279be6950949c745c44567c8a",
  "validation-receipt.json":
    "e2dfe27a3e29fffcdbd6b077baaaff96f94543ffd44939183f1ce3e9e67cdd5f",
  "render-report.json":
    "f718b19dde00b57b28d4f3b8cf0cc5e22611a571d4645eb773695b08f7691dc5",
  "quality-report.json":
    "25ceba243ae791d300bd36fc933df55384af182a69d2e97f53ac33bd9a41b8a7",
  "human-review.json":
    "095d47ff0b64a0a3ba2bfa9267eb8ea07d22f1b6e1882099bce4ab5fd1d1715d",
} as const;
const poseShowcase = `${repository}/goldens/five-authored-showcase`;
const poseVideo = `${poseShowcase}/final.mp4`;
const poseContactSheet = `${poseShowcase}/contact-sheet.jpg`;
const posePoster = `${poseShowcase}/poster.jpg`;
const includedAssetsSource = readFileSync(
  "features/discovery/ShazPuppetRuntimeIncludedAssets.tsx",
  "utf8",
);
const connectionsSource = readFileSync(
  "features/discovery/ShazPuppetRuntimeConnections.tsx",
  "utf8",
);
const formatProofSource = readFileSync(
  "features/discovery/formatProof.server.ts",
  "utf8",
);
const repoPageSource = readFileSync(
  "features/discovery/formatRepoPage.server.ts",
  "utf8",
);
const formatPageSource = readFileSync("app/formats/[slug]/page.tsx", "utf8");
const runSummarySource = readFileSync(
  "features/discovery/FormatRepoRunSummary.tsx",
  "utf8",
);
const trustSource = readFileSync(
  "features/discovery/shazPuppetRuntimeTrust.server.ts",
  "utf8",
);
const expectedVideoSha =
  "59cef6b0910a9d7f8dfe342c0602e8f1921ec6c837fe0fb26c8d5510fd1d2edf";
const expectedContactSheetSha =
  "1ad95d6dd67313f7d49f91e6f6a20a1694360f1cd95d64c2fd40943ff6db9874";
const expectedPosterSha =
  "4d494ead2293efcdf0d46c3a7a392d5b7674bac77dc4ef3b40d5a0dabb93afec";
const expectedCueSha =
  "6a6d5604461dfe9aadc40ab3bf5f7b5171c64e674c95384c58275294ee32820d";
const expectedAudioSha =
  "37648e2e0b4c37d22ec529b4301c8abd9435f92ce641c804e521e5b3bdd23f1b";
const expectedInputSha =
  "5d6428d1247cf0ba6a0392296d2df57312300172fee5465e3ad64b1f2b52dd06";
const expectedValidationReceiptSha =
  "80ef605e5bd40e3dddb4d89f3cd27d29fb1e688e2e3b0e7fe50d62c945e27623";
const expectedRenderReportSha =
  "8cef0c46cb131ba48e3835422b9691576b4f1d278c4034b6c7efaebb3beb9a40";
const expectedQualityReportSha =
  "a088e364c40c047c52a02f60c91d0fc59b9c65eb9720492e443c967c817f00e3";
const expectedHumanReviewSha =
  "cf1178d2dcbc0edc11e14c39d821d6705d60139330b5eb49f1dc27b435880829";
const expectedPoseVideoSha =
  "8a5183154aaefb9a844d3bd8be48170e7576986f0d0717de5243057c2ea435ae";
const expectedPoseContactSheetSha =
  "8cdc5ea13306953fa1617d5022a886f407e22d2f8bf706bf97e6c7d03cf08233";
const expectedPosePosterSha =
  "5a0a821a61ebf39719488db16e345db4b28c6e87d5cde9c8c282d07f613b4c22";
const trustedShowcasePoseIds = [
  "present",
  "think",
  "aha",
  "point",
  "confident",
];
const expectedBackgrounds = [
  {
    id: "sisters-room",
    label: "Sisters Room",
    path: "assets/backgrounds/sisters-room.png",
    sha256: "740f61cbd58581b3c944fc77038fd51756305083b22ae3e28df0f1f5190ec485",
  },
  {
    id: "living-room",
    label: "Living Room",
    path: "assets/backgrounds/living-room.png",
    sha256: "f5b6f3c78351028a1fd1d6b067337f2a99ed456647b5ce7608426f42088ece3e",
  },
  {
    id: "map-photo-zone",
    label: "Photo Zone",
    path: "assets/backgrounds/map-photo-zone.png",
    sha256: "2c5d6b6520b2bab37b74a3b46a32c01d266ca520e2fca5425192312c569cb937",
  },
  {
    id: "pure-white",
    label: "Pure White",
    path: "assets/backgrounds/pure-white.png",
    sha256: "f91cf55509a036596da76a95f07a4034459ff0c6b23aac48b4ff6c2661edb807",
  },
] as const;
const rejectedShowcasePoseIds = [
  "facepalm-frustrated",
  "arms-crossed-skeptical",
  "excited-celebration",
];
const sha256 = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

if (existsSync(download)) {
  assert.ok(statSync(download).size < 100 * 1024 * 1024);
}
assert.equal(existsSync(video), true);
assert.equal(sha256(video), expectedVideoSha);
assert.equal(existsSync(contactSheet), true);
assert.equal(sha256(contactSheet), expectedContactSheetSha);
assert.equal(existsSync(poster), true);
assert.equal(sha256(poster), expectedPosterSha);
assert.equal(existsSync(cueFile), true);
assert.equal(sha256(cueFile), expectedCueSha);
assert.equal(existsSync(audio), true);
assert.equal(sha256(audio), expectedAudioSha);
assert.equal(sha256(input), expectedInputSha);
assert.equal(sha256(validationReceipt), expectedValidationReceiptSha);
assert.equal(sha256(renderReport), expectedRenderReportSha);
assert.equal(sha256(qualityReport), expectedQualityReportSha);
assert.equal(sha256(humanReview), expectedHumanReviewSha);
assert.equal(existsSync(poseVideo), true);
assert.equal(sha256(poseVideo), expectedPoseVideoSha);
assert.equal(existsSync(poseContactSheet), true);
assert.equal(sha256(poseContactSheet), expectedPoseContactSheetSha);
assert.equal(existsSync(posePoster), true);
assert.equal(sha256(posePoster), expectedPosePosterSha);
const talkingInput = JSON.parse(readFileSync(input, "utf8")) as {
  sequence: Array<{ poseId: string }>;
};
assert.deepEqual(
  [...new Set(talkingInput.sequence.map(({ poseId }) => poseId))],
  ["neutral-listening", "present", "confident", "point", "shrug", "aha"],
);
const validation = JSON.parse(readFileSync(validationReceipt, "utf8")) as {
  status: string;
  inputSha256: string;
  audio: { sha256: string };
  lipSync: { cueSha256: string; cueCount: number; usedMouthDrawings: string[] };
};
const render = JSON.parse(readFileSync(renderReport, "utf8")) as {
  status: string;
  inputSha256: string;
  outputSha256: string;
  audioSha256: string;
  lipSync: { cueSha256: string; cueCount: number; usedMouthDrawings: string[] };
};
const quality = JSON.parse(readFileSync(qualityReport, "utf8")) as {
  status: string;
  inputSha256: string;
  outputSha256: string;
  measured: { audioCodec: string; frames: number; durationSeconds: number };
  failures: unknown[];
};
const review = JSON.parse(readFileSync(humanReview, "utf8")) as {
  status: string;
  reviewedOutputSha256: string;
  directVideoPerception: boolean;
  directAudioPerception: boolean;
};
assert.equal(validation.status, "pass");
assert.equal(validation.inputSha256, expectedInputSha);
assert.equal(validation.audio.sha256, expectedAudioSha);
assert.equal(validation.lipSync.cueSha256, expectedCueSha);
assert.equal(validation.lipSync.cueCount, 100);
assert.deepEqual(validation.lipSync.usedMouthDrawings, [
  "1",
  "2",
  "3",
  "4",
  "5",
]);
assert.equal(render.status, "rendered");
assert.equal(render.inputSha256, expectedInputSha);
assert.equal(render.outputSha256, expectedVideoSha);
assert.equal(render.audioSha256, expectedAudioSha);
assert.equal(render.lipSync.cueSha256, expectedCueSha);
assert.equal(render.lipSync.cueCount, 100);
assert.deepEqual(render.lipSync.usedMouthDrawings, ["1", "2", "3", "4", "5"]);
assert.equal(quality.status, "pass");
assert.equal(quality.inputSha256, expectedInputSha);
assert.equal(quality.outputSha256, expectedVideoSha);
assert.equal(quality.measured.audioCodec, "aac");
assert.equal(quality.measured.frames, 288);
assert.equal(quality.measured.durationSeconds, 12);
assert.deepEqual(quality.failures, []);
assert.equal(review.status, "pending");
assert.equal(review.reviewedOutputSha256, expectedVideoSha);
assert.equal(review.directVideoPerception, false);
assert.equal(review.directAudioPerception, false);

for (const [name, expectedSha] of Object.entries(transcriptGuidedProofHashes)) {
  const file = `${transcriptGuidedShowcase}/${name}`;
  assert.equal(existsSync(file), true, `${name} must exist`);
  assert.equal(sha256(file), expectedSha, `${name} must stay checksum-bound`);
}

const transcriptGuidedInput = JSON.parse(
  readFileSync(`${transcriptGuidedShowcase}/input.json`, "utf8"),
) as {
  backgroundId: string;
  planningTranscriptSha256: string;
  sequence: Array<{
    poseId: string;
    anchor?: { wordId: string; frame: number };
  }>;
};
assert.equal(transcriptGuidedInput.backgroundId, "living-room");
assert.equal(
  transcriptGuidedInput.planningTranscriptSha256,
  transcriptGuidedProofHashes["transcript.json"],
);
assert.deepEqual(
  [...new Set(transcriptGuidedInput.sequence.map(({ poseId }) => poseId))],
  ["neutral-listening", "think", "point", "confident"],
);
assert.deepEqual(
  transcriptGuidedInput.sequence.flatMap(({ poseId, anchor }) =>
    anchor ? [{ poseId, wordId: anchor.wordId, frame: anchor.frame }] : [],
  ),
  [
    { poseId: "think", wordId: "w0023", frame: 131 },
    { poseId: "point", wordId: "w0064", frame: 404 },
    { poseId: "confident", wordId: "w0103", frame: 689 },
  ],
);

const transcriptGuidedTranscript = JSON.parse(
  readFileSync(`${transcriptGuidedShowcase}/transcript.json`, "utf8"),
) as { words: Array<{ id: string; normalized: string }> };
assert.deepEqual(
  transcriptGuidedTranscript.words
    .filter(({ id }) => ["w0023", "w0064", "w0103"].includes(id))
    .map(({ id, normalized }) => ({ id, normalized })),
  [
    { id: "w0023", normalized: "idea" },
    { id: "w0064", normalized: "least" },
    { id: "w0103", normalized: "best" },
  ],
);

const transcriptGuidedValidation = JSON.parse(
  readFileSync(`${transcriptGuidedShowcase}/validation-receipt.json`, "utf8"),
) as {
  status: string;
  inputSha256: string;
  totalFrames: number;
  audio: { sha256: string };
  transcript: { sha256: string; wordCount: number };
  lipSync: { cueSha256: string; cueCount: number };
};
assert.equal(transcriptGuidedValidation.status, "pass");
assert.equal(
  transcriptGuidedValidation.inputSha256,
  transcriptGuidedProofHashes["input.json"],
);
assert.equal(transcriptGuidedValidation.totalFrames, 720);
assert.equal(
  transcriptGuidedValidation.audio.sha256,
  transcriptGuidedProofHashes["user-audio.wav"],
);
assert.equal(
  transcriptGuidedValidation.transcript.sha256,
  transcriptGuidedProofHashes["transcript.json"],
);
assert.equal(transcriptGuidedValidation.transcript.wordCount, 104);
assert.equal(
  transcriptGuidedValidation.lipSync.cueSha256,
  transcriptGuidedProofHashes["cherry-lipsync.tsv"],
);
assert.equal(transcriptGuidedValidation.lipSync.cueCount, 271);

const transcriptGuidedQuality = JSON.parse(
  readFileSync(`${transcriptGuidedShowcase}/quality-report.json`, "utf8"),
) as {
  status: string;
  outputSha256: string;
  measured: { frames: number; durationSeconds: number; audioCodec: string };
  failures: unknown[];
};
assert.equal(transcriptGuidedQuality.status, "pass");
assert.equal(
  transcriptGuidedQuality.outputSha256,
  transcriptGuidedProofHashes["final.mp4"],
);
assert.deepEqual(transcriptGuidedQuality.measured, {
  ...transcriptGuidedQuality.measured,
  frames: 720,
  durationSeconds: 30,
  audioCodec: "aac",
});
assert.deepEqual(transcriptGuidedQuality.failures, []);

const transcriptGuidedReview = JSON.parse(
  readFileSync(`${transcriptGuidedShowcase}/human-review.json`, "utf8"),
) as { status: string; reviewedOutputSha256: string };
assert.equal(transcriptGuidedReview.status, "pending");
assert.equal(
  transcriptGuidedReview.reviewedOutputSha256,
  transcriptGuidedProofHashes["final.mp4"],
);

const poseShowcaseInput = JSON.parse(
  readFileSync(`${poseShowcase}/input.json`, "utf8"),
) as { sequence: Array<{ poseId: string }> };
assert.deepEqual(
  poseShowcaseInput.sequence.map(({ poseId }) => poseId),
  trustedShowcasePoseIds,
);
const goldens = JSON.parse(
  readFileSync(`${repository}/goldens.json`, "utf8"),
) as {
  talkingSceneShowcase: {
    inputSha256: string;
    videoSha256: string;
    posterSha256: string;
    contactSheetSha256: string;
    validationReceiptSha256: string;
    renderReportSha256: string;
    qualityReportSha256: string;
    humanReviewSha256: string;
    cueSha256: string;
    audioSha256: string;
  };
  transcriptGuidedStoryShowcase: {
    formatVersion: string;
    status: string;
    sourceInputSha256: string;
    inputSha256: string;
    transcriptSha256: string;
    videoSha256: string;
    posterSha256: string;
    cueSha256: string;
    audioSha256: string;
    userVisualApproval: string;
  };
};
assert.equal(goldens.talkingSceneShowcase.inputSha256, expectedInputSha);
assert.equal(goldens.talkingSceneShowcase.videoSha256, expectedVideoSha);
assert.equal(goldens.talkingSceneShowcase.posterSha256, expectedPosterSha);
assert.equal(
  goldens.talkingSceneShowcase.contactSheetSha256,
  expectedContactSheetSha,
);
assert.equal(
  goldens.talkingSceneShowcase.validationReceiptSha256,
  expectedValidationReceiptSha,
);
assert.equal(
  goldens.talkingSceneShowcase.renderReportSha256,
  expectedRenderReportSha,
);
assert.equal(
  goldens.talkingSceneShowcase.qualityReportSha256,
  expectedQualityReportSha,
);
assert.equal(
  goldens.talkingSceneShowcase.humanReviewSha256,
  expectedHumanReviewSha,
);
assert.equal(goldens.talkingSceneShowcase.cueSha256, expectedCueSha);
assert.equal(goldens.talkingSceneShowcase.audioSha256, expectedAudioSha);
assert.deepEqual(goldens.transcriptGuidedStoryShowcase, {
  ...goldens.transcriptGuidedStoryShowcase,
  formatVersion: "0.4.0",
  status: "technical-pass-user-selected-example",
  sourceInputSha256: transcriptGuidedProofHashes["source-input.json"],
  inputSha256: transcriptGuidedProofHashes["input.json"],
  transcriptSha256: transcriptGuidedProofHashes["transcript.json"],
  videoSha256: transcriptGuidedProofHashes["final.mp4"],
  posterSha256: transcriptGuidedProofHashes["poster.jpg"],
  cueSha256: transcriptGuidedProofHashes["cherry-lipsync.tsv"],
  audioSha256: transcriptGuidedProofHashes["user-audio.wav"],
  userVisualApproval:
    "selected-for-examples; exact-checksum final creative approval not claimed",
});

const profile = getDiscoveryFormatProfile("shaz-puppet-runtime");
assert.ok(profile);
assert.equal(profile.name, "Animate Shaz");
assert.equal(profile.version, "0.4.0");
assert.deepEqual(
  profile.proofEntries.map(({ id, format }) => ({
    id,
    version: format.version,
  })),
  [
    { id: "shaz-puppet-runtime-talking-scene", version: "0.2.0" },
    { id: "shaz-puppet-runtime-transcript-guided-story", version: "0.4.0" },
  ],
);
assert.equal(profile.proofEntries[0]?.format.name, "Animate Shaz");
assert.equal(profile.proofEntries[0]?.format.version, "0.2.0");
assert.match(
  profile.proofEntries[0]?.title ?? "",
  /Shaz performs a real talking scene/,
);
assert.match(
  profile.proofEntries[0]?.curatorNote ?? "",
  /five hand-drawn mouth shapes/,
);
assert.match(
  profile.proofEntries[0]?.curatorNote ?? "",
  /creative review is still pending/,
);
assert.match(profile.promise, /Give Shaz a voice track/);
assert.match(profile.promise, /pick a room/);
assert.match(profile.promise, /reads the words locally/);
assert.match(profile.promise, /five artist-reviewed gestures/);
assert.equal(profile.proofEntries[0]?.media.aspectRatio, "16:9");
assert.equal(
  profile.proofEntries[0]?.media.src,
  "/format-repositories/shaz-puppet-runtime-v1/goldens/talking-scene-lipsync-v1/final.mp4",
);
assert.equal(
  profile.proofEntries[0]?.media.poster,
  "/format-repositories/shaz-puppet-runtime-v1/goldens/talking-scene-lipsync-v1/poster.jpg",
);
assert.equal(profile.proofEntries[0]?.media.durationLabel, "12 sec");
assert.equal(
  profile.proofEntries[1]?.title,
  "Leo: what puppy parenting taught us",
);
assert.match(
  profile.proofEntries[1]?.curatorNote ?? "",
  /Think lands on “idea,”/,
);
assert.doesNotMatch(
  profile.proofEntries[1]?.curatorNote ?? "",
  /review is still pending/,
);
assert.equal(
  profile.proofEntries[1]?.media.src,
  "/format-repositories/shaz-puppet-runtime-v1/goldens/transcript-guided-story-v1/final.mp4",
);
assert.equal(
  profile.proofEntries[1]?.media.poster,
  "/format-repositories/shaz-puppet-runtime-v1/goldens/transcript-guided-story-v1/poster.jpg",
);
assert.equal(profile.proofEntries[1]?.media.durationLabel, "30 sec");
for (const rejectedPoseId of rejectedShowcasePoseIds) {
  assert.doesNotMatch(
    JSON.stringify(profile.proofEntries),
    new RegExp(rejectedPoseId),
  );
}
assert.equal(
  profile.repositoryHref,
  "https://github.com/smsheik1/wiggly-shaz-puppet-runtime/releases/download/v0.4.0/wiggly-shaz-puppet-runtime-format-kit.zip",
);
assert.ok(profile.handoff);
assert.match(
  profile.handoff.requiredInputs.join(" "),
  /five artist-reviewed gestures/,
);
assert.match(
  profile.handoff.instructions.join(" "),
  /no sequence, durationFrames, or frame math/,
);
assert.match(
  profile.handoff.instructions.join(" "),
  /present, think, aha, point, and confident/,
);
assert.match(profile.handoff.instructions.join(" "), /npm run transcribe/);
assert.match(
  profile.handoff.instructions.join(" "),
  /registered recipes are technically runnable reference material/,
);
assert.equal(
  profile.handoff.totalEstimate,
  "$0 in service fees, usually 2-8 min",
);
assert.deepEqual(
  getPublishedDiscoveryEntries()
    .filter((entry) => entry.format.slug === "shaz-puppet-runtime")
    .map((entry) => entry.id),
  ["shaz-puppet-runtime-transcript-guided-story"],
  "Discovery should feature the approved 30-second Shaz performance without duplicating the older proof.",
);
assert.equal(
  getPublishedDiscoveryProofEntries().some(
    (entry) => entry.format.slug === "shaz-puppet-runtime",
  ),
  true,
  "The rich Format page can be browser-validated before shelf publication.",
);

const presentation = await getFormatRepoPagePresentation("shaz-puppet-runtime");
assert.equal(presentation?.kind, "shaz-puppet-runtime");
assert.equal(
  presentation?.detailedProofId,
  "shaz-puppet-runtime-talking-scene",
);
assert.match(
  presentation?.copy.runDescription ?? "",
  /reads what Shaz is saying/,
);
assert.match(
  presentation?.copy.runDescription ?? "",
  /artist-reviewed gesture/,
);
assert.match(presentation?.copy.runDescription ?? "", /lip-syncs the mouth/);
assert.equal(presentation?.copy.examplesTitle, "Examples");
assert.match(
  presentation?.copy.examplesDescription ?? "",
  /new 30-second story/,
);
assert.match(
  presentation?.copy.examplesDescription ?? "",
  /uses the transcript/,
);
assert.match(
  presentation?.copy.examplesDescription ?? "",
  /Play both with sound/,
);
assert.match(formatPageSource, /examplesTitle === "Examples" \? null/);
assert.match(
  formatPageSource,
  /<FormatRepoRunSummary[\s\S]*description=\{repoPageCopy\?\.runDescription\}/,
  "Every Repo page should use the shared detailed bottom run section.",
);
assert.match(runSummarySource, /Know the run before you start\./);
const publicHeroCopy = [
  profile.name,
  profile.promise,
  presentation?.copy.runDescription,
].join(" ");
assert.doesNotMatch(publicHeroCopy, /Download Format \d/i);
assert.doesNotMatch(
  publicHeroCopy,
  /checksum|WASI|registered actions|trusted actions|Puppet Runtime/i,
);
for (const staleCopy of [
  "Download Format 0.3.0 to turn local audio",
  "checksum-registered fixed backgrounds",
  "trusted artist-authored actions",
  "bundled WASI",
]) {
  assert.doesNotMatch(
    `${formatProofSource}\n${repoPageSource}`,
    new RegExp(staleCopy, "i"),
  );
}
const trust = await getShazPuppetRuntimeTrustData();
assert.equal(trust.version, "0.4.0");
assert.equal(trust.includedAssets.poses.length, 14);
assert.equal(
  trust.includedAssets.poses.some(({ id }) => id === "talk-to-camera"),
  false,
  "Talk to Camera is a composition preset, not a fifteenth pose.",
);
assert.deepEqual(trust.includedAssets.defaultDialogue, {
  id: "talk-to-camera",
  label: "Talk to Camera",
  subtitle: "Default dialogue",
  internalPoseId: "neutral-listening",
  description:
    "Shaz faces the audience in a calm, grounded pose while the supplied audio changes only the mouth drawing.",
  rules: [
    "The audio decides the length",
    "No manual frame math",
    "The same body and renderer stay in place",
  ],
});
assert.deepEqual(
  trust.includedAssets.showcasePoses.map(({ id }) => id),
  trustedShowcasePoseIds,
);
assert.equal(trust.includedAssets.props.length, 2);
assert.equal(trust.includedAssets.defaultBackgroundId, "sisters-room");
assert.deepEqual(
  trust.includedAssets.backgrounds.map(({ id, label, path, sha256 }) => ({
    id,
    label,
    path,
    sha256,
  })),
  expectedBackgrounds,
);
for (const background of expectedBackgrounds) {
  const file = `${repository}/${background.path}`;
  assert.equal(existsSync(file), true);
  assert.equal(sha256(file), background.sha256);
}
assert.equal(
  trust.includedAssets.backgrounds.find(({ id }) => id === "map-photo-zone")
    ?.supportingMediaZone?.status,
  "reserved-not-active",
);
assert.deepEqual(trust.includedAssets.bundledEngines, [
  {
    name: "cherry-lip-sync",
    version: "0.1.0",
    artifact: "WebAssembly/WASI module",
    host: "node",
    nativeExecutable: false,
    networkRequired: false,
    purpose:
      "generate A-K/X speech cues for audio-backed shaz-sequence-input-v1 runs",
  },
  {
    name: "whisper.cpp",
    version: "1.9.2",
    artifact: "checksum-pinned source archive plus base.en Q5_1 model",
    host: "locally compiled Apple Silicon helper using Apple Clang and Accelerate",
    nativeExecutableIncluded: false,
    nativeExecutableBuiltLocally: true,
    networkRequired: false,
    supportedPlatform: "darwin-arm64",
    purpose:
      "create an English transcript with word timestamps before body-language planning",
  },
]);
assert.equal(trust.quality.summary[0]?.value, "0.4.0");
assert.equal(trust.quality.summary[0]?.label, "kit version");
assert.ok(trust.commands.includes("npm run inspect:registry"));
assert.ok(
  trust.commands.some(
    (command) =>
      command.includes("npm run init") &&
      command.includes("--audio=/absolute/path/dialogue.wav"),
  ),
  "the copyable Talk to Camera init command must include its required audio input",
);
assert.ok(
  trust.commands.includes(
    "npm run lipsync -- --audio=/absolute/path/audio.wav --output=/absolute/path/cherry.tsv",
  ),
);
assert.ok(
  trust.commands.includes(
    "npm run transcribe -- --audio=/absolute/path/audio.wav --output=/absolute/path/transcript.json",
  ),
);
assert.equal(trust.quality.summary[2]?.value, "5");
assert.equal(trust.quality.summary[2]?.label, "artist-reviewed gestures");
assert.equal(trust.proof.durationTimeLabel, "00:12");
assert.match(trust.proofCopy.eyebrow, /First-draft talking scene/);
assert.equal(trust.proofCopy.title, "A real voice track, performed by Shaz.");
assert.match(trust.quality.noteTitle, /strong first draft/);
assert.match(trust.quality.note, /generated 100 mouth-timing cues locally/);
assert.match(trust.quality.note, /5 hand-drawn mouth shapes/);
assert.match(trust.quality.note, /earlier 0\.2\.0 kit/);
assert.match(trust.quality.note, /four built-in backgrounds/);
assert.match(
  trust.quality.note,
  /Creative review of this exact video is still pending/,
);
assert.doesNotMatch(
  trustSource,
  /blind proof generated|checksum-registered fixed backgrounds|final checksum-bound creative certification|Body motion and lip-sync stay inside one renderer/i,
);
assert.equal(
  trust.includedAssets.showcasePosterSrc,
  "/format-repositories/shaz-puppet-runtime-v1/goldens/five-authored-showcase/poster.jpg",
);
assert.match(includedAssetsSource, /data\.includedAssets\.poses\.length/);
assert.match(includedAssetsSource, /Five reviewed gestures/);
assert.match(includedAssetsSource, /Local transcription and lip-sync/);
assert.match(includedAssetsSource, /Four rooms/);
assert.match(includedAssetsSource, /runnable actions in all/);
assert.match(includedAssetsSource, /engineering reference material/);
assert.match(includedAssetsSource, /fresh creative review/);
assert.match(includedAssetsSource, /data\.includedAssets\.bundledEngines/);
assert.match(includedAssetsSource, /shaz-background-library/);
assert.match(includedAssetsSource, /Pick the room\. Keep the camera fixed\./);
assert.match(includedAssetsSource, /Four built-in backgrounds/);
assert.match(includedAssetsSource, /data\.includedAssets\.backgrounds\.map/);
assert.match(includedAssetsSource, /defaultBackgroundId/);
assert.match(includedAssetsSource, /Future media zone reserved/);
assert.match(includedAssetsSource, /formatAssetRoot/);
assert.match(includedAssetsSource, /background\.path/);
assert.match(includedAssetsSource, /shaz-talk-to-camera-option/);
assert.match(includedAssetsSource, /defaultDialogue\.subtitle/);
assert.match(includedAssetsSource, /ordinary speech/);
assert.match(includedAssetsSource, /Present, Think, Ah-ha, Point, or/);
assert.match(includedAssetsSource, /sequencePreset/);
assert.match(
  includedAssetsSource,
  /data\.includedAssets\.defaultDialogue\.internalPoseId/,
);
assert.match(includedAssetsSource, /Five artist-reviewed gestures/);
assert.match(includedAssetsSource, /data\.includedAssets\.showcasePoses\.map/);
assert.match(includedAssetsSource, /shaz-mouth-shape-kit/);
assert.match(
  includedAssetsSource,
  /Five hand-drawn mouths\. Every sound has somewhere to go\./,
);
for (const mouthAsset of [
  "mouth-01.png",
  "mouth-04.png",
  "mouth-05.png",
  "mouth-02.png",
  "mouth-03.png",
]) {
  assert.match(
    includedAssetsSource,
    new RegExp(mouthAsset.replace(".", "\\.")),
  );
}
for (const mapping of ["A · X", "B · G · I · J", "C · H", "D", "E · F · K"]) {
  assert.match(
    includedAssetsSource,
    new RegExp(mapping.replaceAll(" · ", " \\· ")),
  );
}
assert.match(includedAssetsSource, /swaps between five mouth drawings/);
assert.match(
  connectionsSource,
  /No subscriptions\. No API keys\. It runs on Apple silicon\./,
);
assert.match(connectionsSource, /Everything stays local/);
assert.match(connectionsSource, /It hears the words, too/);
assert.match(connectionsSource, /same Shaz rig/);
assert.match(includedAssetsSource, /Understands the dialogue/);
assert.match(includedAssetsSource, /Local English transcript/);
assert.doesNotMatch(
  includedAssetsSource,
  /Cherry Lip Sync \{engine\.version\}/,
);
assert.equal(
  trust.receipt.rows.find(({ label }) => label === "Kit version")?.value,
  "0.4.0",
);
assert.equal(
  trust.receipt.rows.find(({ label }) => label === "Demo made with")?.value,
  "0.2.0",
);
assert.equal(
  trust.receipt.rows.find(({ label }) => label === "Video SHA")?.value,
  expectedVideoSha.slice(0, 16),
);
assert.equal(
  trust.receipt.rows.find(({ label }) => label === "Audio")?.value,
  "AAC · -15.6 dB",
);
assert.equal(
  trust.receipt.rows.find(({ label }) => label === "Lip-sync")?.value,
  "100 cues · 5 mouths",
);
assert.match(trust.receipt.note, /exact video checksum is recorded above/);
assert.match(trust.receipt.note, /Human creative review is still pending/);

if (existsSync(download)) {
  const archive = await JSZip.loadAsync(readFileSync(download));
  const entries = Object.keys(archive.files);
  const joined = entries.join("\n");
  const root = "wiggly-shaz-puppet-runtime-format-kit";
  for (const required of [
    "SKILL.md",
    "README.md",
    "KIT-MANIFEST.json",
    "runner.mjs",
    "format.json",
    "requirements.json",
    "quality.json",
    "poses/index.json",
    "rig-v2/runtime.json",
    "rig-v2/assets/receipt.json",
    "runtime/cherry-wasi-runner.mjs",
    "runtime/lipsync.mjs",
    "runtime/transcription.mjs",
    ...expectedBackgrounds.map(({ path }) => path),
    "vendor/cherry-lip-sync/v0.1.0/cherrylipsync.wasm",
    "vendor/whisper.cpp/v1.9.2/VENDOR-MANIFEST.json",
    "vendor/whisper.cpp/v1.9.2/BUILD-PLAN.json",
    "vendor/whisper.cpp/v1.9.2/whisper.cpp-v1.9.2.tar.gz",
    "vendor/whisper.cpp/v1.9.2/ggml-base.en-q5_1.bin",
    "vendor/whisper.cpp/v1.9.2/LICENSE-WHISPER.CPP",
    "vendor/whisper.cpp/v1.9.2/LICENSE-OPENAI-WHISPER",
  ]) {
    assert.ok(
      archive.file(`${root}/${required}`),
      `${required} must be packaged`,
    );
  }
  const packagedFormatFile = archive.file(`${root}/format.json`);
  const packagedRequirementsFile = archive.file(`${root}/requirements.json`);
  assert.ok(packagedFormatFile);
  assert.ok(packagedRequirementsFile);
  const packagedFormat = JSON.parse(await packagedFormatFile.async("string")) as {
    version: string;
    summary: string;
  };
  const packagedRequirements = JSON.parse(
    await packagedRequirementsFile.async("string"),
  ) as {
    bundledEngines: Array<{
      name: string;
      artifact: string;
      nativeExecutable?: boolean;
      nativeExecutableIncluded?: boolean;
      nativeExecutableBuiltLocally?: boolean;
      networkRequired: boolean;
      supportedPlatform?: string;
    }>;
  };
  assert.equal(packagedFormat.version, "0.4.0");
  assert.match(packagedFormat.summary, /Give Shaz a voice track/);
  assert.match(packagedFormat.summary, /four built-in backgrounds/);
  assert.deepEqual(packagedRequirements.bundledEngines, [
    {
      name: "cherry-lip-sync",
      version: "0.1.0",
      artifact: "WebAssembly/WASI module",
      host: "node",
      nativeExecutable: false,
      networkRequired: false,
      purpose:
        "generate A-K/X speech cues for audio-backed shaz-sequence-input-v1 runs",
    },
    {
      name: "whisper.cpp",
      version: "1.9.2",
      artifact: "checksum-pinned source archive plus base.en Q5_1 model",
      host: "locally compiled Apple Silicon helper using Apple Clang and Accelerate",
      nativeExecutableIncluded: false,
      nativeExecutableBuiltLocally: true,
      networkRequired: false,
      supportedPlatform: "darwin-arm64",
      purpose:
        "create an English transcript with word timestamps before body-language planning",
    },
  ]);
  assert.equal(
    entries.some((entry) => /(^|\/)cherrylipsync(?:\.exe)?$/.test(entry)),
    false,
    "The ZIP must not ship a native Cherry executable.",
  );
  assert.equal(
    entries.some(
      (entry) =>
        entry.includes(".runtime-cache/") || /(^|\/)whisper-cli$/.test(entry),
    ),
    false,
    "The ZIP must contain source and model inputs, never the locally compiled Whisper helper.",
  );
  assert.doesNotMatch(
    joined,
    /node_modules|compile-tvg-assets\.mjs|goldens\/|\.(mp4|mov|wav|m4a|aac|mp3)$/,
  );
  assert.deepEqual(
    entries.filter((entry) => entry.includes("agent-runs/")),
    [`${root}/agent-runs/.gitkeep`],
  );
  assert.deepEqual(
    entries.filter((entry) => entry.includes("downloads/")),
    [],
  );
  const expectedZipSha = readFileSync(`${download}.sha256`, "utf8").split(
    /\s+/,
  )[0];
  assert.equal(sha256(download), expectedZipSha);
}

console.log("Shaz Puppet Runtime rich Repo page tests passed");
