import crypto from "node:crypto";
import fsPromises from "node:fs/promises";
import fsSync from "node:fs";
import process from "node:process";
import { getSecretKey, redactSecrets } from "./secrets.mjs";

const CONVEX_DASHBOARD_SETTINGS_URL =
  "https://dashboard.convex.dev (select deployment wry-viper-639 -> Settings -> Environment Variables)";

function formatMissingConfigError(missingVar, details) {
  return new Error(
    `\n================================================================================\n` +
      `❌ STUDIO MEDIA HOST ERROR: ${missingVar} IS MISSING OR INVALID\n` +
      `================================================================================\n` +
      `${details}\n\n` +
      `Baby steps to fix:\n` +
      `1. Generate a strong secret in Terminal: openssl rand -hex 32\n` +
      `2. Open ${CONVEX_DASHBOARD_SETTINGS_URL} and add: STUDIO_UPLOAD_SECRET=<generated_secret>\n` +
      `3. Open 'secrets.env' at repo root and add these two lines:\n` +
      `   STUDIO_UPLOAD_SECRET=<same_generated_secret>\n` +
      `   CONVEX_SITE_URL=https://wry-viper-639.convex.site\n` +
      `================================================================================\n`,
  );
}

function resolveMediaHostConfig(options = {}) {
  const {
    convexSiteUrl: explicitUrl,
    studioUploadSecret: explicitSecret,
    env = process.env,
    secretsPath,
  } = options;

  const siteUrl = (
    explicitUrl !== undefined
      ? explicitUrl
      : getSecretKey("CONVEX_SITE_URL", { env, secretsPath })
  )?.trim().replace(/\/+$/, "");

  if (!siteUrl || !siteUrl.startsWith("https://")) {
    throw formatMissingConfigError(
      "CONVEX_SITE_URL",
      `CONVEX_SITE_URL must be an https:// Convex site URL (got: ${siteUrl || "unset"}).`,
    );
  }

  const secret = (
    explicitSecret !== undefined
      ? explicitSecret
      : getSecretKey("STUDIO_UPLOAD_SECRET", { env, secretsPath })
  )?.trim();

  if (!secret) {
    throw formatMissingConfigError(
      "STUDIO_UPLOAD_SECRET",
      "STUDIO_UPLOAD_SECRET is required to authenticate uploads to wry-viper-639.",
    );
  }

  return { siteUrl, secret };
}

async function parseErrorBody(res) {
  try {
    const raw = await res.text();
    try {
      const json = JSON.parse(raw);
      return json?.error || raw;
    } catch {
      return raw;
    }
  } catch {
    return "";
  }
}

async function postStudioEndpoint({ siteUrl, secret, endpointPath, body, fetchFn }) {
  let res;
  try {
    res = await fetchFn(`${siteUrl}${endpointPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-studio-secret": secret,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      redactSecrets(
        `Convex studio endpoint ${endpointPath} network failure: ${err.message}`,
        [secret],
      ),
    );
  }

  if (!res.ok) {
    const detail = await parseErrorBody(res);
    throw new Error(
      redactSecrets(
        `Convex studio endpoint ${endpointPath} failed (HTTP ${res.status}): ${detail || res.statusText}.\n` +
          `Verify STUDIO_UPLOAD_SECRET matches in ${CONVEX_DASHBOARD_SETTINGS_URL} and 'secrets.env', ` +
          `and verify CONVEX_SITE_URL=https://wry-viper-639.convex.site in 'secrets.env'.`,
        [secret],
      ),
    );
  }

  return res.json();
}

/**
 * Uploads the winning vertical MP4 to Convex storage via authenticated HTTP actions
 * and returns `{ url, storageId, sha256, bytes }`.
 */
export async function uploadPublishVideo(filePath, options = {}) {
  const { fetchFn = fetch } = options;
  const { siteUrl, secret } = resolveMediaHostConfig(options);

  if (!filePath || !fsSync.existsSync(filePath)) {
    throw new Error(`Publish video file not found: ${filePath}`);
  }

  const fileBytes = await fsPromises.readFile(filePath);
  if (fileBytes.length === 0) {
    throw new Error(`Publish video file is empty: ${filePath}`);
  }
  const fileSha256 = crypto.createHash("sha256").update(fileBytes).digest("hex");

  // 1. Mint one-time upload URL + server-tracked ticket
  const issued = await postStudioEndpoint({
    siteUrl,
    secret,
    endpointPath: "/studio/upload-url",
    body: {},
    fetchFn,
  });
  if (!issued?.uploadUrl || !issued?.uploadToken) {
    throw new Error("Convex /studio/upload-url returned incomplete payload (missing uploadUrl or uploadToken).");
  }

  // 2. Upload MP4 bytes directly to Convex storage upload URL
  let uploadRes;
  try {
    uploadRes = await fetchFn(issued.uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "video/mp4" },
      body: fileBytes,
    });
  } catch (err) {
    throw new Error(redactSecrets(`Convex binary upload network failure: ${err.message}`, [secret]));
  }
  if (!uploadRes.ok) {
    const detail = await parseErrorBody(uploadRes);
    throw new Error(
      redactSecrets(`Convex binary upload failed (HTTP ${uploadRes.status}): ${detail}`, [secret]),
    );
  }
  const uploadData = await uploadRes.json();
  const storageId = uploadData?.storageId;
  if (!storageId) {
    throw new Error("Convex binary upload response missing storageId.");
  }

  // 3. Register metadata + TTL and resolve clean public URL
  const finalized = await postStudioEndpoint({
    siteUrl,
    secret,
    endpointPath: "/studio/file-url",
    body: {
      storageId,
      uploadToken: issued.uploadToken,
      sha256: fileSha256,
      bytes: fileBytes.length,
    },
    fetchFn,
  });

  if (!finalized?.url || !finalized.url.startsWith("https://") || /api\.telegram\.org/i.test(finalized.url)) {
    throw new Error(`Convex /studio/file-url returned an unsafe or invalid URL: ${finalized?.url || "empty"}`);
  }

  return {
    url: finalized.url,
    storageId: finalized.storageId || storageId,
    sha256: fileSha256,
    bytes: fileBytes.length,
  };
}

/**
 * Deletes an uploaded studio video from Convex storage immediately after social publishing finishes.
 */
export async function deletePublishVideo(storageId, options = {}) {
  const { fetchFn = fetch } = options;
  const { siteUrl, secret } = resolveMediaHostConfig(options);

  if (!storageId || typeof storageId !== "string") {
    throw new Error("deletePublishVideo requires a valid storageId.");
  }

  return postStudioEndpoint({
    siteUrl,
    secret,
    endpointPath: "/studio/delete",
    body: { storageId },
    fetchFn,
  });
}
