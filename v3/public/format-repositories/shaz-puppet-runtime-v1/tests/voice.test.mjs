import assert from "node:assert/strict";
import test from "node:test";
import {
  FISH_MODEL,
  FISH_TTS_URL,
  SHAZ_VOICE_ID,
  loadFishApiKey,
  synthesizeShazVoice,
} from "../runtime/voice.mjs";

test("SHAZ_VOICE_ID is registered as valid 32-char hex Fish Audio voice ID", () => {
  assert.equal(typeof SHAZ_VOICE_ID, "string");
  assert.match(SHAZ_VOICE_ID, /^[a-f0-9]{32}$/);
  assert.equal(FISH_MODEL, "s2.1-pro-free");
  assert.equal(FISH_TTS_URL, "https://api.fish.audio/v1/tts");
});

test("synthesizeShazVoice rejects empty text or missing output path", async () => {
  await assert.rejects(
    async () => synthesizeShazVoice({ text: "", outputPath: "test.wav" }),
    /synthesizeShazVoice requires non-empty text/,
  );

  await assert.rejects(
    async () => synthesizeShazVoice({ text: "Hello", outputPath: "" }),
    /synthesizeShazVoice requires an outputPath/,
  );
});

test("loadFishApiKey loads key from environment or secrets.env gracefully", async () => {
  const key = await loadFishApiKey();
  // If run in environment with secrets.env present, it returns the string; otherwise null
  if (key) {
    assert.equal(typeof key, "string");
    assert.ok(key.length > 10);
  }
});
