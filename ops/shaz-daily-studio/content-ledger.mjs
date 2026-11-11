import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LEDGER_PATH = path.resolve(__dirname, "../../v3/public/format-repositories/shaz-puppet-runtime-v1/agent-runs/published-topics.json");

/**
 * Loads the topic ledger from disk.
 */
export async function loadLedger(ledgerPath = DEFAULT_LEDGER_PATH) {
  const resolved = path.resolve(ledgerPath);
  if (!fsSync.existsSync(resolved)) {
    return [];
  }
  try {
    const raw = await fs.readFile(resolved, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Checks whether a topic was already covered.
 */
export function isTopicCovered(topic, ledger) {
  if (!topic || !Array.isArray(ledger)) return false;
  const normTitle = (topic.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const link = topic.link || "";

  return ledger.some((entry) => {
    if (link && entry.link && entry.link === link) return true;
    const entryNorm = (entry.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normTitle && entryNorm && (normTitle === entryNorm || entryNorm.includes(normTitle) || normTitle.includes(entryNorm))) {
      return true;
    }
    return false;
  });
}

/**
 * Filters a list of scouted candidates down to fresh ones.
 */
export function filterFreshTopics(candidates, ledger) {
  return candidates.filter((item) => !isTopicCovered(item, ledger));
}

/**
 * Records a freshly produced topic into the ledger.
 */
export async function recordTopic(topic, { runId, postId }, ledgerPath = DEFAULT_LEDGER_PATH) {
  const resolved = path.resolve(ledgerPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });

  const ledger = await loadLedger(resolved);
  ledger.push({
    title: topic.title || "Untitled",
    link: topic.link || "",
    author: topic.author || "",
    runId,
    postId: postId || null,
    publishedAt: new Date().toISOString(),
  });

  await fs.writeFile(resolved, JSON.stringify(ledger, null, 2) + "\n");
  return ledger;
}
