import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RunStopError } from "./errors.mjs";
import { getSecretKey, redactSecrets } from "./secrets.mjs";

const execFileAsync = promisify(execFile);

/**
 * Escapes dynamic text for Telegram `parse_mode: "HTML"`.
 */
export function escapeTelegramHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getChicagoParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour % 24,
    minute: parts.minute,
    second: parts.second,
  };
}

/**
 * Computes 20:00:00 America/Chicago on `now`'s local calendar day,
 * or 20:00:00 the next Chicago day if `now` is already at or past 20:00:00.
 */
export function computeChicagoDeadline(now = new Date(), { targetHour = 20 } = {}) {
  const chicagoNow = getChicagoParts(now);
  const rollForwardDays = chicagoNow.hour >= targetHour ? 1 : 0;
  const targetCalendar = new Date(
    Date.UTC(chicagoNow.year, chicagoNow.month - 1, chicagoNow.day + rollForwardDays),
  );
  const targetYear = targetCalendar.getUTCFullYear();
  const targetMonth = targetCalendar.getUTCMonth() + 1;
  const targetDay = targetCalendar.getUTCDate();

  // Converge on exact UTC instant matching targetYear-targetMonth-targetDay 20:00:00 America/Chicago (CST/CDT safe).
  let candidateMs = Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour + 6, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const got = getChicagoParts(new Date(candidateMs));
    const desiredUtcDayMs = Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour, 0, 0);
    const gotUtcDayMs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    const deltaMs = desiredUtcDayMs - gotUtcDayMs;
    if (deltaMs === 0) break;
    candidateMs += deltaMs;
  }
  return new Date(candidateMs);
}

/**
 * Loads Telegram bot credentials and optional operator user ID from env / `secrets.env`.
 */
export function getTelegramCredentials({
  requireOperator = false,
  token: explicitToken,
  chatId: explicitChatId,
  operatorUserId: explicitOperatorUserId,
  env = process.env,
  secretsPath,
} = {}) {
  const token = (explicitToken && String(explicitToken).trim()) || getSecretKey("TELEGRAM_BOT_TOKEN", { env, secretsPath });
  const chatId = (explicitChatId && String(explicitChatId).trim()) || getSecretKey("TELEGRAM_CHAT_ID", { env, secretsPath });
  const operatorUserId =
    (explicitOperatorUserId !== undefined && explicitOperatorUserId !== null && String(explicitOperatorUserId).trim()) ||
    getSecretKey("TELEGRAM_OPERATOR_USER_ID", { env, secretsPath });

  if (!token) {
    throw new RunStopError(
      "Missing TELEGRAM_BOT_TOKEN in secrets.env. Add TELEGRAM_BOT_TOKEN=<bot token> from @BotFather.",
      { code: "TELEGRAM_MISSING_TOKEN", stage: "telegram", headline: "Telegram Token Missing", canAlert: false },
    );
  }
  if (!chatId) {
    throw new RunStopError(
      "Missing TELEGRAM_CHAT_ID in secrets.env. Send /start to your bot to link your chat ID.",
      { code: "TELEGRAM_MISSING_CHAT_ID", stage: "telegram", headline: "Telegram Chat ID Missing", canAlert: false },
    );
  }
  if (requireOperator && !operatorUserId) {
    throw new RunStopError(
      "Missing TELEGRAM_OPERATOR_USER_ID in secrets.env. Add TELEGRAM_OPERATOR_USER_ID=<numeric Telegram user ID> (equal to TELEGRAM_CHAT_ID for private bot DM) before polling approvals.",
      { code: "TELEGRAM_MISSING_OPERATOR_ID", stage: "telegram", headline: "Missing TELEGRAM_OPERATOR_USER_ID", canAlert: true },
    );
  }

  return { token, chatId: String(chatId), operatorUserId: operatorUserId ? String(operatorUserId) : null };
}

