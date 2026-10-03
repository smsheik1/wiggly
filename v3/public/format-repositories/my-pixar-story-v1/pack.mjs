import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {verifyRenderer} from './runtime/remotion.mjs';
await verifyRenderer();
execFileSync(process.execPath,['--test','tests/supervised-regression.test.mjs','tests/refined-flow.test.mjs','tests/mini-core-flow.test.mjs','tests/studio-instructions.test.mjs','tests/debug-mode.test.mjs'],{cwd:dirname(fileURLToPath(import.meta.url)),stdio:'inherit'});
const root = dirname(fileURLToPath(import.meta.url));
const files = ['build/remotion', 'build-renderer.mjs', 'AGENTS.md', 'SKILL.md', 'README.md', 'format.json', 'pipeline.json', 'quality.json', 'requirements.json', 'scene-contract.json',
  'studio.json', 'crew', 'orchestrator-voice.md', 'questionnaire.json', 'character-prompter.md', 'character-sheet-recipe.md', 'background-prompter.md', 'proof.json', 'package.json', 'package-lock.json', 'runner.mjs', 'kit-smoke.mjs', 'pack.mjs', 'runtime', 'evaluation', 'examples', 'tests'];
const path = join(root, 'my-pixar-story-v2.0.0.tgz');
execFileSync('tar', ['--exclude=evaluation/local', '-czf', path, '-C', root, ...files], { stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' } });
process.stdout.write(`${path}\n`);
