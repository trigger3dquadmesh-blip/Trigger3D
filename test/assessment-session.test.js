import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearActiveAssessmentSession,
  hasActiveAssessmentSession,
  markActiveAssessmentSession,
} from '../src/features/student/assessment/assessment-session.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

test('enables away logout only for the student with an active assessment', () => {
  const storage = memoryStorage()
  markActiveAssessmentSession(storage, 'student-a', 'attempt-a')

  assert.equal(hasActiveAssessmentSession(storage, 'student-a'), true)
  assert.equal(hasActiveAssessmentSession(storage, 'faculty-a'), false)
  assert.equal(hasActiveAssessmentSession(storage, 'admin-a'), false)
  assert.equal(hasActiveAssessmentSession(storage, 'student-b'), false)
})

test('clears the active marker only after its matching attempt finishes', () => {
  const storage = memoryStorage()
  markActiveAssessmentSession(storage, 'student-a', 'attempt-a')

  clearActiveAssessmentSession(storage, 'student-a', 'attempt-b')
  assert.equal(hasActiveAssessmentSession(storage, 'student-a'), true)

  clearActiveAssessmentSession(storage, 'student-a', 'attempt-a')
  assert.equal(hasActiveAssessmentSession(storage, 'student-a'), false)
})
