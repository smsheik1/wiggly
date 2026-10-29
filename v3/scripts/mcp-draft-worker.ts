import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { exportAccount, importAccount, listActiveJobs } from "../features/mcp/convex-ledger";
import { replicateSetupError, runDraftTick } from "../features/mcp/draft-worker";
import { signPhoto } from "../features/mcp/photo-store";

async function token() {
  if (process.env.REPLICATE_API_TOKEN?.trim()) return process.env.REPLICATE_API_TOKEN.trim();
  for (const root of [process.cwd(), path.join(process.cwd(), "..")]) {
    try {
      const content = await readFile(path.join(root, "secrets.env"), "utf8");
      const match = content.match(/^REPLICATE_API_TOKEN=([^\r\n]+)/m);
      if (match?.[1]?.trim()) return match[1].trim();
    } catch {
      // The next directory may hold the file.
    }
  }
  return "";
}

const replicateToken = await token();
if (!replicateToken) {
  console.error(replicateSetupError());
  process.exit(1);
}

const photoSecret = process.env.MCP_PHOTO_SECRET || process.env.SESSION_SECRET || "";
const photoRoot = path.join(process.cwd(), "data", "mcp-uploads");
const origin = "https://wiggly.agentenamel.com";
const watch = process.argv.includes("--watch");

async function signedPhotoUrls(accountId: string) {
  let names: string[] = [];
  try {
    names = await readdir(path.join(photoRoot, accountId));
  } catch {
    return [];
  }
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
  return names
    .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
    .map((name) => `${origin}${signPhoto(photoSecret, accountId, name, expiresAt)}`);
}

async function tick() {
  const jobs = await listActiveJobs();
  if (jobs.length === 0) {
    console.error("No queued, running, or awaiting-approval drafts.");
    return;
  }
  const lines = await runDraftTick({
    jobs: await Promise.all(jobs.map(async (job) => ({
      accountId: job.workosUserId,
      jobId: job.jobId,
      imageUrls: await signedPhotoUrls(job.workosUserId),
    }))),
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
