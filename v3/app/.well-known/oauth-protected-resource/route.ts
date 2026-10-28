import { protectedResourceMetadata } from "../../../features/mcp/hosted-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(protectedResourceMetadata(), {
    headers: { "Cache-Control": "no-store" },
  });
}
