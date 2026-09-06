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

test('scopes assessment locks and destinations to a class', () => {
  assert.equal(
    getStudentFirearmDestination('firearm-1', true, 'class-4b'),
    '/student/models/firearm-1/assessment?classId=class-4b',
  )
  assert.equal(
    getStudentFirearmDestination('firearm-1', false, 'class-4b'),
    '/student/models/firearm-1?classId=class-4b',
  )
  assert.equal(
    getAssessmentLockKey('firearm-1', 'class-4b'),
    'trigger3d:assessment-lock:class-4b:firearm-1',
  )
})
