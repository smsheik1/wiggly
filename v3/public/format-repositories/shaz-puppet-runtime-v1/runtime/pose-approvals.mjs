import crypto from "node:crypto";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VALID_DECISIONS = new Set(["approved", "rejected", "pending"]);

function sha256BufferSync(filePath) {
  return crypto.createHash("sha256").update(fsSync.readFileSync(filePath)).digest("hex");
}

/**
 * Loads `poses/performance-approvals.json` and verifies approved entries against both
 * `poses/index.json` and the recipe file bytes on disk so modified recipes cannot keep stale approval.
 */
export function loadPerformanceApprovalsSync({
  root = KIT_ROOT,
  approvalsPath = null,
  indexPath = null,
} = {}) {
  const resolvedApprovalsPath = approvalsPath || path.join(root, "poses", "performance-approvals.json");
  const resolvedIndexPath = indexPath || path.join(root, "poses", "index.json");

  const approvalsRaw = JSON.parse(fsSync.readFileSync(resolvedApprovalsPath, "utf8"));
  if (approvalsRaw?.schemaVersion !== 1 || !Array.isArray(approvalsRaw?.poses)) {
    throw new Error(`Invalid performance approvals manifest at ${resolvedApprovalsPath}`);
  }

  const indexRaw = JSON.parse(fsSync.readFileSync(resolvedIndexPath, "utf8"));
  const indexById = new Map((indexRaw?.poses ?? []).map((entry) => [entry.id, entry]));

  const byId = new Map();
  const approvedPoseIds = [];
  const rejectedPoseIds = [];
  const pendingPoseIds = [];

  for (const record of approvalsRaw.poses) {
    const poseId = record?.poseId;
    if (typeof poseId !== "string" || !poseId || byId.has(poseId)) {
      throw new Error(`Duplicate or missing poseId '${poseId}' in performance-approvals.json`);
    }
    if (!VALID_DECISIONS.has(record.decision)) {
      throw new Error(`Invalid approval decision '${record.decision}' for pose '${poseId}'`);
    }

    const indexEntry = indexById.get(poseId);
    if (record.decision === "approved") {
      if (!indexEntry) {
        throw new Error(`Approved pose '${poseId}' is not registered in poses/index.json`);
      }
      if (record.recipeSha256 !== indexEntry.sha256) {
        throw new Error(
          `Approved pose '${poseId}' recipeSha256 mismatch against poses/index.json (${record.recipeSha256} !== ${indexEntry.sha256})`,
        );
      }
      const recipePath = path.resolve(path.dirname(resolvedIndexPath), indexEntry.path);
      const diskSha256 = sha256BufferSync(recipePath);
      if (diskSha256 !== record.recipeSha256) {
        throw new Error(
          `Approved pose '${poseId}' recipe bytes on disk changed (${diskSha256} !== ${record.recipeSha256}); re-approval required`,
        );
      }
      approvedPoseIds.push(poseId);
    } else if (record.decision === "rejected") {
      rejectedPoseIds.push(poseId);
    } else {
      pendingPoseIds.push(poseId);
    }

    byId.set(poseId, record);
  }

  return {
    schemaVersion: 1,
    path: resolvedApprovalsPath,
    byId,
    approvedPoseIds,
    approvedSet: new Set(approvedPoseIds),
    rejectedPoseIds,
    pendingPoseIds,
  };
}

/**
 * Returns the ordered list of creatively approved talk-to-camera puppet pose IDs.
 */
export function getApprovedPerformancePoses(options = {}) {
  return loadPerformanceApprovalsSync(options).approvedPoseIds;
}

/**
 * Checks whether `poseId` is explicitly approved (exact ID match, no alias resolution).
 */
export function isPoseApprovedForPerformance(poseId, options = {}) {
  return loadPerformanceApprovalsSync(options).approvedSet.has(poseId);
}

/**
 * Throws loudly if `poseId` is not approved for auto-pick performance plans.
 */
export function assertApprovedPerformancePose(poseId, options = {}) {
  const manifest = loadPerformanceApprovalsSync(options);
  if (manifest.approvedSet.has(poseId)) return manifest.byId.get(poseId);
  const entry = manifest.byId.get(poseId);
  const status = entry ? entry.decision : "unregistered";
  throw new Error(
    `Pose '${poseId}' is not approved for performance selection in poses/performance-approvals.json (status: ${status})`,
  );
}

export const APPROVED_PERFORMANCE_POSES = Object.freeze(getApprovedPerformancePoses());
