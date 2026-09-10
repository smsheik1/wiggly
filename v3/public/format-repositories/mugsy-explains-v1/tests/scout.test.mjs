import test from 'node:test';
import assert from 'node:assert/strict';
import { scoutComparisonTopics, COMPARISON_SEEDS } from '../runtime/scout.mjs';

test('scoutComparisonTopics returns pre-validated seeds with velocity metrics', async () => {
  const topics = await scoutComparisonTopics();
  assert.ok(topics.length >= 3, 'Must provide at least 3 comparison topics');

  for (const topic of topics) {
    assert.ok(topic.title, 'Topic must have title');
    assert.ok(topic.searchQuery, 'Topic must have search query');
    assert.ok(typeof topic.velocityScore === 'number' && topic.velocityScore > 0, 'Must have positive velocity score');
    assert.equal(topic.lessons.length, 3, 'Must have exactly 3 lessons');

    for (const lesson of topic.lessons) {
      assert.ok(lesson.leftLabel, 'Lesson must have leftLabel');
      assert.ok(lesson.rightLabel, 'Lesson must have rightLabel');
      assert.equal(lesson.sentences.length, 5, 'Each lesson must have 5 sentences (a, b, question, explain_a, explain_b)');
    }
  }
});

test('scoutComparisonTopics filters by keyword', async () => {
  const coffee = await scoutComparisonTopics('coffee');
  assert.ok(coffee.length > 0);
  assert.ok(coffee.some(t => t.title.toLowerCase().includes('coffee') || t.theme.includes('coffee')));
});
