import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSecretKey, redactSecrets } from "./secrets.mjs";

const execFileAsync = promisify(execFile);

/**
 * Loads Telegram bot credentials from secrets.env or environment.
 */
export function getTelegramCredentials() {
  const token = getSecretKey("TELEGRAM_BOT_TOKEN");
  const chatId = getSecretKey("TELEGRAM_CHAT_ID");

  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN in secrets.env");
  }
  if (!chatId) {
    throw new Error("Missing TELEGRAM_CHAT_ID in secrets.env. Send /start to your bot to link your chat ID.");
  }

  return { token, chatId };
}

/**
 * Sends a rendered video to the user's Telegram for approval.
 */
export async function sendApprovalVideo({
  videoPath,
  title,
  runId,
  captionText = "",
  candidateNumber,
  totalCandidates,
  buttonLabel,
  token: explicitToken,
  chatId: explicitChatId,
  fetchFn = fetch,
}) {
  const { token, chatId } = (explicitToken && explicitChatId)
    ? { token: explicitToken, chatId: explicitChatId }
    : getTelegramCredentials();

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const fileBuffer = await fsPromises.readFile(videoPath);
  const formData = new FormData();
  formData.append("chat_id", chatId);

  const header = candidateNumber && totalCandidates
    ? `🎬 *DAILY CANDIDATE ${candidateNumber}/${totalCandidates}:* *${title}*`
    : `🎬 *WIGGLY DAILY VIDEO READY FOR APPROVAL*\n\n*Title:* ${title}`;

  const messageCaption =
    `${header}\n\n` +
    (captionText ? `*Script:* "${captionText.slice(0, 150)}..."\n\n` : "\n") +
    (candidateNumber && totalCandidates
      ? `Tap below if you want this candidate posted across Instagram Reels, YouTube Shorts, and TikTok!`
      : `Review the video above. Tap below to finalize and push live to social channels!`);

  formData.append("caption", messageCaption);
  formData.append("parse_mode", "Markdown");
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

  let res;
  try {
    res = await fetchFn(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    throw new Error(redactSecrets(`Telegram sendVideo request failed: ${err.message}`, [token]));
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(redactSecrets(`Telegram sendVideo failed: ${data.description}`, [token]));
  }

  const fileId = data.result?.video?.file_id;
  const messageId = data.result?.message_id;

  return {
    messageId,
    fileId,
    chatId,
  };
}

/**
 * Sends a photo to the user's Telegram.
 */
export async function sendTelegramPhoto({
  photoPath,
  caption = "",
  token: explicitToken,
  chatId: explicitChatId,
  fetchFn = fetch,
}) {
  const { token, chatId } = (explicitToken && explicitChatId)
    ? { token: explicitToken, chatId: explicitChatId }
    : getTelegramCredentials();

  if (!fs.existsSync(photoPath)) {
    throw new Error(`Photo file not found: ${photoPath}`);
  }

  const fileBuffer = await fsPromises.readFile(photoPath);
  const formData = new FormData();
  formData.append("chat_id", chatId);
  if (caption) {
    formData.append("caption", caption);
    formData.append("parse_mode", "Markdown");
  }
  formData.append("photo", new Blob([fileBuffer], { type: "image/jpeg" }), path.basename(photoPath));

  const res = await fetchFn(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram sendPhoto failed: ${data.description}`);
  }
  return data.result;
}

/**
 * Polls Telegram updates waiting for the user to tap Approve or Reject.
 */
export async function pollApprovalDecision({
  runId,
  timeoutSeconds = 86400,
  pollIntervalMs = 2500,
  token: explicitToken,
  fetchFn = fetch,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const token = explicitToken || getTelegramCredentials().token;
  const startTime = Date.now();
  let lastUpdateId = 0;

  console.log(`[Telegram Studio] Waiting for operator approval for run: ${runId}...`);

  while (Date.now() - startTime < timeoutSeconds * 1000) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
      const res = await fetchFn(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          const cb = update.callback_query;
          if (cb && cb.data) {
            if (cb.data === `approve:${runId}`) {
              await fetchFn(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: cb.id,
                  text: "✅ Approved! Finalizing and posting to Instagram...",
                }),
              });

              if (cb.message?.message_id && cb.message?.chat?.id) {
                await fetchFn(`https://api.telegram.org/bot${token}/editMessageCaption`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: cb.message.chat.id,
                    message_id: cb.message.message_id,
                    caption: `✅ *APPROVED & POSTED TO INSTAGRAM*\nRun ID: \`${runId}\``,
                    parse_mode: "Markdown",
                  }),
                });
              }

              return "approved";
            }

            if (cb.data === `reject:${runId}`) {
              await fetchFn(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: cb.id,
                  text: "❌ Video rejected and cancelled.",
                }),
              });
              return "rejected";
            }
          }
        }
      }
    } catch (err) {
      console.warn(redactSecrets(`[Telegram Polling Warning] ${err.message}`, [token]));
    }

    await sleepFn(pollIntervalMs);
  }

  throw new Error(`Telegram approval timed out after ${timeoutSeconds}s`);
}

