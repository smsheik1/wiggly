import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AgentOutputError, AgentUnavailableError, askActiveAgent } from "../../v3/lib/agent-bridge.ts";
import { CandidateSkipError } from "./errors.mjs";
import { formatSafeHeadline } from "./vertical-letterbox.mjs";
import { CHIBI_HOLDS } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/chibi-choreography.mjs";
import { getApprovedPerformancePoses, loadPerformanceApprovalsSync } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/pose-approvals.mjs";
import { validateMultiShotPlan } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/multi-shot-timeline.mjs";
import { doesPoseReachEnterRect, loadGestureReachMapSync } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/gesture-reach.mjs";
import { OTS_HEADLINE_BOX } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/ots-card-renderer.mjs";
import { ALLOWED_CAMERA_MOTIONS } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/director-jev.mjs";

const STUDIO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KIT_ROOT = path.resolve(STUDIO_ROOT, "../../v3/public/format-repositories/shaz-puppet-runtime-v1");

export class AgentDirectorError extends CandidateSkipError {
  constructor(message, attempts = [], options) {
    super(message, { stage: "agent-director", cause: options?.cause });
    this.name = "AgentDirectorError";
    this.attempts = attempts;
  }
}

function loadKitPlanningAssets(kitRoot = DEFAULT_KIT_ROOT) {
  const assets = JSON.parse(fsSync.readFileSync(path.join(kitRoot, "assets.json"), "utf8"));
  const poseIndex = JSON.parse(fsSync.readFileSync(path.join(kitRoot, "poses", "index.json"), "utf8"));
  const poseRegistry = {
    byId: new Map((poseIndex.poses ?? []).map((pose) => [pose.id, pose])),
  };
  const approvals = loadPerformanceApprovalsSync({ root: kitRoot });
  const reachMap = loadGestureReachMapSync(kitRoot);
  return { assets, poseRegistry, approvals, reachMap };
}

function summarizeTranscriptBeatsForDirector(transcript, totalDurationFrames) {
  const words = Array.isArray(transcript?.words) ? transcript.words : [];
  if (words.length === 0) {
    return [{ startFrame: 0, endFrameExclusive: totalDurationFrames, text: String(transcript?.text || "") }];
  }
  const beats = [];
  let current = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    current.push(w);
    const next = words[i + 1];
    const endsSentence = /[.!?]$/.test(String(w.text || "").trim());
    const longPause = next && (next.startMs - w.endMs >= 320);
    if ((endsSentence || longPause || !next) && current.length >= 2) {
      beats.push(current);
      current = [];
    }
  }
  if (current.length > 0) beats.push(current);

  const windows = [];
  let cursor = 0;
  for (let i = 0; i < beats.length; i += 1) {
    const isLast = i === beats.length - 1;
    const rawEnd = Math.round(((beats[i].at(-1)?.endMs ?? 0) / 1000) * 24);
    const endFrameExclusive = isLast ? totalDurationFrames : Math.max(cursor + 12, Math.min(totalDurationFrames - 1, rawEnd));
    windows.push({
      startFrame: cursor,
      endFrameExclusive,
      text: beats[i].map((w) => w.text).join(" ").trim(),
    });
    cursor = endFrameExclusive;
  }
  return windows;
}

