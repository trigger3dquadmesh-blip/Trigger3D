export function isAnswered(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function allQuestionsAnswered(questions, answers) {
  return questions.length > 0
    && questions.every((question) => isAnswered(answers[question.question_record_id]))
}

export function buildSubmission(questions, answers) {
  return questions.map((question) => ({
    question_id: question.question_record_id,
    answer: answers[question.question_record_id].trim(),
  }))
}
