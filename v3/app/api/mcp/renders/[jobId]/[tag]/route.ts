import path from "node:path";
import { readFile } from "node:fs/promises";
import { renderSignatureValid } from "../../../../../../features/mcp/photo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signingSecret() {
  const secret = process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET;
  if (secret?.trim()) return secret.trim();
  throw new Error("Set MCP_PHOTO_SECRET in secrets.env before a render can be read.");
}

function mimeTypeFor(file: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  return "application/octet-stream";
}

export async function GET(request: Request, context: { params: Promise<{ jobId: string; tag: string }> }) {
  const { jobId, tag } = await context.params;
  const decodedTag = decodeURIComponent(tag);
  const url = new URL(request.url);
  const expiresAt = Number(url.searchParams.get("exp"));
  const signature = url.searchParams.get("sig") ?? "";
  try {
    if (!renderSignatureValid(signingSecret(), decodeURIComponent(jobId), decodedTag, expiresAt, signature)) {
      return new Response("This picture link is not valid.", { status: 401 });
    }
    const stateFile = path.join(process.cwd(), "data", "format-runs", decodeURIComponent(jobId), "outputs", "state.json");
    const state = JSON.parse(await readFile(stateFile, "utf8")) as {
      assetFiles?: Record<string, string>;
      masterVideo?: { videoPath?: string } | string;
      videoUrl?: string;
    };
    let file = state.assetFiles?.[decodedTag];
    if (!file && decodedTag === "master-video") {
      const master = typeof state.masterVideo === "string" ? state.masterVideo : state.masterVideo?.videoPath;
      file = master ?? (state.videoUrl && !state.videoUrl.startsWith("http") ? state.videoUrl : undefined);
    }
    const runDir = path.join(process.cwd(), "data", "format-runs", decodeURIComponent(jobId));
    if (!file || !path.resolve(file).startsWith(path.resolve(runDir) + path.sep)) {
      return new Response("Picture not found.", { status: 404 });
    }
    const bytes = await readFile(file);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeTypeFor(file),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Picture read failed.";
    const missing = message.includes("ENOENT");
    return new Response(missing ? "Picture not found." : message, { status: missing ? 404 : 401 });
  }
}
