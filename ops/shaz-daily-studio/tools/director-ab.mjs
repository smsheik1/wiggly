#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { askActiveAgent } from "../../../v3/lib/agent-bridge.ts";
import { execute, measuredAudioDuration, probeMedia, resolveRunDirectory, sha256, writeJson } from "../../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/run-common.mjs";
import { planShotsWithAgent } from "../agent-director.mjs";
import { loadStudioConfig } from "../studio-daily.mjs";
import { composeVerticalVideo, formatSafeHeadline } from "../vertical-letterbox.mjs";
import {
  answerTelegramCallback,
  escapeTelegramHtml,
  flushTelegramBacklog,
  getTelegramCredentials,
  parseTelegramApiResponse,
  sendTelegramMessage,
} from "../telegram-approval.mjs";

const STUDIO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KIT_ROOT = path.resolve(STUDIO_ROOT, "../../v3/public/format-repositories/shaz-puppet-runtime-v1");
export const DEFAULT_AB_RESULTS_PATH = path.join(STUDIO_ROOT, "director-ab-results.json");

async function readJsonFile(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function copyDirContents(srcDir, dstDir) {
  if (!fsSync.existsSync(srcDir)) return [];
  await fs.mkdir(dstDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  const copied = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    await fs.copyFile(src, dst);
    copied.push(path.posix.join("media", entry.name));
  }
  return copied;
}

/**
 * Generates randomized blind A/B assignment `[ { label: "A", director }, { label: "B", director } ]`
 * using unbiased RNG (`crypto.randomInt` by default).
 */
export function buildBlindAssignment({ rngIntFn = (max) => crypto.randomInt(0, max) } = {}) {
  const agentFirst = rngIntFn(2) === 0;
  return agentFirst
    ? { A: "agent", B: "jev" }
    : { A: "jev", B: "agent" };
}

/**
 * Sends a local MP4 via Telegram `sendVideo` with a blind caption (`Option A` or `Option B`).
 */
export async function sendBlindCandidateVideo({
  videoPath,
  caption,
  token: explicitToken,
  chatId: explicitChatId,
  env = process.env,
  fetchFn = fetch,
}) {
  const { token, chatId } = getTelegramCredentials({ token: explicitToken, chatId: explicitChatId, env });
  const fileBuffer = await fs.readFile(videoPath);
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("supports_streaming", "true");
  formData.append("caption", caption);
  formData.append("parse_mode", "HTML");
  formData.append("video", new Blob([fileBuffer], { type: "video/mp4" }), path.basename(videoPath));

  const res = await fetchFn(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: "POST",
    body: formData,
  });
  const data = await parseTelegramApiResponse(res, "sendVideo", token);
  return data.result;
}

/**
 * Dispatches blind Option A and Option B videos plus Pick A / Pick B / Tie buttons to Telegram.
 */
export async function dispatchBlindAbPrompt({
  pairId,
  storyTitle,
  optionAVideoPath,
  optionBVideoPath,
  env = process.env,
  fetchFn = fetch,
  sendVideoFn = sendBlindCandidateVideo,
  sendMessageFn = sendTelegramMessage,
}) {
  await sendVideoFn({
    videoPath: optionAVideoPath,
    caption: `<b>Option A</b>\nTopic: ${escapeTelegramHtml(storyTitle)}\nPair: <code>${escapeTelegramHtml(pairId)}</code>`,
    env,
    fetchFn,
  });
  await sendVideoFn({
    videoPath: optionBVideoPath,
    caption: `<b>Option B</b>\nTopic: ${escapeTelegramHtml(storyTitle)}\nPair: <code>${escapeTelegramHtml(pairId)}</code>`,
    env,
    fetchFn,
  });

  return sendMessageFn({
    text:
      `🧪 <b>Blind Director A/B Test</b>\n\n` +
      `<b>Topic:</b> ${escapeTelegramHtml(storyTitle)}\n` +
      `Pair ID: <code>${escapeTelegramHtml(pairId)}</code>\n\n` +
      `Watch <b>Option A</b> and <b>Option B</b> above, then pick the better-directed cut:`,
    replyMarkup: {
      inline_keyboard: [[
        { text: "Pick A", callback_data: `ab_pick:${pairId}:A` },
        { text: "Pick B", callback_data: `ab_pick:${pairId}:B` },
        { text: "Tie / Neither", callback_data: `ab_pick:${pairId}:tie` },
      ]],
    },
    env,
    fetchFn,
  });
}

