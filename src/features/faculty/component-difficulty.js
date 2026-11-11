import { assessmentAttemptIsSubmitted } from '../shared/current-assessment-attempts.js'

export const minimumDifficultySample = 3

export function validSubmittedResultRows(resultRows, attempts) {
  const submittedAttemptIds = new Set(
    attempts
      .filter(assessmentAttemptIsSubmitted)
      .map((attempt) => attempt.id)
      .filter(Boolean),
  )

  return resultRows.filter((row) => (
    Boolean(row.attempt_id)
    && submittedAttemptIds.has(row.attempt_id)
  ))
}
