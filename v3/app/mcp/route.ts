import { createMcpRoute } from "../../features/mcp/hosted-server";
import { unauthorizedMcpResponse } from "../../features/mcp/hosted-auth";
import { ConvexFilmLedger } from "../../features/mcp/convex-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mcp = createMcpRoute({ ledger: new ConvexFilmLedger() });

export function POST(request: Request) {
  return mcp.POST(request);
}

export function GET() {
  return unauthorizedMcpResponse();
}
