import sharp from "sharp";

export const OTS_GRAPHIC_ZONE = Object.freeze({
  left: 64,
  top: 64,
  width: 356,
  height: 340,
  actionSafePadding: 64,
  comfortMarginToShaz: 120,
  shazStagingBox: Object.freeze({ left: 540, top: 80, width: 700, height: 640 }),
});

/**
 * Top headline strip bounds inside `OTS_GRAPHIC_ZONE`, bounded right at x=364 so Shaz's
 * right/left-reaching present/confident gestures keep >= 30px clearance.
 */
export const OTS_HEADLINE_BOX = Object.freeze({
  left: OTS_GRAPHIC_ZONE.left,
  top: OTS_GRAPHIC_ZONE.top,
  width: 300,
  height: 84,
});

function escapeXml(raw) {
  return String(raw || "").replace(/[<>&'"]/g, (ch) => {
    switch (ch) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case "\"": return "&quot;";
    }
  });
}

function wrapHeadlineLines(raw, maxChars = 22, maxLines = 2) {
  const words = String(raw || "").toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (`${current} ${w}`.length <= maxChars) {
      current = `${current} ${w}`;
    } else {
      lines.push(current);
      current = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines && current) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

/**
 * Renders an Over-The-Shoulder (OTS) Graphic Card buffer for talk-to-camera shots.
 * Visual media fills the card while the editorial headline strip sits at the TOP left band
 * so low/mid-frame character gestures never occlude headline legibility.
 *
 * @param {Object} options
 * @param {string} [options.badge] - Top category tag (e.g. "REALITY CHECK", "DETROIT FREE PRESS")
 * @param {string} [options.headline] - Bold punchy headline text
 * @param {Buffer|string} [options.image] - Buffer or file path to inner image/meme
 * @param {string} [options.subtext] - Secondary bottom quote or metadata
 * @param {number} [options.width=440] - Width of the card
 * @param {number} [options.height=440] - Height of the card
 * @param {number} [options.entranceFrame=10] - Frame index within the shot (0-based)
 * @returns {Promise<Buffer>} PNG buffer of the card with shadow
 */
export async function renderOtsCardFrame({
  badge = "",
  headline = "",
  image,
  subtext = "",
  width = 440,
  height = 440,
  entranceFrame = 10,
}) {
  // Entrance snappy pop physics stepped on frames 0..3
  let scale = 1.0;
  if (entranceFrame === 0) scale = 0.0;
  else if (entranceFrame === 1) scale = 0.76;
  else if (entranceFrame === 2) scale = 0.94;
  else scale = 1.0; // Settled hold

  if (scale === 0.0) {
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).png().toBuffer();
  }

  const border = 6;
  const innerW = width - border * 2;
  const innerH = height - border * 2;
  const rx = 18;

  // 1. Prepare base card with outer border & drop shadow
  const baseCardSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.35"/>
        </filter>
      </defs>
      <rect x="${border / 2}" y="${border / 2}" width="${width - border}" height="${height - border}" rx="${rx + border / 2}" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" filter="url(#cardShadow)" />
    </svg>
  `);

  // 2. Prepare inner media (fills the entire inner card area)
  let innerImageBuffer = null;
  if (image) {
    try {
      const resized = await sharp(image)
        .resize(innerW, innerH, { fit: "cover", position: "center" })
        .png()
        .toBuffer();

      const maskSvg = Buffer.from(`
        <svg width="${innerW}" height="${innerH}">
          <rect x="0" y="0" width="${innerW}" height="${innerH}" rx="${rx}" fill="#fff" />
        </svg>
      `);

      innerImageBuffer = await sharp(resized)
        .composite([{ input: maskSvg, blend: "dest-in" }])
        .png()
        .toBuffer();
    } catch {
      innerImageBuffer = null;
    }
  }

  if (!innerImageBuffer) {
    // Vector placeholder if no image provided or load failed
    innerImageBuffer = await sharp({
      create: {
        width: innerW,
        height: innerH,
        channels: 4,
        background: { r: 241, g: 245, b: 249, alpha: 255 },
      },
    }).png().toBuffer();
  }

  // 3. Prepare floating top headline overlay (keeps headline strip in top x<=300 band)
  const hasHeadline = Boolean(headline && headline.trim());
  const headlineLines = hasHeadline ? wrapHeadlineLines(headline, 21, 2) : [];
  const fontSize = headlineLines.length > 1 ? 17 : 19;
  const lineHeight = 22;
  const firstY = headlineLines.length > 1 ? 30 : 38;
  const headlineTextSvg = headlineLines.map((line, idx) => (
    `<text x="18" y="${firstY + idx * lineHeight}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="900" fill="#ffffff" letter-spacing="-0.3" filter="url(#pillShadow)">${escapeXml(line)}</text>`
  )).join("\n        ");

  const overlaysSvg = Buffer.from(`
    <svg width="${innerW}" height="${innerH}" viewBox="0 0 ${innerW} ${innerH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="pillShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.45"/>
        </filter>
        <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.94"/>
          <stop offset="58%" stop-color="#000000" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <!-- Top Gradient Scrim & Headline -->
      ${hasHeadline ? `
        <path d="M 0 ${rx} Q 0 0 ${rx} 0 L ${innerW - rx} 0 Q ${innerW} 0 ${innerW} ${rx} L ${innerW} 88 L 0 88 Z" fill="url(#topFade)" />
        ${headlineTextSvg}
      ` : ""}
    </svg>
  `);

  const baseBuffer = await sharp(baseCardSvg).png().toBuffer();
  let rendered = await sharp(baseBuffer)
    .composite([
      { input: innerImageBuffer, left: border, top: border },
      { input: overlaysSvg, left: border, top: border },
    ])
    .png()
    .toBuffer();

  // 4. Handle entrance scaling
  if (scale !== 1.0) {
    const cardW = Math.min(width, Math.round(width * scale));
    const cardH = Math.min(height, Math.round(height * scale));

    const resized = await sharp(rendered)
      .resize(cardW, cardH, { fit: "contain" })
      .png()
      .toBuffer();

    const padLeft = Math.max(0, Math.floor((width - cardW) / 2));
    const padRight = Math.max(0, width - cardW - padLeft);
    const padTop = Math.max(0, Math.floor((height - cardH) / 2));
    const padBottom = Math.max(0, height - cardH - padTop);

    rendered = await sharp(resized)
      .extend({
        top: padTop,
        bottom: padBottom,
        left: padLeft,
        right: padRight,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }

  return rendered;
}
