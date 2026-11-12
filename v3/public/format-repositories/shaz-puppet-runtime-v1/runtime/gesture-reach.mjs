import crypto from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { createPoseRuntime } from "./pose-recipe.mjs";
import { renderRigFrame } from "./rig-v2-renderer.mjs";
import { PERFORMANCE_STAGE_VIEW } from "./render-sequence.mjs";

const ALPHA_THRESHOLD = 16;
const DESK_TOP_Y = 662;

function emptyBox() {
  return { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1, pixelCount: 0 };
}

function finalizeBox(box) {
  if (!box || box.pixelCount === 0 || box.maxX < box.minX) return null;
  return {
    minX: box.minX,
    minY: box.minY,
    maxX: box.maxX,
    maxY: box.maxY,
    pixelCount: box.pixelCount,
  };
}

function expandBox(box, x, y) {
  if (x < box.minX) box.minX = x;
  if (x > box.maxX) box.maxX = x;
  if (y < box.minY) box.minY = y;
  if (y > box.maxY) box.maxY = y;
  box.pixelCount += 1;
}

/**
 * Computes tight alpha bounding boxes from a rendered RGBA frame (overall + aboveDesk `y < 662`).
 * Optionally returns coarse 32px cell coordinates for accurate arbitrary zone overlap queries.
 */
export function scanRgbaReach(rgba, width, height, { cellSize = 16 } = {}) {
  const overall = emptyBox();
  const aboveDesk = emptyBox();
  const topLeftBand = emptyBox(); // y < 220, x < 540
  const cells = new Set();

  for (let y = 0; y < height; y += 1) {
    const rowOff = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const a = rgba[rowOff + x * 4 + 3];
      if (a <= ALPHA_THRESHOLD) continue;
      expandBox(overall, x, y);
      if (y < DESK_TOP_Y) {
        expandBox(aboveDesk, x, y);
      }
      if (y < 220 && x < 540) {
        expandBox(topLeftBand, x, y);
      }
      cells.add(`${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`);
    }
  }

  return {
    overall: finalizeBox(overall),
    aboveDesk: finalizeBox(aboveDesk),
    topLeftBand: finalizeBox(topLeftBand),
    occupiedCells: [...cells],
    cellSize,
  };
}

/**
 * Measures a single pose's union reach across its full authored duration using `renderRigFrame`.
 */
