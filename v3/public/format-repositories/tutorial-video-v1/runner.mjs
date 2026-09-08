#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const bin = (name, fallback) => process.env[name] || fallback;
const ffmpeg = bin("FFMPEG", "ffmpeg");
const ffprobe = bin("FFPROBE", "ffprobe");

function arg(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(3).find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { stdio: "inherit", ...options });
}

function checkBinary(command) {
  const result = spawnSync(command, ["-version"], { stdio: "ignore" });
  return result.status === 0;
}

function loadInput(file, { allowExternal = false } = {}) {
  const inputPath = path.resolve(ROOT, file);
  if ((!allowExternal && !inputPath.startsWith(`${ROOT}${path.sep}`)) || !existsSync(inputPath))
    throw new Error(`Input file must exist inside the kit: ${file}`);
  const input = JSON.parse(readFileSync(inputPath, "utf8"));
  const required = ["title", "sourceFormat", "sourceVideo", "aspectRatio", "captionStrategy", "steps"];
  for (const key of required)
    if (!(key in input)) throw new Error(`Input missing required field: ${key}`);
  if (input.aspectRatio !== "16:9") throw new Error("Tutorial output must be 16:9.");
  if (input.durationSeconds !== undefined &&
      (typeof input.durationSeconds !== "number" || !Number.isFinite(input.durationSeconds) || input.durationSeconds < 1))
    throw new Error("durationSeconds, when supplied, must be a positive number.");
  if (!Array.isArray(input.steps) || input.steps.length < 4) throw new Error("Input needs at least four declared steps.");
  const source = path.resolve(path.dirname(inputPath), input.sourceVideo);
  if ((!allowExternal && !source.startsWith(`${ROOT}${path.sep}`)) || !existsSync(source))
    throw new Error(`Source video must exist inside the kit: ${input.sourceVideo}`);
  return { input, inputPath, source };
}

function probe(file) {
  const raw = execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels", "-of", "json", file], { encoding: "utf8" });
  const data = JSON.parse(raw);
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  const audio = data.streams?.find((stream) => stream.codec_type === "audio");
  return { durationSeconds: Number(data.format?.duration || 0), video, audio };
}

function render(inputFile, outputFile, options = {}) {
  const { input, source } = loadInput(inputFile, options);
  const output = path.resolve(outputFile);
  mkdirSync(path.dirname(output), { recursive: true });
  const sourceMeta = probe(source);
  if (!sourceMeta.video || !sourceMeta.audio) throw new Error("Source tutorial master needs video and audio streams.");
  if (sourceMeta.video.width / sourceMeta.video.height !== 16 / 9) throw new Error("Source master is not 16:9.");
  const targetDuration = sourceMeta.durationSeconds;
  if (input.durationSeconds !== undefined && Math.abs(input.durationSeconds - targetDuration) > 0.15)
    throw new Error(`durationSeconds must match the source duration (${targetDuration.toFixed(3)}s); this runner never retimes or trims the master.`);
  run(ffmpeg, ["-y", "-i", source, "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", output]);
  const result = probe(output);
  if (result.video?.width !== 1920 || result.video?.height !== 1080) throw new Error("Rendered output is not 1920x1080.");
  if (Math.abs(result.durationSeconds - targetDuration) > 0.15) throw new Error(`Rendered output is ${result.durationSeconds.toFixed(3)}s, not the source duration ${targetDuration.toFixed(3)}s.`);
  if (result.video?.codec_name !== "h264" || result.audio?.codec_name !== "aac") throw new Error("Rendered output codecs do not match the contract.");
  return { input, sourceMeta, result, outputSha256: createHash("sha256").update(readFileSync(output)).digest("hex"), output };
}

function doctor() {
  const checks = { node: process.versions.node, ffmpeg: checkBinary(ffmpeg), ffprobe: checkBinary(ffprobe) };
  console.log(JSON.stringify(checks, null, 2));
  if (!checks.ffmpeg || !checks.ffprobe) process.exitCode = 1;
}

function smoke() {
  if (!checkBinary(ffmpeg) || !checkBinary(ffprobe)) throw new Error("Smoke requires ffmpeg and ffprobe.");
  const dir = path.join(os.tmpdir(), `wiggly-tutorial-smoke-${process.pid}`);
  mkdirSync(dir, { recursive: true });
  const source = path.join(dir, "source.mp4");
  run(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=navy:s=1920x1080:r=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", source]);
  const input = path.join(dir, "input.json");
  writeFileSync(input, JSON.stringify({ title: "offline smoke", sourceFormat: "smoke", sourceVideo: "source.mp4", aspectRatio: "16:9", captionStrategy: "burned-in", steps: ["proof", "handoff", "approval", "render"] }));
  const result = render(input, path.join(dir, "output.mp4"), { allowExternal: true });
  console.log(`smoke passed: ${result.result.video.width}x${result.result.video.height}, ${result.result.durationSeconds.toFixed(3)}s`);
}

const command = process.argv[2] || "doctor";
if (command === "doctor") doctor();
else if (command === "check") loadInput(arg("input"));
else if (command === "render") {
  const input = arg("input");
  const output = arg("output");
  if (!input || !output) throw new Error("render requires --input=<input.json> and --output=<output.mp4>");
  const result = render(input, output);
  console.log(JSON.stringify({ output: result.output, outputSha256: result.outputSha256, durationSeconds: result.result.durationSeconds }, null, 2));
} else if (command === "inspect") {
  const file = arg("input");
  if (!file) throw new Error("inspect requires --input=<video.mp4>");
  console.log(JSON.stringify(probe(path.resolve(file)), null, 2));
} else if (command === "smoke") smoke();
else throw new Error(`Unknown command: ${command}`);
