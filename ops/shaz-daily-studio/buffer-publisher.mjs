import process from "node:process";
import { getSecretKey, redactSecrets } from "./secrets.mjs";

const BUFFER_GRAPHQL_ENDPOINT = "https://api.buffer.com";

export const CANONICAL_INSTAGRAM_HANDLE = "shazskits";
export const CANONICAL_YOUTUBE_CHANNEL = "Shaz";
export const CANONICAL_TWITTER_HANDLE = "shazDrools";
export const DEFAULT_RETRY_DELAYS_MS = [10_000, 60_000, 5 * 60_000];

/**
 * Typed error for Buffer API failures distinguishing account/auth problems,
 * ambiguous request timeouts/network drops, and clear request rejections.
 */
export class BufferApiError extends Error {
  constructor(
    message,
    {
      status = null,
      isAccountError = false,
      isAmbiguousTimeout = false,
      cause,
    } = {},
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "BufferApiError";
    this.status = status;
    this.isAccountError = isAccountError;
    this.isAmbiguousTimeout = isAmbiguousTimeout;
  }
}

/**
 * Ensures the video URL passed to Buffer is a clean HTTPS link with no Telegram bot token.
 */
export function assertValidPublicVideoUrl(videoUrl, caller = "publishVideo") {
  if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.startsWith("https://")) {
    throw new Error(`${caller} requires a publicly accessible HTTPS videoUrl`);
  }
  if (/api\.telegram\.org\/file\/bot/i.test(videoUrl)) {
    throw new Error(
      `${caller} refused an api.telegram.org bot file URL because it leaks the Telegram bot token and expires before social platforms fetch it.`,
    );
  }
}

/**
 * Loads BUFFER_API_KEY from secrets.env or environment variables.
 */
export function getBufferApiKey() {
  return getSecretKey("SHAZSKISBUFFER_API_KEY") || getSecretKey("BUFFER_API_KEY");
}

function isTimeoutOrNetworkError(err) {
  const msg = String(err?.message || "");
  return (
    err?.name === "AbortError" ||
    err?.name === "TimeoutError" ||
    /timeout|timed out|aborted|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|network|socket hang up|fetch failed/i.test(msg)
  );
}

/**
 * Executes a GraphQL query against Buffer API.
 */
export async function executeBufferGraphQL({
  query,
  variables = {},
  apiKey: explicitKey,
  fetchFn = fetch,
  timeoutMs = 30_000,
}) {
  const key = explicitKey !== undefined ? explicitKey : getBufferApiKey();
  if (!key) {
    throw new BufferApiError(
      `\n================================================================================\n` +
      `❌ BUFFER API ERROR: BUFFER_API_KEY IS MISSING\n` +
      `================================================================================\n` +
      `Cannot publish to social channels: BUFFER_API_KEY is not configured.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://developers.buffer.com/ (or your Buffer account settings).\n` +
      `2. Generate a Public API Access Token.\n` +
      `3. Open 'secrets.env' at repo root and add: BUFFER_API_KEY=your_token_here\n` +
      `================================================================================\n`,
      { isAccountError: true },
    );
  }

  let response;
  try {
    response = await fetchFn(BUFFER_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      ...(typeof AbortSignal?.timeout === "function" && timeoutMs > 0
        ? { signal: AbortSignal.timeout(timeoutMs) }
        : {}),
    });
  } catch (err) {
    throw new BufferApiError(
      redactSecrets(`Buffer API network/timeout error: ${err.message}`, [key]),
      { isAmbiguousTimeout: isTimeoutOrNetworkError(err), cause: err },
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const status = response.status;
    const isAccountError = status === 401 || status === 403;
    const isAmbiguousTimeout = status === 408 || status === 502 || status === 504;
    throw new BufferApiError(
      redactSecrets(`Buffer API HTTP ${status}: ${text.slice(0, 300)}`, [key]),
      { status, isAccountError, isAmbiguousTimeout },
    );
  }

  const result = await response.json();
  if (result.errors && result.errors.length > 0) {
    const msg = result.errors.map((e) => e.message).join(", ");
    const isAccountError = /unauthoriz|invalid.*token|expired.*token|forbidden/i.test(msg);
    throw new BufferApiError(
      redactSecrets(`Buffer GraphQL error: ${msg}`, [key]),
      { isAccountError },
    );
  }

  return result.data;
}

