import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allQuestionsAnswered,
  buildSubmission,
  isAnswered,
} from '../src/features/student/assessment/assessment-utils.js'

const questions = [
  { question_record_id: 'question-2' },
  { question_record_id: 'question-1' },
]

test('treats whitespace-only identification answers as unanswered', () => {
  assert.equal(isAnswered('  '), false)
  assert.equal(isAnswered('Slide'), true)
})

test('requires every randomized question to be answered', () => {
  assert.equal(allQuestionsAnswered(questions, { 'question-2': 'Barrel' }), false)
  assert.equal(allQuestionsAnswered(questions, {
    'question-2': 'Barrel',
    'question-1': 'Slide',
  }), true)
})

test('builds a trimmed submission while preserving assigned order', () => {
  assert.deepEqual(buildSubmission(questions, {
    'question-1': ' Slide ',
    'question-2': ' Barrel ',
  }), [
    { question_id: 'question-2', answer: 'Barrel' },
    { question_id: 'question-1', answer: 'Slide' },
  ])
})
