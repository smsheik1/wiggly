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

/**
 * Validates a Shaz script against the contract, pacing bounds, causality, and AI buzzword linter.
 */
export function validateScript(script) {
  if (!script || typeof script !== "object") {
    throw new Error("Script must be a JSON object");
  }

  if (script.schemaVersion !== "shaz-script-v1") {
    throw new Error(`Invalid schemaVersion '${script.schemaVersion}'; expected 'shaz-script-v1'`);
  }

  if (typeof script.title !== "string" || script.title.trim().length === 0) {
    throw new Error("Script requires a non-empty title string");
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

  // 3. Pacing check: 110 to 175 words per minute
  const minWords = Math.floor((targetDuration / 60) * 110);
  const maxWords = Math.ceil((targetDuration / 60) * 175);

  if (totalWords < minWords || totalWords > maxWords) {
    throw new Error(
      `Total script word count (${totalWords} words) is outside acceptable bounds for a ${targetDuration}s video (${minWords}–${maxWords} words). Adjust script length to fit spoken pacing.`,
    );
  }

  return {
    valid: true,
    totalWords,
    targetDurationSeconds: targetDuration,
    wordsPerMinute: Math.round((totalWords / targetDuration) * 60),
    beatCount: script.beats.length,
  };
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

  try {
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
  } catch (err) {
    if (err.message.startsWith("Script rejected by Jev")) {
      throw err;
    }
    // If Jev network or auth issue, ignore and continue with valid deterministic check
  }

  return result;
}
