import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface AgentPromptOptions {
  /** Explicitly bound operating worker; never a renderer or provider fallback. */
  operatingAgent?: (assignment: string) => Promise<unknown>;
  model?: string;
  schema?: object;
  effort?: "low" | "medium" | "high" | "max";
}

/**
 * Checks whether a given CLI binary exists in the PATH.
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
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
  options?: AgentPromptOptions
): Promise<T> {
  if (options?.operatingAgent) return await options.operatingAgent(prompt) as T;

  // 1. Google Antigravity Environment
  if (process.env.ANTIGRAVITY_AGENT || (await commandExists("agy"))) {
    const args = ["-p", prompt, "--output-format", "json"];
    if (options?.model) args.push("--model", options.model);
    if (options?.effort) args.push("--effort", options.effort);
    if (options?.schema) args.push("--json-schema", JSON.stringify(options.schema));

    const { stdout } = await execFileAsync("agy", args, { maxBuffer: 25 * 1024 * 1024 });
    const cleaned = stdout.trim();

    try {
      const wrapper = JSON.parse(cleaned);
      if (wrapper && typeof wrapper === "object") {
        if (wrapper.structured_output && Object.keys(wrapper.structured_output).length > 0) {
          return wrapper.structured_output as T;
        }
        if (typeof wrapper.response === "string") {
          const jsonMatch = wrapper.response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) return JSON.parse(jsonMatch[1]) as T;
          try {
            return JSON.parse(wrapper.response) as T;
          } catch {}
        }
      }
      return wrapper as T;
    } catch {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]) as T;
      return cleaned as unknown as T;
    }
  }

  // 2. Anthropic Claude Code Environment
  if (process.env.CLAUDECODE || (await commandExists("claude"))) {
    const args = ["-p", prompt];
    const { stdout } = await execFileAsync("claude", args, { maxBuffer: 25 * 1024 * 1024 });
    const cleaned = stdout.trim();
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) return JSON.parse(match[1]) as T;
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return cleaned as unknown as T;
    }
  }

  // 3. If neither CLI exists, fail with explicit Rule 13 instruction
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
