import assert from "node:assert/strict";
import test from "node:test";

import {
  ScriptAlignmentError,
  alignScriptToTranscript,
  assertScriptAligned,
  extractScriptSegments,
} from "../runtime/script-alignment.mjs";

test("alignScriptToTranscript maps punctuation, numbers, $500, and split compounds onto script spelling", () => {
  const script = {
    hook: {
      text: "John Ternus just announced PS5s cost $500 to save buyers 30%!",
      cardHeadline: "PS5 PRO PRICE",
      cardBadge: "BREAKING",
    },
    beats: [
      {
        text: "That brings the total to five hundred bucks today.",
        cardHeadline: "FIVE HUNDRED BUCKS",
      },
    ],
    landing: {
      text: "Would you buy it now?",
    },
  };

  const transcript = {
    words: [
      { text: "John", startMs: 0, endMs: 250 },
      { text: "Turners", startMs: 260, endMs: 600 },
      { text: "just", startMs: 610, endMs: 820 },
      { text: "announced", startMs: 830, endMs: 1200 },
      { text: "PS", startMs: 1210, endMs: 1400 },
      { text: "5s", startMs: 1410, endMs: 1680 },
      { text: "cost", startMs: 1690, endMs: 1950 },
      { text: "500", startMs: 1960, endMs: 2250 },
      { text: "dollars", startMs: 2260, endMs: 2550 },
      { text: "to", startMs: 2560, endMs: 2700 },
      { text: "say", startMs: 2710, endMs: 2950 },
      { text: "buyers", startMs: 2960, endMs: 3250 },
      { text: "30", startMs: 3260, endMs: 3500 },
      { text: "percent", startMs: 3510, endMs: 3850 },
      { text: "That", startMs: 4100, endMs: 4300 },
      { text: "brings", startMs: 4310, endMs: 4550 },
      { text: "the", startMs: 4560, endMs: 4700 },
      { text: "total", startMs: 4710, endMs: 4950 },
      { text: "to", startMs: 4960, endMs: 5100 },
      { text: "500", startMs: 5110, endMs: 5450 },
      { text: "bucks", startMs: 5460, endMs: 5750 },
      { text: "today", startMs: 5760, endMs: 6100 },
      { text: "Would", startMs: 6400, endMs: 6600 },
      { text: "you", startMs: 6610, endMs: 6800 },
      { text: "buy", startMs: 6810, endMs: 7000 },
      { text: "it", startMs: 7010, endMs: 7150 },
      { text: "now", startMs: 7160, endMs: 7450 },
    ],
  };

  const res = assertScriptAligned({ script, transcript, minCoverage: 0.9 });
  assert.equal(res.ok, true);
  assert.equal(res.words[1].text, "Ternus");
  assert.equal(res.words[1].startMs, 260);
  assert.equal(res.words[1].endMs, 600);

  const ps5s = res.words.find((w) => w.text === "PS5s");
  assert.equal(ps5s.startMs, 1210);
  assert.equal(ps5s.endMs, 1680);

  const price = res.words.find((w) => w.text === "$500");
  assert.equal(price.startMs, 1960);
  assert.equal(price.endMs, 2550);

  const save = res.words.find((w) => w.text === "save");
  assert.equal(save.startMs, 2710);

  const pct = res.words.find((w) => w.text === "30%!");
  assert.equal(pct.startMs, 3260);
  assert.equal(pct.endMs, 3850);

  assert.equal(res.segments.length, 3);
  assert.deepEqual(res.segments.map((s) => s.segmentId), ["hook", "beat-0", "landing"]);
  assert.equal(res.segments[0].startMs, 0);
  assert.equal(res.segments[0].endMs, 3850);
  assert.equal(res.segments[1].startMs, 4100);
  assert.equal(res.segments[1].endMs, 6100);
  assert.equal(res.segments[2].startMs, 6400);
  assert.equal(res.segments[2].endMs, 7450);
});

test("assertScriptAligned rejects low-coverage script mismatches with ScriptAlignmentError", () => {
  const script = {
    hook: { text: "Nintendo releases massive hardware revision with magnetic Joy-Cons today." },
    landing: { text: "Will you upgrade right away?" },
  };
  const transcript = {
    words: [
      { text: "completely", startMs: 0, endMs: 300 },
      { text: "unrelated", startMs: 310, endMs: 700 },
      { text: "audio", startMs: 710, endMs: 1100 },
      { text: "words", startMs: 1110, endMs: 1450 },
    ],
  };

  assert.throws(
    () => assertScriptAligned({ script, transcript, minCoverage: 0.9 }),
    (err) => err instanceof ScriptAlignmentError && err.code === "SCRIPT_ALIGNMENT_LOW" && err.coverage < 0.9,
  );
  assert.equal(extractScriptSegments(script).length, 2);
});
