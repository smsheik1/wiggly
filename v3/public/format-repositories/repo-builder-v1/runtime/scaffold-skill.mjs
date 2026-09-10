import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Generate SKILL.md with strict Interactive Q&A Intake Law
 */
export function generateSkillMd(recipe) {
  return `# ${recipe.title} Format Kit (v0.1.0)

You operate the official ${recipe.title} format repository. Do not rebuild the renderer, invent another character, or output long walls of text.

---

## ⚡ The Interactive Q&A Intake Law (Strictly Enforced)

When a creator pastes the handoff prompt into your chat, you must follow these rules:

1. **Max 1–2 sentences per turn.** Never dump multi-paragraph explanations, terminal logs, or internal planning.
2. **Every question must be formatted as Multiple Choice [A, B, C, D].**
3. **Option A is ALWAYS Turbo Mode:** Selecting \`A\` picks the highest-velocity trending comparison and immediately proceeds to generation.
4. **Lowest Time-to-Win:** From prompt paste to master video pop-up on screen must require at most 2 user choices.

### Turn 1: Intake & Topic Selection (Exact Template)

> Package downloaded and verified (v0.1.0). What comparison would you like to create?
>
> - **A) Turbo Mode** *(Sourdough vs Store Bread — Highest viral velocity)*
> - **B) Cold Brew vs Iced Coffee** *(Acidity & caffeine chemistry)*
> - **C) Mechanical vs Membrane Keyboards** *(Tactile actuation & ergonomics)*
> - **D) [Type your own comparison]*

### Turn 2: Confirmation & Render (Exact Template)

*(If user picks A)*
> Locked in Turbo Mode: **Sourdough vs Store Bread**. 
>
> Scraping 6 proof cards, linting 5-law retention critique (100/100 PASS), and rendering locally with zero provider fees. Popcorn time—your video will pop up when ready!

---

## Packaged Commands

- **Autonomous 1-Click Generator:**
  \`\`\`sh
  node runner.mjs make
  \`\`\`
  *(Automates topic selection, 5-law critique, DuckDuckGo image scraping, voice synthesis, Remotion render, and launches QuickTime Player).*

- **Scout Trending Topics:**
  \`\`\`sh
  npm run scout
  # Or: node runtime/scout.mjs
  \`\`\`

- **Retention Critique Linter:**
  \`\`\`sh
  npm run critique
  # Or: node runtime/critique.mjs
  \`\`\`

- **Zero-Provider Smoke Render:**
  \`\`\`sh
  node runner.mjs smoke
  \`\`\`

- **Prerequisites Doctor:**
  \`\`\`sh
  node runner.mjs doctor
  \`\`\`

---

## Inviolable Rules

1. **One Renderer:** Always render through the packaged Remotion runtime in \`runtime/${recipe.slug}.jsx\`. Never write a separate FFmpeg script or fallback renderer.
2. **Zero Invisibility:** No transparent click traps or hidden interactions.
3. **Parity:** Every generated video must match the golden proof in dimensions, typography, and pacing.
`;
}

/**
 * Generate package.json for child format
 */
export function generatePackageJson(recipe) {
  return {
    name: `wiggly-${recipe.slug}-format-kit`,
    version: '0.1.0',
    private: true,
    type: 'module',
    engines: { node: '>=22' },
    scripts: {
      doctor: 'node runner.mjs doctor',
      smoke: 'node runner.mjs smoke',
      make: 'node runner.mjs make',
      scout: 'node runtime/scout.mjs',
      critique: 'node runtime/critique.mjs',
      test: 'node --test tests/*.test.mjs'
    },
    dependencies: {
      '@remotion/bundler': '^4.0.473',
      '@remotion/renderer': '^4.0.473',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      remotion: '^4.0.473'
    }
  };
}

/**
 * Generate format.json
 */
export function generateFormatJson(recipe) {
  return {
    schemaVersion: 1,
    slug: recipe.slug,
    title: recipe.title,
    version: '0.1.0',
    type: 'video',
    runtime: 'runner.mjs',
    remotionComposition: recipe.slug,
    dimensions: {
      width: recipe.structure?.width || 1080,
      height: recipe.structure?.height || 1920,
      fps: recipe.structure?.fps || 30
    },
    description: `Official ${recipe.title} autonomous format kit.`,
    tags: ['remotion', 'explainer', 'comparison', 'short-form']
  };
}

