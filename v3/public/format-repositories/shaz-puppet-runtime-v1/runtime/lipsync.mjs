const CHERRY_SYMBOLS = new Set("ABCDEFGHIJKX".split(""));

// The rig contains ten authored mouth drawings, but five cover the useful
// speech silhouettes without importing expression-specific frowns or side mouths.
const SHAZ_FIVE_MOUTH_V1 = Object.freeze({
  A: "1", // closed: M/B/P
  B: "4", // teeth: D/K/T
  C: "5", // small/medium open: EH
  D: "2", // wide open: AH
  E: "3", // rounded: OH
  F: "3", // rounded: W/OO
  G: "4", // teeth: F/V
  H: "5", // open: L
  I: "4", // teeth: EE
  J: "4", // teeth: CH/J/SH
  K: "3", // rounded: R
  X: "1", // rest
});

function parseCherryTsv(text, { fps = 24, totalFrames }) {
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) {
    throw new Error("lipSync fps must be an integer from 1 to 120");
  }
  if (!Number.isInteger(totalFrames) || totalFrames < 1) {
    throw new Error("lipSync totalFrames must be a positive integer");
  }
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Cherry cue file is empty");
  }
  const cues = [];
  for (const [index, sourceLine] of text.split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (!line) continue;
    const match = line.match(/^([0-9]+(?:\.[0-9]+)?)\s+([A-KX])$/);
    if (!match) throw new Error(`invalid Cherry cue at line ${index + 1}`);
    const timeSeconds = Number(match[1]);
    const symbol = match[2];
    if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
      throw new Error(`invalid Cherry timestamp at line ${index + 1}`);
    }
    if (!CHERRY_SYMBOLS.has(symbol)) {
      throw new Error(`unsupported Cherry symbol ${symbol} at line ${index + 1}`);
    }
    if (cues.length > 0 && timeSeconds <= cues.at(-1).timeSeconds) {
      throw new Error(`Cherry timestamps must increase at line ${index + 1}`);
    }
    cues.push({ timeSeconds, symbol, mouthDrawing: SHAZ_FIVE_MOUTH_V1[symbol] });
  }
  if (cues.length === 0 || cues[0].timeSeconds !== 0) {
    throw new Error("Cherry cues must begin at 0.000 seconds");
  }
  const durationSeconds = totalFrames / fps;
  // Cherry may emit a terminal cue exactly on the rounded output boundary.
  // That cue owns no rendered frame, so it is valid; anything later is not.
  if (cues.at(-1).timeSeconds > durationSeconds + 1e-9) {
    throw new Error("Cherry cues extend beyond the output duration");
  }

  // ─── PRO ANIMATION RULES (Cherry Lipsync Studio) ───────────────────────────
  // Rule 0: Anticipation Offset (2 frames early so mouth opens as speech begins)
  const anticipationOffset = 2 / fps;
  const rawSymbols = [];

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const timeSeconds = frame / fps;
    const futureTs = timeSeconds + anticipationOffset;
    let shape = "X";
    for (const cue of cues) {
      if (cue.timeSeconds <= futureTs + 1e-9) {
        shape = cue.symbol;
      } else {
        break;
      }
    }
    rawSymbols.push(shape);
  }

  const processedSymbols = [...rawSymbols];

  // Rule 2: Minimum Hold (Ensure no shape holds for fewer than 2 frames)
  const minHoldFrames = 2;
  let i = 0;
  while (i < totalFrames) {
    const current = processedSymbols[i];
    const start = i;
    while (i < totalFrames && processedSymbols[i] === current) i += 1;
    const length = i - start;
    if (length < minHoldFrames && start > 0 && current !== "X" && current !== "A") {
      const prevShape = processedSymbols[start - 1];
      for (let j = start; j < i; j += 1) {
        processedSymbols[j] = prevShape;
      }
    }
  }

  // Rule 6: Suppress Short Silences (Avoid clamping shut on quick gaps between words)
  const minSilenceFrames = 4;
  i = 0;
  while (i < totalFrames) {
    if (processedSymbols[i] === "X") {
      const startX = i;
      while (i < totalFrames && processedSymbols[i] === "X") i += 1;
      if (i - startX < minSilenceFrames && startX > 0) {
        const prevShape = processedSymbols[startX - 1];
        for (let j = startX; j < i; j += 1) {
          processedSymbols[j] = prevShape;
        }
      }
    } else {
      i += 1;
    }
  }

  // Rule 3: MBP Pop (Ensure bilabials A/M/B/P hold cleanly for 2 frames)
  const mbpPopFrames = 2;
  i = 0;
  while (i < totalFrames) {
    if (processedSymbols[i] === "A") {
      const startA = i;
      while (i < totalFrames && processedSymbols[i] === "A") i += 1;
      if (i - startA < mbpPopFrames) {
        const endA = Math.min(totalFrames, startA + mbpPopFrames);
        for (let j = startA; j < endA; j += 1) {
          processedSymbols[j] = "A";
        }
        i = startA + mbpPopFrames;
      }
    } else {
      i += 1;
    }
  }

  // Rule 1: Tail Hold (Hold mouth open 2 frames into silence before closing)
  const tailHoldFrames = 2;
  i = 0;
  while (i < totalFrames - 1) {
    if (processedSymbols[i] !== "X" && processedSymbols[i] !== "A" && processedSymbols[i + 1] === "X") {
      const prev = processedSymbols[i];
      const maxJ = Math.min(tailHoldFrames + 1, totalFrames - i);
      for (let j = 1; j < maxJ; j += 1) {
        if (processedSymbols[i + j] === "X") {
          processedSymbols[i + j] = prev;
        }
      }
      i += tailHoldFrames;
    } else {
      i += 1;
    }
  }

  const frameSymbols = processedSymbols;
  const frameDrawings = frameSymbols.map((sym) => SHAZ_FIVE_MOUTH_V1[sym] ?? "1");

  // End every reusable block on the canonical resting mouth. This changes only
  // the final video frame and prevents an open-mouth freeze at the cut.
  frameDrawings[totalFrames - 1] = SHAZ_FIVE_MOUTH_V1.X;
  frameSymbols[totalFrames - 1] = "X";

  const histogram = {};
  for (const drawing of frameDrawings) histogram[drawing] = (histogram[drawing] ?? 0) + 1;
  return {
    cues,
    frameDrawings,
    frameSymbols,
    histogram,
    mappingId: "shaz-five-mouth-v1",
    mapping: SHAZ_FIVE_MOUTH_V1,
    forcedFinalRestFrame: true,
  };
}

export { CHERRY_SYMBOLS, SHAZ_FIVE_MOUTH_V1, parseCherryTsv };
