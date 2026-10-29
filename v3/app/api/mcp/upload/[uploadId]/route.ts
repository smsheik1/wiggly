import path from "node:path";
import { getUploadSession, saveUploadLabels } from "../../../../../features/mcp/convex-ledger";
import { photoFilename, savePhoto } from "../../../../../features/mcp/photo-store";
import { publicOrigin } from "../../../../../features/mcp/public-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function photoRoot() {
  return path.join(process.cwd(), "data", "mcp-uploads");
}

export async function POST(request: Request, context: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await context.params;
  try {
    const session = await getUploadSession(uploadId);
    if (!session) return new Response("This upload link has expired. Call wiggly_open_upload again.", { status: 410 });
    const form = await request.formData();
    const labels: string[] = [];
    const photos: Array<{ label: string; filename: string }> = [];
    for (let index = 0; index < 8; index += 1) {
      const file = form.get(`photo-${index}`);
      const label = String(form.get(`label-${index}`) ?? "").trim();
      if (!(file instanceof File) || file.size === 0 || !label) continue;
      const filename = photoFilename(label, file.name || `photo-${index}.jpg`);
      await savePhoto(photoRoot(), session.accountId, filename, Buffer.from(await file.arrayBuffer()));
      labels.push(label);
      photos.push({ label, filename });
    }
    if (labels.length === 0) {
      return new Response("Add a photo and a label for each person, such as Mom or Leo.", { status: 400 });
    }
    await saveUploadLabels(uploadId, labels, photos);
    return Response.redirect(`${publicOrigin()}/upload/${uploadId}?saved=1`, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    console.error(message);
    return new Response(message, { status: 500 });
  }
}
