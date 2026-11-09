export function assessmentAttemptWasReset(attempt) {
  return !attempt || (attempt.status === 'in_progress'
    && !attempt.timer_started_at
    && !attempt.has_activity)
}

export function resolveConnectionRecovery(attempt, checkpoint) {
  const resetToFreshAttempt = assessmentAttemptWasReset(attempt)

  // Older deployed reset functions can leave connection metadata behind.
  // A cleared timer and activity still prove that this is a fresh attempt.
  if (resetToFreshAttempt) return 'reset'
  if (checkpoint?.connection_interrupted_at || attempt.connection_interrupted_at) return 'waiting'
  if (checkpoint?.connection_restored_at) return 'approved'

  // Both approval and reset clear connection_interrupted_at. Only approval
  // writes connection_restored_at; a reset deliberately clears both fields.
  return 'reset'
}
