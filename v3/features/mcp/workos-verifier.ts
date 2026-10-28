import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { OAuthError, OAuthErrorCode, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { MCP_RESOURCE_URL, authkitDomain } from "./hosted-auth";

export function workosTokenVerifier(jwks?: JWTVerifyGetKey): OAuthTokenVerifier {
  const keys = jwks ?? createRemoteJWKSet(new URL(`${authkitDomain()}/oauth2/jwks`));
  return {
    async verifyAccessToken(token) {
      try {
        const { payload } = await jwtVerify(token, keys, {
          issuer: authkitDomain(),
          audience: MCP_RESOURCE_URL,
        });
        if (!payload.sub || payload.exp == null) {
          throw new Error("missing subject or expiry");
        }
        const clientClaim = payload.client_id ?? payload.azp;
        const clientId = typeof clientClaim === "string" && clientClaim ? clientClaim : payload.sub;
        const scopes = typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];
        return {
          token,
          clientId,
          scopes,
          expiresAt: payload.exp,
          resource: new URL(MCP_RESOURCE_URL),
          extra: { sub: payload.sub },
        };
      } catch (error) {
        if (error instanceof OAuthError) throw error;
        throw new OAuthError(OAuthErrorCode.InvalidToken, "Authorization needed");
      }
    },
  };
}
