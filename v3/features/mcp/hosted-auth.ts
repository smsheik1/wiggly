export const MCP_RESOURCE_URL = "https://wiggly.agentenamel.com/mcp";
export const PROTECTED_RESOURCE_METADATA_URL =
  "https://wiggly.agentenamel.com/.well-known/oauth-protected-resource";

export function authkitDomain() {
  return (process.env.WORKOS_AUTHKIT_DOMAIN || "https://protective-fish-22.authkit.app").replace(/\/$/, "");
}

export function protectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE_URL,
    authorization_servers: [authkitDomain()],
    bearer_methods_supported: ["header"],
  };
}

export function wwwAuthenticateHeader() {
  return [
    'Bearer error="unauthorized"',
    'error_description="Authorization needed"',
    `resource_metadata="${PROTECTED_RESOURCE_METADATA_URL}"`,
  ].join(", ");
}

export function unauthorizedMcpResponse() {
  return Response.json(
    { error: "Authorization needed" },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": wwwAuthenticateHeader(),
        "Cache-Control": "no-store",
      },
    },
  );
}

export type McpAccess = { token: string; sub: string };

export type AccessTokenVerifier = (token: string) => Promise<{ sub: string }>;

export async function requireMcpAccess(
  request: Request,
  verify: AccessTokenVerifier,
): Promise<McpAccess | Response> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match) return unauthorizedMcpResponse();
  try {
    const claims = await verify(match[1]);
    if (!claims.sub) return unauthorizedMcpResponse();
    return { token: match[1], sub: claims.sub };
  } catch {
    return unauthorizedMcpResponse();
  }
}
