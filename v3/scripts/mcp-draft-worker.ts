import { readFile } from "node:fs/promises";
import path from "node:path";
import { exportAccount, importAccount, listActiveJobs } from "../features/mcp/convex-ledger";
import { releasePreflight, runDraftTick, studioForFormat, type CrewPhoto } from "../features/mcp/draft-worker";
import { signPhoto } from "../features/mcp/photo-store";

async function namedSecret(name: string) {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  const pattern = new RegExp(`^${name}=([^\\r\\n]+)`, "m");
  for (const root of [process.cwd(), path.join(process.cwd(), "..")]) {
    try {
      const content = await readFile(path.join(root, "secrets.env"), "utf8");
      const match = content.match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    } catch {
      // The next directory may hold the file.
    }
  }
  return "";
}

const studio = studioForFormat("my-pixar-story");
try {
  await releasePreflight({
    studioDir: studio.directory,
    studioEntry: studio.entry,
    appDir: process.cwd(),
    openRouterKey: await namedSecret("OPENROUTER_API_KEY"),
    replicateKey: await namedSecret("REPLICATE_API_TOKEN"),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "The draft worker cannot start.");
  process.exit(1);
}

const photoSecret = process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET || "";
const photoRoot = path.join(process.cwd(), "data", "mcp-uploads");
const origin = "https://wiggly.agentenamel.com";
const watch = process.argv.includes("--watch");

async function accountPhotos(accountId: string): Promise<CrewPhoto[]> {
  const account = await exportAccount(accountId);
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
  return (account.photos ?? []).map((photo) => ({
    label: photo.label,
    path: path.join(photoRoot, accountId, photo.filename),
    url: `${origin}${signPhoto(photoSecret, accountId, photo.filename, expiresAt)}`,
  }));
}

async function tick() {
  const jobs = await listActiveJobs();
  if (jobs.length === 0) {
    console.error("No queued, running, or awaiting-approval drafts.");
    return;
  }
  const lines = await runDraftTick({
    jobs: await Promise.all(jobs.map(async (job) => {
      const photos = await accountPhotos(job.workosUserId);
      return {
        accountId: job.workosUserId,
        jobId: job.jobId,
        imageUrls: photos.map((photo) => photo.url),
        photos,
      };
    })),
    loadAccount: exportAccount,
    saveAccount: importAccount,
  });
  for (const line of lines) console.error(line);
}

if (!photoSecret) {
  console.error("Set MCP_PHOTO_SECRET or SESSION_SECRET before the draft worker can publish a video URL.");
  process.exit(1);
}

do {
  await tick();
  if (!watch) break;
  await new Promise((resolve) => setTimeout(resolve, 20000));
} while (watch);
