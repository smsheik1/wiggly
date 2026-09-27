#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, copyFile, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));
const runIdPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const slideOrder = ["alert", "poster", "photo", "photo", "photo", "jab", "details", "notice", "cta", "signoff"];
const runtimeStaticFiles = [
  "runner.mjs",
  "runtime/render.mjs",
  "runtime/renderer/index.html",
  "runtime/renderer/app.js",
  "runtime/scripts/build_motion.py",
  "assets/character-packs.json",
  "assets/motion/presenter-motion-reference.json",
];
const requiredSlideFields = {
  alert: { strings: ["eyebrow", "subhead"], pairs: ["titleLines"] },
  poster: { strings: ["image", "caption"], pairs: [] },
  photo: { strings: ["image", "label", "kicker"], pairs: [] },
  jab: { strings: ["eyebrow", "subhead"], pairs: ["titleLines"] },
  details: { strings: ["eyebrow", "footer"], pairs: ["primaryLines"] },
  notice: { strings: ["eyebrow", "badge", "footer"], pairs: ["titleLines"] },
  cta: { strings: ["image", "title", "button", "details", "footer"], pairs: [] },
  signoff: { strings: ["eyebrow", "footer"], pairs: ["titleLines"] },
};

function parseArgs(values) {
  const result = {};
  for (const value of values) {
    if (!value.startsWith("--")) continue;
    const [key, ...parts] = value.slice(2).split("=");
    result[key] = parts.length ? parts.join("=") : true;
  }
  return result;
}

function assertRunId(value) {
  if (!value || !runIdPattern.test(value)) throw new Error("Pass --run=<lowercase-hyphenated-id>.");
  return value;
}

function runDirectory(value) {
  return path.join(root, "agent-runs", assertRunId(value));
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function sha256File(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function filesUnder(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function execute(program, values, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, values, {
      cwd: options.cwd || root,
      env: options.env || process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let output = "";
    if (options.capture) {
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || options.allowFailure) resolve({ code, output });
      else reject(new Error(`${program} exited ${code}${output ? `\n${output}` : ""}`));
    });
  });
}

async function loadLocalEnv() {
  for (const candidate of [
    path.join(root, "../../secrets.env"),
    path.join(root, "../../../secrets.env"),
    path.join(root, "secrets.env"),
  ]) {
    if (await exists(candidate)) {
      try {
        process.loadEnvFile(candidate);
        break;
      } catch {}
    }
  }
}

function words(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean);
}

function collectVisibleStrings(slide) {
  return [slide.eyebrow, slide.caption, slide.label, slide.kicker, slide.subhead, slide.footer, slide.badge,
    slide.title, slide.button, slide.details, ...(slide.titleLines || []), ...(slide.primaryLines || [])]
    .filter((value) => typeof value === "string");
}

async function contentHash(baseDirectory, content) {
  const hash = createHash("sha256");
  const files = ["content.json", "asset-sources.json"];
  for (const slide of content.slides || []) if (slide.image) files.push(slide.image);
  for (const relative of [...new Set(files)].sort()) hash.update(await readFile(path.join(baseDirectory, relative)));
  return hash.digest("hex");
}

async function runtimeHash() {
  const hash = createHash("sha256");
  const runtimeFiles = [
    ...runtimeStaticFiles,
    ...await filesUnder("assets/character"),
    ...await filesUnder("assets/characters"),
  ].sort();
  for (const relative of runtimeFiles) hash.update(await readFile(path.join(root, relative)));
  return hash.digest("hex");
}

