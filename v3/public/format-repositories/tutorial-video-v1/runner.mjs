#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { loadAndValidateInput, probeMedia, VIDEO } from "./runtime/contract.mjs";
import { critiqueTutorialScript, formatCritiqueReport } from "./runtime/critique.mjs";
import { harvestTargetAssets } from "./runtime/harvest.mjs";
import { buildNarratedTutorialStep } from "./runtime/voice.mjs";

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const MEDIA_ROOT = path.join(ROOT, "media");
const ENTRY = path.join(ROOT, "runtime", "index.jsx");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const ffprobe = process.env.FFPROBE || "ffprobe";
const bundledBrowser = [
  process.env.REMOTION_BROWSER_EXECUTABLE,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].find((candidate) => candidate && existsSync(candidate));

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

function argument(name, fallback = undefined) {
  const flag = `--${name}=`;
  const value = process.argv.slice(3).find((item) => item.startsWith(flag));
  return value ? value.slice(flag.length) : fallback;
}

function requiredArgument(name) {
  const value = argument(name);
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
}

function checkBinary(command) {
  return spawnSync(command, ["-version"], { stdio: "ignore" }).status === 0;
}

function checkLocalhostPort() {
  const script = [
    "const net=require('node:net')",
    "const server=net.createServer()",
    "const timer=setTimeout(()=>process.exit(2),2000)",
    "server.once('error',()=>process.exit(1))",
    "server.listen({host:'127.0.0.1',port:0},()=>server.close(()=>{clearTimeout(timer);process.exit(0)}))",
  ].join(";");
  return spawnSync(process.execPath, ["-e", script], { stdio: "ignore", timeout: 3_000 }).status === 0;
}

export function validateInput(inputFile) {
  const resolved = path.resolve(inputFile);
  if (!existsSync(resolved)) throw new Error(`Input does not exist: ${inputFile}`);
  return loadAndValidateInput(resolved, { mediaRoot: MEDIA_ROOT });
}

export function doctor() {
  const localhostPort = checkLocalhostPort();
  const result = {
    node: process.versions.node,
    ffmpeg: checkBinary(ffmpeg),
    ffprobe: checkBinary(ffprobe),
    remotionRuntime: existsSync(ENTRY),
    fixedGridAssets: ["grid-acid-lime-v1.png", "grid-electric-blue-v1.png", "grid-warm-cream-v1.png"].every((name) => existsSync(path.join(MEDIA_ROOT, "fixed", name))),
    localhostPort,
    sandboxGuidance: localhostPort ? "ready" : "Allow this command to bind a localhost port for the local Remotion browser before rendering.",
    providerCalls: 0,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ffmpeg || !result.ffprobe || !result.remotionRuntime || !result.fixedGridAssets || !result.localhostPort) process.exitCode = 1;
  return result;
}

