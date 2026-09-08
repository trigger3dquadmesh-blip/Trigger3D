const activeAssessmentKey = 'trigger3d.assessment.active-session'

export function getActiveAssessmentSession(storage) {
  try {
    const session = JSON.parse(storage.getItem(activeAssessmentKey))
    return session?.userId && session?.attemptId ? session : null
  } catch {
    return null
  }
}

export function hasActiveAssessmentSession(storage, userId) {
  const session = getActiveAssessmentSession(storage)
  return Boolean(userId && session?.userId === userId)
}

export function markActiveAssessmentSession(storage, userId, attemptId) {
  if (!userId || !attemptId) return
  try {
    storage.setItem(activeAssessmentKey, JSON.stringify({ userId, attemptId }))
  } catch {
    // The assessment still works when browser storage is restricted.
  }
}

export function clearActiveAssessmentSession(storage, userId, attemptId = '') {
  try {
    const session = getActiveAssessmentSession(storage)
    if (!session || session.userId !== userId || (attemptId && session.attemptId !== attemptId)) return
    storage.removeItem(activeAssessmentKey)
  } catch {
    // Cleanup is best-effort when browser storage is restricted.
  }
}