export function buildDirectorPrompt({
  script,
  topic = {},
  audioDurationSeconds,
  totalDurationFrames,
  transcript,
  brollMediaList = [],
  defaultBackgroundId = "living-room",
  approvedPoses = getApprovedPerformancePoses(),
  backgroundIds = ["living-room", "sisters-room", "map-photo-zone", "pure-white"],
  reachMap = loadGestureReachMapSync(),
} = {}) {
  const windows = summarizeTranscriptBeatsForDirector(transcript, totalDurationFrames);
  const blockedOtsPoses = approvedPoses.filter((poseId) => (
    reachMap?.[poseId] && doesPoseReachEnterRect(reachMap[poseId], OTS_HEADLINE_BOX, { padding: 16 })
  ));
  const clearOtsPoses = approvedPoses.filter((poseId) => !blockedOtsPoses.includes(poseId));

  return [
    "You are directing an Animate Shaz multi-shot commentary video.",
    "Return ONLY one valid JSON object matching the schema below. Do not include markdown fences or commentary.",
    "",
    `Topic: ${topic?.title || script?.title || "Commentary"}`,
    `Audio Duration: ${Number(audioDurationSeconds).toFixed(3)}s`,
    `Total Frames (fps=24): ${totalDurationFrames}`,
    `Default Background ID: ${defaultBackgroundId}`,
    `Available Background IDs: ${backgroundIds.join(", ")}`,
    `Approved Talk-to-Camera Poses ONLY: ${approvedPoses.join(", ")}`,
    `  - Poses clear for otsGraphic.headline: ${clearOtsPoses.join(", ") || "none"}`,
    `  - Poses that block otsGraphic.headline (MUST NOT have otsGraphic.headline): ${blockedOtsPoses.join(", ") || "none"}`,
    `Allowed Chibi Poses: ${Object.keys(CHIBI_HOLDS).join(", ")}`,
    `Allowed Camera Motions (for b-roll): ${ALLOWED_CAMERA_MOTIONS.join(", ")}`,
    `Available brollMedia paths: ${brollMediaList.length > 0 ? brollMediaList.join(", ") : "(none)"}`,
    "",
    "Script Metadata:",
    JSON.stringify({
      title: script?.title || topic?.title || "",
      headline: script?.headline || formatSafeHeadline(script?.title || topic?.title || "", 32),
      hook: script?.hook || null,
      beats: Array.isArray(script?.beats) ? script.beats : [],
      landing: script?.landing || null,
    }, null, 2),
    "",
    "Word-Timed Beat Windows (suggested frame boundaries):",
    JSON.stringify(windows, null, 2),
    "",
    "Editorial & Contract Rules (MUST ALL PASS):",
    `1. shots must be a contiguous non-empty array starting at startFrame=0 and ending with endFrameExclusive=${totalDurationFrames}.`,
    "2. First shot (shots[0]) and last shot (shots.at(-1)) must use shotType='talk-to-camera'.",
    "3. Only use shotType in: talk-to-camera, b-roll, chibi-commentary, text-card.",
    `4. On talk-to-camera shots, poseId MUST be one of [${approvedPoses.join(", ")}]; never return unapproved or swapped poses (like shrug, chin-stroke, facepalm, arms-crossed).`,
    "5. Do not chain two identical or back-to-back active physical talk poses without returning to neutral-listening for breathing room.",
    `6. On talk-to-camera shots, NEVER attach otsGraphic with headline when poseId is in [${blockedOtsPoses.join(", ")}].`,
    "7. On b-roll shots, brollMedia MUST pick one path from Available brollMedia paths and motion MUST be one of Allowed Camera Motions.",
    "8. On chibi-commentary shots, supply chibiPose and card { badge, headline, quote, theme ('warm-red'|'cold-blue'), icon ('star'|'trophy'|'lightning') }.",
    "9. On text-card shots, supply short punchy text and optional highlights [{ phrase, color: '#RRGGBB' }].",
    "",
    "Required JSON Shape:",
    "{",
    '  "title": "Short title (1-120 chars)",',
    '  "shots": [',
    "    {",
    '      "id": "shot-01",',
    '      "shotType": "talk-to-camera",',
    '      "startFrame": 0,',
    '      "endFrameExclusive": 72,',
    `      "backgroundId": "${defaultBackgroundId}",`,
    '      "poseId": "present",',
    '      "rationale": "Brief directing note"',
    "    }",
    "  ]",
    "}",
  ].join("\n");
}