async function parseTelegramApiResponse(res, actionName, token) {
  let data = null;
  let rawText = "";
  try {
    data = await res.json();
  } catch {
    rawText = await res.text?.().catch(() => "") || "";
  }

  const status = res?.status ?? (data?.ok ? 200 : 500);
  const detail = redactSecrets(data?.description || rawText || `HTTP ${status}`, [token]);

  if (status === 401 || status === 403 || status === 404) {
    throw new RunStopError(
      `Telegram ${actionName} failed (HTTP ${status}): ${detail}. Verify TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in secrets.env.`,
      {
        code: "TELEGRAM_AUTH_OR_CHAT",
        stage: "telegram",
        headline: `Telegram Auth/Chat Error (HTTP ${status})`,
        canAlert: false,
      },
    );
  }

  if (status === 409) {
    throw new RunStopError(
      `Telegram ${actionName} failed with HTTP 409 Conflict: ${detail}. Another bot poller or webhook is active on this token.`,
      {
        code: "TELEGRAM_409_CONFLICT",
        stage: "telegram",
        headline: "Telegram Polling Conflict (409)",
        canAlert: true,
      },
    );
  }

  if (!res.ok || !data?.ok) {
    throw new Error(`Telegram ${actionName} failed (HTTP ${status}): ${detail}`);
  }

  return data;
}

async function answerTelegramCallback(token, callbackQueryId, text, { showAlert = false, fetchFn = fetch } = {}) {
  try {
    await fetchFn(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        ...(showAlert ? { show_alert: true } : {}),
      }),
    });
  } catch {}
}

/**
 * Edits the caption on a sent Telegram video/photo message using HTML parse mode.
 */
