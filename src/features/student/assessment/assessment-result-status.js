import { assessmentAttemptIsSubmitted } from '../../shared/current-assessment-attempts.js'

export function resolveAssessmentResultStatus(status, attempt, { studentId, classId, firearmId }) {
  const matches = attempt && attempt.student_id === studentId
    && attempt.class_id === classId && attempt.firearm_id === firearmId
  const submitted = matches && assessmentAttemptIsSubmitted(attempt)
  // Closing a release can leave an untouched placeholder marked submitted.
  // Only a scoped attempt with timer/activity evidence represents a result.
  return {
    ...status,
    attempt_id: matches ? attempt.id : null,
    attempt_status: submitted ? 'submitted' : matches && attempt.status === 'in_progress' ? 'in_progress' : 'not_started',
    correct_count: submitted ? attempt.correct_count : null,
    total_questions: submitted ? attempt.total_questions : null,
    percentage: submitted ? attempt.percentage : null,
  }
}
