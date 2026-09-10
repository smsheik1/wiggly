import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { synthesizeMugsySentence, MUGSY_VOICE_ID, probeAudioDuration } from '../runtime/voice.mjs';

test('synthesizeMugsySentence produces valid audio file with positive duration', async () => {
  const tmpOut = path.resolve('/tmp/test-mugsy-voice-unit.wav');
  if (existsSync(tmpOut)) unlinkSync(tmpOut);

  try {
    const duration = await synthesizeMugsySentence({
      text: "This is sourdough bread. What's the difference?",
      outputPath: tmpOut
    });

    assert.ok(existsSync(tmpOut), 'Must generate audio file');
    assert.ok(typeof duration === 'number' && duration > 0.5, 'Duration must be positive number');
    assert.equal(MUGSY_VOICE_ID, 'a126d52c2d20443bb024aeef10e741bf', 'Must use official Mugsy model ID');
  } finally {
    if (existsSync(tmpOut)) {
      try { unlinkSync(tmpOut); } catch {}
    }
  }
});
