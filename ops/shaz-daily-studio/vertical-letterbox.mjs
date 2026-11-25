import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/sharp.mjs";
import { assertScriptAligned } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/script-alignment.mjs";
import { OTS_GRAPHIC_ZONE } from "../../v3/public/format-repositories/shaz-puppet-runtime-v1/runtime/ots-card-renderer.mjs";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const groboldFontPath = path.resolve(__dirname, "../../v3/public/format-repositories/shaz-puppet-runtime-v1/assets/fonts/GROBOLD.ttf");

let cachedFontBase64 = null;
function getGroboldBase64() {
  if (!cachedFontBase64 && fsSync.existsSync(groboldFontPath)) {
    cachedFontBase64 = fsSync.readFileSync(groboldFontPath).toString("base64");
  }
  return cachedFontBase64 || "";
}

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case "\"": return "&quot;";
    }
  });
}

function wrapText(text, maxChars = 22) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + " " + w).length <= maxChars) {
      current += " " + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

/**
 * Truncates text at whole-word boundaries so words are NEVER sliced mid-syllable (e.g. "PLAYST").
 */
export function formatSafeHeadline(text, maxChars = 36) {
  if (!text || typeof text !== "string") return "BREAKING NEWS";
  const clean = text.replace(/[^\w\s€$£-]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;

  const words = clean.split(" ");
  let result = "";
  for (const word of words) {
    if ((result ? `${result} ${word}` : word).length > maxChars) break;
    result = result ? `${result} ${word}` : word;
  }
  return result || words[0].slice(0, maxChars);
}

/**
 * Renders the top header card (1080 x 280 SVG overlay) with bold hook headline for Layout B.
 */
export async function renderHeaderCard({
  badge = null,
  headline,
  width = 1080,
  height = 280,
}) {
  const fontBase64 = getGroboldBase64();
  const fontFaceStyle = fontBase64
    ? `@font-face { font-family: 'Grobold'; src: url(data:font/truetype;charset=utf-8;base64,${fontBase64}) format('truetype'); font-weight: normal; font-style: normal; }`
    : "";
  const fontFamily = fontBase64 ? "'Grobold', Impact, 'Arial Black', sans-serif" : "Impact, 'Arial Black', sans-serif";

  const safeHeadline = formatSafeHeadline(headline || "BREAKING NEWS", 38);
  const lines = wrapText(safeHeadline.toUpperCase(), 20).slice(0, 3);
  const hasBadge = Boolean(badge && String(badge).trim().length > 0);
  const startY = lines.length === 1
    ? (hasBadge ? 190 : 150)
    : (lines.length === 2 ? (hasBadge ? 165 : 125) : (hasBadge ? 140 : 100));
  const lineHeight = 64;

  const textTspans = lines
    .map((line, i) => `<tspan x="540" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("\n");

  const badgeXml = hasBadge
    ? `<!-- Category Pill -->
    <g transform="translate(540, 70)">
      <rect x="-140" y="-22" width="280" height="44" rx="22" fill="#FFD60A" stroke="#000000" stroke-width="4" />
      <text x="0" y="8" class="badge-text" text-anchor="middle">${escapeXml(String(badge).trim().toUpperCase())}</text>
    </g>`
    : "";

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      ${fontFaceStyle}
      .badge-text { font-family: ${fontFamily}; font-size: 24px; font-weight: 900; fill: #000000; letter-spacing: 2px; }
      .headline { font-family: ${fontFamily}; font-size: 56px; font-weight: 900; fill: #FFFFFF; text-anchor: middle; }
    </style>
    <rect width="100%" height="100%" fill="transparent" />
    ${badgeXml}
    <!-- Headline with strong drop shadow / stroke -->
    <g>
      <text class="headline" stroke="#000000" stroke-width="12" stroke-linejoin="round">${textTspans}</text>
      <text class="headline">${textTspans}</text>
    </g>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Dynamically groups transcript words into high-energy subtitle cues (1 to 3 words each).
 * Respects sentence punctuation, natural pauses (>250ms), and punchline cadence.
 */
export function groupWordsIntoCues(words) {
  if (!Array.isArray(words) || words.length === 0) return [];
  const cues = [];
  let currentChunk = [];

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    currentChunk.push(word);

    const text = (word.text || word.word || "").trim();
    const hasPunctuation = /[.,!?;:]$/.test(text);
    const nextWord = words[i + 1];
    const hasPause = nextWord ? nextWord.startMs - word.endMs > 250 : true;

    if (currentChunk.length >= 3 || hasPunctuation || hasPause || !nextWord) {
      const startMs = currentChunk[0].startMs;
      const endMs = currentChunk[currentChunk.length - 1].endMs;
      cues.push({
        startMs,
        endMs: Math.max(endMs, startMs + 400),
        words: currentChunk,
      });
      currentChunk = [];
    }
  }
  return cues;
}

const SUBTITLE_MAX_FONT = 54;
// Grobold caps run ~0.72em wide on average; stroke and word gaps added on top.
const SUBTITLE_CHAR_EM = 0.72;

/** Estimated pixel width of a caption phrase at a font size. */
export function estimateSubtitleWidth(phraseWords, fontSize = SUBTITLE_MAX_FONT) {
  const texts = (phraseWords || []).map((w) => String(w?.text || w?.word || "").trim().toUpperCase());
  const chars = texts.reduce((n, t) => n + t.length, 0);
  const gaps = Math.max(0, texts.length - 1) * (26 + fontSize * 0.3);
  return chars * fontSize * SUBTITLE_CHAR_EM + gaps + 14;
}

/** Biggest font (max 54px) that keeps the phrase inside the safe width. */
export function subtitleFontSize(phraseWords, maxWidth = VERTICAL_SAFE_AREA.right - VERTICAL_SAFE_AREA.left) {
  const width = estimateSubtitleWidth(phraseWords, SUBTITLE_MAX_FONT);
  if (width <= maxWidth) return SUBTITLE_MAX_FONT;
  return Math.max(28, Math.floor(SUBTITLE_MAX_FONT * (maxWidth / width)));
}

/**
 * Renders a dynamic subtitle overlay frame for a given phrase with active word pop.
 */
export async function renderSubtitlePhrase({
  phraseWords,
  activeWordIndex = -1,
  activeColor = "#FFE600",
  width = 1080,
  height = 200,
}) {
  const fontBase64 = getGroboldBase64();
  const fontFaceStyle = fontBase64
    ? `@font-face { font-family: 'Grobold'; src: url(data:font/truetype;charset=utf-8;base64,${fontBase64}) format('truetype'); font-weight: normal; font-style: normal; }`
    : "";
  const fontFamily = fontBase64 ? "'Grobold', Impact, 'Arial Black', sans-serif" : "Impact, 'Arial Black', sans-serif";

  // Render words in a line with active word highlighted and bold stroke pop
  const tspans = phraseWords.map((item, idx) => {
    const wordStr = (item.text || item.word || "").trim();
    const isActive = idx === activeWordIndex;
    const color = isActive ? activeColor : "#FFFFFF";
    const strokeWidth = isActive ? "14" : "10";
    const dx = idx > 0 ? 'dx="26"' : "";
    const spacer = idx < phraseWords.length - 1 ? "&#160;" : "";
    return `<tspan fill="${color}" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" ${dx}>${escapeXml(wordStr.toUpperCase())}${spacer}</tspan>`;
  }).join("");

  const tspansFill = phraseWords.map((item, idx) => {
    const wordStr = (item.text || item.word || "").trim();
    const isActive = idx === activeWordIndex;
    const color = isActive ? activeColor : "#FFFFFF";
    const dx = idx > 0 ? 'dx="26"' : "";
    const spacer = idx < phraseWords.length - 1 ? "&#160;" : "";
    return `<tspan fill="${color}" ${dx}>${escapeXml(wordStr.toUpperCase())}${spacer}</tspan>`;
  }).join("");

  // Long phrases shrink so the caption never runs into the apps' side crop.
  const fontSize = subtitleFontSize(phraseWords);

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      ${fontFaceStyle}
      .sub-text { font-family: ${fontFamily}; font-size: ${fontSize}px; font-weight: 900; text-anchor: middle; }
    </style>
    <rect width="100%" height="100%" fill="transparent" />
    <g transform="translate(${Math.round(width / 2)}, 100)">
      <text class="sub-text" xml:space="preserve">${tspans}</text>
      <text class="sub-text" xml:space="preserve">${tspansFill}</text>
    </g>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const VERTICAL_ENCODE_ARGS = [
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-crf", "23",
  "-maxrate", "3M",
  "-bufsize", "6M",
  "-movflags", "+faststart",
];

/**
 * The part of the 1080x1920 frame every app leaves alone.
 * YouTube Shorts, TikTok and Reels zoom the video to fill tall phones (up to ~10% cut off
 * each side on 19.5:9 screens) and draw their own buttons, top bar, channel name and title
 * over the top ~15% and bottom ~30%. Anything that must be seen (picture cards, Shaz,
 * headline, captions) stays inside this box.
 * Before 2026-11-25 the card sat 16px from the edge and YouTube cut it off; the headline sat
 * under YouTube's top bar and captions under the channel name.
 */
export const VERTICAL_SAFE_AREA = Object.freeze({ left: 100, right: 980, top: 300, bottom: 1340 });

/**
 * Which part of the 1280x720 stage the vertical video keeps (stage x 48 -> 1128: the whole
 * picture card at x 64 -> 420 and Shaz, including lean poses past x 1100), and where it goes:
 * shrunk to the safe width and centered.
 */
export const STAGE_SIZE = Object.freeze({ width: 1280, height: 720 });
export const VERTICAL_STAGE_WINDOW = Object.freeze({ left: 48, width: 1080 });
export const VERTICAL_STAGE_OUTPUT = Object.freeze({
  x: VERTICAL_SAFE_AREA.left,
  width: VERTICAL_SAFE_AREA.right - VERTICAL_SAFE_AREA.left,
});
export const VERTICAL_HEADER_Y = 256;
export const VERTICAL_VIDEO_TOP = 560;
// The caption overlay is 200px tall with its baseline at +100 (renderSubtitlePhrase).
export const VERTICAL_SUBTITLE_Y = 1150;

export function verticalStageGeometry(windowBox = VERTICAL_STAGE_WINDOW, output = VERTICAL_STAGE_OUTPUT) {
  const scale = output.width / windowBox.width;
  const even = (n) => 2 * Math.round(n / 2);
  const scaledWidth = even(STAGE_SIZE.width * scale);
  const scaledHeight = even(STAGE_SIZE.height * scale);
  const cropX = Math.round(windowBox.left * scale);
  return {
    scale,
    scaledWidth,
    scaledHeight,
    cropX,
    outputWidth: output.width,
    overlayX: output.x,
    overlayY: VERTICAL_VIDEO_TOP,
  };
}

/** Stage x range that survives the vertical crop. */
export function visibleStageRange(geometry = verticalStageGeometry()) {
  const left = geometry.cropX / geometry.scale;
  return { left, right: left + geometry.outputWidth / geometry.scale };
}

/** Where a stage x coordinate lands in the 1080-wide vertical frame. */
export function stageXToVerticalX(stageX, geometry = verticalStageGeometry()) {
  return geometry.overlayX + stageX * geometry.scale - geometry.cropX;
}

export { OTS_GRAPHIC_ZONE };

/**
 * Composes a 1280x720 video into a 1080x1920 vertical video with header and kinetic subtitles.
 *
 * @param {Object} options
 * @param {string} options.sourceVideoPath - 16:9 source video
 * @param {string} [options.transcriptPath] - Whisper transcript JSON path
 * @param {Object} [options.transcript] - Timed transcript object
 * @param {string} options.headline - Top hook headline
 * @param {string} [options.badge=null] - Top tag badge (omitted if null/empty)
 * @param {string} options.outputPath - Destination 1080x1920 MP4
 * @param {Function} [options.execFileFn] - Optional ffmpeg runner injection for unit tests
 */
export async function composeVerticalVideo({
  sourceVideoPath,
  transcriptPath,
  transcript,
  script = null,
  scriptPath = null,
  minAlignmentCoverage = 0.9,
  headline,
  badge = null,
  outputPath,
  execFileFn = execFileAsync,
}) {
  if (!fsSync.existsSync(sourceVideoPath)) {
    throw new Error(`sourceVideoPath not found: ${sourceVideoPath}`);
  }

  let timedTranscript = transcript;
  if (!timedTranscript && transcriptPath && fsSync.existsSync(transcriptPath)) {
    try {
      timedTranscript = JSON.parse(await fs.readFile(transcriptPath, "utf8"));
    } catch {}
  }

  let authoredScript = script;
  if (!authoredScript && scriptPath) {
    authoredScript = JSON.parse(await fs.readFile(scriptPath, "utf8"));
  }

  // Align authored script words onto Whisper word timestamps so captions display exact script spelling.
  let alignedWords = null;
  if (authoredScript) {
    const alignment = assertScriptAligned({
      script: authoredScript,
      transcript: timedTranscript,
      minCoverage: minAlignmentCoverage,
    });
    alignedWords = alignment.words;
  }

  const scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), "shaz-vertical-"));
  const headerPath = path.join(scratchDir, "header.png");

  try {
    // 1. Render Top Header Card (at VERTICAL_HEADER_Y)
    const headerBuffer = await renderHeaderCard({ badge, headline });
    await fs.writeFile(headerPath, headerBuffer);

    // 2. Prepare Subtitle cues (prefer script words aligned onto transcript timestamps)
    const words = alignedWords || timedTranscript?.words || [];
    const cues = groupWordsIntoCues(words);

    const inputArgs = [
      "-y",
      "-i", sourceVideoPath,
      "-i", headerPath,
    ];

    let filterComplex = "";
    // Step A: blurred backdrop + the stage window (VERTICAL_STAGE_WINDOW), shrunk into the safe area
    const geo = verticalStageGeometry();
    filterComplex += `[0:v]split=2[fg][bg];`;
    filterComplex += `[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=35:5,eq=brightness=-0.16:contrast=0.9[blurred_bg];`;
    filterComplex += `[fg]scale=${geo.scaledWidth}:${geo.scaledHeight},crop=${geo.outputWidth}:${geo.scaledHeight}:${geo.cropX}:0[main];`;
    filterComplex += `[blurred_bg][main]overlay=${geo.overlayX}:${geo.overlayY}[with_video];`;
    // Step B: Overlay header card below the apps' top bars
    filterComplex += `[with_video][1:v]overlay=0:${VERTICAL_HEADER_Y}[with_header]`;

    let lastLabel = "[with_header]";

    // Step C: Render and composite kinetic subtitle phrase overlays if words exist
    if (cues.length > 0) {
      let overlayIndex = 2;
      for (let c = 0; c < cues.length; c += 1) {
        const cue = cues[c];

        for (let wIdx = 0; wIdx < cue.words.length; wIdx += 1) {
          const currentWord = cue.words[wIdx];
          const nextWord = cue.words[wIdx + 1];

          const wStartMs = Math.max(cue.startMs, currentWord.startMs);
          const wEndMs = nextWord
            ? Math.max(wStartMs + 80, nextWord.startMs)
            : cue.endMs;

          if (wEndMs <= wStartMs) continue;

          const cueFile = path.join(scratchDir, `sub-${c}-${wIdx}.png`);
          const subBuffer = await renderSubtitlePhrase({
            phraseWords: cue.words,
            activeWordIndex: wIdx,
            activeColor: "#FFE600",
          });
          await fs.writeFile(cueFile, subBuffer);

          inputArgs.push("-i", cueFile);

          const startSec = (wStartMs / 1000).toFixed(2);
          const endSec = (wEndMs / 1000).toFixed(2);
          const nextLabel = `[sub_v${overlayIndex - 2}]`;

          filterComplex += `;${lastLabel}[${overlayIndex}:v]overlay=0:${VERTICAL_SUBTITLE_Y}:enable='between(t,${startSec},${endSec})'${nextLabel}`;
          lastLabel = nextLabel;
          overlayIndex += 1;
        }
      }
    }

    // Step D: Clean vocal-only audio (broadcast standard 48kHz Stereo AAC, NO background music)
    const audioMap = ["-map", "0:a", "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000"];

    // Step E: Enforce exact 1:1 pixel aspect ratio and standard yuv420p color format
    filterComplex += `;${lastLabel}format=yuv420p,setsar=1[vfinal]`;

    const ffmpegArgs = [
      ...inputArgs,
      "-filter_complex", filterComplex,
      "-map", "[vfinal]",
      ...audioMap,
      ...VERTICAL_ENCODE_ARGS,
      outputPath,
    ];

    await execFileFn("ffmpeg", ffmpegArgs);

    return {
      outputPath,
      width: 1080,
      height: 1920,
      cuesCount: cues.length,
    };
  } finally {
    await fs.rm(scratchDir, { recursive: true, force: true }).catch(() => {});
  }
}
