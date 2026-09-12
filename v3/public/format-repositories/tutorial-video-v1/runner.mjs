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
import { createProgressHud } from "./runtime/hud.mjs";
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

export async function render(inputFile, outputFile, existingHud = null) {
  if (!checkBinary(ffmpeg) || !checkBinary(ffprobe)) throw new Error("Render requires FFmpeg and FFprobe on PATH.");
  if (!checkLocalhostPort()) throw new Error("Render needs permission to bind a localhost port for Remotion's local browser. Grant that local sandbox permission before starting the render; this is not a network or provider call.");
  const inputPath = path.resolve(inputFile);
  const output = path.resolve(outputFile);
  if (path.extname(output).toLowerCase() !== ".mp4") throw new Error("Output must be an .mp4 file.");
  mkdirSync(path.dirname(output), { recursive: true });
  const prepared = validateInput(inputPath);

  const hud = existingHud || createProgressHud({
    title: "WIGGLY COMPOSITOR",
    targetSlug: path.basename(inputFile, ".json"),
    rootDir: ROOT,
    totalStages: 2
  });

  const totalFrames = prepared.durationInFrames || Math.round(prepared.durationSeconds * 30);

  hud.update({
    stageIndex: 1,
    totalStages: 2,
    stageName: "Bundling Remotion React composition...",
    percent: 5,
    totalFrames
  });

  let lastBundleProgress = -1;
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    publicDir: MEDIA_ROOT,
    onProgress: (progress) => {
      const percent = Math.floor(progress / 10) * 10;
      if (percent !== lastBundleProgress) {
        lastBundleProgress = percent;
        hud.update({
          stageIndex: 1,
          totalStages: 2,
          stageName: `Bundling Remotion composition (${percent}%)`,
          percent: Math.round(percent * 0.15),
          totalFrames
        });
      }
    },
  });
  const browserExecutable = bundledBrowser || undefined;
  const composition = await selectComposition({ serveUrl, id: "TutorialVideo", inputProps: prepared, browserExecutable });
  let lastRenderProgress = -1;
  const renderStartTime = Date.now();

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
        const currentFrame = Math.round(progress * totalFrames);
        const elapsedSec = (Date.now() - renderStartTime) / 1000;
        const etaSeconds = progress > 0 ? (elapsedSec / progress) * (1 - progress) : 0;
        hud.update({
          stageIndex: 2,
          totalStages: 2,
          stageName: `Rendering H.264 video frames (${Math.round(progress * 100)}%)`,
          percent: Math.round(15 + progress * 80),
          currentFrame,
          totalFrames,
          etaSeconds
        });
      }
    },
  });
  const metadata = probeMedia(output, ffprobe);
  if (metadata.video?.width !== VIDEO.width || metadata.video?.height !== VIDEO.height) throw new Error("Rendered output is not 1920x1080.");
  if (!metadata.audio) throw new Error("Rendered output is missing audio.");
  if (Math.abs(metadata.durationSeconds - prepared.durationSeconds) > 0.12) throw new Error(`Rendered duration ${metadata.durationSeconds.toFixed(3)}s does not match the ingredient timeline ${prepared.durationSeconds.toFixed(3)}s.`);

  if (!existingHud) {
    hud.finish({
      videoPath: path.relative(ROOT, output),
      durationSeconds: metadata.durationSeconds
    });
  }
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

