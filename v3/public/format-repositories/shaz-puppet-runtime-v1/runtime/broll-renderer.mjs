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
