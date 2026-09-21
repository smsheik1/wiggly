#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { generateCherryCues, verifyCherryEngine } from "./runtime/cherry.mjs";
import { inspectRun } from "./runtime/inspect-run.mjs";
import { renderSequence } from "./runtime/render-sequence.mjs";
import { ensureWhisperEngine, generateTranscript, validateTranscriptionAudio } from "./runtime/transcription.mjs";
import { deriveMultiShotPlan, deriveMultiShotPlanWithJev } from "./runtime/multi-shot-timeline.mjs";
import { runScriptLinter } from "./runtime/validate-script.mjs";
import {
  DEFAULT_SUBREDDITS,
  createCandidateCard,
  extractPostComments,
  fetchSubredditRss,
} from "./runtime/scout-trends.mjs";
import {
  MAX_OUTPUT_FRAMES,
  execute,
  exists,
  measuredAudioDuration,
  parseArgs,
  probeMedia,
  readJson,
  requireRunId,
  resolveRunDirectory,
  sha256,
  validateRun,
  writeJson,
} from "./runtime/run-common.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const SHA256 = /^[a-f0-9]{64}$/;
const ATTEMPT_LIMIT = 3;
const TALK_TO_CAMERA_PRESET = "talk-to-camera";

function usage() {
  return `Usage:
  node runner.mjs check
  node runner.mjs smoke
  node runner.mjs scout [--subreddit=name] [--limit=5] [--with-comments]
  node runner.mjs lint:script --script=/absolute/path/script.json
  node runner.mjs lipsync --audio=/absolute/path/audio --output=/absolute/path/cherry.tsv
  node runner.mjs transcribe --audio=/absolute/path/audio --output=/absolute/path/transcript.json
  node runner.mjs init --run=<id> --input=/absolute/path/input.json [--audio=/absolute/path/audio] [--lipsync=off] [--lipsync-cues=/absolute/path/cherry.tsv]
  node runner.mjs validate --run=<id>
  node runner.mjs render --run=<id>
  node runner.mjs inspect --run=<id>
  node runner.mjs finalize --run=<id>`;
}

function toolVersion(program, args = ["-version"]) {
  return execute(program, args).split("\n")[0].trim();
}

async function verifyAssetReceipt() {
  const manifest = await readJson(path.join(root, "rig-v2", "runtime.json"));
  const receipt = await readJson(path.join(root, "rig-v2", "assets", "receipt.json"));
  if (receipt.schemaVersion !== "shaz-tvg-asset-receipt-v2") {
    throw new Error("unsupported rig-v2 asset receipt");
  }
  if (receipt.sourceXstageSha256 !== manifest.source.sha256) {
    throw new Error("rig manifest and compiled asset receipt reference different Xstage sources");
  }
  if (receipt.artistRenderedFramesUsed !== false) {
    throw new Error("compiled asset receipt does not prove artist-frame exclusion");
  }
  for (const asset of receipt.assets) {
    const file = path.join(root, "rig-v2", "assets", asset.filename);
    if (await sha256(file) !== asset.outputSha256) {
      throw new Error(`compiled rig asset checksum mismatch: ${asset.filename}`);
    }
  }
  return { manifest, receipt };
}

