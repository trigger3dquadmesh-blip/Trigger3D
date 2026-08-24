import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateQuestionResults,
  createAssessmentResultsCsv,
  groupAssessmentResults,
} from '../src/features/faculty/results-utils.js'

const rows = [
  {
    attempt_id: 'attempt-1',
    firearm_id: 'firearm-1',
    student_name: 'Student One',
    student_email: 'student@parsu.edu.ph',
    firearm_name: 'Gun A',
    firearm_caliber: '.45',
    correct_count: 1,
    total_questions: 2,
    percentage: 50,
    submitted_at: '2026-08-04T01:00:00Z',
    question_id: 'GA-T01',
    prompt: 'Identify this component.',
    component_name: 'Slide',
    student_answer: 'Slide',
    is_correct: true,
  },
  {
    attempt_id: 'attempt-1',
    firearm_id: 'firearm-1',
    student_name: 'Student One',
    student_email: 'student@parsu.edu.ph',
    firearm_name: 'Gun A',
    firearm_caliber: '.45',
    correct_count: 1,
    total_questions: 2,
    percentage: 50,
    submitted_at: '2026-08-04T01:00:00Z',
    question_id: 'GA-T02',
    prompt: 'Identify the second component.',
    component_name: 'Barrel',
    student_answer: '=HYPERLINK("https://invalid.example")',
    is_correct: false,
  },
]

test('groups per-question rows into a single assessment attempt', () => {
  const attempts = groupAssessmentResults(rows)

  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].questions.length, 2)
  assert.equal(attempts[0].percentage, 50)
})

test('lists submitted assessment attempts alphabetically by student surname', () => {
  const attempts = groupAssessmentResults([
    { ...rows[0], attempt_id: 'attempt-zoe', student_name: 'Zoe Maria Santos', student_email: 'zoe@parsu.edu.ph' },
    { ...rows[0], attempt_id: 'attempt-arian', student_name: 'Arian Jane Agdoro', student_email: 'arian@parsu.edu.ph' },
    { ...rows[0], attempt_id: 'attempt-no-name', student_name: 'no-name@parsu.edu.ph', student_email: 'no-name@parsu.edu.ph' },
  ])

  assert.deepEqual(attempts.map((attempt) => attempt.student_name), [
    'Arian Jane Agdoro',
    'Zoe Maria Santos',
    'Name not provided',
  ])
})

test('aggregates correct and incorrect responses per firearm question', () => {
  const repeatedRows = [
    ...rows,
    { ...rows[0], attempt_id: 'attempt-2', student_email: 'student2@parsu.edu.ph', is_correct: false },
    { ...rows[1], attempt_id: 'attempt-2', student_email: 'student2@parsu.edu.ph', is_correct: false },
  ]
  const analytics = aggregateQuestionResults(repeatedRows)

  assert.equal(analytics.length, 1)
  assert.equal(analytics[0].questions[0].response_count, 2)
  assert.equal(analytics[0].questions[0].correct_count, 1)
  assert.equal(analytics[0].questions[0].incorrect_count, 1)
  assert.equal(analytics[0].questions[0].accuracy, 50)
  assert.equal(analytics[0].questions[1].accuracy, 0)
})

test('creates Google Sheets-compatible CSV and neutralizes formulas', () => {
  const csv = createAssessmentResultsCsv(rows)

  assert.match(csv, /student_name,student_email/)
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/invalid\.example""\)"/)
  assert.equal(csv.split('\r\n').filter(Boolean).length, 3)
})

test('does not duplicate an email address into the student name field', () => {
  const emailOnlyRows = [{
    ...rows[0],
    student_name: rows[0].student_email,
  }]

  assert.equal(groupAssessmentResults(emailOnlyRows)[0].student_name, 'Name not provided')
  assert.match(createAssessmentResultsCsv(emailOnlyRows), /Name not provided/)
})