/**
 * Retrieves the user's organization and connected channels (Instagram, YouTube, TikTok).
 */
export async function getBufferChannels({ apiKey, fetchFn = fetch } = {}) {
  const accountQuery = `query {
    account {
      id
      email
      organizations {
        id
        name
      }
    }
  }`;

  const accountData = await executeBufferGraphQL({ query: accountQuery, apiKey, fetchFn });
  const org = accountData?.account?.organizations?.[0];
  if (!org) {
    throw new Error("No organization found in your Buffer account");
  }

  const channelsQuery = `query GetChannels($input: ChannelsInput!) {
    channels(input: $input) {
      id
      name
      service
    }
  }`;

  const channelsData = await executeBufferGraphQL({
    query: channelsQuery,
    variables: { input: { organizationId: org.id } },
    apiKey,
    fetchFn,
  });

  return {
    organization: org,
    channels: channelsData?.channels || [],
  };
}

/**
 * Checks Buffer's recent posts on a channel to recover a post created just before an ambiguous timeout.
 */
export async function findRecentBufferPost({
  organizationId,
  channelId,
  expectedTextPrefix = "",
  sinceIso,
  apiKey,
  fetchFn = fetch,
}) {
  if (!organizationId || !channelId) return null;

  const query = `query RecentChannelPosts($input: PostsInput!) {
    posts(input: $input, sort: [{ field: createdAt, direction: desc }], first: 10) {
      edges {
        node {
          id
          text
          status
          createdAt
          dueAt
        }
      }
    }
  }`;

  let data;
  try {
    data = await executeBufferGraphQL({
      query,
      variables: {
        input: {
          organizationId,
          filter: { channelIds: [channelId] },
        },
      },
      apiKey,
      fetchFn,
    });
  } catch (err) {
    if (err instanceof BufferApiError && err.isAccountError) {
      throw err;
    }
    return null;
  }

  const edges = data?.posts?.edges || [];
  const sinceMs = sinceIso ? Date.parse(sinceIso) : Number.NaN;
  const normalizedTarget = String(expectedTextPrefix || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);

  for (const edge of edges) {
    const node = edge?.node;
    if (!node?.id) continue;

    if (Number.isFinite(sinceMs) && node.createdAt) {
      const nodeMs = Date.parse(node.createdAt);
      if (Number.isFinite(nodeMs) && nodeMs < sinceMs - 120_000) {
        continue;
      }
    }

    const nodeText = String(node.text || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalizedTarget || nodeText.startsWith(normalizedTarget) || nodeText.includes(normalizedTarget)) {
      return {
        id: node.id,
        status: node.status || "sending",
        text: node.text || "",
        createdAt: node.createdAt || null,
        dueAt: node.dueAt || null,
      };
    }
  }

  return null;
}

const CREATE_POST_MUTATION = `mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess {
      post {
        id
        status
      }
    }
    ... on NotFoundError { message }
    ... on UnauthorizedError { message }
    ... on UnexpectedError { message }
    ... on RestProxyError { message }
    ... on LimitReachedError { message }
    ... on InvalidInputError { message }
  }
}`;

function unwrapCreatePostPayload(data, serviceLabel) {
  const payload = data?.createPost;
  if (payload?.post) {
    return payload.post;
  }
  const errorMsg = payload?.message || `Unknown error creating Buffer ${serviceLabel} post`;
  const isAccountError = payload?.__typename === "UnauthorizedError";
  throw new BufferApiError(`Buffer ${serviceLabel} post creation failed: ${errorMsg}`, {
    isAccountError,
  });
}

/**
 * Publishes a video to an Instagram channel via Buffer.
 */
