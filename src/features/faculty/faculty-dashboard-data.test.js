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
  assert.deepEqual(result.submittedAttempts.map((item) => item.id), ['visible'])
})

test('faculty overview orders eligible submissions by latest activity', () => {
  const result = getActiveFacultyDashboardData({
    classes: [{ id: 'class', archived_at: null }],
    enrollments: [
      { class_id: 'class', student_id: 'one', status: 'active' },
      { class_id: 'class', student_id: 'two', status: 'active' },
    ],
    attempts: [
      { id: 'older', class_id: 'class', student_id: 'one', status: 'submitted', submitted_at: '2026-09-05T01:00:00Z' },
      { id: 'newer', class_id: 'class', student_id: 'two', status: 'submitted', submitted_at: '2026-09-06T01:00:00Z' },
    ],
  })

  assert.deepEqual(result.submittedAttempts.map((item) => item.id), ['newer', 'older'])
})
