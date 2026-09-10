#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fetchProofImage } from './fetch-proof.mjs';

/**
 * Automatically inspects content.json and harvests all 6 proof images
 * for the 3 comparative lessons using DuckDuckGo image search with 0 API keys.
 */
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const contentFile = args.find(a => !a.startsWith('--')) || 'content.json';
  const fullContentPath = path.resolve(process.cwd(), contentFile);

  if (!existsSync(fullContentPath)) {
    console.error(`[auto-fetch-proofs] Could not find ${contentFile}`);
    process.exit(1);
  }

  const content = JSON.parse(readFileSync(fullContentPath, 'utf8'));
  const lessons = content.lessons || [];

  console.log(`[auto-fetch-proofs] Harvesting proof images for "${content.title || 'Untitled'}" (${lessons.length} lessons)...`);

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    console.log(`\n--- Lesson ${i + 1}: ${lesson.leftLabel} vs ${lesson.rightLabel} ---`);

    // Left visual
    const leftPath = path.resolve(process.cwd(), lesson.leftImage);
    if (force || !existsSync(leftPath)) {
      console.log(`[auto-fetch-proofs] Fetching left proof: "${lesson.leftLabel}" -> ${lesson.leftImage}`);
      await fetchProofImage(lesson.leftLabel, lesson.leftImage, 500);
    } else {
      console.log(`[auto-fetch-proofs] Left proof exists: ${lesson.leftImage}`);
    }

    // Right visual
    const rightPath = path.resolve(process.cwd(), lesson.rightImage);
    if (force || !existsSync(rightPath)) {
      console.log(`[auto-fetch-proofs] Fetching right proof: "${lesson.rightLabel}" -> ${lesson.rightImage}`);
      await fetchProofImage(lesson.rightLabel, lesson.rightImage, 500);
    } else {
      console.log(`[auto-fetch-proofs] Right proof exists: ${lesson.rightImage}`);
    }
  }

  console.log('\n[auto-fetch-proofs] ✅ All proof images harvested successfully!');
}

main().catch(err => {
  console.error(`[auto-fetch-proofs] Failed: ${err.message}`);
  process.exit(1);
});
