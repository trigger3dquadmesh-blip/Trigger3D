import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAssessmentLockKey,
  getStudentFirearmDestination,
} from '../src/features/student/assessment/assessment-lock.js'

test('routes an in-progress firearm directly to its assessment', () => {
  assert.equal(
    getStudentFirearmDestination('firearm-1', true),
    '/student/models/firearm-1/assessment',
  )
  assert.equal(
    getStudentFirearmDestination('firearm-1', false),
    '/student/models/firearm-1',
  )
  assert.equal(getAssessmentLockKey('firearm-1'), 'trigger3d:assessment-lock:firearm-1')
})
