#!/usr/bin/env node
/**
 * Try the script room on real news WITHOUT making a video.
 * No voice, no render, no Telegram, no Buffer, no ledger writes.
 * Calls only NewsMCP, the article pages, and the pinned writer agent.
 *
 *   node tools/try-script-room.mjs            # 3 stories
 *   node tools/try-script-room.mjs --count 2
 *
 * Results: printed, and saved to <studio home>/script-room-trials/<timestamp>.json
 */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { fetchArticleForTopic } from "../article-fetch.mjs";
import { getDefaultStudioHome } from "../content-ledger.mjs";
import { runScriptRoom } from "../script-room.mjs";
import { buildStoryContext, findTopStories, loadStudioConfig } from "../studio-daily.mjs";
import { askActiveAgent } from "../../../v3/lib/agent-bridge.ts";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function show(label, d) {
  if (!d) return;
  console.log(`\n--- ${label} (angle: ${d.angle})`);
  console.log(d.text);
}

async function main() {
  const count = Number(arg("--count", 3));
  const cfg = await loadStudioConfig();
  console.log(`Writer: ${cfg.writerAgent}. Finding ${count} stories...`);
  const stories = await findTopStories({ count, config: cfg });
  if (!stories.length) throw new Error("NewsMCP returned no fresh stories.");

  const results = [];
  for (const story of stories) {
    if (results.filter((r) => r.ok).length >= count) break;
    const title = story.topic?.title;
    console.log(`\n\n================ ${title}`);
    try {
      const article = await fetchArticleForTopic(story.topic);
      const now = new Date();
      const t0 = Date.now();
      const { script, room } = await runScriptRoom(story.topic, {
        article,
        now,
        config: cfg,
        askAgentFn: askActiveAgent,
        storyContext: buildStoryContext(story.topic, { now, article }),
      });
      console.log(`(took ${Math.round((Date.now() - t0) / 1000)}s)`);
      for (const d of room.drafts) show("DRAFT", d);
      console.log("\nJUDGE:", JSON.stringify({ winner: room.judge.winner, runnerUp: room.judge.runnerUp, goodEnough: room.judge.goodEnough, notes: room.judge.rewriteNotes }));
      if (room.rewrite) console.log("REWRITTEN after notes:", room.rewrite.notes);
      show("WINNER", room.winner);
      show("RUNNER-UP", room.runnerUp);
      results.push({ ok: true, title, url: article.url, room, headline: script.headline });
    } catch (err) {
      console.log(`SKIPPED: ${err.message}`);
      results.push({ ok: false, title, error: err.message });
    }
  }

  const dir = path.join(getDefaultStudioHome(), "script-room-trials");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await fs.writeFile(file, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`\n\nSaved: ${file}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`try-script-room failed: ${err.message}`);
    process.exit(1);
  });
}
