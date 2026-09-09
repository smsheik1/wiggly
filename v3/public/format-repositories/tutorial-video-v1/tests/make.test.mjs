import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('runner.mjs make executes cleanly with --dry-run for mugsy-explains', () => {
  const output = execFileSync(
    process.execPath,
    ['runner.mjs', 'make', '--target=mugsy-explains', '--dry-run'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.match(output, /Starting autonomous 1-click tutorial generator for: mugsy-explains/);
  assert.match(output, /TUTORIAL SCRIPT & RETENTION REPORT — ✅ PASS/);
  assert.match(output, /Skipped render/);

  const inputPath = path.join(root, 'inputs/mugsy-explains.json');
  assert.ok(existsSync(inputPath), 'Must generate inputs/mugsy-explains.json');
  const recipe = JSON.parse(readFileSync(inputPath, 'utf8'));
  assert.equal(recipe.format.slug, 'mugsy-explains');
  assert.equal(recipe.steps[0].kind, 'hero');
  assert.equal(recipe.steps[0].nativeAudio, true);
});

test('runner.mjs make supports --audience=developer', () => {
  const output = execFileSync(
    process.execPath,
    ['runner.mjs', 'make', '--target=mugsy-explains', '--audience=developer', '--dry-run'],
    { cwd: root, encoding: 'utf8' }
  );

  assert.match(output, /audience: developer/);
  const inputPath = path.join(root, 'inputs/mugsy-explains.json');
  const recipe = JSON.parse(readFileSync(inputPath, 'utf8'));
  assert.ok(recipe.audience.includes('engineer') || recipe.audience.includes('operator'));
});
