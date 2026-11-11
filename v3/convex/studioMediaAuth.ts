export const STUDIO_MEDIA_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const UPLOAD_TICKET_TTL_MS = 10 * 60 * 1000;

export interface StudioAuthResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Constant-time UTF-8 comparison to prevent timing side-channels on the studio secret header.
 */
export function isTimingSafeSecretMatch(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || expected.length === 0 || !provided || provided.length === 0) {
    return false;
  }

  const encoder = new TextEncoder();
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;

  for (let i = 0; i < maxLen; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return diff === 0;
}

/**
 * Verifies the `x-studio-secret` header against Convex's `STUDIO_UPLOAD_SECRET` env var.
 */
export function authorizeStudioRequest(
  request: Pick<Request, "headers">,
  expectedSecret: string | undefined,
): StudioAuthResult {
  const configured = expectedSecret?.trim();
  if (!configured) {
    return {
      ok: false,
      status: 500,
      error: "STUDIO_UPLOAD_SECRET is not configured in Convex environment variables.",
    };
  }

  const provided = request.headers.get("x-studio-secret");
  if (!isTimingSafeSecretMatch(provided, configured)) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized: invalid x-studio-secret header.",
    };
  }

  return { ok: true, status: 200 };
}

/**
 * Validates that a Convex storage object satisfies a freshly issued studio upload ticket.
 */
export function validateStudioStorageCandidate(params: {
  ticket: { createdAt: number; expiresAt: number; consumedAt?: number } | null;
  storageMetadata: { _creationTime: number; size: number } | null;
  bytes: number;
  now: number;
}): { ok: true } | { ok: false; status: number; error: string } {
  const { ticket, storageMetadata, bytes, now } = params;

  if (!ticket) {
    return { ok: false, status: 403, error: "Invalid studio upload ticket." };
  }
  if (ticket.consumedAt !== undefined) {
    return { ok: false, status: 409, error: "Studio upload ticket was already used." };
  }
  if (now > ticket.expiresAt) {
    return { ok: false, status: 410, error: "Studio upload ticket expired." };
  }
  if (!storageMetadata) {
    return { ok: false, status: 404, error: "Uploaded storage object not found." };
  }
  if (storageMetadata._creationTime < ticket.createdAt - 5_000) {
    return {
      ok: false,
      status: 403,
      error: "Storage object predates the studio upload ticket and is refused.",
    };
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || storageMetadata.size !== bytes) {
    return {
      ok: false,
      status: 400,
      error: `Uploaded storage size (${storageMetadata.size}) does not match declared bytes (${bytes}).`,
    };
  }

  return { ok: true };
}
