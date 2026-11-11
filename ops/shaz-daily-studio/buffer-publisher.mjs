import process from "node:process";
import { getSecretKey, redactSecrets } from "./secrets.mjs";

const BUFFER_GRAPHQL_ENDPOINT = "https://api.buffer.com";

export const CANONICAL_INSTAGRAM_HANDLE = "shazskits";
export const CANONICAL_YOUTUBE_CHANNEL = "Shaz";
export const CANONICAL_TWITTER_HANDLE = "shazDrools";

/**
 * Ensures the video URL passed to Buffer is a clean HTTPS link with no Telegram bot token.
 */
export function assertValidPublicVideoUrl(videoUrl, caller = "publishVideo") {
  if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.startsWith("https://")) {
    throw new Error(`${caller} requires a publicly accessible HTTPS videoUrl`);
  }
  if (/api\.telegram\.org\/file\/bot/i.test(videoUrl)) {
    throw new Error(
      `${caller} refused an api.telegram.org bot file URL because it leaks the Telegram bot token and expires before social platforms fetch it.`
    );
  }
}

/**
 * Loads BUFFER_API_KEY from secrets.env or environment variables.
 */
export function getBufferApiKey() {
  return getSecretKey("SHAZSKISBUFFER_API_KEY") || getSecretKey("BUFFER_API_KEY");
}

/**
 * Executes a GraphQL query against Buffer API.
 */
export async function executeBufferGraphQL({ query, variables = {}, apiKey: explicitKey, fetchFn = fetch }) {
  const key = explicitKey !== undefined ? explicitKey : getBufferApiKey();
  if (!key) {
    throw new Error(
      `\n================================================================================\n` +
      `❌ BUFFER API ERROR: BUFFER_API_KEY IS MISSING\n` +
      `================================================================================\n` +
      `Cannot publish to social channels: BUFFER_API_KEY is not configured.\n\n` +
      `Baby steps to fix:\n` +
      `1. Open your browser and go to: https://developers.buffer.com/ (or your Buffer account settings).\n` +
      `2. Generate a Public API Access Token.\n` +
      `3. Open 'secrets.env' at repo root and add: BUFFER_API_KEY=your_token_here\n` +
      `================================================================================\n`
    );
  }

  const response = await fetchFn(BUFFER_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(redactSecrets(`Buffer API HTTP ${response.status}: ${text.slice(0, 300)}`, [key]));
  }

  const result = await response.json();
  if (result.errors && result.errors.length > 0) {
    const msg = result.errors.map((e) => e.message).join(", ");
    throw new Error(redactSecrets(`Buffer GraphQL error: ${msg}`, [key]));
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
 * Publishes a video to an Instagram channel via Buffer.
 *
 * @param {Object} options
 * @param {string} [options.channelId] - Buffer channel ID (auto-discovers Instagram if omitted)
 * @param {string} options.videoUrl - Publicly accessible HTTPS URL of the video
 * @param {string} options.caption - Caption/text for the post
 * @param {"shareNow" | "addToQueue"} [options.mode="shareNow"] - Immediate dispatch or queue
 * @param {string} [options.apiKey] - Explicit API key
 * @param {Function} [options.fetchFn] - Injected fetch
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
    // Prioritize shazskits or shaz-named channels first
    const igChannel = igChannels.find((c) => c.name.toLowerCase().includes("shaz")) || igChannels[0];
    if (!igChannel) {
      throw new Error("No connected Instagram channel found in Buffer organization. Connect an Instagram account at https://publish.buffer.com.");
    }
    targetChannelId = igChannel.id;
  }

  const mutation = `mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
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

  const data = await executeBufferGraphQL({ query: mutation, variables, apiKey, fetchFn });
  const payload = data?.createPost;

  if (payload?.post) {
    return {
      success: true,
      service: "instagram",
      channelId: targetChannelId,
      postId: payload.post.id,
      status: payload.post.status,
    };
  }

  const errorMsg = payload?.message || "Unknown error creating Buffer Instagram post";
  throw new Error(`Buffer Instagram post creation failed: ${errorMsg}`);
}

/**
 * Publishes a vertical video as a YouTube Short via Buffer.
 *
 * @param {Object} options
 * @param {string} [options.channelId] - Buffer channel ID (auto-discovers YouTube if omitted)
 * @param {string} options.videoUrl - Publicly accessible HTTPS URL of the video
 * @param {string} options.title - Title for the YouTube Short
 * @param {string} [options.description] - Description/body text
 * @param {string} [options.categoryId="20"] - YouTube Category ID ("20" = Gaming, "28" = Science & Tech)
 * @param {"shareNow" | "addToQueue"} [options.mode="shareNow"] - Immediate dispatch or queue
 * @param {"public" | "unlisted" | "private"} [options.privacy="public"] - Visibility
 * @param {string} [options.apiKey] - Explicit API key
 * @param {Function} [options.fetchFn] - Injected fetch
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

  const mutation = `mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
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

  const data = await executeBufferGraphQL({ query: mutation, variables, apiKey, fetchFn });
  const payload = data?.createPost;

  if (payload?.post) {
    return {
      success: true,
      service: "youtube",
      channelId: targetChannelId,
      postId: payload.post.id,
      status: payload.post.status,
    };
  }

  const errorMsg = payload?.message || "Unknown error creating Buffer YouTube post";
  throw new Error(`Buffer YouTube post creation failed: ${errorMsg}`);
}

