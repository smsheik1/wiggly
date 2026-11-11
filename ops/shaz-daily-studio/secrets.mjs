import fs from "node:fs";
import path from "node:path";
import process from "node:process";

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

function stripMatchingQuotes(raw) {
  const trimmed = raw.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

/**
 * Finds `secrets.env` by walking upward from `startDir` (up to 7 parent directories).
 */
export function findSecretsEnvPath(startDir = process.cwd()) {
  let currentDir = path.resolve(startDir);
  for (let i = 0; i < 7; i += 1) {
    const candidate = path.join(currentDir, "secrets.env");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return null;
}

/**
 * Parses KEY=VALUE entries from a dotenv-style secrets file without truncating `=` characters.
 */
export function parseSecretsEnv(content) {
  const map = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = stripMatchingQuotes(trimmed.slice(eqIndex + 1));
    if (key && value) {
      map[key] = value;
    }
  }
  return map;
}

/**
 * Loads a named credential from environment variables or `secrets.env`.
 */
export function getSecretKey(name, { env = process.env, secretsPath } = {}) {
  const fromEnv = env?.[name]?.trim();
  if (fromEnv) return fromEnv;

  const resolvedPath = secretsPath !== undefined ? secretsPath : findSecretsEnvPath();
  if (!resolvedPath || !fs.existsSync(resolvedPath)) return null;

  try {
    const parsed = parseSecretsEnv(fs.readFileSync(resolvedPath, "utf8"));
    return parsed[name] || null;
  } catch {
    return null;
  }
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
