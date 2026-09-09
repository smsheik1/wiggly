import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const IMPERATIVE_VERBS = new Set([
  "use", "select", "pick", "get", "click", "press", "clone", "fetch",
  'see', 'choose', 'copy', 'paste', 'run', 'inspect', 'watch', 'try',
  'open', 'download', 'install', 'verify', 'check', 'review', 'launch',
  'execute', 'build', 'generate', 'test', 'deploy', 'start', 'create',
  'add', 'send', 'load', 'render', 'probe', 'wire', 'connect', 'grab'
]);

export const BANNED_FLUFF_PATTERNS = [
  /\bhey\s+guys\b/i,
  /\bwelcome\s+back\b/i,
  /\bin\s+this\s+video\b/i,
  /\bin\s+this\s+tutorial\b/i,
  /\bwithout\s+further\s+ado\b/i,
  /\blet'?s\s+dive\s+in\b/i,
  /\blet'?s\s+get\s+started\b/i,
  /\bsimply\s+click\b/i,
  /\bjust\s+go\s+ahead\s+and\b/i,
  /\bas\s+you\s+can\s+see\b/i,
  /\bdon'?t\s+forget\s+to\s+(?:like|subscribe)\b/i,
  /\bmake\s+sure\s+to\s+subscribe\b/i,
  /\bhit\s+that\s+bell\b/i,
  /\btoday\s+we\s+are\s+going\s+to\b/i,
  /\btoday\s+i'?m\s+going\s+to\b/i
];

export const ACTION_TERMS = [
  'npm', 'node', 'prompt', 'agent', 'terminal', 'browser', 'run', 'copy',
  'paste', 'receipt', 'output', 'proof', 'format', 'compositor', 'render',
  'install', 'verify', 'check', 'code', 'file', 'script', 'command', 'mp4'
];

export function normalizeTutorialInput(input) {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        throw new Error(`Input path not found or invalid JSON string: ${err.message}`);
      }
    }
    if (existsSync(input)) {
      return JSON.parse(readFileSync(input, 'utf8'));
    }
    throw new Error(`Input path not found or invalid JSON string: ${input}`);
  }
  if (input && typeof input === 'object') {
    return input;
  }
  throw new Error('Invalid input supplied to tutorial critique linter.');
}

