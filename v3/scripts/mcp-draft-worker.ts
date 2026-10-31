import path from "node:path";
import { exportAccount, importAccount, listActiveJobs } from "../features/mcp/convex-ledger";
import { releasePreflight, runDraftTick, studioForFormat, type CrewPhoto } from "../features/mcp/draft-worker";
import { namedSecret } from "../features/mcp/named-secret";
import { signPhoto } from "../features/mcp/photo-store";

const studio = studioForFormat("my-pixar-story");
const openRouterKey = await namedSecret("OPENROUTER_API_KEY");
const replicateKey = await namedSecret("REPLICATE_API_TOKEN");
if (openRouterKey && !process.env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = openRouterKey;
if (replicateKey && !process.env.REPLICATE_API_TOKEN) process.env.REPLICATE_API_TOKEN = replicateKey;

try {
  await releasePreflight({
    studioDir: studio.directory,
    studioEntry: studio.entry,
    appDir: process.cwd(),
    openRouterKey,
    replicateKey,
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
    console.error("No queued, running, awaiting-approval, or awaiting-credits drafts.");
    return;
  }
  const lines = await runDraftTick({
    jobs: await Promise.all(jobs.map(async (job) => {
      const photos = await accountPhotos(job.workosUserId);
      return {
        accountId: job.workosUserId,
        jobId: job.jobId,
        imageUrls: photos.flatMap((photo) => photo.url ? [photo.url] : []),
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
