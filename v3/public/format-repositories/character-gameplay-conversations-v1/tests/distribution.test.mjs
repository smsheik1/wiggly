import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('pipeline.json includes distribute-episode stage with approvalRequired', async () => {
  const pipeline = JSON.parse(await readFile(path.join(root, 'pipeline.json'), 'utf8'));
  const stage = pipeline.stages.find(s => s.id === 'distribute-episode');
  assert.ok(stage, 'distribute-episode stage must exist in pipeline.json');
  assert.equal(stage.approvalRequired, true, 'distribute-episode stage must require human approval');
});

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
    'proofs/crossover-0.1.4.mp4'
  ], { cwd: root, encoding: 'utf8' });

  assert.match(stdout, /\[DRY-RUN\] Validated distribution package/);
  assert.match(stdout, /YOUTUBE: Ready for dispatch/);
  assert.match(stdout, /INSTAGRAM: Ready for dispatch/);
  assert.match(stdout, /TWITTER: Ready for dispatch/);
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
        'proofs/crossover-0.1.4.mp4'
      ], { cwd: root, encoding: 'utf8' });
    }, /Twitter\/X text exceeds 280 characters/);
  } finally {
    if (existsSync(tempConfigPath)) {
      await unlink(tempConfigPath);
    }
  }
});
