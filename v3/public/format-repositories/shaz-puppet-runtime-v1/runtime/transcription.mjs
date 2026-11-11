import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ENGINE_VERSION = "1.9.2";
const TRANSCRIPT_SCHEMA = "shaz-word-transcript-v1";
const VENDOR_RELATIVE = path.join("vendor", "whisper.cpp", `v${ENGINE_VERSION}`);
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_AUDIO_BYTES = 512 * 1024 * 1024;
const MAX_TRANSCRIPTION_SECONDS = 75;
const AUDIO_EXTENSIONS = new Set([
  ".aac", ".flac", ".m4a", ".mkv", ".mov", ".mp3", ".mp4", ".oga", ".ogg", ".opus", ".wav", ".webm",
]);

function execute(program, args, { cwd, timeoutMs = 300_000 } = {}) {
  const result = spawnSync(program, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${program} failed:\n${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await fs.rename(temporary, file);
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

function exactKeys(value, allowed, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) throw new Error(`${context} contains unsupported key(s): ${extras.join(", ")}`);
}

function directFile(value, context) {
  if (typeof value !== "string"
    || value.length < 1
    || value.length > 160
    || path.basename(value) !== value) {
    throw new Error(`${context} must name a file directly inside the run folder`);
  }
  return value;
}

async function verifyFile(file, record, context) {
  const stat = await fs.lstat(file).catch(() => null);
  if (!stat?.isFile()) throw new Error(`missing ${context}: ${file}`);
  if (Number.isInteger(record.bytes) && stat.size !== record.bytes) {
    throw new Error(`${context} byte count mismatch`);
  }
  if (!SHA256.test(record.sha256 ?? "") || await sha256(file) !== record.sha256) {
    throw new Error(`${context} checksum mismatch`);
  }
}

async function assertNoQuarantine(file, context) {
  const quarantine = spawnSync("/usr/bin/xattr", ["-p", "com.apple.quarantine", file], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (quarantine.status === 0) {
    throw new Error(`${context} is quarantined; refusing to execute it`);
  }
}

function assertArm64MachO(file, context) {
  const description = execute("/usr/bin/file", ["-b", file], { timeoutMs: 10_000 }).stdout;
  if (!/Mach-O 64-bit executable arm64/.test(description)) {
    throw new Error(`${context} must be an arm64 Mach-O executable`);
  }
}

async function assertLocalAudioFile(audioPath) {
  const extension = path.extname(audioPath).toLowerCase();
  if (!AUDIO_EXTENSIONS.has(extension)) {
    throw new Error(`unsupported transcription audio extension ${extension || "(none)"}`);
  }
  const stat = await fs.lstat(audioPath).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new Error("transcription audio must be a regular local file, not a link");
  }
  if (stat.size < 1 || stat.size > MAX_AUDIO_BYTES) {
    throw new Error(`transcription audio must contain 1-${MAX_AUDIO_BYTES} bytes`);
  }
  return stat;
}

function probeLocalAudio(audioPath) {
  const probe = JSON.parse(execute("ffprobe", [
    "-v", "error",
    "-protocol_whitelist", "file,pipe",
    "-protocol_blacklist", "http,https,tcp,tls,udp,rtp",
    "-show_entries", "format=duration:stream=codec_type,codec_name",
    "-of", "json",
    audioPath,
  ], { timeoutMs: 30_000 }).stdout);
  const audioStream = probe.streams?.find(({ codec_type }) => codec_type === "audio");
  const durationSeconds = Number(probe.format?.duration ?? 0);
  if (!audioStream || !(durationSeconds > 0)) {
    throw new Error("transcription input has no measurable audio stream");
  }
  if (durationSeconds > MAX_TRANSCRIPTION_SECONDS + (1 / 24)) {
    throw new Error(`transcription audio exceeds the ${MAX_TRANSCRIPTION_SECONDS}-second Format limit`);
  }
  return { audioStream, durationSeconds };
}

async function validateTranscriptionAudio(audioPath) {
  await assertLocalAudioFile(audioPath);
  return probeLocalAudio(audioPath);
}

async function canonicalPathIdentity(file) {
  const absolute = path.resolve(file);
  const existing = await fs.realpath(absolute).catch(() => null);
  const canonical = existing ?? path.join(
    await fs.realpath(path.dirname(absolute)).catch(() => path.dirname(absolute)),
    path.basename(absolute),
  );
  return process.platform === "darwin"
    ? canonical.normalize("NFD").toLocaleLowerCase("en-US")
    : canonical;
}

async function loadWhisperVendor(root) {
  const vendorDirectory = path.join(root, VENDOR_RELATIVE);
  const manifestPath = path.join(vendorDirectory, "VENDOR-MANIFEST.json");
  const manifest = await readJson(manifestPath);
  exactKeys(manifest, [
    "schemaVersion",
    "engine",
    "version",
    "supportedPlatform",
    "supportedArchitecture",
    "nativeExecutableIncluded",
    "source",
    "model",
    "build",
    "licenses",
  ], "Whisper vendor manifest");
  if (manifest.schemaVersion !== 1
    || manifest.engine !== "whisper.cpp"
    || manifest.version !== ENGINE_VERSION
    || manifest.nativeExecutableIncluded !== false) {
    throw new Error("unsupported Whisper vendor manifest");
  }
  const sourcePath = path.join(vendorDirectory, manifest.source.path);
  const modelPath = path.join(vendorDirectory, manifest.model.path);
  const planPath = path.join(vendorDirectory, manifest.build.planPath);
  await verifyFile(sourcePath, manifest.source, "Whisper source archive");
  await verifyFile(modelPath, manifest.model, "Whisper model");
  if (!SHA256.test(manifest.build.planSha256 ?? "")
    || await sha256(planPath) !== manifest.build.planSha256) {
    throw new Error("Whisper build plan checksum mismatch");
  }
  for (const license of manifest.licenses ?? []) {
    await verifyFile(path.join(vendorDirectory, license.path), license, `Whisper license ${license.path}`);
  }
  return {
    vendorDirectory,
    manifestPath,
    manifestSha256: await sha256(manifestPath),
    manifest,
    sourcePath,
    modelPath,
    planPath,
    plan: await readJson(planPath),
  };
}

function compilerPath(name) {
  return execute("/usr/bin/xcrun", ["--find", name]).stdout.trim();
}

function compilerVersion(compiler) {
  return execute(compiler, ["--version"]).stdout.split("\n")[0].trim();
}

async function validCachedBinary(cacheDirectory, vendor) {
  const binaryPath = path.join(cacheDirectory, "whisper-cli");
  const receiptPath = path.join(cacheDirectory, "build-receipt.json");
  try {
    const [binaryStat, receiptStat] = await Promise.all([
      fs.lstat(binaryPath),
      fs.lstat(receiptPath),
    ]);
    if (!binaryStat.isFile() || binaryStat.isSymbolicLink()
      || !receiptStat.isFile() || receiptStat.isSymbolicLink()) return null;
    const receipt = await readJson(receiptPath);
    if (receipt.schemaVersion !== 1
      || receipt.engine !== "whisper.cpp"
      || receipt.engineVersion !== ENGINE_VERSION
      || receipt.sourceArchiveSha256 !== vendor.manifest.source.sha256
      || receipt.buildPlanSha256 !== vendor.manifest.build.planSha256
      || !SHA256.test(receipt.binarySha256 ?? "")
      || await sha256(binaryPath) !== receipt.binarySha256) {
      return null;
    }
    await assertNoQuarantine(binaryPath, "cached Whisper helper");
    assertArm64MachO(binaryPath, "cached Whisper helper");
    const version = execute(binaryPath, ["--version"]);
    if (!`${version.stdout}${version.stderr}`.includes(ENGINE_VERSION)) return null;
    return { binaryPath, receiptPath, receipt };
  } catch {
    return null;
  }
}

function planArguments({ group, sourceRoot, source, object, minimumMacosVersion, sdkPath }) {
  const isC = path.extname(source) === ".c";
  return [
    "-O3",
    "-DNDEBUG",
    "-arch", "arm64",
    `-mmacosx-version-min=${minimumMacosVersion}`,
    "-isysroot", sdkPath,
    `-std=${isC ? "gnu11" : "gnu++17"}`,
    ...group.defines.map((value) => `-D${value}`),
    ...group.includes.flatMap((value) => ["-I", path.join(sourceRoot, value)]),
    "-c", path.join(sourceRoot, source),
    "-o", object,
  ];
}

async function buildWhisperBinary({ vendor, cacheRoot }) {
  if (process.platform !== vendor.manifest.supportedPlatform
    || process.arch !== vendor.manifest.supportedArchitecture) {
    throw new Error(
      `local transcription supports ${vendor.manifest.supportedPlatform}/${vendor.manifest.supportedArchitecture}; got ${process.platform}/${process.arch}`,
    );
  }
  const plan = vendor.plan;
  exactKeys(plan, [
    "schemaVersion",
    "platform",
    "architecture",
    "minimumMacosVersion",
    "sourceDirectory",
    "groups",
    "link",
  ], "Whisper build plan");
  if (plan.schemaVersion !== 1
    || plan.platform !== process.platform
    || plan.architecture !== process.arch
    || !Array.isArray(plan.groups)
    || plan.groups.length < 1) {
    throw new Error("unsupported Whisper build plan");
  }
  const cacheRootStat = await fs.lstat(cacheRoot).catch(() => null);
  if (cacheRootStat && (!cacheRootStat.isDirectory() || cacheRootStat.isSymbolicLink())) {
    throw new Error("Whisper cache root must be a real directory, not a symbolic link");
  }
  if (!cacheRootStat) {
    await fs.mkdir(cacheRoot, { recursive: true });
    const createdCacheRoot = await fs.lstat(cacheRoot);
    if (!createdCacheRoot.isDirectory() || createdCacheRoot.isSymbolicLink()) {
      throw new Error("Whisper cache root must be a real directory, not a symbolic link");
    }
  }
  const cacheDirectory = path.join(cacheRoot, `whisper.cpp-${ENGINE_VERSION}-${process.platform}-${process.arch}`);
  const cacheStat = await fs.lstat(cacheDirectory).catch(() => null);
  if (cacheStat && (!cacheStat.isDirectory() || cacheStat.isSymbolicLink())) {
    throw new Error("Whisper cache directory must be a real directory, not a symbolic link");
  }
  const cached = await validCachedBinary(cacheDirectory, vendor);
  if (cached) return { ...cached, vendor };
  await fs.rm(cacheDirectory, { recursive: true, force: true });

  const buildDirectory = `${cacheDirectory}.building-${process.pid}-${Date.now()}`;
  const sourceRoot = path.join(buildDirectory, "source");
  const objectRoot = path.join(buildDirectory, "objects");
  const binaryPath = path.join(buildDirectory, "whisper-cli");
  await fs.rm(buildDirectory, { recursive: true, force: true });
  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.mkdir(objectRoot, { recursive: true });
  try {
    execute("/usr/bin/tar", [
      "-xzf", vendor.sourcePath,
      "--strip-components=1",
      "-C", sourceRoot,
    ]);
    const cCompiler = compilerPath("clang");
    const cppCompiler = compilerPath("clang++");
    const sdkPath = execute("/usr/bin/xcrun", ["--sdk", "macosx", "--show-sdk-path"]).stdout.trim();
    const objects = [];
    let sourceIndex = 0;
    for (const group of plan.groups) {
      exactKeys(group, ["id", "defines", "includes", "sources"], `Whisper build group ${group.id ?? "?"}`);
      if (!Array.isArray(group.defines)
        || !Array.isArray(group.includes)
        || !Array.isArray(group.sources)) {
        throw new Error(`Whisper build group ${group.id} is invalid`);
      }
      for (const source of group.sources) {
        if (path.isAbsolute(source) || source.split("/").includes("..")) {
          throw new Error(`Whisper build source path is unsafe: ${source}`);
        }
        const absoluteSource = path.join(sourceRoot, source);
        const object = path.join(
          objectRoot,
          `${String(sourceIndex).padStart(3, "0")}-${path.basename(source)}.o`,
        );
        sourceIndex += 1;
        const compiler = path.extname(source) === ".c" ? cCompiler : cppCompiler;
        execute(compiler, planArguments({
          group,
          sourceRoot,
          source,
          object,
          minimumMacosVersion: plan.minimumMacosVersion,
          sdkPath,
        }));
        objects.push(object);
      }
    }
    execute(cppCompiler, [
      "-O3",
      "-arch", "arm64",
      `-mmacosx-version-min=${plan.minimumMacosVersion}`,
      "-isysroot", sdkPath,
      ...objects,
      ...plan.link.libraries.flatMap((value) => [`-l${value}`]),
      ...plan.link.frameworks.flatMap((value) => ["-framework", value]),
      "-o", binaryPath,
    ]);
    await fs.chmod(binaryPath, 0o755);
    await assertNoQuarantine(binaryPath, "locally compiled Whisper helper");
    assertArm64MachO(binaryPath, "locally compiled Whisper helper");
    const version = execute(binaryPath, ["--version"]);
    if (!`${version.stdout}${version.stderr}`.includes(ENGINE_VERSION)) {
      throw new Error("locally compiled Whisper helper reports the wrong version");
    }
    const receipt = {
      schemaVersion: 1,
      engine: "whisper.cpp",
      engineVersion: ENGINE_VERSION,
      execution: "locally-compiled-darwin-arm64",
      sourceArchiveSha256: vendor.manifest.source.sha256,
      buildPlanSha256: vendor.manifest.build.planSha256,
      binarySha256: await sha256(binaryPath),
      compilerVersion: compilerVersion(cppCompiler),
      minimumMacosVersion: plan.minimumMacosVersion,
      acceleration: "Accelerate",
    };
    await writeJson(path.join(buildDirectory, "build-receipt.json"), receipt);
    await fs.rm(sourceRoot, { recursive: true, force: true });
    await fs.rm(objectRoot, { recursive: true, force: true });
    await fs.mkdir(path.dirname(cacheDirectory), { recursive: true });
    const winner = await validCachedBinary(cacheDirectory, vendor);
    if (winner) {
      await fs.rm(buildDirectory, { recursive: true, force: true });
      return { ...winner, vendor };
    }
    try {
      await fs.rename(buildDirectory, cacheDirectory);
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY"].includes(error?.code)) throw error;
      const concurrentWinner = await validCachedBinary(cacheDirectory, vendor);
      if (!concurrentWinner) throw error;
      await fs.rm(buildDirectory, { recursive: true, force: true });
      return { ...concurrentWinner, vendor };
    }
    return {
      binaryPath: path.join(cacheDirectory, "whisper-cli"),
      receiptPath: path.join(cacheDirectory, "build-receipt.json"),
      receipt,
      vendor,
    };
  } catch (error) {
    await fs.rm(buildDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function ensureWhisperEngine({ root, cacheRoot = path.join(root, ".runtime-cache") }) {
  const vendor = await loadWhisperVendor(root);
  return buildWhisperBinary({ vendor, cacheRoot });
}

function punctuationOnly(value) {
  return /^[\p{P}\p{S}]+$/u.test(value);
}

function rounded(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function wordsFromTokens(tokens, nextId) {
  const words = [];
  for (const token of tokens ?? []) {
    const raw = token.text ?? "";
    if (!raw || raw.startsWith("[")) continue;
    const value = raw.trim();
    if (!value) continue;
    const startMs = Number(token.offsets?.from);
    const endMs = Number(token.offsets?.to);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    const startsWord = /^\s/u.test(raw) || words.length === 0;
    const attach = words.length > 0 && (!startsWord || punctuationOnly(value));
    if (attach) {
      const word = words.at(-1);
      word.text += value;
      word.normalized = word.text.toLocaleLowerCase("en-US").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      word.endMs = Math.max(word.endMs, endMs);
      if (!punctuationOnly(value) && Number.isFinite(token.p)) word.confidences.push(token.p);
      continue;
    }
    words.push({
      id: `w${String(nextId + words.length).padStart(4, "0")}`,
      text: value,
      normalized: value.toLocaleLowerCase("en-US").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
      startMs: Math.max(0, Math.round(startMs)),
      endMs: Math.max(Math.round(startMs), Math.round(endMs)),
      confidences: Number.isFinite(token.p) ? [token.p] : [],
    });
  }
  return words.map(({ confidences, ...word }) => ({
    ...word,
    confidence: confidences.length > 0
      ? rounded(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
      : null,
  }));
}

function canonicalTranscript(raw, { vendor, sourceAudioSha256, canonicalPcmSha256, durationMs }) {
  if (!Array.isArray(raw.transcription)) throw new Error("Whisper output has no transcription array");
  const words = [];
  const segments = [];
  for (const [segmentIndex, segment] of raw.transcription.entries()) {
    const segmentWords = wordsFromTokens(segment.tokens, words.length + 1);
    const startMs = Math.min(durationMs, Math.max(0, Math.round(Number(segment.offsets?.from ?? 0))));
    const endMs = Math.min(
      durationMs,
      Math.max(startMs, Math.round(Number(segment.offsets?.to ?? startMs))),
    );
    for (const w of segmentWords) {
      w.startMs = Math.min(endMs, Math.max(0, w.startMs));
      w.endMs = Math.min(endMs, Math.max(w.startMs, w.endMs));
    }
    words.push(...segmentWords);
    segments.push({
      id: `s${String(segmentIndex + 1).padStart(3, "0")}`,
      startMs,
      endMs,
      text: String(segment.text ?? "").trim(),
      firstWordId: segmentWords[0]?.id ?? null,
      lastWordId: segmentWords.at(-1)?.id ?? null,
    });
  }
  const text = segments
    .map(({ text: segmentText }) => segmentText)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
  return {
    schemaVersion: TRANSCRIPT_SCHEMA,
    language: "en",
    text,
    audio: {
      sourceSha256: sourceAudioSha256,
      canonicalPcmSha256,
      durationMs,
      sampleRateHz: 16000,
      channels: 1,
      sampleFormat: "pcm_s16le",
    },
    engine: {
      name: "whisper.cpp",
      version: ENGINE_VERSION,
      sourceArchiveSha256: vendor.manifest.source.sha256,
      buildPlanSha256: vendor.manifest.build.planSha256,
      model: {
        id: vendor.manifest.model.id,
        sha256: vendor.manifest.model.sha256,
        language: vendor.manifest.model.language,
        quantization: vendor.manifest.model.quantization,
      },
      decoding: {
        language: "en",
        threads: 4,
        splitOnWord: true,
        output: "json-full",
      },
    },
    segments,
    words,
  };
}

function transcriptReceiptPath(outputPath) {
  return outputPath.toLowerCase().endsWith(".json")
    ? `${outputPath.slice(0, -5)}.receipt.json`
    : `${outputPath}.receipt.json`;
}

async function generateTranscript({
  root,
  audioPath,
  outputPath,
  receiptPath = transcriptReceiptPath(outputPath),
  cacheRoot,
}) {
  if (!path.isAbsolute(audioPath) || !path.isAbsolute(outputPath) || !path.isAbsolute(receiptPath)) {
    throw new Error("transcription audio, output, and receipt paths must be absolute");
  }
  const identities = await Promise.all(
    [audioPath, outputPath, receiptPath].map(canonicalPathIdentity),
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error("transcription audio, output, and receipt paths must be different files");
  }
  const sourceProbe = await validateTranscriptionAudio(audioPath);
  const sourceAudioSha256 = await sha256(audioPath);
  const engine = await ensureWhisperEngine({ root, ...(cacheRoot ? { cacheRoot } : {}) });
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-transcription-"));
  const canonicalAudio = path.join(scratch, "audio-16khz-mono.wav");
  const rawOutputBase = path.join(scratch, "whisper-output");
  try {
    execute("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-protocol_whitelist", "file,pipe",
      "-protocol_blacklist", "http,https,tcp,tls,udp,rtp",
      "-i", audioPath,
      "-map", "0:a:0", "-vn",
      "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
      "-t", String(MAX_TRANSCRIPTION_SECONDS),
      "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact",
      canonicalAudio,
    ], { timeoutMs: 60_000 });
    const probe = JSON.parse(execute("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "json",
      canonicalAudio,
    ]).stdout);
    const durationMs = Math.round(Number(probe.format?.duration ?? 0) * 1000);
    if (!(durationMs > 0)) throw new Error("transcription audio has no measurable duration");
    if (Math.abs(durationMs - Math.round(sourceProbe.durationSeconds * 1000)) > 1000) {
      throw new Error("canonical transcription audio duration does not match the source");
    }
    execute(engine.binaryPath, [
      "--model", engine.vendor.modelPath,
      "--file", canonicalAudio,
      "--language", "en",
      "--threads", "4",
      "--split-on-word",
      "--output-json-full",
      "--output-file", rawOutputBase,
      "--no-prints",
    ], { timeoutMs: 120_000 });
    if (await sha256(audioPath) !== sourceAudioSha256) {
      throw new Error("transcription audio changed while it was being processed");
    }
    const canonicalPcmSha256 = await sha256(canonicalAudio);
    const transcript = canonicalTranscript(await readJson(`${rawOutputBase}.json`), {
      vendor: engine.vendor,
      sourceAudioSha256,
      canonicalPcmSha256,
      durationMs,
    });
    await writeJson(outputPath, transcript);
    const transcriptSha256 = await sha256(outputPath);
    const receipt = {
      schemaVersion: 1,
      status: "pass",
      generatedAt: new Date().toISOString(),
      transcript: {
        file: path.basename(outputPath),
        sha256: transcriptSha256,
        schemaVersion: TRANSCRIPT_SCHEMA,
        language: transcript.language,
        segmentCount: transcript.segments.length,
        wordCount: transcript.words.length,
      },
      audio: {
        sourceSha256: sourceAudioSha256,
        canonicalPcmSha256,
        durationMs,
      },
      engine: {
        name: "whisper.cpp",
        version: ENGINE_VERSION,
        execution: engine.receipt.execution,
        vendorManifestSha256: engine.vendor.manifestSha256,
        sourceArchiveSha256: engine.vendor.manifest.source.sha256,
        buildPlanSha256: engine.vendor.manifest.build.planSha256,
        binarySha256: engine.receipt.binarySha256,
        compilerVersion: engine.receipt.compilerVersion,
        modelId: engine.vendor.manifest.model.id,
        modelSha256: engine.vendor.manifest.model.sha256,
      },
      providerCalls: 0,
      cost: "$0",
    };
    await writeJson(receiptPath, receipt);
    return {
      transcript,
      transcriptPath: outputPath,
      transcriptSha256,
      receipt,
      receiptPath,
      receiptSha256: await sha256(receiptPath),
    };
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

function validateCanonicalTranscript(transcript) {
  exactKeys(transcript, ["schemaVersion", "language", "text", "audio", "engine", "segments", "words"], "transcript");
  if (transcript.schemaVersion !== TRANSCRIPT_SCHEMA || transcript.language !== "en") {
    throw new Error("unsupported transcript schema or language");
  }
  if (!Array.isArray(transcript.segments) || !Array.isArray(transcript.words)) {
    throw new Error("transcript segments and words must be arrays");
  }
  if (typeof transcript.text !== "string" || transcript.text.trim().length < 1 || transcript.words.length < 1) {
    throw new Error("transcript must contain recognized English speech");
  }
  let previousStart = -1;
  for (const [index, word] of transcript.words.entries()) {
    if (word.id !== `w${String(index + 1).padStart(4, "0")}`
      || typeof word.text !== "string"
      || !Number.isInteger(word.startMs)
      || !Number.isInteger(word.endMs)
      || word.startMs < previousStart
      || word.endMs < word.startMs
      || word.endMs > transcript.audio.durationMs + 1000) {
      throw new Error(`transcript word ${index + 1} is invalid or out of order`);
    }
    previousStart = word.startMs;
  }
}

async function validateTranscriptEvidence({ root, runDirectory, audioPath, config }) {
  exactKeys(config, [
    "file",
    "sha256",
    "receiptFile",
    "receiptSha256",
    "sourceAudioSha256",
    "language",
    "segmentCount",
    "wordCount",
  ], "input.transcript");
  const transcriptFile = directFile(config.file, "input.transcript.file");
  const receiptFile = directFile(config.receiptFile, "input.transcript.receiptFile");
  const transcriptPath = path.join(runDirectory, transcriptFile);
  const receiptPath = path.join(runDirectory, receiptFile);
  if (!SHA256.test(config.sha256 ?? "") || await sha256(transcriptPath) !== config.sha256) {
    throw new Error("transcript checksum does not match input.transcript");
  }
  if (!SHA256.test(config.receiptSha256 ?? "") || await sha256(receiptPath) !== config.receiptSha256) {
    throw new Error("transcription receipt checksum does not match input.transcript");
  }
  const sourceAudioSha256 = await sha256(audioPath);
  if (config.sourceAudioSha256 !== sourceAudioSha256) {
    throw new Error("transcript source audio checksum does not match the staged audio");
  }
  const transcript = await readJson(transcriptPath);
  validateCanonicalTranscript(transcript);
  const regeneratedDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-transcript-validation-"));
  let regenerated;
  try {
    regenerated = await generateTranscript({
      root,
      audioPath,
      outputPath: path.join(regeneratedDirectory, "transcript.json"),
      receiptPath: path.join(regeneratedDirectory, "transcription-receipt.json"),
    });
  } finally {
    await fs.rm(regeneratedDirectory, { recursive: true, force: true });
  }
  if (regenerated.transcriptSha256 !== config.sha256) {
    throw new Error("transcript does not match a fresh local transcription of the staged audio");
  }
  if (transcript.audio.sourceSha256 !== sourceAudioSha256
    || transcript.language !== config.language
    || transcript.segments.length !== config.segmentCount
    || transcript.words.length !== config.wordCount
    || transcript.engine.name !== "whisper.cpp"
    || transcript.engine.version !== ENGINE_VERSION
    || transcript.engine.sourceArchiveSha256 !== regenerated.transcript.engine.sourceArchiveSha256
    || transcript.engine.buildPlanSha256 !== regenerated.transcript.engine.buildPlanSha256
    || transcript.engine.model.sha256 !== regenerated.transcript.engine.model.sha256) {
    throw new Error("transcript content or engine provenance is stale");
  }
  const receipt = await readJson(receiptPath);
  const expectedReceipt = structuredClone(regenerated.receipt);
  expectedReceipt.transcript.file = transcriptFile;
  delete expectedReceipt.generatedAt;
  const comparableReceipt = structuredClone(receipt);
  delete comparableReceipt.generatedAt;
  if (JSON.stringify(comparableReceipt) !== JSON.stringify(expectedReceipt)
    || receipt.transcript.sha256 !== config.sha256
    || receipt.transcript.wordCount !== config.wordCount
    || receipt.audio.sourceSha256 !== sourceAudioSha256) {
    throw new Error("transcription receipt is stale");
  }
  return {
    transcript,
    transcriptPath,
    receipt: {
      file: transcriptFile,
      sha256: config.sha256,
      receiptFile,
      receiptSha256: config.receiptSha256,
      sourceAudioSha256,
      language: config.language,
      segmentCount: config.segmentCount,
      wordCount: config.wordCount,
      engine: receipt.engine,
    },
  };
}

export {
  ENGINE_VERSION,
  TRANSCRIPT_SCHEMA,
  ensureWhisperEngine,
  generateTranscript,
  loadWhisperVendor,
  transcriptReceiptPath,
  validateTranscriptionAudio,
  validateTranscriptEvidence,
};
