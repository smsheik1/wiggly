import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Client } from "langsmith";
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";

export const secretsPath = "/Users/shaz/Projects/wiggly/secrets.env";
export async function namedSecret(name: string) {
  const source = await readFile(secretsPath, "utf8");
  const match = source.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, "m"));
  const value = match?.[1].trim().replace(/^(['"])(.*)\1$/, "$2");
  if (!value) throw new Error(`MISSING_CREDENTIAL: add ${name}=<your-key> to ${secretsPath}. Never paste it into chat.`);
  return value;
}

export function redact(value: any): any {
  if (typeof value === "string" && /^data:.*;base64,/.test(value)) {
    const bytes = Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
    return { media_omitted: true, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
  }
  if (value && typeof value === "object" && value.type === "image" && typeof value.data === "string") {
    const bytes = Buffer.from(value.data, "base64");
    return { ...value, data: { media_omitted: true, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length } };
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key, /^(apiKey|api_key|authorization|x-api-key|x-goog-api-key)$/i.test(key) ? "[REDACTED]" : redact(child),
  ]));
  return value;
}

export async function tracing() {
  const apiKey = await namedSecret("LANGSMITH_API_KEY");
  const failures: number[] = [];
  const client = new Client({
    apiKey, callerOptions: { maxRetries: 0 }, timeout_ms: 20000,
    hideInputs: redact, hideOutputs: redact, hideMetadata: redact,
    fetchImplementation: async (input, init) => {
      const response = await fetch(input, init);
      if (!response.ok) { failures.push(response.status); throw new Error(`LANGSMITH_HTTP_${response.status}`); }
      return response;
    },
  });
  return { client, failures, tracer: new LangChainTracer({ client, projectName: "wiggly-studio-phase1" }) };
}
