import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface AntigravityPromptOptions {
  model?: string;
  schema?: object;
  effort?: "low" | "medium" | "high" | "max";
}

/**
 * Executes a prompt natively through the active Google Antigravity engine.
 * Requires zero external API keys, zero third-party dependencies, and zero credentials setup.
 */
export async function askAntigravity<T = any>(
  prompt: string,
  options?: AntigravityPromptOptions
): Promise<T> {
  const args = ["-p", prompt, "--output-format", "json"];

  if (options?.model) {
    args.push("--model", options.model);
  }
  if (options?.effort) {
    args.push("--effort", options.effort);
  }
  if (options?.schema) {
    args.push("--json-schema", JSON.stringify(options.schema));
  }

  const { stdout } = await execFileAsync("agy", args, {
    maxBuffer: 20 * 1024 * 1024,
  });

  const cleaned = stdout.trim();
  try {
    const wrapper = JSON.parse(cleaned);
    if (wrapper && typeof wrapper === "object") {
      // If structured_output contains valid keys matching our schema
      if (wrapper.structured_output && Object.keys(wrapper.structured_output).length > 0) {
        // If structured_output has our requested fields (e.g. beats)
        if (wrapper.structured_output.beats) {
          return wrapper.structured_output as T;
        }
      }

      // Check the text response field for markdown json codeblocks
      if (typeof wrapper.response === "string") {
        const jsonMatch = wrapper.response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[1]) as T;
          } catch {
            // continue
          }
        }
        try {
          return JSON.parse(wrapper.response) as T;
        } catch {
          // continue
        }
      }

      if (wrapper.structured_output) {
        return wrapper.structured_output as T;
      }
    }
    return wrapper as T;
  } catch {
    const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as T;
    }
    return cleaned as unknown as T;
  }
}