export async function measurePoseReach({
  manifest,
  assetRoot,
  propRoot,
  poseId,
  recipe,
  recipeSha256 = null,
  assetCache = new Map(),
  propCache = new Map(),
  cellSize = 16,
} = {}) {
  const runtime = createPoseRuntime(manifest, recipe);

  const totalFrames = Math.max(1, Number(recipe?.durationFrames) || 1);
  const overall = emptyBox();
  const aboveDesk = emptyBox();
  const topLeftBand = emptyBox();
  const cells = new Set();

  for (let frame = 1; frame <= totalFrames; frame += 1) {
    const rendered = await renderRigFrame({
      manifest,
      frame,
      assetRoot,
      propRoot,
      assetCache,
      propCache,
      poseRuntime: runtime,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      stageView: PERFORMANCE_STAGE_VIEW,
    });
    const { data: raw, info } = await sharp(rendered.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const scan = scanRgbaReach(raw, info.width, info.height, { cellSize });
    if (scan.overall) {
      overall.minX = Math.min(overall.minX, scan.overall.minX);
      overall.minY = Math.min(overall.minY, scan.overall.minY);
      overall.maxX = Math.max(overall.maxX, scan.overall.maxX);
      overall.maxY = Math.max(overall.maxY, scan.overall.maxY);
      overall.pixelCount = Math.max(overall.pixelCount, scan.overall.pixelCount);
    }
    if (scan.aboveDesk) {
      aboveDesk.minX = Math.min(aboveDesk.minX, scan.aboveDesk.minX);
      aboveDesk.minY = Math.min(aboveDesk.minY, scan.aboveDesk.minY);
      aboveDesk.maxX = Math.max(aboveDesk.maxX, scan.aboveDesk.maxX);
      aboveDesk.maxY = Math.max(aboveDesk.maxY, scan.aboveDesk.maxY);
      aboveDesk.pixelCount = Math.max(aboveDesk.pixelCount, scan.aboveDesk.pixelCount);
    }
    if (scan.topLeftBand) {
      topLeftBand.minX = Math.min(topLeftBand.minX, scan.topLeftBand.minX);
      topLeftBand.minY = Math.min(topLeftBand.minY, scan.topLeftBand.minY);
      topLeftBand.maxX = Math.max(topLeftBand.maxX, scan.topLeftBand.maxX);
      topLeftBand.maxY = Math.max(topLeftBand.maxY, scan.topLeftBand.maxY);
      topLeftBand.pixelCount = Math.max(topLeftBand.pixelCount, scan.topLeftBand.pixelCount);
    }
    for (const key of scan.occupiedCells) cells.add(key);
  }

  return {
    poseId,
    recipeSha256,
    durationFrames: totalFrames,
    cellSize,
    overall: finalizeBox(overall),
    aboveDesk: finalizeBox(aboveDesk),
    topLeftBand: finalizeBox(topLeftBand),
    occupiedCells: [...cells].sort(),
  };
}

/**
 * Checks whether a measured pose occupancy mask enters a screen-space rectangle (with optional padding).
 */
export function doesPoseReachEnterRect(poseReach, rect, { padding = 0 } = {}) {
  if (!poseReach || !rect) return false;
  const rx1 = rect.left - padding;
  const ry1 = rect.top - padding;
  const rx2 = rect.left + rect.width + padding;
  const ry2 = rect.top + rect.height + padding;

  const cellSize = poseReach.cellSize || 16;
  if (Array.isArray(poseReach.occupiedCells) && poseReach.occupiedCells.length > 0) {
    for (const key of poseReach.occupiedCells) {
      const [cxStr, cyStr] = key.split(",");
      const x1 = Number(cxStr) * cellSize;
      const y1 = Number(cyStr) * cellSize;
      const x2 = x1 + cellSize;
      const y2 = y1 + cellSize;
      if (x2 >= rx1 && x1 <= rx2 && y2 >= ry1 && y1 <= ry2) {
        return true;
      }
    }
    return false;
  }

  const box = poseReach.aboveDesk || poseReach.overall;
  if (!box) return false;
  return box.maxX >= rx1 && box.minX <= rx2 && box.maxY >= ry1 && box.minY <= ry2;
}

const DEFAULT_KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let cachedReachData = null;

/**
 * Counts opaque pixels inside a screen-space rectangle of a rendered RGBA frame.
 */
export function scanRectAlphaOverlap(rgba, width, height, rect, { padding = 0, alphaThreshold = ALPHA_THRESHOLD } = {}) {
  if (!rgba || !rect) return 0;
  const x1 = Math.max(0, Math.floor(rect.left - padding));
  const y1 = Math.max(0, Math.floor(rect.top - padding));
  const x2 = Math.min(width - 1, Math.ceil(rect.left + rect.width + padding));
  const y2 = Math.min(height - 1, Math.ceil(rect.top + rect.height + padding));
  let overlapPixels = 0;
  for (let y = y1; y <= y2; y += 1) {
    const rowOff = y * width * 4;
    for (let x = x1; x <= x2; x += 1) {
      if (rgba[rowOff + x * 4 + 3] > alphaThreshold) {
        overlapPixels += 1;
      }
    }
  }
  return overlapPixels;
}

/**
 * Loads `assets/staging/gesture-reach.json` asynchronously, returning `{ micAboveDeskBox, poses }`.
 */
export async function loadGestureReachData(root = DEFAULT_KIT_ROOT) {
  const reachPath = path.join(root, "assets", "staging", "gesture-reach.json");
  try {
    const parsed = JSON.parse(await fs.readFile(reachPath, "utf8"));
    return {
      micAboveDeskBox: parsed?.micAboveDeskBox || null,
      poses: parsed?.poses || {},
    };
  } catch {
    return { micAboveDeskBox: null, poses: {} };
  }
}

/**
 * Synchronously loads and caches `assets/staging/gesture-reach.json` for fast planner checks.
 */
export function loadGestureReachMapSync(root = DEFAULT_KIT_ROOT) {
  if (root === DEFAULT_KIT_ROOT && cachedReachData) {
    return cachedReachData;
  }
  const reachPath = path.join(root, "assets", "staging", "gesture-reach.json");
  try {
    const parsed = JSON.parse(fsSync.readFileSync(reachPath, "utf8"));
    const data = parsed?.poses || {};
    if (root === DEFAULT_KIT_ROOT) cachedReachData = data;
    return data;
  } catch {
    return {};
  }
}

/**
 * Loads `assets/staging/gesture-reach.json` if present, keyed by `poseId`.
 */
export async function loadGestureReachMap(root = DEFAULT_KIT_ROOT) {
  const data = await loadGestureReachData(root);
  return data.poses;
}

export function sha256Text(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