/**
 * Sends a plain text message to the Telegram chat.
 */
export async function sendTelegramMessage({
  text,
  token: explicitToken,
  chatId: explicitChatId,
  fetchFn = fetch,
}) {
  const { token, chatId } = (explicitToken && explicitChatId)
    ? { token: explicitToken, chatId: explicitChatId }
    : getTelegramCredentials();

  const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram sendMessage failed: ${data.description}`);
  }
  return data.result;
}

/**
 * Polls Telegram waiting for operator to pick one candidate from a batch of generated candidates.
 *
 * @param {Object} options
 * @param {Array<{ runId: string, title: string, messageId?: number }>} options.candidates
 * @param {number} [options.timeoutSeconds=86400]
 * @param {number} [options.pollIntervalMs=2500]
 * @param {string} [options.token]
 * @param {Function} [options.fetchFn]
 * @param {Function} [options.sleepFn]
 */
export async function pollBatchDecision({
  candidates,
  timeoutSeconds = 86400,
  pollIntervalMs = 2500,
  token: explicitToken,
  fetchFn = fetch,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const token = explicitToken || getTelegramCredentials().token;
  const startTime = Date.now();
  let lastUpdateId = 0;
  const candidateMap = new Map(candidates.map((c) => [c.runId, c]));

  console.log(`[Telegram Studio] Waiting for operator to select 1 candidate from batch of ${candidates.length}...`);

  while (Date.now() - startTime < timeoutSeconds * 1000) {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
      const res = await fetchFn(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          const cb = update.callback_query;
          if (cb && cb.data) {
            const [action, clickedRunId] = cb.data.split(":");
            if (action === "approve" && candidateMap.has(clickedRunId)) {
              const chosen = candidateMap.get(clickedRunId);

              await fetchFn(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: cb.id,
                  text: `✅ Picked "${chosen.title}"! Finalizing & publishing to all channels...`,
                }),
              });

              if (cb.message?.message_id && cb.message?.chat?.id) {
                await fetchFn(`https://api.telegram.org/bot${token}/editMessageCaption`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: cb.message.chat.id,
                    message_id: cb.message.message_id,
                    caption: `🌟 *WINNER PICKED & POSTED TO ALL CHANNELS*\n\n*Title:* ${chosen.title}\nRun ID: \`${clickedRunId}\``,
                    parse_mode: "Markdown",
                  }),
                });
              }

              return {
                status: "approved",
                runId: clickedRunId,
                chosen,
              };
            }

            if (action === "reject" && candidateMap.has(clickedRunId)) {
              await fetchFn(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  callback_query_id: cb.id,
                  text: "❌ Candidate passed.",
                }),
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn(redactSecrets(`[Telegram Polling Warning] ${err.message}`, [token]));
    }

    await sleepFn(pollIntervalMs);
  }

  throw new Error(`Telegram batch approval timed out after ${timeoutSeconds}s`);
}
