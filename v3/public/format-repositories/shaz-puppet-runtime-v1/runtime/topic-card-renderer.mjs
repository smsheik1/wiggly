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

export const TOPIC_THEMES = {
  "warm-red": {
    stops: ["#7a0010", "#a51322", "#d90429"],
    accent: "#d90429",
  },
  "cold-blue": {
    stops: ["#03045e", "#0077b6", "#00b4d8"],
    accent: "#0077b6",
  },
  "energy-orange": {
    stops: ["#6a040f", "#9d0208", "#f48c06"],
    accent: "#e85d04",
  },
  "deep-purple": {
    stops: ["#240046", "#5a189a", "#9d4edd"],
    accent: "#7209b7",
  },
  "emerald-green": {
    stops: ["#004b23", "#007200", "#38b000"],
    accent: "#2b9348",
  },
  "sunburst-gold": {
    stops: ["#d62828", "#f77f00", "#fcbf49"],
    accent: "#f77f00",
  },
};

export const TOPIC_ICONS = {
  "burger": `
    <g transform="translate(207, 140)">
      <path d="M 20 80 Q 100 10 180 80 Z" fill="#e09f3e" stroke="#111111" stroke-width="4"/>
      <ellipse cx="70" cy="50" rx="4" ry="2" fill="#fff" transform="rotate(-15 70 50)"/>
      <ellipse cx="100" cy="40" rx="4" ry="2" fill="#fff"/>
      <ellipse cx="130" cy="55" rx="4" ry="2" fill="#fff" transform="rotate(20 130 55)"/>
      <path d="M 15 85 Q 35 95 55 85 Q 75 95 95 85 Q 115 95 135 85 Q 155 95 175 85 Q 185 90 190 85" fill="none" stroke="#38b000" stroke-width="8" stroke-linecap="round"/>
      <polygon points="25,95 180,95 155,115 50,115" fill="#ffb703" stroke="#111111" stroke-width="3"/>
      <rect x="25" y="105" width="155" height="25" rx="10" fill="#582f0e" stroke="#111111" stroke-width="4"/>
      <path d="M 25 135 Q 100 135 175 135 Q 175 155 100 155 Q 25 155 25 135 Z" fill="#e09f3e" stroke="#111111" stroke-width="4"/>
    </g>
  `,
  "puppy": `
    <g transform="translate(207, 130)">
      <ellipse cx="30" cy="80" rx="25" ry="50" fill="#7f4f24" stroke="#111111" stroke-width="4" transform="rotate(-20 30 80)"/>
      <ellipse cx="170" cy="80" rx="25" ry="50" fill="#7f4f24" stroke="#111111" stroke-width="4" transform="rotate(20 170 80)"/>
      <circle cx="100" cy="95" r="65" fill="#c68a4c" stroke="#111111" stroke-width="4"/>
      <ellipse cx="100" cy="115" rx="32" ry="25" fill="#eed7a1" stroke="#111111" stroke-width="3"/>
      <polygon points="90,105 110,105 100,118" fill="#111111"/>
      <path d="M 92 120 Q 100 128 108 120" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round"/>
      <circle cx="75" cy="85" r="8" fill="#111111"/>
      <circle cx="78" cy="82" r="3" fill="#ffffff"/>
      <circle cx="125" cy="85" r="8" fill="#111111"/>
      <circle cx="128" cy="82" r="3" fill="#ffffff"/>
    </g>
  `,
  "clash": `
    <g transform="translate(207, 140)">
      <path d="M 20 70 L 80 70 L 80 50 L 110 85 L 80 120 L 80 100 L 20 100 Z" fill="#ff4d6d" stroke="#111111" stroke-width="4"/>
      <path d="M 180 70 L 120 70 L 120 50 L 90 85 L 120 120 L 120 100 L 180 100 Z" fill="#4361ee" stroke="#111111" stroke-width="4"/>
      <polygon points="100,45 107,65 125,72 107,80 100,100 93,80 75,72 93,65" fill="#ffb703" stroke="#111111" stroke-width="3"/>
    </g>
  `,
  "trophy": `
    <g transform="translate(207, 130)">
      <path d="M 50 40 L 150 40 L 140 110 Q 100 140 60 110 Z" fill="#ffb703" stroke="#111111" stroke-width="4"/>
      <path d="M 50 50 Q 20 75 55 95" fill="none" stroke="#111111" stroke-width="5"/>
      <path d="M 150 50 Q 180 75 145 95" fill="none" stroke="#111111" stroke-width="5"/>
      <rect x="90" y="125" width="20" height="30" fill="#fb8500" stroke="#111111" stroke-width="4"/>
      <rect x="65" y="155" width="70" height="20" rx="4" fill="#333333" stroke="#111111" stroke-width="4"/>
      <polygon points="100,60 104,72 116,72 106,80 110,92 100,84 90,92 94,80 84,72 96,72" fill="#ffffff"/>
    </g>
  `,
  "question": `
    <g transform="translate(207, 130)">
      <circle cx="100" cy="100" r="75" fill="#f3e8ff" stroke="#7209b7" stroke-width="4"/>
      <text x="100" y="130" text-anchor="middle" font-family="Grobold, sans-serif" font-size="95px" fill="#7209b7">?</text>
      <text x="35" y="60" text-anchor="middle" font-family="Grobold, sans-serif" font-size="40px" fill="#f72585">?</text>
      <text x="165" y="65" text-anchor="middle" font-family="Grobold, sans-serif" font-size="45px" fill="#4cc9f0">?</text>
    </g>
  `,
  "heart-paw": `
    <g transform="translate(207, 130)">
      <path d="M 100 170 C 20 110 30 40 100 70 C 170 40 180 110 100 170 Z" fill="#e63946" stroke="#111111" stroke-width="4"/>
      <ellipse cx="100" cy="120" rx="18" ry="14" fill="#ffffff"/>
      <circle cx="82" cy="100" r="6" fill="#ffffff"/>
      <circle cx="94" cy="92" r="6" fill="#ffffff"/>
      <circle cx="106" cy="92" r="6" fill="#ffffff"/>
      <circle cx="118" cy="100" r="6" fill="#ffffff"/>
    </g>
  `,
  "idea": `
    <g transform="translate(207, 130)">
      <circle cx="100" cy="90" r="55" fill="#ffb703" stroke="#111111" stroke-width="4"/>
      <path d="M 80 135 L 120 135 L 115 155 L 85 155 Z" fill="#6c757d" stroke="#111111" stroke-width="3"/>
      <path d="M 90 160 L 110 160" stroke="#111111" stroke-width="4" stroke-linecap="round"/>
      <line x1="100" y1="20" x2="100" y2="5" stroke="#fb8500" stroke-width="6" stroke-linecap="round"/>
      <line x1="45" y1="45" x2="35" y2="35" stroke="#fb8500" stroke-width="6" stroke-linecap="round"/>
      <line x1="155" y1="45" x2="165" y2="35" stroke="#fb8500" stroke-width="6" stroke-linecap="round"/>
    </g>
  `,
  "star": `
    <g transform="translate(207, 130)">
      <polygon points="100,20 124,78 185,82 138,122 153,180 100,148 47,180 62,122 15,82 76,78" fill="#ffd166" stroke="#111111" stroke-width="5"/>
      <circle cx="85" cy="95" r="5" fill="#111111"/>
      <circle cx="115" cy="95" r="5" fill="#111111"/>
      <path d="M 92 110 Q 100 120 108 110" fill="none" stroke="#111111" stroke-width="3" stroke-linecap="round"/>
    </g>
  `,
};