export async function render(inputFile, outputFile) {
  if (!checkBinary(ffmpeg) || !checkBinary(ffprobe)) throw new Error("Render requires FFmpeg and FFprobe on PATH.");
  if (!checkLocalhostPort()) throw new Error("Render needs permission to bind a localhost port for Remotion's local browser. Grant that local sandbox permission before starting the render; this is not a network or provider call.");
  const inputPath = path.resolve(inputFile);
  const output = path.resolve(outputFile);
  if (path.extname(output).toLowerCase() !== ".mp4") throw new Error("Output must be an .mp4 file.");
  mkdirSync(path.dirname(output), { recursive: true });
  const prepared = validateInput(inputPath);
  let lastBundleProgress = -1;
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    publicDir: MEDIA_ROOT,
    onProgress: (progress) => {
      const percent = Math.floor(progress / 10) * 10;
      if (percent !== lastBundleProgress) {
        lastBundleProgress = percent;
        console.log(`Bundle ${percent}%`);
      }
    },
  });
  const browserExecutable = bundledBrowser || undefined;
  const composition = await selectComposition({ serveUrl, id: "TutorialVideo", inputProps: prepared, browserExecutable });
  let lastRenderProgress = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    audioCodec: "aac",
    pixelFormat: "yuv420p",
    crf: 20,
    outputLocation: output,
    inputProps: prepared,
    browserExecutable,
    overwrite: true,
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== lastRenderProgress) {
        lastRenderProgress = percent;
        console.log(`Render ${percent}%`);
      }
    },
  });
  const metadata = probeMedia(output, ffprobe);
  if (metadata.video?.width !== VIDEO.width || metadata.video?.height !== VIDEO.height) throw new Error("Rendered output is not 1920x1080.");
  if (!metadata.audio) throw new Error("Rendered output is missing audio.");
  if (Math.abs(metadata.durationSeconds - prepared.durationSeconds) > 0.12) throw new Error(`Rendered duration ${metadata.durationSeconds.toFixed(3)}s does not match the ingredient timeline ${prepared.durationSeconds.toFixed(3)}s.`);
  const receipt = {
    schemaVersion: 1,
    formatVersion: "0.3.0",
    input: path.relative(ROOT, inputPath),
    inputSha256: sha256(inputPath),
    runtimeSha256: sha256(path.join(ROOT, "runtime", "tutorial-video.jsx")),
    output: path.relative(ROOT, output),
    outputSha256: sha256(output),
    width: VIDEO.width,
    height: VIDEO.height,
    fps: VIDEO.fps,
    durationSeconds: metadata.durationSeconds,
    providerCalls: 0,
    signatureFeatures: ["retro-grid", "macos-window-chrome", "numbered-step-badges", "neon-checkpoint-cards", "styled-subtitles", "progress-bar"],
  };
  writeFileSync(`${output}.receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  return { prepared, receipt };
}

export function inspect(inputFile, reportFile) {
  const input = path.resolve(inputFile);
  if (!existsSync(input)) throw new Error(`Video does not exist: ${input}`);
  const metadata = probeMedia(input, ffprobe);
  const frameRate = metadata.video?.r_frame_rate === "30/1" || metadata.video?.r_frame_rate === "60/2";
  const checks = {
    h264: metadata.video?.codec_name === "h264",
    aac: metadata.audio?.codec_name === "aac",
    dimensions: metadata.video?.width === VIDEO.width && metadata.video?.height === VIDEO.height,
    frameRate,
    hasAudio: Boolean(metadata.audio),
    duration: metadata.durationSeconds >= 12 && metadata.durationSeconds <= 240.12,
  };
  const passed = Object.values(checks).every(Boolean);
  const target = path.resolve(reportFile || `${input}.quality-report.json`);
  const contactSheet = target.replace(/\.json$/i, "-contact-sheet.jpg");
  const receiptPath = `${input}.receipt.json`;
  const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : null;
  const ingredientPath = receipt?.input ? path.resolve(ROOT, receipt.input) : null;
  const prepared = ingredientPath && existsSync(ingredientPath) ? validateInput(ingredientPath) : null;
  const sampleFrames = prepared?.steps.map((step) => step.startFrame + Math.floor(step.durationInFrames / 2));
  const sampledStepIds = prepared?.steps.map((step) => step.id) || [];
  if (sampleFrames?.length) {
    const rows = Math.ceil(sampleFrames.length / 3);
    const selection = sampleFrames.map((frame) => `eq(n\\,${frame})`).join("+");
    execFileSync(ffmpeg, [
      "-y", "-v", "error", "-i", input,
      "-vf", `select='${selection}',scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:black,tile=3x${rows}:nb_frames=${sampleFrames.length}:padding=0:margin=0`,
      "-frames:v", "1", contactSheet,
    ]);
  } else {
    const interval = Math.max(0.5, metadata.durationSeconds / 6);
    execFileSync(ffmpeg, [
      "-y", "-v", "error", "-i", input,
      "-vf", `fps=1/${interval},scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:black,tile=3x2`,
      "-frames:v", "1", contactSheet,
    ]);
  }
  const report = {
    schemaVersion: 1,
    input: path.relative(ROOT, input),
    inputSha256: sha256(input),
    passed,
    checks,
    metadata,
    contactSheet: path.relative(ROOT, contactSheet),
    sampling: prepared
      ? { mode: "ingredient-step-midpoints", stepIds: sampledStepIds }
      : { mode: "six-even-samples", stepIds: [] },
    creativeReview: "required before finalize",
  };
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!passed) process.exitCode = 1;
  return report;
}

export function finalize(inputFile, reportFile, reviewFile, outputFile) {
  const input = path.resolve(inputFile);
  const reportPath = path.resolve(reportFile);
  const reviewPath = path.resolve(reviewFile);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  if (!report.passed) throw new Error("Technical inspection failed; finalization is blocked.");
  if (review.status !== "approved" || review.watchedEntireVideo !== true || review.heardEntireVideo !== true) throw new Error("Creative review must explicitly approve the complete moving video and audio.");
  const delivery = {
    schemaVersion: 1,
    status: "final",
    video: path.relative(ROOT, input),
    videoSha256: sha256(input),
    qualityReport: path.relative(ROOT, reportPath),
    creativeReview: path.relative(ROOT, reviewPath),
    providerCalls: 0,
  };
  const target = path.resolve(outputFile || `${input}.delivery.json`);
  writeFileSync(target, `${JSON.stringify(delivery, null, 2)}\n`);
  console.log(JSON.stringify(delivery, null, 2));
  return delivery;
}

export async function smoke() {
  const directory = path.join(os.tmpdir(), `wiggly-tutorial-video-smoke-${process.pid}`);
  mkdirSync(directory, { recursive: true });
  const output = path.join(directory, "smoke.mp4");
  await render(path.join(ROOT, "fixtures", "smoke", "input.json"), output);
  const report = inspect(output, path.join(directory, "quality-report.json"));
  if (!report.passed) throw new Error("Smoke output failed inspection.");
  console.log(`Smoke passed through the official compositor: ${output}`);
  return { output, report };
}

export async function make(options = {}) {
  const targetSlug = options.target || argument("target", "mugsy-explains");
  const audience = options.audience || argument("audience", "creator");
  const skipRender = options.skipRender ?? (process.argv.includes("--skip-render") || process.argv.includes("--dry-run"));
  const outputFile = options.output || argument("output", path.join(ROOT, "outputs", `${targetSlug}-tutorial.mp4`));
  const recipeOption = options.recipe || argument("recipe");

  console.log(`[make] Starting autonomous 1-click tutorial generator for: ${targetSlug} (audience: ${audience})`);

  // 1. Harvest Visual Assets
  console.log(`[make] [1/5] Harvesting assets for ${targetSlug}...`);
  const harvested = await harvestTargetAssets({ targetSlug, repoRoot: ROOT });

  // 2. Synthesize Audio & Build Narrated Steps with Content-Driven Boundaries
  console.log(`[make] [2/5] Synthesizing voiceover and calculating microsecond caption timings...`);
  const audioOutputDir = path.join(MEDIA_ROOT, targetSlug);
  mkdirSync(audioOutputDir, { recursive: true });

  const proofFullDuration = harvested.proofDuration || 25.0;
  // Step 1 Hook: Take opening punchline beat (4.0-5.5s), aligned to 30 fps
  const hookDuration = Math.round(Math.min(5.0, Math.max(3.5, proofFullDuration / 4)) * 30) / 30;

  // Step 2 Formula & Prompt Text: Explain navigating to the format and copying the agent prompt
  const step2Text = audience === "developer"
    ? `Inspect the ${harvested.format.name} repo contracts and copy the prompt on Wiggly.`
    : `On Wiggly, open the ${harvested.format.name} format and copy the prompt for your coding agent.`;

  // Step 3 Execution Text: Pasting into agent and verifying zero providers
  const step3Text = audience === "developer"
    ? `Paste the prompt into your coding agent. The agent validates contracts and renders the video locally.`
    : `Paste the prompt into your coding agent. It validates contracts and renders the video locally.`;

  // Step 5 Closing Text
  const step5Text = `Check the captions and verify the receipt. To try your own format, the Wiggly link is below.`;

  // Step 2: The Formula & Copy Action (Browser)
  const browserMedia = harvested.media.browserVideo || harvested.media.browserStill;
  const step2Result = await buildNarratedTutorialStep({
    id: "choose-format",
    number: 2,
    label: "Copy the coding agent prompt",
    kind: "browser",
    windowTitle: `Wiggly — ${harvested.format.name}`,
    background: "lime",
    mediaPath: browserMedia.file,
    mediaType: browserMedia.type,
    narrationText: step2Text,
    audioRelPath: `${targetSlug}/step-02.wav`,
    audioFullPath: path.join(audioOutputDir, "step-02.wav"),
    voice: "zach",
    minStepDuration: 7.5
  });

  // Step 3: Run the Local Composition (Terminal + Checkpoint)
  const terminalMedia = harvested.media.terminalVideo || harvested.media.terminalStill;
  const step3Result = await buildNarratedTutorialStep({
    id: "run-agent",
    number: 3,
    label: "Paste into your coding agent",
    kind: "terminal",
    windowTitle: `Coding Agent (Antigravity / Claude Code) — ${harvested.format.name}`,
    background: "blue",
    mediaPath: terminalMedia.file,
    mediaType: terminalMedia.type,
    narrationText: step3Text,
    audioRelPath: `${targetSlug}/step-03.wav`,
    audioFullPath: path.join(audioOutputDir, "step-03.wav"),
    voice: "zach",
    minStepDuration: 8.0
  });

  step3Result.step.checkpoint = {
    eyebrow: "Your checkpoint",
    headline: "The agent is using the packaged compositor—not inventing a slideshow.",
    badge: "Verified 0 providers"
  };

  // Step 4: The Finished Result Proof Excerpt (tight 5.0s, not 20+ second cartoon dump)
  const payoffStart = hookDuration;
  const rawPayoffDuration = proofFullDuration - payoffStart;
  const payoffDuration = Math.round(Math.min(5.0, Math.max(3.5, rawPayoffDuration)) * 30) / 30;

  const step4Proof = {
    id: "finished-output",
    kind: "final",
    number: "4",
    label: "Watch the finished output",
    background: "lime",
    durationSeconds: payoffDuration,
    nativeAudio: true,
    media: {
      type: "video",
      file: harvested.media.proofVideo.file,
      startSeconds: payoffStart,
      fit: "contain",
      authorized: true,
      provenance: harvested.media.proofVideo.provenance
    }
  };

  // Step 5: The Exit CTA
  const step5Result = await buildNarratedTutorialStep({
    id: "next-step",
    number: 5,
    label: "Try your own format",
    kind: "end",
    background: "cream",
    narrationText: step5Text,
    audioRelPath: `${targetSlug}/step-05.wav`,
    audioFullPath: path.join(audioOutputDir, "step-05.wav"),
    voice: "zach",
    minStepDuration: 4.5
  });

  const defaultMusic = {
    file: "fixed/cancun-sega-genesis.mp3",
    authorized: true,
    provenance: "If Playboi Carti's \"Cancun\" was on the Sega Genesis (INSTRUMENTAL) — https://www.youtube.com/watch?v=-zdI0S0Vuzs",
    volume: 0.20,
    attribution: "Background music: Playboi Carti - Cancun (Sega Genesis Instrumental)"
  };

  const inputJson = {
    schemaVersion: 2,
    title: `Make a ${harvested.format.name} video with Wiggly`,
    audience: audience === "developer"
      ? "An engineer or operator deploying autonomous Wiggly format agents"
      : "A first-time creator who wants to generate videos without writing code",
    format: {
      name: harvested.format.name,
      slug: harvested.format.slug,
      promise: harvested.format.promise,
      url: harvested.format.url,
      outputLabel: harvested.format.outputLabel
    },
    music: defaultMusic,
    steps: [
      {
        id: "proof-first",
        kind: "hero",
        number: "1",
        label: "See the finished result",
        background: "lime",
        durationSeconds: hookDuration,
        nativeAudio: true,
        media: {
          type: "video",
          file: harvested.media.proofVideo.file,
          startSeconds: 0,
          fit: "contain",
          authorized: true,
          provenance: harvested.media.proofVideo.provenance
        }
      },
      step2Result.step,
      step3Result.step,
      step4Proof,
      step5Result.step
    ]
  };

  const inputDir = path.join(ROOT, "inputs");
  mkdirSync(inputDir, { recursive: true });
  const inputFilePath = recipeOption ? path.resolve(recipeOption) : path.join(inputDir, `${targetSlug}.json`);
  writeFileSync(inputFilePath, JSON.stringify(inputJson, null, 2) + "\n");
  console.log(`[make] Wrote generated tutorial recipe to ${path.relative(ROOT, inputFilePath)}`);

  // 3. Critique Script
  console.log(`[make] [3/5] Running 5-law script critique linter...`);
  const critique = critiqueTutorialScript(inputJson);
  console.log(formatCritiqueReport(critique));
  if (critique.verdict !== "PASS") {
    throw new Error(`Script critique failed with score ${critique.score}/100. Resolve revisions.`);
  }

  // 4. Validate Contract
  console.log(`[make] [4/5] Validating timeline and ingredient contracts...`);
  const validated = validateInput(inputFilePath);

  if (skipRender) {
    console.log(`[make] [5/5] Skipped render (--skip-render or --dry-run active). Recipe and assets ready!`);
    return { status: "ready", input: inputFilePath, critique, validated };
  }

  // 5. Render & Inspect
  console.log(`[make] [5/5] Rendering official 1080p composition...`);
  const renderResult = await render(inputFilePath, outputFile);
  const inspection = inspect(outputFile);

  return {
    status: "completed",
    video: outputFile,
    input: inputFilePath,
    receipt: renderResult.receipt,
    inspection
  };
}

const command = process.argv[2] || "doctor";
if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    if (command === "doctor") doctor();
    else if (command === "check" || command === "validate") console.log(JSON.stringify(validateInput(requiredArgument("input")), null, 2));
    else if (command === "init") {
      const output = path.resolve(requiredArgument("output"));
      mkdirSync(path.dirname(output), { recursive: true });
      copyFileSync(path.join(ROOT, "fixtures", "template", "input.json"), output);
      console.log(`Created ${output}`);
    } else if (command === "render") await render(requiredArgument("input"), requiredArgument("output"));
    else if (command === "inspect") inspect(requiredArgument("input"), argument("report"));
    else if (command === "finalize") finalize(requiredArgument("input"), requiredArgument("report"), requiredArgument("review"), argument("output"));
    else if (command === "smoke") await smoke();
    else if (command === "make") await make();
    else throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
