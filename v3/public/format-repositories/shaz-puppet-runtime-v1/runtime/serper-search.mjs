import { readSecret } from "./secrets.mjs";

const SERPER_IMAGES_URL = "https://google.serper.dev/images";

export class SerperApiError extends Error {
  constructor(message, { status = null, isAccountError = false, options } = {}) {
    super(message, options);
    this.name = "SerperApiError";
    this.status = status;
    this.isAccountError = isAccountError;
  }
}

/**
 * Loads the Serper API key from environment variables or module-anchored secrets.env.
 */
export function getSerperApiKey(options = {}) {
  return readSecret("SERPER_API_KEY", options);
}

/**
 * Searches Google Images via the Serper API.
 * Returns structured candidate objects with titles, sources, domains, and image URLs.
 * Throws loudly per Wiggly Rule 12 when SERPER_API_KEY is missing or HTTP fails.
 *
 * @param {string} query - Search query
 * @param {Object} [options]
 * @param {number} [options.count=5] - Number of image candidates to retrieve
 * @param {string} [options.apiKey] - Explicit API key override
 * @param {Object} [options.env] - Environment override
 * @param {string|null} [options.secretsPath] - Explicit secrets.env override
 * @param {Function} [options.fetchFn=fetch] - Injected fetch function for testing
 * @returns {Promise<Array<{ index: number, title: string, imageUrl: string, source: string, domain: string, width?: number, height?: number }>>}
 */
export async function searchGoogleImages(
  query,
  { count = 5, apiKey: explicitKey, env, secretsPath, fetchFn = fetch } = {},
) {
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("searchGoogleImages requires a non-empty query string");
  }

  const key = explicitKey !== undefined ? explicitKey : getSerperApiKey({ env, secretsPath });
  if (!key) {
    throw new SerperApiError(
      `\n================================================================================\n` +
      `❌ SERPER API ERROR: SERPER_API_KEY IS MISSING\n` +
      `================================================================================\n` +
      `Cannot source authentic visual imagery: SERPER_API_KEY is not configured.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open https://serper.dev/ and sign in to your dashboard.\n` +
      `2. Copy your API Key.\n` +
      `3. Open 'secrets.env' at repo root and add: SERPER_API_KEY=your_key_here\n` +
      `================================================================================\n`,
      { status: null, isAccountError: true },
    );
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
    throw new SerperApiError(
      `\n================================================================================\n` +
      `❌ SERPER API ERROR (HTTP ${response.status})\n` +
      `================================================================================\n` +
      `Search query "${query}" failed: ${errText.slice(0, 240)}\n\n` +
      `Baby steps to fix:\n` +
      `1. Visit https://serper.dev/dashboard to check remaining query credits or payment status.\n` +
      `2. Verify that your SERPER_API_KEY in 'secrets.env' is active.\n` +
      `================================================================================\n`,
      {
        status: response.status,
        isAccountError: [401, 402, 403, 429].includes(response.status),
      },
    );
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
