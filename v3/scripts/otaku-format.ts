import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertRenderAllowed,
  buildProvenance,
  canFinalize,
  evaluateRequirements,
  materializeScenePlan,
  maxRenderAttempts,
  validateScenePlan,
  type OtakuLayoutManifest,
  type OtakuQualityReport,
  type OtakuRequirementManifest,
  type OtakuScenePlan,
  type OtakuWorldPack,
} from "../features/experiments/otaku-format/agentRunner";
import {
  analyzeAudioSignal,
  audioDoesNotClip,
  evaluateVoiceSignal,
  generateFishClip,
  musicDialogueMarginDb,
  prepareMusicBed,
  probeDurationMs,
  sceneDurationFromAudioMs,
} from "./otaku-media";

const filename = fileURLToPath(import.meta.url);
const v3Root = path.resolve(path.dirname(filename), "..");
const packageRoot = path.join(v3Root, "public", "format-repositories", "otaku-explainer-v1");
const agentRunsRoot = path.join(packageRoot, "agent-runs");
const require = createRequire(import.meta.url);

type AudioManifest = {
  provider: string;
  model: string;
  dialogue: { speed: number };
  music: { localPath: string; volume: number };
};

type AgentRunState = {
  id: string;
  status: "draft" | "rendering" | "rendered" | "inspected" | "finalized";
  createdAt: string;
  approval?: { approvedAt: string; maxAttempts: number };
  attempts: Array<{
    number: number;
    status: "rendering" | "rendered" | "failed";
    createdAt: string;
    runRecord: string;
    output: string;
    contactSheet: string;
    report: string;
    error?: string;
  }>;
  finalAttempt?: number;
  finalizedAt?: string;
};

const readJson = async <T,>(filePath: string) => JSON.parse(await readFile(filePath, "utf8")) as T;
const writeJson = async (filePath: string, value: unknown) => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

function argument(name: string) {
  const equals = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (equals) return equals.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function requiredArgument(name: string) {
  const value = argument(name);
  if (!value) throw new Error(`--${name} is required.`);
  return value;
}

function runDirectory(runId: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(runId)) throw new Error("Run id must use lowercase letters, numbers, and hyphens.");
  return path.join(agentRunsRoot, runId);
}