async function validateDirectory(baseDirectory, writeReceipt = true) {
  const contentFile = path.join(baseDirectory, "content.json");
  const sourcesFile = path.join(baseDirectory, "asset-sources.json");
  const errors = [];
  if (!(await exists(contentFile))) errors.push("Missing content.json.");
  if (!(await exists(sourcesFile))) errors.push("Missing asset-sources.json.");
  if (errors.length) throw new Error(errors.join("\n"));
  const content = await readJson(contentFile);
  const sources = await readJson(sourcesFile);
  const characterCatalog = await readJson(path.join(root, "assets", "character-packs.json"));
  for (const field of ["id", "characterId", "headline", "locationBug", "tickerItems", "script", "pronunciations", "slides"]) {
    if (content[field] === undefined) errors.push(`Missing content.${field}.`);
  }
  if (content.schemaVersion !== 1) errors.push("content.schemaVersion must be 1.");
  if (content.formatVersion !== "0.2.1-proof") errors.push("content.formatVersion must be 0.2.1-proof.");
  const characterPack = characterCatalog.packs.find((pack) => pack.id === content.characterId);
  if (!characterPack) errors.push(`Unknown characterId: ${content.characterId}`);
  else if (characterPack.status !== "presenter-ready") {
    errors.push(`${characterPack.label} is ${characterPack.status}; choose a presenter-ready character.`);
  } else if (!(await exists(path.join(root, characterPack.model)))) {
    errors.push(`Character model is missing: ${characterPack.model}`);
  }
  if (typeof content.script !== "string") errors.push("content.script must be a string.");
  if (String(content.headline || "").length > 58) errors.push("Headline exceeds 58 characters.");
  if (String(content.locationBug || "").length > 24) errors.push("Location bug exceeds 24 characters.");
  if (!Array.isArray(content.tickerItems) || content.tickerItems.length < 3 || content.tickerItems.length > 8) {
    errors.push("tickerItems must contain 3–8 entries.");
  } else if (content.tickerItems.some((item) => typeof item !== "string" || item.length > 54)) {
    errors.push("Every ticker item must be a string of 54 characters or fewer.");
  }
  const wordCount = words(content.script).length;
  if (wordCount < 65 || wordCount > 112) errors.push(`Script has ${wordCount} words; expected 65–112.`);
  if (!Array.isArray(content.pronunciations)) errors.push("pronunciations must be an array.");
  else for (const item of content.pronunciations) {
    if (!item?.text || !item?.arpabet) errors.push("Every pronunciation needs text and arpabet.");
    else if (!content.script.includes(item.text)) errors.push(`Pronunciation text is absent from script: ${item.text}`);
  }
  if (!Array.isArray(content.slides) || content.slides.length !== 10) {
    errors.push("slides must contain exactly 10 records.");
  } else {
    content.slides.forEach((slide, index) => {
      if (slide.type !== slideOrder[index]) errors.push(`Slide ${index + 1} must be ${slideOrder[index]}, got ${slide.type}.`);
      const required = requiredSlideFields[slide.type];
      if (required) {
        for (const field of required.strings) {
          if (typeof slide[field] !== "string" || !slide[field].trim()) errors.push(`Slide ${index + 1} needs a non-empty ${field}.`);
        }
        for (const field of required.pairs) {
          if (!Array.isArray(slide[field]) || slide[field].length !== 2 || slide[field].some((line) => typeof line !== "string" || !line.trim())) {
            errors.push(`Slide ${index + 1} needs exactly two non-empty ${field}.`);
          }
        }
      }
      if (!Number.isFinite(slide.start) || !Number.isFinite(slide.end) || slide.end - slide.start < 1.5) {
        errors.push(`Slide ${index + 1} must have numeric timing and last at least 1.5 seconds.`);
      }
      if (index === 0 && Math.abs(slide.start) > 0.001) errors.push("The first slide must start at 0.");
      if (index > 0 && Math.abs(slide.start - content.slides[index - 1].end) > 0.001) {
        errors.push(`Slides ${index} and ${index + 1} have a gap or overlap.`);
      }
      if (index === 9 && Math.abs(slide.end - 30) > 0.001) errors.push("The final slide must end at 30 seconds.");
      for (const text of collectVisibleStrings(slide)) if (text.length > 54) {
        errors.push(`Slide ${index + 1} display text exceeds 54 characters: ${text}`);
      }
      if (slide.image) {
        if (!slide.image.startsWith("assets/story/") || slide.image.includes("..")) {
          errors.push(`Slide ${index + 1} image must stay under assets/story/.`);
        }
      }
    });
  }
  if (typeof sources.promotionSource !== "string" || !sources.promotionSource.trim()) errors.push("asset-sources.promotionSource is required.");
  if (typeof sources.facts !== "string" || !sources.facts.trim()) errors.push("asset-sources.facts is required.");
  if (!Array.isArray(sources.assets)) errors.push("asset-sources.assets must be an array.");
  else for (const [index, asset] of sources.assets.entries()) {
    if (typeof asset?.path !== "string" || typeof asset?.source !== "string" || !asset.path || !asset.source) {
      errors.push(`asset-sources.assets[${index}] needs path and source.`);
    }
  }
  const sourcePaths = new Set((sources.assets || []).map((asset) => asset.path));
  for (const image of [...new Set((content.slides || []).map((slide) => slide.image).filter(Boolean))]) {
    if (!(await exists(path.join(baseDirectory, image)))) errors.push(`Missing story image: ${image}`);
    if (!sourcePaths.has(image)) errors.push(`asset-sources.json does not document ${image}.`);
  }
  if (errors.length) throw new Error(`Validation failed:\n- ${errors.join("\n- ")}`);
  const hash = await contentHash(baseDirectory, content);
  const receipt = {
    status: "pass",
    validatedAt: new Date().toISOString(),
    contentHash: hash,
    wordCount,
    slideCount: content.slides.length,
    durationSeconds: content.slides.at(-1).end,
  };
  if (writeReceipt) await writeJson(path.join(baseDirectory, ".validation.json"), receipt);
  return { content, receipt };
}

