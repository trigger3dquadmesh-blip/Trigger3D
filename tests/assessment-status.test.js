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
      { id: 'attempt-a', student_id: 'student-a', firearm_id: 'gun-a', status: 'submitted', percentage: 80, attempt_number: 1 },
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
