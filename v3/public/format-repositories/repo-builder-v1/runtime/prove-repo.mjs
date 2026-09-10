import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeMedia } from './analyze.mjs';

/**
 * Prove Child Repo in an isolated sandbox environment
 */
export async function proveChildRepo(repoDir, options = {}) {
  console.log(`[prove-repo] Proving child repo in: ${repoDir}`);

  const checks = {
    structure: false,
    critiqueTest: false,
    doctor: false,
    smokeRender: false
  };

  // 1. Structural checks
  const requiredFiles = [
    'package.json',
    'format.json',
    'KIT-MANIFEST.json',
    'SKILL.md',
    'runner.mjs',
    'runtime/index.jsx',
    'runtime/root.jsx',
    'runtime/critique.mjs',
    'runtime/voice.mjs',
    'runtime/harvest.mjs',
    'runtime/scout.mjs',
    'tests/critique.test.mjs'
  ];

  for (const rel of requiredFiles) {
    const full = path.join(repoDir, rel);
    if (!existsSync(full)) {
      throw new Error(`Required file missing from child repo: ${rel}`);
    }
  }

  // Verify SKILL.md contains the Interactive Q&A Intake Law
  const skillContent = readFileSync(path.join(repoDir, 'SKILL.md'), 'utf8');
  if (!skillContent.includes('Interactive Q&A Intake Law') || !skillContent.includes('Turbo Mode')) {
    throw new Error('SKILL.md missing Interactive Q&A Intake Law or Turbo Mode requirement');
  }

  // Verify package.json and format.json parse correctly
  const pkg = JSON.parse(readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
  const fmt = JSON.parse(readFileSync(path.join(repoDir, 'format.json'), 'utf8'));
  checks.structure = true;
  console.log('[prove-repo] ✅ Structure and contract validation passed.');

  // Resolve active node_modules location
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidateDirs = [
    path.resolve(moduleDir, '../../../../node_modules'),
    path.resolve(process.cwd(), 'v3/node_modules'),
    path.resolve(process.cwd(), 'node_modules'),
    path.resolve(repoDir, '../../../../node_modules'),
    path.resolve(repoDir, '../../../node_modules'),
    path.resolve(repoDir, '../../node_modules')
  ];

  const sourceModules = candidateDirs.find(d => existsSync(d));
  const targetNodeModules = path.join(repoDir, 'node_modules');
  if (!existsSync(targetNodeModules) && sourceModules) {
    try {
      symlinkSync(sourceModules, targetNodeModules, 'dir');
      console.log(`[prove-repo] Symlinked node_modules from ${sourceModules}`);
    } catch (err) {
      console.warn(`[prove-repo] Could not symlink node_modules: ${err.message}`);
    }
  }

  const childEnv = {
    ...process.env,
    NODE_PATH: sourceModules ? `${sourceModules}:${process.env.NODE_PATH || ''}` : process.env.NODE_PATH
  };

  // 2. Run unit tests
  console.log('[prove-repo] Running child unit tests...');
  try {
    execFileSync('node', ['--test', 'tests/critique.test.mjs'], {
      cwd: repoDir,
      stdio: 'pipe',
      encoding: 'utf8',
      env: childEnv
    });
    checks.critiqueTest = true;
    console.log('[prove-repo] ✅ Child unit tests passed.');
  } catch (err) {
    throw new Error(`Child unit tests failed:\n${err.stderr || err.stdout || err.message}`);
  }

  // 3. Run runner doctor
  console.log('[prove-repo] Running runner doctor...');
  try {
    execFileSync('node', ['runner.mjs', 'doctor'], {
      cwd: repoDir,
      stdio: 'pipe',
      encoding: 'utf8',
      env: childEnv
    });
    checks.doctor = true;
    console.log('[prove-repo] ✅ Runner doctor passed.');
  } catch (err) {
    throw new Error(`Runner doctor failed:\n${err.stderr || err.stdout || err.message}`);
  }

  // 4. Run smoke render if requested (default: true)
  let smokeMedia = null;
  if (options.smokeRender !== false) {
    console.log('[prove-repo] Executing smoke render verification...');
    try {
      execFileSync('node', ['runner.mjs', 'smoke', '--noOpen'], {
        cwd: repoDir,
        stdio: 'inherit',
        env: childEnv
      });

      const smokeOut = path.join(repoDir, 'outputs/smoke.mp4');
      if (!existsSync(smokeOut)) {
        throw new Error(`Smoke video was not created at ${smokeOut}`);
      }

      smokeMedia = probeMedia(smokeOut);
      if (smokeMedia.durationSeconds <= 0) {
        throw new Error(`Smoke video duration is invalid: ${smokeMedia.durationSeconds}s`);
      }

      checks.smokeRender = true;
      console.log(`[prove-repo] ✅ Smoke render verified: ${smokeMedia.width}x${smokeMedia.height}, ${smokeMedia.durationSeconds.toFixed(1)}s`);
    } catch (err) {
      if (options.requireSmokeRender) {
        throw new Error(`Smoke render failed:\n${err.message}`);
      } else {
        console.warn(`[prove-repo] Smoke render warning: ${err.message}`);
      }
    }
  }

  return {
    status: 'proven',
    repoDirectory: repoDir,
    slug: fmt.slug,
    title: fmt.title,
    checks,
    smokeMedia,
    timestamp: new Date().toISOString()
  };
}
