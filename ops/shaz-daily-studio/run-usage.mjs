import fs from "node:fs/promises";
import path from "node:path";

/**
 * Creates a mutable external-provider usage tracker for a candidate run.
 * Tracks actual calls across studio and kit stages instead of hard-coding "$0".
 */
export function createRunUsageTracker({ runId, writerAgent = null, startedAt = null } = {}) {
  const providers = {
    newsMcp: { calls: 0 },
    articleFetch: { calls: 0 },
    agentWriter: { calls: 0, attempts: 0, ...(writerAgent ? { agent: writerAgent } : {}) },
    cartesia: { calls: 0, characters: 0 },
    jev: { calls: 0 },
    serper: { queries: 0, downloads: 0 },
    telegram: { calls: 0 },
    convex: { uploads: 0, deletes: 0 },
    buffer: { creates: 0, statuses: 0 },
  };

  return {
    recordNewsMcp(calls = 1) {
      providers.newsMcp.calls += Math.max(0, Number(calls) || 0);
    },
    recordArticleFetch(calls = 1) {
      providers.articleFetch.calls += Math.max(0, Number(calls) || 0);
    },
    recordAgentWriter({ calls = 1, attempts = 1, agent = writerAgent } = {}) {
      providers.agentWriter.calls += Math.max(0, Number(calls) || 0);
      providers.agentWriter.attempts += Math.max(0, Number(attempts) || 0);
      if (agent) providers.agentWriter.agent = agent;
    },
    recordCartesia({ calls = 1, characters = 0 } = {}) {
      providers.cartesia.calls += Math.max(0, Number(calls) || 0);
      providers.cartesia.characters += Math.max(0, Number(characters) || 0);
    },
    recordJev(calls = 0) {
      providers.jev.calls += Math.max(0, Number(calls) || 0);
    },
    setJev(calls = 0) {
      providers.jev.calls = Math.max(0, Number(calls) || 0);
    },
    recordSerper({ queries = 0, downloads = 0 } = {}) {
      providers.serper.queries += Math.max(0, Number(queries) || 0);
      providers.serper.downloads += Math.max(0, Number(downloads) || 0);
    },
    recordTelegram(calls = 1) {
      providers.telegram.calls += Math.max(0, Number(calls) || 0);
    },
    recordConvex({ uploads = 0, deletes = 0 } = {}) {
      providers.convex.uploads += Math.max(0, Number(uploads) || 0);
      providers.convex.deletes += Math.max(0, Number(deletes) || 0);
    },
    recordBuffer({ creates = 0, statuses = 0 } = {}) {
      providers.buffer.creates += Math.max(0, Number(creates) || 0);
      providers.buffer.statuses += Math.max(0, Number(statuses) || 0);
    },
    snapshot() {
      const totalExternalCalls =
        providers.newsMcp.calls +
        providers.articleFetch.calls +
        providers.agentWriter.calls +
        providers.cartesia.calls +
        providers.jev.calls +
        providers.serper.queries +
        providers.serper.downloads +
        providers.telegram.calls +
        providers.convex.uploads +
        providers.convex.deletes +
        providers.buffer.creates +
        providers.buffer.statuses;

      return {
        schemaVersion: 1,
        runId,
        ...(startedAt ? { startedAt } : {}),
        recordedAt: new Date().toISOString(),
        totalExternalCalls,
        providers: structuredClone(providers),
      };
    },
  };
}

/**
 * Reads recorded Jev call count from the kit's validation-receipt.json, state.json, or render-report.json.
 */
export async function readKitJevCalls(runDirectory) {
  for (const name of ["validation-receipt.json", "render-report.json", "state.json"]) {
    try {
      const data = JSON.parse(await fs.readFile(path.join(runDirectory, name), "utf8"));
      if (Number.isFinite(Number(data?.director?.jevCalls))) {
        return Number(data.director.jevCalls);
      }
      if (Number.isFinite(Number(data?.providerBreakdown?.jev))) {
        return Number(data.providerBreakdown.jev);
      }
      if (Number.isFinite(Number(data?.providerCalls))) {
        return Number(data.providerCalls);
      }
    } catch {}
  }
  return 0;
}

/**
 * Reads Serper query and download counts recorded in a run's media-sources.json telemetry block.
 */
export async function readMediaSourcingUsage(dirPath) {
  try {
    const data = JSON.parse(await fs.readFile(path.join(dirPath, "media-sources.json"), "utf8"));
    const queries = Number(data?.telemetry?.serperQueries);
    const downloads = Number(data?.telemetry?.serperDownloads);
    if (Number.isFinite(queries) || Number.isFinite(downloads)) {
      return {
        queries: Number.isFinite(queries) ? queries : 0,
        downloads: Number.isFinite(downloads) ? downloads : 0,
      };
    }
    const items = Array.isArray(data?.items) ? data.items : [];
    const serperItems = items.filter((item) => item?.origin === "serper").length;
    return { queries: 0, downloads: serperItems };
  } catch {
    return { queries: 0, downloads: 0 };
  }
}

/**
 * Writes `<runDirectory>/run-usage.json`.
 */
export async function writeRunUsage(runDirectory, snapshot, { writeJsonFn } = {}) {
  const targetPath = path.join(runDirectory, "run-usage.json");
  if (writeJsonFn) {
    await writeJsonFn(targetPath, snapshot);
  } else {
    await fs.mkdir(runDirectory, { recursive: true });
    await fs.writeFile(targetPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }
  return targetPath;
}

/**
 * Loads `<runDirectory>/run-usage.json` if present, applies an incremental updater to `providers`,
 * recomputes `totalExternalCalls` and `recordedAt`, and persists the updated JSON file.
 */
export async function updateRunUsage(runDirectory, updater, { writeJsonFn } = {}) {
  const targetPath = path.join(runDirectory, "run-usage.json");
  let current = null;
  try {
    current = JSON.parse(await fs.readFile(targetPath, "utf8"));
  } catch {}
  if (!current || !current.providers) {
    current = createRunUsageTracker({ runId: path.basename(runDirectory) }).snapshot();
  }
  updater(current.providers);
  const p = current.providers;
  current.recordedAt = new Date().toISOString();
  current.totalExternalCalls =
    (p.newsMcp?.calls || 0) +
    (p.articleFetch?.calls || 0) +
    (p.agentWriter?.calls || 0) +
    (p.cartesia?.calls || 0) +
    (p.jev?.calls || 0) +
    (p.serper?.queries || 0) +
    (p.serper?.downloads || 0) +
    (p.telegram?.calls || 0) +
    (p.convex?.uploads || 0) +
    (p.convex?.deletes || 0) +
    (p.buffer?.creates || 0) +
    (p.buffer?.statuses || 0);
  return writeRunUsage(runDirectory, current, { writeJsonFn });
}