export async function editTelegramMessageCaption({
  chatId,
  messageId,
  caption,
  replyMarkup,
  token: explicitToken,
  env = process.env,
  secretsPath,
  fetchFn = fetch,
}) {
  const { token, chatId: resolvedChatId } = getTelegramCredentials({
    token: explicitToken,
    chatId,
    env,
    secretsPath,
  });

  const body = {
    chat_id: resolvedChatId,
    message_id: messageId,
    caption,
    parse_mode: "HTML",
    ...(replyMarkup !== undefined ? { reply_markup: replyMarkup } : {}),
  };

  let res;
  try {
    res = await fetchFn(`https://api.telegram.org/bot${token}/editMessageCaption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(redactSecrets(`Telegram editMessageCaption failed: ${err.message}`, [token]));
  }
  return (await parseTelegramApiResponse(res, "editMessageCaption", token)).result;
}

/**
 * Flushes stale queued updates before dispatching new candidates by polling `getUpdates?offset=-1&timeout=0`.
 * Returns `baselineUpdateId` so live polling starts strictly at `baselineUpdateId + 1`.
 */
export async function flushTelegramBacklog({
  token: explicitToken,
  chatId: explicitChatId,
  env = process.env,
  secretsPath,
  fetchFn = fetch,
} = {}) {
  const { token } = getTelegramCredentials({
    token: explicitToken,
    chatId: explicitChatId || "0",
    env,
    secretsPath,
  });

  let res;
  try {
    res = await fetchFn(`https://api.telegram.org/bot${token}/getUpdates?offset=-1&timeout=0`);
  } catch (err) {
    throw new Error(redactSecrets(`Telegram pre-flush getUpdates failed: ${err.message}`, [token]));
  }

  const data = await parseTelegramApiResponse(res, "getUpdates(flush)", token);
  const updates = Array.isArray(data.result) ? data.result : [];
  if (updates.length === 0) return 0;
  return Math.max(...updates.map((u) => Number(u.update_id) || 0));
}

/**
 * Sends a rendered video to the user's Telegram for approval (or buttonless dry-run preview).
 */
export async function sendApprovalVideo({
  videoPath,
  title,
  runId,
  captionText = "",
  candidateNumber,
  totalCandidates,
  buttonLabel,
  dryRun = false,
  token: explicitToken,
  chatId: explicitChatId,
  env = process.env,
  secretsPath,
  fetchFn = fetch,
}) {
  const { token, chatId } = getTelegramCredentials({
    token: explicitToken,
    chatId: explicitChatId,
    env,
    secretsPath,
  });

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const fileBuffer = await fsPromises.readFile(videoPath);
  const formData = new FormData();
  formData.append("chat_id", chatId);

  const safeTitle = escapeTelegramHtml(title);
  const safeSnippet = escapeTelegramHtml(String(captionText || "").slice(0, 150));
  const dryBanner = dryRun ? "🧪 <b>DRY RUN — won't post</b>\n\n" : "";

  const header = candidateNumber && totalCandidates
    ? `🎬 <b>DAILY CANDIDATE ${candidateNumber}/${totalCandidates}:</b> <b>${safeTitle}</b>`
    : `🎬 <b>WIGGLY DAILY VIDEO READY FOR APPROVAL</b>\n\n<b>Title:</b> ${safeTitle}`;

  const footer = dryRun
    ? "Preview only (dry-run mode — publishing, polling, and ledger writes are disabled)."
    : candidateNumber && totalCandidates
      ? "Tap below if you want this candidate posted across configured social channels!"
      : "Review the video above. Tap below to finalize and push live to social channels!";

  const messageCaption =
    `${dryBanner}${header}\n\n` +
    (safeSnippet ? `<b>Script:</b> "${safeSnippet}..."\n\n` : "\n") +
    footer;

  formData.append("caption", messageCaption);
  formData.append("parse_mode", "HTML");
  formData.append("width", "1080");
  formData.append("height", "1920");
  formData.append("supports_streaming", "true");
  formData.append("video", new Blob([fileBuffer], { type: "video/mp4" }), path.basename(videoPath));

  // Extract a 9:16 vertical poster frame for Telegram thumbnail preview
  const thumbPath = path.join(path.dirname(videoPath), "telegram-thumb.jpg");
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss", "00:00:02",
      "-i", videoPath,
      "-vframes", "1",
      "-vf", "scale=360:640",
      "-q:v", "3",
      thumbPath,
    ]);
    if (fs.existsSync(thumbPath)) {
      const thumbBuffer = await fsPromises.readFile(thumbPath);
      formData.append("thumbnail", new Blob([thumbBuffer], { type: "image/jpeg" }), "thumbnail.jpg");
    }
  } catch {}

  if (!dryRun) {
    const approveText = buttonLabel || (candidateNumber ? `🚀 Pick & Post Candidate #${candidateNumber}` : "🚀 Approve & Post to All Channels");
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: approveText, callback_data: `approve:${runId}` },
          { text: "❌ Pass", callback_data: `reject:${runId}` },
        ],
      ],
    };
    formData.append("reply_markup", JSON.stringify(inlineKeyboard));
  }

  let res;
  try {
    res = await fetchFn(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    throw new Error(redactSecrets(`Telegram sendVideo request failed: ${err.message}`, [token]));
  }

  const data = await parseTelegramApiResponse(res, "sendVideo", token);
  const fileId = data.result?.video?.file_id;
  const messageId = data.result?.message_id;

  return {
    messageId,
    fileId,
    chatId,
  };
}

/**
 * Sends a photo to the user's Telegram using HTML parse mode.
 */