export function critiqueTutorialScript(rawInput, options = {}) {
  const input = normalizeTutorialInput(rawInput);
  const steps = input.steps || [];
  const actionableFeedback = [];

  // Law 1: Proof-First Opening (25 points)
  let proofFirstScore = 25;
  const proofFirstFeedback = [];
  if (!steps.length) {
    proofFirstScore = 0;
    proofFirstFeedback.push('CRITICAL: Script contains no steps.');
  } else {
    const firstStep = steps[0];
    if (firstStep.kind !== 'hero' && firstStep.kind !== 'final') {
      proofFirstScore -= 15;
      proofFirstFeedback.push(`Step 1 must be kind 'hero' or 'final' to show the finished result immediately; received '${firstStep.kind}'.`);
    }
    if (firstStep.nativeAudio !== true) {
      proofFirstScore -= 6;
      proofFirstFeedback.push('Step 1 must enable nativeAudio: true to prove the finished format has real audio.');
    }
    if (firstStep.narration) {
      proofFirstScore -= 4;
      proofFirstFeedback.push('Step 1 should not have voiceover narration: let the finished format video speak for itself before explaining.');
    }
    if (typeof firstStep.durationSeconds === 'number') {
      if (firstStep.durationSeconds < 3 || firstStep.durationSeconds > 10) {
        proofFirstScore -= 3;
        proofFirstFeedback.push(`Step 1 duration (${firstStep.durationSeconds}s) is outside optimal 3-10s window.`);
      }
    } else {
      proofFirstScore -= 5;
      proofFirstFeedback.push('Step 1 must specify durationSeconds.');
    }
  }
  proofFirstScore = Math.max(0, Math.min(25, proofFirstScore));

  // Law 2: Imperative Action Verb Titles (20 points)
  let titlesScore = 20;
  const titlesFeedback = [];
  let nonVerbCount = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const label = (step.label || '').trim();
    if (!label) {
      nonVerbCount++;
      titlesFeedback.push(`Step ${i + 1} (${step.id || i}): Label is missing or empty.`);
      continue;
    }
    const firstWord = label.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
    if (!IMPERATIVE_VERBS.has(firstWord)) {
      nonVerbCount++;
      titlesFeedback.push(`Step ${i + 1} (${step.id || i}): Label "${label}" must begin with an imperative action verb (e.g. Choose, Copy, Paste, Run, Inspect, Watch, Try).`);
    }
    if (/\b(?:how\s+to|overview|intro|introduction|summary|setting\s+up)\b/i.test(label)) {
      titlesScore -= 3;
      titlesFeedback.push(`Step ${i + 1}: Label contains passive or fluff phrase: "${label}".`);
    }
  }
  const verbPenalty = Math.min(16, nonVerbCount * 6);
  titlesScore = Math.max(0, Math.min(20, titlesScore - verbPenalty));

  // Law 3: Zero Conversational Fluff & Action Density (20 points)
  let fluffScore = 20;
  const fluffFeedback = [];
  const allCaptions = [];
  let totalWords = 0;
  let actionTermsFound = new Set();

  for (const step of steps) {
    if (Array.isArray(step.captions)) {
      for (const cap of step.captions) {
        if (typeof cap.text === 'string') {
          allCaptions.push(cap.text);
          const words = cap.text.toLowerCase().split(/\s+/).filter(Boolean);
          totalWords += words.length;
          for (const word of words) {
            const clean = word.replace(/[^a-z0-9]/g, '');
            if (ACTION_TERMS.includes(clean)) actionTermsFound.add(clean);
          }
        }
      }
    }
  }

  const fullTranscript = allCaptions.join(' ');
  for (const pattern of BANNED_FLUFF_PATTERNS) {
    const match = fullTranscript.match(pattern);
    if (match) {
      fluffScore -= 5;
      fluffFeedback.push(`Banned fluff phrase detected: "${match[0]}". Delete conversational padding.`);
    }
  }

  if (allCaptions.length > 0 && actionTermsFound.size < 3) {
    fluffScore -= 5;
    fluffFeedback.push(`Low technical/action density (${actionTermsFound.size} action terms found). Mention concrete tools, files, or UI elements.`);
  }
  fluffScore = Math.max(0, Math.min(20, fluffScore));

  // Law 4: Explicit Checkpoint Quality (15 points)
  let checkpointScore = 15;
  const checkpointFeedback = [];
  const checkpoints = steps.filter(s => s.checkpoint && typeof s.checkpoint === 'object');

  if (checkpoints.length === 0) {
    checkpointScore = 0;
    checkpointFeedback.push('Script lacks a checkpoint card. At least one step must include a verification checkpoint to reassure the user.');
  } else {
    for (const cpStep of checkpoints) {
      const cp = cpStep.checkpoint;
      if (!cp.headline || cp.headline.trim().length < 15) {
        checkpointScore -= 4;
        checkpointFeedback.push(`Step ${cpStep.id} checkpoint headline is too brief or missing.`);
      }
      if (!cp.badge || !cp.badge.trim()) {
        checkpointScore -= 2;
        checkpointFeedback.push(`Step ${cpStep.id} checkpoint is missing a badge label.`);
      }
      if (!cp.eyebrow || !cp.eyebrow.trim()) {
        checkpointScore -= 2;
        checkpointFeedback.push(`Step ${cpStep.id} checkpoint is missing an eyebrow label.`);
      }
    }
  }
  checkpointScore = Math.max(0, Math.min(15, checkpointScore));

  // Law 5: Narration-to-Screen Clock & Pacing (20 points)
  let clockScore = 20;
  const clockFeedback = [];
  let totalDurationSeconds = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const duration = Number(step.durationSeconds) || 0;
    totalDurationSeconds += duration;

    if (step.narration && Array.isArray(step.captions) && step.captions.length > 0) {
      const firstCap = step.captions[0];
      const lastCap = step.captions[step.captions.length - 1];
      const capStart = Number(firstCap.start) || 0;
      const capEnd = Number(lastCap.end) || duration;
      const capSpan = capEnd - capStart;

      if (duration > 0 && (capSpan / duration) > 0.92) {
        clockScore -= 4;
        clockFeedback.push(`Step ${i + 1} (${step.id}): Narration (${capSpan.toFixed(2)}s) fills ${(capSpan / duration * 100).toFixed(0)}% of step (${duration}s). Reserve at least 10% breathing room before transition.`);
      }

      const stepWordCount = step.captions.reduce((acc, c) => acc + (c.text || '').split(/\s+/).filter(Boolean).length, 0);
      const wps = duration > 0 ? (stepWordCount / duration) : 0;
      if (wps > 2.85) {
        clockScore -= 4;
        clockFeedback.push(`Step ${i + 1} (${step.id}): Speaking rate too fast (${wps.toFixed(1)} words/sec; limit 2.8). Shorten lines.`);
      }
    }
  }

  if (totalDurationSeconds < 20 || totalDurationSeconds > 120) {
    clockScore -= 4;
    clockFeedback.push(`Total duration (${totalDurationSeconds.toFixed(1)}s) is outside optimal 20-120s tutorial boundary.`);
  }
  clockScore = Math.max(0, Math.min(20, clockScore));

  const totalScore = proofFirstScore + titlesScore + fluffScore + checkpointScore + clockScore;
  let verdict = 'PASS';
  if (totalScore < 65) {
    verdict = 'CRITICAL_FAIL';
  } else if (totalScore < 85) {
    verdict = 'NEEDS_REVISION';
  }

  const allFeedback = [
    ...proofFirstFeedback,
    ...titlesFeedback,
    ...fluffFeedback,
    ...checkpointFeedback,
    ...clockFeedback
  ];

  return {
    score: totalScore,
    verdict,
    stepCount: steps.length,
    totalWords,
    totalDurationSeconds: Number(totalDurationSeconds.toFixed(2)),
    breakdown: {
      proofFirst: { score: proofFirstScore, maxScore: 25, feedback: proofFirstFeedback },
      imperativeTitles: { score: titlesScore, maxScore: 20, feedback: titlesFeedback },
      fluffAndDensity: { score: fluffScore, maxScore: 20, feedback: fluffFeedback },
      checkpoint: { score: checkpointScore, maxScore: 15, feedback: checkpointFeedback },
      clockAndPacing: { score: clockScore, maxScore: 20, feedback: clockFeedback }
    },
    actionableFeedback: allFeedback
  };
}