export function openVideoInPlayer(videoPath) {
  const resolved = path.resolve(videoPath);
  if (!existsSync(resolved)) throw new Error(`Video file does not exist: ${resolved}`);
  const filename = path.basename(resolved);

  if (process.platform === "darwin") {
    // macOS: Close any stale open document with this name in QuickTime to bust the buffer cache, then re-open and play from 00:00
    const script = `
tell application "QuickTime Player"
    activate
    repeat with d in (every document whose name is "${filename}")
        close d saving no
    end repeat
    set movieDoc to open POSIX file "${resolved}"
    tell movieDoc
        set current time to 0
        play
    end tell
end tell
    `.trim();
    try {
      execFileSync("osascript", ["-e", script], { stdio: "ignore" });
      console.log(`[wiggly] Opened ${path.relative(ROOT, resolved)} in QuickTime Player from 00:00.`);
      return true;
    } catch {
      // Fall back to standard open command
      spawnSync("open", ["-a", "QuickTime Player", resolved], { stdio: "ignore" });
      return true;
    }
  } else {
    // Linux/Windows fallback
    const opener = process.platform === "win32" ? "start" : "xdg-open";
    spawnSync(opener, [resolved], { stdio: "ignore" });
    return true;
  }
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

  const hud = createProgressHud({
    title: "WIGGLY TUTORIAL MAKER",
    targetSlug,
    rootDir: ROOT,
    totalStages: 5
  });

  // 1. Harvest Visual Assets
  hud.update({
    stageIndex: 1,
    totalStages: 5,
    stageName: `Harvesting visual assets & proof for ${targetSlug}...`,
    percent: 10
  });
  const harvested = await harvestTargetAssets({ targetSlug, repoRoot: ROOT });

  // 2. Synthesize Audio & Build Narrated Steps with Content-Driven Boundaries
  hud.update({
    stageIndex: 2,
    totalStages: 5,
    stageName: "Synthesizing voiceovers & microsecond caption timings...",
    percent: 25
  });
  const audioOutputDir = path.join(MEDIA_ROOT, targetSlug);
  mkdirSync(audioOutputDir, { recursive: true });

  const proofFullDuration = harvested.proofDuration || 25.0;
  // Step 1: Hook (4.5s)
  const hookDuration = 4.5;
  const step1Hero = {
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
  };

  const isOtaku = targetSlug.includes("otaku") || (harvested.format.name || "").toLowerCase().includes("cartoon");

  // Step 2: Social Proof (8.5s)
  const socialProofMedia = harvested.media.socialProofStill || {
    file: existsSync(path.join(MEDIA_ROOT, "fixed", "viral-benchmark.png"))
      ? "fixed/viral-benchmark.png"
      : "mugsy-explains/mugsyclips-profile.png",
    type: "image"
  };
  const step2Text = isOtaku
    ? `Look at this viral anime explainer breaking down technical ideas through characters. Wiggly packages this exact format so your coding agent can build it locally.`
    : `Look at Mugsy Clips on Instagram with thirty-five thousand followers. Wiggly packages this exact comparison format so your coding agent can build it locally.`;

  const step2Result = await buildNarratedTutorialStep({
    id: "social-proof",
    number: 2,
    label: "Compare with the viral format",
    kind: "social-proof",
    background: "lime",
    mediaPath: socialProofMedia.file,
    mediaType: "image",
    narrationText: step2Text,
    audioRelPath: `${targetSlug}/step-02.wav`,
    audioFullPath: path.join(audioOutputDir, "step-02.wav"),
    voice: "zach",
    minStepDuration: 8.5
  });

  // Step 3: Browser (Copy prompt) (7.5s)
  const browserMedia = harvested.media.browserVideo || harvested.media.browserStill;
  const step3Text = isOtaku
    ? `On Wiggly, open the Cartoon Explainer format, choose Send to Coding Agent, and copy the prompt.`
    : `On Wiggly, open the Mugsy Explains format, choose Send to Coding Agent, and copy the prompt.`;

  const step3Result = await buildNarratedTutorialStep({
    id: "choose-format",
    number: 3,
    label: "Copy the coding agent prompt",
    kind: "browser",
    windowTitle: `Wiggly — ${harvested.format.name}`,
    background: "lime",
    mediaPath: browserMedia.file,
    mediaType: browserMedia.type,
    narrationText: step3Text,
    audioRelPath: `${targetSlug}/step-03.wav`,
    audioFullPath: path.join(audioOutputDir, "step-03.wav"),
    voice: "zach",
    minStepDuration: 7.5
  });

  // Step 4: Terminal (Paste into agent) (8.5s)
  const intakeMedia = harvested.media.intakeVideo || harvested.media.terminalVideo || harvested.media.terminalStill;
  const step4Text = isOtaku
    ? `Paste the instructions into Antigravity or Claude Code. The agent reads the package and sets up your story world.`
    : `Paste the instructions into Antigravity or Claude Code. The agent reads the package and sets up your lessons.`;

  const step4Result = await buildNarratedTutorialStep({
    id: "run-agent",
    number: 4,
    label: "Paste into your coding agent",
    kind: "terminal",
    windowTitle: `Coding Agent (Antigravity / Claude Code) — ${harvested.format.name}`,
    background: "blue",
    mediaPath: intakeMedia.file,
    mediaType: intakeMedia.type,
    mediaFit: "cover",
    narrationText: step4Text,
    audioRelPath: `${targetSlug}/step-04.wav`,
    audioFullPath: path.join(audioOutputDir, "step-04.wav"),
    voice: "zach",
    minStepDuration: 8.5
  });
  if (intakeMedia && intakeMedia.type === "video" && intakeMedia.durationSeconds && step4Result.step.durationSeconds > intakeMedia.durationSeconds) {
    step4Result.step.durationSeconds = Math.floor(intakeMedia.durationSeconds * 30) / 30;
  }
  step4Result.step.checkpoint = {
    eyebrow: "Your checkpoint",
    headline: "The agent is using the packaged compositor—not inventing a slideshow.",
    badge: "Verified 0 providers"
  };

  // Step 5: Review Lessons Checkpoint (8.5s)
  const reviewMedia = harvested.media.reviewVideo || harvested.media.terminalVideo || harvested.media.terminalStill;
  const step5Text = isOtaku
    ? `Review the character roles and dialogue script before rendering. You stay in complete control of the story.`
    : `Review the three comparative lessons and character poses before rendering. You stay in control of the creative output.`;

  const step5Result = await buildNarratedTutorialStep({
    id: "review-lessons",
    number: 5,
    label: isOtaku ? "Review the scene plan" : "Review the lesson plan",
    kind: "terminal",
    windowTitle: isOtaku ? `Antigravity — Scene Plan Review` : `Antigravity — Lesson Review`,
    background: "blue",
    mediaPath: reviewMedia.file,
    mediaType: reviewMedia.type,
    mediaFit: "cover",
    narrationText: step5Text,
    audioRelPath: `${targetSlug}/step-05.wav`,
    audioFullPath: path.join(audioOutputDir, "step-05.wav"),
    voice: "zach",
    minStepDuration: 8.5
  });
  if (reviewMedia && reviewMedia.type === "video" && reviewMedia.durationSeconds && step5Result.step.durationSeconds > reviewMedia.durationSeconds) {
    step5Result.step.durationSeconds = Math.floor(reviewMedia.durationSeconds * 30) / 30;
  }
  step5Result.step.checkpoint = isOtaku ? {
    eyebrow: "Your one checkpoint",
    headline: "Review the story world dialogue and character cast.",
    badge: "Then approve"
  } : {
    eyebrow: "Your one checkpoint",
    headline: "Review the 3 comparative lessons and character poses.",
    badge: "Then approve"
  };

  // Step 6: Package Breakdown (8.0s)
  const step6Text = isOtaku
    ? `The package includes transparent character renders, story backgrounds, and voice models. No external image generator is required.`
    : `The package includes five expressive cartoon poses and the handwritten Virgil font. No external image generator is required.`;

  const step6Result = await buildNarratedTutorialStep({
    id: "package-breakdown",
    number: 6,
    label: "Inspect the included assets",
    kind: "package-breakdown",
    background: "lime",
    narrationText: step6Text,
    audioRelPath: `${targetSlug}/step-06.wav`,
    audioFullPath: path.join(audioOutputDir, "step-06.wav"),
    voice: "zach",
    minStepDuration: 8.0
  });

  // Step 7: Replacement Value ($0) (8.0s)
  const step7Result = await buildNarratedTutorialStep({
    id: "replacement-value",
    number: 7,
    label: "Verify zero generation fees",
    kind: "replacement-value",
    background: "lime",
    narrationText: `You don't need an image model, a video model, or a dedicated GPU. Everything renders locally with zero API credits.`,
    audioRelPath: `${targetSlug}/step-07.wav`,
    audioFullPath: path.join(audioOutputDir, "step-07.wav"),
    voice: "zach",
    minStepDuration: 8.0
  });

  // Step 8: Approve & Render (7.5s)
  const renderMedia = harvested.media.renderVideo || harvested.media.terminalVideo || harvested.media.terminalStill;
  const step8Result = await buildNarratedTutorialStep({
    id: "approve-render",
    number: 8,
    label: "Approve and render the video",
    kind: "terminal",
    windowTitle: `Coding Agent — Final Render`,
    background: "blue",
    mediaPath: renderMedia.file,
    mediaType: renderMedia.type,
    mediaFit: "cover",
    narrationText: `Once you approve the plan, the agent runs the local compositor and builds the final video.`,
    audioRelPath: `${targetSlug}/step-08.wav`,
    audioFullPath: path.join(audioOutputDir, "step-08.wav"),
    voice: "zach",
    minStepDuration: 7.5
  });
  if (renderMedia && renderMedia.type === "video" && renderMedia.durationSeconds && step8Result.step.durationSeconds > renderMedia.durationSeconds) {
    step8Result.step.durationSeconds = Math.floor(renderMedia.durationSeconds * 30) / 30;
  }
  step8Result.step.checkpoint = {
    eyebrow: "Final MP4",
    headline: "Video rendered and verified locally.",
    badge: "Ready to post"
  };

  // Step 9: Finished Output Payoff (8.0s)
  const step9Proof = {
    id: "finished-output",
    kind: "final",
    number: "9",
    label: "Watch the finished output",
    background: "lime",
    durationSeconds: 8.0,
    nativeAudio: true,
    media: {
      type: "video",
      file: harvested.media.proofVideo.file,
      startSeconds: 0,
      fit: "contain",
      authorized: true,
      provenance: harvested.media.proofVideo.provenance
    }
  };

  // Step 10: 13/13 Quality Scorecard (7.5s)
  const step10Result = await buildNarratedTutorialStep({
    id: "scorecard",
    number: 10,
    label: "Verify the quality scorecard",
    kind: "scorecard",
    background: "lime",
    narrationText: `Every video passes thirteen automated quality checks for audio sync, dimensions, and timing.`,
    audioRelPath: `${targetSlug}/step-10.wav`,
    audioFullPath: path.join(audioOutputDir, "step-10.wav"),
    voice: "zach",
    minStepDuration: 7.5
  });

  // Step 11: Beginner Checklist (7.5s)
  const step11Text = isOtaku
    ? `To make your own, pick a topic, choose a story world, and run the prompt in your favorite coding agent.`
    : `To make your own, pick a topic, choose three lessons, and run the prompt in your favorite coding agent.`;

  const step11Result = await buildNarratedTutorialStep({
    id: "checklist",
    number: 11,
    label: "Start with the beginner checklist",
    kind: "checklist",
    background: "cream",
    narrationText: step11Text,
    audioRelPath: `${targetSlug}/step-11.wav`,
    audioFullPath: path.join(audioOutputDir, "step-11.wav"),
    voice: "zach",
    minStepDuration: 7.5
  });

  // Step 12: Workflow Replacement & CTA (7.5s)
  const step12Result = await buildNarratedTutorialStep({
    id: "workflow",
    number: 12,
    label: "Replace three separate tools",
    kind: "workflow",
    background: "lime",
    narrationText: `Wiggly replaces drawing tools, voice subscriptions, and video editors. The link to get started is below.`,
    audioRelPath: `${targetSlug}/step-12.wav`,
    audioFullPath: path.join(audioOutputDir, "step-12.wav"),
    voice: "zach",
    minStepDuration: 7.5
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
      step1Hero,
      step2Result.step,
      step3Result.step,
      step4Result.step,
      step5Result.step,
      step6Result.step,
      step7Result.step,
      step8Result.step,
      step9Proof,
      step10Result.step,
      step11Result.step,
      step12Result.step
    ]
  };

  const inputDir = path.join(ROOT, "inputs");
  mkdirSync(inputDir, { recursive: true });
  const inputFilePath = recipeOption ? path.resolve(recipeOption) : path.join(inputDir, `${targetSlug}.json`);
  writeFileSync(inputFilePath, JSON.stringify(inputJson, null, 2) + "\n");
  console.log(`[make] Wrote generated tutorial recipe to ${path.relative(ROOT, inputFilePath)}`);

  // 3. Critique Script
  hud.update({
    stageIndex: 3,
    totalStages: 5,
    stageName: "Evaluating 5-Law Retention Critique...",
    percent: 35
  });
  console.log(`[make] [3/5] Running 5-law script critique linter...`);
  const critique = critiqueTutorialScript(inputJson);
  console.log(formatCritiqueReport(critique));
  if (critique.verdict !== "PASS") {
    throw new Error(`Script critique failed with score ${critique.score}/100. Resolve revisions.`);
  }

  // 4. Validate Contract
  hud.update({
    stageIndex: 4,
    totalStages: 5,
    stageName: "Validating timeline and ingredient contracts...",
    percent: 40
  });
  console.log(`[make] [4/5] Validating timeline and ingredient contracts...`);
  const validated = validateInput(inputFilePath);

  if (skipRender) {
    console.log(`[make] [5/5] Skipped render (--skip-render or --dry-run active). Recipe and assets ready!`);
    hud.finish({
      videoPath: path.relative(ROOT, inputFilePath),
      durationSeconds: validated.durationSeconds
    });
    return { status: "ready", input: inputFilePath, critique, validated };
  }

  // 5. Render & Inspect
  console.log(`[make] [5/5] Rendering official 1080p composition...`);
  const renderResult = await render(inputFilePath, outputFile, hud);
  const inspection = inspect(outputFile);

  hud.finish({
    videoPath: path.relative(ROOT, outputFile),
    durationSeconds: inspection.metadata?.durationSeconds || validated.durationSeconds
  });

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
    else if (command === "open") openVideoInPlayer(requiredArgument("input"));
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
