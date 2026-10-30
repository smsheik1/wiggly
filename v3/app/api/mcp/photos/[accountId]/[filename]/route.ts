import path from "node:path";
import { photoSignatureValid, readPhoto } from "../../../../../../features/mcp/photo-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mimeTypeFor(file: string) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function signingSecret() {
  const secret = process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET;
  if (secret?.trim()) return secret.trim();
  throw new Error("Set MCP_PHOTO_SECRET in secrets.env before a photo can be read. A missing secret must not leave the file open.");
}

export async function GET(request: Request, context: { params: Promise<{ accountId: string; filename: string }> }) {
  const { accountId, filename } = await context.params;
  const url = new URL(request.url);
  const expiresAt = Number(url.searchParams.get("exp"));
  const signature = url.searchParams.get("sig") ?? "";
  try {
    const secret = await signingSecret();
    if (!photoSignatureValid(secret, accountId, filename, expiresAt, signature)) {
      return new Response("This photo link is not valid.", { status: 401 });
    }
    const bytes = await readPhoto(path.join(process.cwd(), "data", "mcp-uploads"), accountId, filename);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeTypeFor(filename),
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo read failed.";
    const missing = message.includes("ENOENT");
    return new Response(missing ? "Photo not found." : message, { status: missing ? 404 : 401 });
  }
}
