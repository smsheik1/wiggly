import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const groboldFontPath = path.resolve(__dirname, "../assets/fonts/GROBOLD.ttf");
let cachedFontBase64 = null;

function getGroboldBase64() {
  if (!cachedFontBase64) {
    if (fs.existsSync(groboldFontPath)) {
      cachedFontBase64 = fs.readFileSync(groboldFontPath).toString("base64");
    }
  }
  return cachedFontBase64;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case "\"": return "&quot;";
    }
  });
}

function wrapTextIntoLines(text, maxChars = 22) {
  const paragraphs = text.split("\n");
  const wrapped = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let currentLine = "";
    for (const w of words) {
      if (!currentLine) {
        currentLine = w;
      } else if ((currentLine + " " + w).length <= maxChars) {
        currentLine += " " + w;
      } else {
        wrapped.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) {
      wrapped.push(currentLine);
    }
  }
  return wrapped.length > 0 ? wrapped : [text];
}

/**
 * Splits text into lines and tokens with proper word-wrapping and adaptive font sizing.
 * If wordLimit is provided, only the first `wordLimit` words are made visible.
 */
function buildSvgContent({ text, highlights = [], wordLimit = null, width = 1280, height = 720 }) {
  const lines = wrapTextIntoLines(text, 22);
  const maxLen = Math.max(...lines.map((l) => l.length));
  
  const fontBase64 = getGroboldBase64();
  const fontFamily = fontBase64 ? "Grobold, sans-serif" : "sans-serif";
  let fontSize = 62;
  if (maxLen > 20) {
    fontSize = Math.max(38, Math.floor(62 * (20 / maxLen)));
  }
  if (lines.length > 3) {
    fontSize = Math.min(fontSize, 44);
  }
  const lineHeight = Math.round(fontSize * 1.35);
  const defaultFill = "#111111";

  const totalTextHeight = lines.length * lineHeight;
  // Center vertically on the wall area above the floor (floor starts around y=550)
  const wallCenterY = 320;
  const startY = wallCenterY - (totalTextHeight / 2) + (fontSize * 0.85);

  // Pre-calculate exact word indices for highlight phrases to prevent false substring matches
  const allWords = text.trim().split(/\s+/).filter(Boolean);
  const cleanAll = allWords.map((w) => w.toLowerCase().replace(/[^\w]/g, ""));
  const wordColorMap = new Map();

  for (const hl of highlights) {
    if (!hl.phrase || !hl.color) continue;
    const hlWords = hl.phrase.trim().split(/\s+/).filter(Boolean);
    const cleanHl = hlWords.map((w) => w.toLowerCase().replace(/[^\w]/g, ""));
    if (cleanHl.length === 0) continue;

    for (let i = 0; i <= cleanAll.length - cleanHl.length; i += 1) {
      let match = true;
      for (let j = 0; j < cleanHl.length; j += 1) {
        if (cleanAll[i + j] !== cleanHl[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let j = 0; j < cleanHl.length; j += 1) {
          wordColorMap.set(i + j, hl.color);
        }
      }
    }
  }

  let wordCountSeen = 0;

  const tspanLines = lines.map((line, lineIndex) => {
    // Break line into tokens (words and spaces)
    const tokens = line.match(/\S+|\s+/g) || [];
    const segments = [];

    for (const token of tokens) {
      const isWord = /\S/.test(token);
      let isVisible = true;
      let tokenColor = defaultFill;

      if (isWord) {
        const currentWordIndex = wordCountSeen;
        wordCountSeen += 1;
        if (wordLimit !== null && wordCountSeen > wordLimit) {
          isVisible = false;
        }
        if (wordColorMap.has(currentWordIndex)) {
          tokenColor = wordColorMap.get(currentWordIndex);
        }
      } else if (wordLimit !== null && wordCountSeen >= wordLimit) {
        isVisible = false;
      }

      if (!isVisible) continue;

      segments.push({ text: token, color: tokenColor });
    }

    if (segments.length === 0) {
      return "";
    }

    const renderedSpans = segments
      .map((seg) => `<tspan fill="${seg.color}">${escapeXml(seg.text)}</tspan>`)
      .join("");

    return `<text x="${width / 2}" y="${startY + lineIndex * lineHeight}" text-anchor="middle" font-family="${fontFamily}" font-size="${fontSize}px" letter-spacing="0.5px" word-spacing="6px" xml:space="preserve">${renderedSpans}</text>`;
  }).filter(Boolean);

  const fontFaceDef = fontBase64 ? `
    <style>
      @font-face {
        font-family: "Grobold";
        src: url("data:font/ttf;base64,${fontBase64}");
      }
    </style>
  ` : "";

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${fontFaceDef}
      </defs>
      <g>
        ${tspanLines.join("\n")}
      </g>
    </svg>
  `;
}

/**
 * Computes how many words should be visible at a given frame relative to shot start.
 * If wordTimings array of startFrames is provided, matches against current frame.
 * Otherwise, evenly spaces them across entry frames.
 */
export function wordsVisibleAtFrame({ totalWords, localFrame, durationFrames, wordFrames = null }) {
  if (wordFrames && Array.isArray(wordFrames) && wordFrames.length > 0) {
    let visible = 0;
    for (let i = 0; i < wordFrames.length; i += 1) {
      if (localFrame >= wordFrames[i]) {
        visible = i + 1;
      }
    }
    // Prevent single short words from floating alone in space; reveal at least 2 words
    if (visible === 1 && totalWords > 1) {
      visible = 2;
    }
    return Math.min(visible, totalWords);
  }

  // Natural progressive cadence: pop in all words across the first 65% of the shot,
  // leaving the remaining 35% of the shot holding the complete sentence before cutting.
  const popDuration = Math.max(1, Math.floor(durationFrames * 0.65));
  const framesPerWord = Math.max(2, Math.floor(popDuration / totalWords));
  let visible = Math.min(totalWords, Math.floor(localFrame / framesPerWord) + 1);
  if (visible === 1 && totalWords > 1) {
    visible = 2;
  }
  return visible;
}

/**
 * Renders a single text-card frame over the background image buffer.
 */
export async function renderTextCardFrame({
  backgroundBuffer,
  text,
  highlights = [],
  wordLimit = null,
  width = 1280,
  height = 720,
}) {
  const svg = buildSvgContent({ text, highlights, wordLimit, width, height });
  const overlayBuffer = Buffer.from(svg, "utf-8");

  return sharp(backgroundBuffer)
    .resize(width, height, { fit: "fill" })
    .composite([{ input: overlayBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
