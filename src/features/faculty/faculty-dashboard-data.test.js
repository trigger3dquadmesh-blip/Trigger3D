import assert from 'node:assert/strict'
import test from 'node:test'
import { getActiveFacultyDashboardData } from './faculty-dashboard-data.js'

test('faculty overview includes attempts only for active enrollments in active classes', () => {
  const result = getActiveFacultyDashboardData({
    classes: [
      { id: 'active-class', archived_at: null },
      { id: 'archived-class', archived_at: '2026-09-06T00:00:00Z' },
    ],
    enrollments: [
      { class_id: 'active-class', student_id: 'active-student', status: 'active' },
      { class_id: 'active-class', student_id: 'removed-student', status: 'removed' },
      { class_id: 'archived-class', student_id: 'archived-student', status: 'active' },
    ],
    attempts: [
      { id: 'visible', class_id: 'active-class', student_id: 'active-student', status: 'submitted', submitted_at: '2026-09-06T03:00:00Z' },
      { id: 'removed', class_id: 'active-class', student_id: 'removed-student', status: 'submitted', submitted_at: '2026-09-06T02:00:00Z' },
      { id: 'archived', class_id: 'archived-class', student_id: 'archived-student', status: 'submitted', submitted_at: '2026-09-06T01:00:00Z' },
      { id: 'unfinished', class_id: 'active-class', student_id: 'active-student', status: 'in_progress', started_at: '2026-09-06T04:00:00Z' },
    ],
  })

  assert.deepEqual(result.activeClasses.map((item) => item.id), ['active-class'])
  assert.deepEqual(result.activeEnrollments.map((item) => item.student_id), ['active-student'])
  assert.deepEqual(result.submittedAttempts.map((item) => item.id), [])
  assert.deepEqual(result.currentAttempts.map((item) => item.id), ['unfinished'])
})

test('faculty overview orders eligible submissions by latest activity', () => {
  const result = getActiveFacultyDashboardData({
    classes: [{ id: 'class', archived_at: null }],
    enrollments: [
      { class_id: 'class', student_id: 'one', status: 'active' },
      { class_id: 'class', student_id: 'two', status: 'active' },
    ],
    attempts: [
      { id: 'older', class_id: 'class', student_id: 'one', status: 'submitted', has_activity: true, submitted_at: '2026-09-05T01:00:00Z' },
      { id: 'newer', class_id: 'class', student_id: 'two', status: 'submitted', has_activity: true, submitted_at: '2026-09-06T01:00:00Z' },
    ],
  })

  assert.deepEqual(result.submittedAttempts.map((item) => item.id), ['newer', 'older'])
})

test('faculty overview excludes historical submissions after a student attempt is reset', () => {
  const result = getActiveFacultyDashboardData({
    classes: [{ id: 'class', archived_at: null }],
    enrollments: [
      { class_id: 'class', student_id: 'jeema', status: 'active' },
      { class_id: 'class', student_id: 'stephanie', status: 'active' },
      { class_id: 'class', student_id: 'kennedy', status: 'active' },
    ],
    attempts: [
      { id: 'jeema-old', class_id: 'class', student_id: 'jeema', firearm_id: 'gun', status: 'submitted', submitted_at: '2026-11-09T08:00:00Z' },
      { id: 'jeema-reset', class_id: 'class', student_id: 'jeema', firearm_id: 'gun', status: 'in_progress', has_activity: false, started_at: '2026-11-11T09:00:00Z' },
      { id: 'stephanie-current', class_id: 'class', student_id: 'stephanie', firearm_id: 'gun', status: 'submitted', has_activity: true, submitted_at: '2026-11-11T08:30:00Z' },
      { id: 'kennedy-old', class_id: 'class', student_id: 'kennedy', firearm_id: 'gun', status: 'submitted', submitted_at: '2026-11-08T08:00:00Z' },
      { id: 'kennedy-reset', class_id: 'class', student_id: 'kennedy', firearm_id: 'gun', status: 'in_progress', has_activity: false, started_at: '2026-11-11T09:15:00Z' },
    ],
  })

  assert.deepEqual(result.submittedAttempts.map((item) => item.id), ['stephanie-current'])
})

test('faculty overview hides a retained submitted status after the same attempt row is reset', () => {
  const result = getActiveFacultyDashboardData({
    classes: [{ id: 'class', archived_at: null }],
    enrollments: [{ class_id: 'class', student_id: 'student', status: 'active' }],
    attempts: [{
      id: 'reset-in-place',
      class_id: 'class',
      student_id: 'student',
      firearm_id: 'gun',
      status: 'submitted',
      has_activity: false,
      timer_started_at: null,
      submitted_at: '2026-11-11T08:30:00Z',
    }],
  })

  assert.deepEqual(result.submittedAttempts, [])
})
