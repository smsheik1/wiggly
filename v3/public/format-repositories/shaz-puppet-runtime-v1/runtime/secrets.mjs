import fsSync from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Strips one matching pair of single or double quotes around a parsed value.
 */
export function stripMatchingQuotes(raw) {
  const trimmed = String(raw ?? "").trim();
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
 * Parses KEY=VALUE lines from `secrets.env`, preserving `=` in values,
 * trimming surrounding quotes, accepting an optional `export ` prefix,
 * and ignoring `#` comments and blank lines.
 */
export function parseSecretsEnv(content) {
  const map = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    let trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ") || trimmed.startsWith("export\t")) {
      trimmed = trimmed.slice(6).trim();
    }
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

function searchUpwardForSecrets(startDir, maxDepth = 8) {
  let currentDir = path.resolve(startDir);
  for (let i = 0; i < maxDepth; i += 1) {
    const candidate = path.join(currentDir, "secrets.env");
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return null;
}

/**
 * Walks upward from the module's own directory (never `process.cwd()` by default)
 * to locate `secrets.env` reliably regardless of working directory.
 */
export function findSecretsEnvPath(startDir = MODULE_DIR, fallbackDir = MODULE_DIR) {
  const primary = startDir ? searchUpwardForSecrets(startDir) : null;
  if (primary) return primary;
  if (fallbackDir && fallbackDir !== startDir) {
    return searchUpwardForSecrets(fallbackDir);
  }
  return null;
}

/**
 * Reads a named secret from `env` first, then from `secretsPath` or upward-located `secrets.env`.
 * Never logs secret values. Pass `secretsPath: null` to skip filesystem lookup.
 */
export function readSecret(name, { env = process.env, secretsPath } = {}) {
  const keyName = String(name || "").trim();
  if (!keyName) return null;

  const fromEnv = env?.[keyName];
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim();
  }

  if (secretsPath === null) {
    return null;
  }

  const resolvedPath = secretsPath !== undefined ? secretsPath : findSecretsEnvPath();
  if (!resolvedPath || !fsSync.existsSync(resolvedPath)) {
    return null;
  }

  try {
    const parsed = parseSecretsEnv(fsSync.readFileSync(resolvedPath, "utf8"));
    return parsed[keyName] || null;
  } catch {
    return null;
  }
}
