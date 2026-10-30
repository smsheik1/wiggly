import { createMcpRoute } from "../../features/mcp/hosted-server";
import { unauthorizedMcpResponse } from "../../features/mcp/hosted-auth";
import { ConvexFilmLedger, exportAccount, importAccount } from "../../features/mcp/convex-ledger";
import { signPhoto } from "../../features/mcp/photo-store";
import { publicOrigin } from "../../features/mcp/public-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function listUploads(accountId: string) {
  const secret = process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET || "";
  if (!secret) throw new Error("Set MCP_PHOTO_SECRET or SESSION_SECRET before listing upload photos.");
  const account = await exportAccount(accountId);
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
  return (account.photos ?? []).map((photo) => ({
    label: photo.label,
    url: `${publicOrigin()}${signPhoto(secret, accountId, photo.filename, expiresAt)}`,
  }));
}

const mcp = createMcpRoute({
  ledger: new ConvexFilmLedger(),
  loadAccount: exportAccount,
  saveAccount: importAccount,
  listUploads,
});

export function POST(request: Request) {
  return mcp.POST(request);
}

export function GET() {
  return unauthorizedMcpResponse();
}
