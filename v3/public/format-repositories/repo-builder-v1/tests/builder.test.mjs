import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeReferenceVideo, ARCHETYPES, probeMedia } from '../runtime/analyze.mjs';
import { harvestAllAssets } from '../runtime/harvest-assets.mjs';
import { generateFullRuntime } from '../runtime/generate-runtime.mjs';
import { scaffoldChildKit } from '../runtime/scaffold-skill.mjs';
import { proveChildRepo } from '../runtime/prove-repo.mjs';

const SAMPLE_VIDEO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../mugsy-explains-v1/references/original/mugsyclips_Da5cRx2sKhl.mp4'
);

test('probeMedia extracts accurate stream metadata', () => {
  const meta = probeMedia(SAMPLE_VIDEO);
  assert.equal(meta.isVertical, true);
  assert.equal(meta.hasAudio, true);
  assert.ok(meta.durationSeconds > 0);
  assert.ok(meta.width > 0);
  assert.ok(meta.height > 0);
});

test('analyzeReferenceVideo generates structured format recipe', async () => {
  const recipe = await analyzeReferenceVideo(SAMPLE_VIDEO, {
    slug: 'test-mugsy',
    title: 'Test Mugsy Explains'
  });

  assert.equal(recipe.schemaVersion, 1);
  assert.equal(recipe.slug, 'test-mugsy');
  assert.equal(recipe.title, 'Test Mugsy Explains');
  assert.ok(recipe.structure.archetype);
  assert.ok(recipe.structure.typography.fontFamily);
  assert.ok(recipe.structure.retentionFormula);
});

test('builder pipeline generates, scaffolds, and proves child repository', async (t) => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'wiggly-builder-test-'));
  t.after(() => {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {}
  });

  const recipe = await analyzeReferenceVideo(SAMPLE_VIDEO, {
    slug: 'auto-explainer',
    title: 'Auto Explainer'
  });

  // 1. Harvest assets
  const assets = await harvestAllAssets(SAMPLE_VIDEO, workDir, recipe, { skipTrain: true });
  assert.ok(existsSync(path.join(workDir, 'assets/voice/voice.json')));
  assert.ok(existsSync(path.join(workDir, 'assets/fonts/PatrickHand-Regular.ttf')));
  assert.ok(existsSync(path.join(workDir, 'assets/poses/coffee-explain.png')));

  // 2. Generate runtime
  await generateFullRuntime(recipe, assets, workDir);
  assert.ok(existsSync(path.join(workDir, 'runner.mjs')));
  assert.ok(existsSync(path.join(workDir, 'runtime/auto-explainer.jsx')));
  assert.ok(existsSync(path.join(workDir, 'runtime/index.jsx')));
  assert.ok(existsSync(path.join(workDir, 'runtime/root.jsx')));
  assert.ok(existsSync(path.join(workDir, 'runtime/critique.mjs')));
  assert.ok(existsSync(path.join(workDir, 'content.json')));

  // 3. Scaffold kit and SKILL.md
  await scaffoldChildKit(recipe, workDir);
  const skill = readFileSync(path.join(workDir, 'SKILL.md'), 'utf8');
  assert.ok(skill.includes('Interactive Q&A Intake Law'));
  assert.ok(skill.includes('Turbo Mode'));

  const pkg = JSON.parse(readFileSync(path.join(workDir, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'wiggly-auto-explainer-format-kit');
  assert.ok(pkg.scripts.doctor);
  assert.ok(pkg.scripts.smoke);

  const manifest = JSON.parse(readFileSync(path.join(workDir, 'KIT-MANIFEST.json'), 'utf8'));
  assert.equal(manifest.intakeLaw, 'interactive-qa-turbo');

  // 4. Prove child repo (tests + doctor)
  const proof = await proveChildRepo(workDir, { smokeRender: false });
  assert.equal(proof.status, 'proven');
  assert.equal(proof.checks.structure, true);
  assert.equal(proof.checks.critiqueTest, true);
  assert.equal(proof.checks.doctor, true);
});

test('CLI build command executes end-to-end with --skip-prove', (t) => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = mkdtempSync(path.join(tmpdir(), 'wiggly-cli-test-'));
  t.after(() => {
    try {
      rmSync(outDir, { recursive: true, force: true });
    } catch {}
  });

  const cli = path.join(root, 'bin/wiggly-repo-builder.mjs');
  const stdout = execFileSync('node', [
    cli,
    'build',
    '--source', SAMPLE_VIDEO,
    '--output', outDir,
    '--slug', 'cli-format',
    '--title', 'CLI Format',
    '--skip-prove'
  ], { encoding: 'utf8' });

  const jsonStart = stdout.indexOf('{\n  "status":');
  const jsonString = jsonStart !== -1 ? stdout.slice(jsonStart) : stdout;
  const result = JSON.parse(jsonString.trim());
  assert.equal(result.status, 'built');
  assert.equal(result.formatSlug, 'cli-format');
  assert.ok(existsSync(path.join(outDir, 'SKILL.md')));
  assert.ok(existsSync(path.join(outDir, 'runner.mjs')));
});
