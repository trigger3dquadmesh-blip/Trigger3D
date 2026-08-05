import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAssessmentDraft,
  getAssessmentDraftKey,
  restoreAssessmentDraft,
} from '../src/features/student/assessment/assessment-draft.js'

const questions = [
  { question_record_id: 'question-1' },
  { question_record_id: 'question-2' },
]

test('restores answers and position for the same assessment revision', () => {
  const rawDraft = createAssessmentDraft({
    answers: { 'question-1': 'Slide' },
    attemptStartedAt: '2026-08-04T10:00:00Z',
    currentIndex: 1,
    questions,
  })
  const restored = restoreAssessmentDraft(rawDraft, {
    attemptStartedAt: '2026-08-04T10:00:00Z',
    questions,
  })

  assert.deepEqual(restored, { answers: { 'question-1': 'Slide' }, currentIndex: 1 })
  assert.equal(getAssessmentDraftKey('attempt-1'), 'trigger3d:assessment-draft:attempt-1')
})

test('rejects stale drafts after a Faculty reset changes the attempt revision', () => {
  const rawDraft = createAssessmentDraft({
    answers: { 'question-1': 'Slide' },
    attemptStartedAt: '2026-08-04T10:00:00Z',
    currentIndex: 1,
    questions,
  })

  assert.deepEqual(
    restoreAssessmentDraft(rawDraft, {
      attemptStartedAt: '2026-08-04T11:00:00Z',
      questions,
    }),
    { answers: {}, currentIndex: 0 },
  )
})

test('rejects malformed drafts and answers for unknown questions', () => {
  assert.deepEqual(
    restoreAssessmentDraft('{invalid', {
      attemptStartedAt: '2026-08-04T10:00:00Z',
      questions,
    }),
    { answers: {}, currentIndex: 0 },
  )

  const rawDraft = createAssessmentDraft({
    answers: { 'question-1': 'Slide', unknown: 'Ignore me' },
    attemptStartedAt: '2026-08-04T10:00:00Z',
    currentIndex: 99,
    questions,
  })
  assert.deepEqual(
    restoreAssessmentDraft(rawDraft, {
      attemptStartedAt: '2026-08-04T10:00:00Z',
      questions,
    }),
    { answers: { 'question-1': 'Slide' }, currentIndex: 1 },
  )
})
