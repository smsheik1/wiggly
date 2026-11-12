/**
 * Monotonic script-to-transcript aligner for Animate Shaz captions and beat timing.
 * Preserves authored script spelling/punctuation while anchoring every spoken word
 * onto local Whisper word timestamps without external LLM/API roundtrips.
 */

const NUMBER_WORDS = new Map([
  ["0", "zero"],
  ["1", "one"],
  ["2", "two"],
  ["3", "three"],
  ["4", "four"],
  ["5", "five"],
  ["6", "six"],
  ["7", "seven"],
  ["8", "eight"],
  ["9", "nine"],
  ["10", "ten"],
  ["11", "eleven"],
  ["12", "twelve"],
  ["13", "thirteen"],
  ["14", "fourteen"],
  ["15", "fifteen"],
  ["16", "sixteen"],
  ["17", "seventeen"],
  ["18", "eighteen"],
  ["19", "nineteen"],
  ["20", "twenty"],
  ["30", "thirty"],
  ["40", "forty"],
  ["50", "fifty"],
  ["60", "sixty"],
  ["70", "seventy"],
  ["80", "eighty"],
  ["90", "ninety"],
]);

const WORD_TO_NUM = new Map(Array.from(NUMBER_WORDS.entries(), ([d, w]) => [w, d]));

const ORDINAL_TO_DIGIT = new Map([
  ["first", "1st"],
  ["second", "2nd"],
  ["third", "3rd"],
  ["fourth", "4th"],
  ["fifth", "5th"],
  ["sixth", "6th"],
  ["seventh", "7th"],
  ["eighth", "8th"],
  ["ninth", "9th"],
  ["tenth", "10th"],
]);

export class ScriptAlignmentError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ScriptAlignmentError";
    this.code = "SCRIPT_ALIGNMENT_LOW";
    this.coverage = details.coverage ?? 0;
    this.minCoverage = details.minCoverage ?? 0.9;
    this.matchedCount = details.matchedCount ?? 0;
    this.totalCount = details.totalCount ?? 0;
    this.unmatchedWords = details.unmatchedWords ?? [];
  }
}

