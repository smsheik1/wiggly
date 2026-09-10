import test from 'node:test';
import assert from 'node:assert/strict';
import { critiqueMugsyScript } from '../runtime/critique.mjs';

test('critiqueMugsyScript flags invalid input', () => {
  const res = critiqueMugsyScript(null);
  assert.equal(res.passed, false);
  assert.equal(res.score, 0);
});

test('critiqueMugsyScript flags missing "What\'s the difference?" hook', () => {
  const content = {
    title: 'Test',
    lessons: [
      {
        leftLabel: 'A', rightLabel: 'B',
        leftImage: 'a.png', rightImage: 'b.png',
        sentences: [
          { role: 'a', text: 'This is A.' },
          { role: 'b', text: 'This is B.' },
          { role: 'question', text: 'Which one is cooler?' } // Fails Law 1 signature phrase
        ]
      },
      { leftLabel: 'C', rightLabel: 'D', leftImage: 'c.png', rightImage: 'd.png', sentences: [] },
      { leftLabel: 'E', rightLabel: 'F', leftImage: 'e.png', rightImage: 'f.png', sentences: [] }
    ]
  };
  const res = critiqueMugsyScript(content);
  assert.ok(res.issues.some(iss => iss.includes("What's the difference?")));
  assert.ok(res.breakdown.law1_hook < 25);
});

test('critiqueMugsyScript flags incorrect lesson count (not 3)', () => {
  const content = {
    title: 'Test',
    lessons: [
      { leftLabel: 'A', rightLabel: 'B', leftImage: 'a.png', rightImage: 'b.png', sentences: [] }
    ]
  };
  const res = critiqueMugsyScript(content);
  assert.equal(res.passed, false);
  assert.ok(res.issues.some(iss => iss.includes('exactly 3 comparative lessons')));
});

test('critiqueMugsyScript flags conversational fluff words', () => {
  const content = {
    title: 'Fluff Test',
    lessons: [
      {
        leftLabel: 'A', rightLabel: 'B',
        leftImage: 'a.png', rightImage: 'b.png',
        sentences: [
          { role: 'a', text: 'Hey guys, this is A.' }, // Banned fluff
          { role: 'b', text: 'This is B.' },
          { role: 'question', text: "What's the difference?" }
        ]
      },
      { leftLabel: 'C', rightLabel: 'D', leftImage: 'c.png', rightImage: 'd.png', sentences: [] },
      { leftLabel: 'E', rightLabel: 'F', leftImage: 'e.png', rightImage: 'f.png', sentences: [] }
    ]
  };
  const res = critiqueMugsyScript(content);
  assert.ok(res.issues.some(iss => iss.includes('Fluff detected')));
  assert.ok(res.breakdown.law3_word_economy < 20);
});

test('critiqueMugsyScript approves valid 3-lesson script with perfect score', () => {
  const golden = {
    title: 'Sourdough vs Store Bread',
    lessons: [
      {
        leftLabel: 'SOURDOUGH', rightLabel: 'STORE BREAD',
        leftImage: 'assets/proof/sourdough.png', rightImage: 'assets/proof/store.png',
        sentences: [
          { role: 'a', text: 'This is sourdough bread.' },
          { role: 'b', text: 'This is supermarket bread.' },
          { role: 'question', text: "What's the difference?" },
          { role: 'explain_a', text: 'Real sourdough uses wild yeast and 24-hour lactic fermentation.' },
          { role: 'explain_b', text: 'Supermarket bread relies on calcium propionate and dough conditioners.' }
        ]
      },
      {
        leftLabel: 'WILD YEAST', rightLabel: 'INDUSTRIAL YEAST',
        leftImage: 'assets/proof/wild.png', rightImage: 'assets/proof/industrial.png',
        sentences: [
          { role: 'a', text: 'This is wild sourdough starter.' },
          { role: 'b', text: "This is commercial baker's yeast." },
          { role: 'question', text: "What's the difference?" },
          { role: 'explain_a', text: 'Wild starter pre-digests gluten proteins so your gut can absorb them.' },
          { role: 'explain_b', text: 'Industrial yeast forces dough to rise in under 60 minutes.' }
        ]
      },
      {
        leftLabel: 'REAL CRUST', rightLabel: 'PLASTIC CRUST',
        leftImage: 'assets/proof/crust.png', rightImage: 'assets/proof/plastic.png',
        sentences: [
          { role: 'a', text: 'This is an artisan crust.' },
          { role: 'b', text: 'This is factory sandwich bread.' },
          { role: 'question', text: "What's the difference?" },
          { role: 'explain_a', text: 'Real bread goes stale in four days instead of molding.' },
          { role: 'explain_b', text: 'Store-bought loaves stay soft for three weeks because of chemicals.' }
        ]
      }
    ]
  };
  const res = critiqueMugsyScript(golden);
  assert.equal(res.passed, true);
  assert.equal(res.score, 100);
});
