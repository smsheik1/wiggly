import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SERPER_IMAGES_URL = "https://google.serper.dev/images";

/**
 * Loads the Serper API key from secrets.env or environment variables in memory.
 */
export function getSerperApiKey() {
  if (process.env.SERPER_API_KEY?.trim()) {
    return process.env.SERPER_API_KEY.trim();
  }

  // Walk up directories to find secrets.env
  let currentDir = process.cwd();
  for (let i = 0; i < 7; i += 1) {
    const candidate = path.join(currentDir, "secrets.env");
    if (fs.existsSync(candidate)) {
      try {
        const lines = fs.readFileSync(candidate, "utf8").split("\n");
        for (const line of lines) {
          if (line.startsWith("SERPER_API_KEY=")) {
            const val = line.split("=")[1]?.trim();
            if (val) return val;
          }
        }
      } catch {
        // Ignore read errors
      }
    }
    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  return null;
}

/**
 * Searches Google Images via the Serper API.
 * Returns structured candidate objects with titles, sources, domains, and image URLs.
 *
 * @param {string} query - Search query
 * @param {Object} [options]
 * @param {number} [options.count=5] - Number of image candidates to retrieve
 * @param {string} [options.apiKey] - Explicit API key override
 * @param {Function} [options.fetchFn=fetch] - Injected fetch function for testing
 * @returns {Promise<Array<{ index: number, title: string, imageUrl: string, source: string, domain: string, width?: number, height?: number }>|null>}
 */
export async function searchGoogleImages(query, { count = 5, apiKey: explicitKey, fetchFn = fetch } = {}) {
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("searchGoogleImages requires a non-empty query string");
  }

  const key = explicitKey !== undefined ? explicitKey : getSerperApiKey();
  if (!key) {
    return null;
  }

  const response = await fetchFn(SERPER_IMAGES_URL, {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query.trim(),
      num: Math.max(1, Math.min(count, 10)),
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Serper API error (HTTP ${response.status}): ${errText.slice(0, 240)}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.images)) {
    return [];
  }

  return data.images.slice(0, count).map((item, index) => ({
    index,
    title: item.title || "",
    imageUrl: item.imageUrl || "",
    source: item.source || item.domain || "Web",
    domain: item.domain || "",
    width: item.imageWidth,
    height: item.imageHeight,
  }));
}
