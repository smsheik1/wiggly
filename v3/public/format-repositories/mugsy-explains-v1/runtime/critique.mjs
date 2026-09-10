#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const FLUFF_PATTERNS = [
  /\bhey guys\b/i,
  /\bwelcome back\b/i,
  /\bin this video\b/i,
  /\btoday we are going to\b/i,
  /\bdon't forget to like\b/i,
  /\bsubscribe for more\b/i,
  /\bleave a comment below\b/i,
  /\bwithout further ado\b/i,
  /\blet's dive in\b/i,
  /\bas you know\b/i
];

export const VALID_ROLES = ['a', 'b', 'question', 'explain_a', 'explain_b'];

export function critiqueMugsyScript(content) {
  const issues = [];
  let score = 100;

  if (!content || typeof content !== 'object') {
    return {
      passed: false,
      score: 0,
      breakdown: { law1: 0, law2: 0, law3: 0, law4: 0, law5: 0 },
      issues: ['Content must be a valid JSON object.']
    };
  }

  const lessons = content.lessons || [];

  // Law 1: Socratic Comparative Hook (25 pts)
  let law1Score = 25;
  if (!lessons.length) {
    issues.push('Law 1: Missing lessons. Script must contain comparison lessons.');
    law1Score = 0;
  } else {
    const first = lessons[0];
    const s = first.sentences || [];
    if (s.length < 3) {
      issues.push('Law 1: Lesson 1 must start with 3 hook sentences: Intro A, Intro B, and Question.');
      law1Score = 10;
    } else {
      const q = s[2]?.text || '';
      if (!/what['’]?s the difference/i.test(q)) {
        issues.push(`Law 1: Third sentence should be the signature hook "What's the difference?", got "${q}"`);
        law1Score -= 10;
      }
    }
  }

  // Law 2: 3-Lesson Triad Architecture (20 pts)
  let law2Score = 20;
  if (lessons.length !== 3) {
    issues.push(`Law 2: Mugsy Explains strictly requires exactly 3 comparative lessons, got ${lessons.length}.`);
    law2Score = Math.max(0, 20 - Math.abs(3 - lessons.length) * 10);
  }

  // Law 3: Zero Conversational Fluff & Word Economy (20 pts)
  let law3Score = 20;
  let totalWords = 0;
  let sentenceCount = 0;

  for (let l = 0; l < lessons.length; l++) {
    const lesson = lessons[l];
    const sList = lesson.sentences || [];
    for (let s = 0; s < sList.length; s++) {
      const text = sList[s].text || '';
      const words = text.split(/\s+/).filter(Boolean).length;
      totalWords += words;
      sentenceCount++;

      for (const pattern of FLUFF_PATTERNS) {
        if (pattern.test(text)) {
          issues.push(`Law 3: Fluff detected in Lesson ${l + 1} Sentence ${s + 1}: "${text.match(pattern)[0]}"`);
          law3Score = Math.max(0, law3Score - 5);
        }
      }

      if (words > 28) {
        issues.push(`Law 3: Sentence too wordy in Lesson ${l + 1} Sentence ${s + 1} (${words} words, max 28).`);
        law3Score = Math.max(0, law3Score - 3);
      }
    }
  }

  // Law 4: Expressive Pose-to-Role Mapping & Proof Images (15 pts)
  let law4Score = 15;
  for (let l = 0; l < lessons.length; l++) {
    const lesson = lessons[l];
    if (!lesson.leftImage || !lesson.rightImage) {
      issues.push(`Law 4: Lesson ${l + 1} is missing leftImage or rightImage paths.`);
      law4Score = Math.max(0, law4Score - 5);
    }
    if (!lesson.leftLabel || !lesson.rightLabel) {
      issues.push(`Law 4: Lesson ${l + 1} is missing leftLabel or rightLabel.`);
      law4Score = Math.max(0, law4Score - 5);
    }
    const sList = lesson.sentences || [];
    for (const sent of sList) {
      if (!VALID_ROLES.includes(sent.role)) {
        issues.push(`Law 4: Invalid sentence role "${sent.role}". Must be one of: ${VALID_ROLES.join(', ')}`);
        law4Score = Math.max(0, law4Score - 2);
      }
    }
  }

  // Law 5: Pacing & Clock (20 pts)
  let law5Score = 20;
  // Mugsy explainer pacing: ~150-180 words/minute
  const estimatedSeconds = (totalWords / 2.6) + (sentenceCount * 0.4);
  if (estimatedSeconds < 30) {
    issues.push(`Law 5: Script is too short (~${Math.round(estimatedSeconds)}s, target 35s-55s).`);
    law5Score -= 5;
  } else if (estimatedSeconds > 65) {
    issues.push(`Law 5: Script is too long (~${Math.round(estimatedSeconds)}s, target 35s-55s).`);
    law5Score -= 8;
  }

  score = law1Score + law2Score + law3Score + law4Score + law5Score;
  const passed = score >= 85 && issues.length <= 2;

  return {
    passed,
    score,
    breakdown: {
      law1_hook: law1Score,
      law2_triad: law2Score,
      law3_word_economy: law3Score,
      law4_visual_sync: law4Score,
      law5_pacing: law5Score
    },
    metrics: {
      lessons: lessons.length,
      sentences: sentenceCount,
      totalWords,
      estimatedDurationSeconds: Math.round(estimatedSeconds * 10) / 10
    },
    issues
  };
}

async function main() {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const targetFile = args.find(a => !a.startsWith('--')) || 'content.json';
  const fullPath = path.resolve(process.cwd(), targetFile);

  const raw = readFileSync(fullPath, 'utf8');
  const content = JSON.parse(raw);
  const report = critiqueMugsyScript(content);

  if (jsonFlag) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.passed ? 0 : 1);
  }

  console.log('============================================================');
  console.log(` MUGSY EXPLAINS 5-LAW SCRIPT CRITIQUE — ${report.passed ? '✅ PASS' : '❌ FAIL'} (${report.score}/100)`);
  console.log('============================================================');
  console.log(` Title: ${content.title || 'Untitled'} | Lessons: ${report.metrics.lessons} | Est. Duration: ${report.metrics.estimatedDurationSeconds}s`);
  console.log('------------------------------------------------------------');
  console.log(` [${report.breakdown.law1_hook}/25] Law 1: Socratic Comparative Hook`);
  console.log(` [${report.breakdown.law2_triad}/20] Law 2: 3-Lesson Triad Architecture`);
  console.log(` [${report.breakdown.law3_word_economy}/20] Law 3: Zero Conversational Fluff & Density`);
  console.log(` [${report.breakdown.law4_visual_sync}/15] Law 4: Expressive Pose Sync & Proof Cards`);
  console.log(` [${report.breakdown.law5_pacing}/20] Law 5: Pacing & Clock`);
  console.log('------------------------------------------------------------');

  if (report.issues.length) {
    console.log(' Issues to address:');
    report.issues.forEach(iss => console.log(`   - ${iss}`));
    console.log('------------------------------------------------------------');
  } else {
    console.log(' ✨ Perfect score! Script is tight, forensic, and retention-locked.');
    console.log('============================================================');
  }

  process.exit(report.passed ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith('critique.mjs')) {
  main().catch(err => {
    console.error(`[critique] Error: ${err.message}`);
    process.exit(1);
  });
}
