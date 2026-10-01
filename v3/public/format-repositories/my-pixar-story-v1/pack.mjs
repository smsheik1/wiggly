import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(fileURLToPath(import.meta.url));
const files = ['AGENTS.md', 'SKILL.md', 'README.md', 'format.json', 'pipeline.json', 'quality.json', 'requirements.json', 'scene-contract.json',
  'character-sheet-recipe.md', 'proof.json', 'package.json', 'package-lock.json', 'runner.mjs', 'kit-smoke.mjs', 'pack.mjs', 'runtime', 'evaluation', 'examples', 'tests'];
const path = join(root, 'my-pixar-story-v2.0.0.tgz');
execFileSync('tar', ['--exclude=evaluation/local', '-czf', path, '-C', root, ...files], { stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } });
process.stdout.write(`${path}\n`);
