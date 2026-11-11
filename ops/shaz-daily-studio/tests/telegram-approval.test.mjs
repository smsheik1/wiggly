import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseSecretsEnv, redactSecrets } from "../secrets.mjs";
import { sendApprovalVideo } from "../telegram-approval.mjs";

const SENTINEL_TOKEN = "123456:TEST_BOT_TOKEN_SENTINEL";

test("parseSecretsEnv preserves base64 '=' padding and trims matching quotes", () => {
  const parsed = parseSecretsEnv(
    [
      "# comment line",
      'TELEGRAM_BOT_TOKEN="123456:abc== "',
      "STUDIO_UPLOAD_SECRET='deadbeef=='",
      "CONVEX_SITE_URL=https://wry-viper-639.convex.site",
    ].join("\n"),
  );

  assert.equal(parsed.TELEGRAM_BOT_TOKEN, "123456:abc==");
  assert.equal(parsed.STUDIO_UPLOAD_SECRET, "deadbeef==");
  assert.equal(parsed.CONVEX_SITE_URL, "https://wry-viper-639.convex.site");
});

test("redactSecrets masks Telegram bot tokens and known secret strings", () => {
  const masked = redactSecrets(
    `Error calling https://api.telegram.org/bot${SENTINEL_TOKEN}/sendVideo with header my-super-secret-value`,
    ["my-super-secret-value"],
    { env: {} },
  );

  assert.doesNotMatch(masked, /TEST_BOT_TOKEN_SENTINEL/);
  assert.doesNotMatch(masked, /my-super-secret-value/);
  assert.match(masked, /bot\[REDACTED\]/);
  assert.match(masked, /\[REDACTED\]/);
});

test("sendApprovalVideo never calls /getFile and never returns a token URL", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-approval-test-"));
  const videoPath = path.join(tempDir, "candidate.mp4");
  await fs.writeFile(videoPath, Buffer.from("fake-mp4-bytes"));

  const calledUrls = [];
  const mockFetch = async (url) => {
    calledUrls.push(String(url));
    if (String(url).includes("/getFile")) {
      throw new Error("/getFile must never be called");
    }
    return {
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          message_id: 42,
          video: { file_id: "file_abc" },
        },
      }),
    };
  };

  try {
    const res = await sendApprovalVideo({
      videoPath,
      title: "GTA 6 News",
      runId: "daily-test-1",
      captionText: "Voice script line.",
      token: SENTINEL_TOKEN,
      chatId: "999999",
      fetchFn: mockFetch,
    });

    assert.equal(calledUrls.length, 1);
    assert.match(calledUrls[0], /\/sendVideo$/);
    assert.equal(calledUrls.some((u) => u.includes("/getFile")), false);
    assert.deepEqual(res, {
      messageId: 42,
      fileId: "file_abc",
      chatId: "999999",
    });
    assert.equal("publicVideoUrl" in res, false);
    assert.equal(JSON.stringify(res).includes(SENTINEL_TOKEN), false);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

test("sendApprovalVideo scrubs bot token from thrown errors", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tg-err-test-"));
  const videoPath = path.join(tempDir, "candidate.mp4");
  await fs.writeFile(videoPath, Buffer.from("fake-mp4-bytes"));

  try {
    await assert.rejects(
      () =>
        sendApprovalVideo({
          videoPath,
          title: "Fail Test",
          runId: "daily-test-2",
          token: SENTINEL_TOKEN,
          chatId: "999999",
          fetchFn: async () => {
            throw new Error(`request to https://api.telegram.org/bot${SENTINEL_TOKEN}/sendVideo failed`);
          },
        }),
      (err) => {
        assert.equal(err.message.includes(SENTINEL_TOKEN), false);
        assert.match(err.message, /bot\[REDACTED\]/);
        return true;
      },
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});
