import fs from "node:fs/promises";
import path from "node:path";

export const BANNED_AI_PATTERNS = [
  { pattern: /\bin today's fast[- ]paced world\b/i, name: "in today's fast-paced world" },
  { pattern: /\bit's important to note\b/i, name: "it's important to note" },
  { pattern: /\b(delve|dive) into\b/i, name: "delve/dive into" },
  { pattern: /\b(game[- ]changing|revolutionary)\b/i, name: "game-changing/revolutionary" },
  { pattern: /\bat the end of the day\b/i, name: "at the end of the day" },
  { pattern: /\b(in conclusion|to sum up)\b/i, name: "in conclusion/to sum up" },
  { pattern: /\b(let's dive in|here's the thing)\b/i, name: "let's dive in/here's the thing" },
  { pattern: /\bnot only\b.*?\bbut also\b/i, name: "not only... but also" },
  { pattern: /\b(testament to|stands as)\b/i, name: "testament to/stands as" },
  { pattern: /\bparadigm shift\b/i, name: "paradigm shift" },
  { pattern: /\b(tapestry|interplay)\b/i, name: "tapestry/interplay" },
  { pattern: /\b(multifaceted|nuanced)\b/i, name: "multifaceted/nuanced" },
  { pattern: /\b(fosters|empowers)\b/i, name: "fosters/empowers" },
  { pattern: /\b(landscape|realm)\b/i, name: "landscape/realm" },
  { pattern: /\b(crucial|vital|pivotal)\b/i, name: "crucial/vital/pivotal" },
  { pattern: /\b(seamless|mastery)\b/i, name: "seamless/mastery" },
  { pattern: /\bbeacon of\b/i, name: "beacon of" },
  { pattern: /\bjourney\b/i, name: "journey (abstract buzzword)" },
  { pattern: /\bdynamic\b/i, name: "dynamic (buzzword)" },
  { pattern: /\b(unveil|unlock)\b/i, name: "unveil/unlock" },
  { pattern: /\brich history\b/i, name: "rich history" },
  { pattern: /\b(explore|deep dive)\b/i, name: "explore/deep dive" },
  { pattern: /\bkey takeaway\b/i, name: "key takeaway" },
  { pattern: /\b(furthermore|moreover)\b/i, name: "furthermore/moreover" },
  { pattern: /\bin essence\b/i, name: "in essence" },
  { pattern: /\b(plethora|myriad)\b/i, name: "plethora/myriad" },
];

/**
 * Counts total words in a string.
 */
export function countWords(text) {
  if (!text || typeof text !== "string") return 0;
  return (text.trim().match(/\S+/g) || []).length;
}

function normalizeGroundingText(value) {
  return String(value ?? "")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, "\"")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function collectAllowedCountdownNumbers(sourceText, now) {
  const days = new Set();
  const weeks = new Set();
  const dateRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(202\d))?\b/gi;
  const currentYear = now.getFullYear();
  let match;
  while ((match = dateRegex.exec(sourceText)) !== null) {
    const year = match[3] ? parseInt(match[3], 10) : currentYear;
    const parsed = new Date(`${match[1]} ${match[2]}, ${year}`);
    if (!Number.isNaN(parsed.getTime())) {
      const diffDays = Math.round((parsed.getTime() - now.getTime()) / 86_400_000);
      if (diffDays >= 0 && diffDays <= 365) {
        days.add(diffDays - 1);
        days.add(diffDays);
        days.add(diffDays + 1);
        weeks.add(Math.floor(diffDays / 7));
        weeks.add(Math.round(diffDays / 7));
        weeks.add(Math.ceil(diffDays / 7));
      }
    }
  }
  return { days, weeks };
}

function hasNumericToken(articleDigitsText, rawNum) {
  const normalizedNum = rawNum.replace(/,/g, "");
  const escaped = normalizedNum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\d.])${escaped}(?:$|[^\\d.])`).test(articleDigitsText);
}

/**
 * Validates that grounded scripts cite a sourceUrl, anchor claims with verbatim article quotes
 * (4–30 words each, including >=1 covering the hook), and do not invent spoken prices/years/specs.
 */
export function validateGroundedClaims(script, fullText, { topic = null, now = new Date(), articleText = null } = {}) {
  if (typeof articleText !== "string" || articleText.trim().length === 0) {
    throw new Error("Grounded script validation requires non-empty articleText.");
  }

  let validSourceUrl = false;
  if (typeof script.sourceUrl === "string" && script.sourceUrl.trim()) {
    try {
      const parsed = new URL(script.sourceUrl.trim());
      validSourceUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {}
  }
  if (!validSourceUrl) {
    throw new Error("script.sourceUrl must be a valid http:// or https:// URL pointing to the fetched source article.");
  }

  if (!Array.isArray(script.claims) || script.claims.length < 2 || script.claims.length > 5) {
    throw new Error(
      `script.claims must contain between 2 and 5 grounded claim objects (found ${Array.isArray(script.claims) ? script.claims.length : 0}).`,
    );
  }

  const validTargets = new Set(["hook", ...script.beats.map((b) => b.id), "landing"]);
  const normalizedArticle = normalizeGroundingText(articleText);
  let hasHookClaim = false;

  for (let i = 0; i < script.claims.length; i += 1) {
    const claim = script.claims[i];
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
      throw new Error(`script.claims[${i}] must be an object with { target, says, quote }.`);
    }
    if (!validTargets.has(claim.target)) {
      throw new Error(`script.claims[${i}].target '${claim.target}' must be one of: ${Array.from(validTargets).join(", ")}.`);
    }
    if (claim.target === "hook") hasHookClaim = true;
    if (typeof claim.says !== "string" || claim.says.trim().length < 5) {
      throw new Error(`script.claims[${i}].says must summarize what the script claims.`);
    }
    if (typeof claim.quote !== "string" || !claim.quote.trim()) {
      throw new Error(`script.claims[${i}].quote must contain a verbatim quote from the article.`);
    }
    const quoteWords = countWords(claim.quote);
    if (quoteWords < 4 || quoteWords > 30) {
      throw new Error(
        `script.claims[${i}].quote has ${quoteWords} words; verbatim article quotes must be strictly 4 to 30 words.`,
      );
    }
    const normalizedQuote = normalizeGroundingText(claim.quote);
    if (!normalizedArticle.includes(normalizedQuote)) {
      throw new Error(
        `script.claims[${i}].quote ("${claim.quote.trim()}") did not appear verbatim in the fetched article text.`,
      );
    }
  }

  if (!hasHookClaim) {
    throw new Error("script.claims must include at least one claim targeting 'hook'.");
  }

  // Cross-check spoken prices, years, and concrete spec/count figures against the article (allowing derived relative date math)
  const spokenNormalized = normalizeGroundingText(fullText);
  const articleDigitsText = normalizedArticle.replace(/(\d),(\d)/g, "$1$2");
  const { days: allowedDays, weeks: allowedWeeks } = collectAllowedCountdownNumbers(
    `${topic?.title || ""} ${articleText}`,
    now,
  );
  const currentYearStr = String(now.getFullYear());

  const priceRegex = /(?:[$€£¥]\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:dollars?|bucks|euros?|pounds?))/gi;
  let priceMatch;
  while ((priceMatch = priceRegex.exec(spokenNormalized)) !== null) {
    const num = priceMatch[1] || priceMatch[2];
    if (num && !hasNumericToken(articleDigitsText, num)) {
      throw new Error(
        `Unfounded numeric claim in speech: "${priceMatch[0]}" does not appear in the fetched article.`,
      );
    }
  }

  const yearRegex = /\b(19\d\d|20[0-3]\d)\b/g;
  let yearMatch;
  while ((yearMatch = yearRegex.exec(spokenNormalized)) !== null) {
    const yr = yearMatch[1];
    if (yr !== currentYearStr && !hasNumericToken(articleDigitsText, yr)) {
      throw new Error(
        `Unfounded year in speech: "${yr}" does not appear in the fetched article.`,
      );
    }
  }

  const specRegex = /\b(\d+(?:,\d+)*(?:\.\d+)?)\s?(gb|tb|mb|fps|hz|mph|million|billion|thousand|copies|players|percent|%|days?|weeks?|months?|years?)\b/gi;
  let specMatch;
  while ((specMatch = specRegex.exec(spokenNormalized)) !== null) {
    const rawNum = specMatch[1];
    const unit = specMatch[2].toLowerCase();
    const numericVal = Number(rawNum.replace(/,/g, ""));
    if (/^days?$/.test(unit) && allowedDays.has(numericVal)) continue;
    if (/^weeks?$/.test(unit) && allowedWeeks.has(numericVal)) continue;
    if (!hasNumericToken(articleDigitsText, rawNum)) {
      throw new Error(
        `Unfounded numeric spec/count in speech: "${specMatch[0]}" does not appear in the fetched article.`,
      );
    }
  }
}

/**
 * Validates a Shaz script against the contract, pacing bounds, causality, AI buzzword linter,
 * temporal grounding, and (optionally) article grounding claims.
 */
export function validateScript(
  script,
  {
    topic = null,
    now = new Date(),
    minWords: customMinWords,
    maxWords: customMaxWords,
    articleText = null,
    requireGroundedClaims = false,
  } = {},
) {
  if (!script || typeof script !== "object") {
    throw new Error("Script must be a JSON object");
  }

  if (script.schemaVersion !== "shaz-script-v1") {
    throw new Error(`Invalid schemaVersion '${script.schemaVersion}'; expected 'shaz-script-v1'`);
  }

  if (typeof script.title !== "string" || script.title.trim().length === 0) {
    throw new Error("Script requires a non-empty title string");
  }

  if (script.headline !== undefined) {
    if (typeof script.headline !== "string" || !script.headline.trim()) {
      throw new Error("script.headline must be a non-empty string");
    }
  }

  const targetDuration = script.targetDurationSeconds;
  if (!Number.isInteger(targetDuration) || targetDuration < 10 || targetDuration > 300) {
    throw new Error("Script targetDurationSeconds must be an integer between 10 and 300");
  }

  if (!script.research || typeof script.research !== "object") {
    throw new Error("Script requires a research object with primaryInsight, counterintuitiveAngle, and concreteFactOrStory");
  }

  for (const field of ["primaryInsight", "counterintuitiveAngle", "concreteFactOrStory"]) {
    if (typeof script.research[field] !== "string" || script.research[field].trim().length < 10) {
      throw new Error(`script.research.${field} must be a descriptive string (at least 10 characters)`);
    }
  }

  if (!script.hook || typeof script.hook !== "object") {
    throw new Error("Script requires a hook object");
  }

  if (script.visualQueries !== undefined) {
    if (!Array.isArray(script.visualQueries) || script.visualQueries.length === 0) {
      throw new Error("script.visualQueries must be an array of at least 1 visual search query string");
    }
    for (let q = 0; q < script.visualQueries.length; q += 1) {
      if (typeof script.visualQueries[q] !== "string" || script.visualQueries[q].trim().length < 3) {
        throw new Error(`script.visualQueries[${q}] must be a non-empty search query string`);
      }
    }
  }

  if (script.backgroundId !== undefined) {
    const allowedBackgrounds = ["sisters-room", "living-room", "map-photo-zone", "pure-white"];
    if (typeof script.backgroundId !== "string" || !allowedBackgrounds.includes(script.backgroundId)) {
      throw new Error(
        `script.backgroundId '${script.backgroundId}' is invalid; must be one of: ${allowedBackgrounds.join(", ")}`
      );
    }
  }

  if (script.hashtags !== undefined) {
    if (!Array.isArray(script.hashtags) || script.hashtags.some((t) => typeof t !== "string" || !t.trim())) {
      throw new Error("script.hashtags must be an array of non-empty hashtag strings");
    }
  }

  const allowedHookFormulas = [
    "uncomfortable-truth",
    "surprising-stat",
    "personal-confession",
    "setup-payoff-tease",
  ];
  if (!allowedHookFormulas.includes(script.hook.formula)) {
    throw new Error(`script.hook.formula must be one of: ${allowedHookFormulas.join(", ")}`);
  }

  if (typeof script.hook.text !== "string" || script.hook.text.trim().length < 15) {
    throw new Error("script.hook.text must be a string with at least 15 characters");
  }

  if (script.hook.cardHeadline !== undefined && typeof script.hook.cardHeadline !== "string") {
    throw new Error("script.hook.cardHeadline must be a string");
  }

  if (script.hook.cardBadge !== undefined && typeof script.hook.cardBadge !== "string") {
    throw new Error("script.hook.cardBadge must be a string");
  }

  if (!Array.isArray(script.beats) || script.beats.length === 0) {
    throw new Error("script.beats must be an array with at least 1 beat");
  }

  for (let i = 0; i < script.beats.length; i += 1) {
    const beat = script.beats[i];
    if (typeof beat.id !== "string" || !/^beat-[0-9]{2}$/.test(beat.id)) {
      throw new Error(`script.beats[${i}].id must match format 'beat-01', 'beat-02', etc.`);
    }

    if (!["THEREFORE", "BUT", "NONE"].includes(beat.connector)) {
      throw new Error(`script.beats[${i}].connector must be 'THEREFORE', 'BUT', or 'NONE'`);
    }

    // Every beat after the first must have causality
    if (i > 0 && beat.connector === "NONE") {
      throw new Error(
        `script.beats[${i}] connector is 'NONE'. All beats after the first must connect with 'THEREFORE' or 'BUT' to preserve causality.`,
      );
    }

    if (typeof beat.text !== "string" || beat.text.trim().length < 5) {
      throw new Error(`script.beats[${i}].text must be a string with at least 5 characters`);
    }

    if (typeof beat.impliedQuestion !== "string" || beat.impliedQuestion.trim().length < 5) {
      throw new Error(`script.beats[${i}].impliedQuestion must be a string with at least 5 characters`);
    }
  }

  if (!script.landing || typeof script.landing !== "object") {
    throw new Error("Script requires a landing object");
  }

  const allowedLandingTypes = ["reframe", "challenge", "twist", "question"];
  if (!allowedLandingTypes.includes(script.landing.type)) {
    throw new Error(`script.landing.type must be one of: ${allowedLandingTypes.join(", ")}`);
  }

  if (typeof script.landing.text !== "string" || script.landing.text.trim().length < 10) {
    throw new Error("script.landing.text must be a string with at least 10 characters");
  }

  // 1. Gather all spoken text (hook + beats + landing)
  const fullText = [
    script.hook.text,
    ...script.beats.map((b) => b.text),
    script.landing.text,
  ].join(" ");

  const totalWords = countWords(fullText);

  // 2. AI Buzzword Linter (run before word count so quality issues surface first)
  const foundAITells = [];
  for (const item of BANNED_AI_PATTERNS) {
    if (item.pattern.test(fullText)) {
      foundAITells.push(item.name);
    }
  }

  if (foundAITells.length > 0) {
    throw new Error(
      `Script contains banned AI buzzwords/tells: [${foundAITells.join(", ")}]. Rewrite using direct, conversational language per writer-playbook.md.`,
    );
  }

  // 3. Pacing check: default 110 to 175 WPM (55–88 words at 30s); studio can pass tighter bounds (70–88)
  const minWords = Number.isFinite(customMinWords)
    ? customMinWords
    : Math.floor((targetDuration / 60) * 110);
  const maxWords = Number.isFinite(customMaxWords)
    ? customMaxWords
    : Math.ceil((targetDuration / 60) * 175);

  if (totalWords < minWords || totalWords > maxWords) {
    throw new Error(
      `Total script word count (${totalWords} words) is outside acceptable bounds for a ${targetDuration}s video (${minWords}–${maxWords} words). Adjust script length to fit spoken pacing.`,
    );
  }

  // 4. Temporal consistency & AI Slop Gate
  validateTemporalGrounding(fullText, { topic, now });

  // 5. Article grounding gate (opt-in for Phase 2 daily studio; keeps legacy kit fixtures unaffected)
  if (requireGroundedClaims || articleText != null) {
    validateGroundedClaims(script, fullText, { topic, now, articleText });
  }

  return {
    valid: true,
    totalWords,
    targetDurationSeconds: targetDuration,
    wordsPerMinute: Math.round((totalWords / targetDuration) * 60),
    beatCount: script.beats.length,
  };
}

/**
 * Validates that spoken script text has accurate temporal anchoring relative to the current calendar date.
 * Rejects hallucinated multi-year waiting claims ("years away", "two years in advance", "a year early")
 * when events occur in the present year or within weeks/months, preventing outdated AI slop.
 */
export function validateTemporalGrounding(text, { topic = null, now = new Date() } = {}) {
  if (!text || typeof text !== "string") return;

  const currentYear = now.getFullYear();
  const contextStr = ((topic?.title || "") + " " + (topic?.snippet || "")).toLowerCase();

  // 1. Check for references to past years treated as future/current targets
  const pastYearMatch = text.match(/\b(?:scheduled for|launching in|releasing in|waiting for|until|slated for)\s+(?:Fall|Spring|Summer|Winter)?\s*(202[0-5])\b/i);
  if (pastYearMatch && currentYear >= 2026) {
    throw new Error(
      `Script rejected by Temporal Linter: references ${pastYearMatch[1]} as an upcoming or target date, but the current year is ${currentYear}. Update script to reflect present timeline.`
    );
  }

  // 2. Check if topic or context mentions the current year or an upcoming near-term date
  const topicMentionsCurrentYear = contextStr.includes(String(currentYear));

  let isUpcomingNearTerm = false;
  let targetDateString = "";
  const dateMatch = contextStr.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(202\d)?/i);
  if (dateMatch) {
    const yearVal = dateMatch[3] ? parseInt(dateMatch[3], 10) : currentYear;
    try {
      const parsedTarget = new Date(`${dateMatch[1]} ${dateMatch[2]}, ${yearVal}`);
      if (!isNaN(parsedTarget.getTime())) {
        const diffDays = Math.round((parsedTarget.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= -1 && diffDays <= 60) {
          isUpcomingNearTerm = true;
          targetDateString = `${dateMatch[0]} (${diffDays} days away)`;
        }
      }
    } catch {}
  }

  if (topicMentionsCurrentYear || isUpcomingNearTerm) {
    const hallucinationPatterns = [
      { pattern: /\b(?:two|three|four|\d+)\s+years?\s+(?:away|in advance|from now|of waiting)\b/i, name: "multi-year waiting claim" },
      { pattern: /\b(?:two|three|four|\d+)\s+full\s+years\b/i, name: "multi-year duration claim" },
      { pattern: /\ba year (?:early|in advance|away)\b/i, name: "year-early claim" },
      { pattern: /\bbooking PTO\s+(?:two|three|\d+)\s+years?\b/i, name: "years-in-advance booking claim" },
      { pattern: /\b(?:still have|got)\s+(?:two|three|\d+)\s+years?\b/i, name: "years remaining claim" },
    ];

    for (const hp of hallucinationPatterns) {
      const m = text.match(hp.pattern);
      if (m) {
        const detail = targetDateString ? ` The topic specifies ${targetDateString}.` : ` The event is in the current year (${currentYear}).`;
        throw new Error(
          `Script rejected by Temporal Linter: detected hallucinated timeframe "${m[0]}".${detail} Scripts must be accurately grounded in the current date to prevent AI slop.`
        );
      }
    }
  }
}

import { lintScriptWithJev } from "./director-jev.mjs";

/**
 * CLI Runner helper with optional TypeSafe AI Jev voice linter check.
 */
export async function runScriptLinter(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const script = JSON.parse(raw);
  const result = validateScript(script);

  const fullText = [
    script.hook.text,
    ...script.beats.map((b) => b.text),
    script.landing.text,
  ].join(" ");
  const jevReport = await lintScriptWithJev(fullText);
  if (jevReport) {
    result.jev = jevReport;
    if (jevReport.grade === "reject-corporate" || (jevReport.isCorporate && jevReport.corporateProbability >= 0.75)) {
      throw new Error(
        `Script rejected by Jev Voice Linter: detected corporate/PR speak (${Math.round(jevReport.corporateProbability * 100)}% probability). Make tone more direct and human.`,
      );
    }
  }

  return result;
}
