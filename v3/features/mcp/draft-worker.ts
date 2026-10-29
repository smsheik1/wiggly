import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { MemoryFilmLedger } from "./film-ledger";
import { savePhoto, signPhoto } from "./photo-store";

export const SEEDANCE_MODEL = "bytedance/seedance-2.5";
export const STILL_MODEL = "google/nano-banana";

export function replicateSetupError() {
  return [
    "Replicate is not connected. REPLICATE_API_TOKEN is missing, so the draft worker cannot render.",
    "1. Open https://replicate.com/account/api-tokens",
    "2. Copy the API token.",
    "3. Open secrets.env at the Wiggly repo root.",
    "4. Add a line: REPLICATE_API_TOKEN=r8_...",
    "5. Save the file and run the worker again.",
  ].join("\n");
}

export function stillPrompts(storyboard: { title: string; characters: Array<{ name: string }>; hero_props: Array<{ name: string }> }) {
  const names = [...storyboard.characters, ...storyboard.hero_props].map((item) => item.name.trim()).filter(Boolean);
  const who = names.join(", ") || storyboard.title.trim();
  return [
    ...names,
    `Contact sheet of ${who}. A 3 by 3 grid of the same subjects, consistent appearance, plain background.`,
  ];
}

export function seedanceBeatInput(beat: { action: string; camera: string; duration_sec: number }, imageUrls: string[]) {
  return {
    prompt: `${beat.action} Camera: ${beat.camera}`,
    duration: Math.max(1, Math.round(beat.duration_sec)),
    resolution: "480p" as const,
    aspect_ratio: "16:9" as const,
    reference_images: imageUrls,
    generate_audio: false,
  };
}

type PredictionPayload = {
  id?: string;
  status?: string;
  error?: string;
  detail?: string;
  output?: unknown;
  urls?: { get?: string };
};

function outputUrl(output: unknown) {
  if (typeof output === "string" && output.startsWith("http")) return output;
  if (Array.isArray(output)) {
    const found = output.find((item) => typeof item === "string" && item.startsWith("http"));
    if (typeof found === "string") return found;
  }
  return null;
}

async function postPrediction(
  fetchImpl: typeof fetch,
  token: string,
  model: string,
  input: Record<string, unknown>,
  wait: (ms: number) => Promise<void>,
) {
  const response = await fetchImpl(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=5",
    },
    body: JSON.stringify({ input }),
  });
  let payload = await response.json().catch(() => null) as PredictionPayload | null;
  if (!response.ok) {
    throw new Error(payload?.error || payload?.detail || `${model} failed with HTTP ${response.status}`);
  }
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const ready = outputUrl(payload?.output);
    if (ready && payload?.status !== "starting" && payload?.status !== "processing") return ready;
    if (payload?.status === "failed" || payload?.status === "canceled") {
      throw new Error(payload.error || payload.detail || `${model} ${payload.status}.`);
    }
    const pollUrl = payload?.urls?.get || (payload?.id ? `https://api.replicate.com/v1/predictions/${payload.id}` : "");
    if (!pollUrl) throw new Error(`${model} returned no output URL.`);
    await wait(5000);
    const next = await fetchImpl(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
    payload = await next.json().catch(() => null) as PredictionPayload | null;
    if (!next.ok) {
      throw new Error(payload?.error || payload?.detail || `${model} poll failed with HTTP ${next.status}`);
    }
  }
  throw new Error(`${model} was still processing after 15 minutes.`);
}

export function assembleFiles(files: string[], outputFile: string) {
  const list = files.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n");
  const listFile = `${outputFile}.txt`;
  return writeFile(listFile, list).then(() => new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outputFile], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", () => reject(new Error("ffmpeg is not installed. Install it with brew install ffmpeg, then run the worker again.")));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited ${code}`));
    });
  }));
}

export async function stepDraftJob(input: {
  ledger: MemoryFilmLedger;
  accountId: string;
  jobId: string;
  imageUrls: string[];
  token: string;
  fetchImpl?: typeof fetch;
  photoRoot?: string;
  photoSecret?: string;
  publicOrigin?: string;
  wait?: (ms: number) => Promise<void>;
}) {
  if (!input.token) throw new Error(replicateSetupError());
  const job = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId);
  if (!job?.storyboard) throw new Error("This job has no storyboard.");
  const fetchImpl = input.fetchImpl ?? fetch;
  const wait = input.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  if (job.stage === "queued") {
    input.ledger.setStage(input.accountId, input.jobId, "lineup");
    return "lineup";
  }
  try {
    if (job.stage === "lineup") {
      const subjects = stillPrompts(job.storyboard);
      for (const subject of subjects) {
        const url = await postPrediction(fetchImpl, input.token, STILL_MODEL, {
          prompt: subject,
          image_input: input.imageUrls,
        }, wait);
        input.ledger.addStillUrl(input.accountId, input.jobId, url);
      }
      input.ledger.setStage(input.accountId, input.jobId, "beats");
      return "beats";
    }
    if (job.stage === "beats") {
      const stills = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId)?.stillUrls ?? [];
      const references = stills.length > 0 ? stills : input.imageUrls;
      for (const beat of job.storyboard.beats) {
        const url = await postPrediction(fetchImpl, input.token, SEEDANCE_MODEL, seedanceBeatInput(beat, references), wait);
        input.ledger.addBeatUrl(input.accountId, input.jobId, url);
      }
      input.ledger.setStage(input.accountId, input.jobId, "assembly");
      return "assembly";
    }
    if (job.stage === "assembly") {
      const urls = input.ledger.exportState(input.accountId).jobs.find((item) => item.jobId === input.jobId)?.beatUrls ?? [];
      if (urls.length !== job.storyboard.beats.length) throw new Error("Assembly is missing a beat video.");
      const dir = await mkdtemp(path.join(tmpdir(), "wiggly-draft-"));
      const files: string[] = [];
      for (const [index, url] of urls.entries()) {
        const dest = path.join(dir, `${index}.mp4`);
        const response = await fetchImpl(url);
        if (!response.ok) throw new Error(`Beat download failed with HTTP ${response.status}`);
        await writeFile(dest, Buffer.from(await response.arrayBuffer()));
        files.push(dest);
      }
      const outputFile = path.join(dir, "draft.mp4");
      await assembleFiles(files, outputFile);
      if (!input.photoRoot || !input.photoSecret) {
        throw new Error("Set MCP_PHOTO_SECRET before a finished draft can be published. A local file path is not a video URL.");
      }
      const saved = await savePhoto(input.photoRoot, input.accountId, `draft-${input.jobId}.mp4`, await readFile(outputFile));
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const origin = input.publicOrigin ?? "https://wiggly.agentenamel.com";
      input.ledger.setStage(input.accountId, input.jobId, "ready", `${origin}${signPhoto(input.photoSecret, input.accountId, saved, expiresAt)}`);
      return "ready";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render failed.";
    input.ledger.failJob(input.accountId, input.jobId, message);
    return "failed";
  }
  return job.stage;
}