/**
 * Publishes a vertical video to TikTok via Buffer.
 *
 * @param {Object} options
 * @param {string} [options.channelId] - Buffer channel ID (auto-discovers TikTok if omitted)
 * @param {string} options.videoUrl - Publicly accessible HTTPS URL of the video
 * @param {string} options.title - Caption / title for the TikTok video
 * @param {"shareNow" | "addToQueue"} [options.mode="shareNow"] - Immediate dispatch or queue
 * @param {string} [options.apiKey] - Explicit API key
 * @param {Function} [options.fetchFn] - Injected fetch
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

  const mutation = `mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
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

  const data = await executeBufferGraphQL({ query: mutation, variables, apiKey, fetchFn });
  const payload = data?.createPost;

  if (payload?.post) {
    return {
      success: true,
      service: "tiktok",
      channelId: targetChannelId,
      postId: payload.post.id,
      status: payload.post.status,
    };
  }

  const errorMsg = payload?.message || "Unknown error creating Buffer TikTok post";
  throw new Error(`Buffer TikTok post creation failed: ${errorMsg}`);
}

/**
 * Publishes a video simultaneously to all target studio channels:
 * - Instagram Reels (@shazskits)
 * - YouTube Shorts (Shaz)
 * - TikTok (when connected)
 *
 * @param {Object} options
 * @param {string} options.videoUrl - Publicly accessible HTTPS URL of the video
 * @param {string} options.title - Video headline/title
 * @param {string} [options.caption] - Spoken transcript / script body
 * @param {string[]} [options.tags] - Hashtags
 * @param {"shareNow" | "addToQueue"} [options.mode="shareNow"] - Immediate dispatch or queue
 * @param {string} [options.apiKey] - Explicit API key
 * @param {Function} [options.fetchFn] - Injected fetch
 */
export function deriveStoryHashtags(title = "", script = {}) {
  if (Array.isArray(script.hashtags) && script.hashtags.length > 0) {
    const valid = script.hashtags
      .map((t) => (t.startsWith("#") ? t : `#${t}`).toLowerCase().replace(/[^#a-z0-9_]/g, ""))
      .filter((t) => t.length > 2);
    if (valid.length >= 2) return valid;
  }

  const text = `${title} ${script.title || ""}`.toLowerCase();
  const tags = new Set(["#shaz", "#animation", "#gaming", "#shorts"]);

  if (/ps5|playstation|sony/.test(text)) tags.add("#playstation");
  if (/xbox|microsoft|game pass/.test(text)) tags.add("#xbox");
  if (/nintendo|switch|mario|zelda/.test(text)) tags.add("#nintendo");
  if (/steam|valve|decky|pc gaming/.test(text)) tags.add("#steamdeck");
  if (/gta|rockstar/.test(text)) tags.add("#gta6");
  if (/apple|iphone|ipad|mac/.test(text)) tags.add("#apple");
  if (/discount|sale|price|deal|black friday/.test(text)) tags.add("#gamingdeals");
  if (/leak|rumor|insider|report/.test(text)) tags.add("#gamingnews");
  if (/ai|llm|tech/.test(text)) tags.add("#tech");

  return Array.from(tags).slice(0, 6);
}

export async function publishVideoToAllChannels({
  videoUrl,
  title,
  caption = "",
  tags = null,
  mode = "shareNow",
  apiKey,
  fetchFn = fetch,
}) {
  assertValidPublicVideoUrl(videoUrl, "publishVideoToAllChannels");
  const { channels } = await getBufferChannels({ apiKey, fetchFn });
  const cleanTitle = title.trim();
  const effectiveTags = Array.isArray(tags) && tags.length > 0 ? tags : deriveStoryHashtags(cleanTitle);
  const tagString = effectiveTags.join(" ");

  const results = {};
  const pendingChannels = [];

  // 1. Instagram Reels
  const igChannel = channels.find((c) => c.service === "instagram" && c.name.toLowerCase().includes("shaz"))
    || channels.find((c) => c.service === "instagram");
  if (igChannel) {
    const igCaption = `${cleanTitle}\n\n${caption.trim()}\n\n${tagString}`.trim();
    results.instagram = await publishVideoToInstagram({
      channelId: igChannel.id,
      videoUrl,
      caption: igCaption,
      mode,
      apiKey,
      fetchFn,
    });
  } else {
    throw new Error("No connected Instagram channel found in Buffer organization (@shazskits).");
  }

  // 2. YouTube Shorts
  const ytChannel = channels.find((c) => c.service === "youtube" && c.name.toLowerCase().includes("shaz"))
    || channels.find((c) => c.service === "youtube");
  if (ytChannel) {
    results.youtube = await publishVideoToYouTube({
      channelId: ytChannel.id,
      videoUrl,
      title: cleanTitle,
      description: `${caption.trim()}\n\n${tagString}`.trim(),
      mode,
      apiKey,
      fetchFn,
    });
  } else {
    throw new Error("No connected YouTube channel found in Buffer organization (Shaz).");
  }

  // 3. TikTok
  const ttChannel = channels.find((c) => c.service === "tiktok");
  if (ttChannel) {
    const ttTitle = `${cleanTitle} ${tagString}`.slice(0, 150).trim();
    results.tiktok = await publishVideoToTikTok({
      channelId: ttChannel.id,
      videoUrl,
      title: ttTitle,
      mode,
      apiKey,
      fetchFn,
    });
  } else {
    pendingChannels.push({
      service: "tiktok",
      note: "TikTok channel is not yet connected in your Buffer organization. Connect TikTok in Buffer to auto-publish.",
    });
  }

  return {
    success: true,
    channels: results,
    pending: pendingChannels,
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
