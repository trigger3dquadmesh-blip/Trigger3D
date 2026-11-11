import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessmentAttemptHasStarted,
  getAssessmentAccessState,
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

test('uses one access state for normal, paused, and integrity-locked attempts', () => {
  assert.equal(getAssessmentAccessState(null), 'available')
  assert.equal(getAssessmentAccessState({ status: 'in_progress', timer_started_at: null, has_activity: false, connection_interrupted_at: '2026-11-11T10:00:00Z' }), 'available')
  assert.equal(getAssessmentAccessState({ status: 'in_progress', timer_started_at: null, has_activity: false, integrity_locked_at: '2026-11-11T10:00:00Z' }), 'available')
  assert.equal(getAssessmentAccessState({ status: 'not_started', timer_started_at: null, has_activity: false, connection_interrupted_at: '2026-11-11T10:00:00Z', integrity_locked_at: '2026-11-11T10:00:00Z' }), 'available')
  assert.equal(getAssessmentAccessState({ status: 'submitted', timer_started_at: '2026-11-11T09:00:00Z', has_activity: true, connection_interrupted_at: '2026-11-11T10:00:00Z' }), 'available')
  assert.equal(getAssessmentAccessState({ status: 'in_progress', timer_started_at: '2026-11-11T09:00:00Z', has_activity: true }), 'in_progress')
  assert.equal(getAssessmentAccessState({ status: 'in_progress', timer_started_at: '2026-11-11T09:00:00Z', has_activity: true, connection_interrupted_at: '2026-11-11T10:00:00Z' }), 'paused')
  assert.equal(getAssessmentAccessState({ status: 'in_progress', timer_started_at: '2026-11-11T09:00:00Z', has_activity: true, integrity_locked_at: '2026-11-11T10:00:00Z' }), 'locked')
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

test('isolates browser assessment locks between student accounts', () => {
  assert.equal(
    getAssessmentLockKey('firearm-1', 'class-4b', 'student-a'),
    'trigger3d:assessment-lock:student-a:class-4b:firearm-1',
  )
  assert.notEqual(
    getAssessmentLockKey('firearm-1', 'class-4b', 'student-a'),
    getAssessmentLockKey('firearm-1', 'class-4b', 'student-b'),
  )
})
