import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

test('distribution.json exists and adheres to schemaVersion 1', () => {
  const distPath = path.join(repoRoot, 'inputs/distribution.json');
  assert.ok(existsSync(distPath), 'inputs/distribution.json must exist');
  const dist = JSON.parse(readFileSync(distPath, 'utf8'));
  assert.equal(dist.schemaVersion, 1);
  assert.ok(dist.platforms.youtube);
  assert.ok(dist.platforms.instagram);
  assert.ok(dist.platforms.twitter);
  assert.ok(dist.platforms.tiktok);
});

test('requirements.json declares Social Publisher with BUFFER_API_KEY', () => {
  const reqPath = path.join(repoRoot, 'requirements.json');
  const req = JSON.parse(readFileSync(reqPath, 'utf8'));
  const pub = req.providers?.find(p => p.name.includes('Social Publisher'));
  assert.ok(pub, 'requirements.json must declare Social Publisher');
  assert.ok(pub.environmentVariables?.includes('BUFFER_API_KEY'), 'Social Publisher must declare BUFFER_API_KEY');
});

test('publish.mjs validates inputs and executes cleanly in --dry-run mode', () => {
  const stdout = execFileSync('node', [
    'runtime/publish.mjs',
    'inputs/distribution.json',
    'goldens/transcript-guided-story-v1/final.mp4',
    '--dry-run'
  ], { cwd: repoRoot, encoding: 'utf8' });

  assert.match(stdout, /\[DRY-RUN\] Validated distribution package/);
  assert.match(stdout, /YOUTUBE: Ready for dispatch/);
  assert.match(stdout, /INSTAGRAM: Ready for dispatch/);
  assert.match(stdout, /TWITTER: Ready for dispatch/);
  assert.match(stdout, /TIKTOK: Ready for dispatch/);
});