async function loadEnvironment() {
  const envPath = path.join(v3Root, ".env.local");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

async function commandAvailable(command: string, versionFlag = "-version") {
  return await new Promise<boolean>((resolve) => {
    const child = spawn(command, [versionFlag], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function runProcess(command: string, args: string[], capture = false) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd: v3Root, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    }
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} failed${stderr ? `: ${stderr.slice(-800)}` : ""}`)));
  });
}

async function loadPlan(runId: string) {
  return await readJson<OtakuScenePlan>(path.join(runDirectory(runId), "scene-plan.json"));
}

async function loadState(runId: string) {
  return await readJson<AgentRunState>(path.join(runDirectory(runId), "state.json"));
}

async function loadWorld(worldId: string) {
  const worldPath = path.join(packageRoot, "worlds", `${worldId}.json`);
  if (!existsSync(worldPath)) throw new Error(`Story world ${worldId} is not packaged. New assets require a separate approved phase.`);
  return await readJson<OtakuWorldPack>(worldPath);
}

async function validateRun(runId: string) {
  const plan = await loadPlan(runId);
  const world = await loadWorld(plan.input.storyWorld);
  const layouts = await readJson<OtakuLayoutManifest>(path.join(packageRoot, "layouts.json"));
  const errors = validateScenePlan(plan, world, layouts);
  return { plan, world, layouts, errors };
}

async function check() {
  await loadEnvironment();
  const stage = argument("stage") ?? "validate";
  if (!["validate", "render"].includes(stage)) throw new Error("--stage must be validate or render.");
  const manifest = await readJson<OtakuRequirementManifest>(path.join(packageRoot, "requirements.json"));
  const tools = {
    node: true,
    ffmpeg: await commandAvailable("ffmpeg"),
    ffprobe: await commandAvailable("ffprobe"),
    uvx: await commandAvailable("uvx", "--version"),
    remotion: (() => {
      try { require.resolve("remotion"); return true; } catch { return false; }
    })(),
  };
  const result = evaluateRequirements({
    command: stage,
    environment: process.env,
    manifest,
    needsNewAssets: hasFlag("needs-new-assets"),
    tools,
  });
  console.log(result.ok ? `Otaku Format ${stage} stage is ready.` : `Otaku Format ${stage} stage is not ready.`);
  if (result.missingEnvironment.length) console.log(`Add to v3/.env.local: ${result.missingEnvironment.join(", ")}`);
  if (result.missingTools.length) console.log(`Install locally: ${result.missingTools.join(", ")}`);
  console.log("Secret values were not read back or printed.");
  if (!result.ok) process.exitCode = 1;
}

async function init() {
  const runId = requiredArgument("run");
  const topic = requiredArgument("topic");
  const worldId = requiredArgument("world");
  await loadWorld(worldId);
  const directory = runDirectory(runId);
  if (existsSync(directory)) throw new Error(`Run ${runId} already exists.`);
  const plan: OtakuScenePlan = { id: runId, title: `${worldId} explains ${topic}`, input: { topic, storyWorld: worldId }, scenes: [] };
  const state: AgentRunState = { id: runId, status: "draft", createdAt: new Date().toISOString(), attempts: [] };
  await writeJson(path.join(directory, "scene-plan.json"), plan);
  await writeJson(path.join(directory, "state.json"), state);
  console.log(`Created ${path.relative(v3Root, directory)}.`);
  console.log("Write 12–18 scenes, then run validate. No media was generated.");
}

async function validate() {
  const runId = requiredArgument("run");
  const { plan, world, errors } = await validateRun(runId);
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  const estimateMs = plan.scenes.reduce((total, scene) => total + scene.estimatedDurationMs, 0);
  const roles = [...new Set(plan.scenes.flatMap((scene) => scene.visibleRoles))];
  console.log(`Valid: ${plan.scenes.length} scenes · about ${Math.round(estimateMs / 1000)} seconds.`);
  console.log(`World: ${world.label} · roles: ${roles.join(", ")}.`);
  console.log("Estimated media work: one Fish voice clip per scene and one local Remotion render per attempt.");
}

async function render() {
  await loadEnvironment();
  const apiKey = process.env.FISH_STUDIO_APIKEY;
  if (!apiKey) throw new Error("FISH_STUDIO_APIKEY is missing. Add it to v3/.env.local; do not paste it into chat.");
  const runId = requiredArgument("run");
  const { plan, world, layouts, errors } = await validateRun(runId);
  if (errors.length) throw new Error(`Validation failed before media spend:\n${errors.join("\n")}`);
  const state = await loadState(runId);
  if (hasFlag("approve-loop") && !state.approval) state.approval = { approvedAt: new Date().toISOString(), maxAttempts: maxRenderAttempts };
  assertRenderAllowed(state.attempts.length, Boolean(state.approval));

  const attemptNumber = state.attempts.length + 1;
  const attemptDirectory = path.join(runDirectory(runId), `attempt-${attemptNumber}`);
  const runRecordPath = path.join(attemptDirectory, "run.json");
  const outputPath = path.join(attemptDirectory, "video.mp4");
  const contactSheetPath = path.join(attemptDirectory, "contact-sheet.jpg");
  const reportPath = path.join(attemptDirectory, "quality-report.json");
  const relativeAttempt = path.relative(packageRoot, attemptDirectory).split(path.sep).join("/");
  state.status = "rendering";
  state.attempts.push({
    number: attemptNumber,
    status: "rendering",
    createdAt: new Date().toISOString(),
    runRecord: `${relativeAttempt}/run.json`,
    output: `${relativeAttempt}/video.mp4`,
    contactSheet: `${relativeAttempt}/contact-sheet.jpg`,
    report: `${relativeAttempt}/quality-report.json`,
  });
  await writeJson(path.join(runDirectory(runId), "state.json"), state);

  try {
    const audio = await readJson<AudioManifest>(path.join(packageRoot, "audio.json"));
    const format = await readJson<{ version: string }>(path.join(packageRoot, "format.json"));
    const music = world.music ?? audio.music;
    const concreteScenes = materializeScenePlan(plan, world, layouts);
    for (const [index, scene] of concreteScenes.entries()) {
      const role = plan.scenes[index].speakerRole;
      const audioFile = path.join(attemptDirectory, "audio", `${scene.id}.wav`);
      console.log(`[${index + 1}/${concreteScenes.length}] ${role}: ${scene.dialogue}`);
      await generateFishClip({ apiKey, outputPath: audioFile, speed: audio.dialogue.speed, text: scene.dialogue, voiceId: world.roles[role].voice });
      scene.audioPath = `format-repositories/otaku-explainer-v1/${relativeAttempt}/audio/${scene.id}.wav`;
      scene.durationMs = sceneDurationFromAudioMs(await probeDurationMs(audioFile));
    }
    const totalDurationMs = concreteScenes.reduce((total, scene) => total + (scene.durationMs || 0), 0);
    const musicFile = path.join(attemptDirectory, "music.mp3");
    await prepareMusicBed({
      outputPath: musicFile,
      sourcePath: path.join(packageRoot, music.localPath),
      targetDurationMs: totalDurationMs,
    });
    const characters = Object.values(world.roles).map((role) => role.character);
    const runRecord = {
      id: `${runId}-attempt-${attemptNumber}`,
      title: plan.title,
      createdAt: new Date().toISOString(),
      input: { ...plan.input, cast: characters },
      renderer: "renderer/OtakuFormatRenderer.tsx",
      rendererVersion: "otaku-format-renderer@1.1.0-experiment",
      provider: audio.provider,
      model: audio.model,
      voiceAssignments: Object.fromEntries(Object.values(world.roles).map((role) => [role.character, role.voice])),
      musicPath: `format-repositories/otaku-explainer-v1/${relativeAttempt}/music.mp3`,
      musicLoop: false,
      musicVolume: music.volume,
      scenes: concreteScenes,
      qualityChecks: "quality.json",
      output: `format-repositories/otaku-explainer-v1/${relativeAttempt}/video.mp4`,
      contactSheet: `format-repositories/otaku-explainer-v1/${relativeAttempt}/contact-sheet.jpg`,
      provenance: buildProvenance(plan, format.version),
      attempt: attemptNumber,
    };
    await writeJson(runRecordPath, runRecord);
    await runProcess("npm", [
      "run", "prototype:otaku:render", "--",
      `--run-record=${runRecordPath}`,
      `--output=${outputPath}`,
      `--contact-sheet=${contactSheetPath}`,
    ]);
    state.attempts[attemptNumber - 1].status = "rendered";
    state.status = "rendered";
    console.log(`Attempt ${attemptNumber} rendered. Run inspect next.`);
  } catch (error) {
    state.attempts[attemptNumber - 1].status = "failed";
    state.attempts[attemptNumber - 1].error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await writeJson(path.join(runDirectory(runId), "state.json"), state);
  }
}

async function inspect() {
  const runId = requiredArgument("run");
  const state = await loadState(runId);
  const attempt = state.attempts.at(-1);
  if (!attempt || attempt.status !== "rendered") throw new Error("The latest attempt has not rendered successfully.");
  const directory = runDirectory(runId);
  const runRecord = await readJson<{
    musicVolume: number;
    musicPath: string;
    scenes: Array<{ id: string; durationMs?: number; audioPath?: string }>;
  }>(path.join(packageRoot, attempt.runRecord));
  const outputPath = path.join(packageRoot, attempt.output);
  const contactSheetPath = path.join(packageRoot, attempt.contactSheet);
  const technical = JSON.parse(await runProcess("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=width,height:format=duration",
    "-of", "json",
    outputPath,
  ], true)) as { streams?: Array<{ width?: number; height?: number }>; format?: { duration?: string } };
  const expectedDurationMs = runRecord.scenes.reduce((total, scene) => total + (scene.durationMs || 0), 0);
  const actualDurationMs = Math.round(Number(technical.format?.duration || 0) * 1000);
  const stream = technical.streams?.[0];
  const audioPaths = runRecord.scenes.map((scene) => {
    if (!scene.audioPath) return undefined;
    return path.join(v3Root, "public", scene.audioPath);
  });
  const audioDurations = await Promise.all(audioPaths.map(async (audioPath) => (
    audioPath && existsSync(audioPath) ? await probeDurationMs(audioPath) : undefined
  )));
  const voiceSignals = await Promise.all(audioPaths.map(async (audioPath) => (
    audioPath && existsSync(audioPath) ? await analyzeAudioSignal(audioPath) : undefined
  )));
  const presentVoiceSignals = voiceSignals.filter((signal) => signal !== undefined);
  const musicPath = path.join(v3Root, "public", runRecord.musicPath);
  const musicDurationMs = existsSync(musicPath) ? await probeDurationMs(musicPath) : 0;
  const musicSignal = existsSync(musicPath) ? await analyzeAudioSignal(musicPath) : undefined;
  const finalMixSignal = existsSync(outputPath) ? await analyzeAudioSignal(outputPath) : undefined;
  const voiceChecks = voiceSignals.map((signal) => signal ? evaluateVoiceSignal(signal) : undefined);
  const musicMarginDb = musicSignal
    ? musicDialogueMarginDb(presentVoiceSignals, musicSignal, runRecord.musicVolume)
    : Number.NEGATIVE_INFINITY;
  const automaticChecks = {
    videoExists: existsSync(outputPath),
    contactSheetExists: existsSync(contactSheetPath),
    dimensionsAre720x1280: stream?.width === 720 && stream?.height === 1280,
    durationMatchesScenes: Math.abs(actualDurationMs - expectedDurationMs) <= 1_500,
    everySceneHasAudio: audioPaths.every((audioPath) => Boolean(audioPath && existsSync(audioPath))),
    sceneTimingMatchesVoiceTracks: runRecord.scenes.every((scene, index) => (
      audioDurations[index] !== undefined
      && Math.abs((scene.durationMs || 0) - audioDurations[index]!) <= 40
    )),
    voiceClipsAreAudible: voiceChecks.length === runRecord.scenes.length
      && voiceChecks.every((checks) => checks?.audible),
    voiceClipEdgesAreClean: voiceChecks.length === runRecord.scenes.length
      && voiceChecks.every((checks) => checks?.edgesAreClean),
    voiceClipEndingsAreNotAbrupt: voiceChecks.length === runRecord.scenes.length
      && voiceChecks.every((checks) => checks?.endingIsNotAbrupt),
    voiceClipsDoNotClip: voiceChecks.length === runRecord.scenes.length
      && voiceChecks.every((checks) => checks?.doesNotClip),
    musicCoversFullVideo: musicDurationMs >= expectedDurationMs - 100,
    musicStaysBelowDialogue: musicMarginDb >= 6,
    finalMixHasAudibleAudio: Boolean(finalMixSignal && finalMixSignal.meanVolumeDb >= -35),
    finalMixDoesNotClip: Boolean(finalMixSignal && audioDoesNotClip(finalMixSignal)),
    attemptLimitRespected: attempt.number <= maxRenderAttempts,
  };
  const failedAutomaticChecks = Object.entries(automaticChecks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `Automatic check failed: ${name}.`);
  const report: OtakuQualityReport = {
    attempt: attempt.number,
    automaticChecks,
    creativeReview: {
      lessonAccurate: false,
      dialogueNatural: false,
      charactersGrounded: false,
      textFits: false,
      audioClear: false,
      analogyMakesSense: false,
    },
    problems: [...failedAutomaticChecks, "Agent creative review is not complete."],
    status: "fail",
  };
  await writeJson(path.join(packageRoot, attempt.report), report);
  state.status = "inspected";
  await writeJson(path.join(directory, "state.json"), state);
  console.log(`Technical report written for attempt ${attempt.number}. Inspect the video and contact sheet, then record the creative review.`);
}

async function finalize() {
  const runId = requiredArgument("run");
  const state = await loadState(runId);
  const attempt = state.attempts.at(-1);
  if (!attempt || !existsSync(path.join(packageRoot, attempt.report))) throw new Error("Inspect the latest rendered attempt first.");
  const report = await readJson<OtakuQualityReport>(path.join(packageRoot, attempt.report));
  if (!canFinalize(report)) throw new Error("The latest quality report does not pass every automatic and creative check.");
  state.status = "finalized";
  state.finalAttempt = attempt.number;
  state.finalizedAt = new Date().toISOString();
  await writeJson(path.join(runDirectory(runId), "state.json"), state);
  await writeJson(path.join(runDirectory(runId), "final.json"), {
    runId,
    attempt: attempt.number,
    finalizedAt: state.finalizedAt,
    output: attempt.output,
    contactSheet: attempt.contactSheet,
    qualityReport: attempt.report,
    runRecord: attempt.runRecord,
  });
  console.log(`Finalized ${runId} at attempt ${attempt.number}.`);
}

async function main() {
  const command = process.argv[2];
  if (command === "check") return await check();
  if (command === "init") return await init();
  if (command === "validate") return await validate();
  if (command === "render") return await render();
  if (command === "inspect") return await inspect();
  if (command === "finalize") return await finalize();
  throw new Error("Use: check | init | validate | render | inspect | finalize");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