export function formatCritiqueReport(result) {
  const icon = result.verdict === 'PASS' ? '✅' : result.verdict === 'NEEDS_REVISION' ? '⚠️' : '❌';
  const lines = [
    '============================================================',
    ` TUTORIAL SCRIPT & RETENTION REPORT — ${icon} ${result.verdict} (${result.score}/100)`,
    '============================================================',
    ` Steps: ${result.stepCount} | Duration: ${result.totalDurationSeconds}s | Total Narration Words: ${result.totalWords}`,
    '------------------------------------------------------------',
    ` [${result.breakdown.proofFirst.score}/25] Law 1: Proof-First Opening`,
    ` [${result.breakdown.imperativeTitles.score}/20] Law 2: Imperative Action Titles`,
    ` [${result.breakdown.fluffAndDensity.score}/20] Law 3: Zero Conversational Fluff & Density`,
    ` [${result.breakdown.checkpoint.score}/15] Law 4: Explicit Checkpoint Quality`,
    ` [${result.breakdown.clockAndPacing.score}/20] Law 5: Narration-to-Screen Clock & Pacing`,
    '------------------------------------------------------------'
  ];

  if (result.actionableFeedback.length === 0) {
    lines.push(' ✨ All 5 Tutorial Laws satisfied! Script is tight, proof-first, and pacing-locked.');
  } else {
    lines.push(' ACTIONABLE REVISIONS:');
    for (const item of result.actionableFeedback) {
      lines.push(`   • ${item}`);
    }
  }
  lines.push('============================================================');
  return lines.join('\n');
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const fileArg = args.find(a => !a.startsWith('--'));

  let targetPath = fileArg;
  if (!targetPath) {
    const defaultCandidates = [
      'inputs/input.json',
      'examples/batman-arkham-first-run/input.json',
      'examples/animal-conversations-compositor/input.json'
    ];
    for (const c of defaultCandidates) {
      if (existsSync(c)) {
        targetPath = c;
        break;
      }
    }
  }

  if (!targetPath || !existsSync(targetPath)) {
    console.error('Usage: node runtime/critique.mjs [path/to/input.json] [--json]');
    process.exit(1);
  }

  try {
    const raw = readFileSync(targetPath, 'utf8');
    const critique = critiqueTutorialScript(raw);
    if (jsonMode) {
      console.log(JSON.stringify(critique, null, 2));
    } else {
      console.log(formatCritiqueReport(critique));
    }
    process.exit(critique.verdict === 'PASS' ? 0 : 1);
  } catch (err) {
    console.error(`Error during tutorial critique: ${err.message}`);
    process.exit(1);
  }
}
