import sharp from "sharp";

/**
 * Generates an SVG string for the Streamer Studio foreground overlay:
 * sleek creator desk surface across the bottom and a broadcast microphone on a boom arm.
 */
export function generateStreamerStudioForegroundSvg({ width = 1280, height = 720 } = {}) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="deskGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#222226" />
        <stop offset="30%" stop-color="#18181b" />
        <stop offset="100%" stop-color="#0e0e11" />
      </linearGradient>
      <linearGradient id="micGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3f3f46" />
        <stop offset="50%" stop-color="#27272a" />
        <stop offset="100%" stop-color="#18181b" />
      </linearGradient>
      <linearGradient id="foamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1f1f23" />
        <stop offset="40%" stop-color="#2d2d34" />
        <stop offset="100%" stop-color="#18181b" />
      </linearGradient>
      <filter id="micShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="-4" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.65" />
      </filter>
    </defs>

    <!-- Studio Desk Surface -->
    <g id="desk-layer">
      <!-- Ambient underglow LED line -->
      <line x1="0" y1="662" x2="${width}" y2="662" stroke="#00F0FF" stroke-width="3" stroke-opacity="0.30" />
      <!-- Desk body -->
      <polygon points="0,664 ${width},664 ${width},${height} 0,${height}" fill="url(#deskGrad)" />
      <!-- Desk top bevel highlight -->
      <line x1="0" y1="664" x2="${width}" y2="664" stroke="#52525b" stroke-width="1.5" />
      <!-- Subtly textured studio desk pad / mat centered -->
      <rect x="360" y="668" width="560" height="52" rx="6" fill="#111113" stroke="#27272a" stroke-width="1.5" />
    </g>

    <!-- Broadcast Microphone on Boom Arm (Bottom Right) -->
    <g id="streamer-mic" filter="url(#micShadow)" transform="translate(940, 480)">
      <!-- Boom Arm Shaft from offscreen -->
      <line x1="220" y1="240" x2="70" y2="100" stroke="#18181b" stroke-width="18" stroke-linecap="round" />
      <line x1="220" y1="240" x2="70" y2="100" stroke="#3f3f46" stroke-width="4" stroke-linecap="round" />
      <!-- Cable wrapped around boom arm -->
      <path d="M 190,210 Q 140,165 110,135" fill="none" stroke="#09090b" stroke-width="6" />

      <!-- Boom Arm Elbow / Swivel Mount -->
      <circle cx="70" cy="100" r="16" fill="#27272a" stroke="#52525b" stroke-width="2" />
      <circle cx="70" cy="100" r="6" fill="#71717a" />
      <!-- Tension Knob -->
      <rect x="58" y="76" width="24" height="8" rx="3" fill="#3f3f46" stroke="#18181b" stroke-width="1" />

      <!-- Shock Mount Yoke Arm -->
      <g transform="rotate(-32, 70, 100)">
        <path d="M 70,100 L 70,30" stroke="#27272a" stroke-width="12" stroke-linecap="round" />
        <!-- Yoke Cradle -->
        <path d="M 45,30 C 45,15 95,15 95,30 L 95,45 C 95,60 45,60 45,45 Z" fill="none" stroke="#3f3f46" stroke-width="5" />

        <!-- Microphone Body (SM7B style) -->
        <g transform="translate(48, -45)">
          <!-- Base capsule / XLR connector -->
          <rect x="8" y="45" width="28" height="24" rx="4" fill="url(#micGrad)" stroke="#18181b" stroke-width="1.5" />
          <line x1="8" y1="52" x2="36" y2="52" stroke="#71717a" stroke-width="1" />
          <!-- Metallic Ring Collar -->
          <rect x="6" y="38" width="32" height="7" rx="2" fill="#71717a" stroke="#27272a" stroke-width="1" />
          <!-- Brand Badge Accent -->
          <rect x="18" y="40" width="8" height="3" fill="#00F0FF" />
          <!-- Main Foam Windscreen -->
          <rect x="4" y="-30" width="36" height="68" rx="14" fill="url(#foamGrad)" stroke="#18181b" stroke-width="2" />
          <!-- Foam Bevel lines -->
          <line x1="4" y1="-8" x2="40" y2="-8" stroke="#18181b" stroke-width="1.5" stroke-opacity="0.6" />
          <line x1="4" y1="14" x2="40" y2="14" stroke="#18181b" stroke-width="1.5" stroke-opacity="0.6" />
        </g>
      </g>
    </g>
  </svg>`;
}

/**
 * Generates an SVG string for a soft cinematic vignette overlay.
 */
export function generateCinematicVignetteSvg({ width = 1280, height = 720 } = {}) {
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="vignette" cx="50%" cy="45%" r="65%" fx="50%" fy="45%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0" />
        <stop offset="65%" stop-color="#000000" stop-opacity="0.08" />
        <stop offset="100%" stop-color="#020617" stop-opacity="0.45" />
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#vignette)" />
  </svg>`;
}

let cachedStudioForeground = null;
let cachedCinematicVignette = null;

/**
 * Renders and returns a cached PNG buffer of the Streamer Studio foreground.
 */
export async function getStreamerStudioForegroundBuffer({ width = 1280, height = 720 } = {}) {
  if (cachedStudioForeground) return cachedStudioForeground;
  const svg = generateStreamerStudioForegroundSvg({ width, height });
  cachedStudioForeground = await sharp(Buffer.from(svg)).png().toBuffer();
  return cachedStudioForeground;
}

/**
 * Renders and returns a cached PNG buffer of the cinematic vignette.
 */
export async function getCinematicVignetteBuffer({ width = 1280, height = 720 } = {}) {
  if (cachedCinematicVignette) return cachedCinematicVignette;
  const svg = generateCinematicVignetteSvg({ width, height });
  cachedCinematicVignette = await sharp(Buffer.from(svg)).png().toBuffer();
  return cachedCinematicVignette;
}