export function normalizeToken(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9$%]+|[^a-z0-9$%]+$/gi, "");
  return s.replace(/['’]/g, "");
}

function expandTokenToParts(raw) {
  const trimmed = String(raw || "").trim();
  const lower = trimmed.toLowerCase().replace(/^["'“(]+|["'”),.!?:;]+$/g, "");
  if (!lower) return [];

  if (lower.startsWith("$")) {
    const num = lower.slice(1).replace(/,/g, "");
    if (/^\d+(\.\d+)?$/.test(num)) {
      const parts = [num, "dollars"];
      return parts;
    }
  }
  if (lower.endsWith("%")) {
    const num = lower.slice(0, -1).replace(/,/g, "");
    if (/^\d+(\.\d+)?$/.test(num)) {
      return [num, "percent"];
    }
  }
  if (lower.includes("-") || lower.includes("/")) {
    const pieces = lower.split(/[-/]+/).map(normalizeToken).filter(Boolean);
    if (pieces.length >= 2) return pieces;
  }
  // Split letter-digit or digit-letter compounds (e.g. "ps5s" -> ["ps", "5s"], "4k" -> ["4", "k"])
  const mixed = lower.match(/^([a-z]+)(\d+[a-z]*)$|^(\d+)([a-z]+)$/);
  if (mixed) {
    if (mixed[1] && mixed[2]) return [normalizeToken(mixed[1]), normalizeToken(mixed[2])];
    if (mixed[3] && mixed[4]) return [normalizeToken(mixed[3]), normalizeToken(mixed[4])];
  }
  const single = normalizeToken(lower);
  if (WORD_TO_NUM.has(single)) return [WORD_TO_NUM.get(single)];
  if (ORDINAL_TO_DIGIT.has(single)) return [ORDINAL_TO_DIGIT.get(single)];
  if (/^\d+$/.test(single) && single.length === 3 && single.endsWith("00")) {
    return [single[0], "hundred"];
  }
  return single ? [single] : [];
}

function canonicalUnit(part) {
  if (!part) return "";
  if (part === "bucks" || part === "dollar") return "dollars";
  if (WORD_TO_NUM.has(part)) return WORD_TO_NUM.get(part);
  if (ORDINAL_TO_DIGIT.has(part)) return ORDINAL_TO_DIGIT.get(part);
  return part;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const prev = new Array(m + 1);
  const curr = new Array(m + 1);
  for (let j = 0; j <= m; j += 1) prev[j] = j;
  for (let i = 1; i <= n; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= m; j += 1) prev[j] = curr[j];
  }
  return prev[m];
}

function scoreSinglePair(sTok, wTok) {
  const sn = canonicalUnit(normalizeToken(sTok.raw));
  const wn = canonicalUnit(normalizeToken(wTok.raw));
  if (!sn || !wn) return null;
  if (sn === wn) return 4.0;

  const sp = expandTokenToParts(sTok.raw).map(canonicalUnit);
  const wp = expandTokenToParts(wTok.raw).map(canonicalUnit);
  if (sp.length === 1 && wp.length === 1 && sp[0] === wp[0]) return 3.6;

  // Strip currency $ for bare numeric comparison ($500 vs 500)
  const snNum = sn.replace(/^\$/, "");
  const wnNum = wn.replace(/^\$/, "");
  if (snNum === wnNum) return 3.5;

  // Common plural/tense inflections or 1-char typo for length >= 4
  const dist = levenshtein(sn, wn);
  if (Math.max(sn.length, wn.length) >= 4 && dist === 1) return 2.2;
  if (Math.min(sn.length, wn.length) >= 4 && dist <= 2 && sn.slice(0, 3) === wn.slice(0, 3)) {
    return 1.6;
  }
  // Phonetic consonant-skeleton tolerance for Whisper proper-noun homophones (e.g. "Ternus" <-> "Turners")
  if (sn.length >= 4 && wn.length >= 4 && sn[0] === wn[0] && Math.abs(sn.length - wn.length) <= 2) {
    const skel = (s) => s[0] + s.slice(1).replace(/[aeiouy]/g, "");
    const sd = levenshtein(skel(sn), skel(wn));
    if (sd <= 1) return 1.4;
  }
  // Phonetic/Whisper prefix similarity (e.g. "save" <-> "say" inside aligned context)
  if (sn.length >= 3 && wn.length >= 3 && sn.slice(0, 2) === wn.slice(0, 2) && Math.abs(sn.length - wn.length) <= 2) {
    return 1.0;
  }
  return null;
}

function scoreOneToTwo(singleRaw, firstRaw, secondRaw) {
  const sp = expandTokenToParts(singleRaw).map(canonicalUnit);
  const w1 = canonicalUnit(normalizeToken(firstRaw));
  const w2 = canonicalUnit(normalizeToken(secondRaw));
  if (!w1 || !w2) return null;

  if (sp.length === 2 && sp[0] === w1 && sp[1] === w2) return 5.2;

  const sNorm = canonicalUnit(normalizeToken(singleRaw));
  if (sNorm && sNorm === `${w1}${w2}`) return 5.0;

  // e.g. "500" <-> "five" "hundred"
  const sNum = sNorm.replace(/^\$/, "");
  if (/^\d00$/.test(sNum) && canonicalUnit(sNum[0]) === w1 && w2 === "hundred") return 5.0;
  // e.g. "$69.99" <-> "69" "99"
  const dec = sNum.match(/^(\d+)\.(\d+)$/);
  if (dec && dec[1] === w1 && dec[2] === w2) return 5.0;

  // Soft 1<->2 fallback when concatenated pieces are within distance 1 for length >= 5
  const merged = `${w1}${w2}`;
  if (sNorm.length >= 5 && merged.length >= 5 && levenshtein(sNorm, merged) <= 1) return 2.8;
  return null;
}

/**
 * Extracts ordered authored script segments (`hook`, `beats[]`, `landing`).
 */
export function extractScriptSegments(script) {
  if (!script) return [];
  if (typeof script === "string") {
    return [{ segmentId: "script-0", kind: "beat", index: 0, text: script, cardHeadline: null, cardBadge: null }];
  }
  if (Array.isArray(script.lines)) {
    return script.lines
      .filter((line) => typeof line === "string" ? line.trim() : line?.text?.trim())
      .map((line, idx) => ({
        segmentId: `line-${idx}`,
        kind: "beat",
        index: idx,
        text: typeof line === "string" ? line : line.text,
        cardHeadline: typeof line === "object" ? (line.cardHeadline ?? null) : null,
        cardBadge: typeof line === "object" ? (line.cardBadge ?? null) : null,
      }));
  }

  const out = [];
  if (script.hook?.text) {
    out.push({
      segmentId: "hook",
      kind: "hook",
      index: 0,
      text: script.hook.text,
      cardHeadline: script.hook.cardHeadline ?? null,
      cardBadge: script.hook.cardBadge ?? null,
    });
  }
  if (Array.isArray(script.beats)) {
    script.beats.forEach((beat, idx) => {
      if (beat?.text) {
        out.push({
          segmentId: `beat-${idx}`,
          kind: "beat",
          index: idx,
          text: beat.text,
          cardHeadline: beat.cardHeadline ?? null,
          cardBadge: beat.cardBadge ?? null,
        });
      }
    });
  }
  if (script.landing?.text) {
    out.push({
      segmentId: "landing",
      kind: "landing",
      index: out.length,
      text: script.landing.text,
      cardHeadline: script.landing.cardHeadline ?? null,
      cardBadge: script.landing.cardBadge ?? null,
    });
  }
  return out;
}

function normalizeTranscriptWords(transcript) {
  const rawWords = Array.isArray(transcript?.words) ? transcript.words : [];
  return rawWords
    .map((w) => {
      const text = String(w?.text ?? w?.word ?? "").trim();
      const startMs = Number.isFinite(w?.startMs)
        ? Number(w.startMs)
        : Number.isFinite(w?.start)
          ? Math.round(Number(w.start) * 1000)
          : 0;
      const endMs = Number.isFinite(w?.endMs)
        ? Number(w.endMs)
        : Number.isFinite(w?.end)
          ? Math.round(Number(w.end) * 1000)
          : startMs + 200;
      return {
        raw: text,
        startMs: Math.max(0, startMs),
        endMs: Math.max(Math.max(0, startMs) + 40, endMs),
      };
    })
    .filter((w) => w.raw.length > 0);
}

/**
 * Aligns authored script words onto Whisper word timestamps via Needleman-Wunsch DP
 * supporting 1<->1, 1<->2 compound splits, and 2<->1 merges.
 */
export function alignScriptToTranscript({ script, transcript, minCoverage = 0.9 } = {}) {
  const segments = extractScriptSegments(script);
  const scriptTokens = [];
  segments.forEach((seg, segOrder) => {
    const rawParts = String(seg.text || "").trim().split(/\s+/).filter(Boolean);
    for (const raw of rawParts) {
      scriptTokens.push({
        raw,
        segmentId: seg.segmentId,
        segmentOrder: segOrder,
      });
    }
  });

  const whisperTokens = normalizeTranscriptWords(transcript);
  const n = scriptTokens.length;
  const m = whisperTokens.length;

  if (n === 0 || m === 0) {
    return {
      ok: false,
      coverage: 0,
      minCoverage,
      matchedCount: 0,
      totalCount: n,
      unmatchedWords: scriptTokens.map((t) => t.raw),
      words: [],
      segments: [],
    };
  }

  const W = m + 1;
  const dp = new Float64Array((n + 1) * W);
  const op = new Uint8Array((n + 1) * W);
  // op codes: 1 = 1<->1 match, 2 = 1<->2 (1 script, 2 whisper), 3 = 2<->1, 4 = skip script, 5 = skip whisper
  const SKIP_SCRIPT = -0.65;
  const SKIP_WHISPER = -0.2;

  for (let i = 1; i <= n; i += 1) {
    dp[i * W] = dp[(i - 1) * W] + SKIP_SCRIPT;
    op[i * W] = 4;
  }
  for (let j = 1; j <= m; j += 1) {
    dp[j] = dp[j - 1] + SKIP_WHISPER;
    op[j] = 5;
  }

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const idx = i * W + j;
      let bestScore = dp[(i - 1) * W + j] + SKIP_SCRIPT;
      let bestOp = 4;

      const wSkip = dp[i * W + (j - 1)] + SKIP_WHISPER;
      if (wSkip > bestScore) {
        bestScore = wSkip;
        bestOp = 5;
      }

      const s11 = scoreSinglePair(scriptTokens[i - 1], whisperTokens[j - 1]);
      if (s11 !== null) {
        const cand = dp[(i - 1) * W + (j - 1)] + s11;
        if (cand > bestScore) {
          bestScore = cand;
          bestOp = 1;
        }
      }

      if (j >= 2) {
        const s12 = scoreOneToTwo(
          scriptTokens[i - 1].raw,
          whisperTokens[j - 2].raw,
          whisperTokens[j - 1].raw,
        );
        if (s12 !== null) {
          const cand = dp[(i - 1) * W + (j - 2)] + s12;
          if (cand > bestScore) {
            bestScore = cand;
            bestOp = 2;
          }
        }
      }

      if (i >= 2) {
        const s21 = scoreOneToTwo(
          whisperTokens[j - 1].raw,
          scriptTokens[i - 2].raw,
          scriptTokens[i - 1].raw,
        );
        if (s21 !== null) {
          const cand = dp[(i - 2) * W + (j - 1)] + s21;
          if (cand > bestScore) {
            bestScore = cand;
            bestOp = 3;
          }
        }
      }

      dp[idx] = bestScore;
      op[idx] = bestOp;
    }
  }

  // Backtrack
  const matchedRanges = new Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const code = op[i * W + j];
    if (code === 1) {
      matchedRanges[i - 1] = {
        startMs: whisperTokens[j - 1].startMs,
        endMs: whisperTokens[j - 1].endMs,
        matched: true,
      };
      i -= 1;
      j -= 1;
    } else if (code === 2) {
      matchedRanges[i - 1] = {
        startMs: whisperTokens[j - 2].startMs,
        endMs: whisperTokens[j - 1].endMs,
        matched: true,
      };
      i -= 1;
      j -= 2;
    } else if (code === 3) {
      const wt = whisperTokens[j - 1];
      const mid = Math.round((wt.startMs + wt.endMs) / 2);
      matchedRanges[i - 2] = { startMs: wt.startMs, endMs: Math.max(wt.startMs + 40, mid), matched: true };
      matchedRanges[i - 1] = { startMs: Math.min(wt.endMs - 40, mid), endMs: wt.endMs, matched: true };
      i -= 2;
      j -= 1;
    } else if (code === 5) {
      j -= 1;
    } else {
      i -= 1;
    }
  }

  let matchedCount = 0;
  const unmatchedWords = [];
  for (let k = 0; k < n; k += 1) {
    if (matchedRanges[k]) matchedCount += 1;
    else unmatchedWords.push(scriptTokens[k].raw);
  }

  // Interpolate timestamps cleanly for any unmatched script words between anchors
  const lastAudioMs = whisperTokens[m - 1].endMs;
  let k = 0;
  while (k < n) {
    if (matchedRanges[k]) {
      k += 1;
      continue;
    }
    const gapStart = k;
    while (k < n && !matchedRanges[k]) k += 1;
    const gapEnd = k; // exclusive
    const count = gapEnd - gapStart;
    const prevEnd = gapStart > 0 ? matchedRanges[gapStart - 1].endMs : 0;
    const nextStart = gapEnd < n ? matchedRanges[gapEnd].startMs : Math.max(prevEnd + count * 180, lastAudioMs);
    const span = Math.max(count * 80, nextStart - prevEnd);
    const step = span / count;
    for (let offset = 0; offset < count; offset += 1) {
      const startMs = Math.round(prevEnd + offset * step);
      const endMs = Math.max(startMs + 60, Math.round(prevEnd + (offset + 1) * step));
      matchedRanges[gapStart + offset] = { startMs, endMs, matched: false };
    }
  }

  const alignedWords = scriptTokens.map((tok, idx) => ({
    text: tok.raw,
    startMs: matchedRanges[idx].startMs,
    endMs: matchedRanges[idx].endMs,
    segmentId: tok.segmentId,
    segmentOrder: tok.segmentOrder,
    matched: matchedRanges[idx].matched,
  }));

  const alignedSegments = segments.map((seg, segOrder) => {
    const segWords = alignedWords.filter((w) => w.segmentOrder === segOrder);
    return {
      segmentId: seg.segmentId,
      kind: seg.kind,
      index: seg.index,
      text: seg.text,
      cardHeadline: seg.cardHeadline,
      cardBadge: seg.cardBadge,
      startMs: segWords.length > 0 ? segWords[0].startMs : 0,
      endMs: segWords.length > 0 ? segWords[segWords.length - 1].endMs : 0,
      wordCount: segWords.length,
      matchedCount: segWords.filter((w) => w.matched).length,
    };
  });

  const coverage = matchedCount / n;
  return {
    ok: coverage >= minCoverage,
    coverage: Number(coverage.toFixed(4)),
    minCoverage,
    matchedCount,
    totalCount: n,
    unmatchedWords,
    words: alignedWords,
    segments: alignedSegments,
  };
}

/**
 * Throws `ScriptAlignmentError` when script-to-transcript coverage falls below `minCoverage` (default 90%).
 */
export function assertScriptAligned({ script, transcript, minCoverage = 0.9 } = {}) {
  const alignment = alignScriptToTranscript({ script, transcript, minCoverage });
  if (!alignment.ok) {
    const pct = (alignment.coverage * 100).toFixed(1);
    const req = (alignment.minCoverage * 100).toFixed(0);
    throw new ScriptAlignmentError(
      `Script alignment too low (${pct}% matched < ${req}% required; unmatched=${alignment.unmatchedWords.slice(0, 8).join(", ")}).`,
      alignment,
    );
  }
  return alignment;
}
