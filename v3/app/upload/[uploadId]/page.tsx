import { Button } from "@/components/ui/button";
import { getUploadSession } from "../../../features/mcp/convex-ledger";

export const dynamic = "force-dynamic";

export default async function UploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ uploadId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { uploadId } = await params;
  const query = await searchParams;
  let session: { accountId: string; expiresAt: string } | null = null;
  let error = "";
  try {
    session = await getUploadSession(uploadId);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "The upload ledger is unavailable.";
  }
  if (error) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">Upload ledger is not connected</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm">{error}</p>
      </main>
    );
  }
  if (!session) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-semibold">This upload link has expired</h1>
        <p className="mt-3 text-sm">Ask your agent to call wiggly_open_upload again.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-semibold">Label each photo</h1>
      <p className="mt-3 text-sm">Use the name your story will use, such as Mom or Leo. The link expires at {session.expiresAt}.</p>
      {query.saved === "1" ? <p className="mt-3 text-sm">Saved. Tell your agent the upload is done.</p> : null}
      <form action={`/api/mcp/upload/${uploadId}`} method="post" encType="multipart/form-data" className="mt-6 grid gap-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <fieldset key={index} className="grid gap-2 rounded-md border p-3">
            <label className="text-sm" htmlFor={`photo-${index}`}>Photo {index + 1}</label>
            <input id={`photo-${index}`} name={`photo-${index}`} type="file" accept="image/*" />
            <label className="text-sm" htmlFor={`label-${index}`}>Label</label>
            <input id={`label-${index}`} name={`label-${index}`} type="text" placeholder="Mom" className="h-9 rounded-md border px-3" />
          </fieldset>
        ))}
        <Button type="submit">Save labels</Button>
      </form>
    </main>
  );
}
