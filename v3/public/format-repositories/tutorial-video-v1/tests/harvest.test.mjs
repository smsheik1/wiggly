import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { harvestTargetAssets, resolveFormatMetadata } from '../runtime/harvest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('resolveFormatMetadata resolves known and local formats', () => {
  const meta = resolveFormatMetadata('mugsy-explains');
  assert.equal(meta.name, 'Mugsy Explains');
  assert.equal(meta.slug, 'mugsy-explains');
  assert.ok(meta.promise.length > 10);
  assert.equal(meta.outputLabel, 'mugsy-explains.mp4');

  const arkham = resolveFormatMetadata('character-gameplay-conversations');
  assert.equal(arkham.name, 'Batman Arkham Conversations');
  assert.equal(arkham.slug, 'character-gameplay-conversations');
});

test('harvestTargetAssets harvests valid video, browser and terminal stills for mugsy-explains', async () => {
  const result = await harvestTargetAssets({ targetSlug: 'mugsy-explains', repoRoot: root });
  assert.ok(result);
  assert.equal(result.format.slug, 'mugsy-explains');

  // Verify proof video
  assert.ok(existsSync(result.media.proofVideo.fullPath));
  assert.equal(result.media.proofVideo.type, 'video');
  assert.equal(result.media.proofVideo.authorized, true);

  // Verify browser image dimensions
  assert.ok(existsSync(result.media.browserStill.fullPath));
  const browserMeta = await sharp(result.media.browserStill.fullPath).metadata();
  assert.equal(browserMeta.width, 1920);
  assert.equal(browserMeta.height, 1080);

  // Verify terminal image dimensions
  assert.ok(existsSync(result.media.terminalStill.fullPath));
  const terminalMeta = await sharp(result.media.terminalStill.fullPath).metadata();
  assert.equal(terminalMeta.width, 1920);
  assert.equal(terminalMeta.height, 1080);
});

test('harvest.mjs CLI executes cleanly', () => {
  const output = execFileSync(
    process.execPath,
    ['runtime/harvest.mjs', '--target=mugsy-explains'],
    { cwd: root, encoding: 'utf8' }
  );
  assert.match(output, /Successfully harvested assets to media\/mugsy-explains/);
});
