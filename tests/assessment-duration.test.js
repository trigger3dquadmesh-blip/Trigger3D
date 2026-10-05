import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createAssessmentTimeState,
  formatAssessmentTime,
  getAssessmentTimeStateKey,
  normalizeAssessmentDuration,
  restoreAssessmentTimeState,
} from '../src/features/student/assessment/assessment-duration.js'

test('accepts faculty assessment durations from one minute through eight hours', () => {
  assert.equal(normalizeAssessmentDuration('45'), 45)
  assert.equal(normalizeAssessmentDuration(1), 1)
  assert.equal(normalizeAssessmentDuration(480), 480)
  assert.equal(normalizeAssessmentDuration(0), 60)
  assert.equal(normalizeAssessmentDuration(481), 60)
})

test('restores the exact remaining time for an unchanged attempt', () => {
  const rawState = createAssessmentTimeState({
    attemptStartedAt: '2026-10-02T04:00:00.000Z',
    remainingSeconds: 2633,
  })
  assert.equal(restoreAssessmentTimeState(rawState, {
    attemptStartedAt: '2026-10-02T04:00:00.000Z',
    maximumSeconds: 3600,
  }), 2633)
  assert.equal(getAssessmentTimeStateKey('attempt-1'), 'trigger3d:assessment-time:attempt-1')
})

test('rejects saved time after a faculty reset changes the attempt revision', () => {
  const rawState = createAssessmentTimeState({
    attemptStartedAt: '2026-10-02T04:00:00.000Z',
    remainingSeconds: 2633,
  })
  assert.equal(restoreAssessmentTimeState(rawState, {
    attemptStartedAt: '2026-10-02T05:00:00.000Z',
    maximumSeconds: 3600,
  }), null)
})

test('formats the whole-assessment countdown', () => {
  assert.equal(formatAssessmentTime(3599), '59:59')
  assert.equal(formatAssessmentTime(3661), '1:01:01')
  assert.equal(formatAssessmentTime(0), '0:00')
})