async function check() {
  const requiredFiles = [
    "format.json",
    "requirements.json",
    "input-contract.json",
    "composition-contract.json",
    "output-contract.json",
    "shot-sheet-contract.json",
    "director-playbook.md",
    "quality.json",
    "content-boundary.json",
    "assets.json",
    "poses/index.json",
    "motion-packets/index.json",
    "vendor/cherry-lip-sync/v0.1.0/VENDOR-MANIFEST.json",
    "vendor/whisper.cpp/v1.9.2/VENDOR-MANIFEST.json",
    "rig-v2/runtime.json",
    "rig-v2/assets/receipt.json",
  ];
  for (const relative of requiredFiles) {
    if (!(await exists(path.join(root, relative)))) throw new Error(`missing required kit file: ${relative}`);
  }
  const { manifest, receipt } = await verifyAssetReceipt();
  const cherry = await verifyCherryEngine({ root });
  const whisper = await ensureWhisperEngine({ root });
  const assetManifest = await readJson(path.join(root, "assets.json"));
  const backgroundIds = (assetManifest.backgrounds ?? []).map(({ id }) => id);
  if (new Set(backgroundIds).size !== backgroundIds.length) {
    throw new Error("background registry contains duplicate ids");
  }
  if (!backgroundIds.includes(assetManifest.defaultBackgroundId)) {
    throw new Error("assets.defaultBackgroundId must name a registered background");
  }
  for (const [kind, records, directory] of [
    ["prop", assetManifest.props ?? [], "props"],
    ["background", assetManifest.backgrounds ?? [], "backgrounds"],
  ]) {
    for (const record of records) {
      const file = path.resolve(root, record.path);
      if (!file.startsWith(`${path.join(root, "assets", directory)}${path.sep}`)) {
        throw new Error(`${kind} escapes assets/${directory}: ${record.id}`);
      }
      if (await sha256(file) !== record.sha256) {
        throw new Error(`${kind} checksum mismatch: ${record.id}`);
      }
    }
  }
  await validateRun({
    root,
    runDirectory: await stageValidationFixture("check-contract", "fixtures/smoke/input.json"),
  });
  await fs.rm(path.join(root, "agent-runs", "check-contract"), { recursive: true, force: true });
  const sharpVersion = sharp.versions.sharp;
  const report = {
    status: "pass",
    formatVersion: (await readJson(path.join(root, "format.json"))).version,
    tools: {
      node: process.version,
      npm: toolVersion("npm", ["--version"]),
      ffmpeg: toolVersion("ffmpeg"),
      ffprobe: toolVersion("ffprobe"),
      sharp: sharpVersion,
      cherry: `${cherry.manifest.engine} ${cherry.manifest.version} (WASI)`,
      transcription: `${whisper.vendor.manifest.engine} ${whisper.vendor.manifest.version} (${whisper.receipt.execution})`,
    },
    sourceXstageSha256: manifest.source.sha256,
    artistRenderedFramesUsed: false,
    compiledAssetCount: receipt.assets.length,
    tests: "run separately by npm test",
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

async function stageValidationFixture(runId, fixture) {
  const runDirectory = resolveRunDirectory(root, runId);
  await fs.rm(runDirectory, { recursive: true, force: true });
  await fs.mkdir(runDirectory, { recursive: true });
  await fs.copyFile(path.join(root, fixture), path.join(runDirectory, "input.json"));
  return runDirectory;
}

async function init(args) {
  const runId = requireRunId(args.run);
  if (!args.input || !path.isAbsolute(args.input)) throw new Error("--input must be an absolute JSON path");
  await fs.access(args.input);
  const input = await readJson(args.input);
  if (input.transcript !== undefined) {
    throw new Error("source input must omit transcript; init generates checksum-bound local transcript evidence");
  }
  const isMultiShot = input.schemaVersion === "shaz-multi-shot-v1";
  const isPerformance = input.schemaVersion === "shaz-body-language-performance-v1";
  const isTalkToCamera = input.schemaVersion === "shaz-sequence-input-v1"
    && input.sequencePreset !== undefined;
  if (isTalkToCamera && input.sequencePreset !== TALK_TO_CAMERA_PRESET) {
    throw new Error(`unsupported sequencePreset ${input.sequencePreset}`);
  }
  if (isTalkToCamera && input.sequence !== undefined) {
    throw new Error("talk-to-camera source input must omit sequence; init derives it from the audio");
  }
  if (isTalkToCamera && input.durationFrames !== undefined) {
    throw new Error("talk-to-camera source input must omit durationFrames; init measures the audio");
  }
  const isAudioSequence = input.schemaVersion === "shaz-sequence-input-v1"
    && (typeof input.backgroundId === "string" || isTalkToCamera);
  const needsAudio = isPerformance || isAudioSequence || isMultiShot;
  const needsSemanticPlan = needsAudio && !isTalkToCamera && !isMultiShot;
  if (needsSemanticPlan && !SHA256.test(input.planningTranscriptSha256 ?? "")) {
    throw new Error(
      "audio-backed gesture plans require planningTranscriptSha256 from npm run transcribe",
    );
  }
  if (isMultiShot && input.planningTranscriptSha256 && !SHA256.test(input.planningTranscriptSha256)) {
    throw new Error("multi-shot input planningTranscriptSha256 must be a valid 64-char sha256");
  }
  const lipSyncMode = args.lipsync ?? "auto";
  if (!["auto", "off"].includes(lipSyncMode)) throw new Error("--lipsync must be auto or off");
  if (args["lipsync-cues"] && lipSyncMode === "off") {
    throw new Error("--lipsync-cues cannot be combined with --lipsync=off");
  }
  if (isTalkToCamera && lipSyncMode === "off") {
    throw new Error("talk-to-camera requires lip-sync; omit --lipsync=off");
  }
  if (needsAudio && (!args.audio || !path.isAbsolute(args.audio))) {
    throw new Error("audio-backed runs require --audio=/absolute/path/audio");
  }
  if (!needsAudio && args.audio) {
    throw new Error("--audio requires a performance input or an audio-backed sequence with backgroundId");
  }
  if (needsAudio) await validateTranscriptionAudio(args.audio);
  if (args["lipsync-cues"]) {
    if (!isAudioSequence) throw new Error("--lipsync-cues currently requires an audio-backed sequence input");
    if (!path.isAbsolute(args["lipsync-cues"])) {
      throw new Error("--lipsync-cues must be an absolute Cherry TSV path");
    }
    await fs.access(args["lipsync-cues"]);
  }
  const runDirectory = resolveRunDirectory(root, runId);
  if (await exists(runDirectory)) throw new Error(`run already exists: ${runId}`);
  await fs.mkdir(runDirectory, { recursive: true });
  let lipSyncState = null;
  let transcriptState = null;
  try {
    if (needsAudio) {
      const extension = path.extname(args.audio).toLowerCase() || ".audio";
      const audioFile = `user-audio${extension}`;
      const stagedAudioPath = path.join(runDirectory, audioFile);
      await fs.copyFile(args.audio, stagedAudioPath);
      input.audioFile = audioFile;
      delete input.lipSync;
      delete input.transcript;
      let sequenceAudioFrames = null;
      if (isAudioSequence || isMultiShot) {
        const probe = probeMedia(stagedAudioPath);
        const durationSeconds = measuredAudioDuration(probe);
        if (!(durationSeconds > 0)) throw new Error("staged audio has no measurable duration");
        sequenceAudioFrames = Math.max(1, Math.round(durationSeconds * 24));
        if (sequenceAudioFrames > MAX_OUTPUT_FRAMES) {
          throw new Error(
            `audio requires ${sequenceAudioFrames} frames; maximum is ${MAX_OUTPUT_FRAMES}`,
          );
        }
        if (isTalkToCamera) input.durationFrames = sequenceAudioFrames;
      }
      const transcriptFile = "transcript.json";
      const transcriptReceiptFile = "transcription-receipt.json";
      transcriptState = await generateTranscript({
        root,
        audioPath: stagedAudioPath,
        outputPath: path.join(runDirectory, transcriptFile),
        receiptPath: path.join(runDirectory, transcriptReceiptFile),
      });
      if (needsSemanticPlan
        && input.planningTranscriptSha256 !== transcriptState.transcriptSha256) {
        throw new Error(
          "the gesture plan was written against a different transcript; rerun npm run transcribe and update the plan",
        );
      }
      input.transcript = {
        file: transcriptFile,
        sha256: transcriptState.transcriptSha256,
        receiptFile: transcriptReceiptFile,
        receiptSha256: transcriptState.receiptSha256,
        sourceAudioSha256: transcriptState.receipt.audio.sourceSha256,
        language: transcriptState.transcript.language,
        segmentCount: transcriptState.transcript.segments.length,
        wordCount: transcriptState.transcript.words.length,
      };
      // If input is multi-shot and shots array is omitted, automatically derive it from the transcript!
      if (isMultiShot && (!Array.isArray(input.shots) || input.shots.length === 0)) {
        const derived = await deriveMultiShotPlanWithJev({
          transcript: transcriptState.transcript,
          audioDurationSeconds: sequenceAudioFrames / 24,
          defaultBackgroundId: input.defaultBackgroundId ?? "sisters-room",
          brollMediaList: Array.isArray(input.brollMedia) ? input.brollMedia : [],
        });
        input.title = input.title ?? derived.title;
        input.totalDurationFrames = sequenceAudioFrames;
        input.shots = derived.shots;
        delete input.defaultBackgroundId;
      }

      const shouldGenerateLipSync = (isAudioSequence && lipSyncMode !== "off")
        || (isMultiShot && input.shots?.some((s) => s.shotType === "talk-to-camera") && lipSyncMode !== "off");
      if (shouldGenerateLipSync) {
        const cueFile = "cherry-lipsync.tsv";
        const cuePath = path.join(runDirectory, cueFile);
        const sourceAudioSha256 = await sha256(stagedAudioPath);
        if (args["lipsync-cues"]) {
          await fs.copyFile(args["lipsync-cues"], cuePath);
          lipSyncState = {
            engine: "cherry-lip-sync",
            engineVersion: "0.1.0",
            execution: "external",
            cueSource: "supplied-tsv",
            cueFile,
            cueSha256: await sha256(cuePath),
            sourceAudioSha256,
            fps: 24,
            filterSingleFrames: null,
          };
        } else {
          lipSyncState = await generateCherryCues({
            root,
            audioPath: stagedAudioPath,
            outputPath: cuePath,
            totalFrames: sequenceAudioFrames,
          });
        }
        input.lipSync = {
          engine: lipSyncState.engine,
          engineVersion: lipSyncState.engineVersion,
          execution: lipSyncState.execution,
          cueSource: lipSyncState.cueSource,
          cueFile,
          cueSha256: lipSyncState.cueSha256,
          sourceAudioSha256: lipSyncState.sourceAudioSha256,
          fps: lipSyncState.fps,
          filterSingleFrames: lipSyncState.filterSingleFrames,
          ...(lipSyncState.engineManifestSha256 ? {
            engineManifestSha256: lipSyncState.engineManifestSha256,
            engineModuleSha256: lipSyncState.engineModuleSha256,
          } : {}),
        };
      }
      await writeJson(path.join(runDirectory, "input.json"), input);
    } else {
      await fs.copyFile(args.input, path.join(runDirectory, "input.json"));
    }
  } catch (error) {
    await fs.rm(runDirectory, { recursive: true, force: true });
    throw error;
  }
  await writeJson(path.join(runDirectory, "state.json"), {
    schemaVersion: 1,
    runId,
    status: "initialized",
    attempts: 0,
    initializedAt: new Date().toISOString(),
    ...(needsAudio ? {
      userAudio: {
        file: input.audioFile,
        sourceBasename: path.basename(args.audio),
        sha256: await sha256(path.join(runDirectory, input.audioFile)),
      },
      ...(lipSyncState ? { lipSync: lipSyncState } : {}),
      ...(transcriptState ? {
        transcript: {
          file: input.transcript.file,
          sha256: input.transcript.sha256,
          receiptFile: input.transcript.receiptFile,
          receiptSha256: input.transcript.receiptSha256,
          wordCount: input.transcript.wordCount,
          segmentCount: input.transcript.segmentCount,
        },
      } : {}),
      ...(isTalkToCamera ? { sequencePreset: TALK_TO_CAMERA_PRESET } : {}),
    } : {}),
  });
  console.log(JSON.stringify({ status: "initialized", runId, runDirectory }, null, 2));
  return runDirectory;
}

async function lipsync(args) {
  if (!args.audio || !path.isAbsolute(args.audio)) throw new Error("--audio must be an absolute audio path");
  if (!args.output || !path.isAbsolute(args.output)) throw new Error("--output must be an absolute TSV path");
  await fs.access(args.audio);
  const durationSeconds = measuredAudioDuration(probeMedia(args.audio));
  if (!(durationSeconds > 0)) throw new Error("audio has no measurable duration");
  const receipt = await generateCherryCues({
    root,
    audioPath: args.audio,
    outputPath: args.output,
    totalFrames: Math.max(1, Math.round(durationSeconds * 24)),
  });
  console.log(JSON.stringify(receipt, null, 2));
  return receipt;
}

async function transcribe(args) {
  if (!args.audio || !path.isAbsolute(args.audio)) throw new Error("--audio must be an absolute audio path");
  if (!args.output || !path.isAbsolute(args.output)) throw new Error("--output must be an absolute JSON path");
  await fs.access(args.audio);
  const result = await generateTranscript({
    root,
    audioPath: args.audio,
    outputPath: args.output,
  });
  const report = {
    status: "pass",
    transcript: result.transcriptPath,
    transcriptSha256: result.transcriptSha256,
    receipt: result.receiptPath,
    receiptSha256: result.receiptSha256,
    language: result.transcript.language,
    segmentCount: result.transcript.segments.length,
    wordCount: result.transcript.words.length,
    text: result.transcript.text,
    providerCalls: 0,
    cost: "$0",
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

async function runDirectoryFromArgs(args) {
  const runDirectory = resolveRunDirectory(root, requireRunId(args.run));
  if (!(await exists(runDirectory))) throw new Error(`unknown run: ${args.run}`);
  return runDirectory;
}

async function render(args) {
  const runDirectory = await runDirectoryFromArgs(args);
  const statePath = path.join(runDirectory, "state.json");
  const state = await readJson(statePath);
  if (!Number.isInteger(state.attempts) || state.attempts >= ATTEMPT_LIMIT) {
    throw new Error(`render attempt limit reached (${ATTEMPT_LIMIT})`);
  }
  state.attempts += 1;
  state.status = "rendering";
  state.lastAttemptAt = new Date().toISOString();
  await writeJson(statePath, state);
  try {
    const result = await renderSequence({ root, runDirectory });
    state.status = "rendered";
    state.outputSha256 = result.report.outputSha256;
    await writeJson(statePath, state);
    console.log(JSON.stringify(result.report, null, 2));
    return result;
  } catch (error) {
    state.status = "render-failed";
    state.lastError = error.message;
    await writeJson(statePath, state);
    throw error;
  }
}

async function finalize(args) {
  const runDirectory = await runDirectoryFromArgs(args);
  const validated = await validateRun({ root, runDirectory });
  const quality = await readJson(path.join(runDirectory, "quality-report.json"));
  const review = await readJson(path.join(runDirectory, "human-review.json"));
  const output = path.join(runDirectory, "final.mp4");
  const outputSha256 = await sha256(output);
  const failures = [];
  if (quality.status !== "pass") failures.push("automatic quality report did not pass");
  if (quality.inputSha256 !== validated.receipt.inputSha256) failures.push("quality report input is stale");
  if (quality.outputSha256 !== outputSha256) failures.push("quality report output is stale");
  if (review.schemaVersion !== 1 || review.status !== "approved") failures.push("human review has not approved the output");
  if (review.reviewedOutputSha256 !== outputSha256) failures.push("human review checksum is stale");
  if (typeof review.reviewer !== "string" || review.reviewer.trim().length < 1) failures.push("human review must name its reviewer");
  const isAudiovisual = validated.mode === "performance" || validated.mode === "audio-sequence" || validated.mode === "multi-shot";
  if (isAudiovisual) {
    if (review.directVideoPerception !== true) failures.push("performance review must directly perceive moving video");
    if (review.directAudioPerception !== true) failures.push("performance review must directly perceive the audio track");
    if (!Number.isInteger(review.completePasses) || review.completePasses < 1) {
      failures.push("performance review must record at least one complete audiovisual pass");
    }
  }
  if (failures.length > 0) throw new Error(`finalization blocked:\n- ${failures.join("\n- ")}`);
  const delivery = {
    schemaVersion: 1,
    status: "ready",
    finalizedAt: new Date().toISOString(),
    finalVideo: "final.mp4",
    inputSha256: validated.receipt.inputSha256,
    outputSha256,
    sourceXstageSha256: validated.receipt.sourceXstageSha256,
    artistRenderedFramesUsed: false,
    providerCalls: 0,
    cost: "$0",
    reviewer: review.reviewer,
    ...(isAudiovisual ? {
      audio: validated.receipt.audio,
      background: validated.receipt.background,
      ...(validated.receipt.transcript ? { transcript: validated.receipt.transcript } : {}),
      ...(validated.receipt.lipSync ? { lipSync: validated.receipt.lipSync } : {}),
      ...(validated.receipt.sequencePreset
        ? { sequencePreset: validated.receipt.sequencePreset }
        : {}),
      ...(validated.mode === "performance" ? {
        motionPacketRegistrySha256: validated.receipt.motionPacketRegistrySha256,
        events: validated.receipt.events,
      } : {
        poses: validated.receipt.poses,
      }),
    } : {}),
  };
  await writeJson(path.join(runDirectory, "delivery.json"), delivery);
  console.log(JSON.stringify(delivery, null, 2));
  return delivery;
}

async function smoke() {
  await check();
  const runId = "smoke-proof";
  const runDirectory = await stageValidationFixture(runId, "fixtures/smoke/input.json");
  await writeJson(path.join(runDirectory, "state.json"), {
    schemaVersion: 1,
    runId,
    status: "initialized",
    attempts: 0,
    initializedAt: new Date().toISOString(),
  });
  await render({ run: runId });
  await inspectRun({ root, runDirectory });
  const outputSha256 = await sha256(path.join(runDirectory, "final.mp4"));
  await writeJson(path.join(runDirectory, "human-review.json"), {
    schemaVersion: 1,
    status: "approved",
    reviewedOutputSha256: outputSha256,
    reviewer: "packaged-smoke-fixture",
    notes: "Deterministic local smoke fixture; creative human review remains required for real runs.",
  });
  const delivery = await finalize({ run: runId });
  console.log(JSON.stringify({ status: "pass", runId, outputSha256: delivery.outputSha256 }, null, 2));
}

async function main() {
  const [command, ...values] = process.argv.slice(2);
  if (!command) throw new Error(usage());
  const args = parseArgs(values);
  if (command === "check") return check();
  if (command === "smoke") return smoke();
  if (command === "scout") {
    const subreddits = args.subreddit ? [args.subreddit] : DEFAULT_SUBREDDITS;
    const limit = Math.max(1, Number.parseInt(args.limit || "3", 10));
    const withComments = Boolean(args["with-comments"]);
    const results = [];

    for (const sub of subreddits) {
      try {
        const posts = await fetchSubredditRss(sub, "hot");
        for (const post of posts.slice(0, limit)) {
          let comments = [];
          if (withComments) {
            comments = await extractPostComments(post.link, 3);
          }
          results.push(createCandidateCard(post, comments));
        }
      } catch (err) {
        console.error(`[scout] Warning: failed to fetch r/${sub}: ${err.message}`);
      }
    }

    if (args.output) {
      await writeJson(args.output, results);
    }
    console.log(JSON.stringify(results, null, 2));
    return results;
  }
  if (command === "lint:script") {
    const scriptPath = args.script;
    if (!scriptPath) throw new Error("lint:script requires --script=/path/to/script.json");
    const result = await runScriptLinter(scriptPath);
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  if (command === "lipsync") return lipsync(args);
  if (command === "transcribe") return transcribe(args);
  if (command === "init") return init(args);
  if (command === "validate") {
    const result = await validateRun({ root, runDirectory: await runDirectoryFromArgs(args) });
    console.log(JSON.stringify(result.receipt, null, 2));
    return result.receipt;
  }
  if (command === "render") return render(args);
  if (command === "inspect") {
    const report = await inspectRun({ root, runDirectory: await runDirectoryFromArgs(args) });
    console.log(JSON.stringify(report, null, 2));
    return report;
  }
  if (command === "finalize") return finalize(args);
  throw new Error(`unknown command ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
