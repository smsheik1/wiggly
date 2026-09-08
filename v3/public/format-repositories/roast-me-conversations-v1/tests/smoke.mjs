import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = mkdtempSync(path.join(root, '.smoke-'));
const run = args => execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit', timeout: 120000 });

try {
  const smokeMp4 = path.join(outputDir, 'smoke.mp4');
  console.log('Rendering smoke proof offline...');
  run(['runtime/render.mjs', 'inputs/smoke.json', smokeMp4]);
  run(['tests/verify-proofs.mjs', smokeMp4]);
  console.log('Smoke verification passed. No network or paid provider was called.');
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
