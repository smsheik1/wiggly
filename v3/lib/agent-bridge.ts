import { execFile } from "node:child_process";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SupportedAgentCli = "agy" | "claude";

export interface AgentPromptOptions {
  /** Explicitly bound operating worker; never a renderer or provider fallback. */
  operatingAgent?: (assignment: string) => Promise<unknown>;
  /** Pin a specific CLI binary instead of auto-detecting. */
  agent?: SupportedAgentCli;
  /** Kill the subprocess and fail loudly with AgentUnavailableError after this many milliseconds. */
  timeoutMs?: number;
  /** Reject non-JSON / non-object output with AgentOutputError instead of returning raw text. */
  requireJson?: boolean;
  model?: string;
  schema?: object;
  effort?: "low" | "medium" | "high" | "max";
}

export class AgentUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AgentUnavailableError";
  }
}

export class AgentOutputError extends Error {
  readonly preview: string;

  constructor(message: string, rawOutput = "", options?: { cause?: unknown }) {
    const preview = String(rawOutput ?? "").slice(0, 500);
    super(preview ? `${message}\nOutput preview: ${preview}` : message, options);
    this.name = "AgentOutputError";
    this.preview = preview;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isExecutableFile(candidate: string): boolean {
  try {
    const stat = fsSync.statSync(candidate);
    if (!stat.isFile()) return false;
    fsSync.accessSync(candidate, fsSync.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a CLI binary on PATH, falling back to `~/.local/bin/<cmd>` for scheduler shells.
 */
function resolveExecutable(command: SupportedAgentCli): string | null {
  const pathDirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const dir of pathDirs) {
    const candidate = path.join(dir, command);
    if (isExecutableFile(candidate)) return candidate;
  }

  const homeDir = process.env.HOME || os.homedir();
  if (homeDir) {
    const localBin = path.join(homeDir, ".local", "bin", command);
    if (isExecutableFile(localBin)) return localBin;
  }

  return null;
}

function buildMissingCliMessage(command: SupportedAgentCli): string {
  const loginHint = command === "agy"
    ? "Sign in via Antigravity IDE or run 'agy --help' to verify installation."
    : "Sign in via Claude Code ('claude auth status' / 'claude') to verify installation.";
  return (
    `Pinned agent CLI '${command}' is unavailable or not executable on PATH (checked PATH and ~/.local/bin/${command}).\n` +
    `Fix steps:\n` +
    `1. Check 'which ${command}' in Terminal.\n` +
    `2. ${loginHint}\n` +
    `3. Check 'ops/shaz-daily-studio/studio.config.json' ("writerAgent": "${command}").`
  );
}

function isCliEnvelope(wrapper: Record<string, unknown>): boolean {
  return (
    "structured_output" in wrapper
    || typeof wrapper.response === "string"
    || typeof wrapper.result === "string"
    || (wrapper.type === "result" && "is_error" in wrapper)
  );
}

function parseJsonString(rawText: string, requireObject: boolean): unknown {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const parsed = JSON.parse(candidate);
  if (requireObject && !isPlainObject(parsed)) {
    throw new Error(`Expected JSON object, received ${Array.isArray(parsed) ? "array" : typeof parsed}`);
  }
  return parsed;
}

function parseBridgeOutput<T>(rawStdout: string, { strict }: { strict: boolean }): T {
  const cleaned = rawStdout.trim();
  if (!cleaned) {
    if (strict) {
      throw new AgentOutputError("Agent returned empty output when JSON object was required.", cleaned);
    }
    return "" as unknown as T;
  }

  try {
    const top = JSON.parse(cleaned);
    if (isPlainObject(top) && isCliEnvelope(top)) {
      if (top.is_error === true) {
        const errText = typeof top.result === "string" ? top.result : typeof top.response === "string" ? top.response : cleaned;
        throw new AgentOutputError(`Agent CLI returned an error result payload.`, errText);
      }
      if (isPlainObject(top.structured_output) && Object.keys(top.structured_output).length > 0) {
        return top.structured_output as T;
      }
      const textField = typeof top.response === "string"
        ? top.response
        : typeof top.result === "string"
          ? top.result
          : null;
      if (textField !== null) {
        try {
          return parseJsonString(textField, strict) as T;
        } catch (err) {
          if (strict) {
            throw new AgentOutputError("Agent returned malformed JSON inside CLI response payload.", textField, { cause: err });
          }
          if (typeof top.response === "string") {
            return top as T;
          }
        }
      }
      if (strict) {
        throw new AgentOutputError("Agent CLI envelope did not contain a structured JSON object.", cleaned);
      }
      return top as T;
    }

    if (strict && !isPlainObject(top)) {
      throw new AgentOutputError("Agent returned non-object JSON when JSON object was required.", cleaned);
    }
    return top as T;
  } catch (err) {
    if (err instanceof AgentOutputError) throw err;
    try {
      return parseJsonString(cleaned, strict) as T;
    } catch (innerErr) {
      if (strict) {
        throw new AgentOutputError("Agent returned non-JSON output when JSON object was required.", cleaned, { cause: innerErr });
      }
      return cleaned as unknown as T;
    }
  }
}

function buildCliArgs(command: SupportedAgentCli, prompt: string, options?: AgentPromptOptions): string[] {
  const args = ["-p", prompt];
  if (command === "agy") {
    args.push("--output-format", "json");
    if (options?.agent || options?.timeoutMs || options?.requireJson) {
      args.push("--disable-slash-commands");
    }
    if (typeof options?.timeoutMs === "number" && options.timeoutMs > 0) {
      args.push("--print-timeout", String(Math.max(1, Math.ceil(options.timeoutMs / 1000))));
    }
  } else if (options?.requireJson || options?.schema) {
    args.push("--output-format", "json");
  }

  if (options?.model) args.push("--model", options.model);
  if (options?.effort) args.push("--effort", options.effort);
  if (options?.schema) args.push("--json-schema", JSON.stringify(options.schema));
  return args;
}

async function runCli<T>(
  command: SupportedAgentCli,
  executablePath: string,
  prompt: string,
  options?: AgentPromptOptions,
): Promise<T> {
  const strict = options?.requireJson === true;
  const timeoutMs = typeof options?.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : undefined;
  const args = buildCliArgs(command, prompt, options);

  try {
    const execOptions: {
      maxBuffer: number;
      timeout?: number;
      killSignal?: NodeJS.Signals;
    } = {
      maxBuffer: 25 * 1024 * 1024,
    };
    if (timeoutMs !== undefined) {
      execOptions.timeout = timeoutMs;
      execOptions.killSignal = "SIGTERM";
    }
    const { stdout } = await execFileAsync(executablePath, args, execOptions);
    return parseBridgeOutput<T>(stdout, { strict });
  } catch (err: any) {
    if (err instanceof AgentOutputError || err instanceof AgentUnavailableError) {
      throw err;
    }
    const detail = [err?.stderr, err?.stdout, err?.message].filter(Boolean).join(" ").trim();
    if (err?.killed || err?.signal === "SIGTERM" || err?.code === "ETIMEDOUT") {
      throw new AgentUnavailableError(
        `Agent '${command}' timed out after ${timeoutMs}ms.\n` +
        `Fix steps:\n` +
        `1. Check terminal auth with 'which ${command}' and run '${command} -p "reply ok"' manually.\n` +
        `2. Increase "agentTimeoutMs" in 'ops/shaz-daily-studio/studio.config.json' if legitimate turns need more time.`,
        { cause: err },
      );
    }
    if (options?.agent || err?.code === "ENOENT") {
      throw new AgentUnavailableError(
        `Agent '${command}' failed to execute (${err?.code ?? "non-zero exit"}): ${detail.slice(0, 400)}\n` +
        buildMissingCliMessage(command),
        { cause: err },
      );
    }
    throw err;
  }
}

/**
 * Universal Agent Host Bridge.
 * Allows ANY active coding agent environment (Google Antigravity, Anthropic Claude Code,
 * OpenAI Codex, or local runtime) to author creative artifacts natively.
 *
 * Enforces the "Agent-As-Author" Law:
 * Never degrade to dumb string templates or regex slicing. Use the active agent intelligence.
 */
export async function askActiveAgent<T = any>(
  prompt: string,
  options?: AgentPromptOptions,
): Promise<T> {
  if (options?.operatingAgent) return await options.operatingAgent(prompt) as T;

  if (options?.agent) {
    const exe = resolveExecutable(options.agent);
    if (!exe) {
      throw new AgentUnavailableError(buildMissingCliMessage(options.agent));
    }
    return runCli<T>(options.agent, exe, prompt, options);
  }

  // Legacy auto-detection path preserved for existing format callers (e.g. My Pixar Story)
  const agyPath = resolveExecutable("agy");
  if (process.env.ANTIGRAVITY_AGENT || agyPath) {
    return runCli<T>("agy", agyPath || "agy", prompt, options);
  }

  const claudePath = resolveExecutable("claude");
  if (process.env.CLAUDECODE || claudePath) {
    return runCli<T>("claude", claudePath || "claude", prompt, options);
  }

  throw new Error(
    `\n================================================================================\n` +
    `❌ AGENT-AS-AUTHOR FAILURE: NO ACTIVE AGENT CLI DETECTED (Wiggly Rule 13)\n` +
    `================================================================================\n` +
    `Wiggly formats require creative screenplay and visual direction from the operating agent.\n` +
    `Neither 'agy' (Google Antigravity) nor 'claude' (Claude Code) CLI was detected in PATH.\n\n` +
    `Action required from the Operating Agent:\n` +
    `You are the active intelligence in this environment! You must author the creative\n` +
    `contract directly (e.g. storyboard.json) using your own model context before\n` +
    `triggering passive media rendering. Do NOT write mechanical regex sentence splitters\n` +
    `or hardcoded strings.\n` +
    `================================================================================\n`
  );
}
