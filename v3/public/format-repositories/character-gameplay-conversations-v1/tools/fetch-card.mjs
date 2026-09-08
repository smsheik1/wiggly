#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

async function searchDDG(query) {
  const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
  const html = await tokenRes.text();
  const vqdMatch = html.match(/vqd=([\d-]+)/);
  if (!vqdMatch) throw new Error(`Could not obtain search token for "${query}"`);
  const vqd = vqdMatch[1];

  const apiRes = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!apiRes.ok) throw new Error(`DDG API error (${apiRes.status})`);
  const data = await apiRes.json();
  const top = (data.results || []).find(r => r.image && !r.image.endsWith('.svg'));
  if (!top) throw new Error(`No image results found for "${query}"`);
  return top.image;
}

async function main() {
  const args = process.argv.slice(2);
  let query = '';
  let outPath = '';
  let size = 400;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--query=')) query = a.slice(8);
    else if (a.startsWith('--out=') || a.startsWith('--output=')) outPath = a.split('=')[1];
    else if (a.startsWith('--size=')) size = parseInt(a.slice(7), 10);
    else if (!query) query = a;
    else if (!outPath) outPath = a;
  }

  if (!query || !outPath) {
    console.error('Usage: node tools/fetch-card.mjs "<query>" <output-path> [--size=400]');
    process.exit(1);
  }

  console.log(`[fetch-card] Searching for "${query}"...`);
  const imageUrl = await searchDDG(query);
  console.log(`[fetch-card] Found image: ${imageUrl}`);

  const imgRes = await fetch(imageUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!imgRes.ok) throw new Error(`Failed to download image (${imgRes.status}): ${imageUrl}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());

  const fullOut = path.resolve(process.cwd(), outPath);
  await mkdir(path.dirname(fullOut), { recursive: true });

  await sharp(buf)
    .resize(size, size, { fit: 'cover', position: 'center' })
    .png()
    .toFile(fullOut);

  console.log(`[fetch-card] Saved square card to ${outPath} (${size}x${size})`);
}

main().catch(err => {
  console.error('[fetch-card] Error:', err.message);
  process.exit(1);
});
