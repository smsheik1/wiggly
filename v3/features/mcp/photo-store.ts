import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export function containedPath(root: string, accountId: string, filename: string) {
  if (!SAFE_ID.test(accountId)) throw new Error("Invalid account id.");
  const safeName = path.basename(filename).replace(/[^A-Za-z0-9._-]/g, "");
  if (!safeName || safeName.startsWith(".")) throw new Error("Invalid photo name.");
  const dir = path.resolve(root, accountId);
  const rootPath = path.resolve(root);
  const full = path.resolve(dir, safeName);
  if (dir !== rootPath && !dir.startsWith(rootPath + path.sep)) throw new Error("Photo path escaped the account directory.");
  if (!full.startsWith(dir + path.sep)) throw new Error("Photo path escaped the account directory.");
  return { dir, full, safeName };
}

export function photoFilename(label: string, originalName: string) {
  const safe = label.trim().replace(/[^A-Za-z0-9_-]/g, "");
  if (!safe) throw new Error("Invalid photo label.");
  const ext = path.extname(originalName || "").toLowerCase();
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  return `${safe}${allowed.has(ext) ? ext : ".jpg"}`;
}

export async function savePhoto(root: string, accountId: string, filename: string, bytes: Buffer) {
  const { dir, full, safeName } = containedPath(root, accountId, filename);
  await mkdir(dir, { recursive: true });
  await writeFile(full, bytes);
  return safeName;
}

export async function readPhoto(root: string, accountId: string, filename: string) {
  const { full } = containedPath(root, accountId, filename);
  return readFile(full);
}

export function signRender(secret: string, jobId: string, tag: string, expiresAt: number) {
  const payload = `${jobId}\n${tag}\n${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `/api/mcp/renders/${encodeURIComponent(jobId)}/${encodeURIComponent(tag)}?exp=${expiresAt}&sig=${sig}`;
}

export function renderSignatureValid(secret: string, jobId: string, tag: string, expiresAt: number, signature: string) {
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = createHmac("sha256", secret).update(`${jobId}\n${tag}\n${expiresAt}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function signPhoto(secret: string, accountId: string, filename: string, expiresAt: number) {
  const payload = `${accountId}\n${filename}\n${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `/api/mcp/photos/${accountId}/${encodeURIComponent(filename)}?exp=${expiresAt}&sig=${sig}`;
}

export function photoSignatureValid(secret: string, accountId: string, filename: string, expiresAt: number, signature: string) {
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = createHmac("sha256", secret).update(`${accountId}\n${filename}\n${expiresAt}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}