async function probeDuration(file) {
  const result = await execute("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], { capture: true });
  const duration = Number.parseFloat(result.output.trim());
  if (!Number.isFinite(duration)) throw new Error(`Could not read audio duration for ${file}`);
  return duration;
}

function atempoFilter(ratio) {
  const filters = [];
  let remaining = ratio;
  while (remaining > 2) { filters.push("atempo=2"); remaining /= 2; }
  while (remaining < 0.5) { filters.push("atempo=0.5"); remaining /= 0.5; }
  filters.push(`atempo=${remaining.toFixed(10)}`);
  return filters.join(",");
}

async function prepareAudio(source, output) {
  const duration = await probeDuration(source);
  const targetSpeech = 29.1;
  const tempo = Math.abs(duration - 30) <= 0.02 ? "anull" : atempoFilter(duration / targetSpeech);
  await mkdir(path.dirname(output), { recursive: true });
  await execute("ffmpeg", ["-y", "-i", source, "-af", `${tempo},apad,atrim=0:30`, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", output]);
  const finalDuration = await probeDuration(output);
  if (Math.abs(finalDuration - 30) > 0.01) throw new Error(`Normalized audio is ${finalDuration}s, expected 30s.`);
  return { sourceDuration: duration, finalDuration, tempo };
}

function phonemeText(content) {
  let value = content.script;
  for (const pronunciation of content.pronunciations) {
    const encoded = pronunciation.arpabet.split("|").map((part) => `<|phoneme_start|>${part.trim()}<|phoneme_end|>`).join(" ");
    value = value.replaceAll(pronunciation.text, encoded);
  }
  return value;
}

async function generateFishAudio(runDir, content, validation) {
  await loadLocalEnv();
  const apiKey = process.env.FISH_STUDIO_APIKEY || process.env.FISH_API_KEY;
  const voiceId = process.env.SQUILLIAM_VOICE_ID;
  if (!apiKey) throw new Error("Missing FISH_STUDIO_APIKEY (or FISH_API_KEY). Add it locally; never paste it into chat.");
  if (!voiceId) throw new Error("Missing SQUILLIAM_VOICE_ID. Add the authorized reference model ID locally.");
  const response = await fetch("https://api.fish.audio/v1/tts", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", model: "s2.1-pro-free" },
    body: JSON.stringify({
      text: phonemeText(content), reference_id: voiceId, temperature: 0.35, top_p: 0.55,
      format: "wav", sample_rate: 44100, normalize: true, latency: "normal",
      chunk_length: 100, min_chunk_length: 0, max_new_tokens: 1024,
      repetition_penalty: 1.2, condition_on_previous_chunks: false, early_stop_threshold: 1,
      prosody: { speed: 1.18, volume: 0, normalize_loudness: true },
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Fish Audio failed with ${response.status}: ${(await response.text()).slice(0, 240)}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length < 10000) throw new Error("Fish Audio returned an unexpectedly small response.");
  const output = path.join(runDir, "audio", "source.wav");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, bytes);
  await writeJson(path.join(runDir, "audio", "provider-receipt.json"), {
    provider: "Fish Audio",
    model: "s2.1-pro-free",
    generatedAt: new Date().toISOString(),
    contentHash: validation.contentHash,
    voiceReferenceFingerprint: createHash("sha256").update(voiceId).digest("hex").slice(0, 12),
    bytes: bytes.length,
  });
  return output;
}

async function commandCheck() {
  const checks = [];
  for (const [name, program, values] of [
    ["Node.js", "node", ["--version"]], ["npm", "npm", ["--version"]], ["Python", "python3", ["--version"]],
    ["FFmpeg", "ffmpeg", ["-version"]], ["FFprobe", "ffprobe", ["-version"]],
  ]) {
    const result = await execute(program, values, { capture: true, allowFailure: true });
    checks.push({ name, status: result.code === 0 ? "available" : "missing", version: result.output.split(/\r?\n/)[0] || null });
  }
  const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  checks.push({ name: "Google Chrome", status: await exists(chrome) ? "available" : "missing", path: chrome });
  try { await import("playwright"); checks.push({ name: "Playwright package", status: "available" }); }
  catch { checks.push({ name: "Playwright package", status: "missing", fix: "Run npm install." }); }
  try { await import("three"); checks.push({ name: "Three.js package", status: "available" }); }
  catch { checks.push({ name: "Three.js package", status: "missing", fix: "Run npm install." }); }
  await loadLocalEnv();
  const provider = {
    model: "s2.1-pro-free",
    FISH_STUDIO_APIKEY: Boolean(process.env.FISH_STUDIO_APIKEY || process.env.FISH_API_KEY) ? "configured" : "not configured (optional with approved narration)",
    SQUILLIAM_VOICE_ID: process.env.SQUILLIAM_VOICE_ID ? "configured" : "not configured (optional with approved narration)",
  };
  console.log(JSON.stringify({ checks, provider }, null, 2));
  if (checks.some((check) => check.status === "missing")) throw new Error("Local requirement check failed.");
}

async function commandInit() {
  const runDir = runDirectory(args.run);
  if (await exists(runDir)) throw new Error(`Run already exists: ${args.run}`);
  const sourceName = args.from || "smoke";
  const source = sourceName === "smoke"
    ? path.join(root, "fixtures", "smoke")
    : path.join(root, "examples", sourceName);
  if (!(await exists(source))) throw new Error(`Unknown source pack: ${sourceName}`);
  await mkdir(path.join(runDir, "assets", "story"), { recursive: true });
  for (const filename of ["content.json", "asset-sources.json", "audio.wav"]) {
    const sourceFile = path.join(source, filename);
    if (await exists(sourceFile)) await copyFile(sourceFile, path.join(runDir, filename));
  }
  await cp(path.join(source, "assets", "story"), path.join(runDir, "assets", "story"), { recursive: true });
  await writeJson(path.join(runDir, "state.json"), { runId: args.run, createdAt: new Date().toISOString(), source: sourceName, attempts: [] });
  console.log(runDir);
}

async function commandValidate() {
  const runDir = runDirectory(args.run);
  const { receipt } = await validateDirectory(runDir, true);
  console.log(JSON.stringify(receipt, null, 2));
}

async function commandSmoke() {
  const fixture = path.join(root, "fixtures", "smoke");
  await validateDirectory(fixture, false);
  const smokeDir = path.join(root, "agent-runs", "_smoke");
  await rm(smokeDir, { recursive: true, force: true });
  await mkdir(smokeDir, { recursive: true });
  const output = path.join(smokeDir, "smoke.mp4");
  const motion = path.join(smokeDir, "motion.json");
  await execute("python3", [path.join(root, "runtime", "scripts", "build_motion.py"),
    "--audio", path.join(fixture, "audio.wav"), "--output", motion]);
  await execute("node", [path.join(root, "runtime", "render.mjs"),
    `--content=${path.join(fixture, "content.json")}`, `--motion=${motion}`,
    `--audio=${path.join(fixture, "audio.wav")}`, `--output=${output}`, `--work-dir=${smokeDir}`, "--smoke"]);
  const probe = await execute("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "json", output], { capture: true });
  const contactSheet = path.join(smokeDir, "contact-sheet.png");
  await execute("ffmpeg", ["-y", "-hide_banner", "-i", output, "-vf", "fps=1,scale=426:-1,tile=3x3", "-frames:v", "1", "-update", "1", contactSheet]);
  console.log(JSON.stringify({ status: "pass", output, contactSheet, probe: JSON.parse(probe.output) }, null, 2));
}

async function commandRender() {
  const runDir = runDirectory(args.run);
  const validationFile = path.join(runDir, ".validation.json");
  if (!(await exists(validationFile))) throw new Error("Run validate before render.");
  const { content, receipt } = await validateDirectory(runDir, false);
  const savedValidation = await readJson(validationFile);
  if (savedValidation.contentHash !== receipt.contentHash) throw new Error("Content changed after validation. Run validate again.");
  let sourceAudio = path.join(runDir, "audio.wav");
  if (!(await exists(sourceAudio))) sourceAudio = path.join(runDir, "audio", "source.wav");
  const needsProvider = !(await exists(sourceAudio));
  if (needsProvider && !args["approve-provider"]) {
    throw new Error("Narration is missing. Validate, obtain provider approval when required, then rerun with --approve-provider.");
  }
  const stateFile = path.join(runDir, "state.json");
  const state = await readJson(stateFile);
  const last = state.attempts.at(-1);
  let attempt;
  if (last?.status === "running" && last.contentHash === receipt.contentHash) {
    attempt = last;
    attempt.resumedAt = new Date().toISOString();
  } else {
    if (state.attempts.length >= 3) throw new Error("Attempt limit reached. Inspect the blocker instead of retrying.");
    attempt = { number: state.attempts.length + 1, status: "running", startedAt: new Date().toISOString(), contentHash: receipt.contentHash };
    state.attempts.push(attempt);
  }
  await writeJson(stateFile, state);
  const attemptDir = path.join(runDir, "attempts", `attempt-${String(attempt.number).padStart(2, "0")}`);
  await mkdir(attemptDir, { recursive: true });
  try {
    if (needsProvider) {
      sourceAudio = await generateFishAudio(runDir, content, receipt);
      attempt.providerCall = { provider: "Fish Audio", model: "s2.1-pro-free", approved: true };
    }
    const finalAudio = path.join(attemptDir, "audio.wav");
    attempt.audio = await prepareAudio(sourceAudio, finalAudio);
    attempt.audioHash = await sha256File(finalAudio);
    const motion = path.join(attemptDir, "motion.json");
    await execute("python3", [path.join(root, "runtime", "scripts", "build_motion.py"), "--audio", finalAudio, "--output", motion]);
    const video = path.join(attemptDir, "video.mp4");
    await execute("node", [path.join(root, "runtime", "render.mjs"), `--content=${path.join(runDir, "content.json")}`,
      `--motion=${motion}`, `--audio=${finalAudio}`, `--output=${video}`, `--work-dir=${attemptDir}`]);
    attempt.status = "rendered";
    attempt.completedAt = new Date().toISOString();
    attempt.video = path.relative(runDir, video);
    attempt.videoHash = await sha256File(video);
    state.currentAttempt = attempt.number;
    await writeJson(stateFile, state);
    console.log(video);
  } catch (error) {
    attempt.status = "failed";
    attempt.failedAt = new Date().toISOString();
    attempt.error = String(error.message || error).slice(0, 800);
    await writeJson(stateFile, state);
    throw error;
  }
}

function parseSilence(output) {
  const starts = [...output.matchAll(/silence_start: ([0-9.]+)/g)].map((match) => Number(match[1]));
  const ends = [...output.matchAll(/silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)/g)]
    .map((match) => ({ end: Number(match[1]), duration: Number(match[2]) }));
  return ends.map((entry, index) => ({ start: starts[index], ...entry }));
}

async function commandInspect() {
  const runDir = runDirectory(args.run);
  const state = await readJson(path.join(runDir, "state.json"));
  const attempt = state.attempts.find((item) => item.number === state.currentAttempt && item.status === "rendered");
  if (!attempt) throw new Error("No rendered attempt is available to inspect.");
  const video = path.join(runDir, attempt.video);
  const videoHash = await sha256File(video);
  if (attempt.videoHash && attempt.videoHash !== videoHash) throw new Error("Rendered video changed after the attempt completed.");
  const renderedAudio = path.join(path.dirname(video), "audio.wav");
  const audioHash = await sha256File(renderedAudio);
  if (attempt.audioHash && attempt.audioHash !== audioHash) throw new Error("Rendered narration changed after the attempt completed.");
  const probeResult = await execute("ffprobe", ["-v", "error", "-show_entries", "format=duration,size,bit_rate", "-show_entries", "stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels", "-of", "json", video], { capture: true });
  const probe = JSON.parse(probeResult.output);
  const silenceOutput = (await execute("ffmpeg", ["-hide_banner", "-i", video, "-af", "silencedetect=noise=-42dB:d=0.25", "-f", "null", "-"], { capture: true })).output;
  const volumeOutput = (await execute("ffmpeg", ["-hide_banner", "-i", video, "-af", "volumedetect", "-f", "null", "-"], { capture: true })).output;
  const blackOutput = (await execute("ffmpeg", ["-hide_banner", "-i", video, "-vf", "blackdetect=d=0.10:pix_th=0.10", "-an", "-f", "null", "-"], { capture: true })).output;
  const contactSheet = path.join(runDir, "contact-sheet.png");
  await execute("ffmpeg", ["-y", "-hide_banner", "-i", video, "-vf", "fps=1/3,scale=640:-1,tile=5x2", "-frames:v", "1", "-update", "1", contactSheet]);
  const videoStream = probe.streams.find((stream) => stream.codec_type === "video");
  const audioStreams = probe.streams.filter((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format.duration);
  const silences = parseSilence(silenceOutput);
  const finalHold = silences.find((segment) => segment.end >= 29.99);
  const interior = silences.filter((segment) => segment.end < 29.99);
  const checks = {
    duration: Math.abs(duration - 30) <= 0.01,
    dimensions: videoStream?.width === 1280 && videoStream?.height === 720,
    fps: videoStream?.r_frame_rate === "30/1",
    audioStream: audioStreams.length === 1,
    noBlackSegments: !/black_start:/.test(blackOutput),
    interiorSilence: interior.every((segment) => segment.duration <= 0.6),
    finalHold: Boolean(finalHold && finalHold.duration >= 0.75 && finalHold.duration <= 1.1),
  };
  const report = {
    status: Object.values(checks).every(Boolean) ? "pass" : "fail",
    inspectedAt: new Date().toISOString(),
    attempt: attempt.number,
    contentHash: attempt.contentHash,
    runtimeHash: await runtimeHash(),
    audioHash,
    videoHash,
    video: attempt.video,
    contactSheet: path.relative(runDir, contactSheet),
    probe,
    silences,
    volume: {
      meanDb: Number(volumeOutput.match(/mean_volume: ([-0-9.]+) dB/)?.[1]),
      peakDb: Number(volumeOutput.match(/max_volume: ([-0-9.]+) dB/)?.[1]),
    },
    checks,
    humanReviewRequired: true,
  };
  await writeJson(path.join(runDir, "quality-report.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "pass") throw new Error("Automatic inspection failed. Review quality-report.json.");
}

async function commandFinalize() {
  const runDir = runDirectory(args.run);
  if (args["human-review"] !== "pass") throw new Error("Pass --human-review=pass only after the user approves facts, voice, pronunciation, motion, lip sync, joke, and CTA.");
  const reportFile = path.join(runDir, "quality-report.json");
  if (!(await exists(reportFile))) throw new Error("Run inspect before finalize.");
  const report = await readJson(reportFile);
  if (report.status !== "pass") throw new Error("Automatic inspection is not passing.");
  const { receipt } = await validateDirectory(runDir, false);
  if (receipt.contentHash !== report.contentHash) throw new Error("Content changed after inspection. Validate, render, and inspect again.");
  const currentRuntimeHash = await runtimeHash();
  if (!report.runtimeHash || report.runtimeHash !== currentRuntimeHash) {
    throw new Error("Renderer changed after inspection. Render and inspect again before finalizing.");
  }
  const source = path.join(runDir, report.video);
  if (!report.videoHash || report.videoHash !== await sha256File(source)) {
    throw new Error("Rendered video changed after inspection. Inspect again before finalizing.");
  }
  const output = path.join(runDir, "final.mp4");
  await copyFile(source, output);
  const finalization = {
    status: "pass",
    finalizedAt: new Date().toISOString(),
    formatVersion: "0.2.1-proof",
    contentHash: receipt.contentHash,
    runtimeHash: currentRuntimeHash,
    audioHash: report.audioHash,
    videoHash: report.videoHash,
    automaticReview: "pass",
    humanReview: "pass",
    finalVideo: "final.mp4",
    contactSheet: report.contactSheet,
    qualityReport: "quality-report.json",
  };
  await writeJson(path.join(runDir, "finalization.json"), finalization);
  console.log(output);
}

const commands = {
  check: commandCheck,
  smoke: commandSmoke,
  init: commandInit,
  validate: commandValidate,
  render: commandRender,
  inspect: commandInspect,
  finalize: commandFinalize,
};

if (!commands[command]) {
  throw new Error("Usage: node runner.mjs <smoke|check|init|validate|render|inspect|finalize> [--run=<id>] [--from=<pack>] [--approve-provider] [--human-review=pass]");
}
await commands[command]();
