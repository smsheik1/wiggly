import sharp from "sharp";

export const KEN_BURNS_MOTIONS = [
  "zoom-in",
  "zoom-out",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
];

/**
 * Calculates the crop window for a Ken Burns effect frame.
 */
export function calculateKenBurnsCrop({
  motion = "zoom-in",
  progress = 0,
  sourceWidth = 1280,
  sourceHeight = 720,
}) {
  const p = Math.max(0, Math.min(1, progress));

  let zoom = 1.0;
  let focusX = 0.5;
  let focusY = 0.5;

  switch (motion) {
    case "zoom-in": {
      zoom = 1.0 + 0.16 * p;
      focusX = 0.5;
      focusY = 0.5;
      break;
    }
    case "zoom-out": {
      zoom = 1.16 - 0.16 * p;
      focusX = 0.5;
      focusY = 0.5;
      break;
    }
    case "pan-right": {
      zoom = 1.14;
      focusX = 0.25 + 0.50 * p;
      focusY = 0.5;
      break;
    }
    case "pan-left": {
      zoom = 1.14;
      focusX = 0.75 - 0.50 * p;
      focusY = 0.5;
      break;
    }
    case "pan-up": {
      zoom = 1.14;
      focusX = 0.5;
      focusY = 0.75 - 0.50 * p;
      break;
    }
    case "pan-down": {
      zoom = 1.14;
      focusX = 0.5;
      focusY = 0.25 + 0.50 * p;
      break;
    }
    default: {
      zoom = 1.0;
      focusX = 0.5;
      focusY = 0.5;
    }
  }

  const cropW = Math.max(1, Math.min(sourceWidth, Math.round(sourceWidth / zoom)));
  const cropH = Math.max(1, Math.min(sourceHeight, Math.round(sourceHeight / zoom)));

  const maxLeft = sourceWidth - cropW;
  const maxTop = sourceHeight - cropH;

  const left = Math.max(0, Math.min(maxLeft, Math.round(maxLeft * focusX)));
  const top = Math.max(0, Math.min(maxTop, Math.round(maxTop * focusY)));

  return { left, top, width: cropW, height: cropH };
}

/**
 * Detects if an image is an isolated cutout or product photograph on a light/white/transparent backdrop.
 */
export async function isLightCutout(imageBuffer) {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const { width, height } = meta;
    if (!width || !height) return false;

    const size = Math.min(25, Math.floor(width / 4), Math.floor(height / 4));
    if (size < 2) return false;

    const corners = [
      { left: 0, top: 0, width: size, height: size },
      { left: width - size, top: 0, width: size, height: size },
      { left: 0, top: height - size, width: size, height: size },
      { left: width - size, top: height - size, width: size, height: size },
    ];

    let lightCount = 0;
    for (const c of corners) {
      const stat = await sharp(imageBuffer).extract(c).stats();
      if (stat.isOpaque === false && stat.channels[3]?.mean < 50) {
        lightCount += 1;
        continue;
      }
      const lum =
        0.299 * (stat.channels[0]?.mean || 0) +
        0.587 * (stat.channels[1]?.mean || 0) +
        0.114 * (stat.channels[2]?.mean || 0);
      // Light studio backdrop or plain white
      if (lum > 210) {
        lightCount += 1;
      }
    }

    return lightCount >= 3;
  } catch {
    return false;
  }
}

/**
 * Stages a product cutout centered inside an Apple/MKBHD-style editorial showcase card
 * on a deep slate/indigo tech gradient with a soft drop shadow.
 */
