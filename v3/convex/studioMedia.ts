import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { httpAction, internalMutation } from "./_generated/server";
import {
  authorizeStudioRequest,
  STUDIO_MEDIA_TTL_MS,
  UPLOAD_TICKET_TTL_MS,
  validateStudioStorageCandidate,
} from "./studioMediaAuth";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const createUploadTicket = internalMutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, { token }) => {
    const now = Date.now();
    await ctx.db.insert("studioUploadTickets", {
      token,
      createdAt: now,
      expiresAt: now + UPLOAD_TICKET_TTL_MS,
    });
  },
});

export const registerAndGetUrl = internalMutation({
  args: {
    storageId: v.id("_storage"),
    uploadToken: v.optional(v.string()),
    sha256: v.optional(v.string()),
    bytes: v.optional(v.number()),
  },
  handler: async (ctx, { storageId, uploadToken, sha256, bytes }) => {
    const existing = await ctx.db
      .query("studioMedia")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();

    if (existing) {
      const url = await ctx.storage.getUrl(storageId);
      if (!url) {
        return { ok: false as const, status: 404, error: "Studio media file no longer exists in storage." };
      }
      return {
        ok: true as const,
        status: 200,
        url,
        storageId,
        sha256: existing.sha256,
        bytes: existing.bytes,
        deleteAfter: existing.deleteAfter,
      };
    }

    if (!uploadToken || !sha256 || typeof bytes !== "number") {
      return {
        ok: false as const,
        status: 404,
        error: "Storage ID is not registered in studioMedia.",
      };
    }

    const now = Date.now();
    const ticket = await ctx.db
      .query("studioUploadTickets")
      .withIndex("by_token", (q) => q.eq("token", uploadToken))
      .first();
    const storageMetadata = await ctx.db.system.get("_storage", storageId);

    const check = validateStudioStorageCandidate({
      ticket,
      storageMetadata,
      bytes,
      now,
    });
    if (!check.ok) {
      return check;
    }

    const deleteAfter = now + STUDIO_MEDIA_TTL_MS;
    await ctx.db.patch(ticket!._id, { consumedAt: now });
    await ctx.db.insert("studioMedia", {
      storageId,
      sha256,
      bytes,
      createdAt: now,
      deleteAfter,
    });
    await ctx.scheduler.runAfter(STUDIO_MEDIA_TTL_MS, internal.studioMedia.expire, {
      storageId,
    });

    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      return { ok: false as const, status: 500, error: "Convex failed to generate storage URL." };
    }

    return {
      ok: true as const,
      status: 200,
      url,
      storageId,
      sha256,
      bytes,
      deleteAfter,
    };
  },
});

export const deleteRegisteredMedia = internalMutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { storageId }) => {
    const record = await ctx.db
      .query("studioMedia")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();

    if (!record) {
      return { ok: false as const, status: 404, error: "Storage ID is not registered in studioMedia." };
    }

    const metadata = await ctx.db.system.get("_storage", storageId);
    if (metadata) {
      await ctx.storage.delete(storageId);
    }
    await ctx.db.delete(record._id);

    return { ok: true as const, status: 200, deleted: true, storageId };
  },
});

export const expire = internalMutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { storageId }) => {
    const records = await ctx.db
      .query("studioMedia")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .collect();

    if (records.length === 0) return { deleted: false };

    const metadata = await ctx.db.system.get("_storage", storageId);
    if (metadata) {
      await ctx.storage.delete(storageId);
    }
    for (const record of records) {
      await ctx.db.delete(record._id);
    }

    return { deleted: true };
  },
});

export const sweepExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredMedia = await ctx.db
      .query("studioMedia")
      .withIndex("by_deleteAfter", (q) => q.lte("deleteAfter", now))
      .take(100);

    let deletedMedia = 0;
    for (const record of expiredMedia) {
      const metadata = await ctx.db.system.get("_storage", record.storageId);
      if (metadata) {
        await ctx.storage.delete(record.storageId);
      }
      await ctx.db.delete(record._id);
      deletedMedia += 1;
    }

    const expiredTickets = await ctx.db
      .query("studioUploadTickets")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now - 60 * 60 * 1000))
      .take(100);

    for (const ticket of expiredTickets) {
      await ctx.db.delete(ticket._id);
    }

    return { deletedMedia, deletedTickets: expiredTickets.length };
  },
});

export const issueUploadUrlHttp = httpAction(async (ctx, request) => {
  const auth = authorizeStudioRequest(request, process.env.STUDIO_UPLOAD_SECRET);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const uploadToken = crypto.randomUUID();
  await ctx.runMutation(internal.studioMedia.createUploadTicket, { token: uploadToken });
  const uploadUrl = await ctx.storage.generateUploadUrl();

  return jsonResponse({ uploadUrl, uploadToken }, 200);
});

export const resolveFileUrlHttp = httpAction(async (ctx, request) => {
  const auth = authorizeStudioRequest(request, process.env.STUDIO_UPLOAD_SECRET);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const body = await parseJsonObject(request);
  const rawStorageId = typeof body?.storageId === "string" ? body.storageId.trim() : "";
  if (!rawStorageId) {
    return jsonResponse({ error: "Missing storageId." }, 400);
  }

  const result = await ctx.runMutation(internal.studioMedia.registerAndGetUrl, {
    storageId: rawStorageId as Id<"_storage">,
    uploadToken: typeof body?.uploadToken === "string" ? body.uploadToken : undefined,
    sha256: typeof body?.sha256 === "string" ? body.sha256 : undefined,
    bytes: typeof body?.bytes === "number" ? body.bytes : undefined,
  });

  if (!result.ok) {
    return jsonResponse({ error: result.error }, result.status);
  }

  return jsonResponse({
    url: result.url,
    storageId: result.storageId,
    sha256: result.sha256,
    bytes: result.bytes,
    deleteAfter: result.deleteAfter,
  }, 200);
});

export const deleteMediaHttp = httpAction(async (ctx, request) => {
  const auth = authorizeStudioRequest(request, process.env.STUDIO_UPLOAD_SECRET);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status);
  }

  const body = await parseJsonObject(request);
  const rawStorageId = typeof body?.storageId === "string" ? body.storageId.trim() : "";
  if (!rawStorageId) {
    return jsonResponse({ error: "Missing storageId." }, 400);
  }

  const result = await ctx.runMutation(internal.studioMedia.deleteRegisteredMedia, {
    storageId: rawStorageId as Id<"_storage">,
  });

  if (!result.ok) {
    return jsonResponse({ error: result.error }, result.status);
  }

  return jsonResponse({ deleted: result.deleted, storageId: result.storageId }, 200);
});
