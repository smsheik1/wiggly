import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { layout, validate } from '../runtime/render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('layout matches 9:16 Shorts standard', () => {
  assert.equal(layout.width, 1080);
  assert.equal(layout.height, 1920);
  assert.equal(layout.fps, 25);
  assert.equal(layout.cardWidth, 940);
  assert.equal(layout.cardX, 70);
});

test('validate accepts valid smoke input', async () => {
  const input = {
    schemaVersion: 1,
    topic: 'Valid test topic',
    gameplay: {
      file: 'assets/warm.mp4',
      authorized: true,
      provenance: 'Diagnostic'
    },
    hook: {
      authorName: 'Test',
      handle: 'test',
      text: 'roast me',
      durationSeconds: 3.2,
      audio: {
        file: 'assets/tones/tone_hook_3.2s.wav',
        authorized: true,
        provenance: 'Diagnostic'
      }
    },
    contacts: [
      { id: 'c1', name: 'Contact 1', initial: 'C' }
    ],
    scenes: [
      {
        contactId: 'c1',
        turns: [
          {
            speaker: 'victim',
            text: 'hi',
            durationSeconds: 1.0,
            audio: { file: 'assets/tones/tone_440_1s.wav', authorized: true, provenance: 'Diagnostic' }
          }
        ]
      }
    ]
  };
  const res = await validate(input, root);
  assert.equal(res.totalDuration, 4.2);
  assert.equal(res.turnsList.length, 1);
});

test('validate rejects missing audio authorization', async () => {
  const input = {
    schemaVersion: 1,
    topic: 'Bad audio test',
    gameplay: { file: 'assets/warm.mp4', authorized: true, provenance: 'Diagnostic' },
    hook: {
      authorName: 'Test',
      handle: 'test',
      text: 'roast me',
      durationSeconds: 3.2,
      audio: { file: 'assets/tones/tone_hook_3.2s.wav', authorized: false }
    },
    contacts: [{ id: 'c1', name: 'C1' }],
    scenes: []
  };
  await assert.rejects(() => validate(input, root), /Hook audio authorization/);
});

test('validate rejects unknown contact id in scene', async () => {
  const input = {
    schemaVersion: 1,
    topic: 'Bad contact test',
    gameplay: { file: 'assets/warm.mp4', authorized: true, provenance: 'Diagnostic' },
    hook: {
      authorName: 'Test',
      handle: 'test',
      text: 'roast me',
      durationSeconds: 3.2,
      audio: { file: 'assets/tones/tone_hook_3.2s.wav', authorized: true, provenance: 'D' }
    },
    contacts: [{ id: 'c1', name: 'C1' }],
    scenes: [{ contactId: 'nonexistent', turns: [] }]
  };
  await assert.rejects(() => validate(input, root), /Unknown contactId/);
});

test("validate accepts valid presenter with male preset and cues", async () => {
  const input = {
    schemaVersion: 1,
    topic: "Presenter Male Test",
    gameplay: { file: "assets/warm.mp4", authorized: true, provenance: "Diagnostic" },
    hook: {
      authorName: "Test",
      handle: "test",
      text: "roast me",
      durationSeconds: 3.2,
      audio: { file: "assets/tones/tone_hook_3.2s.wav", authorized: true, provenance: "Diagnostic" }
    },
    presenter: {
      enabled: true,
      character: "male",
      sway: { cycleSeconds: 1.4, maxAngleDeg: 2.2, maxHorizontalPx: 16, maxVerticalPx: 6 },
      cues: [
        { atSeconds: 0, pose: "neutral", flip: false },
        { atSeconds: 1.5, pose: "talk", flip: false },
        { atSeconds: 2.5, pose: "laugh", flip: true }
      ]
    },
    scenes: []
  };
  const res = await validate(input, root);
  assert.equal(res.presenterData?.enabled, true);
  assert.equal(res.presenterData?.character, "male");
  assert.equal(res.presenterData?.cues.length, 3);
  assert.ok(res.presenterData?.poseFiles.neutral);
  assert.ok(res.presenterData?.poseFiles.laugh);
  assert.ok(res.presenterData?.poseFiles.talk);
  assert.ok(res.presenterData?.poseFiles.shock);
});

test("validate accepts valid presenter with female preset", async () => {
  const input = {
    schemaVersion: 1,
    topic: "Presenter Female Test",
    gameplay: { file: "assets/warm.mp4", authorized: true, provenance: "Diagnostic" },
    hook: {
      authorName: "Test",
      handle: "test",
      text: "roast me",
      durationSeconds: 3.2,
      audio: { file: "assets/tones/tone_hook_3.2s.wav", authorized: true, provenance: "Diagnostic" }
    },
    presenter: {
      enabled: true,
      character: "female"
    },
    scenes: []
  };
  const res = await validate(input, root);
  assert.equal(res.presenterData?.enabled, true);
  assert.equal(res.presenterData?.character, "female");
  assert.equal(res.presenterData?.cues.length, 1);
  assert.equal(res.presenterData?.cues[0].pose, "neutral");
});

test("validate rejects unknown character preset", async () => {
  const input = {
    schemaVersion: 1,
    topic: "Bad presenter test",
    gameplay: { file: "assets/warm.mp4", authorized: true, provenance: "Diagnostic" },
    hook: {
      authorName: "Test",
      handle: "test",
      text: "roast me",
      durationSeconds: 3.2,
      audio: { file: "assets/tones/tone_hook_3.2s.wav", authorized: true, provenance: "Diagnostic" }
    },
    presenter: {
      enabled: true,
      character: "alien"
    },
    scenes: []
  };
  await assert.rejects(() => validate(input, root), /presenter.character must be/);
});

test("validate rejects unknown pose in cue", async () => {
  const input = {
    schemaVersion: 1,
    topic: "Bad cue test",
    gameplay: { file: "assets/warm.mp4", authorized: true, provenance: "Diagnostic" },
    hook: {
      authorName: "Test",
      handle: "test",
      text: "roast me",
      durationSeconds: 3.2,
      audio: { file: "assets/tones/tone_hook_3.2s.wav", authorized: true, provenance: "Diagnostic" }
    },
    presenter: {
      enabled: true,
      character: "male",
      cues: [{ atSeconds: 0, pose: "nonexistent_pose" }]
    },
    scenes: []
  };
  await assert.rejects(() => validate(input, root), /not found in character poses/);
});