/**
 * Generate build-kit.mjs script for packaging the child repo
 */
export function generateBuildKitScript(recipe) {
  return `import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const downloadsDir = path.join(ROOT, 'downloads');
mkdirSync(downloadsDir, { recursive: true });

const zipName = \`wiggly-\${pkg.name.replace(/^wiggly-/, '')}-\${pkg.version}.zip\`;
const zipPath = path.join(downloadsDir, zipName);

execFileSync('zip', [
  '-q', '-r', zipPath,
  'SKILL.md',
  'format.json',
  'package.json',
  'runner.mjs',
  'content.json',
  'runtime',
  'assets',
  'tests',
  '-x', 'node_modules/*', 'outputs/*', 'run/audio/*'
]);

const buf = readFileSync(zipPath);
const sha256 = createHash('sha256').update(buf).digest('hex');
writeFileSync(\`\${zipPath}.sha256\`, sha256 + '\\n');

console.log(\`built \${zipName} (\${buf.length} bytes) sha256=\${sha256}\`);
`;
}

/**
 * Generate unit tests for the child format
 */
export function generateUnitTests(recipe) {
  return `import test from 'node:test';
import assert from 'node:assert/strict';
import { critiqueScript } from '../runtime/critique.mjs';

test('critiqueScript validates valid 3-lesson script', () => {
  const content = {
    title: '${recipe.title}',
    lessons: [
      { sentences: [{ role: 'a' }, { role: 'b' }, { role: 'question' }, { role: 'explain_a' }, { role: 'explain_b' }] },
      { sentences: [{ role: 'a' }, { role: 'b' }, { role: 'question' }, { role: 'explain_a' }, { role: 'explain_b' }] },
      { sentences: [{ role: 'a' }, { role: 'b' }, { role: 'question' }, { role: 'explain_a' }, { role: 'explain_b' }] }
    ]
  };
  const res = critiqueScript(content);
  assert.equal(res.passed, true);
  assert.equal(res.score, 100);
});

test('critiqueScript rejects script with missing question hook', () => {
  const content = {
    title: '${recipe.title}',
    lessons: [
      { sentences: [{ role: 'a' }, { role: 'b' }] }
    ]
  };
  const res = critiqueScript(content);
  assert.equal(res.passed, false);
});
`;
}

/**
 * Main export: Scaffold the complete child kit metadata and skill files
 */
export async function scaffoldChildKit(recipe, outputDir) {
  console.log('[scaffold-skill] Scaffolding SKILL.md and package contracts in:', outputDir);

  // 1. SKILL.md
  writeFileSync(path.join(outputDir, 'SKILL.md'), generateSkillMd(recipe));

  // 2. package.json
  writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(generatePackageJson(recipe), null, 2) + '\n');

  // 3. format.json
  writeFileSync(path.join(outputDir, 'format.json'), JSON.stringify(generateFormatJson(recipe), null, 2) + '\n');

  // 4. KIT-MANIFEST.json
  const manifest = {
    schemaVersion: 1,
    kit: `wiggly-${recipe.slug}`,
    version: '0.1.0',
    title: recipe.title,
    runtime: 'runner.mjs',
    remotion: true,
    intakeLaw: 'interactive-qa-turbo'
  };
  writeFileSync(path.join(outputDir, 'KIT-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');

  // 5. build-kit.mjs
  writeFileSync(path.join(outputDir, 'build-kit.mjs'), generateBuildKitScript(recipe));

  // 6. tests/critique.test.mjs
  const testsDir = path.join(outputDir, 'tests');
  mkdirSync(testsDir, { recursive: true });
  writeFileSync(path.join(testsDir, 'critique.test.mjs'), generateUnitTests(recipe));

  // 7. .gitignore
  writeFileSync(path.join(outputDir, '.gitignore'), 'node_modules/\noutputs/\nrun/audio/\nfinal/\n.DS_Store\n');

  console.log('[scaffold-skill] ✅ Kit contracts and Interactive Q&A SKILL.md created.');
}
