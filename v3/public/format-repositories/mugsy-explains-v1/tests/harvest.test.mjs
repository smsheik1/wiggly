import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fetchProofImage } from '../runtime/harvest.mjs';

test('fetchProofImage searches DDG and downloads formatted 500x500 square proof card', async () => {
  const tmpOut = path.resolve('/tmp/test-harvest-proof.png');
  if (existsSync(tmpOut)) unlinkSync(tmpOut);

  try {
    const saved = await fetchProofImage('coffee cup', tmpOut, 500);
    assert.ok(existsSync(tmpOut), 'Must write proof card');

    const meta = await sharp(tmpOut).metadata();
    assert.equal(meta.width, 500);
    assert.equal(meta.height, 500);
    assert.equal(meta.format, 'png');
  } finally {
    if (existsSync(tmpOut)) {
      try { unlinkSync(tmpOut); } catch {}
    }
  }
});
