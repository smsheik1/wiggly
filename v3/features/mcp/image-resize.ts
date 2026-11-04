import jpeg from "jpeg-js";
import { PNG } from "pngjs";

export function resizeImageToThumbnail(imageBuffer: Buffer, maxSide = 512): { data: string; mimeType: "image/jpeg" } {
  let raw: { width: number; height: number; data: Buffer } | undefined;
  try {
    raw = jpeg.decode(imageBuffer);
  } catch {
    try {
      const png = PNG.sync.read(imageBuffer);
      raw = { width: png.width, height: png.height, data: png.data };
    } catch {
      return { data: imageBuffer.toString("base64"), mimeType: "image/jpeg" };
    }
  }

  if (!raw || !raw.width || !raw.height || !raw.data) {
    return { data: imageBuffer.toString("base64"), mimeType: "image/jpeg" };
  }

  const { width, height, data } = raw;
  if (width <= maxSide && height <= maxSide) {
    const encoded = jpeg.encode({ width, height, data }, 80);
    return { data: encoded.data.toString("base64"), mimeType: "image/jpeg" };
  }

  const scale = maxSide / Math.max(width, height);
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));
  const outBuf = Buffer.alloc(targetW * targetH * 4);

  for (let y = 0; y < targetH; y++) {
    const srcY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < targetW; x++) {
      const srcX = Math.min(width - 1, Math.floor(x / scale));
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * targetW + x) * 4;
      outBuf[dstIdx] = data[srcIdx];
      outBuf[dstIdx + 1] = data[srcIdx + 1];
      outBuf[dstIdx + 2] = data[srcIdx + 2];
      outBuf[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  const encoded = jpeg.encode({ width: targetW, height: targetH, data: outBuf }, 80);
  return { data: encoded.data.toString("base64"), mimeType: "image/jpeg" };
}
