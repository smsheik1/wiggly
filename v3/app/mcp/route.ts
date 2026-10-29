import { createMcpRoute } from "../../features/mcp/hosted-server";
import { unauthorizedMcpResponse } from "../../features/mcp/hosted-auth";
import { ConvexFilmLedger, exportAccount, importAccount } from "../../features/mcp/convex-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mcp = createMcpRoute({
  ledger: new ConvexFilmLedger(),
  loadAccount: exportAccount,
  saveAccount: importAccount,
});

export function POST(request: Request) {
  return mcp.POST(request);
}

export function GET() {
  return unauthorizedMcpResponse();
}