export async function stageProductShowcaseCard(imageBuffer, { targetWidth = 1280, targetHeight = 720 } = {}) {
  let trimmed;
  try {
    trimmed = await sharp(imageBuffer).trim({ threshold: 25 }).toBuffer();
  } catch {
    trimmed = imageBuffer;
  }

  const maxProdW = Math.round(targetWidth * 0.46);
  const maxProdH = Math.round(targetHeight * 0.68);

  const product = await sharp(trimmed)
    .resize(maxProdW, maxProdH, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const prodMeta = await sharp(product).metadata();

  const cardW = Math.min(targetWidth - 80, Math.max(prodMeta.width + 80, Math.round(targetWidth * 0.54)));
  const cardH = Math.min(targetHeight - 60, Math.max(prodMeta.height + 60, Math.round(targetHeight * 0.74)));
  const cardX = Math.round((targetWidth - cardW) / 2);
  const cardY = Math.round((targetHeight - cardH) / 2);

  const prodX = Math.round((targetWidth - prodMeta.width) / 2);
  const prodY = Math.round((targetHeight - prodMeta.height) / 2);

  const svg = `<svg width="${targetWidth}" height="${targetHeight}" viewBox="0 0 ${targetWidth} ${targetHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b0f19" />
        <stop offset="50%" stop-color="#141a29" />
        <stop offset="100%" stop-color="#1e1838" />
      </linearGradient>
      <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="28" flood-color="#000000" flood-opacity="0.70" />
      </filter>
    </defs>
    <rect width="${targetWidth}" height="${targetHeight}" fill="url(#bgGrad)" />
    
    <!-- Outer Card Shadow & Body -->
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="32" fill="#ffffff" filter="url(#cardShadow)" />
    <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="32" fill="none" stroke="#e2e8f0" stroke-width="2" />
  </svg>`;

  const bgBuf = await sharp(Buffer.from(svg)).png().toBuffer();

  return sharp(bgBuf)
    .composite([{ input: product, left: prodX, top: prodY }])
    .png()
    .toBuffer();
}

/**
 * Stages a non-16:9 scenic photo or screenshot centered with rounded corners and drop shadow
 * over a darkened, blurred 16:9 backdrop version of itself.
 */
export async function stageScenicNon16x9(imageBuffer, { targetWidth = 1280, targetHeight = 720 } = {}) {
  const blurredBg = await sharp(imageBuffer)
    .resize(targetWidth, targetHeight, { fit: "cover" })
    .blur(30)
    .modulate({ brightness: 0.60 })
    .png()
    .toBuffer();

  const fgMaxW = Math.round(targetWidth * 0.88);
  const fgMaxH = Math.round(targetHeight * 0.88);
  const fg = await sharp(imageBuffer)
    .resize(fgMaxW, fgMaxH, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const fgMeta = await sharp(fg).metadata();

  const fgX = Math.round((targetWidth - fgMeta.width) / 2);
  const fgY = Math.round((targetHeight - fgMeta.height) / 2);

  const shadowSvg = `<svg width="${targetWidth}" height="${targetHeight}">
    <defs>
      <filter id="fgShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="24" flood-color="#000000" flood-opacity="0.80" />
      </filter>
    </defs>
    <rect x="${fgX}" y="${fgY}" width="${fgMeta.width}" height="${fgMeta.height}" rx="16" fill="#000000" filter="url(#fgShadow)" />
  </svg>`;
  const shadowBuf = await sharp(Buffer.from(shadowSvg)).png().toBuffer();

  return sharp(blurredBg)
    .composite([
      { input: shadowBuf, left: 0, top: 0 },
      { input: fg, left: fgX, top: fgY },
    ])
    .png()
    .toBuffer();
}

/**
 * Normalizes any downloaded media asset into a standardized 1280x720 16:9 frame buffer.
 * Automatically detects product cutouts and frames them on editorial showcase cards.
 */
export async function normalizeBrollMedia(imageBuffer, { targetWidth = 1280, targetHeight = 720 } = {}) {
  const meta = await sharp(imageBuffer).metadata();
  const width = meta.width || targetWidth;
  const height = meta.height || targetHeight;
  const ar = width / height;

  const isCutout = await isLightCutout(imageBuffer);

  if (isCutout) {
    return stageProductShowcaseCard(imageBuffer, { targetWidth, targetHeight });
  }

  // If already close to 16:9 (1.6 to 1.9)
  if (ar >= 1.6 && ar <= 1.9) {
    return sharp(imageBuffer)
      .resize(targetWidth, targetHeight, { fit: "cover" })
      .png()
      .toBuffer();
  }

  // Non-16:9 scenic or screenshot
  return stageScenicNon16x9(imageBuffer, { targetWidth, targetHeight });
}

/**
 * Renders a single frame of Ken Burns motion over a source image buffer.
 */
export async function renderKenBurnsFrame({
  sourceBuffer,
  sourceWidth = 1280,
  sourceHeight = 720,
  targetWidth = 1280,
  targetHeight = 720,
  motion = "zoom-in",
  localFrame = 0,
  durationFrames = 24,
}) {
  const progress = durationFrames > 1 ? localFrame / (durationFrames - 1) : 0;
  const crop = calculateKenBurnsCrop({
    motion,
    progress,
    sourceWidth,
    sourceHeight,
  });

  return sharp(sourceBuffer)
    .extract(crop)
    .resize(targetWidth, targetHeight, { fit: "fill" })
    .png()
    .toBuffer();
}
