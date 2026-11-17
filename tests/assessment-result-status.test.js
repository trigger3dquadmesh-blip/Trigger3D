import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveAssessmentResultStatus } from '../src/features/student/assessment/assessment-result-status.js'

const scope = { studentId: 'student', classId: 'class', firearmId: 'textured' }
const status = { is_released: false, attempt_status: 'submitted', percentage: 0 }
const attempt = { id: 'attempt', student_id: 'student', class_id: 'class', firearm_id: 'textured', status: 'submitted', has_activity: false, timer_started_at: null, percentage: 0 }

test('closed assessment never started has no result despite submitted placeholder', () => {
  const resolved = resolveAssessmentResultStatus(status, attempt, scope)
  assert.equal(resolved.attempt_status, 'not_started')
  assert.equal(resolved.percentage, null)
  assert.equal(resolved.is_released, false)
})

test('genuine completed result remains visible after faculty closes release, including zero score', () => {
  const resolved = resolveAssessmentResultStatus(status, { ...attempt, timer_started_at: 'now', total_questions: 10, correct_count: 0 }, scope)
  assert.equal(resolved.attempt_status, 'submitted')
  assert.equal(resolved.percentage, 0)
  assert.equal(resolved.total_questions, 10)
})

test('results from another firearm, class, or student cannot appear', () => {
  for (const mismatch of [{ firearm_id: 'plain' }, { class_id: 'another' }, { student_id: 'another' }]) {
    const resolved = resolveAssessmentResultStatus(status, { ...attempt, has_activity: true, ...mismatch }, scope)
    assert.equal(resolved.attempt_status, 'not_started')
    assert.equal(resolved.attempt_id, null)
  }
})

test('missing attempt and reset placeholder do not create results when release is opened', () => {
  for (const row of [null, attempt, { ...attempt, status: 'in_progress' }]) {
    const resolved = resolveAssessmentResultStatus({ ...status, is_released: true }, row, scope)
    assert.notEqual(resolved.attempt_status, 'submitted')
    assert.equal(resolved.percentage, null)
    assert.equal(resolved.is_released, true)
  }
})