function buildDirectorRetrySuffix({ attempt, maxAttempts, errorMessage, previousPayload }) {
  const prevSnippet = previousPayload ? JSON.stringify(previousPayload).slice(0, 1200) : "(invalid JSON)";
  return [
    "",
    `PREVIOUS DIRECTOR ATTEMPT ${attempt - 1}/${maxAttempts} FAILED VALIDATION:`,
    `Error: ${errorMessage}`,
    `Previous output snippet: ${prevSnippet}`,
    "Fix this exact validation issue and return ONLY the corrected JSON object.",
  ].join("\n");
}

function sanitizeShotDraft(rawShot) {
  if (!rawShot || typeof rawShot !== "object" || Array.isArray(rawShot)) return rawShot;
  const cleaned = {};
  for (const [key, value] of Object.entries(rawShot)) {
    if (value === null || value === undefined) continue;
    if (key === "otsGraphic" && typeof value === "object" && !Array.isArray(value)) {
      cleaned.otsGraphic = Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== null && v !== undefined),
      );
      continue;
    }
    if (key === "card" && typeof value === "object" && !Array.isArray(value)) {
      cleaned.card = Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== null && v !== undefined),
      );
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

export function validateAgentDirectorDraft(
  rawDraft,
  {
    script,
    topic = {},
    audioDurationSeconds,
    transcript,
    transcriptSha256 = null,
    brollMediaList = [],
    defaultBackgroundId = "living-room",
    kitRoot = DEFAULT_KIT_ROOT,
  },
) {
  if (!rawDraft || typeof rawDraft !== "object" || Array.isArray(rawDraft)) {
    throw new Error("Agent director output must be a JSON object with a 'shots' array.");
  }
  const { assets, poseRegistry, approvals, reachMap } = loadKitPlanningAssets(kitRoot);
  const expectedTotalFrames = Math.max(1, Math.round(audioDurationSeconds * 24));
  const title = (typeof rawDraft.title === "string" && rawDraft.title.trim())
    ? rawDraft.title.trim().slice(0, 120)
    : (script?.headline || formatSafeHeadline(script?.title || topic?.title || "Daily Commentary", 36));

  const cleanedShots = Array.isArray(rawDraft.shots)
    ? rawDraft.shots.map((shot) => sanitizeShotDraft(shot))
    : [];

  const candidateInput = {
    schemaVersion: "shaz-multi-shot-v1",
    title,
    audioFile: "user-audio.wav",
    totalDurationFrames: expectedTotalFrames,
    ...(transcriptSha256 ? { planningTranscriptSha256: transcriptSha256 } : {}),
    shots: cleanedShots,
  };

  const validated = validateMultiShotPlan(candidateInput, {
    audioDurationSeconds,
    defaultBackgroundId,
    assets,
    poseRegistry,
    transcript,
    allowUnapprovedPoses: false,
    approvals,
  });

  if (validated.shots[0]?.shotType !== "talk-to-camera" || validated.shots.at(-1)?.shotType !== "talk-to-camera") {
    throw new Error("First and final shots must use shotType 'talk-to-camera'.");
  }

  const allowedMediaSet = new Set(brollMediaList);
  for (let i = 0; i < validated.shots.length; i += 1) {
    const shot = validated.shots[i];
    if (shot.shotType === "talk-to-camera" && shot.otsGraphic?.headline) {
      const entry = reachMap?.[shot.poseId];
      if (entry && doesPoseReachEnterRect(entry, OTS_HEADLINE_BOX, { padding: 16 })) {
        throw new Error(
          `shots[${i}].poseId '${shot.poseId}' overlaps the OTS headline zone; choose a clear pose or omit otsGraphic.`,
        );
      }
    }
    if (shot.shotType === "b-roll") {
      if (!shot.brollMedia) {
        throw new Error(`shots[${i}] (b-roll) must specify brollMedia from available media.`);
      }
      if (allowedMediaSet.size > 0 && !allowedMediaSet.has(shot.brollMedia)) {
        throw new Error(`shots[${i}].brollMedia '${shot.brollMedia}' is not in staged media list.`);
      }
    }
    for (const img of [shot.otsGraphic?.image, shot.otsGraphic?.image2, shot.card?.image]) {
      if (img && allowedMediaSet.size > 0 && !allowedMediaSet.has(img)) {
        throw new Error(`shots[${i}] references unknown media '${img}'.`);
      }
    }
  }

  // Strip validation-only normalized fields? No, preserve explicit agent choices in `candidateInput`
  return {
    multiShotInput: candidateInput,
    validated,
  };
}