export async function sendTelegramPhoto({
  photoPath,
  caption = "",
  token: explicitToken,
  chatId: explicitChatId,
  env = process.env,
  secretsPath,
  fetchFn = fetch,
}) {
  const { token, chatId } = getTelegramCredentials({
    token: explicitToken,
    chatId: explicitChatId,
    env,
    secretsPath,
  });

  if (!fs.existsSync(photoPath)) {
    throw new Error(`Photo file not found: ${photoPath}`);
  }

  const fileBuffer = await fsPromises.readFile(photoPath);
  const formData = new FormData();
  formData.append("chat_id", chatId);
  if (caption) {
    formData.append("caption", caption);
    formData.append("parse_mode", "HTML");
  }
  formData.append("photo", new Blob([fileBuffer], { type: "image/jpeg" }), path.basename(photoPath));

  let res;
  try {
    res = await fetchFn(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    throw new Error(redactSecrets(`Telegram sendPhoto request failed: ${err.message}`, [token]));
  }

  const data = await parseTelegramApiResponse(res, "sendPhoto", token);
  return data.result;
}

/**
 * Sends an HTML-formatted message to the Telegram chat.
 */
export async function sendTelegramMessage({
  text,
  replyMarkup,
  token: explicitToken,
  chatId: explicitChatId,
  env = process.env,
  secretsPath,
  fetchFn = fetch,
}) {
  const { token, chatId } = getTelegramCredentials({
    token: explicitToken,
    chatId: explicitChatId,
    env,
    secretsPath,
  });

  let res;
  try {
    res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
  } catch (err) {
    throw new Error(redactSecrets(`Telegram sendMessage request failed: ${err.message}`, [token]));
  }

  const data = await parseTelegramApiResponse(res, "sendMessage", token);
  return data.result;
}

function isAuthorizedCallback(cb, expectedOperatorUserId, expectedChatId) {
  const fromId = cb?.from?.id;
  const msgChatId = cb?.message?.chat?.id;
  if (fromId === undefined || fromId === null || msgChatId === undefined || msgChatId === null) {
    return false;
  }
  return String(fromId) === String(expectedOperatorUserId) && String(msgChatId) === String(expectedChatId);
}

/**
 * Polls Telegram updates for a single candidate approval until picked, passed, or the deadline passes.
 */
export async function pollApprovalDecision({
  runId,
  deadline,
  timeoutSeconds,
  pollIntervalMs = 2500,
  initialUpdateId = 0,
  token: explicitToken,
  chatId: explicitChatId,
  operatorUserId: explicitOperatorUserId,
  env = process.env,
  secretsPath,
  fetchFn = fetch,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  nowFn = () => new Date(),
  onUnauthorizedTap,
}) {
  const { token, chatId, operatorUserId } = getTelegramCredentials({
    requireOperator: true,
    token: explicitToken,
    chatId: explicitChatId,
    operatorUserId: explicitOperatorUserId,
    env,
    secretsPath,
  });

  const effectiveDeadline = deadline
    ? new Date(deadline)
    : Number.isFinite(timeoutSeconds)
      ? new Date(nowFn().getTime() + timeoutSeconds * 1000)
      : computeChicagoDeadline(nowFn());

  let lastUpdateId = Number(initialUpdateId) || 0;
  console.log(`[Telegram Studio] Waiting for operator approval for run: ${runId} (deadline ${effectiveDeadline.toISOString()})...`);

  while (nowFn().getTime() < effectiveDeadline.getTime()) {
    try {
      const remainingSec = Math.max(1, Math.min(10, Math.ceil((effectiveDeadline.getTime() - nowFn().getTime()) / 1000)));
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=${remainingSec}`;
      const res = await fetchFn(url);
      const data = await parseTelegramApiResponse(res, "getUpdates", token);

      for (const update of Array.isArray(data.result) ? data.result : []) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        const cb = update.callback_query;
        if (!cb?.data) continue;

        if (!isAuthorizedCallback(cb, operatorUserId, chatId)) {
          const logEntry = {
            userId: cb.from?.id ?? null,
            chatId: cb.message?.chat?.id ?? null,
            at: nowFn().toISOString(),
            data: cb.data,
          };
          console.warn(`[Telegram Security] Ignored unauthorized callback: ${JSON.stringify(logEntry)}`);
          onUnauthorizedTap?.(logEntry);
          await answerTelegramCallback(token, cb.id, "Not allowed", { showAlert: true, fetchFn });
          continue;
        }

        if (cb.data === `approve:${runId}`) {
          await answerTelegramCallback(token, cb.id, "⏳ Picked — finalizing & publishing...", { fetchFn });
          if (cb.message?.message_id && cb.message?.chat?.id) {
            await editTelegramMessageCaption({
              chatId: cb.message.chat.id,
              messageId: cb.message.message_id,
              caption: `⏳ <b>Picked — finalizing &amp; publishing...</b>\nRun ID: <code>${escapeTelegramHtml(runId)}</code>`,
              token,
              fetchFn,
            }).catch(() => {});
          }
          return "approved";
        }

        if (cb.data === `reject:${runId}`) {
          await answerTelegramCallback(token, cb.id, "❌ Passed.", { fetchFn });
          if (cb.message?.message_id && cb.message?.chat?.id) {
            await editTelegramMessageCaption({
              chatId: cb.message.chat.id,
              messageId: cb.message.message_id,
              caption: `❌ <b>Passed</b>\nRun ID: <code>${escapeTelegramHtml(runId)}</code>`,
              token,
              fetchFn,
            }).catch(() => {});
          }
          return "rejected";
        }

        await answerTelegramCallback(token, cb.id, "This batch has expired", { fetchFn });
      }
    } catch (err) {
      if (err instanceof RunStopError) throw err;
      console.warn(redactSecrets(`[Telegram Polling Warning] ${err.message}`, [token]));
    }

    if (nowFn().getTime() >= effectiveDeadline.getTime()) break;
    await sleepFn(pollIntervalMs);
  }

  return "no-pick";
}

/**
 * Polls Telegram waiting for the authorized operator to pick 1 candidate from a batch,
 * pass all candidates, or let the 20:00 America/Chicago deadline expire.
 */
export async function pollBatchDecision({
  candidates,
  batchId = null,
  deadline,
  timeoutSeconds,
  pollIntervalMs = 2500,
  initialUpdateId = 0,
  initialRejectedRunIds = [],
  token: explicitToken,
  chatId: explicitChatId,
  operatorUserId: explicitOperatorUserId,
  env = process.env,
  secretsPath,
  fetchFn = fetch,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  nowFn = () => new Date(),
  onUnauthorizedTap,
  onCandidateRejected,
}) {
  const { token, chatId, operatorUserId } = getTelegramCredentials({
    requireOperator: true,
    token: explicitToken,
    chatId: explicitChatId,
    operatorUserId: explicitOperatorUserId,
    env,
    secretsPath,
  });

  const effectiveDeadline = deadline
    ? new Date(deadline)
    : Number.isFinite(timeoutSeconds)
      ? new Date(nowFn().getTime() + timeoutSeconds * 1000)
      : computeChicagoDeadline(nowFn());

  let lastUpdateId = Number(initialUpdateId) || 0;
  const candidateMap = new Map(candidates.map((c) => [c.runId, c]));
  const rejectedRunIds = new Set(initialRejectedRunIds.filter((id) => candidateMap.has(id)));
  const unauthorizedTaps = [];

  if (candidateMap.size > 0 && rejectedRunIds.size >= candidateMap.size) {
    return {
      status: "all-passed",
      rejectedRunIds: [...rejectedRunIds],
      unauthorizedTaps,
    };
  }

  console.log(
    `[Telegram Studio] Waiting for operator decision on ${candidates.length} candidates (deadline ${effectiveDeadline.toISOString()})...`,
  );

  while (nowFn().getTime() < effectiveDeadline.getTime()) {
    try {
      const remainingSec = Math.max(1, Math.min(10, Math.ceil((effectiveDeadline.getTime() - nowFn().getTime()) / 1000)));
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=${remainingSec}`;
      const res = await fetchFn(url);
      const data = await parseTelegramApiResponse(res, "getUpdates", token);

      for (const update of Array.isArray(data.result) ? data.result : []) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        const cb = update.callback_query;
        if (!cb?.data) continue;

        if (!isAuthorizedCallback(cb, operatorUserId, chatId)) {
          const logEntry = {
            userId: cb.from?.id ?? null,
            chatId: cb.message?.chat?.id ?? null,
            at: nowFn().toISOString(),
            data: cb.data,
          };
          unauthorizedTaps.push(logEntry);
          console.warn(`[Telegram Security] Ignored unauthorized callback: ${JSON.stringify(logEntry)}`);
          onUnauthorizedTap?.(logEntry);
          await answerTelegramCallback(token, cb.id, "Not allowed", { showAlert: true, fetchFn });
          continue;
        }

        const colonIdx = cb.data.indexOf(":");
        const action = colonIdx >= 0 ? cb.data.slice(0, colonIdx) : cb.data;
        const clickedId = colonIdx >= 0 ? cb.data.slice(colonIdx + 1) : "";

        if (action === "approve" && candidateMap.has(clickedId)) {
          const chosen = candidateMap.get(clickedId);
          await answerTelegramCallback(
            token,
            cb.id,
            `⏳ Picked "${String(chosen.title).slice(0, 60)}" — finalizing & publishing...`,
            { fetchFn },
          );

          if (cb.message?.message_id && cb.message?.chat?.id) {
            await editTelegramMessageCaption({
              chatId: cb.message.chat.id,
              messageId: cb.message.message_id,
              caption:
                `⏳ <b>Picked — finalizing &amp; publishing...</b>\n\n` +
                `<b>Title:</b> ${escapeTelegramHtml(chosen.title)}\n` +
                `Run ID: <code>${escapeTelegramHtml(clickedId)}</code>`,
              token,
              fetchFn,
            }).catch(() => {});
          }

          return {
            status: "approved",
            runId: clickedId,
            chosen,
            messageId: cb.message?.message_id ?? chosen.messageId ?? null,
            unauthorizedTaps,
          };
        }

        if (action === "pass_all" && batchId && clickedId === batchId) {
          await answerTelegramCallback(token, cb.id, "🚫 All passed — nothing will post today.", { fetchFn });
          return {
            status: "all-passed",
            rejectedRunIds: [...candidateMap.keys()],
            passedAllByButton: true,
            unauthorizedTaps,
          };
        }

        if (action === "reject" && candidateMap.has(clickedId)) {
          const rejected = candidateMap.get(clickedId);
          rejectedRunIds.add(clickedId);
          await answerTelegramCallback(token, cb.id, "❌ Candidate passed.", { fetchFn });
          if (cb.message?.message_id && cb.message?.chat?.id) {
            await editTelegramMessageCaption({
              chatId: cb.message.chat.id,
              messageId: cb.message.message_id,
              caption:
                `❌ <b>Passed</b>\n\n` +
                `<b>Title:</b> ${escapeTelegramHtml(rejected.title)}\n` +
                `Run ID: <code>${escapeTelegramHtml(clickedId)}</code>`,
              token,
              fetchFn,
            }).catch(() => {});
          }
          await onCandidateRejected?.(clickedId, [...rejectedRunIds]);

          if (rejectedRunIds.size >= candidateMap.size) {
            return {
              status: "all-passed",
              rejectedRunIds: [...rejectedRunIds],
              unauthorizedTaps,
            };
          }
          continue;
        }

        // Valid Shaz tap on a stale/unknown batch button
        await answerTelegramCallback(token, cb.id, "This batch has expired", { fetchFn });
      }
    } catch (err) {
      if (err instanceof RunStopError) throw err;
      console.warn(redactSecrets(`[Telegram Polling Warning] ${err.message}`, [token]));
    }

    if (nowFn().getTime() >= effectiveDeadline.getTime()) break;
    await sleepFn(pollIntervalMs);
  }

  return {
    status: "no-pick",
    rejectedRunIds: [...rejectedRunIds],
    unauthorizedTaps,
  };
}
