import assert from "node:assert/strict";
import test from "node:test";
import {
  CARTESIA_MODEL,
  CARTESIA_SHAZ_VOICE_ID,
  CARTESIA_TTS_URL,
  FISH_MODEL,
  FISH_TTS_URL,
  SHAZ_VOICE_ID,
  loadCartesiaApiKey,
  loadFishApiKey,
  synthesizeShazVoice,
} from "../runtime/voice.mjs";

test("CARTESIA_SHAZ_VOICE_ID is registered as valid Cartesia UUID", () => {
  assert.equal(typeof CARTESIA_SHAZ_VOICE_ID, "string");
  assert.match(CARTESIA_SHAZ_VOICE_ID, /^[a-f0-9-]{36}$/);
  assert.equal(CARTESIA_MODEL, "sonic-3.6");
  assert.equal(CARTESIA_TTS_URL, "https://api.cartesia.ai/tts/bytes");
});

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

test("loadCartesiaApiKey loads key from environment or secrets.env gracefully", async () => {
  const key = await loadCartesiaApiKey();
  if (key) {
    assert.equal(typeof key, "string");
    assert.ok(key.length > 10);
  }
});

test("synthesizeShazVoice fails loudly when provider is cartesia without key or on Cartesia HTTP error (no Fish fallback)", async () => {
  const { VoiceSynthesisError } = await import("../runtime/voice.mjs");
  const envWithOnlyFish = { FISH_STUDIO_APIKEY: "fish-key-should-not-be-used" };

  await assert.rejects(
    async () =>
      synthesizeShazVoice({
        text: "Testing cartesia only enforcement.",
        outputPath: "/tmp/voice-cartesia-missing-test.wav",
        provider: "cartesia",
        apiKey: null,
        env: envWithOnlyFish,
        secretsPath: null,
      }),
    (err) => err instanceof VoiceSynthesisError && err.provider === "cartesia" && /CARTESIA_API_KEY IS MISSING/.test(err.message),
  );

  await assert.rejects(
    async () =>
      synthesizeShazVoice({
        text: "Testing cartesia http error.",
        outputPath: "/tmp/voice-cartesia-http-test.wav",
        provider: "cartesia",
        apiKey: "cartesia-mock-key",
        secretsPath: null,
        fetchFn: async () => ({
          ok: false,
          status: 402,
          text: async () => "insufficient credits",
        }),
      }),
    (err) => err instanceof VoiceSynthesisError && err.provider === "cartesia" && err.status === 402,
  );
});

