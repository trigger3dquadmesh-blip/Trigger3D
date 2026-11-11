import test from 'node:test'
import assert from 'node:assert/strict'
import {
  selectCurrentAssessmentAttempt,
  selectCurrentAssessmentAttempts,
  assessmentAttemptIsSubmitted,
} from '../src/features/shared/current-assessment-attempts.js'

test('a newer reset attempt replaces an older submitted attempt operationally', () => {
  const submitted = {
    id: 'old-submission',
    student_id: 'student',
    class_id: 'class',
    firearm_id: 'firearm',
    attempt_number: 1,
    status: 'submitted',
    submitted_at: '2026-11-11T01:00:00Z',
  }
  const reset = {
    id: 'new-reset',
    student_id: 'student',
    class_id: 'class',
    firearm_id: 'firearm',
    attempt_number: 2,
    status: 'not_started',
  }

  assert.equal(selectCurrentAssessmentAttempt([submitted, reset]).id, 'new-reset')
  assert.deepEqual(selectCurrentAssessmentAttempts([submitted, reset]), [reset])
})

test('timestamps break ties within the same attempt number', () => {
  const earlier = { id: 'earlier', attempt_number: 2, checkpoint_updated_at: '2026-11-11T01:00:00Z' }
  const later = { id: 'later', attempt_number: 2, checkpoint_updated_at: '2026-11-11T02:00:00Z' }

  assert.equal(selectCurrentAssessmentAttempt([earlier, later]).id, 'later')
})

test('a retained submitted status without attempt activity is treated as reset', () => {
  assert.equal(assessmentAttemptIsSubmitted({
    status: 'submitted',
    has_activity: false,
    timer_started_at: null,
  }), false)
  assert.equal(assessmentAttemptIsSubmitted({
    status: 'submitted',
    has_activity: true,
  }), true)
  assert.equal(assessmentAttemptIsSubmitted({
    status: 'submitted',
    timer_started_at: '2026-11-11T01:00:00Z',
  }), true)
})
