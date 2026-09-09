import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('runner.mjs make executes cleanly with --dry-run for mugsy-explains', () => {
  const testRecipe = path.join(root, 'inputs/test-make-dry.json');
  try {
    const output = execFileSync(
      process.execPath,
      ['runner.mjs', 'make', '--target=mugsy-explains', `--recipe=${testRecipe}`, '--dry-run'],
      { cwd: root, encoding: 'utf8' }
    );

    assert.match(output, /Starting autonomous 1-click tutorial generator for: mugsy-explains/);
    assert.match(output, /TUTORIAL SCRIPT & RETENTION REPORT — ✅ PASS/);
    assert.match(output, /Skipped render/);

    assert.ok(existsSync(testRecipe), 'Must generate test recipe');
    const recipe = JSON.parse(readFileSync(testRecipe, 'utf8'));
    assert.equal(recipe.format.slug, 'mugsy-explains');
    assert.equal(recipe.steps[0].kind, 'hero');
    assert.equal(recipe.steps[0].nativeAudio, true);
  } finally {
    if (existsSync(testRecipe)) {
      try { unlinkSync(testRecipe); } catch {}
    }
  }
});

test('runner.mjs make supports --audience=developer', () => {
  const testRecipe = path.join(root, 'inputs/test-make-dev.json');
  try {
    const output = execFileSync(
      process.execPath,
      ['runner.mjs', 'make', '--target=mugsy-explains', '--audience=developer', `--recipe=${testRecipe}`, '--dry-run'],
      { cwd: root, encoding: 'utf8' }
    );

    assert.match(output, /audience: developer/);
    assert.ok(existsSync(testRecipe), 'Must generate test recipe');
    const recipe = JSON.parse(readFileSync(testRecipe, 'utf8'));
    assert.ok(recipe.audience.includes('engineer') || recipe.audience.includes('operator'));
  } finally {
    if (existsSync(testRecipe)) {
      try { unlinkSync(testRecipe); } catch {}
    }
  }
});
