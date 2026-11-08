export function isAnswered(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function allQuestionsAnswered(questions, answers) {
  return questions.length > 0
    && questions.every((question) => isAnswered(answers[question.question_record_id]))
}

export function firstUnansweredQuestionIndex(questions, answers) {
  return questions.findIndex(
    (question) => !isAnswered(answers[question.question_record_id]),
  )
}

export function safeAssessmentQuestionIndex(questions, answers, preferredIndex = 0) {
  if (!questions.length) return 0
  const firstUnanswered = firstUnansweredQuestionIndex(questions, answers)
  if (firstUnanswered >= 0) return firstUnanswered
  return Math.min(Math.max(Number(preferredIndex) || 0, 0), questions.length - 1)
}

export function buildSubmission(questions, answers) {
  return questions.map((question) => ({
    question_id: question.question_record_id,
    answer: answers[question.question_record_id].trim(),
  }))
}
