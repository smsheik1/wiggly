import { readFile } from "node:fs/promises";
import path from "node:path";

export async function namedSecret(name: string): Promise<string> {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  const pattern = new RegExp(`^${name}=([^\\r\\n]+)`, "m");
  for (const root of [process.cwd(), path.join(process.cwd(), "..")]) {
    try {
      const content = await readFile(path.join(root, "secrets.env"), "utf8");
      const match = content.match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    } catch {
      // The next directory may hold the file.
    }
  }
  return "";
}
