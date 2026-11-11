const lockPrefix = 'trigger3d:assessment-lock:'
export const assessmentNavigationLockEvent = 'trigger3d:assessment-navigation-lock'

export function setAssessmentNavigationLock(locked) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(assessmentNavigationLockEvent, {
    detail: Boolean(locked),
  }))
}

export function getAssessmentLockKey(firearmId, classId = '', studentId = '') {
  const accountScope = studentId ? `${studentId}:` : ''
  return classId
    ? `${lockPrefix}${accountScope}${classId}:${firearmId}`
    : `${lockPrefix}${accountScope}${firearmId}`
}

export function setAssessmentLock(firearmId, locked, classId = '', studentId = '') {
  try {
    const key = getAssessmentLockKey(firearmId, classId, studentId)
    if (locked) localStorage.setItem(key, new Date().toISOString())
    else localStorage.removeItem(key)
  } catch {
    // The database remains authoritative if browser Storage is unavailable.
  }
}

export function getStudentFirearmDestination(firearmId, assessmentInProgress, classId = '') {
  const classQuery = classId ? `?classId=${encodeURIComponent(classId)}` : ''
  return assessmentInProgress
    ? `/student/models/${firearmId}/assessment${classQuery}`
    : `/student/models/${firearmId}${classQuery}`
}

export function assessmentAttemptHasStarted(attempt) {
  return attempt?.status === 'in_progress'
    && Boolean(attempt.timer_started_at || attempt.has_activity)
}

export function getAssessmentAccessState(attempt) {
  if (!attempt) return 'available'

  // These timestamps are the authoritative access controls. Older attempts can
  // carry a legacy or temporarily stale status while still being paused/locked.
  // Never expose the firearm just because that status has not caught up yet.
  if (attempt.connection_interrupted_at) return 'paused'
  if (attempt.integrity_locked_at) return 'locked'
  return assessmentAttemptHasStarted(attempt) ? 'in_progress' : 'available'
}