/**
 * Builds the complete topic-card SVG overlay buffer.
 */
export function buildTopicCardSvg({
  badge = "TOPIC",
  headline = "",
  quote = "",
  theme = "warm-red",
  icon = "trophy",
  width = 1280,
  height = 720,
}) {
  const fontBase64 = getGroboldBase64();
  const themeConfig = TOPIC_THEMES[theme] ?? TOPIC_THEMES["warm-red"];
  const iconContent = TOPIC_ICONS[icon] ?? TOPIC_ICONS["trophy"];

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
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${themeConfig.stops[0]}"/>
          <stop offset="45%" stop-color="${themeConfig.stops[1]}"/>
          <stop offset="100%" stop-color="${themeConfig.stops[2]}"/>
        </linearGradient>
        ${fontFaceDef}
      </defs>
      
      <!-- Full background gradient -->
      <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>
      
      <!-- Artist Card Frame (674x675 at x=300, y=20) -->
      <g transform="translate(300, 20)">
        <!-- Outer Card -->
        <rect width="674" height="675" fill="#ffffff" stroke="#111111" stroke-width="6"/>
        
        <!-- Inner Art Box -->
        <rect x="32" y="32" width="610" height="420" fill="#f8f9fa" stroke="#e4e4e7" stroke-width="2"/>
        
        <!-- Top Badge -->
        <rect x="187" y="55" width="300" height="42" rx="21" fill="${themeConfig.accent}"/>
        <text x="337" y="83" text-anchor="middle" font-family="Grobold, sans-serif" font-size="18px" fill="#ffffff" letter-spacing="1px">${escapeXml(badge)}</text>
        
        <!-- Centerpiece Vector Art -->
        ${iconContent}
        
        <!-- Headline -->
        <text x="337" y="515" text-anchor="middle" font-family="Grobold, sans-serif" font-size="36px" fill="${themeConfig.accent}">${escapeXml(headline)}</text>
        
        <!-- Quote / Subtitle -->
        <text x="337" y="575" text-anchor="middle" font-family="Grobold, sans-serif" font-size="22px" fill="#27272a">${escapeXml(quote)}</text>
      </g>
    </svg>
  `;
}

/**
 * Renders a full 1280x720 topic card image buffer.
 * If innerImageBuffer is provided, it replaces the inner vector art box with the image.
 */
export async function renderTopicCard({
  badge = "TOPIC",
  headline = "",
  quote = "",
  theme = "warm-red",
  icon = "trophy",
  innerImageBuffer = null,
  width = 1280,
  height = 720,
}) {
  const svg = buildTopicCardSvg({ badge, headline, quote, theme, icon, width, height });
  const baseCard = sharp(Buffer.from(svg)).png();

  if (innerImageBuffer) {
    // Resize image to fit neatly within the inner box (610x420)
    const mattedImage = await sharp(innerImageBuffer)
      .resize(610, 420, { fit: "cover" })
      .png()
      .toBuffer();

    return baseCard
      .composite([{ input: mattedImage, left: 300 + 32, top: 20 + 32 }])
      .toBuffer();
  }

  return baseCard.toBuffer();
}
