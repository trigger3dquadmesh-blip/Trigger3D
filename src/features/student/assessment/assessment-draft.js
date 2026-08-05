const draftPrefix = 'trigger3d:assessment-draft:'

export function getAssessmentDraftKey(attemptId) {
  return `${draftPrefix}${attemptId}`
}

function questionSignature(questions) {
  return questions.map((question) => question.question_record_id).join(':')
}

export function createAssessmentDraft({ answers, attemptStartedAt, currentIndex, questions }) {
  return JSON.stringify({
    version: 1,
    attempt_started_at: attemptStartedAt,
    question_signature: questionSignature(questions),
    current_index: currentIndex,
    answers,
  })
}

export function restoreAssessmentDraft(rawDraft, { attemptStartedAt, questions }) {
  const emptyDraft = { answers: {}, currentIndex: 0 }
  if (!rawDraft || !attemptStartedAt || !questions.length) return emptyDraft

  try {
    const draft = JSON.parse(rawDraft)
    if (draft.version !== 1
      || draft.attempt_started_at !== attemptStartedAt
      || draft.question_signature !== questionSignature(questions)) {
      return emptyDraft
    }

    const questionIds = new Set(questions.map((question) => question.question_record_id))
    const answers = Object.fromEntries(
      Object.entries(draft.answers ?? {}).filter(
        ([questionId, answer]) => questionIds.has(questionId) && typeof answer === 'string',
      ),
    )
    const requestedIndex = Number.isInteger(draft.current_index) ? draft.current_index : 0
    const currentIndex = Math.max(0, Math.min(requestedIndex, questions.length - 1))
    return { answers, currentIndex }
  } catch {
    return emptyDraft
  }
}
