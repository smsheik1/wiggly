import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Official cloned voice model for creator Shaz (trained on 30s studio audio with ground-truth transcript)
export const SHAZ_VOICE_ID = "947a3b8d8a2c431a8a2934008d89d5b3";
export const FISH_TTS_URL = "https://api.fish.audio/v1/tts";
export const FISH_MODEL = "s2.1-pro-free";

/**
 * Loads FISH_STUDIO_APIKEY from process.env or secrets.env in memory.
 */
export async function loadFishApiKey() {
  if (process.env.FISH_STUDIO_APIKEY?.trim()) {
    return process.env.FISH_STUDIO_APIKEY.trim();
  }

  const candidatePaths = [
    path.join(root, "secrets.env"),
    path.join(root, "../secrets.env"),
    path.join(root, "../../secrets.env"),
    path.join(root, "../../../secrets.env"),
    path.join(root, "../../../../secrets.env"),
  ];

  for (const candidate of candidatePaths) {
    try {
      const content = await fs.readFile(candidate, "utf8");
      const match = content.match(/FISH_STUDIO_APIKEY=([^\r\n]+)/);
      if (match && match[1].trim()) return match[1].trim();
    } catch {}
  }

  return null;
}

/**
 * Synthesizes speech using the cloned Shaz voice model.
 * Automatically normalizes the resulting WAV via ffmpeg into clean 44.1kHz mono PCM
 * to ensure 100% compatibility with Cherry WASI lip-sync and Whisper.
 *
 * @param {Object} options
 * @param {string} options.text - Dialogue text to synthesize
 * @param {string} options.outputPath - Destination path for the WAV audio
 * @param {string} [options.voiceId=SHAZ_VOICE_ID] - Fish Audio voice reference ID
 * @param {number} [options.speed=1.05] - Speaking rate multiplier
 * @param {string} [options.apiKey] - Optional explicit Fish Audio API key
 * @returns {Promise<{ outputPath: string, durationSeconds: number, voiceId: string }>}
 */
export async function synthesizeShazVoice({
  text,
  outputPath,
  voiceId = SHAZ_VOICE_ID,
  speed = 1.05,
  apiKey: explicitApiKey,
}) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("synthesizeShazVoice requires non-empty text");
  }
  if (!outputPath || typeof outputPath !== "string") {
    throw new Error("synthesizeShazVoice requires an outputPath");
  }

  const apiKey = explicitApiKey || (await loadFishApiKey());
  if (!apiKey) {
    throw new Error("FISH_STUDIO_APIKEY is required for voice synthesis. Check secrets.env.");
  }

  const fullOutputPath = path.resolve(process.cwd(), outputPath);
  await fs.mkdir(path.dirname(fullOutputPath), { recursive: true });

  const rawWavPath = path.join(
    path.dirname(fullOutputPath),
    `.raw-${path.basename(fullOutputPath)}`,
  );

  const res = await fetch(FISH_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      model: FISH_MODEL,
    },
    body: JSON.stringify({
      text: text.trim(),
      reference_id: voiceId,
      format: "wav",
      normalize: true,
      prosody: { speed, volume: 0 },
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Fish Audio synthesis failed with HTTP ${res.status}: ${errorBody.slice(0, 240)}`);
  }

  const rawBuffer = Buffer.from(await res.arrayBuffer());
  if (rawBuffer.length < 64) {
    throw new Error("Fish Audio returned an empty or invalid audio payload");
  }

  await fs.writeFile(rawWavPath, rawBuffer);

  // Normalize stream headers and chunk sizes via ffmpeg for Cherry WASI lip-sync compatibility
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", rawWavPath,
      "-c:a", "pcm_s16le",
      "-ar", "44100",
      "-ac", "1",
      fullOutputPath,
    ]);
  } finally {
    await fs.rm(rawWavPath, { force: true });
  }

  // Probe duration
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    fullOutputPath,
  ]);

  const durationSeconds = parseFloat(stdout.trim());

  return {
    outputPath: fullOutputPath,
    durationSeconds,
    voiceId,
  };
}

// CLI usage: node runtime/voice.mjs --text="..." --output="path.wav"
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let text = "";
  let outputPath = "";

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--text=")) text = arg.slice(7);
    else if (arg.startsWith("--output=")) outputPath = arg.slice(9);
    else if (arg.startsWith("--out=")) outputPath = arg.slice(6);
  }

  if (!text || !outputPath) {
    console.error("Usage: node runtime/voice.mjs --text=\"What is going on guys?\" --output=dialogue.wav");
    process.exit(1);
  }

  synthesizeShazVoice({ text, outputPath })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error("Voice synthesis failed:", err.message);
      process.exit(1);
    });
}
