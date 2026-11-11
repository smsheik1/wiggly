import crypto from "node:crypto";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export const USER_AGENT = "WigglyShazStudio/1.0 (+https://wiggly.agentenamel.com)";
export const MAX_HTML_BYTES = 3 * 1024 * 1024;
export const TIMEOUT_MS = 10_000;
export const MIN_ARTICLE_CHARS = 800;
export const MAX_ARTICLE_URLS = 3;

export class ArticleFetchError extends Error {
  constructor(message, attempts = [], options) {
    super(message, options);
    this.name = "ArticleFetchError";
    this.attempts = attempts;
  }
}

function classifyHttpFailure(status) {
  if (status === 401 || status === 402) return "paywall";
  if (status === 403) return "403";
  if (status === 404) return "404";
  return `http-${status}`;
}

async function readBoundedHtml(response, maxBytes = MAX_HTML_BYTES) {
  const lengthHeader = response.headers?.get?.("content-length");
  if (lengthHeader) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) {
      const err = new Error(`Response exceeded ${maxBytes} byte cap (Content-Length: ${declared}).`);
      err.reason = "too-large";
      throw err;
    }
  }

  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const byteLen = value?.byteLength ?? value?.length ?? 0;
        received += byteLen;
        if (received > maxBytes) {
          await reader.cancel().catch(() => {});
          const err = new Error(`Response stream exceeded ${maxBytes} byte cap.`);
          err.reason = "too-large";
          throw err;
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks).toString("utf8");
  }

  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    const err = new Error(`Response text exceeded ${maxBytes} byte cap.`);
    err.reason = "too-large";
    throw err;
  }
  return text;
}

/**
 * Extracts clean article title and readable text from raw HTML using Linkedom + Readability.
 */
export function extractArticleFromHtml(html, url, { minChars = MIN_ARTICLE_CHARS } = {}) {
  const { document } = parseHTML(html);
  try {
    Object.defineProperty(document, "baseURI", { value: url, configurable: true });
  } catch {}
  const reader = new Readability(document);
  const parsed = reader.parse();

  const rawText = String(parsed?.textContent || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (rawText.length < minChars) {
    const err = new Error(
      `Extracted article text too short (${rawText.length} chars < ${minChars} required; possible paywall, cookie wall, or video-only page).`,
    );
    err.reason = "too-short";
    throw err;
  }

  const title = String(parsed?.title || document.title || "").trim();
  const sha256 = crypto.createHash("sha256").update(rawText, "utf8").digest("hex");

  return {
    url,
    fetchedAt: new Date().toISOString(),
    sha256,
    title,
    text: rawText,
  };
}

/**
 * Fetches and extracts readable HTML article content from a single URL under strict bounds.
 */
export async function fetchArticleFromUrl(
  url,
  {
    fetchFn = fetch,
    timeoutMs = TIMEOUT_MS,
    maxBytes = MAX_HTML_BYTES,
    minChars = MIN_ARTICLE_CHARS,
  } = {},
) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (err) {
    const badUrl = new Error(`Invalid URL: ${url}`, { cause: err });
    badUrl.reason = "invalid-url";
    throw badUrl;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    const badProto = new Error(`Unsupported URL protocol: ${parsedUrl.protocol}`);
    badProto.reason = "invalid-url";
    throw badProto;
  }

  let response;
  try {
    response = await fetchFn(parsedUrl.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const isTimeout = err?.name === "AbortError" || err?.name === "TimeoutError" || /timeout/i.test(String(err?.message));
    const wrapped = new Error(`Fetch failed for ${url}: ${err.message}`, { cause: err });
    wrapped.reason = isTimeout ? "timeout" : "network-error";
    throw wrapped;
  }

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status} fetching ${url}`);
    err.reason = classifyHttpFailure(response.status);
    throw err;
  }

  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    const err = new Error(`Rejected non-HTML content-type '${contentType}' at ${url}`);
    err.reason = "non-html";
    throw err;
  }

  const html = await readBoundedHtml(response, maxBytes);
  const finalUrl = response.url || parsedUrl.toString();
  return extractArticleFromHtml(html, finalUrl, { minChars });
}

/**
 * Tries up to 3 candidate source URLs for a topic in order and returns the first readable article.
 */
export async function fetchArticleForTopic(topic, options = {}) {
  const rawUrls = [
    ...(Array.isArray(topic?.sources) ? topic.sources : []),
    ...(topic?.link ? [topic.link] : []),
  ];
  const uniqueUrls = Array.from(new Set(rawUrls.map((u) => String(u || "").trim()).filter(Boolean))).slice(
    0,
    MAX_ARTICLE_URLS,
  );

  if (uniqueUrls.length === 0) {
    throw new ArticleFetchError(`No source URLs available for topic "${topic?.title || "untitled"}".`, []);
  }

  const attempts = [];
  for (const url of uniqueUrls) {
    try {
      return await fetchArticleFromUrl(url, options);
    } catch (err) {
      attempts.push({
        url,
        reason: err?.reason || "fetch-error",
        detail: err?.message || String(err),
      });
    }
  }

  const summary = attempts.map((a) => `${a.url} [${a.reason}]`).join("; ");
  throw new ArticleFetchError(
    `All ${uniqueUrls.length} source URLs failed for "${topic?.title || "untitled"}": ${summary}`,
    attempts,
  );
}
