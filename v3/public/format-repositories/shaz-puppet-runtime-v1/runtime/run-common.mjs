import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { loadCherryEngine } from "./cherry.mjs";
import { createPoseRuntime, loadPoseRecipe } from "./pose-recipe.mjs";
import { parseCherryTsv } from "./lipsync.mjs";
import {
  PERFORMANCE_SCHEMA,
  loadMotionPacketRegistry,
  validatePerformancePlan,
} from "./motion-packets.mjs";
import {
  MULTI_SHOT_SCHEMA,
  validateMultiShotPlan,
} from "./multi-shot-timeline.mjs";
import { loadManifest } from "./rig-v2-renderer.mjs";
import { validateTranscriptEvidence } from "./transcription.mjs";

const RUN_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const INPUT_SCHEMA = "shaz-sequence-input-v1";
const TALK_TO_CAMERA_PRESET = "talk-to-camera";
const MAX_ACTIONS = 24;
const MAX_OUTPUT_FRAMES = 1800;

function parseArgs(values) {
  const result = {};
  for (const value of values) {
    if (!value.startsWith("--") || !value.includes("=")) {
      throw new Error(`arguments must use --name=value: ${value}`);
    }
    const [name, ...rest] = value.slice(2).split("=");
    result[name] = rest.join("=");
  }
  return result;
}

function requireRunId(value) {
  if (!RUN_ID.test(value ?? "")) {
    throw new Error("--run must be 1-64 lowercase letters, digits, or internal hyphens");
  }
  return value;
}

function resolveRunDirectory(root, runId) {
  return path.join(root, "agent-runs", requireRunId(runId));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(file);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function execute(program, values, { cwd, includeStderr = false, timeoutMs = 300_000 } = {}) {
  const result = spawnSync(program, values, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${program} failed:\n${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  return includeStderr ? `${result.stdout}${result.stderr}` : result.stdout;
}

function probeMedia(file) {
  return JSON.parse(execute("ffprobe", [
    "-v", "error",
    "-protocol_whitelist", "file,pipe",
    "-protocol_blacklist", "http,https,tcp,tls,udp,rtp",
    "-show_streams",
    "-show_format",
    "-of", "json",
    file,
  ], { timeoutMs: 30_000 }));
}

function measuredAudioDuration(probe) {
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  return Number(audio?.duration || probe.format?.duration || 0);
}

function exactKeys(value, allowed, context) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new Error(`${context} contains unsupported key(s): ${extras.join(", ")}`);
}

async function loadPoseRegistry(root, manifest) {
  const registryPath = path.join(root, "poses", "index.json");
  const registry = await readJson(registryPath);
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.poses) || registry.poses.length === 0) {
    throw new Error("poses/index.json is invalid");
  }
  const posesRoot = path.join(root, "poses");
  const byId = new Map();
  for (const record of registry.poses) {
    exactKeys(record, ["id", "kind", "path", "sha256"], `pose registry entry ${record.id ?? "?"}`);
    if (!RUN_ID.test(record.id ?? "") || byId.has(record.id)) {
      throw new Error(`pose registry has invalid or duplicate id ${record.id}`);
    }
    if (path.isAbsolute(record.path ?? "")) throw new Error(`pose ${record.id} path must be relative`);
    const recipePath = path.resolve(posesRoot, record.path ?? "");
    if (!recipePath.startsWith(`${posesRoot}${path.sep}`)) {
      throw new Error(`pose ${record.id} path escapes poses/`);
    }
    if (await sha256(recipePath) !== record.sha256) {
      throw new Error(`pose registry checksum mismatch for ${record.id}`);
    }
    const recipe = await loadPoseRecipe(recipePath);
    if (recipe.id !== record.id) throw new Error(`pose registry id mismatch for ${record.id}`);
    const poseRuntime = createPoseRuntime(manifest, recipe);
    byId.set(record.id, { ...record, recipePath, recipe, poseRuntime });
  }
  return { path: registryPath, sha256: await sha256(registryPath), byId };
}

