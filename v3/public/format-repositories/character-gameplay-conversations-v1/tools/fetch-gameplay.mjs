#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

async function main() {
  const args = process.argv.slice(2);
  let query = '';
  let outPath = '';
  let duration = 60;
  let offset = 10;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--query=')) query = a.slice(8);
    else if (a.startsWith('--out=') || a.startsWith('--output=')) outPath = a.split('=')[1];
    else if (a.startsWith('--duration=')) duration = parseInt(a.slice(11), 10);
    else if (a.startsWith('--offset=')) offset = parseInt(a.slice(9), 10);
    else if (!query) query = a;
    else if (!outPath) outPath = a;
  }

  if (!query || !outPath) {
    console.error('Usage: node tools/fetch-gameplay.mjs "<gameplay query>" <output-path.mp4> [--duration=60] [--offset=10]');
    process.exit(1);
  }

  const fullOut = path.resolve(process.cwd(), outPath);
  await mkdir(path.dirname(fullOut), { recursive: true });

  console.log(`[fetch-gameplay] Searching YouTube for "${query}"...`);
  const ytDlpBin = '/opt/homebrew/bin/yt-dlp';
  
  const searchRes = await execFileAsync(ytDlpBin, [
    `ytsearch1:${query}`,
    '--print', '%(id)s | %(title)s | %(duration_string)s',
    '--no-playlist'
  ]);

  const line = searchRes.stdout.trim().split('\n')[0];
  if (!line || !line.includes('|')) {
    throw new Error(`No YouTube results found for "${query}"`);
  }

  const [id, title, dur] = line.split('|').map(s => s.trim());
  console.log(`[fetch-gameplay] Selected video: [${id}] "${title}" (${dur})`);

  const startSec = offset;
  const endSec = offset + duration;
  const startStr = `${Math.floor(startSec / 60)}:${String(startSec % 60).padStart(2, '0')}`;
  const endStr = `${Math.floor(endSec / 60)}:${String(endSec % 60).padStart(2, '0')}`;

  console.log(`[fetch-gameplay] Downloading clip section ${startStr}-${endStr} to ${outPath}...`);
  await execFileAsync(ytDlpBin, [
    `https://www.youtube.com/watch?v=${id}`,
    '--download-sections', `*${startStr}-${endStr}`,
    '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
    '--merge-output-format', 'mp4',
    '-o', fullOut,
    '--force-overwrites'
  ]);

  console.log(`[fetch-gameplay] Successfully downloaded and saved to ${outPath}`);
}

main().catch(err => {
  console.error('[fetch-gameplay] Error:', err.message);
  process.exit(1);
});
