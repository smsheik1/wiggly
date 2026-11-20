import assert from "node:assert/strict";
import test from "node:test";

import {
  ArticleFetchError,
  fetchArticleForTopic,
  fetchArticleFromUrl,
  MAX_HTML_BYTES,
  USER_AGENT,
} from "../article-fetch.mjs";
import { buildAuthorPrompt } from "../studio-daily.mjs";

function makeArticleHtml(title, bodyParagraphs) {
  return `<!doctype html>
<html>
<head><title>${title}</title></head>
<body>
  <nav><a href="/">Home</a> <a href="/news">News</a></nav>
  <main>
    <article>
      <h1>${title}</h1>
      ${bodyParagraphs.map((p) => `<p>${p}</p>`).join("\n")}
    </article>
  </main>
</body>
</html>`;
}

const LONG_ARTICLE_PARAGRAPHS = [
  "Sony Interactive Entertainment confirmed on Tuesday that it is updating console bundle pricing across major European retailers starting next week, introducing a temporary promotion for players entering the generation late.",
  "According to the official announcement published on the company blog, standard disc editions will sell for €499 while refurbished units listed through certified resellers will drop by €40 for fourteen days.",
  "Retail analysts note that memory component availability stabilized this quarter, giving platform holders room to experiment with seasonal promotional hardware pricing ahead of the holiday software calendar.",
  "Customer demand for mid-cycle hardware bundles remains strong despite digital library growth, particularly among households upgrading from previous consoles ahead of upcoming blockbuster releases.",
  "Spokespeople also clarified that standalone DualSense controllers and storage expansion drives remain priced separately at standard retail rates across participating storefronts.",
];

test("fetchArticleFromUrl extracts clean readable article text, sends honest User-Agent, and hashes text", async () => {
  const html = makeArticleHtml("Sony Cuts PS5 Bundle Prices", LONG_ARTICLE_PARAGRAPHS);
  let capturedHeaders = null;

  const article = await fetchArticleFromUrl("https://news.example.com/ps5-bundle", {
    fetchFn: async (_url, init) => {
      capturedHeaders = init.headers;
      return {
        ok: true,
        status: 200,
        url: "https://news.example.com/ps5-bundle",
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        text: async () => html,
      };
    },
  });

  assert.equal(capturedHeaders["User-Agent"], USER_AGENT);
  assert.match(article.title, /Sony Cuts PS5 Bundle Prices/);
  assert.ok(article.text.length >= 800);
  assert.match(article.sha256, /^[a-f0-9]{64}$/);
});

test("fetchArticleFromUrl rejects paywall/short HTML (<800 chars), non-HTML content-type, and oversized streams (>3MB)", async () => {
  // Too short (<800 chars)
  const shortHtml = makeArticleHtml("Video Only", ["Watch the embedded player above for full details."]);
  await assert.rejects(
    () =>
      fetchArticleFromUrl("https://news.example.com/video", {
        fetchFn: async () => ({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/html" }),
          text: async () => shortHtml,
        }),
      }),
    (err) => err.reason === "too-short",
  );

  // Non-HTML
  await assert.rejects(
    () =>
      fetchArticleFromUrl("https://news.example.com/report.pdf", {
        fetchFn: async () => ({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/pdf" }),
          text: async () => "%PDF-1.4",
        }),
      }),
    (err) => err.reason === "non-html",
  );

  // Stream larger than MAX_HTML_BYTES
  await assert.rejects(
    () =>
      fetchArticleFromUrl("https://news.example.com/huge", {
        maxBytes: 1024,
        fetchFn: async () => ({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "text/html" }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(700));
              controller.enqueue(new Uint8Array(700));
              controller.close();
            },
          }),
        }),
      }),
    (err) => err.reason === "too-large",
  );
  assert.equal(MAX_HTML_BYTES, 3 * 1024 * 1024);
});

test("fetchArticleForTopic falls through up to 3 sources on 403/timeout and fails with per-URL reasons when all fail", async () => {
  const html = makeArticleHtml("Fallback Outlet Success", LONG_ARTICLE_PARAGRAPHS);
  const visited = [];

  const result = await fetchArticleForTopic(
    {
      title: "Sony Updates Pricing",
      sources: [
        "https://paywalled.example.com/a",
        "https://slow.example.com/b",
        "https://open.example.com/c",
        "https://ignored.example.com/d",
      ],
    },
    {
      fetchFn: async (url) => {
        visited.push(url);
        if (url.includes("paywalled")) {
          return { ok: false, status: 403, headers: new Headers() };
        }
        if (url.includes("slow")) {
          const timeoutErr = new Error("The operation was aborted due to timeout");
          timeoutErr.name = "TimeoutError";
          throw timeoutErr;
        }
        return {
          ok: true,
          status: 200,
          url,
          headers: new Headers({ "content-type": "text/html" }),
          text: async () => html,
        };
      },
    },
  );

  assert.deepEqual(visited, [
    "https://paywalled.example.com/a",
    "https://slow.example.com/b",
    "https://open.example.com/c",
  ]);
  assert.equal(result.url, "https://open.example.com/c");

  // All sources fail -> ArticleFetchError with attempts summary
  await assert.rejects(
    () =>
      fetchArticleForTopic(
        {
          title: "Unreachable Topic",
          sources: ["https://a.example.com", "https://b.example.com", "https://c.example.com", "https://d.example.com"],
        },
        {
          fetchFn: async (url) => {
            if (url.includes("a.")) return { ok: false, status: 403, headers: new Headers() };
            if (url.includes("b.")) return { ok: false, status: 402, headers: new Headers() };
            return { ok: true, status: 200, headers: new Headers({ "content-type": "text/html" }), text: async () => "<p>tiny</p>" };
          },
        },
      ),
    (err) =>
      err instanceof ArticleFetchError
      && err.attempts.length === 3
      && err.attempts[0].reason === "403"
      && err.attempts[1].reason === "paywall"
      && err.attempts[2].reason === "too-short",
  );
});

test("buildAuthorPrompt injects sourceUrl and capped article text without leaked example phrases", () => {
  const longText = `${"Word ".repeat(4000)}END_MARKER`;
  const prompt = buildAuthorPrompt(
    {
      title: "Valve Steam Frame Specs Detailed",
      snippet: "Valve shares headset details.",
      publishedAt: "2026-11-10T10:00:00Z",
    },
    {
      now: new Date("2026-11-11T12:00:00Z"),
      article: {
        url: "https://open.example.com/valve-steam-frame",
        text: longText,
      },
    },
  );

  assert.match(prompt, /Source URL: https:\/\/open\.example\.com\/valve-steam-frame/);
  assert.match(prompt, /"claims":/);
  assert.match(prompt, /between 70 and 85 words/);
  assert.equal(prompt.includes("END_MARKER"), false, "article injection must cap around 12,000 characters");
  assert.equal(prompt.includes("CRUSTY USED HARDWARE"), false);
  assert.equal(prompt.includes("ZERO ACTUAL DISCOUNTS"), false);
  assert.equal(prompt.includes("UNCONFIRMED DEAL RUMORS"), false);
  assert.equal(prompt.includes("PURE ALGORITHM CLICKBAIT"), false);
});
