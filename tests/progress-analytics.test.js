import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProgressAnalytics } from '../src/features/faculty/progress-analytics.js'

test('buildProgressAnalytics summarizes answers and score bands', () => {
  const analytics = buildProgressAnalytics([
    { percentage: 20 },
    { percentage: 82 },
  ], [{ questions: [
    { correct_count: 2, incorrect_count: 1 },
    { correct_count: 1, incorrect_count: 2 },
  ] }])

  assert.equal(analytics.totalAttempts, 2)
  assert.equal(analytics.totalAnswers, 6)
  assert.equal(analytics.averageScore, 51)
  assert.deepEqual(analytics.answerSummary.map((item) => item.value), [3, 3])
  assert.deepEqual(analytics.scoreDistribution.map((item) => item.value), [1, 0, 0, 1])
})
