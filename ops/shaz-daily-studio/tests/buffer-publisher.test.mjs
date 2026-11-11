import assert from "node:assert/strict";
import test from "node:test";
import {
  getBufferChannels,
  publishVideoToInstagram,
  publishVideoToYouTube,
  publishVideoToTikTok,
  publishVideoToAllChannels,
  deriveStoryHashtags,
} from "../buffer-publisher.mjs";

test("getBufferChannels parses organization and channels from GraphQL", async () => {
  const mockFetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (body.query.includes("account {")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            account: {
              id: "acc_1",
              email: "test@example.com",
              organizations: [{ id: "org_1", name: "My Org" }],
            },
          },
        }),
      };
    }
    if (body.query.includes("channels(input:")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            channels: [
              { id: "ch_ig", name: "arkham_content_studio", service: "instagram" },
              { id: "ch_yt", name: "Arkham Studios", service: "youtube" },
            ],
          },
        }),
      };
    }
    throw new Error(`Unexpected query: ${body.query}`);
  };

  const { organization, channels } = await getBufferChannels({
    apiKey: "test-token",
    fetchFn: mockFetch,
  });

  assert.equal(organization.id, "org_1");
  assert.equal(channels.length, 2);
  assert.equal(channels[0].service, "instagram");
});

test("publishVideoToInstagram constructs correct mutation and assets payload", async () => {
  let capturedBody = null;

  const mockFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        data: {
          createPost: {
            post: {
              id: "post_123",
              status: "scheduled",
            },
          },
        },
      }),
    };
  };

  const result = await publishVideoToInstagram({
    channelId: "ch_ig",
    videoUrl: "https://api.telegram.org/file/bot123/videos/test.mp4",
    caption: "The PS5 Pro price is ridiculous. What do you think?",
    mode: "shareNow",
    apiKey: "test-token",
    fetchFn: mockFetch,
  });

  assert.equal(result.success, true);
  assert.equal(result.postId, "post_123");
  assert.equal(capturedBody.variables.input.channelId, "ch_ig");
  assert.equal(capturedBody.variables.input.metadata.instagram.type, "reel");
  assert.equal(capturedBody.variables.input.metadata.instagram.shouldShareToFeed, true);
  assert.equal(capturedBody.variables.input.assets[0].video.url, "https://api.telegram.org/file/bot123/videos/test.mp4");
});

test("publishVideoToYouTube constructs correct mutation with #Shorts and metadata", async () => {
  let capturedBody = null;

  const mockFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        data: {
          createPost: {
            post: {
              id: "post_yt_123",
              status: "scheduled",
            },
          },
        },
      }),
    };
  };

  const result = await publishVideoToYouTube({
    channelId: "ch_yt",
    videoUrl: "https://api.telegram.org/file/bot123/videos/test.mp4",
    title: "GTA 6 Release Secret",
    description: "Take-Two confirmed the window is locked.",
    apiKey: "test-token",
    fetchFn: mockFetch,
  });

  assert.equal(result.success, true);
  assert.equal(result.service, "youtube");
  assert.equal(result.postId, "post_yt_123");
  assert.equal(capturedBody.variables.input.channelId, "ch_yt");
  assert.equal(capturedBody.variables.input.metadata.youtube.title, "GTA 6 Release Secret #Shorts");
  assert.equal(capturedBody.variables.input.metadata.youtube.categoryId, "20");
  assert.equal(capturedBody.variables.input.metadata.youtube.madeForKids, false);
  assert.equal(capturedBody.variables.input.metadata.youtube.privacy, "public");
});

test("publishVideoToTikTok constructs correct mutation with title", async () => {
  let capturedBody = null;

  const mockFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        data: {
          createPost: {
            post: {
              id: "post_tt_123",
              status: "scheduled",
            },
          },
        },
      }),
    };
  };

  const result = await publishVideoToTikTok({
    channelId: "ch_tt",
    videoUrl: "https://api.telegram.org/file/bot123/videos/test.mp4",
    title: "GTA 6 Release Secret #gaming",
    apiKey: "test-token",
    fetchFn: mockFetch,
  });

  assert.equal(result.success, true);
  assert.equal(result.service, "tiktok");
  assert.equal(result.postId, "post_tt_123");
  assert.equal(capturedBody.variables.input.channelId, "ch_tt");
  assert.equal(capturedBody.variables.input.metadata.tiktok.title, "GTA 6 Release Secret #gaming");
});

test("publishVideoToAllChannels broadcasts to Instagram and YouTube, reports pending TikTok", async () => {
  const publishedChannels = [];

  const mockFetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (body.query.includes("account {")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            account: {
              id: "acc_1",
              organizations: [{ id: "org_1" }],
            },
          },
        }),
      };
    }
    if (body.query.includes("channels(input:")) {
      return {
        ok: true,
        json: async () => ({
          data: {
            channels: [
              { id: "ch_ig", name: "shazskits", service: "instagram" },
              { id: "ch_yt", name: "Shaz", service: "youtube" },
            ],
          },
        }),
      };
    }
    if (body.query.includes("createPost(input:")) {
      publishedChannels.push(body.variables.input.channelId);
      return {
        ok: true,
        json: async () => ({
          data: {
            createPost: {
              post: {
                id: `post_${body.variables.input.channelId}`,
                status: "sent",
              },
            },
          },
        }),
      };
    }
    throw new Error(`Unexpected query: ${body.query}`);
  };

  const result = await publishVideoToAllChannels({
    videoUrl: "https://api.telegram.org/file/bot123/videos/test.mp4",
    title: "Apple Foldable Reality",
    caption: "The repair bill is insane.",
    apiKey: "test-token",
    fetchFn: mockFetch,
  });

  assert.equal(result.success, true);
  assert.equal(publishedChannels.length, 2);
  assert.ok(publishedChannels.includes("ch_ig"));
  assert.ok(publishedChannels.includes("ch_yt"));
  assert.equal(result.channels.instagram.postId, "post_ch_ig");
  assert.equal(result.channels.youtube.postId, "post_ch_yt");
  assert.equal(result.pending.length, 1);
  assert.equal(result.pending[0].service, "tiktok");
});

test("deriveStoryHashtags extracts contextual tags from title and honors script hashtags", () => {
  const switchTags = deriveStoryHashtags("Nintendo Switch 2 Cartridge System Update", {});
  assert.ok(switchTags.includes("#nintendo"));
  assert.ok(switchTags.includes("#gaming"));
  assert.ok(switchTags.includes("#shorts"));

  const steamTags = deriveStoryHashtags("Decky Loader Community Plugins on Steam Deck", {});
  assert.ok(steamTags.includes("#steamdeck"));

  const customScriptTags = deriveStoryHashtags("General Tech News", {
    hashtags: ["#MyCustomTag", "#DeepTech", "#ViralDeal"],
  });
  assert.deepEqual(customScriptTags, ["#mycustomtag", "#deeptech", "#viraldeal"]);
});
