/**
 * Single source of truth for AI tells in Shaz scripts.
 *
 * Two kinds of tells:
 * 1. AI_TELL_WORDS: banned words and stock phrases (regex on the spoken text).
 * 2. AI_TELL_STRUCTURES: banned sentence patterns (forced negation, repetition,
 *    echo fragments, question-then-answer, label openers).
 *
 * The validator enforces both. The studio author prompt prints the same list via
 * describeAiTellsForPrompt(), so the writer and the checker never disagree.
 *
 * Kept narrow on purpose: a rule only belongs here if it almost never fires on
 * normal speech. Real terms ("dynamic pricing", "explore Vice City", "unlock a
 * character", the game "Journey") must stay usable.
 */

export const AI_TELL_WORDS = Object.freeze([
  { pattern: /\bin today's fast[- ]paced world\b/i, name: "in today's fast-paced world" },
  { pattern: /\bit's important to note\b/i, name: "it's important to note" },
  { pattern: /\b(delve|dive) into\b/i, name: "delve/dive into" },
  { pattern: /\b(game[- ]changing|game[- ]changer|revolutionary)\b/i, name: "game-changing/revolutionary" },
  { pattern: /\bat the end of the day\b/i, name: "at the end of the day" },
  { pattern: /\b(in conclusion|to sum up)\b/i, name: "in conclusion/to sum up" },
  { pattern: /\b(let's dive in|here's the thing)\b/i, name: "let's dive in/here's the thing" },
  { pattern: /\bnot only\b.*?\bbut also\b/i, name: "not only... but also" },
  { pattern: /\b(testament to|stands as)\b/i, name: "testament to/stands as" },
  { pattern: /\bparadigm shift\b/i, name: "paradigm shift" },
  { pattern: /\b(tapestry|interplay)\b/i, name: "tapestry/interplay" },
  { pattern: /\b(multifaceted|nuanced)\b/i, name: "multifaceted/nuanced" },
  { pattern: /\b(fosters|empowers)\b/i, name: "fosters/empowers" },
  { pattern: /\b(gaming|tech|media|digital|streaming|console|creator|competitive|modern) landscape\b/i, name: "the ___ landscape" },
  { pattern: /\b(crucial|vital|pivotal)\b/i, name: "crucial/vital/pivotal" },
  { pattern: /\b(seamless|seamlessly|mastery)\b/i, name: "seamless/mastery" },
  { pattern: /\bbeacon of\b/i, name: "beacon of" },
  { pattern: /\b(my|our|your|their|this|the whole) journey\b/i, name: "journey (abstract)" },
  { pattern: /\bunveil(s|ed|ing)?\b/i, name: "unveil" },
  { pattern: /\brich history\b/i, name: "rich history" },
  { pattern: /\bdeep dive\b/i, name: "deep dive" },
  { pattern: /\bkey takeaway\b/i, name: "key takeaway" },
  { pattern: /\b(furthermore|moreover)\b/i, name: "furthermore/moreover" },
  { pattern: /\bin essence\b/i, name: "in essence" },
  { pattern: /\b(plethora|myriad)\b/i, name: "plethora/myriad" },
  // Stock internet phrases
  { pattern: /\b(the )?question (that )?nobody asked\b/i, name: "the question nobody asked" },
  { pattern: /\bdoing (a lot of|all the|some) (heavy lifting|work)\b/i, name: "doing a lot of heavy lifting" },
  { pattern: /\blet that sink in\b/i, name: "let that sink in" },
  { pattern: /\b(i'm )?calling it( now| right now)?[.!]/i, name: "calling it now" },
  { pattern: /\bmake it make sense\b/i, name: "make it make sense" },
  { pattern: /\bsaid no one ever\b/i, name: "said no one ever" },
  { pattern: /\bplot twist\b/i, name: "plot twist" },
  { pattern: /\bbuckle up\b/i, name: "buckle up" },
  { pattern: /\byou can't make this up\b/i, name: "you can't make this up" },
  { pattern: /\bwe need to talk about\b/i, name: "we need to talk about" },
  { pattern: /\bin a world where\b/i, name: "in a world where" },
  { pattern: /\bit's giving\b/i, name: "it's giving" },
  { pattern: /\band that's the (point|kicker|catch)\b/i, name: "and that's the point/kicker" },
  { pattern: /\bhere's the (kicker|catch|twist)\b/i, name: "here's the kicker/catch" },
  { pattern: /\blet's be (real|honest)\b/i, name: "let's be real/honest" },
]);

const SUBJECT = "(?:it|that|this|he|she|they|there)";
const BE = "(?:'s|’s|\\s+is|\\s+was|'re|’re|\\s+are)";

/** Splits spoken text into sentences, keeping the end mark. */
export function splitSentences(text) {
  // Split only where an end mark is followed by whitespace, so "$499.99" and "v2.5" stay intact.
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?]["”’']?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function words(sentence) {
  return sentence.toLowerCase().replace(/[^a-z0-9'’\s-]/g, " ").split(/\s+/).filter(Boolean);
}

function clip(text, max = 90) {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Structural detectors. Each returns an array of offending snippets for one rule.
 */
export const AI_TELL_STRUCTURES = Object.freeze([
  {
    id: "forced-negation",
    name: "forced negation (\"it's not X, it's Y\")",
    promptLine: "Forced negation: \"It's not X, it's Y\", \"That's not X, that's Y\", \"You don't have X. You have Y\", \"It's not about X, it's about Y\". Just say the Y.",
    detect(text) {
      const hits = [];
      const res = [
        new RegExp(`\\b${SUBJECT}${BE}\\s+not\\b[^.?!]{1,60}?[,;:—–-]\\s*${SUBJECT}${BE}\\b`, "gi"),
        new RegExp(`\\b${SUBJECT}${BE}\\s+not\\b[^.?!]{1,60}[.;]\\s+${SUBJECT}${BE}\\b`, "gi"),
        new RegExp(`\\b${SUBJECT}\\s+(?:isn't|isn’t|wasn't|wasn’t|aren't|aren’t)\\b[^.?!]{1,60}[.;,:—–-]\\s+${SUBJECT}${BE}\\b`, "gi"),
        /\b(you|we|they|i)\s+(?:don't|don’t|didn't|didn’t)\s+(have|need|want)\b[^.?!]{1,50}[.;,]\s+\1\s+\2\b/gi,
        /\bnot\s+about\b[^.?!]{1,50}[,;.—–-]\s+(?:it's|it’s|it is)\s+about\b/gi,
        /\bnot\s+(?:just|only|merely)\s+(?:a|an|the)?\s*\w+[^.?!]{0,40}[,;—–-]\s*(?:it's|it’s|it is|that's|that’s|but)\b/gi,
      ];
      for (const re of res) {
        for (const m of text.matchAll(re)) hits.push(clip(m[0]));
      }
      return hits;
    },
  },
  {
    id: "repetition",
    name: "repetition (same opening, \"It's X. It's X. It's X.\")",
    promptLine: "Repetition: never start 3 sentences in a row with the same word, never start 2 sentences in a row with the same two words (\"Raise the price... Raise the price...\"), no mirrored pairs (\"Old games hid... New games hide...\"), and no repeated lead phrase inside a sentence (\"could be X, could be Y, could be Z\").",
    detect(text) {
      const hits = [];
      const sentences = splitSentences(text);
      const firsts = sentences.map((s) => words(s));
      for (let i = 0; i + 2 < firsts.length; i += 1) {
        const a = firsts[i][0];
        if (a && a === firsts[i + 1][0] && a === firsts[i + 2][0]) {
          hits.push(clip(`${sentences[i]} ${sentences[i + 1]} ${sentences[i + 2]}`));
        }
      }
      for (let i = 0; i + 1 < firsts.length; i += 1) {
        const a = firsts[i];
        const b = firsts[i + 1];
        if (a.length >= 2 && b.length >= 2 && a[0] === b[0] && a[1] === b[1]) {
          hits.push(clip(`${sentences[i]} ${sentences[i + 1]}`));
        } else if (
          a.length >= 3 && b.length >= 3 && a.length <= 10 && b.length <= 10 &&
          a[1] === b[1] && a[1].length > 3 && a[0] !== b[0]
        ) {
          hits.push(clip(`${sentences[i]} ${sentences[i + 1]}`));
        }
      }
      for (const s of sentences) {
        const m = s.match(/(\b[\w'’]+\s+[\w'’]+\b)[^.?!]*?,\s*\1\b[^.?!]*?,\s*\1\b/i);
        if (m) hits.push(clip(s));
      }
      return hits;
    },
  },
  {
    id: "echo-fragment",
    name: "echo fragment (\"Small.\", \"Sixty million.\", \"Again.\")",
    promptLine: "Echo fragments: no one- or two-word sentences used for drama (\"Small.\", \"Sixty million.\", \"Again.\", \"Deserved.\"). Fold the point into a real sentence.",
    detect(text) {
      return splitSentences(text)
        .filter((s) => /[.!]["”’']?$/.test(s) && words(s).length <= 2)
        .map((s) => clip(s));
    },
  },
  {
    id: "question-then-answer",
    name: "question-then-answer (\"The reason? ...\", \"And honestly? ...\")",
    promptLine: "Question-then-answer: no short setup question answered right away (\"The reason? An AI shortage.\", \"And honestly? Deserved.\", \"Your wallet?\"). State it directly. A real question to the viewer is fine.",
    detect(text) {
      const sentences = splitSentences(text);
      const hits = [];
      for (let i = 0; i + 1 < sentences.length; i += 1) {
        if (/\?["”’']?$/.test(sentences[i]) && words(sentences[i]).length <= 4) {
          hits.push(clip(`${sentences[i]} ${sentences[i + 1]}`));
        }
      }
      return hits;
    },
  },
  {
    id: "label-opener",
    name: "label opener (\"Respectfully,\", \"Confession:\", \"Hot take:\")",
    promptLine: "Label openers: don't start a sentence with a label like \"Respectfully,\", \"Confession:\", \"Real talk:\", \"Hot take:\", \"Fun fact:\", \"Spoiler:\". Just say it.",
    detect(text) {
      const re = /(?:^|[.!?]\s+)((?:respectfully|confession|real talk|hot take|fun fact|pro tip|spoiler(?: alert)?|unpopular opinion|psa)\s*[,:!])/gi;
      return [...String(text || "").matchAll(re)].map((m) => clip(m[1]));
    },
  },
]);

/**
 * Finds every AI tell in spoken text.
 * @returns {{ id: string, name: string, examples: string[] }[]}
 */
export function findAiTells(text) {
  const found = [];
  for (const item of AI_TELL_WORDS) {
    const m = String(text || "").match(item.pattern);
    if (m) found.push({ id: "word", name: item.name, examples: [clip(m[0])] });
  }
  for (const rule of AI_TELL_STRUCTURES) {
    const examples = rule.detect(String(text || ""));
    if (examples.length > 0) found.push({ id: rule.id, name: rule.name, examples });
  }
  return found;
}

/** Formats findings for an error message the writer agent can act on. */
export function formatAiTellFindings(found) {
  return found
    .map((f) => `${f.name}: ${f.examples.map((e) => `"${e}"`).join(" | ")}`)
    .join("; ");
}

/** Prompt text listing every banned word and pattern, from the same source the validator uses. */
export function describeAiTellsForPrompt() {
  const wordList = AI_TELL_WORDS.map((w) => `"${w.name}"`).join(", ");
  const structureLines = AI_TELL_STRUCTURES.map((r) => `- ${r.promptLine}`).join("\n");
  return (
    `BANNED AI TELLS (the script is automatically rejected if it contains any of these):\n` +
    `${structureLines}\n` +
    `- Banned words and stock phrases: ${wordList}.\n` +
    `Also avoid (not auto-checked): rhetorical lists of three, em dashes, and stacked adverbs like "brutally" or "furiously".`
  );
}
