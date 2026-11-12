import path from "node:path";

import { RunStopError } from "./errors.mjs";

/**
 * Builds the honest studio delivery receipt recording the operator pick,
 * exact master & vertical checksums, inspection status, and published vertical hash.
 */
export function buildStudioDeliveryRecord({
  mode = "telegram-pick",
  pick = {},
  masterVideoPath = "final.mp4",
  masterVideoSha256,
  verticalGate,
  qualityReport,
  publishedMediaSha256 = null,
}) {
  if (!masterVideoSha256) {
    throw new RunStopError("Cannot build studio-delivery.json without masterVideoSha256.", {
      code: "INVALID_STUDIO_DELIVERY",
      stage: "publish",
      headline: "Invalid Studio Delivery Record",
    });
  }
  if (!verticalGate || !verticalGate.sha256) {
    throw new RunStopError("Cannot build studio-delivery.json without validated verticalGate metadata.", {
      code: "INVALID_STUDIO_DELIVERY",
      stage: "publish",
      headline: "Missing Vertical Gate Metadata",
    });
  }
  if (!qualityReport || qualityReport.status !== "pass") {
    throw new RunStopError(
      `Cannot publish run: quality-report.json status is '${qualityReport?.status ?? "missing"}' (expected 'pass').`,
      {
        code: "INSPECTION_FAILED",
        stage: "publish",
        headline: "Inspection Gate Failed",
      },
    );
  }
  if (qualityReport.outputSha256 && qualityReport.outputSha256 !== masterVideoSha256) {
    throw new RunStopError(
      `Master checksum mismatch: quality-report.json outputSha256 (${qualityReport.outputSha256}) != final.mp4 (${masterVideoSha256}).`,
      {
        code: "MASTER_CHECKSUM_MISMATCH",
        stage: "publish",
        headline: "Master Video Checksum Mismatch",
      },
    );
  }

  const finalPublishedSha = publishedMediaSha256 || verticalGate.sha256;
  if (finalPublishedSha !== verticalGate.sha256) {
    throw new RunStopError(
      `Published media checksum (${finalPublishedSha}) does not match Telegram-approved vertical file (${verticalGate.sha256}).`,
      {
        code: "MEDIA_CHECKSUM_MISMATCH",
        stage: "publish",
        headline: "Vertical Video Checksum Mismatch",
      },
    );
  }

  return {
    schemaVersion: 1,
    mode,
    pick: {
      telegramUserId: pick.telegramUserId ?? null,
      chatId: pick.chatId ?? null,
      messageId: pick.messageId ?? null,
      pickedAt: pick.pickedAt ?? new Date().toISOString(),
    },
    masterVideo: {
      file: path.basename(masterVideoPath),
      sha256: masterVideoSha256,
    },
    verticalVideo: {
      file: verticalGate.file || "final-vertical.mp4",
      sha256: verticalGate.sha256,
      width: verticalGate.width,
      height: verticalGate.height,
      durationSeconds: verticalGate.durationSeconds,
      bytes: verticalGate.bytes,
    },
    qualityReport: {
      file: "quality-report.json",
      status: qualityReport.status,
      outputSha256: qualityReport.outputSha256 || masterVideoSha256,
    },
    publishedMediaSha256: finalPublishedSha,
  };
}

/**
 * Verifies that the uploaded Convex media SHA-256 matches the exact Telegram-approved vertical file.
 */
export function verifyUploadedMediaChecksum({ uploadedSha256, expectedSha256 }) {
  if (!uploadedSha256 || !expectedSha256 || uploadedSha256 !== expectedSha256) {
    throw new RunStopError(
      `Uploaded Convex media checksum (${uploadedSha256 || "missing"}) does not match approved vertical video (${expectedSha256 || "missing"}). Aborting social publish.`,
      {
        code: "MEDIA_CHECKSUM_MISMATCH",
        stage: "publish",
        headline: "Uploaded Media Checksum Mismatch",
      },
    );
  }
}