/**
 * Uses the active operating agent (`askActiveAgent`) to direct the multi-shot plan cleanly
 * with approved poses, spacing checks, and retries (up to 3 total attempts) on invalid plans.
 */
export async function planShotsWithAgent({
  script,
  topic = {},
  audioDurationSeconds,
  transcript,
  transcriptSha256 = null,
  brollMediaList = [],
  defaultBackgroundId = "living-room",
  kitRoot = DEFAULT_KIT_ROOT,
  config = {},
  maxAttempts = 3,
  askAgentFn = askActiveAgent,
} = {}) {
  if (!transcript || !Array.isArray(transcript.words) || transcript.words.length === 0) {
    throw new AgentDirectorError("planShotsWithAgent requires a timed transcript with words.", []);
  }
  const { assets, approvals, reachMap } = loadKitPlanningAssets(kitRoot);
  const totalDurationFrames = Math.max(1, Math.round(audioDurationSeconds * 24));
  const backgroundIds = (assets.backgrounds ?? []).map((b) => b.id);
  const basePrompt = buildDirectorPrompt({
    script,
    topic,
    audioDurationSeconds,
    totalDurationFrames,
    transcript,
    brollMediaList,
    defaultBackgroundId,
    approvedPoses: approvals.approvedPoseIds,
    backgroundIds,
    reachMap,
  });

  const attempts = [];
  let lastError = null;
  let lastPayload = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = Date.now();
    const prompt = lastError
      ? `${basePrompt}${buildDirectorRetrySuffix({ attempt, maxAttempts, errorMessage: lastError, previousPayload: lastPayload })}`
      : basePrompt;

    let rawDraft;
    try {
      rawDraft = await askAgentFn(prompt, {
        agent: config?.writerAgent || "agy",
        timeoutMs: config?.agentTimeoutMs || 600_000,
        requireJson: true,
      });
    } catch (err) {
      attempts.push({
        attempt,
        ok: false,
        errorType: err?.name || "Error",
        error: err?.message || String(err),
        durationMs: Date.now() - startedAt,
      });
      if (err instanceof AgentUnavailableError || err?.name === "AgentUnavailableError") {
        throw err;
      }
      lastError = err?.message || String(err);
      lastPayload = null;
      continue;
    }

    lastPayload = rawDraft;
    try {
      const { multiShotInput, validated } = validateAgentDirectorDraft(rawDraft, {
        script,
        topic,
        audioDurationSeconds,
        transcript,
        transcriptSha256,
        brollMediaList,
        defaultBackgroundId,
        kitRoot,
      });
      attempts.push({ attempt, ok: true, durationMs: Date.now() - startedAt });
      return {
        multiShotInput,
        validated,
        attempts,
        director: "agent",
      };
    } catch (err) {
      attempts.push({
        attempt,
        ok: false,
        errorType: err?.name || "ValidationError",
        error: err?.message || String(err),
        durationMs: Date.now() - startedAt,
      });
      lastError = err?.message || String(err);
      if (err instanceof AgentOutputError) {
        lastPayload = null;
      }
    }
  }

  throw new AgentDirectorError(
    `Agent director failed after ${maxAttempts} attempt(s): ${lastError || "unknown error"}`,
    attempts,
  );
}
