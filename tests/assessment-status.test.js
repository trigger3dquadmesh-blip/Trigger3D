import test from 'node:test'
import assert from 'node:assert/strict'
import { assessmentStatusDetails, buildAssessmentActivity } from '../src/features/faculty/assessment-status.js'

test('buildAssessmentActivity labels each student assessment by its real status', () => {
  const activity = buildAssessmentActivity(
    [
      { status: 'active', student_id: 'student-a', student: { email: 'a@parsu.edu.ph', full_name: 'Arian Agdoro' } },
      { status: 'active', student_id: 'student-b', student: { email: 'b@parsu.edu.ph', full_name: 'Jeema Domettita' } },
    ],
    [{ firearm_id: 'gun-a', is_open: true }, { firearm_id: 'gun-b', is_open: false }],
    [{ id: 'gun-a', name: 'M1911' }, { id: 'gun-b', name: 'M16' }],
    [
      { id: 'attempt-a', student_id: 'student-a', firearm_id: 'gun-a', status: 'submitted', has_activity: true, percentage: 80, attempt_number: 1 },
      { id: 'attempt-b', student_id: 'student-b', firearm_id: 'gun-a', status: 'in_progress', has_activity: true, attempt_number: 2 },
    ],
  )

  assert.deepEqual(activity.map((item) => item.status), ['closed', 'submitted', 'closed', 'in_progress'])
  assert.deepEqual(activity.map((item) => item.student_name), [
    'Arian Agdoro',
    'Arian Agdoro',
    'Jeema Domettita',
    'Jeema Domettita',
  ])
  assert.equal(assessmentStatusDetails('in_progress').label, 'In progress')
})

test('shows an unfinished attempt as closed when its faculty closes the assessment', () => {
  const [activity] = buildAssessmentActivity(
    [{ status: 'active', student_id: 'student-a', student: { email: 'a@parsu.edu.ph', full_name: 'Arian Agdoro' } }],
    [{ firearm_id: 'gun-a', is_open: false }],
    [{ id: 'gun-a', name: 'M1911' }],
    [{ id: 'attempt-a', student_id: 'student-a', firearm_id: 'gun-a', status: 'in_progress', has_activity: true }],
  )

  assert.equal(activity.status, 'closed')
})

test('keeps a restarted assessment as not started until the student answers', () => {
  const [activity] = buildAssessmentActivity(
    [{ status: 'active', student_id: 'student-a', student: { email: 'a@parsu.edu.ph', full_name: 'Arian Agdoro' } }],
    [{ firearm_id: 'gun-a', is_open: true }],
    [{ id: 'gun-a', name: 'M1911' }],
    [{ id: 'attempt-a', student_id: 'student-a', firearm_id: 'gun-a', status: 'in_progress', has_activity: false, attempt_number: 2 }],
  )

  assert.equal(activity.status, 'not_started')
  assert.equal(activity.attempt_count, 2)
})

test('shows a fullscreen-exited attempt as locked rather than submitted', () => {
  const [activity] = buildAssessmentActivity(
    [{ status: 'active', student_id: 'student-a', student: { email: 'a@parsu.edu.ph', full_name: 'Arian Agdoro' } }],
    [{ firearm_id: 'gun-a', is_open: true }],
    [{ id: 'gun-a', name: 'M1911' }],
    [{
      id: 'attempt-a',
      student_id: 'student-a',
      firearm_id: 'gun-a',
      status: 'in_progress',
      has_activity: true,
      integrity_locked_at: '2026-11-11T10:00:00Z',
      attempt_number: 2,
    }],
  )

  assert.equal(activity.status, 'locked')
  assert.equal(assessmentStatusDetails(activity.status).label, 'Locked')
})

test('uses the newest attempt instead of an older submitted record', () => {
  const [activity] = buildAssessmentActivity(
    [{ status: 'active', student_id: 'student-a', student: { email: 'a@parsu.edu.ph', full_name: 'Arian Agdoro' } }],
    [{ firearm_id: 'gun-a', is_open: true }],
    [{ id: 'gun-a', name: 'M1911' }],
    [
      { id: 'old', student_id: 'student-a', firearm_id: 'gun-a', status: 'submitted', submitted_at: '2026-11-10T10:00:00Z', attempt_number: 1 },
      { id: 'current', student_id: 'student-a', firearm_id: 'gun-a', status: 'in_progress', started_at: '2026-11-11T09:00:00Z', integrity_locked_at: '2026-11-11T10:00:00Z', has_activity: true, attempt_number: 2 },
    ],
  )

  assert.equal(activity.attempt_id, 'current')
  assert.equal(activity.status, 'locked')
})

test('handles old, new, and readmitted student accounts independently', () => {
  const activity = buildAssessmentActivity(
    [
      { status: 'active', student_id: 'old-student', student: { email: 'old@parsu.edu.ph', full_name: 'Old Student' } },
      { status: 'active', student_id: 'new-student', student: { email: 'new@parsu.edu.ph', full_name: 'New Student' } },
      { status: 'active', student_id: 'readmitted-student', student: { email: 'readmitted@parsu.edu.ph', full_name: 'Readmitted Student' } },
    ],
    [{ firearm_id: 'gun-a', is_open: true }],
    [{ id: 'gun-a', name: 'M1911' }],
    [
      { id: 'old-attempt', student_id: 'old-student', firearm_id: 'gun-a', status: 'submitted', has_activity: true, percentage: 75, submitted_at: '2026-11-01T10:00:00Z', attempt_number: 1 },
      { id: 'readmitted-attempt', student_id: 'readmitted-student', firearm_id: 'gun-a', status: 'in_progress', has_activity: true, connection_interrupted_at: '2026-11-11T10:00:00Z', attempt_number: 2 },
    ],
  )

  const statuses = Object.fromEntries(activity.map((item) => [item.student_email, item.status]))
  assert.deepEqual(statuses, {
    'old@parsu.edu.ph': 'submitted',
    'new@parsu.edu.ph': 'not_started',
    'readmitted@parsu.edu.ph': 'paused',
  })
})
