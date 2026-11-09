import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessmentAttemptHasStarted,
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

test('locks firearm viewing only after an assessment has actually started', () => {
  assert.equal(assessmentAttemptHasStarted(null), false)
  assert.equal(assessmentAttemptHasStarted({ status: 'in_progress', timer_started_at: null, has_activity: false }), false)
  assert.equal(assessmentAttemptHasStarted({ status: 'in_progress', timer_started_at: '2026-10-07T09:00:00Z', has_activity: false }), true)
  assert.equal(assessmentAttemptHasStarted({ status: 'in_progress', timer_started_at: null, has_activity: true }), true)
  assert.equal(assessmentAttemptHasStarted({ status: 'submitted', timer_started_at: '2026-10-07T09:00:00Z', has_activity: true }), false)
})

test('does not treat an untouched locked attempt as started', () => {
  assert.equal(assessmentAttemptHasStarted({
    status: 'in_progress',
    timer_started_at: null,
    has_activity: false,
    integrity_locked_at: '2026-10-07T09:00:00Z',
  }), false)
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
