import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allQuestionsAnswered,
  buildSubmission,
  firstUnansweredQuestionIndex,
  isAnswered,
  safeAssessmentQuestionIndex,
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

test('finds the first unanswered question in the assigned display order', () => {
  assert.equal(firstUnansweredQuestionIndex(questions, {
    'question-2': 'Barrel',
  }), 1)
  assert.equal(firstUnansweredQuestionIndex(questions, {
    'question-2': 'Barrel',
    'question-1': 'Slide',
  }), -1)
})

test('recovery cannot skip an unanswered question even when its checkpoint is ahead', () => {
  assert.equal(safeAssessmentQuestionIndex(questions, {}, 1), 0)
  assert.equal(safeAssessmentQuestionIndex(questions, {
    'question-2': 'Barrel',
  }, 1), 1)
  assert.equal(safeAssessmentQuestionIndex(questions, {
    'question-2': 'Barrel',
    'question-1': 'Slide',
  }, 1), 1)
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
