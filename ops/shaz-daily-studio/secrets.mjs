import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  findSecretsEnvPath as findKitSecretsEnvPath,
  parseSecretsEnv,
  readSecret,
} from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/secrets.mjs";

const STUDIO_DIR = path.dirname(fileURLToPath(import.meta.url));

const SENSITIVE_KEY_NAMES = [
  "TELEGRAM_BOT_TOKEN",
  "STUDIO_UPLOAD_SECRET",
  "BUFFER_API_KEY",
  "SHAZSKISBUFFER_API_KEY",
  "SERPER_API_KEY",
  "NEWSMCP_API_KEY",
  "CARTESIA_API_KEY",
  "FISH_STUDIO_APIKEY",
  "TYPESAFE_API_KEY",
  "JEV_API_KEY",
];

/**
 * Finds `secrets.env` by walking upward from `startDir`,
 * falling back to walking upward from `ops/shaz-daily-studio` so scheduler cwd never breaks lookups.
 */
export function findSecretsEnvPath(startDir = process.cwd(), fallbackDir = STUDIO_DIR) {
  return findKitSecretsEnvPath(startDir, fallbackDir);
}

export { parseSecretsEnv };

/**
 * Loads a named credential from environment variables or `secrets.env`.
 */
export function getSecretKey(name, { env = process.env, secretsPath } = {}) {
  const resolvedPath = secretsPath !== undefined ? secretsPath : findSecretsEnvPath();
  return readSecret(name, { env, secretsPath: resolvedPath });
}

/**
 * Masks Telegram bot token patterns and known credential strings in log/error text.
 */
export function redactSecrets(text, extraSecrets = [], { env = process.env, secretsPath } = {}) {
  let output = String(text ?? "").replace(/bot\d+:[A-Za-z0-9_-]+/g, "bot[REDACTED]");

  const candidates = new Set();
  for (const val of extraSecrets) {
    if (typeof val === "string" && val.trim().length >= 8) {
      candidates.add(val.trim());
    }
  }
  for (const keyName of SENSITIVE_KEY_NAMES) {
    const val = getSecretKey(keyName, { env, secretsPath });
    if (val && val.length >= 8) {
      candidates.add(val);
    }
  }

  for (const secret of candidates) {
    output = output.split(secret).join("[REDACTED]");
  }
  return output;
}
