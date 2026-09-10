#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { critiqueMugsyScript } from './runtime/critique.mjs';
import { autoHarvestLessonProofs } from './runtime/harvest.mjs';
import { scoutComparisonTopics } from './runtime/scout.mjs';
import { buildLessonAudio, MUGSY_VOICE_ID } from './runtime/voice.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

function parseArgs(args) {
  const result = { _: [] };
  for (const a of args) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      result[k] = v === undefined ? true : v;
    } else {
      result._.push(a);
    }
  }
  return result;
}

export async function doctor() {
  const nodeVersion = process.version;
  let ffmpeg = false;
  let ffprobe = false;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    ffmpeg = true;
  } catch {}
  try {
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    ffprobe = true;
  } catch {}

  const poses = ['coffee-explain.png', 'point-left.png', 'point-right.png', 'question.png', 'raise-hand.png'];
  const hasPoses = poses.every(p => existsSync(path.join(ROOT, 'assets/poses', p)));
  const hasFont = existsSync(path.join(ROOT, 'assets/fonts/PatrickHand-Regular.ttf'));

  const status = {
    node: nodeVersion,
    ffmpeg,
    ffprobe,
    poses: hasPoses,
    font: hasFont,
    voiceId: MUGSY_VOICE_ID,
    ready: ffmpeg && ffprobe && hasPoses && hasFont
  };

  console.log(JSON.stringify(status, null, 2));
  return status.ready;
}

export async function renderMugsyVideo(recipePayload, outputPath, options = {}) {
  const fullOut = path.resolve(process.cwd(), outputPath);
  mkdirSync(path.dirname(fullOut), { recursive: true });

  console.log('[render] Bundling Remotion composition...');
  const bundled = await bundle({
    entryPoint: path.join(ROOT, 'runtime/index.jsx'),
    publicDir: ROOT,
    webpackOverride: (config) => config
  });

  console.log('[render] Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'mugsy-explains',
    inputProps: recipePayload
  });

  console.log(`[render] Rendering ${composition.durationInFrames} frames (${(composition.durationInFrames / 30).toFixed(1)}s) to ${path.basename(fullOut)}...`);
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: fullOut,
    inputProps: recipePayload,
    concurrency: options.concurrency || 4,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      process.stdout.write(`\r[render] Progress: ${pct}% [${Math.round(progress * composition.durationInFrames)} / ${composition.durationInFrames}]`);
    }
  });

  console.log('\n[render] ✅ Render complete: ' + fullOut);

  // Generate Contact Sheet with FFmpeg if available
  const contactSheet = `${fullOut}.contact-sheet.jpg`;
  try {
    execFileSync('ffmpeg', [
      '-y', '-v', 'error',
      '-i', fullOut,
      '-filter_complex', 'select=not(mod(n\\,100)),scale=270:480,tile=3x3',
      '-frames:v', '1',
      '-q:v', '3',
      contactSheet
    ]);
  } catch {}

  // Auto-launch QuickTime on macOS
  if (process.platform === 'darwin' && !options.noOpen) {
    try {
      execFileSync('osascript', [
        '-e', `tell application "QuickTime Player" to open POSIX file "${fullOut}"`,
        '-e', 'tell application "QuickTime Player" to activate',
        '-e', 'tell application "QuickTime Player" to play document 1'
      ], { stdio: 'ignore' });
      console.log('[render] 🎬 Opened and playing in QuickTime Player!');
    } catch {}
  }

  return fullOut;
}

