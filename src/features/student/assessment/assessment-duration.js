export function normalizeAssessmentDuration(value, fallback = 60) {
  const minutes = Number.parseInt(value, 10)
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 480 ? minutes : fallback
}

const timeStatePrefix = 'trigger3d:assessment-time:'

export function getAssessmentTimeStateKey(attemptId) {
  return `${timeStatePrefix}${attemptId}`
}

export function createAssessmentTimeState({ attemptStartedAt, remainingSeconds }) {
  return JSON.stringify({
    version: 1,
    attempt_started_at: attemptStartedAt,
    remaining_seconds: Math.max(0, Math.floor(Number(remainingSeconds) || 0)),
  })
}

export function restoreAssessmentTimeState(rawState, { attemptStartedAt, maximumSeconds }) {
  if (!rawState || !attemptStartedAt) return null
  try {
    const state = JSON.parse(rawState)
    if (state.version !== 1 || state.attempt_started_at !== attemptStartedAt) return null
    const remaining = Number(state.remaining_seconds)
    if (!Number.isInteger(remaining) || remaining < 0 || remaining > maximumSeconds) return null
    return remaining
  } catch {
    return null
  }
}

export function formatAssessmentTime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = Math.floor(seconds % 60)
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}
