import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Searches DuckDuckGo Images with zero API keys, downloads the top high-res visual,
 * and formats it into a clean square proof card for Mugsy Explains.
 */
export async function searchDDG(query) {
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

export async function fetchProofImage(query, outPath, size = 500) {
  console.log(`[harvest] Searching DuckDuckGo for "${query}"...`);
  const imageUrl = await searchDDG(query);
  console.log(`[harvest] Found image: ${imageUrl}`);

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

  console.log(`[harvest] Saved proof card to ${outPath} (${size}x${size})`);
  return fullOut;
}

export async function autoHarvestLessonProofs(contentJsonPath, options = {}) {
  const fullPath = path.resolve(process.cwd(), contentJsonPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Cannot harvest proofs: ${contentJsonPath} does not exist`);
  }

  const content = JSON.parse(readFileSync(fullPath, 'utf8'));
  const lessons = content.lessons || [];
  const force = options.force || false;

  console.log(`[harvest] Harvesting proof images for "${content.title || 'Untitled'}" (${lessons.length} lessons)...`);

  const results = [];

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    console.log(`\n--- Lesson ${i + 1}: ${lesson.leftLabel} vs ${lesson.rightLabel} ---`);

    // Left visual
    const leftPath = path.resolve(process.cwd(), lesson.leftImage);
    if (force || !existsSync(leftPath)) {
      console.log(`[harvest] Fetching left proof: "${lesson.leftLabel}" -> ${lesson.leftImage}`);
      await fetchProofImage(lesson.leftLabel, lesson.leftImage, 500);
    } else {
      console.log(`[harvest] Left proof already exists: ${lesson.leftImage}`);
    }

    // Right visual
    const rightPath = path.resolve(process.cwd(), lesson.rightImage);
    if (force || !existsSync(rightPath)) {
      console.log(`[harvest] Fetching right proof: "${lesson.rightLabel}" -> ${lesson.rightImage}`);
      await fetchProofImage(lesson.rightLabel, lesson.rightImage, 500);
    } else {
      console.log(`[harvest] Right proof already exists: ${lesson.rightImage}`);
    }

    results.push({
      lessonIndex: i,
      leftLabel: lesson.leftLabel,
      leftImage: lesson.leftImage,
      rightLabel: lesson.rightLabel,
      rightImage: lesson.rightImage
    });
  }

  return results;
}