export async function make(options = {}) {
  console.log('============================================================');
  console.log(' MUGSY EXPLAINS — AUTONOMOUS 1-CLICK VIDEO GENERATOR');
  console.log('============================================================');

  let contentFile = options.content || 'content.json';
  let fullContentPath = path.resolve(process.cwd(), contentFile);

  // 1. Topic & Script Intake
  if (!existsSync(fullContentPath) || options.topic || options.scout) {
    console.log('[make] [1/5] Scouting trending comparison topics...');
    const scouted = await scoutComparisonTopics(options.topic || '');
    const chosen = scouted[0];
    console.log(`[make] Selected topic: "${chosen.title}" (Velocity: ${chosen.velocityScore}/100)`);
    const draft = {
      title: chosen.title,
      lessons: chosen.lessons
    };
    writeFileSync(fullContentPath, JSON.stringify(draft, null, 2) + '\n');
  }

  const rawContent = JSON.parse(readFileSync(fullContentPath, 'utf8'));

  // 2. 5-Law Retention Critique
  console.log('[make] [2/5] Linting script against 5-Law Retention Engine...');
  const critique = critiqueMugsyScript(rawContent);
  if (!critique.passed) {
    console.error(`[make] ❌ Script critique failed with score ${critique.score}/100:`);
    critique.issues.forEach(iss => console.error(`  - ${iss}`));
    process.exit(1);
  }
  console.log(`[make] Retention Critique: ✅ PASS (${critique.score}/100)`);

  // 3. Autonomous Image Harvester (Zero API keys)
  console.log('[make] [3/5] Harvesting 6 proof cards via DuckDuckGo...');
  await autoHarvestLessonProofs(fullContentPath, { force: options.forceHarvest });

  // 4. Voice Synthesis (Official Mugsy Clone)
  console.log('[make] [4/5] Synthesizing continuous voiceover (Mugsy Explains Official Voice)...');
  const audioDir = path.join(ROOT, 'run/audio/sentences');
  const sentenceMetadata = await buildLessonAudio(fullContentPath, audioDir);

  // Calculate timeline schedule
  let currentTime = 0;
  const scheduledSentences = sentenceMetadata.map((s) => {
    const start = currentTime;
    const end = start + s.durationSeconds + 0.15; // 150ms breathing room
    currentTime = end;
    return {
      ...s,
      startSeconds: Math.round(start * 100) / 100,
      endSeconds: Math.round(end * 100) / 100,
      audioSrc: `run/audio/sentences/${s.audioFile}`
    };
  });

  const recipePayload = {
    title: rawContent.title,
    lessons: rawContent.lessons.map(l => ({
      ...l,
      leftImage: l.leftImage,
      rightImage: l.rightImage
    })),
    sentences: scheduledSentences
  };

  if (options.dryRun || options['dry-run']) {
    console.log('[make] Dry-run enabled. Skipping Remotion render.');
    return;
  }

  // 5. Remotion Master Render
  console.log(`[make] [5/5] Compiling and rendering master MP4...`);
  const outputMp4 = options.output || path.join(ROOT, 'outputs/mugsy-explains.mp4');
  await renderMugsyVideo(recipePayload, outputMp4, options);

  console.log('\n============================================================');
  console.log(` ✨ DELIVERABLE READY: ${outputMp4}`);
  console.log(` Total Duration: ${currentTime.toFixed(1)}s | 0 Provider Fees`);
  console.log('============================================================\n');
}

export async function smoke() {
  console.log('[smoke] Running fast zero-provider smoke test...');
  const testPayload = {
    title: 'Smoke Test',
    lessons: [
      {
        leftLabel: 'A',
        rightLabel: 'B',
        leftImage: 'assets/poses/point-left.png',
        rightImage: 'assets/poses/point-right.png'
      }
    ],
    sentences: [
      {
        lessonIndex: 0,
        role: 'a',
        text: 'This is A.',
        durationSeconds: 1.0,
        startSeconds: 0,
        endSeconds: 1.0
      },
      {
        lessonIndex: 0,
        role: 'b',
        text: 'This is B.',
        durationSeconds: 1.0,
        startSeconds: 1.0,
        endSeconds: 2.0
      }
    ]
  };

  const smokeOut = path.join(ROOT, 'outputs/smoke.mp4');
  await renderMugsyVideo(testPayload, smokeOut, { noOpen: true });
  console.log('[smoke] ✅ Smoke test passed cleanly!');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'make';

  if (command === 'doctor') {
    const ok = await doctor();
    process.exit(ok ? 0 : 1);
  } else if (command === 'scout') {
    const { main: scoutMain } = await import('./runtime/scout.mjs');
    if (scoutMain) await scoutMain();
  } else if (command === 'critique') {
    const { main: critiqueMain } = await import('./runtime/critique.mjs');
    if (critiqueMain) await critiqueMain();
  } else if (command === 'smoke') {
    await smoke();
  } else if (command === 'make') {
    await make(args);
  } else {
    console.log(`Unknown command "${command}". Available: make, scout, critique, smoke, doctor.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`[runner] Error: ${err.message}`);
  process.exit(1);
});
