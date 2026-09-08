import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('requirements.json declares social publisher provider without secrets', async () => {
  const reqs = JSON.parse(await readFile(path.join(root, 'requirements.json'), 'utf8'));
  const provider = reqs.providers.find(p => p.name.includes('Social Publisher'));
  assert.ok(provider, 'Social Publisher must be declared under providers');
  assert.equal(provider.optional, true, 'Publisher should be optional for local renders');
  const envVars = provider.environmentVariables || (provider.environmentVariable ? [provider.environmentVariable] : []) || provider.env || [];
  assert.ok(envVars.includes('BUFFER_API_KEY'));
});

test('publish.mjs validates inputs and executes cleanly in --dry-run mode', () => {
  const stdout = execFileSync('node', [
    'runtime/publish.mjs',
    '--dry-run',
    'inputs/distribution.json',
    'examples/i-made-a-mistake/evidence/final.mp4'
  ], { cwd: root, encoding: 'utf8' });

  assert.match(stdout, /\[DRY-RUN\] Validated distribution package/);
  assert.match(stdout, /YOUTUBE: Ready for dispatch/);
  assert.match(stdout, /INSTAGRAM: Ready for dispatch/);
  assert.match(stdout, /TWITTER: Ready for dispatch/);
  assert.match(stdout, /TIKTOK: Ready for dispatch/);
});

test('publish.mjs rejects missing media file', () => {
  assert.throws(() => {
    execFileSync('node', [
      'runtime/publish.mjs',
      'inputs/distribution.json',
      'outputs/non-existent.mp4'
    ], { cwd: root, encoding: 'utf8' });
  }, /Media file not found/);
});

test('publish.mjs enforces platform character constraints', async () => {
  const tempConfigPath = path.join(root, 'inputs/test-invalid-dist.json');
  const base = JSON.parse(await readFile(path.join(root, 'inputs/distribution.json'), 'utf8'));
  base.platforms.twitter.text = 'A'.repeat(300); // Exceeds 280

  await writeFile(tempConfigPath, JSON.stringify(base, null, 2));

  try {
    assert.throws(() => {
      execFileSync('node', [
        'runtime/publish.mjs',
        '--dry-run',
        'inputs/test-invalid-dist.json',
        'examples/i-made-a-mistake/evidence/final.mp4'
      ], { cwd: root, encoding: 'utf8' });
    }, /Twitter\/X text exceeds 280 characters/);
  } finally {
    if (existsSync(tempConfigPath)) {
      await unlink(tempConfigPath);
    }
  }
});

test('publish.mjs generates unconfigured_environment receipt without BUFFER_API_KEY', async () => {
  const receiptPath = path.join(root, 'examples/i-made-a-mistake/evidence/final.mp4.distribution.json');
  if (existsSync(receiptPath)) {
    await unlink(receiptPath);
  }

  try {
    const stdout = execFileSync('node', [
      'runtime/publish.mjs',
      'inputs/distribution.json',
      'examples/i-made-a-mistake/evidence/final.mp4'
    ], { 
      cwd: root, 
      encoding: 'utf8',
      env: { ...process.env, BUFFER_API_KEY: '' }
    });

    assert.match(stdout, /No live BUFFER_API_KEY found in environment/);
    assert.ok(existsSync(receiptPath), 'Distribution receipt must be created');
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
    assert.equal(receipt.status, 'unconfigured_environment');
    assert.equal(receipt.mediaSha256, '189eafcb00e3b9fc553bc4d181a2a3704cea052c368ff9517ce1701c7b2c3701');
  } finally {
    if (existsSync(receiptPath)) {
      await unlink(receiptPath);
    }
  }
});