export async function publishVideoToInstagram({
  channelId,
  videoUrl,
  caption,
  mode = "shareNow",
  apiKey,
  fetchFn = fetch,
}) {
  assertValidPublicVideoUrl(videoUrl, "publishVideoToInstagram");
  if (!caption || !caption.trim()) {
    throw new Error("publishVideoToInstagram requires non-empty caption text");
  }

  let targetChannelId = channelId;
  if (!targetChannelId) {
    const { channels } = await getBufferChannels({ apiKey, fetchFn });
    const igChannels = channels.filter((c) => c.service === "instagram");
    const igChannel = igChannels.find((c) => c.name.toLowerCase().includes("shaz")) || igChannels[0];
    if (!igChannel) {
      throw new Error("No connected Instagram channel found in Buffer organization. Connect an Instagram account at https://publish.buffer.com.");
    }
    targetChannelId = igChannel.id;
  }

  const variables = {
    input: {
      channelId: targetChannelId,
      text: caption.trim(),
      mode,
      schedulingType: "automatic",
      needsApproval: false,
      metadata: {
        instagram: {
          type: "reel",
          shouldShareToFeed: true,
        },
      },
      assets: [
        {
          video: {
            url: videoUrl,
          },
        },
      ],
    },
  };

  const data = await executeBufferGraphQL({ query: CREATE_POST_MUTATION, variables, apiKey, fetchFn });
  const post = unwrapCreatePostPayload(data, "Instagram");
  return {
    success: true,
    service: "instagram",
    channelId: targetChannelId,
    postId: post.id,
    status: post.status,
  };
}

/**
 * Publishes a vertical video as a YouTube Short via Buffer.
 */
export async function publishVideoToYouTube({
  channelId,
  videoUrl,
  title,
  description = "",
  categoryId = "20",
  mode = "shareNow",
  privacy = "public",
  apiKey,
  fetchFn = fetch,
}) {
  assertValidPublicVideoUrl(videoUrl, "publishVideoToYouTube");
  if (!title || !title.trim()) {
    throw new Error("publishVideoToYouTube requires title text");
  }

  let targetChannelId = channelId;
  if (!targetChannelId) {
    const { channels } = await getBufferChannels({ apiKey, fetchFn });
    const ytChannels = channels.filter((c) => c.service === "youtube");
    const ytChannel = ytChannels.find((c) => c.name.toLowerCase().includes("shaz")) || ytChannels[0];
    if (!ytChannel) {
      throw new Error("No connected YouTube channel found in Buffer organization. Connect YouTube at https://publish.buffer.com.");
    }
    targetChannelId = ytChannel.id;
  }

  const cleanTitle = title.trim();
  const formattedTitle = cleanTitle.toLowerCase().includes("#shorts") ? cleanTitle : `${cleanTitle} #Shorts`;
  const bodyText = description?.trim() ? `${formattedTitle}\n\n${description.trim()}` : formattedTitle;

  const variables = {
    input: {
      channelId: targetChannelId,
      text: bodyText,
      mode,
      schedulingType: "automatic",
      needsApproval: false,
      metadata: {
        youtube: {
          title: formattedTitle.slice(0, 100),
          categoryId: String(categoryId),
          madeForKids: false,
          privacy,
        },
      },
      assets: [
        {
          video: {
            url: videoUrl,
          },
        },
      ],
    },
  };

  const data = await executeBufferGraphQL({ query: CREATE_POST_MUTATION, variables, apiKey, fetchFn });
  const post = unwrapCreatePostPayload(data, "YouTube");
  return {
    success: true,
    service: "youtube",
    channelId: targetChannelId,
    postId: post.id,
    status: post.status,
  };
}

/**
 * Publishes a vertical video to TikTok via Buffer.
 */
export async function publishVideoToTikTok({
  channelId,
  videoUrl,
  title,
  mode = "shareNow",
  apiKey,
  fetchFn = fetch,
}) {
  assertValidPublicVideoUrl(videoUrl, "publishVideoToTikTok");
  if (!title || !title.trim()) {
    throw new Error("publishVideoToTikTok requires title text");
  }

  let targetChannelId = channelId;
  if (!targetChannelId) {
    const { channels } = await getBufferChannels({ apiKey, fetchFn });
    const ttChannels = channels.filter((c) => c.service === "tiktok");
    const ttChannel = ttChannels[0];
    if (!ttChannel) {
      throw new Error("No connected TikTok channel found in Buffer organization. Connect TikTok at https://publish.buffer.com.");
    }
    targetChannelId = ttChannel.id;
  }

  const cleanTitle = title.trim().slice(0, 150);
  const variables = {
    input: {
      channelId: targetChannelId,
      text: cleanTitle,
      mode,
      schedulingType: "automatic",
      needsApproval: false,
      metadata: {
        tiktok: {
          title: cleanTitle,
        },
      },
      assets: [
        {
          video: {
            url: videoUrl,
          },
        },
      ],
    },
  };

  const data = await executeBufferGraphQL({ query: CREATE_POST_MUTATION, variables, apiKey, fetchFn });
  const post = unwrapCreatePostPayload(data, "TikTok");
  return {
    success: true,
    service: "tiktok",
    channelId: targetChannelId,
    postId: post.id,
    status: post.status,
  };
}

