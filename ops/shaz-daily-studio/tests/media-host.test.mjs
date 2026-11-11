import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { deletePublishVideo, uploadPublishVideo } from "../media-host.mjs";

const TEST_SITE_URL = "https://wry-viper-639.convex.site";
const TEST_SECRET = "test_studio_upload_secret_hex_123456";

test("uploadPublishVideo fails loudly per Rule 12 when CONVEX_SITE_URL or STUDIO_UPLOAD_SECRET is missing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "media-host-missing-"));
  const videoPath = path.join(tempDir, "video.mp4");
  await fs.writeFile(videoPath, Buffer.from("mp4-content"));

  try {
    await assert.rejects(
      () =>
        uploadPublishVideo(videoPath, {
          env: {},
          secretsPath: path.join(tempDir, "missing-secrets.env"),
          convexSiteUrl: "",
          studioUploadSecret: TEST_SECRET,
        }),
      /CONVEX_SITE_URL.*IS MISSING OR INVALID/i,
    );

    await assert.rejects(
      () =>
        uploadPublishVideo(videoPath, {
          env: {},
          secretsPath: path.join(tempDir, "missing-secrets.env"),
          convexSiteUrl: TEST_SITE_URL,
          studioUploadSecret: "",
        }),
      /STUDIO_UPLOAD_SECRET.*wry-viper-639/i,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("uploadPublishVideo uploads bytes via 3-step Convex HTTP flow and returns *.convex.cloud URL", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "media-host-ok-"));
  const videoPath = path.join(tempDir, "winner.mp4");
  const payload = Buffer.from("vertical-video-binary-bytes");
  await fs.writeFile(videoPath, payload);

  const calls = [];
  const mockFetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method, headers: init.headers });
    if (String(url) === `${TEST_SITE_URL}/studio/upload-url`) {
      assert.equal(init.headers["x-studio-secret"], TEST_SECRET);
      return {
        ok: true,
        json: async () => ({
          uploadUrl: "https://wry-viper-639.convex.cloud/api/storage/upload?token=abc",
          uploadToken: "ticket_123",
        }),
      };
    }
    if (String(url).startsWith("https://wry-viper-639.convex.cloud/api/storage/upload")) {
      assert.equal(init.headers["Content-Type"], "video/mp4");
      assert.equal(Buffer.compare(Buffer.from(init.body), payload), 0);
      return {
        ok: true,
        json: async () => ({ storageId: "kg2storage123" }),
      };
    }
    if (String(url) === `${TEST_SITE_URL}/studio/file-url`) {
      const parsed = JSON.parse(init.body);
      assert.equal(parsed.storageId, "kg2storage123");
      assert.equal(parsed.uploadToken, "ticket_123");
      assert.equal(parsed.bytes, payload.length);
      assert.match(parsed.sha256, /^[a-f0-9]{64}$/);
      return {
        ok: true,
        json: async () => ({
          storageId: "kg2storage123",
          url: "https://wry-viper-639.convex.cloud/api/storage/public-123",
        }),
      };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const result = await uploadPublishVideo(videoPath, {
      convexSiteUrl: TEST_SITE_URL,
      studioUploadSecret: TEST_SECRET,
      fetchFn: mockFetch,
    });

    assert.equal(calls.length, 3);
    assert.equal(result.storageId, "kg2storage123");
    assert.equal(result.bytes, payload.length);
    assert.equal(new URL(result.url).hostname, "wry-viper-639.convex.cloud");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("uploadPublishVideo and deletePublishVideo throw with HTTP status on 401/500 and never leak secret", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "media-host-err-"));
  const videoPath = path.join(tempDir, "winner.mp4");
  await fs.writeFile(videoPath, Buffer.from("mp4"));

  try {
    await assert.rejects(
      () =>
        uploadPublishVideo(videoPath, {
          convexSiteUrl: TEST_SITE_URL,
          studioUploadSecret: TEST_SECRET,
          fetchFn: async () => ({
            ok: false,
            status: 401,
            statusText: "Unauthorized",
            text: async () => JSON.stringify({ error: `bad secret ${TEST_SECRET}` }),
          }),
        }),
      (err) => {
        assert.match(err.message, /HTTP 401/);
        assert.equal(err.message.includes(TEST_SECRET), false);
        return true;
      },
    );

    await assert.rejects(
      () =>
        deletePublishVideo("kg2storage123", {
          convexSiteUrl: TEST_SITE_URL,
          studioUploadSecret: TEST_SECRET,
          fetchFn: async () => ({
            ok: false,
            status: 500,
            statusText: "Server Error",
            text: async () => "boom",
          }),
        }),
      /HTTP 500/,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("deletePublishVideo calls POST /studio/delete with x-studio-secret", async () => {
  let captured = null;
  const result = await deletePublishVideo("kg2storage123", {
    convexSiteUrl: TEST_SITE_URL,
    studioUploadSecret: TEST_SECRET,
    fetchFn: async (url, init) => {
      captured = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
      return {
        ok: true,
        json: async () => ({ deleted: true, storageId: "kg2storage123" }),
      };
    },
  });

  assert.equal(result.deleted, true);
  assert.equal(captured.url, `${TEST_SITE_URL}/studio/delete`);
  assert.equal(captured.headers["x-studio-secret"], TEST_SECRET);
  assert.deepEqual(captured.body, { storageId: "kg2storage123" });
});
