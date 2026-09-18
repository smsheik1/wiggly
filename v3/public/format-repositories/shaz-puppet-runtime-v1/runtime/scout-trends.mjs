import { chromium } from "playwright";

export const DEFAULT_SUBREDDITS = [
  "GamingLeaksAndRumours",
  "apple",
  "MarvelStudiosSpoilers",
  "GTA6",
  "LocalLLaMA"
];

export const KNOWN_CURATORS = [
  "Jason Schreier",
  "Mark Gurman",
  "billbil-kun",
  "Tom Henderson",
  "Ming-Chi Kuo",
  "Ross Young",
  "DanielRPK",
  "Kepler_L2",
  "Jeff Grubb",
  "Alex Perez",
  "Tez2"
];

/**
 * Parses raw Reddit RSS feed into clean structured post entries.
 */
export function parseRedditRss(xmlText) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryBlock = match[1];

    const titleMatch = /<title>(.*?)<\/title>/.exec(entryBlock);
    const linkMatch = /<link href="([^"]+)"/.exec(entryBlock);
    const authorMatch = /<author><name>(.*?)<\/name><\/author>/.exec(entryBlock);
    const updatedMatch = /<updated>(.*?)<\/updated>/.exec(entryBlock);
    const contentMatch = /<content type="html">([\s\S]*?)<\/content>/.exec(entryBlock);

    if (!titleMatch || !linkMatch) continue;

    const rawTitle = titleMatch[1];
    // Skip pinned weekly discussion megathreads, advice threads, or discord promos
    if (/weekly.*thread|discussion.*request thread|advice thread|megathread|discord!|join the official/i.test(rawTitle)) {
      continue;
    }

    const title = decodeHtml(rawTitle).trim();
    const link = linkMatch[1];
    const author = authorMatch ? authorMatch[1].replace(/^\/u\//, "") : "unknown";
    const updated = updatedMatch ? updatedMatch[1] : new Date().toISOString();

    // Clean snippet
    let snippet = "";
    if (contentMatch) {
      snippet = decodeHtml(contentMatch[1])
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;#32;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Detect if known curator is cited
    const detectedCurators = KNOWN_CURATORS.filter(
      (c) => new RegExp(`\\b${c.replace(/[-_]/g, "[-_ ]")}\\b`, "i").test(title) ||
             new RegExp(`\\b${c.replace(/[-_]/g, "[-_ ]")}\\b`, "i").test(snippet)
    );

    entries.push({
      title,
      link,
      author,
      updated,
      snippet: snippet.slice(0, 400),
      curators: detectedCurators,
      isHighPriority: detectedCurators.length > 0
    });
  }

  return entries;
}

function decodeHtml(html) {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#32;/g, " ");
}

/**
 * Fetches RSS feed for a subreddit with retry / backoff.
 */
export async function fetchSubredditRss(subreddit, sort = "hot", retries = 2) {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}/.rss`;
  const userAgents = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  ];

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ua = userAgents[attempt % userAgents.length];
    const response = await fetch(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "application/rss+xml, application/rdf+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });

    if (response.status === 429 && attempt < retries) {
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const waitSeconds = resetHeader ? Math.max(1, Number.parseInt(resetHeader, 10) + 1) : 4;
      await new Promise((r) => setTimeout(r, waitSeconds * 1000));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS for r/${subreddit}: HTTP ${response.status}`);
    }

    const xml = await response.text();
    return parseRedditRss(xml).map((item) => ({ ...item, subreddit }));
  }
}

/**
 * Extracts top comments for a given Reddit post URL using Playwright.
 */
export async function extractPostComments(postUrl, maxComments = 3) {
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 }
    });

    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    const comments = await page.$$eval("shreddit-comment [slot='comment'] p", (elements) =>
      elements
        .map((el) => el.textContent?.trim())
        .filter((text) => {
          if (!text) return false;
          // Filter out standard automod / bot comments
          if (/contact the moderators|subreddit wiki|I am a bot/i.test(text)) return false;
          return text.length > 15;
        })
    );

    return comments.slice(0, maxComments);
  } catch {
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Formats a scouted post and its comments into a candidate video concept card.
 */
export function createCandidateCard(post, topComments = []) {
  return {
    source: "reddit-radar",
    subreddit: post.subreddit,
    title: post.title,
    url: post.link,
    detectedCurators: post.curators,
    breakingFact: post.snippet || post.title,
    communityRoastQuotes: topComments,
    suggestedHook: topComments.length > 0 ? topComments[0] : post.title,
    scoutedAt: new Date().toISOString()
  };
}
