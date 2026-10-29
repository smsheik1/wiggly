const CANONICAL_ORIGIN = "https://wiggly.agentenamel.com";

export function publicOrigin() {
  for (const name of ["APP_URL", "V3_PUBLIC_BASE_URL"]) {
    const value = process.env[name]?.trim().replace(/\/+$/, "");
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        return url.origin;
      }
    } catch {
      // A bad env value falls through to the public host.
    }
  }
  return CANONICAL_ORIGIN;
}
