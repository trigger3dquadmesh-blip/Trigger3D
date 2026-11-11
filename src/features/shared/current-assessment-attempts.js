function attemptTimestamp(attempt) {
  const values = [
    attempt.checkpoint_updated_at,
    attempt.integrity_locked_at,
    attempt.connection_interrupted_at,
    attempt.submitted_at,
    attempt.started_at,
    attempt.updated_at,
    attempt.created_at,
  ]
    .map((value) => Date.parse(value || ''))
    .filter(Number.isFinite)

  return values.length ? Math.max(...values) : 0
}

export function selectCurrentAssessmentAttempt(attempts) {
  return [...attempts].sort((left, right) => (
    Number(right.attempt_number || 0) - Number(left.attempt_number || 0)
    || attemptTimestamp(right) - attemptTimestamp(left)
  ))[0]
}

export function selectCurrentAssessmentAttempts(attempts) {
  const grouped = new Map()

  attempts.forEach((attempt) => {
    const key = `${attempt.student_id || ''}:${attempt.class_id}:${attempt.firearm_id}`
    grouped.set(key, [...(grouped.get(key) || []), attempt])
  })

  return [...grouped.values()]
    .map(selectCurrentAssessmentAttempt)
    .filter(Boolean)
}

// A reset keeps the attempt row for audit history, but clears the evidence that
// the current attempt was actually taken. Never treat that retained `submitted`
// value as an active result on student/faculty operational screens.
export function assessmentAttemptIsSubmitted(attempt) {
  return attempt?.status === 'submitted'
    && Boolean(attempt.has_activity || attempt.timer_started_at)
}
