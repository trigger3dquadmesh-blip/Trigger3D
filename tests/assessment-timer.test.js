import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createQuestionDeadline,
  secondsUntilDeadline,
} from '../src/features/student/assessment/assessment-timer.js'

test('creates a deadline from the real start time', () => {
  assert.equal(createQuestionDeadline(10_000, 30), 40_000)
})

test('uses elapsed wall-clock time when browser callbacks are delayed', () => {
  const deadline = createQuestionDeadline(10_000, 30)

  assert.equal(secondsUntilDeadline(deadline, 10_000), 30)
  assert.equal(secondsUntilDeadline(deadline, 25_250), 15)
  assert.equal(secondsUntilDeadline(deadline, 40_000), 0)
  assert.equal(secondsUntilDeadline(deadline, 75_000), 0)
})