/**
 * Polls Telegram for operator-only blind A/B vote (`ab_pick:<pairId>:A|B|tie`).
 * Rejects and logs any unauthorized user/chat taps.
 */
export async function pollBlindAbVote({
  pairId,
  initialUpdateId = 0,
  timeoutSeconds = 86_400,
  pollIntervalMs = 2500,
  token: explicitToken,
  chatId: explicitChatId,
  operatorUserId: explicitOperatorUserId,
  env = process.env,
  fetchFn = fetch,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  nowFn = () => new Date(),
} = {}) {
  const { token, chatId, operatorUserId } = getTelegramCredentials({
    requireOperator: true,
    token: explicitToken,
    chatId: explicitChatId,
    operatorUserId: explicitOperatorUserId,
    env,
  });
  const deadlineMs = nowFn().getTime() + Math.max(1, Number(timeoutSeconds)) * 1000;
  let lastUpdateId = Number(initialUpdateId) || 0;
  const unauthorizedTaps = [];
  const prefix = `ab_pick:${pairId}:`;

  while (nowFn().getTime() < deadlineMs) {
    const remainingSec = Math.max(1, Math.min(10, Math.ceil((deadlineMs - nowFn().getTime()) / 1000)));
    const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=${remainingSec}`;
    const res = await fetchFn(url);
    const data = await parseTelegramApiResponse(res, "getUpdates", token);

    for (const update of Array.isArray(data.result) ? data.result : []) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      const cb = update.callback_query;
      if (!cb?.data) continue;

      const authorized = (
        cb.from?.id !== undefined && cb.from?.id !== null &&
        cb.message?.chat?.id !== undefined && cb.message?.chat?.id !== null &&
        String(cb.from.id) === String(operatorUserId) &&
        String(cb.message.chat.id) === String(chatId)
      );
      if (!authorized) {
        unauthorizedTaps.push({
          userId: cb.from?.id ?? null,
          chatId: cb.message?.chat?.id ?? null,
          at: nowFn().toISOString(),
          data: cb.data,
        });
        await answerTelegramCallback(token, cb.id, "Not allowed", { showAlert: true, fetchFn });
        continue;
      }

      if (cb.data.startsWith(prefix)) {
        const vote = cb.data.slice(prefix.length);
        if (vote === "A" || vote === "B" || vote === "tie") {
          await answerTelegramCallback(token, cb.id, `Recorded blind vote: ${vote}`, { fetchFn });
          return {
            winnerLabel: vote,
            telegramUserId: cb.from?.id ?? null,
            votedAt: nowFn().toISOString(),
            unauthorizedTaps,
          };
        }
      }
    }

    if (nowFn().getTime() < deadlineMs && pollIntervalMs > 0) {
      await sleepFn(pollIntervalMs);
    }
  }

  return {
    winnerLabel: "timeout",
    telegramUserId: null,
    votedAt: nowFn().toISOString(),
    unauthorizedTaps,
  };
}

/**
 * Reuses an existing run's audio, transcript, media, and script to render both `jev` and `agent`
 * cuts (ZERO Cartesia/Serper calls), assigns blind A/B labels, and optionally collects Telegram votes.
 */
export async function runDirectorAbComparison({
  sourceRunId,
  kitRoot = KIT_ROOT,
  resultsPath = DEFAULT_AB_RESULTS_PATH,
  dryRun = false,
  noTelegram = false,
  waitVote = true,
  timeoutSeconds = 86_400,
  env = process.env,
  deps = {},
} = {}) {
  if (!sourceRunId) {
    throw new Error("runDirectorAbComparison requires sourceRunId (existing run folder inside agent-runs/).");
  }

  const d = {
    loadStudioConfig,
    execute,
    resolveRunDirectory,
    sha256,
    writeJson,
    planShotsWithAgent,
    askAgentFn: askActiveAgent,
    composeVerticalVideo,
    flushTelegramBacklog,
    dispatchBlindAbPrompt,
    pollBlindAbVote,
    sendTelegramMessage,
    rngIntFn: (max) => crypto.randomInt(0, max),
    measureDurationFn: (audioPath) => measuredAudioDuration(probeMedia(audioPath)),
    ...deps,
  };

  const cfg = await d.loadStudioConfig();
  const sourceRunDir = d.resolveRunDirectory(kitRoot, sourceRunId);
  const audioPath = path.join(sourceRunDir, "user-audio.wav");
  const scriptPath = path.join(sourceRunDir, "script.json");
  const transcriptPath = path.join(sourceRunDir, "transcript.json");
  const storyPath = path.join(sourceRunDir, "story.json");

  if (!fsSync.existsSync(audioPath) || !fsSync.existsSync(scriptPath) || !fsSync.existsSync(transcriptPath)) {
    throw new Error(
      `Source run '${sourceRunId}' at ${sourceRunDir} must already contain user-audio.wav, script.json, and transcript.json (zero paid regeneration).`,
    );
  }

  const script = await readJsonFile(scriptPath);
  const transcript = await readJsonFile(transcriptPath);
  const story = fsSync.existsSync(storyPath) ? await readJsonFile(storyPath) : { title: script.title };
  const durationSeconds = await d.measureDurationFn(audioPath);
  const transcriptSha256 = await d.sha256(transcriptPath);
  const brollMediaList = fsSync.existsSync(path.join(sourceRunDir, "media"))
    ? (await fs.readdir(path.join(sourceRunDir, "media")))
        .filter((f) => !f.startsWith("."))
        .sort()
        .map((f) => path.posix.join("media", f))
    : [];

  const allowedBgs = ["living-room", "map-photo-zone", "sisters-room", "pure-white"];
  const chosenBg = allowedBgs.includes(script.backgroundId) ? script.backgroundId : "living-room";
  const suffix = crypto.randomBytes(3).toString("hex");
  const pairId = `${sourceRunId}-ab-${suffix}`;

  const renderArm = async (directorMode, initInputObj) => {
    const armRunId = `${pairId}-${directorMode}`;
    const armDir = d.resolveRunDirectory(kitRoot, armRunId);
    const stageInputPath = path.join(sourceRunDir, `.ab-input-${directorMode}-${suffix}.json`);
    await d.writeJson(stageInputPath, initInputObj);
    try {
      d.execute("node", [
        path.join(kitRoot, "runner.mjs"),
        "init",
        `--run=${armRunId}`,
        `--input=${stageInputPath}`,
        `--audio=${audioPath}`,
        `--director=${directorMode}`,
      ], { cwd: kitRoot });

      await copyDirContents(path.join(sourceRunDir, "media"), path.join(armDir, "media"));
      await d.writeJson(path.join(armDir, "script.json"), script);

      d.execute("node", [path.join(kitRoot, "runner.mjs"), "validate", `--run=${armRunId}`], { cwd: kitRoot });
      d.execute("node", [path.join(kitRoot, "runner.mjs"), "render", `--run=${armRunId}`], { cwd: kitRoot });
      d.execute("node", [path.join(kitRoot, "runner.mjs"), "inspect", `--run=${armRunId}`], { cwd: kitRoot });

      const masterPath = path.join(armDir, "final.mp4");
      const verticalPath = path.join(armDir, "final-vertical.mp4");
      await d.composeVerticalVideo({
        sourceVideoPath: masterPath,
        transcriptPath: path.join(armDir, "transcript.json"),
        script,
        headline: script.headline || formatSafeHeadline(script.title, 36),
        outputPath: verticalPath,
      });
      const verticalSha256 = await d.sha256(verticalPath);
      return { director: directorMode, runId: armRunId, runDirectory: armDir, verticalPath, verticalSha256 };
    } finally {
      await fs.rm(stageInputPath, { force: true }).catch(() => {});
    }
  };

  // Arm 1: Jev
  const jevArm = await renderArm("jev", {
    schemaVersion: "shaz-multi-shot-v1",
    title: script.headline || formatSafeHeadline(script.title, 36),
    headline: script.headline || formatSafeHeadline(script.title, 32),
    defaultBackgroundId: chosenBg,
    brollMedia: brollMediaList,
    script,
  });

  // Arm 2: Agent
  const agentPlanned = await d.planShotsWithAgent({
    script,
    topic: story,
    audioDurationSeconds: durationSeconds,
    transcript,
    transcriptSha256,
    brollMediaList,
    defaultBackgroundId: chosenBg,
    kitRoot,
    config: cfg,
    askAgentFn: d.askAgentFn,
  });
  const agentArm = await renderArm("agent", agentPlanned.multiShotInput);

  const armsByDirector = { jev: jevArm, agent: agentArm };
  const assignment = buildBlindAssignment({ rngIntFn: d.rngIntFn });
  const optionA = armsByDirector[assignment.A];
  const optionB = armsByDirector[assignment.B];

  let voteResult = { winnerLabel: dryRun || noTelegram ? "unvoted" : "pending", telegramUserId: null, votedAt: null, unauthorizedTaps: [] };
  if (!dryRun && !noTelegram) {
    const initialUpdateId = await d.flushTelegramBacklog({ env });
    await d.dispatchBlindAbPrompt({
      pairId,
      storyTitle: story.title || script.title,
      optionAVideoPath: optionA.verticalPath,
      optionBVideoPath: optionB.verticalPath,
      env,
    });
    if (waitVote) {
      voteResult = await d.pollBlindAbVote({ pairId, initialUpdateId, timeoutSeconds, env });
      const winnerDirector = voteResult.winnerLabel === "A" || voteResult.winnerLabel === "B"
        ? assignment[voteResult.winnerLabel]
        : voteResult.winnerLabel;
      await d.sendTelegramMessage({
        text:
          `🔍 <b>Blind A/B Reveal (${escapeTelegramHtml(pairId)})</b>\n\n` +
          `• Option A was: <b>${escapeTelegramHtml(assignment.A)}</b>\n` +
          `• Option B was: <b>${escapeTelegramHtml(assignment.B)}</b>\n` +
          `• Your Pick: <b>${escapeTelegramHtml(voteResult.winnerLabel)}</b> (${escapeTelegramHtml(winnerDirector)})`,
        env,
      }).catch(() => {});
    }
  }

  const winnerDirector = voteResult.winnerLabel === "A" || voteResult.winnerLabel === "B"
    ? assignment[voteResult.winnerLabel]
    : voteResult.winnerLabel;

  const entry = {
    schemaVersion: 1,
    pairId,
    sourceRunId,
    title: story.title || script.title,
    recordedAt: new Date().toISOString(),
    dryRun: Boolean(dryRun || noTelegram),
    arms: {
      A: { director: assignment.A, runId: optionA.runId, verticalSha256: optionA.verticalSha256 },
      B: { director: assignment.B, runId: optionB.runId, verticalSha256: optionB.verticalSha256 },
    },
    winnerLabel: voteResult.winnerLabel,
    winnerDirector,
    telegramUserId: voteResult.telegramUserId,
    votedAt: voteResult.votedAt,
    unauthorizedTaps: voteResult.unauthorizedTaps,
  };

  let existing = [];
  if (fsSync.existsSync(resultsPath)) {
    try {
      const parsed = await readJsonFile(resultsPath);
      if (Array.isArray(parsed?.pairs)) existing = parsed.pairs;
    } catch {}
  }
  await d.writeJson(resultsPath, {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    pairs: [...existing, entry],
  });

  return entry;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const runArg = args.find((a) => a.startsWith("--run="))?.slice("--run=".length);
  const dryRun = args.includes("--dry-run");
  const noTelegram = args.includes("--no-telegram");
  const noWait = args.includes("--no-wait");
  runDirectorAbComparison({
    sourceRunId: runArg,
    dryRun,
    noTelegram,
    waitVote: !noWait,
  })
    .then((entry) => {
      console.log(JSON.stringify(entry, null, 2));
    })
    .catch((err) => {
      console.error(`director-ab failed: ${err.message}`);
      process.exitCode = 1;
    });
}