/**
 * Normalizes hashtag arrays consistently (`#lowercase`, stripping unsafe punctuation, minimum length 3).
 */
export function sanitizeHashtags(rawTags) {
  if (!Array.isArray(rawTags)) return [];
  return rawTags
    .map((t) => String(t ?? "").trim())
    .map((t) => (t.startsWith("#") ? t : `#${t}`).toLowerCase().replace(/[^#a-z0-9_]/g, ""))
    .filter((t) => t.length > 2);
}

/**
 * Derives story hashtags from explicit `script.hashtags` or headline keywords.
 */
export function deriveStoryHashtags(title = "", script = {}) {
  const valid = sanitizeHashtags(script?.hashtags);
  if (valid.length >= 2) return valid;

  const text = `${title} ${script?.title || ""}`.toLowerCase();
  const tags = new Set(["#shaz", "#animation", "#gaming", "#shorts"]);

  if (/ps5|playstation|sony/.test(text)) tags.add("#playstation");
  if (/xbox|microsoft|game pass/.test(text)) tags.add("#xbox");
  if (/nintendo|switch|mario|zelda/.test(text)) tags.add("#nintendo");
  if (/steam|valve|decky|pc gaming/.test(text)) tags.add("#steamdeck");
  if (/gta|rockstar/.test(text)) tags.add("#gta6");
  if (/apple|iphone|ipad|mac/.test(text)) tags.add("#apple");
  if (/discount|sale|price|deal|black friday/.test(text)) tags.add("#gamingdeals");
  if (/leak|rumor|insider|report/.test(text)) tags.add("#gamingnews");
  if (/\b(ai|llm|tech)\b/.test(text)) tags.add("#tech");

  return Array.from(tags).slice(0, 6);
}

/**
 * Publishes a video safely across connected studio channels (`instagram`, `youtube`, `tiktok`)
 * with per-channel checkpoints, isolated per-channel retries on clear errors, and
 * recent-post timeout lookup so already-posted channels are never duplicated.
 *
 * @param {Object} options
 * @param {string} options.videoUrl - Publicly accessible HTTPS URL of the video
 * @param {string} options.title - Video headline/title
 * @param {string} [options.caption] - Spoken transcript / script body
 * @param {string[]} [options.tags] - Hashtags
 * @param {"shareNow" | "addToQueue"} [options.mode="shareNow"] - Immediate dispatch or queue
 * @param {Object} [options.checkpoint] - Prior `publish-state.json` snapshot when resuming
 * @param {boolean} [options.retryUnknownWhenMissing=false] - True in `--resume-publish` to retry once confirmed missing
 * @param {number} [options.maxAttempts=3] - Max attempts per failing channel
 * @param {number[]} [options.retryDelaysMs] - Backoff schedule between failed channel retries
 * @param {Function} [options.onCheckpoint] - Invoked after each channel update
 * @param {Function} [options.sleepFn] - Injectable sleep function
 * @param {Function} [options.nowFn] - Injectable clock function
 * @param {string} [options.apiKey] - Explicit API key
 * @param {Function} [options.fetchFn] - Injected fetch
 */
export async function publishVideoToAllChannels({
  videoUrl,
  title,
  caption = "",
  tags = null,
  mode = "shareNow",
  checkpoint = null,
  retryUnknownWhenMissing = false,
  maxAttempts = 3,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  onCheckpoint,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  nowFn = () => new Date(),
  apiKey,
  fetchFn = fetch,
}) {
  assertValidPublicVideoUrl(videoUrl, "publishVideoToAllChannels");
  const { organization, channels } = await getBufferChannels({ apiKey, fetchFn });
  const cleanTitle = title.trim();
  const sanitized = sanitizeHashtags(tags);
  const effectiveTags = sanitized.length > 0 ? sanitized : deriveStoryHashtags(cleanTitle);
  const tagString = effectiveTags.join(" ");

  const state = {
    schemaVersion: 1,
    ...(checkpoint || {}),
    videoUrl,
    title: cleanTitle,
    organizationId: organization.id,
    channels: { ...(checkpoint?.channels || {}) },
  };

  const postedChannels = {};
  const pendingChannels = [];

  const saveChannelState = async (service, patch) => {
    state.channels[service] = {
      ...(state.channels[service] || {}),
      service,
      ...patch,
    };
    state.updatedAt = nowFn().toISOString();
    if (typeof onCheckpoint === "function") {
      await onCheckpoint(structuredClone(state));
    }
  };

  const specs = [
    {
      service: "instagram",
      pickChannel: () =>
        channels.find((c) => c.service === "instagram" && c.name.toLowerCase().includes("shaz")) ||
        channels.find((c) => c.service === "instagram"),
      expectedTextPrefix: `${cleanTitle}\n\n${caption.trim()}\n\n${tagString}`.trim(),
      optional: false,
      missingNote: "No connected Instagram channel found in Buffer organization (@shazskits).",
      publishOnce: (channelId) =>
        publishVideoToInstagram({
          channelId,
          videoUrl,
          caption: `${cleanTitle}\n\n${caption.trim()}\n\n${tagString}`.trim(),
          mode,
          apiKey,
          fetchFn,
        }),
    },
    {
      service: "youtube",
      pickChannel: () =>
        channels.find((c) => c.service === "youtube" && c.name.toLowerCase().includes("shaz")) ||
        channels.find((c) => c.service === "youtube"),
      expectedTextPrefix: cleanTitle.toLowerCase().includes("#shorts") ? cleanTitle : `${cleanTitle} #Shorts`,
      optional: false,
      missingNote: "No connected YouTube channel found in Buffer organization (Shaz).",
      publishOnce: (channelId) =>
        publishVideoToYouTube({
          channelId,
          videoUrl,
          title: cleanTitle,
          description: `${caption.trim()}\n\n${tagString}`.trim(),
          mode,
          apiKey,
          fetchFn,
        }),
    },
    {
      service: "tiktok",
      pickChannel: () => channels.find((c) => c.service === "tiktok"),
      expectedTextPrefix: `${cleanTitle} ${tagString}`.slice(0, 150).trim(),
      optional: true,
      missingNote: "TikTok channel is not yet connected in your Buffer organization. Connect TikTok in Buffer to auto-publish.",
      publishOnce: (channelId) =>
        publishVideoToTikTok({
          channelId,
          videoUrl,
          title: `${cleanTitle} ${tagString}`.slice(0, 150).trim(),
          mode,
          apiKey,
          fetchFn,
        }),
    },
  ];

  for (const spec of specs) {
    const existing = state.channels[spec.service];
    if (existing?.status === "posted" && existing.postId) {
      postedChannels[spec.service] = {
        success: true,
        service: spec.service,
        channelId: existing.channelId,
        postId: existing.postId,
        status: existing.bufferStatus || existing.status,
      };
      continue;
    }

    const targetChannel = spec.pickChannel();
    if (!targetChannel) {
      if (spec.optional) {
        await saveChannelState(spec.service, {
          status: "not-connected",
          note: spec.missingNote,
        });
        pendingChannels.push({ service: spec.service, note: spec.missingNote });
      } else {
        await saveChannelState(spec.service, {
          status: "failed",
          attempts: 0,
          lastError: spec.missingNote,
          failedAt: nowFn().toISOString(),
        });
      }
      continue;
    }

    if (existing?.status === "unknown") {
      const recovered = await findRecentBufferPost({
        organizationId: organization.id,
        channelId: targetChannel.id,
        expectedTextPrefix: spec.expectedTextPrefix,
        sinceIso: existing.attemptedAt,
        apiKey,
        fetchFn,
      });
      if (recovered) {
        await saveChannelState(spec.service, {
          status: "posted",
          channelId: targetChannel.id,
          postId: recovered.id,
          bufferStatus: recovered.status,
          recoveredFromTimeout: true,
          postedAt: nowFn().toISOString(),
        });
        postedChannels[spec.service] = {
          success: true,
          service: spec.service,
          channelId: targetChannel.id,
          postId: recovered.id,
          status: recovered.status,
          recoveredFromTimeout: true,
        };
        continue;
      }
      if (!retryUnknownWhenMissing) {
        continue;
      }
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptedAt = nowFn().toISOString();
      try {
        const res = await spec.publishOnce(targetChannel.id);
        await saveChannelState(spec.service, {
          status: "posted",
          channelId: targetChannel.id,
          postId: res.postId,
          bufferStatus: res.status,
          attempts: attempt,
          attemptedAt,
          lastError: null,
          postedAt: nowFn().toISOString(),
        });
        postedChannels[spec.service] = res;
        break;
      } catch (err) {
        if (err instanceof BufferApiError && err.isAccountError) {
          throw err;
        }

        if (err instanceof BufferApiError && err.isAmbiguousTimeout) {
          const recovered = await findRecentBufferPost({
            organizationId: organization.id,
            channelId: targetChannel.id,
            expectedTextPrefix: spec.expectedTextPrefix,
            sinceIso: attemptedAt,
            apiKey,
            fetchFn,
          });
          if (recovered) {
            await saveChannelState(spec.service, {
              status: "posted",
              channelId: targetChannel.id,
              postId: recovered.id,
              bufferStatus: recovered.status,
              attempts: attempt,
              attemptedAt,
              recoveredFromTimeout: true,
              lastError: null,
              postedAt: nowFn().toISOString(),
            });
            postedChannels[spec.service] = {
              success: true,
              service: spec.service,
              channelId: targetChannel.id,
              postId: recovered.id,
              status: recovered.status,
              recoveredFromTimeout: true,
            };
            break;
          }

          await saveChannelState(spec.service, {
            status: "unknown",
            channelId: targetChannel.id,
            attempts: attempt,
            attemptedAt,
            lastError: redactSecrets(err.message),
          });
          break;
        }

        if (attempt < maxAttempts) {
          const delayMs = retryDelaysMs[attempt - 1] ?? retryDelaysMs.at(-1) ?? 0;
          if (delayMs > 0) {
            await sleepFn(delayMs);
          }
          continue;
        }

        await saveChannelState(spec.service, {
          status: "failed",
          channelId: targetChannel.id,
          attempts: attempt,
          attemptedAt,
          lastError: redactSecrets(err.message),
          failedAt: nowFn().toISOString(),
        });
      }
    }
  }

  const failedChannels = Object.entries(state.channels)
    .filter(([, entry]) => entry?.status === "failed")
    .map(([name, entry]) => ({ service: name, ...entry }));
  const unknownChannels = Object.entries(state.channels)
    .filter(([, entry]) => entry?.status === "unknown")
    .map(([name, entry]) => ({ service: name, ...entry }));

  return {
    success: failedChannels.length === 0 && unknownChannels.length === 0 && Object.keys(postedChannels).length > 0,
    partial: Object.keys(postedChannels).length > 0 && (failedChannels.length > 0 || unknownChannels.length > 0),
    channels: postedChannels,
    channelStates: state.channels,
    failed: failedChannels,
    unknown: unknownChannels,
    pending: pendingChannels,
    organizationId: organization.id,
  };
}

/**
 * Fetches delivery status (`sent`, `sending`, `scheduled`, `error`) for created Buffer posts.
 */
export async function getBufferPostsStatus({
  postIds = [],
  apiKey,
  fetchFn = fetch,
}) {
  const uniqueIds = [...new Set(postIds.filter((id) => typeof id === "string" && id.trim()))];
  const query = `query GetPostStatus($input: PostInput!) {
    post(input: $input) {
      id
      status
      error {
        message
      }
    }
  }`;

  const posts = [];
  for (const id of uniqueIds) {
    const data = await executeBufferGraphQL({
      query,
      variables: { input: { id } },
      apiKey,
      fetchFn,
    });
    const post = data?.post;
    if (post) {
      posts.push({
        id: post.id || id,
        status: post.status || "unknown",
        error: post.error?.message || null,
      });
    } else {
      posts.push({ id, status: "unknown", error: null });
    }
  }

  return {
    posts,
    allSent: posts.length > 0 && posts.every((p) => p.status === "sent"),
    hasError: posts.some((p) => p.status === "error"),
    pendingIds: posts.filter((p) => p.status !== "sent").map((p) => p.id),
  };
}