function integerInRange(value, fallback, minimum, maximum, context) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${context} must be an integer from ${minimum} to ${maximum}`);
  }
  return resolved;
}

function validateInput(input, registry) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("input must be an object");
  exactKeys(input, [
    "schemaVersion",
    "title",
    "sequence",
    "sequencePreset",
    "durationFrames",
    "audioFile",
    "backgroundId",
    "lipSync",
    "transcript",
    "planningTranscriptSha256",
  ], "input");
  if (input.schemaVersion !== INPUT_SCHEMA) throw new Error(`unsupported input schema ${input.schemaVersion}`);
  if (typeof input.title !== "string" || input.title.trim().length < 1 || input.title.length > 120) {
    throw new Error("input.title must contain 1-120 characters");
  }
  const hasSequencePreset = Object.hasOwn(input, "sequencePreset");
  const sequencePreset = hasSequencePreset ? input.sequencePreset : null;
  if (hasSequencePreset && sequencePreset !== TALK_TO_CAMERA_PRESET) {
    throw new Error(`unsupported input.sequencePreset ${sequencePreset}`);
  }
  let totalFrames = 0;
  let entries;
  if (sequencePreset === TALK_TO_CAMERA_PRESET) {
    if (input.sequence !== undefined) {
      throw new Error("input.sequencePreset talk-to-camera cannot be combined with input.sequence");
    }
    const durationFrames = integerInRange(
      input.durationFrames,
      null,
      1,
      MAX_OUTPUT_FRAMES,
      "input.durationFrames",
    );
    const pose = registry.byId.get("neutral-listening");
    if (!pose) throw new Error("talk-to-camera requires the registered neutral-listening pose");
    const holdFrames = durationFrames - pose.recipe.durationFrames;
    if (holdFrames < 0) throw new Error("talk-to-camera audio is shorter than its neutral body frame");
    totalFrames = durationFrames;
    entries = [{
      index: 0,
      poseId: pose.id,
      pose,
      holdFrames,
      gapFrames: 0,
      outputFrames: durationFrames,
    }];
  } else {
    if (input.durationFrames !== undefined) {
      throw new Error("input.durationFrames is runtime-derived and requires sequencePreset talk-to-camera");
    }
    if (!Array.isArray(input.sequence) || input.sequence.length < 1 || input.sequence.length > MAX_ACTIONS) {
      throw new Error(`input.sequence must contain 1-${MAX_ACTIONS} actions`);
    }
    entries = input.sequence.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`sequence[${index}] must be an object`);
      }
      exactKeys(entry, ["poseId", "holdFrames", "gapFrames", "anchor"], `sequence[${index}]`);
      const pose = registry.byId.get(entry.poseId);
      if (!pose) throw new Error(`sequence[${index}] references unknown pose ${entry.poseId}`);
      const holdFrames = integerInRange(entry.holdFrames, 12, 0, 120, `sequence[${index}].holdFrames`);
      const gapFrames = integerInRange(entry.gapFrames, 0, 0, 24, `sequence[${index}].gapFrames`);
      if (index === input.sequence.length - 1 && gapFrames !== 0) {
        throw new Error("the final sequence entry must use gapFrames: 0");
      }
      const startFrame = totalFrames;
      const outputFrames = pose.recipe.durationFrames + holdFrames + gapFrames;
      totalFrames += outputFrames;
      return {
        index,
        poseId: pose.id,
        pose,
        holdFrames,
        gapFrames,
        outputFrames,
        startFrame,
        anchor: entry.anchor ?? null,
      };
    });
  }
  if (totalFrames > MAX_OUTPUT_FRAMES) {
    throw new Error(`sequence produces ${totalFrames} frames; maximum is ${MAX_OUTPUT_FRAMES}`);
  }
  let audioFile = null;
  let backgroundId = null;
  if (input.audioFile !== undefined || input.backgroundId !== undefined) {
    if (typeof input.audioFile !== "string"
      || input.audioFile.length < 1
      || input.audioFile.length > 160
      || path.basename(input.audioFile) !== input.audioFile) {
      throw new Error("input.audioFile must name a file directly inside the run folder");
    }
    if (!RUN_ID.test(input.backgroundId ?? "")) {
      throw new Error("input.backgroundId must name a registered background");
    }
    audioFile = input.audioFile;
    backgroundId = input.backgroundId;
  }
  if (input.lipSync !== undefined && (!audioFile || !backgroundId)) {
    throw new Error("input.lipSync requires an audio-backed sequence");
  }
  if (input.transcript !== undefined && !audioFile) {
    throw new Error("input.transcript requires staged audio");
  }
  if (sequencePreset === TALK_TO_CAMERA_PRESET) {
    if (!audioFile || !backgroundId) {
      throw new Error("talk-to-camera requires staged audio and a registered background");
    }
    if (!input.lipSync || typeof input.lipSync !== "object" || Array.isArray(input.lipSync)) {
      throw new Error("talk-to-camera requires a validated lip-sync cue track");
    }
  }
  if (audioFile && !input.transcript) {
    throw new Error("every audio-backed run requires generated transcript evidence");
  }
  if (audioFile && sequencePreset !== TALK_TO_CAMERA_PRESET) {
    if (!SHA256.test(input.planningTranscriptSha256 ?? "")
      || input.planningTranscriptSha256 !== input.transcript.sha256) {
      throw new Error("audio-backed gesture sequence is stale or missing planningTranscriptSha256");
    }
  }
  return {
    title: input.title.trim(),
    entries,
    totalFrames,
    durationSeconds: totalFrames / 24,
    sequencePreset,
    audioFile,
    backgroundId,
    lipSync: input.lipSync ?? null,
    transcript: input.transcript ?? null,
    planningTranscriptSha256: input.planningTranscriptSha256 ?? null,
  };
}

function validateTranscriptAnchor(anchor, transcript, expectedFrame, context) {
  if (!anchor || typeof anchor !== "object" || Array.isArray(anchor)) {
    throw new Error(`${context} requires a transcript word anchor`);
  }
  exactKeys(anchor, ["wordId", "label", "frame"], `${context}.anchor`);
  const word = transcript.words.find(({ id }) => id === anchor.wordId);
  if (!word) throw new Error(`${context}.anchor references unknown transcript word ${anchor.wordId}`);
  if (typeof anchor.label !== "string" || anchor.label.trim().length < 1 || anchor.label.length > 120) {
    throw new Error(`${context}.anchor.label must contain 1-120 characters`);
  }
  const wordFrame = Math.round((word.startMs / 1000) * 24);
  if (anchor.frame !== expectedFrame || anchor.frame !== wordFrame) {
    throw new Error(`${context}.anchor.frame must equal transcript word ${anchor.wordId} at frame ${wordFrame}`);
  }
  if (!anchor.label.toLocaleLowerCase("en-US").includes(word.normalized)) {
    throw new Error(`${context}.anchor.label must include transcript word ${word.text}`);
  }
  return { wordId: word.id, label: anchor.label.trim(), frame: anchor.frame };
}

async function validateLipSync({ config, root, runDirectory, audioPath, totalFrames }) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("input.lipSync must be an object");
  }
  exactKeys(config, [
    "engine",
    "engineVersion",
    "execution",
    "cueSource",
    "cueFile",
    "cueSha256",
    "sourceAudioSha256",
    "fps",
    "filterSingleFrames",
    "engineManifestSha256",
    "engineModuleSha256",
  ], "input.lipSync");
  if (config.engine !== "cherry-lip-sync" || config.engineVersion !== "0.1.0") {
    throw new Error("input.lipSync must use cherry-lip-sync 0.1.0");
  }
  if (typeof config.cueFile !== "string"
    || config.cueFile.length < 1
    || config.cueFile.length > 160
    || path.basename(config.cueFile) !== config.cueFile) {
    throw new Error("input.lipSync.cueFile must name a TSV directly inside the run folder");
  }
  const cuePath = path.resolve(runDirectory, config.cueFile);
  if (path.dirname(cuePath) !== path.resolve(runDirectory) || !(await exists(cuePath))) {
    throw new Error(`lip-sync cue file is missing: ${config.cueFile}`);
  }
  if (!/^[a-f0-9]{64}$/.test(config.cueSha256 ?? "") || await sha256(cuePath) !== config.cueSha256) {
    throw new Error("lip-sync cue checksum does not match input.lipSync");
  }
  if (!/^[a-f0-9]{64}$/.test(config.sourceAudioSha256 ?? "")
    || await sha256(audioPath) !== config.sourceAudioSha256) {
    throw new Error("lip-sync source audio checksum does not match the staged audio");
  }
  if (config.fps !== 24) throw new Error("input.lipSync.fps must be 24");
  if (!["bundled-wasi-engine", "supplied-tsv"].includes(config.cueSource)) {
    throw new Error("input.lipSync.cueSource is unsupported");
  }
  if (config.cueSource === "bundled-wasi-engine") {
    if (config.execution !== "node-wasi-preview1" || config.filterSingleFrames !== true) {
      throw new Error("bundled Cherry cues must record the WASI --filter execution");
    }
    const engine = await loadCherryEngine(root);
    if (config.engineManifestSha256 !== engine.manifestSha256
      || config.engineModuleSha256 !== engine.moduleSha256) {
      throw new Error("bundled Cherry engine provenance is stale");
    }
  } else {
    if (config.execution !== "external" || config.filterSingleFrames !== null) {
      throw new Error("supplied Cherry cues must record external/unknown filtering provenance");
    }
    if (config.engineManifestSha256 !== undefined || config.engineModuleSha256 !== undefined) {
      throw new Error("supplied Cherry cues must not claim the bundled engine hashes");
    }
  }
  const parsed = parseCherryTsv(await fs.readFile(cuePath, "utf8"), {
    fps: 24,
    totalFrames,
  });
  return {
    ...parsed,
    cuePath,
    receipt: {
      engine: config.engine,
      engineVersion: config.engineVersion,
      cueFile: config.cueFile,
      cueSha256: config.cueSha256,
      cueCount: parsed.cues.length,
      cueSource: config.cueSource,
      execution: config.execution,
      sourceAudioSha256: config.sourceAudioSha256,
      fps: config.fps,
      filterSingleFrames: config.filterSingleFrames,
      ...(config.cueSource === "bundled-wasi-engine" ? {
        engineManifestSha256: config.engineManifestSha256,
        engineModuleSha256: config.engineModuleSha256,
      } : {}),
      mappingId: parsed.mappingId,
      mapping: parsed.mapping,
      usedMouthDrawings: Object.keys(parsed.histogram).sort(),
      frameHistogram: parsed.histogram,
      forcedFinalRestFrame: parsed.forcedFinalRestFrame,
    },
  };
}

async function validateRun({ root, runDirectory }) {
  const inputPath = path.join(runDirectory, "input.json");
  if (!(await exists(inputPath))) throw new Error(`missing run input: ${inputPath}`);
  const manifestPath = path.join(root, "rig-v2", "runtime.json");
  const manifest = await loadManifest(manifestPath);
  const registry = await loadPoseRegistry(root, manifest);
  const input = await readJson(inputPath);
  if (input.schemaVersion === PERFORMANCE_SCHEMA) {
    const audioPath = path.resolve(runDirectory, input.audioFile ?? "");
    if (path.dirname(audioPath) !== path.resolve(runDirectory)) {
      throw new Error("performance input.audioFile must name a file directly inside the run folder");
    }
    if (!input.audioFile || !(await exists(audioPath))) {
      throw new Error(`performance audio is missing: ${input.audioFile || "(unset)"}`);
    }
    const audioProbe = probeMedia(audioPath);
    const audioStream = audioProbe.streams?.find((stream) => stream.codec_type === "audio");
    const audioDurationSeconds = measuredAudioDuration(audioProbe);
    if (!audioStream) throw new Error("the staged performance file has no audio stream");
    if (!(audioDurationSeconds > 0)) throw new Error("the staged performance audio duration could not be measured");
    if (!input.transcript) throw new Error("performance input requires generated transcript evidence");
    const transcription = await validateTranscriptEvidence({
      root,
      runDirectory,
      audioPath,
      config: input.transcript,
    });
    const assets = await readJson(path.join(root, "assets.json"));
    const packetRegistry = await loadMotionPacketRegistry({ root, poseRegistry: registry });
    const timeline = validatePerformancePlan(input, {
      packetRegistry,
      audioDurationSeconds,
      defaultBackgroundId: assets.defaultBackgroundId,
      transcript: transcription.transcript,
    });
    const background = (assets.backgrounds ?? []).find(({ id }) => id === timeline.backgroundId);
    if (!background) throw new Error(`unknown registered background ${timeline.backgroundId}`);
    const backgroundPath = path.resolve(root, background.path);
    if (await sha256(backgroundPath) !== background.sha256) {
      throw new Error(`registered background checksum mismatch: ${background.id}`);
    }
    const usedPoseIds = new Set([packetRegistry.neutralPacket.path.hold.poseId]);
    for (const event of timeline.events) {
      for (const source of event.packet.sources) usedPoseIds.add(source.poseId);
    }
    const receipt = {
      schemaVersion: 2,
      status: "pass",
      validatedAt: new Date().toISOString(),
      mode: "body-language-performance",
      formatVersion: (await readJson(path.join(root, "format.json"))).version,
      inputSha256: await sha256(inputPath),
      audio: {
        file: input.audioFile,
        sha256: await sha256(audioPath),
        codec: audioStream.codec_name,
        durationSeconds: audioDurationSeconds,
      },
      transcript: transcription.receipt,
      background: {
        id: background.id,
        path: background.path,
        sha256: background.sha256,
        cameraMotion: false,
      },
      sourceXstageSha256: manifest.source.sha256,
      poseRegistrySha256: registry.sha256,
      motionPacketRegistrySha256: packetRegistry.sha256,
      artistRenderedFramesUsed: false,
      totalFrames: timeline.durationFrames,
      durationSeconds: timeline.durationSeconds,
      events: timeline.events.map((event) => ({
        index: event.index,
        packetId: event.packetId,
        startFrame: event.startFrame,
        apexFrame: event.holdStartFrame,
        holdFrames: event.holdFrames,
        endFrameExclusive: event.endFrameExclusive,
        anchor: event.anchor,
        intent: event.intent,
        rationale: event.rationale,
      })),
      poses: [...usedPoseIds].map((poseId) => {
        const pose = registry.byId.get(poseId);
        return {
          poseId,
          recipeSha256: pose.poseRuntime.recipeSha256,
          fileSha256: pose.sha256,
        };
      }),
      providerCalls: 0,
      estimatedCost: "$0",
    };
    await writeJson(path.join(runDirectory, "validation-receipt.json"), receipt);
    return {
      mode: "performance",
      input,
      inputPath,
      audioPath,
      audioProbe,
      transcription,
      manifest,
      manifestPath,
      registry,
      packetRegistry,
      timeline,
      background,
      backgroundPath,
      receipt,
    };
  }
  if (input.schemaVersion === MULTI_SHOT_SCHEMA) {
    const audioPath = path.resolve(runDirectory, input.audioFile ?? "");
    if (path.dirname(audioPath) !== path.resolve(runDirectory)) {
      throw new Error("multi-shot input.audioFile must name a file directly inside the run folder");
    }
    if (!input.audioFile || !(await exists(audioPath))) {
      throw new Error(`multi-shot audio is missing: ${input.audioFile || "(unset)"}`);
    }
    const audioProbe = probeMedia(audioPath);
    const audioStream = audioProbe.streams?.find((stream) => stream.codec_type === "audio");
    const audioDurationSeconds = measuredAudioDuration(audioProbe);
    if (!audioStream) throw new Error("the staged multi-shot file has no audio stream");
    if (!(audioDurationSeconds > 0)) throw new Error("the staged multi-shot audio duration could not be measured");
    if (!input.transcript) throw new Error("multi-shot input requires generated transcript evidence");
    const transcription = await validateTranscriptEvidence({
      root,
      runDirectory,
      audioPath,
      config: input.transcript,
    });
    const assets = await readJson(path.join(root, "assets.json"));
    const timeline = validateMultiShotPlan(input, {
      audioDurationSeconds,
      defaultBackgroundId: assets.defaultBackgroundId,
      assets,
      poseRegistry: registry,
      transcript: transcription.transcript,
    });

    const cueFile = path.join(runDirectory, "cherry-lipsync.tsv");
    let lipSync = null;
    if (await exists(cueFile)) {
      const cueSha256 = await sha256(cueFile);
      const cherry = await loadCherryEngine(root);
      const parsed = parseCherryTsv(await fs.readFile(cueFile, "utf8"), {
        totalFrames: timeline.totalFrames,
        fps: 24,
      });
      lipSync = {
        cueFile: "cherry-lipsync.tsv",
        cueSha256,
        frameDrawings: parsed.frameDrawings,
        receipt: {
          engine: "cherry-lip-sync",
          engineVersion: cherry.manifest.engine.version,
          execution: "node-wasi-preview1",
          cueSource: "bundled-wasi-engine",
          cueFile: "cherry-lipsync.tsv",
          cueSha256,
          sourceAudioSha256: await sha256(audioPath),
          fps: 24,
        },
      };
    }

    const receipt = {
      schemaVersion: 2,
      status: "pass",
      mode: "multi-shot-timeline",
      validatedAt: new Date().toISOString(),
      formatVersion: (await readJson(path.join(root, "format.json"))).version,
      inputSha256: await sha256(inputPath),
      sourceXstageSha256: manifest.source.sha256,
      poseRegistrySha256: registry.sha256,
      artistRenderedFramesUsed: false,
      totalFrames: timeline.totalFrames,
      durationSeconds: timeline.durationSeconds,
      audio: {
        file: input.audioFile,
        sha256: await sha256(audioPath),
        codec: audioStream.codec_name,
        durationSeconds: audioDurationSeconds,
      },
      transcript: transcription.receipt,
      ...(lipSync ? { lipSync: lipSync.receipt } : {}),
      shots: timeline.shots,
      providerCalls: 0,
      estimatedCost: "$0",
    };
    await writeJson(path.join(runDirectory, "validation-receipt.json"), receipt);
    return {
      mode: "multi-shot",
      input,
      inputPath,
      audioPath,
      audioProbe,
      transcription,
      manifest,
      manifestPath,
      registry,
      timeline,
      assets,
      lipSync,
      receipt,
    };
  }
  const timeline = validateInput(input, registry);
  if (timeline.audioFile) {
    const audioPath = path.resolve(runDirectory, timeline.audioFile);
    if (path.dirname(audioPath) !== path.resolve(runDirectory) || !(await exists(audioPath))) {
      throw new Error(`audio-backed sequence is missing staged audio ${timeline.audioFile}`);
    }
    const audioProbe = probeMedia(audioPath);
    const audioStream = audioProbe.streams?.find((stream) => stream.codec_type === "audio");
    const audioDurationSeconds = measuredAudioDuration(audioProbe);
    if (!audioStream || !(audioDurationSeconds > 0)) {
      throw new Error("the staged sequence audio is missing or has no measurable duration");
    }
    const expectedFrames = Math.max(1, Math.round(audioDurationSeconds * 24));
    if (timeline.totalFrames !== expectedFrames) {
      throw new Error(
        `audio-backed sequence produces ${timeline.totalFrames} frames; measured audio requires ${expectedFrames}`,
      );
    }
    const assets = await readJson(path.join(root, "assets.json"));
    const background = (assets.backgrounds ?? []).find(({ id }) => id === timeline.backgroundId);
    if (!background) throw new Error(`unknown registered background ${timeline.backgroundId}`);
    const backgroundPath = path.resolve(root, background.path);
    if (await sha256(backgroundPath) !== background.sha256) {
      throw new Error(`registered background checksum mismatch: ${background.id}`);
    }
    const lipSync = timeline.lipSync
      ? await validateLipSync({
        config: timeline.lipSync,
        root,
        runDirectory,
        audioPath,
        totalFrames: timeline.totalFrames,
      })
      : null;
    if (!timeline.transcript) throw new Error("audio-backed sequence requires generated transcript evidence");
    const transcription = await validateTranscriptEvidence({
      root,
      runDirectory,
      audioPath,
      config: timeline.transcript,
    });
    if (!timeline.sequencePreset) {
      for (const entry of timeline.entries) {
        if (entry.poseId === "neutral-listening") continue;
        entry.anchor = validateTranscriptAnchor(
          entry.anchor,
          transcription.transcript,
          entry.startFrame,
          `sequence[${entry.index}]`,
        );
      }
    }
    const receipt = {
      schemaVersion: 2,
      status: "pass",
      mode: "audio-backed-sequence",
      validatedAt: new Date().toISOString(),
      formatVersion: (await readJson(path.join(root, "format.json"))).version,
      inputSha256: await sha256(inputPath),
      sourceXstageSha256: manifest.source.sha256,
      poseRegistrySha256: registry.sha256,
      artistRenderedFramesUsed: false,
      totalFrames: timeline.totalFrames,
      durationSeconds: timeline.durationSeconds,
      audio: {
        file: timeline.audioFile,
        sha256: await sha256(audioPath),
        codec: audioStream.codec_name,
        durationSeconds: audioDurationSeconds,
      },
      background: {
        id: background.id,
        path: background.path,
        sha256: background.sha256,
        cameraMotion: false,
      },
      ...(lipSync ? { lipSync: lipSync.receipt } : {}),
      transcript: transcription.receipt,
      ...(timeline.sequencePreset ? { sequencePreset: timeline.sequencePreset } : {}),
      poses: timeline.entries.map(({ index, poseId, pose, holdFrames, gapFrames }) => ({
        index,
        poseId,
        recipeSha256: pose.poseRuntime.recipeSha256,
        fileSha256: pose.sha256,
        recipeFrames: pose.recipe.durationFrames,
        holdFrames,
        gapFrames,
        ...(timeline.entries[index].anchor ? { anchor: timeline.entries[index].anchor } : {}),
      })),
      providerCalls: 0,
      estimatedCost: "$0",
    };
    await writeJson(path.join(runDirectory, "validation-receipt.json"), receipt);
    return {
      mode: "audio-sequence",
      input,
      inputPath,
      audioPath,
      audioProbe,
      manifest,
      manifestPath,
      registry,
      timeline,
      background,
      backgroundPath,
      lipSync,
      transcription,
      receipt,
    };
  }
  const receipt = {
    schemaVersion: 1,
    status: "pass",
    validatedAt: new Date().toISOString(),
    formatVersion: (await readJson(path.join(root, "format.json"))).version,
    inputSha256: await sha256(inputPath),
    sourceXstageSha256: manifest.source.sha256,
    poseRegistrySha256: registry.sha256,
    artistRenderedFramesUsed: false,
    totalFrames: timeline.totalFrames,
    durationSeconds: timeline.durationSeconds,
    poses: timeline.entries.map(({ index, poseId, pose, holdFrames, gapFrames }) => ({
      index,
      poseId,
      recipeSha256: pose.poseRuntime.recipeSha256,
      fileSha256: pose.sha256,
      holdFrames,
      gapFrames,
    })),
    providerCalls: 0,
    estimatedCost: "$0",
  };
  await writeJson(path.join(runDirectory, "validation-receipt.json"), receipt);
  return { input, inputPath, manifest, manifestPath, registry, timeline, receipt };
}

export {
  MAX_OUTPUT_FRAMES,
  execute,
  exists,
  loadPoseRegistry,
  measuredAudioDuration,
  parseArgs,
  probeMedia,
  readJson,
  requireRunId,
  resolveRunDirectory,
  sha256,
  validateInput,
  validateLipSync,
  validateRun,
  writeJson,
};
